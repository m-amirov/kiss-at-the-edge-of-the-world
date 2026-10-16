export function createMockVkBridge() {
  const storage = new Map();
  const listeners = new Set();
  const runtime = { calls: [], storage, emit, shows: { interstitial: 0, reward: 0 } };
  globalThis.__VK_BRIDGE_RUNTIME__ = runtime;
  function emit(type, data = {}) {
    for (const listener of listeners) listener({ detail: { type, data } });
  }
  return {
    async send(method, params = {}) {
      runtime.calls.push({ method, params });
      if (method === 'VKWebAppStorageGet') return { keys: params.keys.map((key) => ({ key, value: storage.get(key) ?? '' })) };
      if (method === 'VKWebAppStorageSet') { storage.set(params.key, params.value); return { result: true }; }
      if (method === 'VKWebAppShowNativeAds') {
        runtime.shows[params.ad_format === 'reward' ? 'reward' : 'interstitial'] += 1;
      }
      return { result: true };
    },
    subscribe(listener) { listeners.add(listener); },
    unsubscribe(listener) { listeners.delete(listener); }
  };
}
