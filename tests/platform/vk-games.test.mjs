import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createVkPlatform, normalizeVkLocale, requestedVkLocale } from '../../src/platform/vk-games.js';
import { requiredClientsForDistributions } from '../../tools/vk/vk-games-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function bridgeHarness({ failWrites = 0, stored = '', supportsResize = false, resizeAfter = null, resizeNever = false } = {}) {
  const storage = new Map([['kiss_literary_season_v1', stored]]);
  const calls = [];
  const listeners = new Set();
  const document = { hidden: false, handlers: new Map(), addEventListener(name, fn) { this.handlers.set(name, fn); }, removeEventListener(name) { this.handlers.delete(name); } };
  const window = { innerWidth: 411, innerHeight: 731, handlers: new Map(), addEventListener(name, fn) { this.handlers.set(name, fn); }, removeEventListener(name) { this.handlers.delete(name); } };
  const bridge = {
    async send(method, params = {}) {
      calls.push({ method, params });
      if (method === 'VKWebAppStorageSet' && failWrites > 0) { failWrites -= 1; throw new Error('TEMPORARY_STORAGE_FAILURE'); }
      if (method === 'VKWebAppStorageSet') { storage.set(params.key, params.value); return { result: true }; }
      if (method === 'VKWebAppStorageGet') return { keys: params.keys.map(key => ({ key, value: storage.get(key) ?? '' })) };
      if (method === 'VKWebAppResizeWindow') {
        if (resizeNever) return new Promise(() => {});
        if (resizeAfter) Object.assign(window, resizeAfter);
        return { width: params.width, height: params.height };
      }
      if (method === 'VKWebAppCheckNativeAds') return { result: true };
      if (method === 'VKWebAppShowNativeAds') return new Promise(resolve => setTimeout(() => resolve({ result: true }), 5));
      return { result: true };
    },
    subscribe(listener) { listeners.add(listener); },
    unsubscribe(listener) { listeners.delete(listener); },
    supports(method) { return supportsResize && method === 'VKWebAppResizeWindow'; },
    emit(type) { for (const listener of listeners) listener({ detail: { type } }); }
  };
  return { bridge, calls, document, window, storage };
}

test('VK-only release scope requires only the three VK clients and preserves OK for future opt-in', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'platform/vk-games.contract.json'), 'utf8'));
  assert.deepEqual(contract.distributions, ['vk']);
  assert.deepEqual(requiredClientsForDistributions(contract.distributions), ['vk-web', 'vk-android', 'vk-ios']);
  assert.deepEqual(requiredClientsForDistributions(['vk', 'ok']), [
    'vk-web', 'vk-android', 'vk-ios', 'ok-web', 'ok-android', 'ok-ios'
  ]);
});

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

test('VK desktop resize is requested after init and verified against the viewport', async () => {
  const h = bridgeHarness({ supportsResize: true, resizeAfter: { innerWidth: 1000, innerHeight: 720 } });
  const diagnostics = [];
  const platform = createVkPlatform(h.bridge, {
    location: { search: '?vk_platform=desktop_web' },
    document: h.document,
    window: h.window,
    onDiagnostic: event => diagnostics.push(event)
  });
  await platform.init();
  const resize = h.calls.find(call => call.method === 'VKWebAppResizeWindow');
  assert.deepEqual(resize?.params, { width: 1000, height: 720 });
  assert.deepEqual(diagnostics.find(event => event.area === 'resize')?.detail.after, { width: 1000, height: 720 });
  assert.equal(diagnostics.find(event => event.area === 'resize')?.status, 'applied');
});

test('VK resize is skipped on mobile and a rejected request cannot block init', async () => {
  const mobile = bridgeHarness({ supportsResize: true, resizeAfter: { innerWidth: 1000, innerHeight: 720 } });
  const mobileDiagnostics = [];
  await createVkPlatform(mobile.bridge, {
    location: { search: '?vk_platform=mobile_android' },
    document: mobile.document,
    window: mobile.window,
    onDiagnostic: event => mobileDiagnostics.push(event)
  }).init();
  assert.equal(mobile.calls.some(call => call.method === 'VKWebAppResizeWindow'), false);
  assert.equal(mobileDiagnostics.find(event => event.area === 'resize')?.status, 'skipped');

  const rejected = bridgeHarness({ supportsResize: true, resizeNever: true });
  const rejectedDiagnostics = [];
  await createVkPlatform(rejected.bridge, {
    location: { search: '?vk_platform=desktop_web' },
    document: rejected.document,
    window: rejected.window,
    resizeTimeoutMs: 5,
    onDiagnostic: event => rejectedDiagnostics.push(event)
  }).init();
  assert.equal(rejectedDiagnostics.find(event => event.area === 'resize')?.status, 'timeout');
});
