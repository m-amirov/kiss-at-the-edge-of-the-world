const DEFAULT_CACHE_LIMIT = 18;
const DEFAULT_TIMEOUT_MS = 15000;

function describeError(error, fallback = 'unknown') {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function makeImage(imageFactory) {
  const image = imageFactory();
  image.decoding = 'async';
  image.loading = 'eager';
  return image;
}

/**
 * A small decoded-image cache. Entries are promises so concurrent preload and
 * presentation requests share one Image request. The LRU bound is deliberate:
 * this is a scene look-ahead cache, not a season-wide asset registry.
 */
export function createImageAssetCache({
  imageFactory = () => new Image(),
  maxEntries = DEFAULT_CACHE_LIMIT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onError = () => {}
} = {}) {
  const entries = new Map();
  const retained = new Set();
  let requestCount = 0;
  let cacheHitCount = 0;

  function touch(entry) {
    if (entry) entry.lastUsed = Date.now();
  }

  function trim() {
    while (entries.size > maxEntries) {
      const candidate = [...entries.values()]
        .filter(entry => !retained.has(entry.path) && entry.status !== 'pending')
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (!candidate) return;
      entries.delete(candidate.path);
    }
  }

  function preload(path) {
    if (!path) return Promise.resolve(null);
    const existing = entries.get(path);
    if (existing) {
      cacheHitCount += 1;
      touch(existing);
      return existing.promise;
    }

    const image = makeImage(imageFactory);
    const entry = { path, image, status: 'pending', lastUsed: Date.now(), promise: null };
    requestCount += 1;
    entry.promise = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish('error', new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);

      const finish = (status, error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        entry.status = status;
        touch(entry);
        trim();
        if (status === 'loaded') {
          resolve(image);
          return;
        }
        const reason = describeError(error, `failed to load ${path}`);
        const failure = error instanceof Error ? error : new Error(reason);
        onError(path, failure);
        reject(failure);
      };

      image.onload = async () => {
        try {
          if (typeof image.decode === 'function') await image.decode();
          if (image.naturalWidth === 0 && image.width === 0 && image.complete === false) {
            throw new Error('image did not decode');
          }
          finish('loaded');
        } catch (error) {
          finish('error', error);
        }
      };
      image.onerror = event => finish('error', new Error(event?.message || `failed to load ${path}`));
      image.src = path;
      if (image.complete && (image.naturalWidth || image.width)) queueMicrotask(() => image.onload?.());
    });
    entries.set(path, entry);
    return entry.promise;
  }

  function retain(path) {
    if (!path) return;
    retained.add(path);
    touch(entries.get(path));
  }

  function release(path) {
    if (path) retained.delete(path);
    trim();
  }

  return {
    preload,
    retain,
    release,
    stats() {
      return {
        requestCount,
        cacheHitCount,
        size: entries.size,
        pending: [...entries.values()].filter(entry => entry.status === 'pending').length,
        loaded: [...entries.values()].filter(entry => entry.status === 'loaded').length,
        failed: [...entries.values()].filter(entry => entry.status === 'error').length,
        paths: [...entries.keys()]
      };
    }
  };
}

function directImageChildren(container) {
  return [...container.children].filter(node => node.tagName === 'IMG' && node.classList.contains('literary-art-layer'));
}

/**
 * Presents only the newest requested asset. The currently committed layer is
 * left untouched while a new layer loads and decodes, then both layers are
 * crossfaded without blocking the reader.
 */
export function createImageTransition({
  container,
  cache,
  durationMs = 180,
  reducedMotion = () => false,
  onCommit = () => {},
  onError = () => {}
}) {
  let requestId = 0;
  let displayed = null;
  let cleanupTimer = null;

  function clearCleanupTimer() {
    if (cleanupTimer !== null) clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  function cleanupOldLayers(keep) {
    for (const layer of directImageChildren(container)) {
      if (layer !== keep) layer.remove();
    }
  }

  function cancel() {
    requestId += 1;
    clearCleanupTimer();
    cleanupOldLayers(displayed?.image ?? null);
  }

  async function show({ path, key = path, attributes = {}, metadata = {} }) {
    if (!path) return { status: 'fallback' };
    if (displayed?.key === key && displayed.image?.parentNode === container) {
      Object.assign(displayed.image.dataset, attributes);
      return { status: 'unchanged', image: displayed.image };
    }

    const token = ++requestId;
    const previous = displayed?.image ?? null;
    clearCleanupTimer();
    try {
      const image = await cache.preload(path);
      if (token !== requestId) return { status: 'stale' };

      image.className = 'literary-art-layer';
      Object.assign(image.dataset, attributes);
      image.dataset.assetPath = path;
      image.dataset.transitionKey = key;
      const motionless = reducedMotion();
      image.style.transition = motionless ? 'none' : `opacity ${Math.max(150, Math.min(250, durationMs))}ms ease`;
      image.style.opacity = '0';
      container.append(image);
      displayed = { key, path, image };
      cache.retain(path);
      if (previous && previous !== image) cache.release(previous.dataset.assetPath || previous.currentSrc || previous.src);

      onCommit({ image, path, key, metadata });
      if (motionless) {
        image.style.opacity = '1';
        cleanupOldLayers(image);
      } else {
        // Force the initial opacity to be painted before starting the fade.
        const scheduleFrame = globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 0));
        scheduleFrame(() => {
          if (token !== requestId) return;
          image.style.opacity = '1';
          if (previous && previous !== image) previous.style.opacity = '0';
        });
        cleanupTimer = setTimeout(() => {
          if (token === requestId) cleanupOldLayers(image);
        }, Math.max(150, Math.min(250, durationMs)) + 40);
      }
      return { status: 'committed', image };
    } catch (error) {
      if (token === requestId) onError({ path, key, reason: describeError(error) });
      return { status: 'failed', error };
    }
  }

  return {
    show,
    cancel,
    getDisplayed: () => displayed ? { ...displayed } : null
  };
}

export const imageTransitionDefaults = Object.freeze({
  cacheLimit: DEFAULT_CACHE_LIMIT,
  durationMs: 180,
  timeoutMs: DEFAULT_TIMEOUT_MS
});
