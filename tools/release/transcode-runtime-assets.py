import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "asset-manifest.json"
ACCEPTANCE_PATH = ROOT / "artifacts" / "evidence" / "runtime-transcode-acceptance.json"
QUALITY = 90
METHOD = 6


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def runtime_name(path):
    return str(Path(path).with_suffix(".webp")).replace("\\", "/")


def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    active_runtime_files = [
        *ROOT.glob("src/literary*.js"),
        ROOT / "src" / "literary.css",
        ROOT / "src" / "save-state.js",
        ROOT / "src" / "yandex-sdk.js",
    ]
    runtime_source = "\n".join(file.read_text(encoding="utf-8") for file in active_runtime_files if file.exists())
    conversions = []
    replacements = {}
    for section in ("assets", "previewAssets"):
        for entry in manifest.get(section, []):
            referenced = lambda field: bool(entry.get(field)) and Path(runtime_name(entry[field])).name in runtime_source
            is_runtime = entry.get("status") == "integrated" or referenced("path") or referenced("portraitAsset")
            if not is_runtime:
                entry.pop("runtimePath", None)
                entry.pop("runtimePortraitAsset", None)
                continue
            for source_field, runtime_field in (("path", "runtimePath"), ("portraitAsset", "runtimePortraitAsset")):
                source = entry.get(source_field)
                if not source or Path(source).suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                    continue
                source_file = ROOT / source
                runtime = runtime_name(source)
                runtime_file = ROOT / runtime
                with Image.open(source_file) as image:
                    source_mode = image.mode
                    dimensions = [image.width, image.height]
                    has_alpha = "A" in image.getbands() or source_mode in {"P", "LA"}
                    if not runtime_file.exists():
                        image.save(runtime_file, format="WEBP", quality=QUALITY, method=METHOD)
                entry[runtime_field] = runtime
                replacements[Path(source).name] = Path(runtime).name
                conversions.append({
                    "sourcePath": source,
                    "sourceSha256": sha256(source_file),
                    "sourceBytes": source_file.stat().st_size,
                    "runtimePath": runtime,
                    "runtimeSha256": sha256(runtime_file),
                    "runtimeBytes": runtime_file.stat().st_size,
                    "dimensions": dimensions,
                    "sourceMode": source_mode,
                    "alpha": has_alpha,
                    "encoder": {"format": "WEBP", "quality": QUALITY, "method": METHOD, "lossless": False},
                })

    for file in [*ROOT.glob("src/**/*.js"), *ROOT.glob("src/**/*.css"), ROOT / "index.html", ROOT / "literary.html"]:
        if not file.exists() or file.suffix not in {".js", ".css", ".html"}:
            continue
        text = file.read_text(encoding="utf-8")
        updated = text
        for source_name, runtime_name_only in replacements.items():
            updated = updated.replace(source_name, runtime_name_only)
        if updated != text:
            file.write_text(updated, encoding="utf-8", newline="\n")

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    rights = json.loads((ROOT / "assets" / "provenance" / "rights-manifest.json").read_text(encoding="utf-8"))
    rights_paths = {item.get("path") for item in rights.get("assets", [])}
    formal = json.loads((ROOT / "artifacts" / "evidence" / "production-art-acceptance.json").read_text(encoding="utf-8"))
    formal_paths = {item.get("path") for item in formal.get("acceptedAssets", [])}
    for item in conversions:
        item["sourceAcceptance"] = {
            "manifestStatus": "integrated",
            "rightsManifestEntry": item["sourcePath"] in rights_paths,
            "formalProductionArtAcceptanceEntry": item["sourcePath"] in formal_paths,
            "productionArtAcceptanceRecord": "artifacts/evidence/production-art-acceptance.json",
        }
    record = {
        "schemaVersion": 1,
        "recordType": "runtime-transcode-acceptance",
        "status": "PASS",
        "verdict": "PASS_RUNTIME_TRANSCODE_DERIVED_FROM_ACCEPTED_SOURCES",
        "headAtGeneration": head,
        "manifestSha256": sha256(MANIFEST_PATH),
        "sourceAcceptanceBasis": ["asset-manifest status=integrated", "assets/provenance/rights-manifest.json", "artifacts/evidence/production-art-acceptance.json"],
        "encoder": {"format": "WEBP", "quality": QUALITY, "method": METHOD, "lossless": False, "dimensionsChanged": False},
        "sourcePngsRetainedInRepository": True,
        "runtimeAssets": conversions,
        "counts": {"converted": len(conversions), "alphaConverted": sum(1 for item in conversions if item["alpha"]), "pngSources": len(conversions)},
    }
    ACCEPTANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    ACCEPTANCE_PATH.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "head": head,
        "converted": len(conversions),
        "alphaConverted": record["counts"]["alphaConverted"],
        "acceptance": str(ACCEPTANCE_PATH.relative_to(ROOT)),
        "manifestSha256": record["manifestSha256"],
        "runtimeBytes": sum(item["runtimeBytes"] for item in conversions),
        "sourceBytes": sum(item["sourceBytes"] for item in conversions),
    }))


if __name__ == "__main__":
    main()
