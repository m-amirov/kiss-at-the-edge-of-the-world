import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertSafeOutputPath, buildPlatform } from '../../tools/platform/build.mjs';

test('VK regression suite bootstraps the local-audio build before bundle-dependent checks', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.match(packageJson.scripts?.['test:vk'] ?? '', /^npm run build:vk && node --test/);
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-build-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'audio', 'music'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'platform'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'scene.png'), 'master');
  fs.writeFileSync(path.join(root, 'assets', 'scene.webp'), 'asset');
  fs.writeFileSync(path.join(root, 'assets', 'pending.webp'), 'pending');
  fs.writeFileSync(path.join(root, 'assets', 'brand.png'), 'branding');
  fs.writeFileSync(path.join(root, 'assets', 'unused.png'), 'unused');
  fs.writeFileSync(path.join(root, 'assets', 'audio', 'music', 'main-theme.ogg'), 'music');
  fs.writeFileSync(path.join(root, 'assets', 'fonts', 'game.ttf'), 'font');
  fs.writeFileSync(path.join(root, 'assets', 'asset-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    assets: [
      { id: 'scene', family: 'background', path: 'assets/scene.png', status: 'integrated', runtimePath: 'assets/scene.webp' },
      { id: 'brand', family: 'branding', path: 'assets/brand.png', status: 'integrated', runtimePath: 'assets/brand.png' },
      { id: 'music-main-theme', family: 'music', path: 'assets/audio/music/main-theme.ogg', status: 'integrated' },
      { id: 'font-game', family: 'font', path: 'assets/fonts/game.ttf', status: 'integrated' },
      { id: 'pending', family: 'cg', path: 'assets/pending.png', status: 'integrated-local-web-review-pending', runtimePath: 'assets/pending.webp' },
      { id: 'unused', family: 'cg', path: 'assets/unused.png', status: 'unused-candidate' }
    ]
  }));
  fs.writeFileSync(path.join(root, 'src', 'entry.js'), 'entry');
  fs.writeFileSync(path.join(root, 'src', 'important.txt'), 'do-not-delete');
  fs.writeFileSync(path.join(root, 'src', 'vk-entry.js'), 'vk');
  fs.writeFileSync(path.join(root, 'src', 'platform', 'vk-games.js'), 'adapter');
  fs.writeFileSync(path.join(root, 'src', 'platform', 'vk-bridge-mock.js'), 'mock');
  fs.writeFileSync(path.join(root, 'index.html'), '<link rel="icon" href="./assets/brand.png"><link rel="stylesheet" href="./src/literary.css"><script type="module" src="./src/entry.js"></script>');
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

test('dangling symlink under dist cannot bypass canonical output guard', t => {
  const root = fixture();
  const dist = path.join(root, 'dist');
  const dangling = path.join(dist, 'vk');
  fs.mkdirSync(dist, { recursive: true });
  try {
    try {
      fs.symlinkSync(path.join(root, 'does-not-exist'), dangling, 'junction');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) {
        t.skip('symlink creation not permitted in this environment');
        return;
      }
      throw error;
    }
    assert.throws(
      () => buildPlatform(root, 'vk', path.join(dangling, 'test-output')),
      /Unsafe output path: symlink/
    );
    assert.equal(fs.lstatSync(dangling).isSymbolicLink(), true);
  } finally {
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

test('runtime asset selection keeps WebP and confirmed branding but excludes master and unused PNG files', () => {
  const root = fixture();
  const output = path.join(root, 'dist', 'yandex');
  try {
    buildPlatform(root, 'yandex', output);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'scene.webp')), true);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'brand.png')), true);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'audio', 'music', 'main-theme.ogg')), true);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'fonts', 'game.ttf')), true);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'scene.png')), false);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'pending.webp')), false);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'unused.png')), false);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'build-manifest.json'), 'utf8'));
    assert.deepEqual(manifest.assetSelection.files, [
      'assets/audio/music/main-theme.ogg',
      'assets/brand.png',
      'assets/fonts/game.ttf',
      'assets/scene.webp'
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing selected runtime asset fails before replacing an existing platform output', () => {
  const root = fixture();
  const output = path.join(root, 'dist', 'yandex');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'sentinel.txt'), 'preserve');
  fs.unlinkSync(path.join(root, 'assets', 'scene.webp'));
  try {
    assert.throws(() => buildPlatform(root, 'yandex', output), /Missing runtime asset: assets\/scene\.webp/);
    assert.equal(fs.readFileSync(path.join(output, 'sentinel.txt'), 'utf8'), 'preserve');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
    for (const buildOutput of [output, yandexOutput]) {
      const pngs = [];
      const visitAssets = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) visitAssets(file);
          else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) pngs.push(path.relative(buildOutput, file).replaceAll('\\', '/'));
        }
      };
      visitAssets(path.join(buildOutput, 'assets'));
      assert.deepEqual(pngs.sort(), ['assets/branding/kiss-at-the-edge-cover.png', 'assets/branding/kiss-at-the-edge-icon.png']);
    }
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
    fs.rmSync(yandexOutput, { recursive: true, force: true });
  }
});

test('VK Hosting mode excludes only music and requires approved HTTPS audio URL', () => {
  const root = process.cwd();
  const pathRoot = path.join(root, 'dist', 'vk');
  fs.mkdirSync(pathRoot, { recursive: true });
  const out = fs.mkdtempSync(path.join(pathRoot, 'hosted-test-'));
  const sentinel = path.join(out, 'sentinel.txt');
  fs.writeFileSync(sentinel, 'keep');
  try {
    const bad = ['http://example.org/music/', 'https://example.org/music', 'https://user:pw@example.org/music/', 'https://example.org/music/?token=123'];
    for (const externalAudioBaseUrl of bad) {
      assert.throws(() => buildPlatform(root, 'vk', out, { externalAudioBaseUrl }), /VK_AUDIO_BASE_URL/);
      assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
    }
    const target = 'https://media.example.org/game/music/';
    buildPlatform(root, 'vk', out, { externalAudioBaseUrl: target });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'build-manifest.json'), 'utf8'));
    assert.equal(manifest.externalAudio.baseUrl, target);
    assert.equal(manifest.externalAudio.files.length, 8);
    const audioDir = path.join(out, 'assets/audio/music');
    assert.equal(fs.existsSync(audioDir), false);
    assert.ok(manifest.externalAudio.files.every(item => /^[a-f0-9]{64}$/.test(item.sha256)));
    for (const item of manifest.externalAudio.files) {
      const source = path.join(root, ...item.path.split('/'));
      const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
      assert.equal(item.sha256, sourceHash, `external audio hash must bind to ${item.path}`);
    }
    const config = fs.readFileSync(path.join(out, 'src/vk-audio-config.js'), 'utf8');
    assert.equal(config, `export const vkAudioBaseUrl = "${target}";\n`);
    assert.equal(fs.existsSync(path.join(out, 'assets/branding/kiss-at-the-edge-icon.png')), true);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
