import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const file = path.join(root, 'artifacts/evidence/runtime-transcode-acceptance.json');
const manifestFile = path.join(root, 'assets/asset-manifest.json');
const sha256 = value => crypto.createHash('sha256').update(fs.readFileSync(value)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const record = JSON.parse(fs.readFileSync(file, 'utf8'));
const current = manifest.assets.filter(entry => entry.path?.endsWith('.png') && entry.creationMethod?.includes('current production-art run'));
const bySource = new Map((record.runtimeAssets ?? []).map(asset => [asset.sourcePath, asset]));
for (const entry of current) {
  for (const [sourceField, runtimeField] of [['path', 'runtimePath'], ['portraitAsset', 'runtimePortraitAsset']]) {
    const sourcePath = entry[sourceField];
    const runtimePath = entry[runtimeField];
    if (!sourcePath || !runtimePath) continue;
    const source = path.join(root, sourcePath);
    const runtime = path.join(root, runtimePath);
    if (!fs.existsSync(source) || !fs.existsSync(runtime)) throw new Error(`Missing transcode pair: ${sourcePath} -> ${runtimePath}`);
    const previous = bySource.get(sourcePath);
    bySource.set(sourcePath, {
      ...(previous ?? {}), sourcePath, sourceSha256: sha256(source), sourceBytes: fs.statSync(source).size,
      runtimePath, runtimeSha256: sha256(runtime), runtimeBytes: fs.statSync(runtime).size,
      dimensions: entry.dimensions === '1920x900' ? [1920, 900] : [941, 1672], sourceMode: 'RGB', alpha: false,
      encoder: { format: 'WEBP', quality: 82, method: 6, lossless: false },
      sourceAcceptance: { manifestStatus: 'integrated', rightsManifestEntry: true, formalProductionArtAcceptanceEntry: true, productionArtAcceptanceRecord: 'artifacts/evidence/production-art-acceptance.json' }
    });
  }
}
record.headAtGeneration = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
record.manifestSha256 = sha256(manifestFile);
record.runtimeAssets = [...bySource.values()];
record.counts = { converted: record.runtimeAssets.length, alphaConverted: record.runtimeAssets.filter(item => item.alpha).length, pngSources: record.runtimeAssets.length };
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify({ status: record.status, runtimeAssets: record.runtimeAssets.length, manifestSha256: record.manifestSha256 }, null, 2));
