import assert from 'node:assert/strict';
import test from 'node:test';
import { initVkPlatform, normalizeVkLocale } from '../../src/platform/vk-games.js';

function bridgeHarness({ storage = new Map(), storageAvailable = true, readback = true } = {}) {
  const calls = [];
  const listeners = new Set();
  const bridge = {
    async send(method, params = {}) {
      calls.push({ method, params });
      if (method === 'VKWebAppStorageGet') {
        if (!storageAvailable) throw new Error('VK_STORAGE_UNAVAILABLE');
        return { keys: params.keys.map((key) => ({ key, value: storage.get(key) ?? '' })) };
      }
      if (method === 'VKWebAppStorageSet') {
        if (!storageAvailable) throw new Error('VK_STORAGE_UNAVAILABLE');
        storage.set(params.key, readback ? params.value : 'different');
        return { result: true };
      }
      if (method === 'VKWebAppCheckNativeAds') return { result: true };
      if (method === 'VKWebAppShowNativeAds') return { result: true };
      return { result: true };
    },
    subscribe(listener) { listeners.add(listener); },
    unsubscribe(listener) { listeners.delete(listener); }
  };
  return {
    bridge,
    calls,
    storage,
    emit(type, data = {}) {
      for (const listener of listeners) listener({ detail: { type, data } });
    }
  };
}

test('VK locale is constrained to Russian and English', () => {
  assert.equal(normalizeVkLocale('ru-RU'), 'ru');
  assert.equal(normalizeVkLocale('en-US'), 'en');
  assert.equal(normalizeVkLocale('de-DE'), 'en');
});

test('VK platform initializes, restores storage and forwards hide/restore lifecycle', async () => {
  const harness = bridgeHarness({ storage: new Map([['progress', JSON.stringify({ sceneId: 'S26' })]]) });
  const events = [];
  let cloudState = null;
  const platform = await initVkPlatform({
    bridge: harness.bridge,
    cloudKey: 'progress',
    location: { protocol: 'https:', hostname: 'vk.com', search: '' },
    navigator: { language: 'ru-RU' },
    onCloudState: (state) => { cloudState = state; },
    onPause: () => events.push('pause'),
    onResume: () => events.push('resume')
  });

  assert.equal(platform.mode, 'vk-games');
  assert.deepEqual(cloudState, { sceneId: 'S26' });
  assert.equal(platform.storageKey, 'progress');
  assert.equal(harness.calls[0].method, 'VKWebAppInit');
  harness.emit('VKWebAppViewHide');
  harness.emit('VKWebAppViewHide');
  harness.emit('VKWebAppViewRestore');
  assert.deepEqual(events, ['pause', 'resume']);
  platform.dispose();
  harness.emit('VKWebAppViewHide');
  assert.deepEqual(events, ['pause', 'resume']);

  const legacyKeyHarness = bridgeHarness();
  const legacyKeyPlatform = await initVkPlatform({
    bridge: legacyKeyHarness.bridge,
    cloudKey: 'kiss-at-the-edge-of-the-world:literary-season:v1'
  });
  assert.equal(legacyKeyPlatform.storageKey, 'kiss_literary_season_v1');
  assert.equal(legacyKeyHarness.calls[1].params.keys[0], 'kiss_literary_season_v1');
  legacyKeyPlatform.dispose();
});

test('VK ads are boundary-only and rewarded ads never grant entitlement', async () => {
  const harness = bridgeHarness();
  const platform = await initVkPlatform({ bridge: harness.bridge });
  assert.deepEqual(await platform.showInterstitial(), { status: 'blocked-not-boundary' });
  assert.deepEqual(await platform.showInterstitial({ atBoundary: true }), { status: 'shown' });
  assert.deepEqual(await platform.showRewarded(), { status: 'disabled', grantReward: false });
  assert.equal(harness.calls.filter(({ method }) => method === 'VKWebAppShowNativeAds').length, 1);
  platform.dispose();
});

test('VK storage round-trip is verified, oversized state is rejected, and corruption is not reset', async () => {
  const harness = bridgeHarness();
  const platform = await initVkPlatform({ bridge: harness.bridge });
  assert.equal(await platform.save({ sceneId: 'S01', revision: 1 }), true);
  assert.deepEqual(await platform.load(), { sceneId: 'S01', revision: 1 });
  await assert.rejects(() => platform.save({ text: 'А'.repeat(2000) }), /too large/);
  harness.storage.set(platform.storageKey, '{not-json');
  await assert.rejects(() => platform.load(), SyntaxError);
  platform.dispose();

  const mismatch = bridgeHarness({ readback: false });
  const mismatchPlatform = await initVkPlatform({ bridge: mismatch.bridge });
  await assert.rejects(() => mismatchPlatform.save({ sceneId: 'S01' }), /round-trip mismatch/);
  mismatchPlatform.dispose();
});

test('VK storage outage is observable and does not block boot', async () => {
  const errors = [];
  const platform = await initVkPlatform({
    bridge: bridgeHarness({ storageAvailable: false }).bridge,
    onCloudError: (error) => errors.push(error.message)
  });
  assert.equal(platform.mode, 'vk-games');
  assert.deepEqual(errors, ['VK_STORAGE_UNAVAILABLE']);
  platform.dispose();
});
