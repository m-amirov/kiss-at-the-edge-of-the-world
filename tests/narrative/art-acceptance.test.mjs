import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { productSnapshot, repositoryIdentity, verifyArtAcceptance } from '../../tools/release/art-acceptance.mjs';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (root, file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`); };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-acceptance-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/provenance'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/a.png'), 'fixture-png');
  fs.writeFileSync(path.join(root, 'assets/a.webp'), 'fixture-webp');
  writeJson(root, 'assets/asset-manifest.json', { schemaVersion: 1, assets: [{ id: 'a', path: 'assets/a.png', runtimePath: 'assets/a.webp' }] });
  writeJson(root, 'assets/provenance/rights-manifest.json', { assets: [{ path: 'assets/a.png' }] });
  fs.writeFileSync(path.join(root, 'src/literary-visual-directions.js'), 'a.png a.webp');
  fs.mkdirSync(path.join(root, 'artifacts/evidence'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'fixture'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const identity = repositoryIdentity(root);
  const matrix = { schemaVersion: 1, role: 'matrix', status: 'PASS', sourceHead, scope: { expectedScenes: 66, coveredScenes: 66, captures: 198 }, failures: [] };
  const reviews = ['ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web'].map(role => ({ role, status: 'PASS', sourceHead, actualPixelsReceived: true, taskId: `${role}-task`, reviewTraceId: `${role}-trace` }));
  writeJson(root, 'artifacts/evidence/matrix.json', matrix);
  for (const review of reviews) writeJson(root, `artifacts/evidence/${review.role}.json`, review);
  const record = {
    schemaVersion: 3, recordType: 'production-art-acceptance', status: 'PASS', verdict: 'PASS_PRODUCTION_ART_66_66', sourceProductHead: sourceHead,
    repository: { ...identity, sourceProductHead: sourceHead }, sourceProductSnapshot: productSnapshot(root),
    acceptedSceneCoverage: { expected: 66, covered: 66, remaining: 0 }, placeholders: 0, brokenPaths: 0,
    manifestSha256: hash(path.join(root, 'assets/asset-manifest.json')), rightsManifestSha256: hash(path.join(root, 'assets/provenance/rights-manifest.json')),
    acceptedAssets: [{ path: 'assets/a.png', sha256: hash(path.join(root, 'assets/a.png')) }], runtimeAssets: [{ path: 'assets/a.webp', sha256: hash(path.join(root, 'assets/a.webp')) }],
    webHigh: { result: 'PASS', reviews: reviews.map(review => ({ path: `artifacts/evidence/${review.role}.json`, sha256: hash(path.join(root, `artifacts/evidence/${review.role}.json`)), role: review.role, taskId: review.taskId, reviewTraceId: review.reviewTraceId, actualPixelsReceived: true })) },
    evidence: { matrix: { path: 'artifacts/evidence/matrix.json', sha256: hash(path.join(root, 'artifacts/evidence/matrix.json')), sourceHead } },
    compatibility: { manifestMappings: 'PASS' }, verifier: { type: 'source-bound-production-art-verifier', source: 'fixture' },
  };
  writeJson(root, 'artifacts/evidence/production-art-acceptance.json', record);
  return { root, record };
}
function verify(root) { return verifyArtAcceptance({ root }); }

test('valid source-bound acceptance passes after acceptance record commit', () => {
  const { root } = fixture();
  fs.writeFileSync(path.join(root, 'acceptance-note.txt'), 'record commit must not change product binding');
  execFileSync('git', ['add', 'artifacts/evidence/production-art-acceptance.json', 'acceptance-note.txt'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'acceptance record'], { cwd: root });
  assert.equal(verify(root).status, 'PASS');
});
test('missing record blocks', () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-acceptance-')); assert.equal(verifyArtAcceptance({ root }).code, 'ART_ACCEPTANCE_RECORD_MISSING'); });
for (const [name, mutate, expected] of [
  ['tampered repository id', record => { record.repository.id = 'bad'; }, 'ART_ACCEPTANCE_REPOSITORY_MISMATCH'],
  ['stale source head', record => { record.sourceProductHead = '0000000000000000000000000000000000000000'; }, 'ART_ACCEPTANCE_SOURCE_HEAD_NOT_ANCESTOR'],
  ['manifest hash mismatch', record => { record.manifestSha256 = 'bad'; }, 'ART_ACCEPTANCE_MANIFEST_HASH_MISMATCH'],
  ['asset hash mismatch', record => { record.acceptedAssets[0].sha256 = 'bad'; }, 'ART_ACCEPTANCE_ASSET_HASH_MISMATCH'],
  ['missing asset', record => { record.acceptedAssets[0].path = 'assets/missing.webp'; record.acceptedAssets[0].sha256 = '0'.repeat(64); }, 'ART_ACCEPTANCE_ASSET_HASH_MISMATCH'],
  ['stale product source', record => { fs.writeFileSync(path.join(record.__root, 'assets/a.png'), 'changed'); }, 'ART_ACCEPTANCE_SOURCE_SNAPSHOT_MISMATCH'],
  ['incomplete coverage', record => { record.acceptedSceneCoverage.covered = 65; }, 'ART_ACCEPTANCE_COVERAGE_INVALID'],
  ['missing Web response', record => { record.webHigh.reviews = record.webHigh.reviews.slice(0, 2); }, 'ART_ACCEPTANCE_WEB_REVIEW_MISSING'],
  ['missing actual pixel receipt', record => { record.webHigh.reviews[2].actualPixelsReceived = false; }, 'ART_ACCEPTANCE_PIXEL_RECEIPT_MISSING'],
]) {
  test(`${name} blocks`, () => {
    const { root, record } = fixture(); record.__root = root;
    mutate(record);
    delete record.__root;
    assert.equal(verifyArtAcceptance({ root, recordOverride: record }).code, expected);
  });
}
