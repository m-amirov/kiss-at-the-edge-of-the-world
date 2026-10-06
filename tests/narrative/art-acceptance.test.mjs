import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyArtAcceptance, repositoryIdentity } from '../../tools/release/art-acceptance.mjs';

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
  const identity = repositoryIdentity(root);
  const record = {
    schemaVersion: 2, recordType: 'production-art-acceptance', status: 'PASS', verdict: 'PASS_PRODUCTION_ART_COMPLETE',
    repository: { ...identity, head }, currentHead: head, starterKitVersion: '0.5.9',
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
test('same repository secondary worktree has the same identity despite a different absolute path', () => {
  const { root, record } = fixture();
  execFileSync('git', ['add', '.'], { cwd: root }); execFileSync('git', ['commit', '-qm', 'record'], { cwd: root });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); record.currentHead = head; record.repository.head = head;
  const secondary = fs.mkdtempSync(path.join(os.tmpdir(), 'art-acceptance-worktree-')); fs.rmSync(secondary, { recursive: true });
  execFileSync('git', ['worktree', 'add', '--detach', secondary, 'HEAD'], { cwd: root });
  try { assert.notEqual(path.resolve(root), path.resolve(secondary)); assert.equal(repositoryIdentity(root).id, repositoryIdentity(secondary).id); assert.equal(verifyArtAcceptance({ root: secondary, recordOverride: record }).status, 'PASS'); }
  finally { execFileSync('git', ['worktree', 'remove', '--force', secondary], { cwd: root }); }
});
test('different Git repository with the same folder name is rejected', () => {
  const { record } = fixture(); const other = fixture(); assert.equal(verifyArtAcceptance({ root: other.root, recordOverride: record }).code, 'ART_ACCEPTANCE_REPOSITORY_MISMATCH');
});
for (const [name, mutate, expected] of [
  ['tampered repository id', record => { record.repository.id = 'bad'; }, 'ART_ACCEPTANCE_REPOSITORY_MISMATCH'],
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
