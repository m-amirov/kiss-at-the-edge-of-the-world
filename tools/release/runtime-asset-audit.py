import hashlib
import json
import os
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "assets" / "asset-manifest.json"
OUT = ROOT / "artifacts" / "evidence" / "runtime-asset-inventory.json"
VISUAL_OUT = ROOT / "artifacts" / "evidence" / "runtime-visual-duplicate-candidates.json"


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalized_hash(path):
    with Image.open(path) as image:
        image = image.convert("RGBA").resize((64, 64), Image.Resampling.LANCZOS)
        return hashlib.sha256(image.tobytes()).hexdigest()


def scene_mappings():
    source = (ROOT / "src" / "literary-visual-directions.js").read_text(encoding="utf-8")
    result = defaultdict(set)
    for match in re.finditer(r"\b(S\d{2}):\[(.*?)(?=\n\s*S\d{2}:|\n\};)", source, re.S):
        scene = match.group(1)
        body = match.group(2)
        for asset in re.findall(r"(?:art:)?'((?:cg/)?[^']+\.(?:png|webp))'", body):
            result[asset.removeprefix("cg/")].add(f"{scene}:cue")
        base = re.search(r"\b(S\d{2}):\[[^\]]*?'([^']+\.(?:png|webp))'", match.group(0), re.S)
        if base:
            result[base.group(2)].add(f"{scene}:base")
    return {key: sorted(value) for key, value in result.items()}


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = []
    seen = set()
    for section in ("assets", "previewAssets"):
        for item in manifest.get(section, []):
            if item.get("status") != "integrated" and not item.get("runtimePath"):
                continue
            for field, runtime_field in (("path", "runtimePath"), ("portraitAsset", "runtimePortraitAsset")):
                source_path = item.get(field)
                path = item.get(runtime_field, source_path)
                if not path or path in seen:
                    continue
                seen.add(path)
                file = ROOT / path
                if file.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                    with Image.open(file) as image:
                        dimensions = [image.width, image.height]
                        mode = image.mode
                        image_format = image.format
                    normalized = normalized_hash(file)
                else:
                    dimensions = None
                    mode = None
                    image_format = file.suffix.lower().lstrip(".") or "binary"
                    normalized = None
                family = item.get("family", "unknown")
                if family.startswith("character"):
                    group = "portraits"
                elif family == "background":
                    group = "backgrounds"
                elif family == "cg":
                    group = "cg"
                else:
                    group = family
                entries.append({
                    "path": path,
                    "sourcePath": source_path,
                    "id": item.get("id"),
                    "family": family,
                    "group": group,
                    "fileType": image_format,
                    "mode": mode,
                    "dimensions": dimensions,
                    "bytes": file.stat().st_size,
                    "sha256": sha256(file),
                    "normalized64Sha256": normalized,
                    "sceneMappings": scene_mappings().get(Path(path).name, []),
                    "manifestRuntime": item.get("runtime"),
                })
    entries.sort(key=lambda item: item["bytes"], reverse=True)
    groups = {}
    total = sum(item["bytes"] for item in entries)
    for group in sorted({item["group"] for item in entries}):
        rows = [item for item in entries if item["group"] == group]
        groups[group] = {"count": len(rows), "bytes": sum(item["bytes"] for item in rows)}
    byte_dupes = defaultdict(list)
    visual_dupes = defaultdict(list)
    for item in entries:
        byte_dupes[item["sha256"]].append(item["path"])
        if item["normalized64Sha256"]:
            visual_dupes[item["normalized64Sha256"]].append(item["path"])
    result = {
        "schemaVersion": 1,
        "head": os.popen("git rev-parse HEAD").read().strip(),
        "runtimeAssetCount": len(entries),
        "runtimeAssetBytes": total,
        "groups": groups,
        "top30": entries[:30],
        "assets": entries,
        "byteIdenticalDuplicateGroups": [v for v in byte_dupes.values() if len(v) > 1],
        "normalizedVisualDuplicateGroups": [v for v in visual_dupes.values() if len(v) > 1],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    VISUAL_OUT.write_text(json.dumps({
        "head": result["head"],
        "method": "exact SHA-256 of 64x64 RGBA Lanczos-normalized pixels; candidates require identical normalized pixels",
        "byteIdenticalDuplicateGroups": result["byteIdenticalDuplicateGroups"],
        "normalizedVisualDuplicateGroups": result["normalizedVisualDuplicateGroups"],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "head": result["head"],
        "runtimeAssetCount": len(entries),
        "runtimeAssetBytes": total,
        "groups": groups,
        "byteIdenticalDuplicateGroups": result["byteIdenticalDuplicateGroups"],
        "normalizedVisualDuplicateGroups": result["normalizedVisualDuplicateGroups"],
        "top30": [{"path": item["path"], "bytes": item["bytes"], "dimensions": item["dimensions"]} for item in entries[:30]],
        "report": str(OUT.relative_to(ROOT)),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
