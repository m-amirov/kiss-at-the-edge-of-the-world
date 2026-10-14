import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileScenePlayback, nextLiteraryScene } from '../../src/literary-engine.js';
import { literarySeason } from '../../src/literary-season-data.js';
import { createTranslator } from '../../src/localization.js';
import {
  completePendingEpisodeTransition,
  createEpisodeTransitionController,
  episodeBoundaryFor
} from '../../src/episode-interstitial.js';

const byId = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const root = fileURLToPath(new URL('../..', import.meta.url));

const expectedBoundaries = [
  ['S04', 'S05'],
  ['S66', 'S09'],
  ['S12', 'S13'],
  ['S16', 'S17'],
  ['S18', 'S22'],
  ['S26', 'S27'],
  ['S49', 'S32'],
  ['S50', 'S36'],
  ['S60', 'S41']
];

const routeSpecificTransitions = [
  ['S04', 'S05'], ['S66', 'S09'], ['S12', 'S13'], ['S16', 'S17'],
  ['S18', 'S22'], ['S19', 'S22'], ['S20', 'S22'], ['S61', 'S22'],
  ['S26', 'S27'],
  ['S49', 'S32'], ['S52', 'S33'], ['S55', 'S34'], ['S62', 'S35'],
  ['S50', 'S36'], ['S53', 'S36'], ['S56', 'S36'], ['S63', 'S36'],
  ['S60', 'S41']
];

function traverseRoute(route) {
  const choices = {};
  const boundaries = [];
  const visited = [];
  let sceneId = 'S01';
  while (sceneId) {
    const scene = byId.get(sceneId);
    assert.ok(scene, `unknown scene ${sceneId}`);
    visited.push(sceneId);
    let flow = compileScenePlayback(scene, choices);
    while (flow.at(-1)?.type === 'choice') {
      const choice = flow.at(-1);
      choices[choice.id] = choice.id === 'S17-C2' || choice.id === 'S26-C1'
        ? route
        : choice.options[0].code;
      flow = compileScenePlayback(scene, choices);
    }
    const next = nextLiteraryScene(sceneId, choices);
    if (!next) break;
    if (byId.get(next).episode > scene.episode) boundaries.push([sceneId, next]);
    sceneId = next;
  }
  return { boundaries, visited };
}

function makeController({ showFullscreenAd = () => Promise.resolve(false), initialScene = 'S04' } = {}) {
  let state = {
    schemaVersion: 3,
    sceneId: initialScene,
    position: 99,
    choices: { 'S01-C1': 'A', 'S17-C2': 'A', 'S26-C1': 'A' },
    visited: [initialScene],
    finished: false,
    pendingEpisodeTransition: null,
    revision: 7
  };
  const events = [];
  const controller = createEpisodeTransitionController({
    getState: () => state,
    setState: next => { state = next; },
    byId,
    persist: () => events.push({ type: 'persist', state: structuredClone(state) }),
    render: () => events.push({ type: 'render', state: structuredClone(state) }),
    showFullscreenAd: () => {
      events.push({ type: 'ad' });
      return showFullscreenAd();
    }
  });
  return { controller, events, get state() { return state; } };
}

test('all nine episode boundaries are explicit and only cross one episode', () => {
  assert.equal(expectedBoundaries.length, 9);
  for (const [from, to] of expectedBoundaries) {
    const boundary = episodeBoundaryFor(from, to, byId);
    assert.deepEqual(
      boundary && [boundary.fromSceneId, boundary.toSceneId, boundary.fromEpisode, boundary.toEpisode],
      [from, to, byId.get(from).episode, byId.get(to).episode]
    );
    assert.equal(boundary.toEpisode, boundary.fromEpisode + 1);
  }
  assert.equal(episodeBoundaryFor('S03', 'S04', byId), null);
  assert.equal(episodeBoundaryFor('S47', null, byId), null);
});

test('each of the four routes reaches nine interstitial boundaries without changing route choices', () => {
  for (const route of 'ABCD') {
    const result = traverseRoute(route);
    assert.equal(result.boundaries.length, 9, `${route} boundary count`);
    assert.equal(result.visited.at(-1), ({ A: 'S44', B: 'S45', C: 'S46', D: 'S47' })[route], `${route} final scene`);
    assert.deepEqual(result.boundaries.map(([, to]) => byId.get(to).episode), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }
});

test('all route-specific alternatives use the same nine-boundary interstitial contract', async () => {
  const traversed = new Set();
  for (const route of 'ABCD') {
    for (const [from, to] of traverseRoute(route).boundaries) traversed.add(`${from}->${to}`);
  }
  assert.deepEqual(
    [...traversed].sort(),
    routeSpecificTransitions.map(([from, to]) => `${from}->${to}`).sort()
  );

  for (const [from, to] of routeSpecificTransitions) {
    const h = makeController({ initialScene: from });
    const choicesBefore = structuredClone(h.state.choices);
    assert.equal(h.controller.start(to), true, `${from}->${to} starts`);
    assert.equal(h.state.pendingEpisodeTransition.toSceneId, to, `${from}->${to} persists pending state`);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.sceneId, to, `${from}->${to} resumes`);
    assert.equal(h.state.pendingEpisodeTransition, null, `${from}->${to} clears pending state`);
    assert.deepEqual(h.state.choices, choicesBefore, `${from}->${to} preserves route choices`);
    assert.equal(h.events.filter(event => event.type === 'ad').length, 1, `${from}->${to} calls one ad`);
  }
});

test('RU and EN use the existing terminal action pattern with localized next-episode labels', () => {
  assert.equal(createTranslator('ru')('nextEpisode', { episode: 2 }), 'Следующий эпизод → 2');
  assert.equal(createTranslator('en')('nextEpisode', { episode: 2 }), 'Next episode → 2');
});

test('transition persists before the ad call, guards double click, and continues after any ad result', async () => {
  let closeAd;
  const h = makeController({
    showFullscreenAd: () => new Promise(resolve => { closeAd = resolve; })
  });
  assert.equal(h.controller.start('S05'), true);
  assert.deepEqual(h.events.map(event => event.type), ['persist', 'ad']);
  assert.deepEqual(h.state.pendingEpisodeTransition, {
    fromSceneId: 'S04', toSceneId: 'S05', fromEpisode: 1, toEpisode: 2
  });
  assert.equal(h.controller.start('S05'), false);
  closeAd(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.sceneId, 'S05');
  assert.equal(h.state.position, 0);
  assert.equal(h.state.pendingEpisodeTransition, null);
  assert.equal(h.state.choices['S26-C1'], 'A');
  assert.equal(h.events.at(-1).type, 'render');
});

test('pending transition recovery is idempotent after a tab close or reload', () => {
  const h = makeController();
  assert.equal(h.controller.start('S05'), true);
  const pending = structuredClone(h.state);
  const recovered = completePendingEpisodeTransition(pending, byId);
  assert.equal(recovered.changed, true);
  assert.equal(recovered.state.sceneId, 'S05');
  assert.equal(recovered.state.pendingEpisodeTransition, null);
  const second = completePendingEpisodeTransition(recovered.state, byId);
  assert.equal(second.changed, false);
  assert.equal(second.state.sceneId, 'S05');
});

test('a same-episode scene and a final ending never request an interstitial', () => {
  const h = makeController({ showFullscreenAd: () => { throw new Error('must not call'); } });
  assert.equal(h.controller.start('S04'), false);
  assert.equal(h.controller.start(null), false);
});

test('legacy season restart keeps its existing fullscreen ad call', () => {
  const legacyMain = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.match(legacyMain, /resetGame\(\{ showAd: true \}\)/);
  assert.match(legacyMain, /if \(showAd\) await platform\.showFullscreenAd\?\.\(\);/);
});
