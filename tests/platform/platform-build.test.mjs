import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertSafeOutputPath, buildPlatform } from '../../tools/platform/build.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-build-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'platform'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'scene.webp'), 'asset');
  fs.writeFileSync(path.join(root, 'src', 'entry.js'), 'entry');
  fs.writeFileSync(path.join(root, 'src', 'important.txt'), 'do-not-delete');
  fs.writeFileSync(path.join(root, 'src', 'vk-entry.js'), 'vk');
  fs.writeFileSync(path.join(root, 'src', 'platform', 'vk-games.js'), 'adapter');
  fs.writeFileSync(path.join(root, 'src', 'platform', 'vk-bridge-mock.js'), 'mock');
  fs.writeFileSync(path.join(root, 'index.html'), '<link rel="stylesheet" href="./src/literary.css"><script type="module" src="./src/entry.js"></script>');
  fs.writeFileSync(path.join(root, 'vk.html'), '<link rel="stylesheet" href="./src/literary.css"><script type="module" src="./src/vk-entry.js"></script>');
  fs.writeFileSync(path.join(root, 'src', 'literary.css'), 'body{}');
  return root;
}

test('unsafe output paths are rejected before rmSync can alter source files', () => {
  const root = fixture();
  const sentinel = path.join(root, 'src', 'important.txt');
  const unsafe = [root, ...['.git', 'src', 'assets', 'public', 'node_modules', 'config', 'tests', 'tools'].map(name => path.join(root, name)), path.join(root, 'src', '..', 'assets')];
  for (const output of unsafe) assert.throws(() => buildPlatform(root, 'yandex', output), /Unsafe output path/);
  const symlink = path.join(root, 'output-link');
  try {
    fs.symlinkSync(path.join(root, 'src'), symlink, 'junction');
    assert.throws(() => buildPlatform(root, 'yandex', symlink), /Unsafe output path: symlink/);
  } catch (error) {
    if (!/privilege|symbolic link|symlink/i.test(String(error?.message))) throw error;
  }
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'do-not-delete');
  assertSafeOutputPath(root, path.join(root, 'dist', 'yandex'), 'yandex');
  assert.throws(() => buildPlatform(root, 'yandex', path.join(root, 'dist')), /Unsafe output path/);
  assert.throws(() => buildPlatform(root, 'yandex', path.join(root, 'dist', 'vk')), /Unsafe output path/);
  assert.throws(() => buildPlatform(root, 'vk', path.join(root, 'dist', 'yandex')), /Unsafe output path/);
});

test('nonempty external output and its sentinel cannot be deleted by a platform build', () => {
  const root = fixture();
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'external-build-target-'));
  const sentinel = path.join(external, 'user-file.txt');
  fs.writeFileSync(sentinel, 'preserve external data');
  try {
    for (const candidate of [external, path.join(external, 'nested')]) {
      assert.throws(
        () => buildPlatform(root, 'yandex', candidate),
        /Unsafe output path: outside platform build directory/
      );
    }
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve external data');
    assert.equal(fs.existsSync(path.join(external, 'nested')), false);
  } finally {
    fs.rmSync(external, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a safe output creates an isolated platform tree', () => {
  const root = fixture();
  const output = path.join(root, 'dist', 'yandex');
  const result = buildPlatform(root, 'yandex', output);
  assert.equal(result.platform, 'yandex');
  assert.equal(fs.existsSync(path.join(output, 'assets', 'scene.webp')), true);
  assert.equal(fs.existsSync(path.join(output, 'src', 'vk-entry.js')), false);
  assert.equal(fs.existsSync(path.join(output, 'src', 'platform', 'vk-bridge-mock.js')), false);
});

test('real VK build resolves hosted relative assets and has no production mock/test switch', () => {
  const root = process.cwd();
  const vkBuilds = path.join(root, 'dist', 'vk');
  const yandexBuilds = path.join(root, 'dist', 'yandex');
  fs.mkdirSync(vkBuilds, { recursive: true });
  fs.mkdirSync(yandexBuilds, { recursive: true });
  const output = fs.mkdtempSync(path.join(vkBuilds, 'test-'));
  const yandexOutput = fs.mkdtempSync(path.join(yandexBuilds, 'test-'));
  try {
    buildPlatform(root, 'vk', output);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.equal(fs.existsSync(path.join(output, 'vendor', 'vk-bridge.js')), true);
  for (const reference of [...html.matchAll(/(?:src|href)="(\.[^"]+)"/g)].map(match => match[1])) {
    assert.equal(fs.existsSync(path.resolve(output, reference)), true, `missing hosted asset ${reference}`);
  }
  const sourceFiles = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(html|js|mjs|css)$/i.test(entry.name)) sourceFiles.push(file);
    }
  };
  visit(output);
  const source = sourceFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  for (const forbidden of ['vk-bridge-mock', 'createMockVkBridge', '__VK_BRIDGE__', 'vk-test-entry.js', 'initYandexPlatform', 'YaGames']) {
    assert.equal(source.includes(forbidden), false, `production VK bundle contains ${forbidden}`);
  }
  buildPlatform(root, 'yandex', yandexOutput);
  const yandexSource = fs.readFileSync(path.join(yandexOutput, 'index.html'), 'utf8') + fs.readFileSync(path.join(yandexOutput, 'src', 'entry.js'), 'utf8');
  assert.equal(yandexSource.includes('vk-entry.js'), false);
  assert.equal(fs.existsSync(path.join(yandexOutput, 'vendor', 'vk-bridge.js')), false);
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
    fs.rmSync(yandexOutput, { recursive: true, force: true });
  }
});
