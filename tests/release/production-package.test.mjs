import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const audit = path.join(root, 'tools/release/production-size-audit.py');
const builder = path.join(root, 'release-artifacts/build-rc-package.py');

test('production allowlist package stays below the Yandex unpacked-size budget', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'production-size-'));
  const manifest = path.join(directory, 'production-asset-allowlist.json');
  const output = path.join(directory, 'production.zip');
  execFileSync('python', [audit, '--root', root, '--write-allowlist', manifest], { encoding: 'utf8' });
  const result = JSON.parse(execFileSync('python', [builder, '--root', root, '--output', output, '--allowlist', manifest], { encoding: 'utf8' }));
  assert.ok(result.unpacked <= 95_000_000, `unpacked production archive is ${result.unpacked}`);
  assert.ok(result.transcodedWebp > 0, 'production package must transcode runtime WebP assets from preserved source images');
  assert.ok(result.files < 300, `allowlist package unexpectedly contains ${result.files} files`);
  const names = JSON.parse(execFileSync('python', ['-c', 'import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', output], { encoding: 'utf8' }));
  assert.ok(names.includes('index.html'));
  assert.ok(names.includes('literary.html'));
  assert.ok(names.every(name => /^[\x21-\x7e]+$/.test(name) && !name.includes('\\')), 'ZIP contains a non-ASCII/space/backslash path');
  assert.equal(names.some(name => /\.png$/i.test(name) && !/^(assets\/branding\/|assets\/cg\/s26-route-choice-courtyard-final(?:-portrait)?\.png$)/.test(name)), false, 'source PNG leaked into production ZIP');
});
