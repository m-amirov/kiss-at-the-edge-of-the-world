import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const builder = path.join(root, 'release-artifacts', 'build-rc-package.py');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'asset-manifest.json'), 'utf8'));
const packagePath = path.join(root, 'release-artifacts', 'kiss-at-the-edge-of-the-world-rc-release-kiss-rc-2026-09-30.zip');

execFileSync('python', [builder], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
const check = execFileSync('python', ['-c', `
import json, sys, zipfile
manifest=json.load(open(sys.argv[1], encoding='utf-8'))
names=set(zipfile.ZipFile(sys.argv[2]).namelist())
required=[]
for section in ('assets','previewAssets'):
  for entry in manifest.get(section, []):
    if entry.get('status') == 'integrated' or entry.get('runtimePath'):
      required.extend(x for x in (entry.get('runtimePath', entry.get('path')), entry.get('runtimePortraitAsset', entry.get('portraitAsset'))) if x)
missing=sorted(set(required)-names)
print(json.dumps({'required': len(set(required)), 'missing': missing}))
if missing: raise SystemExit(1)
`, path.join(root, 'assets', 'asset-manifest.json'), packagePath], { encoding: 'utf8' });
const result = JSON.parse(check.trim());
assert.equal(result.missing.length, 0);
assert.ok(result.required >= 142);
console.log(JSON.stringify({ status: 'PASS', required: result.required, missing: result.missing }));
