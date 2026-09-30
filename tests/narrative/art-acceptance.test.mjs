import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyArtAcceptance } from '../../tools/release/art-acceptance.mjs';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-acceptance-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/asset-manifest.json'), '{"schemaVersion":1}');
  fs.writeFileSync(path.join(root, 'assets/a.png'), 'fixture-png');
  fs.mkdirSync(path.join(root, 'artifacts/evidence'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'fixture'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const record = {
    schemaVersion: 1, recordType: 'production-art-acceptance', status: 'PASS', verdict: 'PASS_PRODUCTION_ART_COMPLETE',
    repository: { path: root, head }, currentHead: head, starterKitVersion: '0.5.9',
    acceptedSceneCoverage: { expected: 66, covered: 66, remaining: 0 }, placeholders: 0, brokenPaths: 0,
    webHigh: { result: 'PASS' }, manifestSha256: hash(path.join(root, 'assets/asset-manifest.json')),
    acceptedAssets: [{ path: 'assets/a.png', sha256: hash(path.join(root, 'assets/a.png')) }],
    verifier: { type: 'automated-current-worktree-hash-verifier', source: 'test fixture' }
  };
  fs.writeFileSync(path.join(root, 'artifacts/evidence/production-art-acceptance.json'), JSON.stringify(record));
  return { root, record };
}
function verify(root) {
  const original = process.cwd(); process.chdir(root);
  try { return verifyArtAcceptance({ root }); } finally { process.chdir(original); }
}

test('valid persisted acceptance record passes', () => {
  const { root } = fixture(); assert.equal(verify(root).status, 'PASS');
});
test('missing record blocks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-acceptance-'));
  assert.equal(verifyArtAcceptance({ root }).code, 'ART_ACCEPTANCE_RECORD_MISSING');
});
for (const [name, mutate, expected] of [
  ['wrong repository', record => { record.repository.path = 'C:/other'; }, 'ART_ACCEPTANCE_REPOSITORY_MISMATCH'],
  ['wrong HEAD', record => { record.currentHead = 'other'; record.repository.head = 'other'; }, 'ART_ACCEPTANCE_HEAD_MISMATCH'],
  ['manifest hash mismatch', record => { record.manifestSha256 = 'bad'; }, 'ART_ACCEPTANCE_MANIFEST_HASH_MISMATCH'],
  ['asset hash mismatch', record => { record.acceptedAssets[0].sha256 = 'bad'; }, 'ART_ACCEPTANCE_ASSET_HASH_MISMATCH'],
  ['manual token', record => { delete record.verifier; }, 'ART_ACCEPTANCE_PROVENANCE_INVALID']
]) {
  test(`${name} blocks`, () => {
    const { root, record } = fixture(); mutate(record);
    fs.writeFileSync(path.join(root, 'artifacts/evidence/production-art-acceptance.json'), JSON.stringify(record));
    assert.equal(verify(root).code, expected);
  });
}
