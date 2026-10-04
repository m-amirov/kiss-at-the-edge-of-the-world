import assert from 'node:assert/strict';
import test from 'node:test';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';
import { nextLiteraryScene } from '../../src/literary-engine.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';

const episode10 = ['S41', 'S42', 'S43', 'S44', 'S45', 'S46', 'S47', 'S48'];
const sceneMap = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const statusChoice = { eric: 'S32-C1', nick: 'S33-C1', damir: 'S34-C1' };
const allAuthoredChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/^Выбор (S\d{2}-C\d+)/u)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const stateFor = (route, status = 'active', overrides = {}) => ({
  ...allAuthoredChoices,
  'S26-C1': routeCodes[route],
  ...(statusChoice[route] ? { [statusChoice[route]]: status === 'active' ? 'A' : status === 'paused' ? 'B' : 'C' } : {}),
  ...overrides
});
const endingFor = (route, status, finalChoice = 'A') => {
  const choices = stateFor(route, status, { 'S42-C1': finalChoice });
  let scene = 'S41';
  const path = [];
  for (let guard = 0; scene && guard < 8; guard += 1) { path.push(scene); scene = nextLiteraryScene(scene, choices); }
  return { path, ending: path.at(-1) };
};

test('Episode 10 uses the exact canonical scene order and all C90 beats resolve in English', () => {
  assert.deepEqual(literarySeason.sceneOrder['10'].map(id => `S${String(id).padStart(2, '0')}`), episode10);
  for (const sceneId of episode10) {
    assert.equal(interactionBeats[sceneId]?.length, 1, `${sceneId} C90 source beat`);
    for (const code of ['A', 'B']) {
      const flow = compileInteractivePlayback(sceneMap.get(sceneId), { ...stateFor('eric'), [`${sceneId}-C90`]: code }, 'en');
      const index = flow.findIndex(entry => entry.decisionResult === `${sceneId}-C90`);
      assert.ok(index > 0, `${sceneId}-C90 result position`);
      assert.ok(flow[index - 1].sourceStartRef, `${sceneId}-C90 preceding source`);
      assert.deepEqual(flow[index].sourceStartRef, flow[index].sourceEndRef, `${sceneId}-C90 stable insertion ref`);
      assert.doesNotMatch(flow[index].text, /\{\{|\}\}|[\u0400-\u04ff]|active route|routeStatus|routeIntent/iu, `${sceneId}-C90 visible EN`);
    }
  }
});

test('Episode 10 ending graph preserves route, pause, closure, and Alice completion', () => {
  for (const route of ['eric', 'nick', 'damir']) {
    const expected = { eric: 'S44', nick: 'S45', damir: 'S46' }[route];
    assert.deepEqual(endingFor(route, 'active', 'A').ending, expected, `${route} active`);
    assert.deepEqual(endingFor(route, 'paused', 'A').ending, expected, `${route} paused then continue`);
    assert.deepEqual(endingFor(route, 'active', 'B').ending, 'S47', `${route} paused at final choice`);
    assert.deepEqual(endingFor(route, 'active', 'C').ending, 'S47', `${route} closed at final choice`);
    assert.deepEqual(endingFor(route, 'closed', 'A').ending, 'S47', `${route} closed remains closed`);
  }
  const alice = endingFor('alice', 'active');
  assert.deepEqual(alice.path, ['S41', 'S43', 'S48', 'S47']);
  assert.equal(alice.ending, 'S47');
});
