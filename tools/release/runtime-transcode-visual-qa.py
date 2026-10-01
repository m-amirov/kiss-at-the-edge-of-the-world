import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[2]
RECORD = ROOT / "artifacts" / "evidence" / "runtime-transcode-acceptance.json"
OUT = ROOT / "artifacts" / "evidence" / "runtime-transcode-visual-qa.json"


def psnr(a, b):
    diff = ImageChops.difference(a, b)
    stat = ImageStat.Stat(diff)
    mse = sum(value * value for value in stat.mean) / len(stat.mean)
    return 99.0 if mse == 0 else 20 * math.log10(255 / math.sqrt(mse))


def composite(image):
    image = image.convert("RGBA")
    background = Image.new("RGBA", image.size, (8, 18, 26, 255))
    return Image.alpha_composite(background, image).convert("RGB")


def compare(source, runtime, size):
    left = ImageOps.fit(composite(source), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    right = ImageOps.fit(composite(runtime), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    return {"size": list(size), "psnr": round(psnr(left, right), 3), "meanAbsoluteError": round(sum(ImageStat.Stat(ImageChops.difference(left, right)).mean) / 3, 4)}


def main():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    results = []
    failures = []
    for item in record["runtimeAssets"]:
        source_file = ROOT / item["sourcePath"]
        runtime_file = ROOT / item["runtimePath"]
        with Image.open(source_file) as source, Image.open(runtime_file) as runtime:
            source_rgba = source.convert("RGBA")
            runtime_rgba = runtime.convert("RGBA")
            row = {
                "sourcePath": item["sourcePath"],
                "runtimePath": item["runtimePath"],
                "dimensions": [runtime.width, runtime.height],
                "dimensionsPreserved": source.size == runtime.size,
                "native": compare(source_rgba, runtime_rgba, source.size),
                "desktop": compare(source_rgba, runtime_rgba, (1920, 900)),
                "mobile": compare(source_rgba, runtime_rgba, (390, 844)),
            }
            if "A" in source_rgba.getbands():
                alpha_diff = ImageChops.difference(source_rgba.getchannel("A"), runtime_rgba.getchannel("A"))
                row["alpha"] = {
                    "maxDelta": max(alpha_diff.getextrema()),
                    "meanAbsoluteError": round(ImageStat.Stat(alpha_diff).mean[0], 4),
                }
            results.append(row)
            if not row["dimensionsPreserved"] or min(row["native"]["psnr"], row["desktop"]["psnr"], row["mobile"]["psnr"]) < 38:
                failures.append(row["runtimePath"])
            if row.get("alpha", {}).get("maxDelta", 0) > 16:
                failures.append(f"{row['runtimePath']}: alpha")
    output = {
        "schemaVersion": 1,
        "status": "PASS" if not failures else "FAIL",
        "method": "RGBA composite on dark gameplay background; PSNR at native, 1920x900 and 390x844 fit sizes; alpha delta checked separately",
        "thresholds": {"minimumPSNR": 38, "maximumAlphaDelta": 16},
        "count": len(results),
        "failures": failures,
        "assets": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": output["status"], "count": len(results), "failures": failures, "report": str(OUT.relative_to(ROOT))}))


if __name__ == "__main__":
    main()
