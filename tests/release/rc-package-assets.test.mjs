import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const builder = path.join(root, 'release-artifacts', 'build-rc-package.py');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-packager-'));
  const write = (relative, value) => { const target = path.join(directory, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); };
  write('index.html', '<script src="/sdk.js"></script><link rel="stylesheet" href="./src/app.css"><script type="module" src="./src/app.js"></script>');
  write('literary.html', '<script src="/sdk.js"></script><script type="module" src="./src/app.js"></script>');
  write('src/app.js', "import './dep.js'; const image='../assets/picture.webp';");
  write('src/dep.js', 'export const ready=true;');
  write('src/app.css', "@font-face{src:url('../assets/font.woff2')} .hero{background:url('../assets/picture.webp')}");
  write('assets/picture.webp', Buffer.from([0x52, 0x49, 0x46, 0x46, 0xff, 0xfe, 0x00]));
  write('assets/font.woff2', Buffer.from([0x77, 0x4f, 0x46, 0x32, 0xff, 0xfe]));
  write('assets/branding/kiss-at-the-edge-cover.png', Buffer.from([1]));
  write('assets/branding/kiss-at-the-edge-icon.png', Buffer.from([2]));
  write('assets/asset-manifest.json', JSON.stringify({ assets: [{ status: 'integrated', runtimePath: 'assets/picture.webp' }] }));
  write('src/legacy.js', 'throw new Error("legacy")');
  write('tests/qa.js', 'throw new Error("qa")');
  return { directory, write, output: path.join(directory, 'rc.zip') };
}
const run = ({ directory, output }) => spawnSync('python', [builder, '--root', directory, '--output', output], { encoding: 'utf8' });

test('valid dependency closure includes runtime dependencies and excludes legacy/QA/dev source', () => {
  const f = fixture(); const result = run(f); assert.equal(result.status, 0, result.stderr);
  const names = JSON.parse(execFileSync('python', ['-c', 'import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', f.output], { encoding: 'utf8' }));
  for (const required of ['index.html', 'literary.html', 'src/app.js', 'src/dep.js', 'src/app.css', 'assets/picture.webp', 'assets/font.woff2']) assert.ok(names.includes(required), required);
  assert.equal(names.includes('sdk.js'), false, 'official SDK must remain external');
  assert.equal(names.includes('src/legacy.js'), false); assert.equal(names.some(name => name.startsWith('tests/')), false);
});

test('invalid UTF-8 text blocks packaging', () => {
  const f = fixture(); f.write('src/dep.js', Buffer.from([0xff, 0xfe])); const result = run(f);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /invalid UTF-8/);
});

test('unresolved local import blocks packaging', () => {
  const f = fixture(); f.write('src/app.js', "import './absent.js';"); const result = run(f);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /unresolved local dependency/);
});

test('missing referenced asset blocks packaging', () => {
  const f = fixture(); fs.unlinkSync(path.join(f.directory, 'assets', 'picture.webp')); const result = run(f);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /unresolved local dependency|missing dependency/);
});

test('binary WebP and font dependencies are never decoded as text', () => {
  const f = fixture(); const result = run(f); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'assets/picture.webp')), Buffer.from([0x52, 0x49, 0x46, 0x46, 0xff, 0xfe, 0x00]));
});

test('dependency escaping the project root blocks packaging', () => {
  const f = fixture(); f.write('src/app.js', "import '../../outside.js';"); const result = run(f);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /escapes project root/);
});

test('game-owned archive references must be relative while platform SDK stays absolute', () => {
  const f = fixture(); f.write('index.html', '<script src="/sdk.js"></script><script type="module" src="/src/app.js"></script>');
  const result = run(f);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /game-owned archive reference must be relative/);
});

test('production ZIP entrypoints contain only existing archive-relative game-owned references', () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-production-')), 'release.zip');
  const result = run({ directory: root, output });
  assert.equal(result.status, 0, result.stderr);
  const names = new Set(JSON.parse(execFileSync('python', ['-c', 'import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', output], { encoding: 'utf8' })));
  const readZipText = (name) => execFileSync('python', ['-c', 'import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', output, name], { encoding: 'utf8' });
  const refs = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const entry of ['index.html', 'literary.html']) {
    const html = readZipText(entry);
    for (const match of html.matchAll(refs)) {
      const raw = match[1].split('#', 1)[0].split('?', 1)[0];
      if (!raw || ['data:', 'http:', 'https:', '//', '#'].some(prefix => raw.startsWith(prefix))) continue;
      if (raw === '/sdk.js') continue;
      assert.equal(raw.startsWith('/'), false, `${entry} has host-root game reference ${raw}`);
      const archivePath = path.posix.normalize(path.posix.join(path.posix.dirname(entry), raw.replaceAll('\\', '/')));
      assert.equal(names.has(archivePath), true, `${entry} reference ${raw} -> missing ZIP entry ${archivePath}`);
    }
  }
  for (const file of ['src/literary-player.js', 'src/audio-director.js']) {
    const text = readZipText(file);
    assert.match(text, /runtimeAssetUrl/, `${file} must use the central runtime asset resolver`);
  }
  for (const file of [...names].filter(name => name.startsWith('src/') && name.endsWith('.js') && name !== 'src/runtime-assets.js')) {
    const text = readZipText(file);
    assert.doesNotMatch(text, /["'`]\.\/assets\//, `${file} must not resolve assets below /src/`);
    assert.doesNotMatch(text, /["'`]\.\.\/assets\//, `${file} must not assume document-relative archive depth`);
    assert.doesNotMatch(text, /["'`]\/assets\//, `${file} must not use host-root assets`);
  }
});
