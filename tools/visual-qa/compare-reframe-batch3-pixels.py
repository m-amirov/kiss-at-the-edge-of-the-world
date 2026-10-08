import json
import os
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parents[2]
evidence_dir = Path(os.environ.get('REFRAME_BATCH3_OUTPUT', root / 'artifacts/evidence/reframe-batch3-2026-10-08'))
before = json.loads((evidence_dir / 'evidence-before.json').read_text(encoding='utf-8'))
after = json.loads((evidence_dir / 'evidence-after.json').read_text(encoding='utf-8'))
comparisons = []
mobile_only = {'S46-airport-bus', 'S42-scene-start-A', 'S42-scene-start-B', 'S42-scene-start-C'}
for target in after['targets']:
    before_target = next(item for item in before['targets'] if item['id'] == target['id'])
    for view in ('desktop', 'mobile'):
        old = next(item for item in before_target['captures'] if item['label'] == 'target' and item['view']['name'] == view)
        new = next(item for item in target['captures'] if item['label'] == 'target' and item['view']['name'] == view)
        a = Image.open(old['file']).convert('RGBA')
        b = Image.open(new['file']).convert('RGBA')
        if a.size != b.size:
            raise SystemExit(f'dimension mismatch: {target["id"]}/{view}')
        diff = ImageChops.difference(a, b)
        changed = sum(1 for pixel in diff.getdata() if max(pixel) > 6)
        stat = ImageStat.Stat(diff)
        total = a.width * a.height
        change_expected = not (target['id'] in mobile_only and view == 'desktop')
        comparisons.append({'id': target['id'], 'view': view, 'dimensions': list(a.size), 'beforeSha256': old['sha256'], 'afterSha256': new['sha256'], 'changedPixels': changed, 'changedRatio': changed / total, 'meanRgbaDelta': [value / 255 for value in stat.mean], 'changeExpected': change_expected, 'accepted': changed > 0 or not change_expected})
result = {'status': 'PASS' if all(item['accepted'] for item in comparisons) else 'FAIL', 'comparisonCount': len(comparisons), 'comparisons': comparisons}
(evidence_dir / 'pixel-acceptance.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': result['status'], 'comparisonCount': len(comparisons), 'comparisons': [{'id': x['id'], 'view': x['view'], 'changedPixels': x['changedPixels'], 'changedRatio': round(x['changedRatio'], 4)} for x in comparisons]}, ensure_ascii=False, indent=2))
