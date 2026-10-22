import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlatformLifecycleController } from '../../src/platform/lifecycle.js';

function harness() {
  const media = [
    { paused: false, pauseCalls: 0, playCalls: 0, pause() { this.paused = true; this.pauseCalls += 1; }, play() { this.paused = false; this.playCalls += 1; } },
    { paused: true, pauseCalls: 0, playCalls: 0, pause() { this.paused = true; this.pauseCalls += 1; }, play() { this.paused = false; this.playCalls += 1; } }
  ];
  const app = { dataset: {}, attrs: new Map(), setAttribute(name, value) { this.attrs.set(name, value); }, removeAttribute(name) { this.attrs.delete(name); } };
  const document = { querySelectorAll() { return media; } };
  const activity = [];
  const lifecycle = createPlatformLifecycleController({
    app,
    document,
    setGameplayActive: active => activity.push(active),
    isGameplayActive: () => true,
    onPause: () => activity.push('pause'),
    onResume: () => activity.push('resume')
  });
  return { app, media, activity, lifecycle };
}

test('hide/blur/ad overlap pauses gameplay and audio once, then resumes once', async () => {
  const h = harness();
  h.lifecycle.pause('platform');
  h.lifecycle.pause('window');
  assert.deepEqual(h.lifecycle.getState(), { paused: true, reasons: ['platform', 'window'] });
  assert.equal(h.media[0].pauseCalls, 1);
  assert.equal(h.app.dataset.platformPaused, 'true');
  h.lifecycle.resume('platform');
  assert.equal(h.lifecycle.isPaused(), true);
  h.lifecycle.resume('window');
  await Promise.resolve();
  assert.equal(h.lifecycle.isPaused(), false);
  assert.equal(h.media[0].playCalls, 1);
  assert.deepEqual(h.activity, [false, 'pause', true, 'resume']);
  assert.equal(h.app.dataset.platformPaused, undefined);
  assert.equal(h.app.attrs.has('aria-busy'), false);
});

test('document visibility is an independent lifecycle reason', () => {
  const h = harness();
  h.lifecycle.setDocumentHidden(true);
  h.lifecycle.setDocumentHidden(false);
  assert.deepEqual(h.activity, [false, 'pause', true, 'resume']);
});
