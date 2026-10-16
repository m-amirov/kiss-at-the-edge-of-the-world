import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPlatform } from '../../tools/platform/build.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

test('platform builds keep Yandex and VK SDKs in separate output trees', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'kiss-platform-build-'));
  try {
    const yandex = buildPlatform(root, 'yandex', path.join(output, 'yandex'));
    const vk = buildPlatform(root, 'vk', path.join(output, 'vk'));
    const yandexHtml = fs.readFileSync(path.join(yandex.outputDir, 'index.html'), 'utf8');
    const vkHtml = fs.readFileSync(path.join(vk.outputDir, 'index.html'), 'utf8');
    assert.match(yandexHtml, /\/sdk\.js/);
    assert.doesNotMatch(vkHtml, /\/sdk\.js/);
    assert.ok(fs.existsSync(path.join(vk.outputDir, 'vendor', 'vk-bridge.js')));
    assert.ok(!fs.existsSync(path.join(vk.outputDir, 'src', 'yandex-sdk.js')));
    const vkSource = vk.files
      .filter((file) => /\.(html|js|mjs|css)$/.test(file))
      .map((file) => fs.readFileSync(path.join(vk.outputDir, file), 'utf8'))
      .join('\n');
    assert.doesNotMatch(vkSource, /YaGames\.init|yandex-games-sdk|yandexGamesSDK/);
    assert.ok(yandex.files.includes('src/yandex-sdk.js'));
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
