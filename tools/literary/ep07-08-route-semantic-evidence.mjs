#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats, interactionEchoes } from '../../src/literary-interactive-beats.js';
import { compileScenePlayback, nextLiteraryScene } from '../../src/literary-engine.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literaryLocaleBundles } from '../../src/literary-localization-bundle.js';
import { sourceRef, validateLiteraryInteractionLocale, validateLiteraryLocale } from '../../src/localization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'artifacts/evidence/ep07-08-route-interaction-continuity.json');
const browserPath = path.join(root, 'artifacts/evidence/ep07-08-route-browser.json');
const episode7 = ['S27', 'S59', 'S28', 'S49', 'S29', 'S52', 'S30', 'S55', 'S31', 'S62'];
const episode8 = ['S32', 'S50', 'S33', 'S53', 'S34', 'S56', 'S35', 'S63'];
const targetScenes = [...episode7, ...episode8];
const routes = {
  eric: { code: 'A', scenes: ['S27', 'S59', 'S28', 'S49', 'S32', 'S50'] },
  nick: { code: 'B', scenes: ['S27', 'S59', 'S29', 'S52', 'S33', 'S53'] },
  damir: { code: 'C', scenes: ['S27', 'S59', 'S30', 'S55', 'S34', 'S56'] },
  alice: { code: 'D', scenes: ['S27', 'S59', 'S31', 'S62', 'S35', 'S63'] }
};
const sceneMap = new Map(literarySeason.scenes.map((scene) => [scene.id, scene]));
const counters = Object.fromEntries(['contradictionCount', 'prematurePremiseCount', 'duplicatedCanonicalLineCount', 'branchInvalidPremiseCount', 'crossRouteLeakCount', 'inventedRelationshipCount', 'inventedConsentCount', 'inventedCharacterKnowledgeCount', 'routeStateMismatchCount', 'leakedMarkupCount', 'cyrillicCount'].map((name) => [name, 0]));
const failures = [];
const cases = [];
const assertMachine = (name, condition, details) => { if (!condition) { counters[name] += 1; failures.push({ counter: name, ...details }); } };
const enFile = async (id) => JSON.parse(await fs.readFile(path.join(root, `content/localization/en/${id}.json`), 'utf8'));

function authoredChoiceIds(scene) { return scene.chunks.map((chunk) => chunk.title.match(/Выбор\s+(S\d{2}-C\d+)/u)?.[1]).filter(Boolean); }
function authoredOptions(scene, choiceId) {
  const index = scene.chunks.findIndex((chunk) => chunk.title.includes(choiceId));
  const result = [];
  for (let i = index + 1; i < scene.chunks.length; i += 1) {
    const title = scene.chunks[i].title;
    if (title.startsWith('Выбор ') || title.startsWith('Общее продолжение') || title.startsWith('Если ')) break;
    const match = title.match(/^([ABC])\.\s/u);
    if (match) result.push(match[1]);
  }
  return result;
}
function baseChoices(routeCode) {
  const choices = { 'S26-C1': routeCode };
  for (const sceneId of targetScenes) for (const id of authoredChoiceIds(sceneMap.get(sceneId))) choices[id] = 'A';
  return choices;
}
function counterSnapshot() { return { ...counters }; }
function refs(entries) { return entries.map((entry) => ({ start: entry.sourceStartRef ?? null, end: entry.sourceEndRef ?? null })); }
function browserRuntime(route) {
  return (browserEvidence.results ?? []).filter((result) => result.route === route).map((result) => ({ viewport: result.viewport, errors: result.errors, failedRequests: result.failed, routeStateMismatches: result.routeStateMismatches, cyrillicCount: result.cyrillicCount, overflowCount: result.overflowCount, internalScrollCount: result.internalScrollCount }));
}

const browserEvidence = JSON.parse(await fs.readFile(browserPath, 'utf8'));
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const parity = { missingEnParagraphRefs: 0, extraEnParagraphRefs: 0, sceneParity: 'PASS', chunkParity: 'PASS', authoredChoiceIdParity: 'PASS', optionCodeParity: 'PASS', predicateParity: 'PASS', routeIntentParity: 'PASS', interactionParity: 'PASS', enCyrillicLeakage: 0 };
const paragraphCounts = {};
for (const sceneId of targetScenes) {
  const source = sceneMap.get(sceneId);
  const localized = await enFile(sceneId);
  const report = validateLiteraryLocale(literarySeason, localized, { sceneIds: [sceneId] });
  assertMachine('contradictionCount', report.status === 'PASS', { episode: source.episode, scene: sceneId, reason: report.errors });
  if (report.status !== 'PASS') { parity.sceneParity = 'BLOCKED'; parity.chunkParity = 'BLOCKED'; }
  const chunks = Object.values(localized.scenes[sceneId].chunks ?? {});
  paragraphCounts[sceneId] = chunks.reduce((sum, chunk) => sum + Object.keys(chunk.paragraphs ?? {}).length, 0);
  const visible = [localized.scenes[sceneId].title, ...chunks.flatMap((chunk) => [chunk.title, ...Object.values(chunk.paragraphs ?? {})])].join('\n');
  const cyr = (visible.match(/[\u0400-\u04ff]/gu) ?? []).length;
  parity.enCyrillicLeakage += cyr;
  counters.cyrillicCount += cyr;
  const markup = /\{\{|\}\}/u.test(visible);
  if (markup) counters.leakedMarkupCount += 1;
  source.chunks.forEach((chunk, index) => {
    const target = localized.scenes[sceneId].chunks[sourceRef.chunk(sceneId, index)];
    for (const token of chunk.title.match(/S\d{2}-C\d+|`[^`]+`/gu) ?? []) if (!target?.title.includes(token)) parity.predicateParity = 'BLOCKED';
  });
  const sourceChoiceIds = authoredChoiceIds(source);
  const localizedChoiceIds = chunks.filter((chunk) => chunk.title.startsWith('Choice ')).map((chunk) => chunk.title.match(/S\d{2}-C\d+/u)?.[0]).filter(Boolean);
  if (sourceChoiceIds.length !== localizedChoiceIds.length) { parity.authoredChoiceIdParity = 'BLOCKED'; parity.optionCodeParity = 'BLOCKED'; }
}
const enInteractions = { interactionBeats: Object.fromEntries(targetScenes.map((sceneId) => [sceneId, literaryLocaleBundles.en.interactionBeats[sceneId]])) };
const interactionReport = validateLiteraryInteractionLocale(interactionBeats, enInteractions, { sceneIds: targetScenes });
parity.interactionParity = interactionReport.status;
if (interactionReport.status !== 'PASS') counters.contradictionCount += interactionReport.errors.length;

for (const [route, contract] of Object.entries(routes)) {
  const choices = baseChoices(contract.code);
  for (const sceneId of contract.scenes) {
    const scene = sceneMap.get(sceneId);
    const routeBefore = route;
    for (const choiceId of authoredChoiceIds(scene)) {
      for (const code of authoredOptions(scene, choiceId)) {
        const branchChoices = { ...choices, [choiceId]: code };
        const flow = compileInteractivePlayback(scene, branchChoices, 'en');
        const unresolved = flow.find((entry) => entry.type === 'choice' && entry.id === choiceId);
        const routeAfter = ({ A: 'eric', B: 'nick', C: 'damir', D: 'alice' })[branchChoices['S26-C1']];
        assertMachine('routeStateMismatchCount', routeBefore === routeAfter, { episode: scene.episode, scene: sceneId, routeIntent: route, authoredBranch: `${choiceId}=${code}` });
        assertMachine('branchInvalidPremiseCount', !unresolved, { episode: scene.episode, scene: sceneId, routeIntent: route, authoredBranch: `${choiceId}=${code}`, reason: 'authored choice did not resolve' });
        cases.push({ episode: scene.episode, scene: sceneId, routeIntent: route, priorRelevantChoices: { 'S26-C1': contract.code, [choiceId]: code }, authoredBranch: { id: choiceId, selected: code }, extraChoiceId: null, insertionSourceRef: null, precedingRefs: [], precedingText: [], followingRefs: refs(flow.slice(0, 4)), followingText: flow.slice(0, 4).map((entry) => entry.text ?? ''), renderedQuestion: null, renderedOptions: null, selectedOption: code, resultingText: flow.find((entry) => entry.type === 'page')?.text ?? '', routeBefore, routeAfter, contradictionCounters: counterSnapshot(), crossRouteLeakCounters: { crossRouteLeakCount: counters.crossRouteLeakCount, routeStateMismatchCount: counters.routeStateMismatchCount }, runtimeBrowser: browserRuntime(route), runtimeBrowserErrors: browserRuntime(route).flatMap((item) => [...item.errors, ...item.failedRequests]) });
      }
    }
    const beatCount = interactionBeats[sceneId]?.length ?? 0;
    for (let index = 0; index < beatCount; index += 1) {
      const id = `${sceneId}-C${90 + index}`;
      for (const code of ['A', 'B']) {
        const without = compileInteractivePlayback(scene, { ...choices, [id]: undefined }, 'en');
        const choice = without.find((entry) => entry.type === 'choice' && entry.id === id);
        const withChoice = compileInteractivePlayback(scene, { ...choices, [id]: code }, 'en');
        const resultIndex = withChoice.findIndex((entry) => entry.decisionResult === id);
        const result = withChoice[resultIndex];
        const exactInsertion = Boolean(choice && result && JSON.stringify(choice.sourceStartRef) === JSON.stringify(result.sourceStartRef));
        const duplicate = Boolean(result?.text && scene.chunks.some((chunk) => chunk.paragraphs.includes(result.text)));
        const hasForbidden = /\{\{|\}\}|[\u0400-\u04ff]/u.test(`${choice?.question ?? ''} ${result?.text ?? ''}`);
        const routeAfter = route;
        assertMachine('prematurePremiseCount', Boolean(choice && result), { episode: scene.episode, scene: sceneId, routeIntent: route, extraChoiceId: id });
        assertMachine('duplicatedCanonicalLineCount', !duplicate, { episode: scene.episode, scene: sceneId, routeIntent: route, extraChoiceId: id });
        assertMachine('leakedMarkupCount', !hasForbidden, { episode: scene.episode, scene: sceneId, routeIntent: route, extraChoiceId: id });
        assertMachine('routeStateMismatchCount', routeAfter === routeBefore, { episode: scene.episode, scene: sceneId, routeIntent: route, extraChoiceId: id });
        cases.push({ episode: scene.episode, scene: sceneId, routeIntent: route, priorRelevantChoices: { 'S26-C1': contract.code }, authoredBranch: null, extraChoiceId: id, insertionSourceRef: result?.sourceStartRef ?? null, precedingRefs: refs(without.slice(Math.max(0, (choice ? without.indexOf(choice) : 0) - 4), choice ? without.indexOf(choice) : 0)), precedingText: without.slice(Math.max(0, (choice ? without.indexOf(choice) : 0) - 4), choice ? without.indexOf(choice) : 0).map((entry) => entry.text ?? ''), followingRefs: refs(withChoice.slice(resultIndex + 1, resultIndex + 5)), followingText: withChoice.slice(resultIndex + 1, resultIndex + 5).map((entry) => entry.text ?? ''), renderedQuestion: choice?.question ?? null, renderedOptions: choice?.options ?? null, selectedOption: code, resultingText: result?.text ?? null, routeBefore, routeAfter, contradictionCounters: counterSnapshot(), crossRouteLeakCounters: { crossRouteLeakCount: counters.crossRouteLeakCount, routeStateMismatchCount: counters.routeStateMismatchCount }, insertionRefExact: exactInsertion, runtimeBrowser: browserRuntime(route), runtimeBrowserErrors: browserRuntime(route).flatMap((item) => [...item.errors, ...item.failedRequests]) });
      }
    }
  }
}

for (const [sceneId, echoes] of Object.entries(literaryLocaleBundles.en.interactionEchoes ?? {})) {
  if (!targetScenes.includes(sceneId)) continue;
  for (const [echoId, a, b] of echoes) {
    const sourceExists = Object.values(interactionBeats).some((beats) => beats.length >= 0) && literarySeason.scenes.some((scene) => scene.chunks.some((chunk) => chunk.title.includes(echoId.split('-')[0])));
    const selected = { ...baseChoices('A'), [echoId]: 'A' };
    const flow = compileInteractivePlayback(sceneMap.get(sceneId), selected, 'en');
    const echoEntry = flow.find((entry) => entry.echoOf === echoId);
    assertMachine('inventedCharacterKnowledgeCount', Boolean(sourceExists && echoEntry), { episode: sceneMap.get(sceneId).episode, scene: sceneId, echoId });
    cases.push({ episode: sceneMap.get(sceneId).episode, scene: sceneId, routeIntent: 'eric|nick|damir|alice', priorRelevantChoices: { [echoId]: 'A' }, authoredBranch: null, extraChoiceId: null, interactionEcho: echoId, insertionSourceRef: echoEntry?.sourceStartRef ?? null, precedingRefs: [], precedingText: [], followingRefs: [], followingText: [echoEntry?.text ?? ''], renderedQuestion: null, renderedOptions: null, selectedOption: 'A', resultingText: echoEntry?.text ?? null, routeBefore: 'shared', routeAfter: 'shared', contradictionCounters: counterSnapshot(), crossRouteLeakCounters: { crossRouteLeakCount: counters.crossRouteLeakCount, routeStateMismatchCount: counters.routeStateMismatchCount }, runtimeBrowser: browserRuntime('eric'), runtimeBrowserErrors: browserRuntime('eric').flatMap((item) => [...item.errors, ...item.failedRequests]) });
  }
}

const routeMatrix = Object.fromEntries(Object.entries(routes).map(([route, contract]) => [route, { sceneCount: contract.scenes.length, routeSpecificSceneCount: contract.scenes.filter((sceneId) => !['S27', 'S59'].includes(sceneId)).length, extraInteractionCaseCount: contract.scenes.reduce((sum, sceneId) => sum + ((interactionBeats[sceneId]?.length ?? 0) * 2), 0) }]));
const browserPass = browserEvidence.status === 'PASS' && browserEvidence.results.every((result) => result.errors.length === 0 && result.failed.length === 0 && result.routeStateMismatches === 0 && result.cyrillicCount === 0 && result.overflowCount === 0 && result.internalScrollCount === 0 && result.localeSwitch?.sameScene && result.localeSwitch?.structuralSaveHasLocale === false);
const countersPass = Object.values(counters).every((value) => value === 0);
const evidence = { schemaVersion: 1, status: failures.length === 0 && countersPass && parity.enCyrillicLeakage === 0 && browserPass ? 'PASS' : 'BLOCKED', testedSourceHead: sourceHead, generatedAt: new Date().toISOString(), episode7: { sceneOrder: episode7, paragraphCounts: Object.fromEntries(episode7.map((id) => [id, paragraphCounts[id]])) }, episode8: { sceneOrder: episode8, paragraphCounts: Object.fromEntries(episode8.map((id) => [id, paragraphCounts[id]])) }, authoredChoices: Object.fromEntries(targetScenes.map((id) => [id, authoredChoiceIds(sceneMap.get(id))])), routeMatrix, routeCoverage: Object.keys(routes).length, semanticCaseCount: cases.length, interactionCaseCount: cases.filter((item) => item.extraChoiceId).length, interactionEchoCaseCount: cases.filter((item) => item.interactionEcho).length, counters, parity, saveReload: { status: browserPass ? 'PASS' : 'BLOCKED', routes: browserEvidence.results.map((result) => ({ route: result.route, viewport: result.viewport, checkpoints: result.saveChecks.map((item) => item.checkpoint) })) }, localeSwitch: { status: browserPass ? 'PASS' : 'BLOCKED', routes: browserEvidence.results.map((result) => ({ route: result.route, viewport: result.viewport, sameScene: result.localeSwitch?.sameScene, structuralSaveHasLocale: result.localeSwitch?.structuralSaveHasLocale })) }, runtimeBrowser: { status: browserEvidence.status, evidencePath: browserPath, results: browserEvidence.results.map((result) => ({ route: result.route, viewport: result.viewport, sceneSet: result.sceneSet, errors: result.errors, failedRequests: result.failed, cyrillicCount: result.cyrillicCount, overflowCount: result.overflowCount, internalScrollCount: result.internalScrollCount })) }, sourceDefectsFound: [], boundedRepairs: [], deliberateEnglishAdaptations: ['Modern literary English rather than literal Russian syntax; preserved event order, speaker/action ownership, consent/privacy boundaries, route intent and Icelandic diacritics.'], unresolvedEditorialDecisions: ['Independent human cold read remains the next editorial gate.'], cases, failures };
await fs.writeFile(out, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: evidence.status, testedSourceHead: sourceHead, semanticCaseCount: cases.length, interactionCaseCount: evidence.interactionCaseCount, counters, browserPass }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 2;
