import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const builder = path.join(root, 'release-artifacts', 'build-rc-package.py');

function packageEntries(output) {
  return JSON.parse(execFileSync('python', ['-c', "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); names=z.namelist(); text={n:z.read(n).decode('utf-8') for n in names if n.endswith(('.html','.js'))}; print(json.dumps({'names':names,'text':text}))", output], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
}

function packageProject() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-yandex-sdk-'));
  const output = path.join(directory, 'rc.zip');
  const result = spawnSync('python', [builder, '--root', root, '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return packageEntries(output);
}

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-packager-'));
  const write = (relative, value) => { const target = path.join(directory, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); };
  write('index.html', '<link rel="stylesheet" href="/src/app.css"><script src="/sdk.js"></script><script type="module" src="/src/app.js"></script>');
  write('literary.html', '<script type="module" src="./src/app.js"></script>');
  write('src/app.js', "import './dep.js'; const image='/assets/picture.webp';");
  write('src/dep.js', 'export const ready=true;');
  write('src/app.css', "@font-face{src:url('../assets/font.woff2')} .hero{background:url('/assets/picture.webp')}");
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
  for (const required of ['index.html', 'src/app.js', 'src/dep.js', 'src/app.css', 'assets/picture.webp', 'assets/font.woff2']) assert.ok(names.includes(required), required);
  assert.equal(names.includes('literary.html'), false);
  assert.equal(names.includes('sdk.js'), false, 'Yandex-hosted SDK must not be copied into the release archive');
  assert.equal(names.includes('src/legacy.js'), false); assert.equal(names.some(name => name.startsWith('tests/')), false);
});

test('final package has one executable Yandex SDK bootstrap before its game module', () => {
  const archive = packageProject();
  const entries = Object.fromEntries(Object.entries(archive.text).filter(([name]) => name.endsWith('.html')));
  assert.ok(entries['index.html'], 'release archive must have index.html at its root');
  assert.deepEqual(Object.keys(entries).sort(), ['index.html'], 'production archive must expose exactly one HTML entrypoint');
  const html = entries['index.html'];
  const sdk = html.indexOf('<script src="/sdk.js"></script>');
  const init = html.indexOf('window.__YANDEX_GAMES_INIT__ = YaGames.init();');
  const module = html.indexOf('<script type="module" src="./src/entry.js"></script>');
  assert.ok(sdk >= 0, 'production HTML must statically reference the official /sdk.js');
  assert.ok(init > sdk, 'executable SDK initialization must follow /sdk.js');
  assert.ok(module > init, 'game module must start only after the SDK bootstrap');
  assert.equal((html.match(/YaGames\.init\s*\(/g) ?? []).length, 1, 'HTML bootstrap must initialize the SDK exactly once');
  assert.equal(html.replace(/<!--[\s\S]*?-->/g, '').includes('YaGames.init()'), true, 'SDK init must be executable HTML, not a comment');
  assert.doesNotMatch(Object.values(archive.text).join('\n'), /sdk\.games\.s3\.yandex\.net|yandex\.net\/sdk\.js/i, 'release archive must not use an obsolete or own-domain SDK URL');
  const productionJs = Object.entries(archive.text).filter(([name]) => name.endsWith('.js')).map(([, text]) => text).join('\n');
  assert.equal((productionJs.match(/YaGames\.init\s*\(/g) ?? []).length, 0, 'production module graph must reuse the HTML SDK init promise');
  assert.equal(archive.names.includes('sdk.js'), false, 'release archive must not package an SDK or a local SDK mock');
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
