import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function verifyRuntimeTranscode({ root = process.cwd(), recordPath = 'artifacts/evidence/runtime-transcode-acceptance.json' } = {}) {
  const projectRoot = path.resolve(root);
  const recordFile = path.resolve(projectRoot, recordPath);
  if (!fs.existsSync(recordFile)) return { status: 'BLOCKED', code: 'RUNTIME_TRANSCODE_RECORD_MISSING' };
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const manifestFile = path.join(projectRoot, 'assets', 'asset-manifest.json');
  if (record.status !== 'PASS' || record.verdict !== 'PASS_RUNTIME_TRANSCODE_DERIVED_FROM_ACCEPTED_SOURCES') return { status: 'BLOCKED', code: 'RUNTIME_TRANSCODE_VERDICT_INVALID' };
  if (record.headAtGeneration !== head) return { status: 'BLOCKED', code: 'RUNTIME_TRANSCODE_HEAD_MISMATCH', head, recorded: record.headAtGeneration };
  if (record.manifestSha256 !== sha256(manifestFile)) return { status: 'BLOCKED', code: 'RUNTIME_TRANSCODE_MANIFEST_HASH_MISMATCH' };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const entries = [...(manifest.assets ?? []), ...(manifest.previewAssets ?? [])];
  const manifestBySource = new Map();
  for (const entry of entries.filter(entry => entry.status === 'integrated' || entry.runtimePath)) {
    if (entry.path) manifestBySource.set(entry.path, { entry, runtimePath: entry.runtimePath ?? entry.path });
    if (entry.portraitAsset) manifestBySource.set(entry.portraitAsset, { entry, runtimePath: entry.runtimePortraitAsset ?? entry.portraitAsset });
  }
  const runtimeMapping = fs.readdirSync(path.join(projectRoot, 'src')).filter(name => /\.(js|css)$/.test(name)).map(name => fs.readFileSync(path.join(projectRoot, 'src', name), 'utf8')).join('\n');
  const failures = [];
  for (const item of record.runtimeAssets ?? []) {
    const source = path.resolve(projectRoot, item.sourcePath);
    const runtime = path.resolve(projectRoot, item.runtimePath);
    const manifestEntry = manifestBySource.get(item.sourcePath);
    if (!manifestEntry || manifestEntry.runtimePath !== item.runtimePath) failures.push(`${item.sourcePath}: manifest runtime path mismatch`);
    if (!fs.existsSync(source) || sha256(source) !== item.sourceSha256) failures.push(`${item.sourcePath}: source hash mismatch`);
    if (!fs.existsSync(runtime) || sha256(runtime) !== item.runtimeSha256) failures.push(`${item.runtimePath}: runtime hash mismatch`);
    if (path.extname(item.runtimePath).toLowerCase() !== '.webp') failures.push(`${item.runtimePath}: runtime is not WebP`);
    if (!runtimeMapping.includes(path.basename(item.runtimePath))) failures.push(`${item.runtimePath}: runtime mapping missing`);
  }
  return failures.length ? { status: 'BLOCKED', code: 'RUNTIME_TRANSCODE_EVIDENCE_MISMATCH', failures } : {
    status: 'PASS',
    code: null,
    converted: record.runtimeAssets.length,
    runtimeBytes: record.runtimeAssets.reduce((sum, item) => sum + item.runtimeBytes, 0),
    sourceBytes: record.runtimeAssets.reduce((sum, item) => sum + item.sourceBytes, 0),
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  console.log(JSON.stringify(verifyRuntimeTranscode()));
}
