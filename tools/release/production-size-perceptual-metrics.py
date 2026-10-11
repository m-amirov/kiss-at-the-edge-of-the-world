import argparse
import hashlib
import json
import math
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageChops, ImageStat, ImageOps


ROOT = Path(__file__).resolve().parents[2]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def psnr(left, right):
    diff = ImageChops.difference(left, right)
    stat = ImageStat.Stat(diff)
    mse = sum(value * value for value in stat.mean) / len(stat.mean)
    return 99.0 if mse == 0 else 20 * math.log10(255 / math.sqrt(mse))


def composite(image):
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (8, 18, 26, 255))
    return Image.alpha_composite(background, rgba).convert("RGB")


def compare(source, runtime, size):
    left = ImageOps.fit(composite(source), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    right = ImageOps.fit(composite(runtime), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    difference = ImageChops.difference(left, right)
    return {
        "size": list(size),
        "psnr": round(psnr(left, right), 3),
        "meanAbsoluteError": round(sum(ImageStat.Stat(difference).mean) / 3, 4),
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--allowlist", required=True)
    parser.add_argument("--zip", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    allowlist_path = ROOT / args.allowlist
    zip_path = ROOT / args.zip
    allowlist = json.loads(allowlist_path.read_text(encoding="utf-8"))
    results = []
    retained_images = []
    failures = []
    skipped = []

    with tempfile.TemporaryDirectory(prefix="production-metrics-") as temp_dir:
        extracted = Path(temp_dir)
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(extracted)
        for runtime_path_text in allowlist["assets"]:
            runtime_path = Path(runtime_path_text)
            if runtime_path.suffix.lower() != ".webp":
                if runtime_path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
                    source_file = ROOT / runtime_path
                    runtime_file = extracted / runtime_path
                    if source_file.exists() and runtime_file.exists():
                        source_bytes = source_file.read_bytes()
                        runtime_bytes = runtime_file.read_bytes()
                        retained_images.append({
                            "sourcePath": runtime_path.as_posix(),
                            "runtimePath": runtime_path.as_posix(),
                            "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
                            "runtimeSha256": hashlib.sha256(runtime_bytes).hexdigest(),
                            "sourceBytes": len(source_bytes),
                            "runtimeBytes": len(runtime_bytes),
                            "byteDelta": len(runtime_bytes) - len(source_bytes),
                            "changedBytes": source_bytes != runtime_bytes,
                            "format": runtime_path.suffix.lower().lstrip("."),
                        })
                skipped.append({"runtimePath": runtime_path_text, "reason": "not-webp-runtime-asset"})
                continue
            source_path = ROOT / runtime_path.with_suffix(".png")
            runtime_file = extracted / runtime_path
            if not source_path.exists():
                skipped.append({"runtimePath": runtime_path_text, "reason": "no-source-png-pair"})
                continue
            if not runtime_file.exists():
                failures.append(f"missing-runtime:{runtime_path_text}")
                continue
            with Image.open(source_path) as source, Image.open(runtime_file) as runtime:
                source_bytes = source_path.read_bytes()
                runtime_bytes = runtime_file.read_bytes()
                source_rgba = source.convert("RGBA")
                runtime_rgba = runtime.convert("RGBA")
                row = {
                    "sourcePath": runtime_path.with_suffix(".png").as_posix(),
                    "runtimePath": runtime_path.as_posix(),
                    "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
                    "runtimeSha256": hashlib.sha256(runtime_bytes).hexdigest(),
                    "sourceBytes": len(source_bytes),
                    "runtimeBytes": len(runtime_bytes),
                    "byteDelta": len(runtime_bytes) - len(source_bytes),
                    "changedBytes": source_bytes != runtime_bytes,
                    "sourceFormat": "png",
                    "runtimeFormat": "webp",
                    "dimensions": [runtime.width, runtime.height],
                    "dimensionsPreserved": source.size == runtime.size,
                    "native": compare(source_rgba, runtime_rgba, source.size),
                    "desktop": compare(source_rgba, runtime_rgba, (1920, 900)),
                    "mobile": compare(source_rgba, runtime_rgba, (390, 844)),
                }
                if "A" in source_rgba.getbands() or "A" in runtime_rgba.getbands():
                    alpha_source = source_rgba.getchannel("A")
                    alpha_runtime = runtime_rgba.getchannel("A")
                    alpha_diff = ImageChops.difference(alpha_source, alpha_runtime)
                    row["alpha"] = {
                        "maxDelta": max(alpha_diff.getextrema()),
                        "meanAbsoluteError": round(ImageStat.Stat(alpha_diff).mean[0], 4),
                    }
                results.append(row)
                if not row["dimensionsPreserved"]:
                    failures.append(f"dimensions:{runtime_path_text}")
                if min(row["native"]["psnr"], row["desktop"]["psnr"], row["mobile"]["psnr"]) < 38:
                    failures.append(f"psnr:{runtime_path_text}")
                if row.get("alpha", {}).get("maxDelta", 0) > 16:
                    failures.append(f"alpha:{runtime_path_text}")

    output = {
        "schemaVersion": 1,
        "recordType": "production-size-perceptual-metrics",
        "sourceHead": allowlist["sourceHead"],
        "zipPath": args.zip,
        "zipSha256": sha256(zip_path),
        "method": "RGBA composite on dark gameplay background; PSNR and MAE at native, 1920x900 and 390x844 fit sizes; alpha delta checked separately",
        "thresholds": {"minimumPSNR": 38, "maximumAlphaDelta": 16, "dimensionsChanged": False},
        "status": "PASS" if not failures else "FAIL",
        "pairedCount": len(results),
        "skippedCount": len(skipped),
        "retainedImages": retained_images,
        "imageByteSummary": {
            "changedCount": sum(item["changedBytes"] for item in results),
            "retainedCount": sum(item["changedBytes"] for item in retained_images if not item["changedBytes"]),
            "changedByteDelta": sum(item["byteDelta"] for item in results),
            "allProductionImageCount": len(results) + len(retained_images),
        },
        "failures": failures,
        "skipped": skipped,
        "assets": results,
    }
    output_path = ROOT / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": output["status"], "paired": len(results), "skipped": len(skipped), "failures": failures, "report": args.output}))


if __name__ == "__main__":
    main()
