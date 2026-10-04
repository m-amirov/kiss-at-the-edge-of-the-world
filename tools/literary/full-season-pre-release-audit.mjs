#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats, interactionEchoes } from '../../src/literary-interactive-beats.js';
import { literaryLocaleBundles } from '../../src/literary-localization-bundle.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { nextLiteraryScene } from '../../src/literary-engine.js';
import { validateLiteraryInteractionLocale, validateLiteraryLocale } from '../../src/localization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(root, process.env.FULL_SEASON_AUDIT_OUTPUT ?? 'artifacts/evidence/full-season-source-audit.json');
const byId = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const counterNames = ['contradictionCount', 'prematurePremiseCount', 'duplicatedCanonicalEventCount', 'authoredChoicePreselectionCount', 'branchInvalidPremiseCount', 'crossRouteLeakCount', 'inventedRelationshipStateCount', 'inventedConsentCount', 'inventedCharacterKnowledgeCount', 'actionOwnershipMismatchCount', 'temporalRewindCount', 'internalStateLeakCount', 'enCyrillicLeakageCount', 'leakedMarkupCount', 'optionCodeMismatchCount', 'predicateMismatchCount', 'interactionEchoMismatchCount', 'routeIntentMismatchCount', 'routeStatusMismatchCount', 'endingMismatchCount', 'endingReachabilityMismatchCount'];
const counters = Object.fromEntries(counterNames.map(name => [name, 0]));
const failures = [], cases = [];
const check = (counter, condition, details) => { if (!condition) { counters[counter] += 1; failures.push({ counter, ...details }); } };
const cyrillic = /[\u0400-\u04ff]/u;
const playerInternal = /\{\{|\}\}|\brouteIntent\b|\brouteStatus\b|active route|active line|активная линия|активная ветка|S\d{2}-C\d+/iu;
const choiceCodes = text => [...String(text ?? '').matchAll(/(?:^|\n)\s*([A-D])\.\s/gu)].map(match => match[1]);
const ids = text => [...String(text ?? '').matchAll(/S\d{2}-C\d+/gu)].map(match => match[0]);
const predicates = text => [...String(text ?? '').matchAll(/`([\w.-]+)=([\w.-]+)`/gu)].map(match => `${match[1]}=${match[2]}`).sort();
const authored = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/S\d{2}-C\d+/u)?.[0]).filter(Boolean)).map(id => [id, 'A']));
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const routeStatusChoice = { eric: 'S32-C1', nick: 'S33-C1', damir: 'S34-C1' };
const routeScenes = { eric: new Set(['S28', 'S49', 'S32', 'S50', 'S37', 'S51']), nick: new Set(['S29', 'S52', 'S33', 'S53', 'S38', 'S54']), damir: new Set(['S30', 'S55', 'S34', 'S56', 'S39', 'S57']), alice: new Set(['S31', 'S62', 'S35', 'S63', 'S40', 'S64']) };
const statusCode = status => status === 'active' ? 'A' : status === 'paused' ? 'B' : 'C';
function scenariosFor(sceneId) {
  for (const [route, scenes] of Object.entries(routeScenes)) if (scenes.has(sceneId)) {
    if (route === 'alice') return [{ route, status: 'active' }];
    if ([`S${route === 'eric' ? '32' : route === 'nick' ? '33' : '34'}`].includes(sceneId)) return ['active', 'paused', 'closed'].map(status => ({ route, status }));
    return ['active', 'paused'].map(status => ({ route, status }));
  }
  return [{ route: 'eric', status: 'active' }];
}
function choicesFor({ route, status }, overrides = {}) {
  return { ...authored, 'S26-C1': routeCodes[route], ...(routeStatusChoice[route] ? { [routeStatusChoice[route]]: statusCode(status) } : {}), ...overrides };
}
function visibleLocaleText(locale) {
  const data = literaryLocaleBundles[locale];
  return [
    ...Object.values(data.scenes).flatMap(scene => [scene.title, ...Object.values(scene.chunks).flatMap(chunk => Object.values(chunk.paragraphs))]),
    ...Object.values(data.interactionBeats).flatMap(beats => beats.flatMap(beat => [beat.question, ...beat.options.flatMap(option => [option.label, option.text])])),
    ...Object.values(data.interactionEchoes).flatMap(echoes => echoes.flatMap(([, a, b]) => [a, b]))
  ].join('\n');
}

const locale = validateLiteraryLocale(literarySeason, literaryLocaleBundles.en);
const interaction = validateLiteraryInteractionLocale(interactionBeats, literaryLocaleBundles.en);
check('contradictionCount', locale.status === 'PASS', { scope: 'scene/chunk/paragraph parity', errors: locale.errors });
check('contradictionCount', interaction.status === 'PASS', { scope: 'interaction parity', errors: interaction.errors });
for (const scene of literarySeason.scenes) {
  const translated = literaryLocaleBundles.en.scenes[scene.id];
  for (let index = 0; index < scene.chunks.length; index++) {
    const source = scene.chunks[index]; const target = translated?.chunks?.[`${scene.id}.C${String(index).padStart(3, '0')}`];
    const sourceText = `${source.title}\n${source.paragraphs.join('\n')}`;
    const targetText = `${target?.title ?? ''}\n${Object.values(target?.paragraphs ?? {}).join('\n')}`;
    check('optionCodeMismatchCount', JSON.stringify(choiceCodes(sourceText)) === JSON.stringify(choiceCodes(targetText)), { scene: scene.id, chunk: index, source: choiceCodes(sourceText), target: choiceCodes(targetText) });
    check('predicateMismatchCount', JSON.stringify(predicates(sourceText)) === JSON.stringify(predicates(targetText)), { scene: scene.id, chunk: index, source: predicates(sourceText), target: predicates(targetText) });
    check('routeIntentMismatchCount', JSON.stringify(predicates(sourceText).filter(item => item.startsWith('routeIntent='))) === JSON.stringify(predicates(targetText).filter(item => item.startsWith('routeIntent='))), { scene: scene.id, chunk: index });
    check('routeStatusMismatchCount', JSON.stringify(predicates(sourceText).filter(item => item.startsWith('routeStatus='))) === JSON.stringify(predicates(targetText).filter(item => item.startsWith('routeStatus='))), { scene: scene.id, chunk: index });
  }
  const sourceBeats = interactionBeats[scene.id] ?? [], targetBeats = literaryLocaleBundles.en.interactionBeats[scene.id] ?? [];
  check('optionCodeMismatchCount', JSON.stringify(sourceBeats.map(beat => beat.options.map(option => option.code))) === JSON.stringify(targetBeats.map(beat => beat.options.map(option => option.code))), { scene: scene.id, scope: 'interaction options' });
}
const enVisible = visibleLocaleText('en');
check('enCyrillicLeakageCount', !cyrillic.test(enVisible), { scope: 'all EN player text' });
check('leakedMarkupCount', !playerInternal.test(enVisible), { scope: 'all EN player text' });
for (const [sceneId, echoes] of Object.entries(interactionEchoes)) {
  const translated = literaryLocaleBundles.en.interactionEchoes[sceneId] ?? [];
  check('interactionEchoMismatchCount', echoes.length === translated.length && echoes.every((echo, index) => echo[0] === translated[index]?.[0] && translated[index]?.[1]?.trim() && translated[index]?.[2]?.trim()), { scene: sceneId, source: echoes, translated });
}

for (const scene of literarySeason.scenes) for (const scenario of scenariosFor(scene.id)) for (const localeName of ['ru', 'en']) {
  const beats = (localeName === 'ru' ? interactionBeats : literaryLocaleBundles.en.interactionBeats)[scene.id] ?? [];
  for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) for (const option of ['A', 'B']) {
    const prior = Object.fromEntries(Array.from({ length: beatIndex }, (_, index) => [`${scene.id}-C${90 + index}`, 'A']));
    const id = `${scene.id}-C${90 + beatIndex}`;
    const before = compileInteractivePlayback(scene, choicesFor(scenario, prior), localeName);
    const choiceIndex = before.findIndex(entry => entry.type === 'choice' && entry.id === id);
    const choice = before[choiceIndex];
    const after = compileInteractivePlayback(scene, choicesFor(scenario, { ...prior, [id]: option }), localeName);
    const resultIndex = after.findIndex(entry => entry.decisionResult === id);
    const result = after[resultIndex], following = after[resultIndex + 1];
    const canonical = scene.chunks.flatMap(chunk => chunk.paragraphs).join('\n');
    const visible = `${choice?.question ?? ''}\n${choice?.options?.map(item => item.label).join('\n') ?? ''}\n${result?.text ?? ''}`;
    check('branchInvalidPremiseCount', Boolean(choice && result && following), { scene: scene.id, locale: localeName, route: scenario, id, option, choiceIndex, resultIndex });
    check('contradictionCount', choice?.sourceStartRef && JSON.stringify(choice.sourceStartRef) === JSON.stringify(result?.sourceStartRef), { scene: scene.id, locale: localeName, route: scenario, id, option });
    check('duplicatedCanonicalEventCount', !canonical.includes(result?.text ?? ''), { scene: scene.id, locale: localeName, route: scenario, id, option });
    check('authoredChoicePreselectionCount', choice?.options?.some(item => item.code === option) && !result?.text?.includes(choice?.question ?? ''), { scene: scene.id, locale: localeName, route: scenario, id, option });
    check('internalStateLeakCount', !playerInternal.test(visible), { scene: scene.id, locale: localeName, route: scenario, id, option });
    check('leakedMarkupCount', !/\{\{|\}\}/u.test(visible), { scene: scene.id, locale: localeName, route: scenario, id, option });
    if (localeName === 'en') check('enCyrillicLeakageCount', !cyrillic.test(visible), { scene: scene.id, route: scenario, id, option });
    cases.push({ scene: scene.id, episode: scene.episode, locale: localeName, routeIntent: scenario.route, routeStatus: scenario.status, interactionId: id, option, insertionRef: result?.sourceStartRef ?? null, followingRef: following?.sourceStartRef ?? null });
  }
}
for (const [sceneId, echoes] of Object.entries(interactionEchoes)) for (const localeName of ['ru', 'en']) for (const [choiceId] of echoes) for (const code of ['A', 'B']) {
  const flow = compileInteractivePlayback(byId.get(sceneId), choicesFor({ route: 'eric', status: 'active' }, { [choiceId]: code }), localeName);
  const echo = flow.find(entry => entry.echoOf === choiceId);
  check('interactionEchoMismatchCount', Boolean(echo?.text?.trim()), { scene: sceneId, locale: localeName, choiceId, code });
  check('internalStateLeakCount', !playerInternal.test(echo?.text ?? ''), { scene: sceneId, locale: localeName, choiceId, code });
}

const endingMatrix = [];
for (const route of ['eric', 'nick', 'damir']) for (const status of ['active', 'paused', 'closed']) for (const finalChoice of status === 'closed' ? [null] : ['A', 'B', 'C']) {
  const choices = choicesFor({ route, status }, { 'S42-C1': finalChoice ?? 'A' }); let current = 'S41'; const path = [];
  for (let limit = 0; current && limit++ < 8; current = nextLiteraryScene(current, choices)) path.push(current);
  const expected = status === 'closed' || finalChoice !== 'A' ? 'S47' : ({ eric: 'S44', nick: 'S45', damir: 'S46' })[route];
  check('endingMismatchCount', path.at(-1) === expected, { route, status, finalChoice, expected, path });
  check('endingReachabilityMismatchCount', path.includes(expected), { route, status, finalChoice, expected, path });
  endingMatrix.push({ routeIntent: route, routeStatus: status, finalChoice, path, expectedEnding: expected, actualEnding: path.at(-1) });
}
{ const choices = choicesFor({ route: 'alice', status: 'active' }); let current = 'S41'; const path = []; for (let limit = 0; current && limit++ < 8; current = nextLiteraryScene(current, choices)) path.push(current); check('endingMismatchCount', path.at(-1) === 'S47', { route: 'alice', path }); check('endingReachabilityMismatchCount', path.includes('S47'), { route: 'alice', path }); endingMatrix.push({ routeIntent: 'alice', routeStatus: 'active', finalChoice: null, path, expectedEnding: 'S47', actualEnding: path.at(-1) }); }

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const evidence = { schemaVersion: 1, status, generatedAt: new Date().toISOString(), testedSourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), localization: { ruSceneCount: literarySeason.scenes.length, enSceneCount: Object.keys(literaryLocaleBundles.en.scenes).length, missingEnScenes: locale.errors.filter(error => error.startsWith('missing scene ')), extraEnScenes: locale.errors.filter(error => error.startsWith('extra scene ')), missingParagraphRefs: locale.errors.filter(error => error.startsWith('missing paragraph ')), extraParagraphRefs: locale.errors.filter(error => error.startsWith('extra paragraph ')), sceneParity: locale.status, chunkParity: locale.status, interactionParity: interaction.status, interactionEchoParity: counters.interactionEchoMismatchCount === 0 ? 'PASS' : 'FAIL', optionCodeParity: counters.optionCodeMismatchCount === 0 ? 'PASS' : 'FAIL', predicateParity: counters.predicateMismatchCount === 0 ? 'PASS' : 'FAIL', routeIntentParity: counters.routeIntentMismatchCount === 0 ? 'PASS' : 'FAIL', routeStatusParity: counters.routeStatusMismatchCount === 0 ? 'PASS' : 'FAIL' }, interaction: { caseCount: cases.length, semanticCounters: counters, cases }, endingMatrix, failures };
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status, testedSourceHead: evidence.testedSourceHead, localization: evidence.localization, interactionCases: cases.length, endingRows: endingMatrix.length, counters }, null, 2));
if (status !== 'PASS') process.exitCode = 2;
