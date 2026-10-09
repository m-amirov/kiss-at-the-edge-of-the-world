import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeAssetUrl } from '../../src/runtime-assets.js';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const moduleUrl = new URL('https://example.test/some/yandex/runtime/src/runtime-assets.js');
const archiveAssetRoot = new URL('../assets/', moduleUrl);

test('runtime assets resolve from the module URL, not document.baseURI', () => {
  const documentUrl = new URL('https://example.test/some/yandex/runtime/index.html');
  const expected = 'https://example.test/some/yandex/runtime/assets/backgrounds/keflavik-airport-arrivals-v1.webp';
  assert.equal(resolveRuntimeAssetUrl('backgrounds/keflavik-airport-arrivals-v1.webp', archiveAssetRoot), expected);
  assert.notEqual(new URL('../assets/backgrounds/keflavik-airport-arrivals-v1.webp', documentUrl).href, expected);
});

test('canonical asset input forms resolve to the same archive asset root', () => {
  const expected = 'https://example.test/some/yandex/runtime/assets/audio/music/main-theme.ogg';
  for (const value of ['audio/music/main-theme.ogg', 'assets/audio/music/main-theme.ogg', './assets/audio/music/main-theme.ogg', '../assets/audio/music/main-theme.ogg', '/assets/audio/music/main-theme.ogg']) {
    assert.equal(resolveRuntimeAssetUrl(value, archiveAssetRoot), expected, value);
  }
  assert.equal(resolveRuntimeAssetUrl('characters/alice-stage.webp', archiveAssetRoot), 'https://example.test/some/yandex/runtime/assets/characters/alice-stage.webp');
});

test('runtime asset resolver rejects traversal and external URLs', () => {
  for (const value of ['../outside.webp', '../../assets/main-theme.ogg', 'assets/../outside.webp', 'https://cdn.example/asset.webp', '//cdn.example/asset.webp']) {
    assert.throws(() => resolveRuntimeAssetUrl(value, archiveAssetRoot), /RUNTIME_ASSET_PATH_(ESCAPE|EXTERNAL)/, value);
  }
});

test('production runtime sinks use the central resolver instead of deployment-relative assets', () => {
  const player = fs.readFileSync(`${projectRoot}/src/literary-player.js`, 'utf8');
  const audio = fs.readFileSync(`${projectRoot}/src/audio-director.js`, 'utf8');
  for (const [name, source] of [['literary-player.js', player], ['audio-director.js', audio]]) {
    assert.match(source, /runtimeAssetUrl/ , name);
    assert.doesNotMatch(source, /["'`]\.\.\/assets\//, name);
    assert.doesNotMatch(source, /["'`]\.\/assets\//, name);
    assert.doesNotMatch(source, /["'`]\/assets\//, name);
  }
});
