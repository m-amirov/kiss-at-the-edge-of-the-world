#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literaryLocaleBundles } from '../../src/literary-localization-bundle.js';
import { validateLiteraryInteractionLocale, validateLiteraryLocale } from '../../src/localization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'artifacts/evidence/ep07-08-route-interaction-continuity.json');
const browserPath = path.join(root, 'artifacts/evidence/ep07-08-route-browser.json');
const episode7 = ['S27', 'S59', 'S28', 'S49', 'S29', 'S52', 'S30', 'S55', 'S31', 'S62'];
const episode8 = ['S32', 'S50', 'S33', 'S53', 'S34', 'S56', 'S35', 'S63'];
const targetScenes = [...episode7, ...episode8];
const sceneMap = new Map(literarySeason.scenes.map((scene) => [scene.id, scene]));
const counterNames = ['contradictionCount', 'prematurePremiseCount', 'duplicatedCanonicalLineCount', 'branchInvalidPremiseCount', 'crossRouteLeakCount', 'inventedRelationshipCount', 'inventedConsentCount', 'inventedCharacterKnowledgeCount', 'routeStateMismatchCount', 'actionOwnershipMismatchCount', 'authoredChoicePreselectionCount', 'temporalRewindCount', 'internalStateLeakCount', 'leakedMarkupCount', 'cyrillicCount'];
const counters = Object.fromEntries(counterNames.map((name) => [name, 0]));
const failures = [];
const cases = [];
const assertMachine = (counter, condition, details) => {
  if (condition) return;
  counters[counter] += 1;
  failures.push({ counter, ...details });
};
const sameRef = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const ref = (chunk, paragraph) => ({ chunk, paragraph });
const routeName = { A: 'eric', B: 'nick', C: 'damir', D: 'alice' };
const routeStatus = (choices) => ['S32-C1', 'S33-C1', 'S34-C1', 'S35-C1'].some((id) => choices[id] === 'C') ? 'closed' : (['S32-C1', 'S33-C1', 'S34-C1', 'S35-C1'].some((id) => choices[id] === 'B') ? 'paused' : 'active');
const routes = {
  eric: { code: 'A', scenes: ['S27', 'S59', 'S28', 'S49', 'S32', 'S50'] },
  nick: { code: 'B', scenes: ['S27', 'S59', 'S29', 'S52', 'S33', 'S53'] },
  damir: { code: 'C', scenes: ['S27', 'S59', 'S30', 'S55', 'S34', 'S56'] },
  alice: { code: 'D', scenes: ['S27', 'S59', 'S31', 'S62', 'S35', 'S63'] }
};
const predecessorStates = {
  S50: [{ id: 'S32-C1', selected: 'A', routeStatus: 'active' }, { id: 'S32-C1', selected: 'B', routeStatus: 'paused' }],
  S53: [{ id: 'S33-C1', selected: 'A', routeStatus: 'active' }, { id: 'S33-C1', selected: 'B', routeStatus: 'paused' }],
  S56: [{ id: 'S34-C1', selected: 'A', routeStatus: 'active' }, { id: 'S34-C1', selected: 'B', routeStatus: 'paused' }],
  S63: [{ id: 'S35-C1', selected: 'A', routeStatus: 'active' }, { id: 'S35-C1', selected: 'B', routeStatus: 'paused' }]
};
const expectedRefs = {
  S27: { insertion: ref(0, 5), following: ref(0, 6), source: /Инга остановилась.*перерыв.*Ник поднял камеру/isu }, S59: { insertion: ref(0, 3), following: ref(0, 4), source: /Выбираем песню для дороги/iu }, S28: { insertion: ref(0, 6), following: ref(0, 7), source: /Можно завтра просто сесть с нами/iu }, S49: { insertion: ref(0, 4), following: ref(0, 5), source: /Эрик протянул ей руку/iu }, S29: { insertion: ref(0, 3), following: ref(0, 4), source: /просмотрела фрагмент дважды/iu }, S52: { insertion: ref(0, 5), following: ref(0, 6), source: /Это свидание/iu }, S30: { insertion: ref(0, 5), following: ref(0, 6), source: /видеособеседование|открытое письмо/iu }, S55: { insertion: ref(0, 4), following: ref(0, 5), source: /разрешила им снять шлемы и выпить воды/iu }, S31: { insertion: ref(0, 4), following: ref(0, 5), source: /фотография настила.*Инга/isu }, S62: { insertion: ref(0, 2), following: ref(2, 0), source: /В бассейне было тихо/iu }, S32: { insertion: ref(0, 6), following: ref(0, 7), source: /не нужен ответ о зиме сегодня/iu }, S50: { insertion: ref(0, 2), following: ref(3, 0), paused: { insertion: ref(5, 0), following: ref(7, 0) }, source: /книжном.*рецептов|карта города/isu }, S33: { insertion: ref(0, 4), following: ref(0, 5), source: /закрыть доступ к файлу и удалил его из общей папки/iu }, S53: { insertion: ref(0, 2), following: ref(3, 0), paused: { insertion: ref(5, 0), following: ref(7, 0) }, source: /булочк|подтверждавшее удаление/iu }, S34: { insertion: ref(0, 5), following: ref(0, 6), source: /Она написала ему, что ужин отменяется/iu }, S56: { insertion: ref(0, 2), following: ref(3, 0), paused: { insertion: ref(5, 0), following: ref(7, 0) }, source: /медленная композиция|музыкальный вечер вместе с группой/iu }, S35: { insertion: ref(0, 1), following: ref(0, 2), source: /Ингину фотографию настила/iu }, S63: { insertion: ref(0, 1), following: ref(2, 0), source: /села ближе к окну/iu }
};
const forbidden = { S27: /camera stayed in (the )?bag|камера.*сумк/iu, S28: /turning off the planned trail|свернуть с намеченной прогулки/iu, S49: /invite Eric to dance first|первой пригласить Эрика танцевать/iu, S29: /first time.*recording|впервые увидела себя на записи|suggests watching/iu, S52: /has found the lost glove|вернул потерянную перчатку|found the glove/iu, S30: /new habit|shared breakfast|новую привычку|общий завтрак/iu, S55: /will not approach the fence|не подходит к ограде|handler/iu, S31: /only for herself|только для себя/iu, S62: /choosing what to take home|what she will buy|что взять домой/iu, S32: /two days.*suit|два дня.*подходили/iu, S50: /puts away the map|убирает карту/iu, S33: /removed the shot|убрал кадр из общей версии/iu, S34: /Damir cancels|Дамир отменяет/iu, S35: /facts and agreed quotes|согласованные прямые цитаты/iu, S63: /by the wall|у стены/iu };
const preselection = { S29: /choose to delete|choose to keep.*archive|choose to reshoot|выбирает удалить|выбирает оставить.*архив|выбирает переснять/iu, S32: /choose to continue|choose a pause|choose to close|выбирает продолжить|выбирает паузу|выбирает закончить/iu, S33: /chooses to continue|chooses a pause|chooses to end|выбирает продолжить|выбирает паузу|выбирает закончить/iu, S34: /chooses to meet later|chooses a pause|chooses to end|выбирает встретиться позже|выбирает паузу|выбирает закончить/iu, S35: /will use agreed quotes|will rebuild around her own observations|будет использовать согласованные цитаты|пересоберёт вокруг собственных наблюдений/iu };
const ownershipForbidden = { S34: /Damir cancelled|Дамир отменил/iu, S49: /Alice invited Eric.*first|Алиса первой пригласила Эрика/iu };
const routeLeakForbidden = { eric: /\bNick\b|\bDamir\b|Ник|Дамир/u, nick: /\bEric\b|\bDamir\b|Эрик|Дамир/u, damir: /\bEric\b|\bNick\b|Эрик|Ник/u, alice: /\bEric\b|\bNick\b|\bDamir\b|Эрик|Ник|Дамир/u };
const consentForbidden = { S27: /Inga agreed|Инга согласилась/iu, S29: /Alice decided.*film|Алиса решила.*фильм/iu, S33: /Nick removed.*again|Ник.*снова удалил/iu };
const knowledgeForbidden = { S62: /will buy|выберет.*книг|bookshop.*choos/iu, S52: /has found|вернул.*перчатк/iu };
const internalStateTerminology = /active line|active route|routeStatus|routeIntent|активная линия|активная ветка/iu;
const allCanonicalText = (scene) => scene.chunks.flatMap((chunk) => chunk.paragraphs).join('\n');
const allCanonicalMaterial = (scene) => scene.chunks.flatMap((chunk) => [chunk.title, ...chunk.paragraphs]).join('\n');
const temporalContracts = {
  S28: { all: { predecessor: /Можно завтра просто сесть с нами/iu, forbiddenRendered: /promise|promised/iu, reason: 'future breakfast promise is treated as already completed' } },
  S50: {
    active: { predecessor: /Они не обещали друг другу общего адреса/iu, forbiddenRendered: /returned.*dinner|return.*dinner|back for dinner|group chat.*dinner/iu, canonicalRequired: /До ужина оставалось время[\s\S]*пошли дальше по улице/iu, followingRequired: /S50-C2[\s\S]*завершением прогулки/iu, reason: 'walk ends before S50-C2 still says it is ongoing' },
    paused: { predecessor: /Это было непривычно/iu, forbiddenRendered: /returned.*dinner|return.*dinner|back for dinner|group chat.*dinner/iu, canonicalRequired: /До ужина оставалось время[\s\S]*пошли дальше по улице/iu, followingRequired: /S50-C2[\s\S]*завершением прогулки/iu, reason: 'walk ends before S50-C2 still says it is ongoing' }
  },
  S53: {
    active: { predecessor: /После бассейна они вышли в пекарню/iu, forbiddenRendered: /breakfast|bakery|phone|camera.*boot/iu, reason: 'completed day action is replayed by the interaction' },
    paused: { predecessor: /Оказалось, паузу нельзя/iu, forbiddenRendered: /breakfast|bakery|phone|camera.*boot/iu, reason: 'completed day action is replayed by the interaction' }
  },
  S56: {
    active: { predecessor: /Когда началась медленная композиция/iu, forbiddenRendered: /decided to leave|leave the evening|walk to the hotel|hotel/iu, reason: 'active music context is rewound or ended before its authored continuation' },
    paused: { predecessor: /У дверей гостиницы/iu, forbiddenRendered: /decided to leave|leave the evening|walk to the hotel|hotel/iu, reason: 'paused hotel state is rewound to a decision to leave' }
  }
};
const authoredChoiceIds = (scene) => scene.chunks.map((chunk) => chunk.title.match(/S\d{2}-C\d+/u)?.[0]).filter(Boolean);
const baseChoices = (routeCode, state = null) => { const choices = { 'S26-C1': routeCode }; for (const sceneId of targetScenes) for (const id of authoredChoiceIds(sceneMap.get(sceneId))) choices[id] = 'A'; if (state) choices[state.id] = state.selected; return choices; };
const textOf = (choice, result) => `${choice?.question ?? ''}\n${choice?.options?.map((option) => `${option.label}\n${result?.text ?? ''}`).join('\n') ?? ''}`;

const browserEvidence = JSON.parse(await fs.readFile(browserPath, 'utf8'));
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const parity = { interactionParity: 'PASS', localeParity: 'PASS', enCyrillicLeakage: 0 };
for (const sceneId of targetScenes) {
  const localized = JSON.parse(await fs.readFile(path.join(root, `content/localization/en/${sceneId}.json`), 'utf8'));
  const report = validateLiteraryLocale(literarySeason, localized, { sceneIds: [sceneId] });
  assertMachine('contradictionCount', report.status === 'PASS', { scene: sceneId, reason: report.errors });
  if (report.status !== 'PASS') parity.localeParity = 'BLOCKED';
  const visible = Object.values(localized.scenes[sceneId].chunks).flatMap((chunk) => [chunk.title, ...Object.values(chunk.paragraphs)]).join('\n'); const cyrillic = (visible.match(/[\u0400-\u04ff]/gu) ?? []).length;
  counters.cyrillicCount += cyrillic; parity.enCyrillicLeakage += cyrillic;
  assertMachine('leakedMarkupCount', !/\{\{|\}\}/u.test(visible), { scene: sceneId, scope: 'en locale' });
}
const interactionReport = validateLiteraryInteractionLocale(interactionBeats, { interactionBeats: Object.fromEntries(targetScenes.map((sceneId) => [sceneId, literaryLocaleBundles.en.interactionBeats[sceneId]])) }, { sceneIds: targetScenes });
parity.interactionParity = interactionReport.status;
assertMachine('contradictionCount', interactionReport.status === 'PASS', { scope: 'interaction parity', reason: interactionReport.errors });
for (const [locale, beats] of Object.entries({ ru: interactionBeats, en: literaryLocaleBundles.en.interactionBeats })) for (const sceneId of targetScenes) {
  const c90 = beats[sceneId]?.[0]; const visible = [c90?.question, ...(c90?.options ?? []).flatMap((option) => [option.label, option.text])].filter(Boolean).join('\n');
  assertMachine('internalStateLeakCount', !internalStateTerminology.test(visible), { scene: sceneId, locale, visible });
}

for (const [routeIntent, contract] of Object.entries(routes)) for (const sceneId of contract.scenes) for (const predecessor of predecessorStates[sceneId] ?? [null]) {
  const scene = sceneMap.get(sceneId); const choices = baseChoices(contract.code, predecessor); const actualStatus = routeStatus(choices); const canonical = allCanonicalText(scene);
  assertMachine('routeStateMismatchCount', routeName[choices['S26-C1']] === routeIntent, { scene: sceneId, routeIntent, predecessor });
  if (predecessor) assertMachine('routeStateMismatchCount', actualStatus === predecessor.routeStatus, { scene: sceneId, routeIntent, predecessor, actualStatus });
  assertMachine('inventedCharacterKnowledgeCount', expectedRefs[sceneId].source.test(canonical), { scene: sceneId, routeIntent, predecessor, reason: 'required canonical predecessor fact missing' });
  for (const code of ['A', 'B']) {
    const expected = actualStatus === 'paused' && expectedRefs[sceneId].paused ? { ...expectedRefs[sceneId], ...expectedRefs[sceneId].paused } : expectedRefs[sceneId]; const id = `${sceneId}-C90`; const without = compileInteractivePlayback(scene, choices, 'en'); const choiceIndex = without.findIndex((entry) => entry.type === 'choice' && entry.id === id); const choice = without[choiceIndex];
    const withChoice = compileInteractivePlayback(scene, { ...choices, [id]: code }, 'en'); const resultIndex = withChoice.findIndex((entry) => entry.decisionResult === id); const result = withChoice[resultIndex]; const following = withChoice[resultIndex + 1]; const rendered = textOf(choice, result); const duplicate = Boolean(result?.text && canonical.includes(result.text)); const precedingText = without.slice(Math.max(0, choiceIndex - 2), choiceIndex).map((entry) => entry.text ?? '').join('\n'); const temporal = temporalContracts[sceneId]?.[actualStatus] ?? temporalContracts[sceneId]?.all;
    assertMachine('prematurePremiseCount', Boolean(choice && result) && !forbidden[sceneId]?.test(rendered), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    assertMachine('duplicatedCanonicalLineCount', !duplicate, { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    assertMachine('leakedMarkupCount', !/\{\{|\}\}|S\d{2}-C\d+/u.test(rendered), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    assertMachine('routeStateMismatchCount', sameRef(choice?.sourceStartRef, expected.insertion) && sameRef(result?.sourceStartRef, expected.insertion), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code, expectedInsertion: expected.insertion, actualChoice: choice?.sourceStartRef, actualResult: result?.sourceStartRef });
    assertMachine('contradictionCount', sameRef(following?.sourceStartRef, expected.following), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code, expectedFollowing: expected.following, actualFollowing: following?.sourceStartRef });
    assertMachine('branchInvalidPremiseCount', Boolean(following), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code, reason: 'no immediate canonical continuation' });
    if (!['S27', 'S59'].includes(sceneId) && routeLeakForbidden[routeIntent]) assertMachine('crossRouteLeakCount', !routeLeakForbidden[routeIntent].test(rendered), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    if (consentForbidden[sceneId]) assertMachine('inventedConsentCount', !consentForbidden[sceneId].test(rendered), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    if (knowledgeForbidden[sceneId]) assertMachine('inventedCharacterKnowledgeCount', !knowledgeForbidden[sceneId].test(rendered), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    if (ownershipForbidden[sceneId]) assertMachine('actionOwnershipMismatchCount', !ownershipForbidden[sceneId].test(rendered), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    if (preselection[sceneId]) assertMachine('authoredChoicePreselectionCount', !preselection[sceneId].test(result?.text ?? ''), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    if (temporal) assertMachine('temporalRewindCount', (!temporal.predecessor || temporal.predecessor.test(precedingText)) && (!temporal.forbiddenRendered || !temporal.forbiddenRendered.test(rendered)) && (!temporal.canonicalRequired || temporal.canonicalRequired.test(canonical)) && (!temporal.followingRequired || temporal.followingRequired.test(allCanonicalMaterial(scene))), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code, reason: temporal.reason, precedingText, renderedQuestion: choice?.question ?? null, resultingText: result?.text ?? null });
    assertMachine('inventedRelationshipCount', !/we agreed|first date|new relationship|мы договорились|первое свидание|новые отношения/iu.test(result?.text ?? ''), { scene: sceneId, routeIntent, routeStatus: actualStatus, predecessor, option: code });
    cases.push({ episode: scene.episode, scene: sceneId, extraChoiceId: id, routeIntent, routeStatus: actualStatus, priorRelevantChoices: Object.fromEntries(Object.entries(choices).filter(([key]) => key === 'S26-C1' || key === predecessor?.id)), insertionSourceRef: result?.sourceStartRef ?? null, precedingSourceText: without.slice(Math.max(0, choiceIndex - 2), choiceIndex).map((entry) => entry.text ?? ''), followingSourceRef: following?.sourceStartRef ?? null, followingSourceText: following?.text ?? null, renderedQuestion: choice?.question ?? null, selectedOption: code, resultingText: result?.text ?? null });
  }
}
const browserPass = browserEvidence.status === 'PASS' && browserEvidence.testedSourceHead === sourceHead && browserEvidence.results.every((result) => result.errors.length === 0 && result.failed.length === 0 && result.routeStateMismatches === 0 && result.cyrillicCount === 0 && result.overflowCount === 0 && result.internalScrollCount === 0);
const activePausedSemanticMatrix = Object.fromEntries(Object.entries(routes).map(([routeIntent, contract]) => [routeIntent, contract.scenes.filter((sceneId) => predecessorStates[sceneId]).flatMap((sceneId) => predecessorStates[sceneId].map((state) => ({ scene: sceneId, predecessorChoice: `${state.id}=${state.selected}`, routeStatus: state.routeStatus })))]));
const countersPass = Object.values(counters).every((value) => value === 0);
const evidence = { schemaVersion: 2, status: failures.length === 0 && countersPass && browserPass ? 'PASS' : 'BLOCKED', testedSourceHead: sourceHead, generatedAt: new Date().toISOString(), episode7: { sceneOrder: episode7 }, episode8: { sceneOrder: episode8 }, routeCoverage: Object.keys(routes).length, activePausedSemanticMatrix, semanticCaseCount: cases.length, interactionCaseCount: cases.length, counters, parity, browser: { status: browserEvidence.status, testedSourceHead: browserEvidence.testedSourceHead, currentHeadMatch: browserEvidence.testedSourceHead === sourceHead, evidencePath: browserPath }, sourceDefectsFound: ['Stale canonical premises and action ownership in S27, S28, S49, S29, S52, S30, S55, S31, S62, S32, S50, S33, S34, S35, S63; routeStatus-invalid premises in S50, S53 and S56.'], boundedRepairs: targetScenes.map((sceneId) => `${sceneId}-C90`), cases, failures };
await fs.writeFile(out, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: evidence.status, testedSourceHead: sourceHead, semanticCaseCount: cases.length, activePausedSemanticMatrix, counters, browserPass }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 2;
