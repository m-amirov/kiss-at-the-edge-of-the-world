/**
 * Browser-image readiness and stable scene visual layers.
 * Existing visual nodes survive text-only dialogue navigation. When the
 * authored visual changes, keep the old frame visible until the replacement
 * has loaded and decoded; then crossfade once. Shared by VK and Yandex.
 */
export function createImagePreloader({ ImageClass = globalThis.Image, capacity = 16 } = {}) {
  const maxEntries = Math.max(1, Number.isFinite(capacity) ? Math.floor(capacity) : 16);
  // Only successful, settled loads occupy the bounded LRU. In-flight loads
  // live in a separate map so a slow mobile request cannot be duplicated just
  // because another resource completed and evicted an older cache entry.
  const cache = new Map();
  const pending = new Map();

  function touch(key, value) {
    cache.delete(key);
    cache.set(key, value);
  }
  function evictSettled() {
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  }
  function loadImage(url) {
    return new Promise(resolve => {
      let image;
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(Boolean(value));
      };
      try {
        image = new ImageClass();
        image.onload = () => {
          if (typeof image.decode !== 'function') {
            finish(true);
            return;
          }
          Promise.resolve().then(() => image.decode()).then(
            () => finish(true),
            () => finish(Boolean(image.complete && image.naturalWidth > 0))
          );
        };
        image.onerror = () => finish(false);
        image.src = url;
      } catch {
        finish(false);
      }
    });
  }
  function preload(url) {
    if (!url || typeof ImageClass !== 'function') return Promise.resolve(false);
    if (cache.has(url)) {
      const result = cache.get(url);
      touch(url, result);
      return Promise.resolve(result);
    }
    if (pending.has(url)) return pending.get(url);

    let resolvePending;
    const promise = new Promise(resolve => { resolvePending = resolve; });
    pending.set(url, promise);
    loadImage(url).then(result => {
      pending.delete(url);
      if (result) {
        touch(url, true);
        evictSettled();
      }
      resolvePending(result);
    });
    return promise;
  }
  return {
    preload,
    getSize: () => cache.size,
    getPendingSize: () => pending.size
  };
}

export function createVisualLayerController({
  root,
  preload,
  frame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame?.(id),
  schedule = (callback, ms) => globalThis.setTimeout(callback, ms),
  cancelSchedule = id => globalThis.clearTimeout?.(id),
  fadeMs = 180
}) {
  let active = null;
  let activeKey = null;
  let requestedKey = null;
  let generation = 0;
  let transition = null;
  const stats = { mounted: 0, reused: 0, transitions: 0, failed: 0 };

  function remove(node) {
    if (node?.isConnected) node.remove();
  }
  function invalidate() {
    generation++;
    const current = transition;
    transition = null;
    if (!current) return;
    if (current.rafId !== undefined) cancelFrame(current.rafId);
    if (current.timerId !== undefined) cancelSchedule(current.timerId);
    // Keep the currently active frame, but remove the old frame and any
    // incoming node that was superseded before it became active.
    if (current.previous !== active) remove(current.previous);
    if (current.incoming !== active) remove(current.incoming);
  }
  function clear() {
    invalidate();
    remove(active);
    active = null;
    activeKey = null;
    requestedKey = null;
  }
  function present({ key, assets = [], build, onReuse }) {
    if (active && !active.isConnected) {
      invalidate();
      active = null;
      activeKey = null;
    }
    // Reuse the exact DOM node and decoded GPU texture, not just its URL.
    // Reparenting the image would restart CSS entrance animations.
    if (active && activeKey === key) {
      invalidate();
      requestedKey = key;
      delete root.dataset.visualError;
      onReuse?.(active);
      stats.reused++;
      return 'reused';
    }
    if (requestedKey === key) return 'pending';

    invalidate();
    requestedKey = key;
    const request = generation;
    if (!active) {
      active = build();
      activeKey = key;
      root.prepend(active);
      stats.mounted++;
      return 'mounted';
    }

    Promise.all(assets.map(preload)).then(results => {
      if (request !== generation || requestedKey !== key || !active?.isConnected) return;
      if (results.some(ready => !ready)) {
        root.dataset.visualError = 'preload-failed';
        requestedKey = null;
        stats.failed++;
        return;
      }
      delete root.dataset.visualError;
      const previous = active;
      const incoming = build();
      incoming.classList.add('scene-visual-next');
      root.insertBefore(incoming, previous.nextSibling);
      active = incoming;
      activeKey = key;
      stats.transitions++;

      const state = { previous, incoming, request, rafId: undefined, timerId: undefined };
      transition = state;
      state.rafId = frame(() => {
        if (request !== generation || transition !== state || active !== incoming || !incoming.isConnected) return;
        incoming.classList.add('scene-visual-visible');
      });
      state.timerId = schedule(() => {
        if (request !== generation || transition !== state || active !== incoming) return;
        remove(previous);
        incoming.classList.remove('scene-visual-next', 'scene-visual-visible');
        transition = null;
      }, fadeMs + 60);
    }).catch(error => {
      if (request !== generation) return;
      requestedKey = null;
      root.dataset.visualError = 'preload-exception';
      stats.failed++;
      console.warn('[media] visual preload failed', error);
    });
    return 'pending';
  }
  return {
    clear,
    present,
    getState: () => ({ ...stats, activeKey, requestedKey, generation })
  };
}
