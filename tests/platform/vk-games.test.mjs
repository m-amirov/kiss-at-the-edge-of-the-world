import assert from 'node:assert/strict';
import test from 'node:test';
import { createVkPlatform, normalizeVkLocale, requestedVkLocale } from '../../src/platform/vk-games.js';

function bridgeHarness({ failWrites = 0, stored = '' } = {}) {
  const storage = new Map([['kiss_literary_season_v1', stored]]);
  const calls = [];
  const listeners = new Set();
  const document = { hidden: false, handlers: new Map(), addEventListener(name, fn) { this.handlers.set(name, fn); }, removeEventListener(name) { this.handlers.delete(name); } };
  const window = { handlers: new Map(), addEventListener(name, fn) { this.handlers.set(name, fn); }, removeEventListener(name) { this.handlers.delete(name); } };
  const bridge = {
    async send(method, params = {}) {
      calls.push({ method, params });
      if (method === 'VKWebAppStorageSet' && failWrites > 0) { failWrites -= 1; throw new Error('TEMPORARY_STORAGE_FAILURE'); }
      if (method === 'VKWebAppStorageSet') { storage.set(params.key, params.value); return { result: true }; }
      if (method === 'VKWebAppStorageGet') return { keys: params.keys.map(key => ({ key, value: storage.get(key) ?? '' })) };
      if (method === 'VKWebAppCheckNativeAds') return { result: true };
      if (method === 'VKWebAppShowNativeAds') return new Promise(resolve => setTimeout(() => resolve({ result: true }), 5));
      return { result: true };
    },
    subscribe(listener) { listeners.add(listener); },
    unsubscribe(listener) { listeners.delete(listener); },
    emit(type) { for (const listener of listeners) listener({ detail: { type } }); }
  };
  return { bridge, calls, document, window, storage };
}

test('VK locale is limited to Russian and English', () => {
  assert.equal(normalizeVkLocale('ru-RU'), 'ru');
  assert.equal(normalizeVkLocale('de-DE'), 'en');
  assert.equal(requestedVkLocale({ search: '?lang=en' }, { language: 'ru-RU' }), 'en');
  assert.equal(requestedVkLocale({ search: '' }, { language: 'ru-RU' }), 'ru');
});

test('VK Storage write failure recovers and round-trips a later state', async () => {
  const h = bridgeHarness({ failWrites: 1 });
  const errors = [];
  const platform = createVkPlatform(h.bridge, { document: h.document, window: h.window, onCloudError: error => errors.push(error.message) });
  await platform.init();
  await assert.rejects(platform.save({ revision: 1 }), /TEMPORARY_STORAGE_FAILURE/);
  assert.equal(await platform.save({ revision: 2 }), true);
  assert.deepEqual(await platform.load(), { revision: 2 });
  assert.deepEqual(errors, ['TEMPORARY_STORAGE_FAILURE']);
});

test('VK hide/restore, blur/focus and interstitial overlap are idempotent', async () => {
  const h = bridgeHarness();
  const events = [];
  const platform = createVkPlatform(h.bridge, {
    document: h.document,
    window: h.window,
    onPause: () => events.push('pause'),
    onResume: () => events.push('resume')
  });
  await platform.init();
  h.bridge.emit('VKWebAppViewHide');
  h.bridge.emit('VKWebAppViewHide');
  h.window.handlers.get('blur')();
  h.bridge.emit('VKWebAppViewRestore');
  assert.deepEqual(events, ['pause']);
  h.window.handlers.get('focus')();
  assert.deepEqual(events, ['pause', 'resume']);
  const first = platform.showInterstitial({ atBoundary: true });
  const second = await platform.showInterstitial({ atBoundary: true });
  assert.deepEqual(second, { status: 'busy' });
  assert.deepEqual(await first, { status: 'shown' });
  assert.deepEqual(events, ['pause', 'resume', 'pause', 'resume']);
  assert.equal((h.calls.filter(call => call.method === 'VKWebAppShowNativeAds')).length, 1);
});

test('corrupt VK Storage is reported and never silently hydrated', async () => {
  const h = bridgeHarness({ stored: '{bad-json' });
  const errors = [];
  const platform = createVkPlatform(h.bridge, { document: h.document, window: h.window, onCloudError: error => errors.push(error.message) });
  await platform.init();
  assert.deepEqual(errors, ['VK save is corrupted JSON']);
  await assert.rejects(platform.load(), /corrupted JSON/);
});
