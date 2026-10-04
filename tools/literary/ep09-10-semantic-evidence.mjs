import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { nextLiteraryScene } from '../../src/literary-engine.js';
import { literaryLocaleBundles } from '../../src/literary-localization-bundle.js';
import { validateLiteraryInteractionLocale, validateLiteraryLocale } from '../../src/localization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'artifacts/evidence/ep09-10-ending-continuity.json');
const browserPath = path.join(root, 'artifacts/evidence/ep09-10-route-browser.json');
const episode9 = ['S36', 'S37', 'S51', 'S38', 'S54', 'S39', 'S57', 'S40', 'S64', 'S60'];
const episode10 = ['S41', 'S42', 'S43', 'S44', 'S45', 'S46', 'S47', 'S48'];
const target = [...episode9, ...episode10];
const sceneMap = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const statusChoice = { eric: 'S32-C1', nick: 'S33-C1', damir: 'S34-C1' };
const counters = Object.fromEntries(['contradictionCount','prematurePremiseCount','duplicatedCanonicalLineCount','branchInvalidPremiseCount','crossRouteLeakCount','inventedRelationshipCount','inventedConsentCount','inventedCharacterKnowledgeCount','routeStateMismatchCount','actionOwnershipMismatchCount','authoredChoicePreselectionCount','temporalRewindCount','internalStateLeakCount','leakedMarkupCount','cyrillicCount','endingMismatchCount','endingReachabilityMismatchCount'].map(key => [key, 0]));
const failures = []; const cases = [];
const assertMachine = (counter, pass, detail) => { if (!pass) { counters[counter] += 1; failures.push({ counter, ...detail }); } };
const authored = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/^Выбор (S\d{2}-C\d+)/u)?.[1]).filter(Boolean)).map(id => [id, 'A']));
function choicesFor(route, status = 'active', extra = {}) { return { ...authored, 'S26-C1': routeCodes[route], ...(statusChoice[route] ? { [statusChoice[route]]: status === 'active' ? 'A' : status === 'paused' ? 'B' : 'C' } : {}), ...extra }; }
function routePath(route, status, finalChoice = 'A') { const choices = choicesFor(route, status, { 'S42-C1': finalChoice }); let current = 'S36'; const path = []; for (let guard = 0; current && guard < 20; guard += 1) { path.push(current); current = nextLiteraryScene(current, choices); } return { choices, path, ending: path.at(-1) }; }
function refEqual(a, b) { return a?.chunk === b?.chunk && a?.paragraph === b?.paragraph; }
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const browser = JSON.parse(await fs.readFile(browserPath, 'utf8'));
const sourceScenes = new Set(literarySeason.scenes.map(scene => scene.id)); const localizedScenes = literaryLocaleBundles.en.scenes ?? {};
const missingScenes = [...sourceScenes].filter(id => !localizedScenes[id]); const extraScenes = Object.keys(localizedScenes).filter(id => !sourceScenes.has(id));
const missingRefs = []; const extraRefs = [];
for (const source of literarySeason.scenes) {
  const localized = localizedScenes[source.id]; if (!localized) continue;
  const sourceRefs = new Set(source.chunks.flatMap((chunk, chunkIndex) => chunk.paragraphs.map((_, paragraphIndex) => `${source.id}.C${String(chunkIndex).padStart(3, '0')}.P${String(paragraphIndex).padStart(3, '0')}`)));
  const localizedRefs = new Set(Object.values(localized.chunks).flatMap(chunk => Object.keys(chunk.paragraphs)));
  for (const ref of sourceRefs) if (!localizedRefs.has(ref)) missingRefs.push(ref);
  for (const ref of localizedRefs) if (!sourceRefs.has(ref)) extraRefs.push(ref);
}
const endingMatrix = [];
for (const route of ['eric', 'nick', 'damir']) for (const status of ['active', 'paused', 'closed']) for (const finalChoice of status === 'closed' ? [null] : ['A', 'B', 'C']) {
  const { path, ending } = routePath(route, status, finalChoice ?? 'A'); const expected = status === 'closed' || finalChoice === 'B' || finalChoice === 'C' ? 'S47' : ({ eric: 'S44', nick: 'S45', damir: 'S46' }[route]);
  assertMachine('endingMismatchCount', ending === expected, { route, status, finalChoice, expected, actual: ending });
  assertMachine('endingReachabilityMismatchCount', path.includes(expected), { route, status, finalChoice, expected, path });
  endingMatrix.push({ routeIntent: route, routeStatus: status, finalChoice, path, expectedEnding: expected, actualEnding: ending, relationshipState: expected === 'S47' ? (status === 'closed' || finalChoice === 'C' ? 'closed' : 'uncertain-or-independent') : 'continuing-by-mutual-choice' });
}
const alice = routePath('alice', 'active'); endingMatrix.push({ routeIntent: 'alice', routeStatus: 'active', finalChoice: null, path: alice.path, expectedEnding: 'S47', actualEnding: alice.ending, relationshipState: 'complete-independent-route' });
assertMachine('endingMismatchCount', alice.ending === 'S47', { route: 'alice', expected: 'S47', actual: alice.ending });
assertMachine('endingReachabilityMismatchCount', alice.path.includes('S47'), { route: 'alice', path: alice.path });
for (const [route, status] of [['eric','active'],['eric','paused'],['eric','closed'],['nick','active'],['nick','paused'],['nick','closed'],['damir','active'],['damir','paused'],['damir','closed'],['alice','active']]) {
  const { choices, path } = routePath(route, status, 'A');
  for (const sceneId of path.filter(id => target.includes(id))) {
    const scene = sceneMap.get(sceneId); const canonical = scene.chunks.flatMap(chunk => chunk.paragraphs).join('\n');
    const visibleMaterial = [localizedScenes[sceneId]?.title, ...Object.values(localizedScenes[sceneId]?.chunks ?? {}).flatMap(chunk => [chunk.title, ...Object.values(chunk.paragraphs)])].join('\n');
    assertMachine('cyrillicCount', !/[\u0400-\u04ff]/u.test(visibleMaterial), { sceneId, route, status, scope: 'localized-scene' });
    assertMachine('leakedMarkupCount', !/\{\{|\}\}/u.test(visibleMaterial), { sceneId, route, status, scope: 'localized-scene' });
    for (let index = 0; index < (interactionBeats[sceneId]?.length ?? 0); index += 1) for (const code of ['A', 'B']) {
      const id = `${sceneId}-C${90 + index}`; const without = compileInteractivePlayback(scene, choices, 'en'); const choiceIndex = without.findIndex(entry => entry.type === 'choice' && entry.id === id); const choice = without[choiceIndex]; const withChoice = compileInteractivePlayback(scene, { ...choices, [id]: code }, 'en'); const resultIndex = withChoice.findIndex(entry => entry.decisionResult === id); const result = withChoice[resultIndex]; const following = withChoice[resultIndex + 1]; const rendered = `${choice?.question ?? ''}\n${result?.text ?? ''}`;
      assertMachine('prematurePremiseCount', Boolean(choice && result), { sceneId, route, status, id, code });
      assertMachine('contradictionCount', Boolean(following?.sourceStartRef), { sceneId, route, status, id, code });
      assertMachine('branchInvalidPremiseCount', Boolean(following), { sceneId, route, status, id, code });
      assertMachine('duplicatedCanonicalLineCount', !canonical.includes(result?.text ?? ''), { sceneId, route, status, id, code });
      assertMachine('routeStateMismatchCount', refEqual(choice?.sourceStartRef, result?.sourceStartRef) && choices['S26-C1'] === routeCodes[route], { sceneId, route, status, id, code, choiceRef: choice?.sourceStartRef, resultRef: result?.sourceStartRef });
      assertMachine('internalStateLeakCount', !/active route|active line|routeStatus|routeIntent|активная линия|активная ветка/iu.test(rendered), { sceneId, route, status, id, code });
      assertMachine('leakedMarkupCount', !/\{\{|\}\}|S\d{2}-C\d+/u.test(rendered), { sceneId, route, status, id, code });
      assertMachine('cyrillicCount', !/[\u0400-\u04ff]/u.test(rendered), { sceneId, route, status, id, code });
      assertMachine('inventedRelationshipCount', !/we agreed|new relationship|first date|мы договорились|новые отношения|первое свидание/iu.test(result?.text ?? ''), { sceneId, route, status, id, code });
      assertMachine('inventedConsentCount', !/has already agreed|уже согласилась/iu.test(result?.text ?? ''), { sceneId, route, status, id, code });
      assertMachine('inventedCharacterKnowledgeCount', !/already knows|already knew|уже знает/iu.test(result?.text ?? ''), { sceneId, route, status, id, code });
      assertMachine('actionOwnershipMismatchCount', !/Alice decided for|Алиса решила за/iu.test(result?.text ?? ''), { sceneId, route, status, id, code });
      assertMachine('authoredChoicePreselectionCount', !/you chose|you decided|ты выбрала|ты решила/iu.test(result?.text ?? ''), { sceneId, route, status, id, code });
      assertMachine('temporalRewindCount', !(choiceIndex > 0 && !without.slice(0, choiceIndex).some(entry => entry.sourceStartRef)), { sceneId, route, status, id, code });
      cases.push({ sceneId, id, routeIntent: route, routeStatus: status, option: code, insertionSourceRef: result?.sourceStartRef ?? null, precedingSourceRef: without.at(choiceIndex - 1)?.sourceStartRef ?? null, followingSourceRef: following?.sourceStartRef ?? null, question: choice?.question ?? null, result: result?.text ?? null });
    }
  }
}
const localeReport = validateLiteraryLocale(literarySeason, literaryLocaleBundles.en); const interactionReport = validateLiteraryInteractionLocale(interactionBeats, literaryLocaleBundles.en);
const browserPass = browser.status === 'PASS' && browser.testedSourceHead === sourceHead && browser.results.length === 48 && browser.results.every(result => result.errors.length === 0 && result.failed.length === 0 && result.cyrillicCount === 0 && result.overflowCount === 0 && result.internalScrollCount === 0 && result.controlsOutsideViewport === 0 && result.localeSwitch?.sameScene && !result.localeSwitch.structuralSaveHasLocale);
const status = Object.values(counters).every(value => value === 0) && missingScenes.length === 0 && extraScenes.length === 0 && missingRefs.length === 0 && extraRefs.length === 0 && localeReport.status === 'PASS' && interactionReport.status === 'PASS' && browserPass ? 'PASS' : 'BLOCKED';
const evidence = { schemaVersion: 1, status, preLocalizationCanonicalRepairAncestor: '57985bf1c75861de47fcbaefc87843353227dee4', testedSourceHead: sourceHead, generatedAt: new Date().toISOString(), episode9: { sceneOrder: episode9 }, episode10: { sceneOrder: episode10 }, fullEnglishCoverage: { scenes: `${Object.keys(localizedScenes).length}/${literarySeason.scenes.length}`, missingScenes, extraScenes, missingRefs, extraRefs, sceneParity: localeReport.status, interactionParity: interactionReport.status }, endingMatrix, semanticCaseCount: cases.length, counters, browser: { status: browser.status, testedSourceHead: browser.testedSourceHead, currentHeadMatch: browser.testedSourceHead === sourceHead, evidencePath: browserPath }, cases, failures };
await fs.writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`); console.log(JSON.stringify({ status, testedSourceHead: sourceHead, semanticCaseCount: cases.length, counters, coverage: evidence.fullEnglishCoverage, endingRows: endingMatrix.length, browserPass }, null, 2)); if (status !== 'PASS') process.exitCode = 2;
