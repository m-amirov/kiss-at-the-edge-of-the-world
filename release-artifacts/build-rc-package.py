import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import zipfile

TEXT_EXTENSIONS = {".css", ".html", ".js", ".json", ".mjs"}
ENTRYPOINTS = ("index.html", "literary.html")
REQUIRED_STATIC_FILES = ("assets/branding/kiss-at-the-edge-cover.png", "assets/branding/kiss-at-the-edge-icon.png")
PROHIBITED_PARTS = {".git", ".loop", "artifacts", "content", "docs", "node_modules", "output", "release-artifacts", "tests", "tools"}
HTML_URL_RE = re.compile(r"\b(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)
JS_IMPORT_RE = re.compile(r"(?:import|export)\s*(?:\([^'\"]*|[^'\"]*?from\s*)?['\"]([^'\"]+)['\"]")
CSS_URL_RE = re.compile(r"url\(\s*['\"]?([^'\")]+)", re.IGNORECASE)
STATIC_ASSET_RE = re.compile(r"['\"]((?:/|\./|\.\./)assets/[^'\"`?#]+)['\"]")

class PackageError(RuntimeError):
    pass

def strict_text(path: Path) -> str:
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        raise PackageError(f"refusing to decode unsupported text extension: {path}")
    try:
        return path.read_text(encoding="utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise PackageError(f"invalid UTF-8 text dependency: {path}: {error}") from error

def resolve_local(root: Path, source: PurePosixPath, raw_url: str) -> str | None:
    value = raw_url.strip()
    if not value or value.startswith(("#", "data:", "http://", "https://", "//", "mailto:", "javascript:")):
        return None
    value = value.split("?", 1)[0].split("#", 1)[0].replace("\\", "/")
    candidate = root / value.lstrip("/") if value.startswith("/") else root / Path(source.parent.as_posix()) / value
    resolved = candidate.resolve()
    try:
        relative = resolved.relative_to(root.resolve()).as_posix()
    except ValueError as error:
        raise PackageError(f"dependency escapes project root: {source} -> {raw_url}") from error
    if not resolved.is_file():
        raise PackageError(f"unresolved local dependency: {source} -> {raw_url} ({relative})")
    return relative

def references_for(relative: str, text: str):
    suffix = PurePosixPath(relative).suffix.lower()
    patterns = []
    if suffix == ".html": patterns.append(HTML_URL_RE)
    if suffix in {".js", ".mjs"}: patterns.extend((JS_IMPORT_RE, STATIC_ASSET_RE))
    if suffix == ".css": patterns.append(CSS_URL_RE)
    for pattern in patterns:
        yield from (match.group(1) for match in pattern.finditer(text))

def dependency_closure(root: Path) -> tuple[set[str], str]:
    pending = list(ENTRYPOINTS)
    files, source_text = set(), []
    while pending:
        relative = PurePosixPath(pending.pop()).as_posix()
        if relative in files: continue
        path = root / relative
        if not path.is_file(): raise PackageError(f"missing dependency: {relative}")
        files.add(relative)
        if path.suffix.lower() not in TEXT_EXTENSIONS: continue
        text = strict_text(path)
        source_text.append(text)
        for raw_url in references_for(relative, text):
            dependency = resolve_local(root, PurePosixPath(relative), raw_url)
            if dependency and dependency not in files: pending.append(dependency)
    return files, "\n".join(source_text)

def build_package(root: Path, output: Path) -> dict:
    root = root.resolve()
    files, source_text = dependency_closure(root)
    manifest = json.loads(strict_text(root / "assets" / "asset-manifest.json"))
    manifest_assets = [entry for section in ("assets", "previewAssets") for entry in manifest.get(section, [])
        if (entry.get("status") == "integrated" or entry.get("runtimePath"))
        and any(os.path.basename(candidate or "") in source_text for candidate in (entry.get("runtimePath"), entry.get("runtimePortraitAsset"), entry.get("path"), entry.get("portraitAsset")))]
    files.update(asset_path for entry in manifest_assets for asset_path in (entry.get("runtimePath", entry.get("path")), entry.get("runtimePortraitAsset", entry.get("portraitAsset"))) if asset_path)
    files.update(REQUIRED_STATIC_FILES)
    missing = sorted(relative for relative in files if not (root / relative).is_file())
    if missing: raise PackageError("missing dependency: " + ", ".join(missing))
    prohibited = sorted(relative for relative in files if PROHIBITED_PARTS.intersection(PurePosixPath(relative).parts))
    if prohibited: raise PackageError("prohibited paths in package input: " + ", ".join(prohibited))
    if "index.html" not in files: raise PackageError("index.html is missing from the package")
    output.parent.mkdir(parents=True, exist_ok=True)
    unpacked = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for relative in sorted(files):
            data = (root / relative).read_bytes()
            unpacked += len(data)
            info = zipfile.ZipInfo(relative, (1980, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        bad = archive.testzip()
        if bad: raise PackageError(f"archive integrity failure: {bad}")
    archive_bytes = output.read_bytes()
    return {"files": len(files), "runtimeAssets": sum(x.startswith("assets/") for x in files), "unpacked": unpacked, "zip": len(archive_bytes), "sha256": hashlib.sha256(archive_bytes).hexdigest()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or Path(os.environ.get("RC_ARCHIVE_PATH", args.root / "release-artifacts" / "kiss-at-the-edge-of-the-world-rc-release-kiss-rc-2026-09-30.zip"))
    try: print(json.dumps(build_package(args.root, output)))
    except (PackageError, json.JSONDecodeError) as error: raise SystemExit(f"BLOCKED_FINAL_LOCAL_RC_PACKAGER: {error}") from error

if __name__ == "__main__": main()
