import hashlib
import json
import os
import subprocess
import zipfile
import re

root = os.getcwd()
output = os.environ.get(
    "RC_ARCHIVE_PATH",
    os.path.join(root, "release-artifacts", "kiss-at-the-edge-of-the-world-rc-release-kiss-rc-2026-09-30.zip"),
)
entrypoints = ["src/entry.js"]
runtime_sources = {"index.html", "literary.html"}
runtime_sources.update(entrypoints)
while entrypoints:
    source = entrypoints.pop()
    text = open(os.path.join(root, source), encoding="utf-8").read()
    for specifier in re.findall(r"(?:import|export)\s*(?:[^'\"]*from\s*)?['\"](\./[^'\"]+|\.\./[^'\"]+)['\"]", text):
        target = os.path.normpath(os.path.join(os.path.dirname(source), specifier)).replace(os.sep, "/")
        if target.startswith("src/") and target.endswith(".js") and target not in runtime_sources:
            runtime_sources.add(target)
            entrypoints.append(target)
files = sorted(runtime_sources | {"assets/fonts/CormorantGaramond[wght].ttf", "assets/fonts/Manrope[wght].ttf", "assets/branding/kiss-at-the-edge-cover.png", "assets/branding/kiss-at-the-edge-icon.png", "favicon.ico"})
source_text = "\n".join(open(os.path.join(root, file), encoding="utf-8").read(errors="ignore") for file in runtime_sources)
manifest = json.load(open(os.path.join(root, "assets", "asset-manifest.json"), encoding="utf-8"))
manifest_assets = [
    entry
    for section in ("assets", "previewAssets")
    for entry in manifest.get(section, [])
    if (entry.get("status") == "integrated" or entry.get("runtimePath"))
    and any(os.path.basename(candidate or "") in source_text for candidate in (entry.get("runtimePath"), entry.get("runtimePortraitAsset"), entry.get("path"), entry.get("portraitAsset")))
]
files.extend(
    asset_path
    for entry in manifest_assets
    for asset_path in (
        entry.get("runtimePath", entry.get("path")),
        entry.get("runtimePortraitAsset", entry.get("portraitAsset")),
    )
    if asset_path
)
files = sorted({path for path in files if os.path.isfile(os.path.join(root, path))})
if "index.html" not in files:
    raise SystemExit("index.html is missing from the package")

missing = [
    asset_path
    for entry in manifest_assets
    for asset_path in (
        entry.get("runtimePath", entry.get("path")),
        entry.get("runtimePortraitAsset", entry.get("portraitAsset")),
    )
    if asset_path and asset_path not in files
]
if missing:
    raise SystemExit("integrated runtime assets missing from package input: " + ", ".join(missing))

unpacked = 0
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in files:
        data = open(os.path.join(root, path), "rb").read()
        unpacked += len(data)
        info = zipfile.ZipInfo(path, (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, data)

digest = hashlib.sha256(open(output, "rb").read()).hexdigest()
print(json.dumps({"files": len(files), "unpacked": unpacked, "zip": os.path.getsize(output), "sha256": digest}))
