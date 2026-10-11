import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageAssetCache, createImageTransition } from '../../src/literary-image-transition.js';

class FakeImage {
  constructor(pending) {
    this.pending = pending;
    this.tagName = 'IMG';
    this.dataset = {};
    this.style = {};
    this.complete = false;
    this.naturalWidth = 0;
    this.width = 0;
    this.parentNode = null;
    this._classes = new Set();
  }

  get className() { return [...this._classes].join(' '); }
  set className(value) { this._classes = new Set(String(value).split(/\s+/u).filter(Boolean)); }
  get classList() {
    return {
      add: (...names) => names.forEach(name => this._classes.add(name)),
      remove: (...names) => names.forEach(name => this._classes.delete(name)),
      contains: name => this._classes.has(name)
    };
  }
  set src(path) {
    this._src = path;
    this.pending.set(path, this);
  }
  get src() { return this._src; }
  get currentSrc() { return this._src; }
  decode() { return Promise.resolve(); }
  load() {
    this.complete = true;
    this.naturalWidth = 100;
    this.width = 100;
    this.onload?.();
  }
  fail(reason = 'failed') { this.onerror?.({ message: reason }); }
  remove() {
    this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
}

function makeFactory(pending) { return () => new FakeImage(pending); }
function makeContainer() {
  return {
    children: [],
    append(node) { node.parentNode = this; this.children.push(node); },
    insertBefore(node, before) {
      node.parentNode = this;
      this.children.splice(Math.max(0, this.children.indexOf(before)), 0, node);
    }
  };
}

test('decoded image cache deduplicates requests and keeps failures finite', async () => {
  const pending = new Map();
  const errors = [];
  const cache = createImageAssetCache({ imageFactory: makeFactory(pending), onError: (path, error) => errors.push({ path, reason: error.message }) });

  const first = cache.preload('/art/one.webp');
  const duplicate = cache.preload('/art/one.webp');
  pending.get('/art/one.webp').load();
  assert.strictEqual(await first, await duplicate);
  assert.equal(cache.stats().requestCount, 1);
  assert.ok(cache.stats().cacheHitCount >= 1);

  const failure = cache.preload('/art/missing.webp');
  pending.get('/art/missing.webp').fail('404');
  await assert.rejects(failure, /404/u);
  await assert.rejects(cache.preload('/art/missing.webp'), /404/u);
  assert.equal(cache.stats().requestCount, 2);
  assert.deepEqual(errors, [{ path: '/art/missing.webp', reason: '404' }]);
});

test('cache remains bounded while retaining the currently displayed asset', async () => {
  const pending = new Map();
  const cache = createImageAssetCache({ imageFactory: makeFactory(pending), maxEntries: 2 });
  cache.retain('/art/one.webp');
  for (const path of ['/art/one.webp', '/art/two.webp', '/art/three.webp']) {
    const load = cache.preload(path);
    pending.get(path).load();
    await load;
  }
  const stats = cache.stats();
  assert.ok(stats.size <= 2);
  assert.ok(stats.paths.includes('/art/one.webp'));
});

test('latest decoded target wins and stale completion cannot replace it', async () => {
  const pending = new Map();
  const cache = createImageAssetCache({ imageFactory: makeFactory(pending) });
  const container = makeContainer();
  const transition = createImageTransition({ container, cache, reducedMotion: () => true });

  const first = transition.show({ path: '/art/first.webp', key: 'first' });
  pending.get('/art/first.webp').load();
  await first;

  const second = transition.show({ path: '/art/second.webp', key: 'second' });
  const third = transition.show({ path: '/art/third.webp', key: 'third' });
  pending.get('/art/second.webp').load();
  assert.equal((await second).status, 'stale');
  pending.get('/art/third.webp').load();
  assert.equal((await third).status, 'committed');
  assert.equal(transition.getDisplayed().key, 'third');
  assert.equal(container.children.filter(node => node.classList.contains('literary-art-layer')).length, 1);
});
