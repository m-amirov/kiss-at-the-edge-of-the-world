import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';
import { nextLiteraryScene, compileScenePlayback } from '../../src/literary-engine.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { validateLiteraryInteractionLocale, validateLiteraryLocale } from '../../src/localization.js';

const episode7 = ['S27', 'S59', 'S28', 'S49', 'S29', 'S52', 'S30', 'S55', 'S31', 'S62'];
const episode8 = ['S32', 'S50', 'S33', 'S53', 'S34', 'S56', 'S35', 'S63'];
const expectedParagraphs = {
  S27: 15, S59: 11, S28: 17, S49: 13, S29: 12, S52: 15, S30: 16, S55: 14, S31: 12, S62: 8,
  S32: 18, S50: 9, S33: 15, S53: 9, S34: 17, S56: 9, S35: 6, S63: 7
};
const routePaths = {
  eric: ['S27', 'S59', 'S28', 'S49', 'S32', 'S50'],
  nick: ['S27', 'S59', 'S29', 'S52', 'S33', 'S53'],
  damir: ['S27', 'S59', 'S30', 'S55', 'S34', 'S56'],
  alice: ['S27', 'S59', 'S31', 'S62', 'S35', 'S63']
};
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const sceneMap = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const en = id => JSON.parse(fs.readFileSync(`content/localization/en/${id}.json`, 'utf8'));

function authoredChoiceIds(scene) {
  return scene.chunks.filter(chunk => chunk.title.startsWith('Выбор ')).map(chunk => chunk.title.match(/S\d{2}-C\d+/u)?.[0]).filter(Boolean);
}

function allAChoices() {
  const choices = { 'S26-C1': 'A' };
  for (const id of [...episode7, ...episode8]) {
    for (const choiceId of authoredChoiceIds(sceneMap.get(id))) choices[choiceId] = 'A';
  }
  return choices;
}

test('Episodes 7-8 use the exact canonical order and complete EN parity', () => {
  assert.deepEqual(literarySeason.sceneOrder['7'].map(id => `S${String(id).padStart(2, '0')}`), episode7);
  assert.deepEqual(literarySeason.sceneOrder['8'].map(id => `S${String(id).padStart(2, '0')}`), episode8);
  for (const sceneId of [...episode7, ...episode8]) {
    const source = sceneMap.get(sceneId);
    const localized = en(sceneId);
    assert.deepEqual(validateLiteraryLocale(literarySeason, localized, { sceneIds: [sceneId] }), { status: 'PASS', errors: [], sceneCount: 1 }, sceneId);
    assert.equal(Object.values(localized.scenes[sceneId].chunks).reduce((sum, chunk) => sum + Object.keys(chunk.paragraphs).length, 0), expectedParagraphs[sceneId], sceneId);
    assert.equal(authoredChoiceIds(source).length, Object.values(localized.scenes[sceneId].chunks).filter(chunk => chunk.title.startsWith('Choice ')).length, sceneId);
    source.chunks.forEach((chunk, index) => {
      const target = localized.scenes[sceneId].chunks[`${sceneId}.C${String(index).padStart(3, '0')}`];
      for (const token of chunk.title.match(/S\d{2}-C\d+|`[^`]+`/gu) ?? []) assert.ok(target.title.includes(token), `${sceneId} missing ${token}`);
    });
    const visible = [localized.scenes[sceneId].title, ...Object.values(localized.scenes[sceneId].chunks).flatMap(chunk => [chunk.title, ...Object.values(chunk.paragraphs)])].join('\n');
    assert.doesNotMatch(visible, /[\u0400-\u04ff]/u, `${sceneId} Cyrillic`);
    assert.doesNotMatch(visible, /\{\{|\}\}/u, `${sceneId} leaked markup`);
  }
});

test('Episodes 7-8 interaction localization covers every canonical beat', () => {
  const interactionSceneIds = [...episode7, ...episode8].filter(id => Object.hasOwn(interactionBeats, id));
  const localized = { interactionBeats: Object.fromEntries(interactionSceneIds.map(id => [id, JSON.parse(fs.readFileSync('content/localization/en/interaction-beats.json', 'utf8')).interactionBeats[id]])) };
  assert.deepEqual(validateLiteraryInteractionLocale(interactionBeats, localized, { sceneIds: interactionSceneIds }), { status: 'PASS', errors: [], sceneCount: interactionSceneIds.length });
  assert.deepEqual(interactionSceneIds, [...episode7, ...episode8]);
});

test('Four routeIntent paths remain stable across Episodes 7-8', () => {
  for (const [route, expected] of Object.entries(routePaths)) {
    const choices = allAChoices();
    choices['S26-C1'] = routeCodes[route];
    const actual = [];
    let sceneId = 'S27';
    for (let guard = 0; sceneId && guard < 10; guard += 1) {
      actual.push(sceneId);
      if (actual.length === expected.length) break;
      for (const choiceId of authoredChoiceIds(sceneMap.get(sceneId))) choices[choiceId] = 'A';
      sceneId = nextLiteraryScene(sceneId, choices);
    }
    assert.deepEqual(actual, expected, route);
    assert.equal(choices['S26-C1'], routeCodes[route]);
  }
});

test('Every authored branch in Episodes 7-8 has a distinct selected response', () => {
  for (const sceneId of [...episode7, ...episode8]) {
    const source = sceneMap.get(sceneId);
    for (const choiceId of authoredChoiceIds(source)) {
      const choiceIndex = source.chunks.findIndex(chunk => chunk.title.includes(choiceId));
      const options = [];
      for (let index = choiceIndex + 1; index < source.chunks.length; index += 1) {
        const title = source.chunks[index].title;
        if (title.startsWith('Выбор ') || title.startsWith('Общее продолжение') || title.startsWith('Если ')) break;
        if (title.match(/^[ABC]\.\s/u)) options.push(source.chunks[index]);
      }
      const codes = options.map(chunk => chunk.title[0]);
      if (codes.length < 2) continue;
      const rendered = codes.map(code => compileScenePlayback(source, { ...allAChoices(), [choiceId]: code }).filter(item => item.type === 'paragraph').map(item => item.text).join(' '));
      assert.equal(new Set(rendered).size, rendered.length, `${sceneId} ${choiceId}`);
    }
  }
});

test('Extra beat insertion and route-neutral continuation are machine-checkable', () => {
  const extraSceneIds = [...episode7, ...episode8];
  for (const sceneId of extraSceneIds) {
    const beatCount = interactionBeats[sceneId]?.length ?? 0;
    if (!beatCount) continue;
    const scene = sceneMap.get(sceneId);
    for (let index = 0; index < beatCount; index += 1) {
      const id = `${sceneId}-C${90 + index}`;
      for (const code of ['A', 'B']) {
        const flow = compileInteractivePlayback(scene, { ...allAChoices(), [id]: code }, 'en');
        const choice = flow.find(item => item.type === 'choice' && item.id === id);
        assert.equal(choice, undefined, `${id} should resolve`);
        const result = flow.find(item => item.decisionResult === id);
        assert.ok(result?.text, `${id} missing result`);
        const insertionIndex = flow.findIndex(item => item.decisionResult === id);
        assert.ok(insertionIndex > 0, `${id} insertion point`);
        assert.ok(flow[insertionIndex - 1].sourceStartRef, `${id} preceding source ref`);
        assert.ok(result.sourceStartRef, `${id} following source ref`);
        assert.doesNotMatch(result.text, /\{\{|\}\}|[\u0400-\u04ff]/u, `${id} EN result`);
      }
    }
  }
});
