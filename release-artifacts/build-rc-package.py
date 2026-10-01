import hashlib
import json
import os
import subprocess
import zipfile

root = os.getcwd()
output = os.environ.get(
    "RC_ARCHIVE_PATH",
    os.path.join(root, "release-artifacts", "kiss-at-the-edge-of-the-world-rc-release-kiss-rc-2026-09-30.zip"),
)
files = subprocess.check_output(
    ["git", "ls-files", "--", "index.html", "literary.html", "src", "assets/fonts", "favicon.ico"],
    text=True,
).splitlines()
manifest = json.load(open(os.path.join(root, "assets", "asset-manifest.json"), encoding="utf-8"))
manifest_assets = [
    entry
    for section in ("assets", "previewAssets")
    for entry in manifest.get(section, [])
    if entry.get("status") == "integrated" or entry.get("runtimePath")
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
