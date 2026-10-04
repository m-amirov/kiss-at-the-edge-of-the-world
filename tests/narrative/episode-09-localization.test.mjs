import assert from 'node:assert/strict';
import test from 'node:test';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';
import { nextLiteraryScene } from '../../src/literary-engine.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';

const episode9 = ['S36', 'S37', 'S51', 'S38', 'S54', 'S39', 'S57', 'S40', 'S64', 'S60'];
const sceneMap = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const allAuthoredChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/^Выбор (S\d{2}-C\d+)/u)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const stateFor = (route, routeStatus = 'active', overrides = {}) => ({
  ...allAuthoredChoices,
  'S26-C1': routeCodes[route],
  ...(route === 'eric' ? { 'S32-C1': routeStatus === 'active' ? 'A' : routeStatus === 'paused' ? 'B' : 'C' } : {}),
  ...(route === 'nick' ? { 'S33-C1': routeStatus === 'active' ? 'A' : routeStatus === 'paused' ? 'B' : 'C' } : {}),
  ...(route === 'damir' ? { 'S34-C1': routeStatus === 'active' ? 'A' : routeStatus === 'paused' ? 'B' : 'C' } : {}),
  ...overrides
});

test('Episode 9 uses the exact canonical scene order and its 10 C90 beats resolve in English', () => {
  assert.deepEqual(literarySeason.sceneOrder['9'].map(id => `S${String(id).padStart(2, '0')}`), episode9);
  for (const sceneId of episode9) {
    const scene = sceneMap.get(sceneId);
    assert.equal(interactionBeats[sceneId]?.length, 1, `${sceneId} C90 source beat`);
    for (const code of ['A', 'B']) {
      const flow = compileInteractivePlayback(scene, { ...stateFor('eric'), [`${sceneId}-C90`]: code }, 'en');
      const index = flow.findIndex(entry => entry.decisionResult === `${sceneId}-C90`);
      assert.ok(index > 0, `${sceneId}-C90 result position`);
      assert.ok(flow[index - 1].sourceStartRef, `${sceneId}-C90 preceding source`);
      assert.deepEqual(flow[index].sourceStartRef, flow[index].sourceEndRef, `${sceneId}-C90 stable insertion ref`);
      assert.doesNotMatch(flow[index].text, /\{\{|\}\}|[\u0400-\u04ff]|active route|routeStatus|routeIntent/iu, `${sceneId}-C90 visible EN`);
    }
  }
});

test('Episode 9 preserves route intent and never substitutes another route or a fallback', () => {
  assert.equal(nextLiteraryScene('S36', stateFor('eric')), 'S37');
  assert.equal(nextLiteraryScene('S36', stateFor('nick')), 'S38');
  assert.equal(nextLiteraryScene('S36', stateFor('damir')), 'S39');
  assert.equal(nextLiteraryScene('S36', stateFor('alice')), 'S40');
  assert.equal(nextLiteraryScene('S36', stateFor('eric', 'closed')), 'S40');
  assert.equal(nextLiteraryScene('S36', stateFor('nick', 'closed')), 'S40');
  assert.equal(nextLiteraryScene('S36', stateFor('damir', 'closed')), 'S40');
  assert.equal(nextLiteraryScene('S37', stateFor('eric', 'active', { 'S37-C1': 'A' })), 'S51');
  assert.equal(nextLiteraryScene('S38', stateFor('nick', 'active', { 'S38-C1': 'A' })), 'S54');
  assert.equal(nextLiteraryScene('S39', stateFor('damir', 'active', { 'S39-C1': 'A' })), 'S57');
  assert.equal(nextLiteraryScene('S37', stateFor('eric', 'active', { 'S37-C1': 'B' })), 'S40');
  assert.equal(nextLiteraryScene('S38', stateFor('nick', 'active', { 'S38-C1': 'B' })), 'S40');
  assert.equal(nextLiteraryScene('S39', stateFor('damir', 'active', { 'S39-C1': 'B' })), 'S40');
  for (const route of Object.keys(routeCodes)) assert.equal(nextLiteraryScene('S60', stateFor(route)), 'S41', route);
});
