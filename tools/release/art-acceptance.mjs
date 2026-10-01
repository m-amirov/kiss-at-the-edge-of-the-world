import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DEFAULT_RECORD = 'artifacts/evidence/production-art-acceptance.json';
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const absolute = (root, value) => path.resolve(root, value);

function block(code, reason) {
  return { status: 'BLOCKED', code, reason };
}

export function verifyArtAcceptance({ root, recordPath = DEFAULT_RECORD, recordOverride } = {}) {
  const projectRoot = path.resolve(root ?? process.cwd());
  const recordFile = absolute(projectRoot, recordPath);
  if (!recordOverride && !fs.existsSync(recordFile)) return block('ART_ACCEPTANCE_RECORD_MISSING', `Acceptance record missing: ${recordPath}`);

  let record;
  try { record = recordOverride ?? JSON.parse(fs.readFileSync(recordFile, 'utf8')); }
  catch (error) { return block('ART_ACCEPTANCE_RECORD_INVALID', `Acceptance record is not valid JSON: ${error.message}`); }
  if (record.schemaVersion !== 1 || record.recordType !== 'production-art-acceptance') {
    return block('ART_ACCEPTANCE_RECORD_INVALID', 'Unsupported acceptance record schema or record type.');
  }
  if (record.status !== 'PASS' || record.verdict !== 'PASS_PRODUCTION_ART_COMPLETE') {
    return block('ART_ACCEPTANCE_PROVENANCE_INVALID', 'Acceptance record is not a formal PASS_PRODUCTION_ART_COMPLETE record.');
  }
  if (record.verifier?.type !== 'automated-current-worktree-hash-verifier' || !record.verifier?.source) {
    return block('ART_ACCEPTANCE_PROVENANCE_INVALID', 'Acceptance record lacks automated verifier provenance.');
  }

  const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  if (absolute(projectRoot, record.repository?.path ?? '') !== projectRoot) {
    return block('ART_ACCEPTANCE_REPOSITORY_MISMATCH', 'Acceptance record belongs to another repository path.');
  }
  if (record.currentHead !== currentHead || record.repository?.head !== currentHead) {
    return block('ART_ACCEPTANCE_HEAD_MISMATCH', `Acceptance record HEAD does not match current HEAD ${currentHead}.`);
  }
  if (record.acceptedSceneCoverage?.expected !== 66 || record.acceptedSceneCoverage?.covered !== 66 || record.acceptedSceneCoverage?.remaining !== 0) {
    return block('ART_ACCEPTANCE_COVERAGE_INVALID', 'Acceptance record does not prove 66/66 scene coverage.');
  }
  if (record.placeholders !== 0 || record.brokenPaths !== 0 || record.webHigh?.result !== 'PASS') {
    return block('ART_ACCEPTANCE_GATE_INVALID', 'Formal acceptance record has non-zero placeholders/broken paths or lacks Web High PASS.');
  }

  const manifestFile = absolute(projectRoot, 'assets/asset-manifest.json');
  if (!fs.existsSync(manifestFile)) return block('ART_ACCEPTANCE_MANIFEST_MISSING', 'Current asset manifest is missing.');
  if (record.manifestSha256 !== sha256(manifestFile)) return block('ART_ACCEPTANCE_MANIFEST_HASH_MISMATCH', 'Current asset manifest hash differs from the accepted record.');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const runtimeMapping = fs.existsSync(absolute(projectRoot, 'src/literary-visual-directions.js'))
    ? fs.readFileSync(absolute(projectRoot, 'src/literary-visual-directions.js'), 'utf8') : '';
  let transcode = null;
  const transcodeFile = absolute(projectRoot, 'artifacts/evidence/runtime-transcode-acceptance.json');
  if (fs.existsSync(transcodeFile)) {
    try { transcode = JSON.parse(fs.readFileSync(transcodeFile, 'utf8')); } catch { transcode = null; }
  }
  for (const asset of record.acceptedAssets ?? []) {
    const file = absolute(projectRoot, asset.path);
    if (!fs.existsSync(file)) return block('ART_ACCEPTANCE_ASSET_HASH_MISMATCH', `Accepted asset is missing: ${asset.path}`);
    if (sha256(file) !== asset.sha256) return block('ART_ACCEPTANCE_ASSET_HASH_MISMATCH', `Accepted asset hash differs: ${asset.path}`);
    if (record.compatibility?.manifestMappings === 'PASS' && !manifest.assets?.some(entry => entry.path === asset.path)) {
      return block('ART_ACCEPTANCE_MAPPING_MISMATCH', `Accepted asset is absent from the current manifest: ${asset.path}`);
    }
    if (record.compatibility?.manifestMappings === 'PASS' && !runtimeMapping.includes(path.basename(asset.path))) {
      const derived = transcode?.runtimeAssets?.find(item => item.sourcePath === asset.path);
      if (!derived || transcode.status !== 'PASS' || !fs.existsSync(absolute(projectRoot, derived.runtimePath)) || !runtimeMapping.includes(path.basename(derived.runtimePath))) {
        return block('ART_ACCEPTANCE_MAPPING_MISMATCH', `Accepted asset is absent from the current runtime mapping: ${asset.path}`);
      }
    }
  }
  return { status: 'PASS', code: null, reason: 'Current worktree matches persisted production-art acceptance.', recordPath };
}

export function persistVerifiedArtAcceptance({ root, record, recordPath = DEFAULT_RECORD } = {}) {
  const result = verifyArtAcceptance({ root, recordPath, recordOverride: record });
  if (result.status !== 'PASS') throw new Error(`${result.code}: ${result.reason}`);
  const file = absolute(path.resolve(root ?? process.cwd()), recordPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return result;
}
