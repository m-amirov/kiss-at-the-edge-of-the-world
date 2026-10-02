import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { literaryLocaleBundles } from '../../src/literary-localization-bundle.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';
import { applyLiteraryLocale, validateLiteraryInteractionLocale, validateLiteraryLocale } from '../../src/localization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const englishFiles = fs.readdirSync(path.join(root, 'content/localization/en'))
  .filter(file => /^S\d{2}\.json$/u.test(file))
  .sort();
const mergedEnglish = { schemaVersion: 1, locale: 'en', scenes: {} };
for (const file of englishFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'content/localization/en', file), 'utf8'));
  Object.assign(mergedEnglish.scenes, data.scenes);
}
const interactionData = JSON.parse(fs.readFileSync(path.join(root, 'content/localization/en/interaction-beats.json'), 'utf8'));
mergedEnglish.interactionBeats = interactionData.interactionBeats;
mergedEnglish.interactionEchoes = interactionData.interactionEchoes;

test('generated English runtime bundle matches every available scene file', () => {
  assert.deepEqual(literaryLocaleBundles.en, mergedEnglish);
});

test('bounded local QA applies the available contiguous English corpus without an episode-number limit', () => {
  const firstMissing = literarySeason.scenes.findIndex(scene => !literaryLocaleBundles.en.scenes?.[scene.id]);
  const sceneIds = literarySeason.scenes.slice(0, firstMissing < 0 ? literarySeason.scenes.length : firstMissing).map(scene => scene.id);
  const scoped = {
    ...literaryLocaleBundles.en,
    scenes: Object.fromEntries(sceneIds.map(id => [id, literaryLocaleBundles.en.scenes[id]])),
    interactionBeats: Object.fromEntries(sceneIds.map(id => [id, literaryLocaleBundles.en.interactionBeats[id]])),
    interactionEchoes: Object.fromEntries(Object.entries(literaryLocaleBundles.en.interactionEchoes).filter(([id]) => sceneIds.includes(id)))
  };
  const runtime = applyLiteraryLocale(literarySeason, scoped, { sceneIds });
  assert.deepEqual(runtime.scenes.map(scene => scene.id), sceneIds);
  assert.equal(runtime.sceneOrder, literarySeason.sceneOrder);
  assert.equal(runtime.episodes, literarySeason.episodes);
  assert.equal(validateLiteraryLocale(literarySeason, scoped, { sceneIds }).status, 'PASS');
  const interactionSceneIds = sceneIds.filter(id => Object.prototype.hasOwnProperty.call(interactionBeats, id));
  assert.equal(validateLiteraryInteractionLocale(interactionBeats, scoped, { sceneIds: interactionSceneIds }).status, 'PASS');
  assert.ok(sceneIds.includes('S09'));
  assert.ok(sceneIds.includes('S16'));
  const visible = runtime.scenes.flatMap(scene => [scene.title, ...scene.chunks.flatMap(chunk => [chunk.localizedTitle ?? chunk.title, ...chunk.paragraphs])]).join('\n');
  assert.doesNotMatch(visible, /[\u0400-\u04ff]/u);
});

test('production English remains fail-closed until the declared corpus is complete', () => {
  assert.throws(() => applyLiteraryLocale(literarySeason, literaryLocaleBundles.en), /BLOCKED_EN_CORPUS_INCOMPLETE/);
});

test('locale switching keeps structural save data locale-independent', () => {
  const state = { schemaVersion: 3, sceneId: 'S05', position: 4, choices: { 'S05-C1': 'A' }, finished: false, visited: ['S01', 'S05'], runId: 'qa', revision: 2 };
  const ru = JSON.stringify(state);
  const en = JSON.stringify({ ...state });
  assert.equal(en, ru);
  assert.equal('locale' in state, false);
  assert.equal('sceneId' in state && 'position' in state && 'choices' in state, true);
});
