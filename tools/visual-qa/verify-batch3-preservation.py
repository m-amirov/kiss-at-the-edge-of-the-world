import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[2]
prior_path = root / 'artifacts/evidence/reframe-batch3-2026-10-08/evidence-after.json'
fresh_path = root / 'artifacts/evidence/reframe-batch4-2026-10-08/batch3-preservation/evidence-after.json'
prior = json.loads(prior_path.read_text(encoding='utf-8'))
fresh = json.loads(fresh_path.read_text(encoding='utf-8'))
required = {'S42-scene-start-A', 'S42-scene-start-B', 'S42-scene-start-C', 'S46-airport-bus'}
rows = []
failures = []
for target_id in sorted(required):
    old_target = next((item for item in prior['targets'] if item['id'] == target_id), None)
    new_target = next((item for item in fresh['targets'] if item['id'] == target_id), None)
    if not old_target or not new_target:
        failures.append(f'{target_id}:missing-target')
        continue
    for view in ('desktop', 'mobile'):
        old = next(item for item in old_target['captures'] if item['label'] == 'target' and item['view']['name'] == view)
        new = next(item for item in new_target['captures'] if item['label'] == 'target' and item['view']['name'] == view)
        a = Image.open(old['file']).convert('RGBA')
        b = Image.open(new['file']).convert('RGBA')
        changed = sum(1 for pixel in ImageChops.difference(a, b).getdata() if max(pixel) > 6)
        old_rb, new_rb = old['readback'], new['readback']
        mapping_stable = all(old_rb.get(key) == new_rb.get(key) for key in ('sceneId', 'cue', 'asset', 'desktopAsset', 'presentation', 'stageCount', 'stageMode', 'stageLayout'))
        health_ok = not (new_rb['overflow'] or new_rb['internalScroll'] or not new_rb['edgeToEdge'] or not new_rb['imagesReady']) and not (new['consoleErrors'] or new['failedRequests'] or new['notFound'])
        accepted = a.size == b.size and changed == 0 and mapping_stable and health_ok
        if not accepted:
            failures.append(f'{target_id}/{view}:pixel_or_mapping_regression')
        rows.append({'id': target_id, 'view': view, 'dimensions': list(a.size), 'changedPixels': changed, 'mappingStable': mapping_stable, 'healthOk': health_ok, 'accepted': accepted})
result = {'status': 'PASS' if not failures else 'FAIL', 'targets': sorted(required), 'comparisons': rows, 'failures': failures}
(fresh_path.parent / 'batch3-preservation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
if failures:
    raise SystemExit(1)
