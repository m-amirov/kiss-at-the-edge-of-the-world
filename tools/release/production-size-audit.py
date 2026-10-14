#!/usr/bin/env python3
"""Build and audit an explicit production asset allowlist without touching source art."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


SIZE_LIMIT = 95_000_000
IMAGE_OR_MEDIA = re.compile(r"[A-Za-z0-9][A-Za-z0-9._\-\[\]]*\.(?:webp|png|ogg|ttf|woff2?|otf)", re.IGNORECASE)
ALLOWED_RUNTIME_PNGS = {
    "assets/branding/kiss-at-the-edge-cover.png",
    "assets/branding/kiss-at-the-edge-icon.png",
    "assets/cg/s26-route-choice-courtyard-final.png",
    "assets/cg/s26-route-choice-courtyard-final-portrait.png",
}
TEXT_EXTENSIONS = {".css", ".html", ".js", ".mjs"}
HTML_URL_RE = re.compile(r"\b(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)
JS_IMPORT_RE = re.compile(r"(?:import\s*(?:\(|[^'\"]*?from\s*)|export\s+[^'\"]*?from\s*)['\"]([^'\"]+)['\"]")
CSS_URL_RE = re.compile(r"url\(\s*['\"]?([^'\")]+)", re.IGNORECASE)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def current_head(root: Path) -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()


def category(relative: str) -> str:
    path = relative.replace("\\", "/")
    if path.startswith("assets/cg/"):
        return "CG"
    if path.startswith("assets/backgrounds/"):
        return "backgrounds"
    if path.startswith("assets/characters/"):
        return "characters"
    if path.startswith("assets/audio/music/"):
        return "music"
    if path.startswith("assets/fonts/"):
        return "fonts"
    if path.startswith("assets/branding/"):
        return "branding"
    if path.startswith("assets/"):
        return "other assets"
    if Path(path).suffix.lower() in {".js", ".mjs", ".css", ".html"}:
        return "JS/CSS/HTML"
    return "other"


def runtime_files(root: Path) -> list[Path]:
    pending = [root / name for name in ("index.html", "literary.html")]
    seen: set[Path] = set()
    while pending:
        path = pending.pop()
        path = path.resolve()
        if path in seen or not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        seen.add(path)
        text = path.read_text(encoding="utf-8")
        suffix = path.suffix.lower()
        if suffix == ".html":
            references = HTML_URL_RE.findall(text)
        elif suffix in {".js", ".mjs"}:
            references = JS_IMPORT_RE.findall(text)
        elif suffix == ".css":
            references = CSS_URL_RE.findall(text)
        else:
            references = []
        for raw in references:
            value = raw.split("?", 1)[0].split("#", 1)[0]
            if not value or value in {"/sdk.js"} or value.startswith(("/", "//", "http:", "https:", "data:", "mailto:", "javascript:")):
                continue
            candidate = (root / value.lstrip("/")) if value.startswith("/") else (path.parent / value)
            if candidate.suffix == "" and (candidate.with_suffix(".js")).is_file():
                candidate = candidate.with_suffix(".js")
            pending.append(candidate)
    return sorted(seen)


def runtime_text(root: Path) -> str:
    return "\n".join(path.read_text(encoding="utf-8") for path in runtime_files(root))


def source_asset_files(root: Path) -> list[Path]:
    return sorted(path for path in (root / "assets").rglob("*") if path.is_file() and path.name not in {"asset-manifest.json", "rights-manifest.json"})


def discover_allowlist(root: Path) -> dict:
    source = runtime_text(root)
    source_files = source_asset_files(root)
    manifest = json.loads((root / "assets" / "asset-manifest.json").read_text(encoding="utf-8"))
    manifest_entries = [*manifest.get("assets", []), *manifest.get("previewAssets", [])]
    by_name: dict[str, list[Path]] = defaultdict(list)
    for path in source_files:
        by_name[path.name].append(path)
    referenced_names = {match.group(0) for match in IMAGE_OR_MEDIA.finditer(source)}
    included: set[str] = set()
    ambiguous: dict[str, list[str]] = {}
    for name in sorted(referenced_names):
        matches = by_name.get(name, [])
        if len(matches) == 1:
            included.add(matches[0].relative_to(root).as_posix())
        elif len(matches) > 1:
            ambiguous[name] = [path.relative_to(root).as_posix() for path in matches]
            included.update(ambiguous[name])
    included.update({
        "assets/branding/kiss-at-the-edge-cover.png",
        "assets/branding/kiss-at-the-edge-icon.png",
    })
    # Audio filenames are derived at runtime from cue ids (`${cueId}.ogg`),
    # so the generated source text contains ids but not the final file names.
    included.update(
        path.relative_to(root).as_posix()
        for path in source_files
        if path.parent.relative_to(root).as_posix() == "assets/audio/music" and path.suffix.lower() == ".ogg"
    )
    missing = sorted(name for name in referenced_names if name not in by_name)
    if missing:
        raise RuntimeError("runtime asset references do not exist: " + ", ".join(missing))
    # A runtime entry may select its portrait derivative dynamically from the
    # manifest; the portrait basename therefore need not occur in source text.
    # Once any manifest variant is referenced, retain both runtime variants.
    for entry in manifest_entries:
        variants = [entry.get("path"), entry.get("portraitAsset"), entry.get("runtimePath"), entry.get("runtimePortraitAsset")]
        if any(candidate and Path(candidate).name in referenced_names for candidate in variants):
            included.update(candidate for candidate in (entry.get("runtimePath"), entry.get("runtimePortraitAsset")) if candidate)
    invalid_pngs = sorted(path for path in included if path.lower().endswith(".png") and path not in ALLOWED_RUNTIME_PNGS)
    if invalid_pngs:
        raise RuntimeError("source PNG would ship without an approved runtime exception: " + ", ".join(invalid_pngs))
    return {
        "schemaVersion": 1,
        "sourceHead": current_head(root),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contract": {
            "routes": ["eric", "nick", "damir", "alice"],
            "locales": ["ru", "en"],
            "viewports": ["1920x900", "390x844", "360x640"],
            "maxUnpackedBytes": SIZE_LIMIT,
            "authoredSources": ["src/literary-visual-directions.js", "src/literary-player.js", "src/music-cues.js", "src/literary.css"],
        },
        "staticFiles": ["assets/branding/kiss-at-the-edge-cover.png", "assets/branding/kiss-at-the-edge-icon.png"],
        "assets": sorted(included),
        "discovery": {
            "sourceAssetCount": len(source_files),
            "referencedBasenameCount": len(referenced_names),
            "ambiguousBasenames": ambiguous,
            "approvedRuntimePngs": sorted(path for path in included if path.lower().endswith(".png")),
        },
    }


def duplicate_groups(items: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        groups[item["sha256"]].append(item)
    return [
        {"sha256": digest, "bytes": values[0]["bytes"], "files": [value["path"] for value in values]}
        for digest, values in sorted(groups.items()) if len(values) > 1
    ]


def source_inventory(root: Path, allowlist: dict) -> dict:
    listed = set(allowlist["assets"]) | set(allowlist.get("staticFiles", []))
    files = []
    for path in source_asset_files(root):
        relative = path.relative_to(root).as_posix()
        files.append({"path": relative, "bytes": path.stat().st_size, "format": path.suffix.lower().lstrip("."), "category": category(relative), "sha256": sha256_file(path), "runtimeIncluded": relative in listed})
    unused = [item for item in files if not item["runtimeIncluded"]]
    png_unused = [item for item in unused if item["format"] == "png"]
    return {
        "files": len(files),
        "bytes": sum(item["bytes"] for item in files),
        "duplicateGroups": duplicate_groups(files),
        "unusedFiles": unused,
        "unusedBytes": sum(item["bytes"] for item in unused),
        "sourcePngNotNeededAtRuntime": png_unused,
        "sourcePngNotNeededBytes": sum(item["bytes"] for item in png_unused),
    }


def zip_inventory(zip_path: Path) -> dict:
    files = []
    with zipfile.ZipFile(zip_path) as archive:
        entries = []
        for info in archive.infolist():
            entry = {"path": info.filename, "bytes": info.file_size, "compressedBytes": info.compress_size, "isDirectory": info.is_dir()}
            entries.append(entry)
            if info.is_dir():
                continue
            with archive.open(info) as handle:
                data = handle.read()
            files.append({**entry, "format": Path(info.filename).suffix.lower().lstrip("."), "category": category(info.filename), "sha256": sha256_bytes(data)})
    categories = []
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in files:
        grouped[item["category"]].append(item)
    for name, values in sorted(grouped.items(), key=lambda pair: (-sum(item["bytes"] for item in pair[1]), pair[0])):
        categories.append({"category": name, "files": len(values), "bytes": sum(item["bytes"] for item in values)})
    return {
        "path": str(zip_path),
        "zipBytes": zip_path.stat().st_size,
        "zipSha256": sha256_file(zip_path),
        "entries": len(entries),
        "fileEntries": len(files),
        "unpackedBytes": sum(item["bytes"] for item in files),
        "directories": sum(1 for item in entries if item["isDirectory"]),
        "files": sorted(files, key=lambda item: item["path"]),
        "top30": sorted(files, key=lambda item: (-item["bytes"], item["path"]))[:30],
        "categories": categories,
        "duplicateGroups": duplicate_groups(files),
    }


def audit(root: Path, allowlist: dict, zip_path: Path | None) -> dict:
    result = {
        "schemaVersion": 1,
        "recordType": "production-size-audit",
        "sourceHead": current_head(root),
        "allowlist": {
            "pathCount": len(allowlist["assets"]),
            "sourceHead": allowlist.get("sourceHead"),
            "assets": allowlist["assets"],
            "contract": allowlist["contract"],
        },
        "source": source_inventory(root, allowlist),
    }
    if zip_path:
        result["archive"] = zip_inventory(zip_path)
        actual_paths = {item["path"] for item in result["archive"]["files"]}
        expected_paths = {
            path.relative_to(root).as_posix()
            for path in runtime_files(root)
        } | set(allowlist["assets"]) | set(allowlist.get("staticFiles", []))
        name_violations = sorted(
            path for path in actual_paths
            if not re.fullmatch(r"[\x21-\x7e]+", path) or "\\" in path
        )
        with zipfile.ZipFile(zip_path) as archive:
            integrity_error = archive.testzip()
        result["archive"]["structural"] = {
            "integrity": "PASS" if integrity_error is None else "FAIL",
            "integrityError": integrity_error,
            "containsIndexHtml": "index.html" in actual_paths,
            "containsLiteraryHtml": "literary.html" in actual_paths,
            "expectedPathCount": len(expected_paths),
            "missingExpectedPaths": sorted(expected_paths - actual_paths),
            "unexpectedPaths": sorted(actual_paths - expected_paths),
            "nameViolations": name_violations,
        }
        result["verdict"] = "PASS_SIZE" if result["archive"]["unpackedBytes"] <= SIZE_LIMIT else "BLOCKED_SIZE"
    else:
        result["verdict"] = "ALLOWLIST_READY"
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--write-allowlist", type=Path)
    parser.add_argument("--allowlist", type=Path)
    parser.add_argument("--zip", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    allowlist = json.loads(args.allowlist.read_text(encoding="utf-8")) if args.allowlist else discover_allowlist(root)
    if args.write_allowlist:
        args.write_allowlist.parent.mkdir(parents=True, exist_ok=True)
        args.write_allowlist.write_text(json.dumps(allowlist, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    result = audit(root, allowlist, args.zip.resolve() if args.zip else None)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"verdict": result["verdict"], "allowlistAssets": result["allowlist"]["pathCount"], "unpackedBytes": result.get("archive", {}).get("unpackedBytes"), "top30": result.get("archive", {}).get("top30", [])}, ensure_ascii=False))
    if result["verdict"] == "BLOCKED_SIZE":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
