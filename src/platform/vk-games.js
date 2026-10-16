const KEY = /^[A-Za-z0-9_-]{1,100}$/;
const DEFAULT_MAX_BYTES = 3800;
const DEFAULT_STORAGE_KEY = 'kiss_literary_season_v1';

export function normalizeVkLocale(value) {
  return String(value || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function requestedVkLocale(
  location = globalThis.location,
  navigator = globalThis.navigator
) {
  const query = new URLSearchParams(location?.search || '').get('lang');
  if (query === 'ru' || query === 'en') return query;
  return normalizeVkLocale(navigator?.language);
}

function textBytes(value) {
  return new TextEncoder().encode(value).length;
}

export function createVkPlatform(bridge, {
  cloudKey = DEFAULT_STORAGE_KEY,
  maxBytes = DEFAULT_MAX_BYTES,
  location = globalThis.location,
  navigator = globalThis.navigator,
  document = globalThis.document,
  window = globalThis.window,
  onCloudState,
  onCloudError,
  onLanguage,
  onPause,
  onResume,
  onDiagnostic
} = {}) {
  if (!bridge || typeof bridge.send !== 'function' || typeof bridge.subscribe !== 'function') {
    throw new TypeError('VK Bridge with send/subscribe required');
  }
  let initialized = false;
  let destroyed = false;
  let readySent = false;
  let gameplayActive = false;
  let paused = false;
  let bridgeHidden = false;
  let browserHidden = false;
  let adActive = false;
  let listener = null;
  const events = [];
  const locale = requestedVkLocale(location, navigator);
  const storageKey = KEY.test(cloudKey) ? cloudKey : DEFAULT_STORAGE_KEY;

  const diagnostic = (area, status, detail = null) => {
    const event = { area, status, ...(detail ? { detail } : {}) };
    events.push(event);
    onDiagnostic?.(event);
  };
  const ready = () => {
    if (!initialized || destroyed) throw new Error('VK adapter not initialized');
  };
  const syncPause = () => {
    const next = bridgeHidden || browserHidden || adActive;
    if (next === paused) return;
    paused = next;
    if (next) onPause?.();
    else onResume?.();
    diagnostic('lifecycle', next ? 'paused' : 'resumed');
  };
  const handleBridgeEvent = (event) => {
    const type = event?.detail?.type;
    if (type === 'VKWebAppViewHide') bridgeHidden = true;
    if (type === 'VKWebAppViewRestore') bridgeHidden = false;
    syncPause();
  };
  const handleVisibility = () => {
    browserHidden = Boolean(document?.hidden);
    syncPause();
  };
  const handleBlur = () => { browserHidden = true; syncPause(); };
  const handleFocus = () => { browserHidden = false; syncPause(); };

  async function init() {
    if (destroyed) throw new Error('Adapter destroyed');
    if (initialized) return api;
    try {
      await bridge.send('VKWebAppInit');
      listener = handleBridgeEvent;
      bridge.subscribe(listener);
      document?.addEventListener?.('visibilitychange', handleVisibility);
      window?.addEventListener?.('blur', handleBlur);
      window?.addEventListener?.('focus', handleFocus);
      initialized = true;
      onLanguage?.(locale);
      diagnostic('sdk', 'initialized');
      try {
        const cloud = await load();
        if (cloud !== null) onCloudState?.(cloud);
        diagnostic('cloud-read', 'success');
      } catch (error) {
        diagnostic('cloud-read', 'failed', error?.message || String(error));
        onCloudError?.(error);
      }
      return api;
    } catch (error) {
      diagnostic('sdk', 'init-failed', error?.message || String(error));
      throw error;
    }
  }

  async function showInterstitial({ atBoundary = false } = {}) {
    ready();
    if (!atBoundary) return { status: 'blocked-not-boundary' };
    adActive = true;
    syncPause();
    try {
      const available = await bridge.send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' });
      if (available?.result !== true) return { status: 'unavailable' };
      const result = await bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' });
      return { status: result?.result === true ? 'shown' : 'not-shown' };
    } catch (error) {
      return { status: 'error', reason: String(error?.message ?? error) };
    } finally {
      adActive = false;
      syncPause();
    }
  }

  async function showRewarded() {
    ready();
    return { status: 'disabled', grantReward: false };
  }

  async function save(state) {
    ready();
    const value = JSON.stringify(state);
    if (value === undefined) throw new TypeError('Not JSON serializable');
    const bytes = textBytes(value);
    if (bytes > maxBytes) throw new Error(`VK save too large: ${bytes} > ${maxBytes} bytes`);
    const result = await bridge.send('VKWebAppStorageSet', { key: storageKey, value });
    if (result?.result === false) throw new Error('VK save rejected');
    const readback = await bridge.send('VKWebAppStorageGet', { keys: [storageKey] });
    const stored = readback?.keys?.find((item) => item.key === storageKey)?.value;
    if (stored !== value) throw new Error('VK save round-trip mismatch');
    diagnostic('cloud-write', 'success', { key: storageKey, bytes });
    return true;
  }

  async function load() {
    ready();
    const result = await bridge.send('VKWebAppStorageGet', { keys: [storageKey] });
    if (!Array.isArray(result?.keys)) throw new Error('VK Storage response malformed');
    const value = result.keys.find((item) => item.key === storageKey)?.value;
    if (value === '' || value === undefined) return null;
    return JSON.parse(value);
  }

  function markInteractiveReady() {
    if (readySent) return false;
    readySent = true;
    diagnostic('loading', 'ready');
    return true;
  }
  function setGameplayActive(active) {
    gameplayActive = Boolean(active);
    diagnostic('gameplay', gameplayActive ? 'started' : 'stopped');
  }
  function dispose() {
    if (listener && typeof bridge.unsubscribe === 'function') bridge.unsubscribe(listener);
    document?.removeEventListener?.('visibilitychange', handleVisibility);
    window?.removeEventListener?.('blur', handleBlur);
    window?.removeEventListener?.('focus', handleFocus);
    initialized = false;
    destroyed = true;
    listener = null;
  }

  const api = {
    mode: 'vk-games',
    locale,
    language: locale,
    storageKey,
    qaLocaleOverride: location?.hostname === 'localhost' || location?.hostname === '127.0.0.1'
      ? new URLSearchParams(location?.search || '').get('lang')
      : null,
    diagnostics: events,
    init,
    markInteractiveReady,
    setGameplayActive,
    showInterstitial,
    showRewarded,
    save,
    load,
    dispose,
    getGameplayActive: () => gameplayActive
  };
  return api;
}

export async function initVkPlatform(options = {}) {
  const platform = createVkPlatform(options.bridge ?? globalThis.vkBridge, options);
  await platform.init();
  return platform;
}
