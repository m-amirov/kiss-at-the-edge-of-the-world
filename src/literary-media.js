/**
 * Browser-image readiness and stable scene visual layers.
 * Existing visual nodes survive text-only dialogue navigation. When the
 * authored visual changes, keep the old frame visible until the replacement
 * has loaded and decoded; then crossfade once. Shared by VK and Yandex.
 */
export function createImagePreloader({ ImageClass = globalThis.Image, capacity = 16 } = {}) {
  const cache = new Map();
  function preload(url) {
    if (!url || typeof ImageClass !== 'function') return Promise.resolve(false);
    if (cache.has(url)) {
      const pending = cache.get(url);
      cache.delete(url);
      cache.set(url, pending);
      return pending;
    }
    const pending = new Promise(resolve => {
      const image = new ImageClass();
      image.onload = () => {
        if (typeof image.decode !== 'function') return resolve(true);
        Promise.resolve().then(() => image.decode()).then(
          () => resolve(true),
          () => resolve(Boolean(image.complete && image.naturalWidth > 0))
        );
      };
      image.onerror = () => resolve(false);
      image.src = url;
    });
    cache.set(url, pending);
    while (cache.size > capacity) cache.delete(cache.keys().next().value);
    return pending;
  }
  return { preload, getSize: () => cache.size };
}

export function createVisualLayerController({
  root, preload, frame = callback => globalThis.requestAnimationFrame(callback),
  schedule = (callback, ms) => globalThis.setTimeout(callback, ms), fadeMs = 180
}) {
  let active = null;
  let activeKey = null;
  let requestedKey = null;
  let generation = 0;
  const stats = { mounted: 0, reused: 0, transitions: 0, failed: 0 };

  function clear() {
    generation++;
    active = null;
    activeKey = null;
    requestedKey = null;
  }
  function present({ key, assets = [], build, onReuse }) {
    if (active && !active.isConnected) {
      active = null;
      activeKey = null;
    }
    // Reuse the exact DOM node and decoded GPU texture, not just its URL.
    // Reparenting the image would restart CSS entrance animations.
    if (active && activeKey === key) {
      if (requestedKey !== key) {
        generation++; // cancel an in-flight transition back to the active art
        requestedKey = key;
      }
      onReuse?.(active);
      stats.reused++;
      return 'reused';
    }
    if (requestedKey === key) return 'pending';
    requestedKey = key;
    const request = ++generation;
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
      frame(() => {
        if (incoming.isConnected) incoming.classList.add('scene-visual-visible');
      });
      schedule(() => {
        previous.remove();
        incoming.classList.remove('scene-visual-next', 'scene-visual-visible');
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
    clear, present,
    getState: () => ({ ...stats, activeKey, requestedKey, generation })
  };
}
