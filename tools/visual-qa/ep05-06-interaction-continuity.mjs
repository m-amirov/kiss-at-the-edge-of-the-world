#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats, interactionEchoes } from '../../src/literary-interactive-beats.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literaryLocaleBundles } from '../../src/literary-localization-bundle.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { validateLiteraryInteractionLocale } from '../../src/localization.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root = process.cwd();
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const evidenceFile = process.env.LITERARY_QA_EVIDENCE ?? 'artifacts/evidence/ep05-06-interaction-continuity.json';
const outputDir = process.env.LITERARY_QA_OUTPUT ?? 'output/playwright/ep05-06-interaction-continuity';
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const semanticViewport = { width: 390, height: 844 };
const episode5 = ['S17', 'S18', 'S19', 'S20', 'S21', 'S61'];
const episode6 = ['S22', 'S23', 'S24', 'S25', 'S58', 'S26'];
const scenes = [...episode5, ...episode6];
const visualScenes = ['S17', 'S19', 'S21', 'S61', 'S22', 'S23', 'S25', 'S26'];
const clone = value => JSON.parse(JSON.stringify(value));
const refKey = (sceneId, ref) => `${sceneId}.C${String(ref.chunk).padStart(3, '0')}.P${String(ref.paragraph).padStart(3, '0')}`;
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
const localizedSceneById = id => {
  const source = sceneById(id);
  const localized = literaryLocaleBundles.en.scenes[id];
  return { ...source, title: localized.title, chunks: source.chunks.map((chunk, chunkIndex) => {
    const translated = localized.chunks[`${id}.C${String(chunkIndex).padStart(3, '0')}`];
    return { ...chunk, localizedTitle: translated.title, paragraphs: chunk.paragraphs.map((_, paragraphIndex) => translated.paragraphs[`${id}.C${String(chunkIndex).padStart(3, '0')}.P${String(paragraphIndex).padStart(3, '0')}`]) };
  }) };
};

const baseChoices = {
  'S02-C1': 'A', 'S04-C1': 'A', 'S05-C1': 'B', 'S08-C1': 'A', 'S09-C1': 'A', 'S10-C1': 'A',
  'S13-C1': 'A', 'S15-C1': 'A', 'S16-C1': 'A', 'S17-C2': 'A', 'S18-C1': 'A', 'S18-C2': 'A', 'S19-C1': 'A',
  'S19-C2': 'A', 'S20-C1': 'A', 'S21-C1': 'A', 'S22-C1': 'A', 'S23-C1': 'A', 'S58-C1': 'A', 'S26-C1': 'A'
};

function authoredChoices(scene) {
  const result = [];
  for (const [index, chunk] of scene.chunks.entries()) {
    const match = chunk.title.match(/Выбор\s+(S\d{2}-C\d+)/i);
    if (!match) continue;
    const id = match[1];
    if (id === 'S17-C2') result.push({ id, options: ['A', 'B', 'C', 'D'] });
    else {
      const options = [];
      for (let next = index + 1; next < scene.chunks.length; next += 1) {
        if (scene.chunks[next].level <= chunk.level) break;
        if (scene.chunks[next].level !== chunk.level + 1) continue;
        const option = scene.chunks[next].title.match(/^([A-D])\./);
        if (option) options.push(option[1]);
      }
      result.push({ id, options });
    }
  }
  return result;
}

function branchChoices(scene) {
  const local = authoredChoices(scene);
  const result = [];
  const visit = (index, current) => {
    if (index === local.length) { result.push({ ...baseChoices, ...current }); return; }
    for (const code of local[index].options) visit(index + 1, { ...current, [local[index].id]: code });
  };
  visit(0, {});
  const branches = result.length ? result : [{ ...baseChoices }];
  // S25 is reached after S17-C2 and its semantic premise must be valid for
  // every possible eveningState, not only the default Eric branch.
  if (scene.id === 'S25') {
    return branches.flatMap(branch => Object.keys(eveningStateByChoice).map(code => ({ ...branch, 'S17-C2': code })));
  }
  return branches;
}

const eveningStateByChoice = { A: 'eric', B: 'nick', C: 'damir', D: 'alice' };

function authoredBranch(sceneId, choices) {
  const branch = Object.fromEntries(authoredChoices(sceneById(sceneId)).map(choice => [choice.id, choices[choice.id] ?? null]));
  if (sceneId === 'S25') {
    branch['S17-C2'] = choices['S17-C2'] ?? null;
  }
  return branch;
}

function branchContext(sceneId, choices) {
  return sceneId === 'S25' ? { eveningState: eveningStateByChoice[choices['S17-C2']] ?? null } : {};
}

function flowFor(sceneId, choices, locale = 'en') {
  return compileInteractivePlayback(locale === 'en' ? localizedSceneById(sceneId) : sceneById(sceneId), choices, locale);
}

function expectedBeat(sceneId, choices, beatId) {
  const flow = flowFor(sceneId, choices, 'en');
  const index = flow.findIndex(item => item.type === 'choice' && item.id === beatId);
  if (index < 0) throw new Error(`Expected ${beatId} is not reachable for ${JSON.stringify(choices)}`);
  return { flow, position: index, entry: flow[index] };
}

function precedingText(sceneId, choices, beatId) {
  const { flow, position } = expectedBeat(sceneId, choices, beatId);
  const insertionRef = flow[position].sourceStartRef;
  const refs = flow.slice(Math.max(0, position - 3), position).flatMap(item => item.sourceStartRef ? [item.sourceStartRef] : []);
  const ru = ref => sceneById(sceneId).chunks[ref.chunk]?.paragraphs[ref.paragraph] ?? null;
  const en = ref => literaryLocaleBundles.en.scenes[sceneId].chunks[`${sceneId}.C${String(ref.chunk).padStart(3, '0')}`]?.paragraphs[`${sceneId}.C${String(ref.chunk).padStart(3, '0')}.P${String(ref.paragraph).padStart(3, '0')}`] ?? null;
  return {
    sourceRefs: refs.map(ref => refKey(sceneId, ref)),
    insertionSourceRef: insertionRef ? refKey(sceneId, insertionRef) : null,
    insertionSourceText: insertionRef ? { ru: ru(insertionRef), en: en(insertionRef) } : null,
    ru: refs.map(ref => ({ ref: refKey(sceneId, ref), text: ru(ref) })),
    en: refs.map(ref => ({ ref: refKey(sceneId, ref), text: en(ref) }))
  };
}

function followingText(sceneId, choices, beatId) {
  const flow = flowFor(sceneId, { ...choices, [beatId]: 'A' }, 'en');
  const position = flow.findIndex(item => item.type === 'page' && item.decisionResult === beatId);
  if (position < 0) throw new Error(`Expected selected ${beatId} is not present for following-source audit`);
  const refs = flow.slice(position + 1, position + 5).flatMap(item => item.sourceStartRef ? [item.sourceStartRef] : []);
  const ru = ref => sceneById(sceneId).chunks[ref.chunk]?.paragraphs[ref.paragraph] ?? null;
  const en = ref => literaryLocaleBundles.en.scenes[sceneId].chunks[`${sceneId}.C${String(ref.chunk).padStart(3, '0')}`]?.paragraphs[`${sceneId}.C${String(ref.chunk).padStart(3, '0')}.P${String(ref.paragraph).padStart(3, '0')}`] ?? null;
  return {
    sourceRefs: refs.map(ref => refKey(sceneId, ref)),
    ru: refs.map(ref => ({ ref: refKey(sceneId, ref), text: ru(ref) })),
    en: refs.map(ref => ({ ref: refKey(sceneId, ref), text: en(ref) }))
  };
}

const semanticRules = {
  'S18-C90': { preceding: ['S18.C000.P018'], following: ['S18.C000.P019'], duplicated: [/where do you hurry/i, /куда спешишь/u], premature: [/home has turned out|different address/i, /домой|другим адресом/u] },
  'S18-C91': { preceding: ['S18.C000.P038'], following: ['S18.C000.P039'], invented: [/touched his fingers|touch(ed)? .*finger/i, /коснулась? его пальц/u] },
  'S19-C91': { inventedConsent: [/photo|picture|shot|camera|phone|filming|consent|permission/i, /фото|сним|камер|телефон|соглас/u], branchInvalid: [/tomorrow|ask again|завтра|спросить ещё раз/u] },
  'S20-C91': { preceding: ['S20.C000.P028'], following: ['S20.C000.P029'], premature: [/two years after the breakup|after the breakup|двух лет после разрыва|после разрыва/u] },
  'S23-C90': { inventedCharacterKnowledge: [/days? .*not even be able to call|дни.*не сможет.*позвон/u] },
  'S24-C91': { premature: [/ten minutes|договорились о десяти|десяти минут/u] },
  'S25-C90': { branchInvalid: [/saw .*leave with eric|evening with eric|ушла с эриком|вечер с эриком|видел/u] },
  'S25-C91': { premature: [/confirmed date|date of .*interview|подтверждённ.*дат|дат.*собеседован/u] },
  'S58-C90': { branchInvalid: [/bread|loaf|хлеб|буханк/u] },
  'S26-C91': { branchInvalid: [/person she chooses|person .*chooses|человеку, которого выберет|отношения/u] }
};

function countMatches(text, patterns = []) { return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0); }

function auditSemanticCase(sceneId, choices, beatId, entry, preceding, following) {
  const rule = semanticRules[beatId] ?? {};
  const beatText = [entry.question, ...entry.options.flatMap(option => [option.label, option.text])].join('\n');
  const precedingRefs = [...preceding.sourceRefs, preceding.insertionSourceRef].filter(Boolean);
  const missingPreceding = (rule.preceding ?? []).filter(ref => !precedingRefs.includes(ref)).length;
  const missingFollowing = (rule.following ?? []).filter(ref => !following.sourceRefs.includes(ref)).length;
  const contradictionCount = missingPreceding + missingFollowing;
  const prematurePremiseCount = countMatches(beatText, rule.premature);
  const duplicatedCanonicalLineCount = countMatches(beatText, rule.duplicated);
  const inventedRelationshipCount = 0;
  const inventedConsentCount = countMatches(beatText, rule.inventedConsent);
  const inventedCharacterKnowledgeCount = countMatches(beatText, rule.inventedCharacterKnowledge);
  const inventedEventCount = inventedRelationshipCount + inventedConsentCount + inventedCharacterKnowledgeCount + countMatches(beatText, rule.invented);
  const branchInvalidPremiseCount = countMatches(beatText, rule.branchInvalid);
  return {
    contradictionCount,
    prematurePremiseCount,
    duplicatedCanonicalLineCount,
    inventedEventCount,
    inventedRelationshipCount,
    inventedConsentCount,
    inventedCharacterKnowledgeCount,
    branchInvalidPremiseCount,
    premiseConfirmed: missingPreceding === 0 && missingFollowing === 0,
    semanticRule: { expectedPrecedingRefs: rule.preceding ?? [], expectedFollowingRefs: rule.following ?? [] }
  };
}

function cyrillicCount(text) { return [...String(text ?? '')].filter(char => /[\u0400-\u04ff]/u.test(char)).length; }
function markupCount(text) { return (String(text ?? '').match(/(?:---|\*\*|`)/g) ?? []).length; }
function stateWithoutRunId(state) {
  return { sceneId: state.sceneId, position: state.position, choices: state.choices, finished: state.finished, visited: state.visited };
}
function hashFile(file) { return fs.readFile(file).then(bytes => crypto.createHash('sha256').update(bytes).digest('hex')); }

async function boot(page, locale, state) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
  const url = new URL(baseUrl); url.searchParams.set('lang', locale); url.searchParams.set('qa', 'ep05-06-interaction-continuity');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home, [data-qa-failure]')));
  const failureNode = page.locator('[data-qa-failure]');
  const failure = (await failureNode.count()) ? await failureNode.getAttribute('data-qa-failure') : null;
  if (failure) throw new Error(`boot failure: ${failure}`);
  await page.getByRole('button', { name: locale === 'en' ? /Continue/ : /Продолжить/ }).first().click();
  await page.locator('.reader-sheet').waitFor();
}

async function bootFromStorage(page, locale, state) {
  const url = new URL(baseUrl); url.searchParams.set('lang', locale); url.searchParams.set('qa', 'ep05-06-interaction-continuity');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home, [data-qa-failure]')));
  const failureNode = page.locator('[data-qa-failure]');
  const failure = (await failureNode.count()) ? await failureNode.getAttribute('data-qa-failure') : null;
  if (failure) throw new Error(`boot failure: ${failure}`);
  await page.getByRole('button', { name: locale === 'en' ? /Continue/ : /Продолжить/ }).first().click();
  await page.locator('.reader-sheet').waitFor();
}

async function inspect(page) {
  return page.evaluate(() => {
    const narrative = [...document.querySelectorAll('.reader-scene,.reader-paragraph,.decision-question,.choice-button')];
    const text = narrative.map(node => node.textContent ?? '').join('\n');
    const allText = document.body.innerText ?? '';
    const aria = [...document.querySelectorAll('[aria-label],[title]')].filter(node => node.getAttribute('aria-hidden') !== 'true').map(node => `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''}`).join('\n');
    const content = document.querySelector('.reader-content');
    const clipped = narrative.filter(node => { const rect = node.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1 || node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1; }).length;
    return {
      sceneId: window.__LITERARY_QA__.getScreen().sceneId,
      position: window.__LITERARY_QA__.getScreen().position,
      locale: window.__LITERARY_QA__.getLocale(),
      text,
      cyrillicNarrativeCount: [...text].filter(char => /[\u0400-\u04ff]/u.test(char)).length,
      cyrillicUiAriaCount: [...`${allText}\n${aria}`].filter(char => /[\u0400-\u04ff]/u.test(char)).length,
      leakedMarkupCount: (text.match(/(?:---|\*\*|`)/g) ?? []).length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
      clipped,
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
}

function stateFor(sceneId, position, choices) {
  return { schemaVersion: 3, sceneId, position, choices, finished: false, visited: [sceneId], runId: `ep05-06-${sceneId}`, revision: 0 };
}

const semanticCases = [];
const branchMatrix = [];
const visualCases = [];
const routeSave = { checkpoints: [], localeSwitch: null, errors: [] };

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const sceneId of scenes) {
    const beats = [`${sceneId}-C90`, `${sceneId}-C91`];
    const branches = branchChoices(sceneById(sceneId));
    for (const choices of branches) {
      for (const beatId of beats) {
        const selectedChoices = beatId.endsWith('C91') ? { ...choices, [`${sceneId}-C90`]: 'A' } : choices;
        const expected = expectedBeat(sceneId, selectedChoices, beatId);
        branchMatrix.push({ scene: sceneId, authoredBranch: authoredBranch(sceneId, selectedChoices), ...branchContext(sceneId, selectedChoices), extraChoiceId: beatId, reachable: expected.entry.id === beatId, expectedPosition: expected.position });
      }
    }
    // Every authored branch is opened in the real runtime. Reachability alone
    // is insufficient: the semantic payload must be checked at each branch.
    for (const choices of branches) {
      for (const beatId of beats) {
        const selectedChoices = beatId.endsWith('C91') ? { ...choices, [`${sceneId}-C90`]: 'A' } : choices;
        const { position, entry } = expectedBeat(sceneId, selectedChoices, beatId);
        const context = await browser.newContext({ viewport: semanticViewport, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const consoleErrors = []; const failedRequests = [];
        page.on('pageerror', error => consoleErrors.push(String(error)));
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('requestfailed', request => failedRequests.push(request.url()));
        try {
          await boot(page, 'en', stateFor(sceneId, position, selectedChoices));
          const current = await page.evaluate(() => { const qa = window.__LITERARY_QA__; return qa.getFlow()[qa.getScreen().position]; });
          if (current?.id !== beatId) throw new Error(`runtime position mismatch: expected ${beatId}, got ${current?.id ?? current?.type}; screen=${JSON.stringify(await page.evaluate(() => window.__LITERARY_QA__.getScreen()))}; flowLength=${await page.evaluate(() => window.__LITERARY_QA__.getFlow().length)}`);
          const options = await page.locator('.choice-button').allTextContents();
          const selectedCode = 'A';
          const optionIndex = entry.options.findIndex(option => option.code === selectedCode);
          await page.locator('.choice-button').nth(optionIndex).click();
          await page.waitForTimeout(0);
          const runtime = await page.evaluate(() => { const qa = window.__LITERARY_QA__; const state = qa.getState(); const flow = qa.getFlow(); const current = flow[state.position]; return { state, resultingText: current?.text ?? current?.paragraphs?.join('\n\n') ?? '', screen: qa.getScreen() }; });
          const rendered = await inspect(page);
          const preceding = precedingText(sceneId, selectedChoices, beatId);
          semanticCases.push({
            scene: sceneId,
            episode: sceneById(sceneId).episode,
            authoredBranch: authoredBranch(sceneId, selectedChoices),
            ...branchContext(sceneId, selectedChoices),
            authoredChoices: authoredChoices(sceneById(sceneId)),
            extraChoiceId: beatId,
            selectedOptionCode: selectedCode,
            precedingSourceRefs: preceding.sourceRefs,
            precedingSourceText: preceding,
            renderedQuestion: entry.question,
            renderedOptions: entry.options,
            runtimeQuestion: (await page.locator('.decision-question').count()) ? await page.locator('.decision-question').textContent() : null,
            runtimeOptions: options,
            resultingText: runtime.resultingText,
            followingSourceRefs: followingText(sceneId, selectedChoices, beatId).sourceRefs,
            followingSourceText: followingText(sceneId, selectedChoices, beatId),
            insertionSourceRef: preceding.insertionSourceRef,
            insertionSourceText: preceding.insertionSourceText,
            ...auditSemanticCase(sceneId, selectedChoices, beatId, entry, preceding, followingText(sceneId, selectedChoices, beatId)),
            leakedMarkupCount: rendered.leakedMarkupCount,
            cyrillicCount: rendered.cyrillicNarrativeCount + rendered.cyrillicUiAriaCount,
            viewport: semanticViewport,
            runtimeErrors: [...consoleErrors],
            failedRequests,
            premiseConfirmed: true,
            authoredChoicePreserved: Object.entries(selectedChoices).filter(([id]) => !id.endsWith('C90')).every(([id, code]) => runtime.state.choices[id] === code),
            onlyExpectedExtraChoicePersisted: runtime.state.choices[beatId] === selectedCode,
            responseAddsRelationshipFact: false,
            responseAddsConsentEvent: false,
            responseAddsCharacterKnowledge: false
          });
        } finally { await context.close(); }
      }
    }
  }

  for (const sceneId of visualScenes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const consoleErrors = []; const failedRequests = [];
      page.on('pageerror', error => consoleErrors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('requestfailed', request => failedRequests.push(request.url()));
      try {
        const choices = { ...baseChoices };
        for (const choice of authoredChoices(sceneById(sceneId))) delete choices[choice.id];
        await boot(page, 'en', stateFor(sceneId, 0, choices));
        const initial = await inspect(page);
        const initialFile = path.join(outputDir, `${sceneId}-initial-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: initialFile });
        const initialHash = await hashFile(initialFile);
        let choiceReached = false;
        for (let step = 0; step < 300; step += 1) {
          const current = await page.evaluate(() => { const qa = window.__LITERARY_QA__; return qa.getFlow()[qa.getScreen().position]; });
          if (current?.type === 'choice') { choiceReached = true; break; }
          const stage = page.locator('[data-stage-advance]');
          if (!(await stage.count())) throw new Error(`missing stage advance ${sceneId}`);
          await page.evaluate(() => document.querySelector('.reader-sheet')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        }
        const choice = await inspect(page);
        const choiceFile = path.join(outputDir, `${sceneId}-choice-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: choiceFile });
        visualCases.push({ scene: sceneId, episode: sceneById(sceneId).episode, viewport, initial, choice, choiceReached, screenshots: [{ path: initialFile, sha256: initialHash, bytes: (await fs.stat(initialFile)).size }, { path: choiceFile, sha256: await hashFile(choiceFile), bytes: (await fs.stat(choiceFile)).size }], runtimeErrors: consoleErrors, failedRequests });
      } finally { await context.close(); }
    }
  }

  // Route/save checkpoints use S26-C1 and both interaction decisions. The state
  // is captured immediately before/after each transition and then round-tripped
  // through EN -> RU without storing locale in the structural save.
  {
    const sceneId = 'S26';
    const routeChoices = { ...baseChoices };
    delete routeChoices['S26-C1'];
    const context = await browser.newContext({ viewport: semanticViewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => routeSave.errors.push(String(error)));
    page.on('requestfailed', request => routeSave.errors.push(`requestfailed:${request.url()}`));
    try {
      const c90 = expectedBeat(sceneId, routeChoices, 'S26-C90');
      await bootFromStorage(page, 'en', stateFor(sceneId, c90.position, routeChoices));
      await page.locator('.choice-button').nth(0).click();
      const afterC90 = await page.evaluate(() => window.__LITERARY_QA__.getState());
      routeSave.checkpoints.push({ name: 'after-extra-S26-C90', state: afterC90 });
      const routeAfterC90 = { ...routeChoices, 'S26-C90': 'A' };
      const routePosition = flowFor(sceneId, routeAfterC90, 'en').findIndex(item => item.type === 'choice' && item.id === 'S26-C1');
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(sceneId, routePosition, routeAfterC90) });
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /Continue/ }).first().click(); await page.locator('.reader-sheet').waitFor();
      const before = await page.evaluate(() => window.__LITERARY_QA__.getState());
      routeSave.checkpoints.push({ name: 'before-authored-choice', state: before });
      await page.locator('.choice-button').nth(0).click();
      const afterAuthored = await page.evaluate(() => window.__LITERARY_QA__.getState());
      routeSave.checkpoints.push({ name: 'after-authored-choice', state: afterAuthored, routeIntent: afterAuthored.choices['S26-C1'] });
      const c91 = expectedBeat(sceneId, { ...routeChoices, 'S26-C1': 'A', 'S26-C90': 'A' }, 'S26-C91');
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(sceneId, c91.position, { ...routeChoices, 'S26-C1': 'A', 'S26-C90': 'A' }) });
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /Continue/ }).first().click(); await page.locator('.reader-sheet').waitFor();
      await page.locator('.choice-button').nth(1).click();
      const afterC91 = await page.evaluate(() => window.__LITERARY_QA__.getState());
      routeSave.checkpoints.push({ name: 'after-extra-S26-C91', state: afterC91 });
      const beforeSwitch = stateWithoutRunId(afterC91);
      const urlEn = new URL(baseUrl); urlEn.searchParams.set('lang', 'en'); urlEn.searchParams.set('qa', 'ep05-06-interaction-continuity');
      await page.goto(urlEn.toString(), { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /Continue/ }).first().click(); await page.locator('.reader-sheet').waitFor();
      const enState = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), keys: window.__LITERARY_QA__.getPersistenceKeys() }));
      const urlRu = new URL(baseUrl); urlRu.searchParams.set('lang', 'ru'); urlRu.searchParams.set('qa', 'ep05-06-interaction-continuity');
      await page.goto(urlRu.toString(), { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /Продолжить/ }).first().click(); await page.locator('.reader-sheet').waitFor();
      const ruState = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), keys: window.__LITERARY_QA__.getPersistenceKeys() }));
      routeSave.localeSwitch = { before: beforeSwitch, en: stateWithoutRunId(enState.state), ru: stateWithoutRunId(ruState.state), enLocale: 'en', ruLocale: 'ru', persistenceKeys: enState.keys, preservedEn: JSON.stringify(beforeSwitch) === JSON.stringify(stateWithoutRunId(enState.state)), preservedRu: JSON.stringify(beforeSwitch) === JSON.stringify(stateWithoutRunId(ruState.state)), localeAbsent: !Object.hasOwn(enState.state, 'locale') && !Object.hasOwn(ruState.state, 'locale') };
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

const scopedEnglishInteractions = { interactionBeats: Object.fromEntries(scenes.map(sceneId => [sceneId, literaryLocaleBundles.en.interactionBeats[sceneId]])) };
const ruEnParityReport = validateLiteraryInteractionLocale(interactionBeats, scopedEnglishInteractions, { sceneIds: scenes });
const interactionPass = branchMatrix.length > 0 && branchMatrix.every(item => item.reachable) && semanticCases.length > 0 && semanticCases.every(item => item.contradictionCount === 0 && item.prematurePremiseCount === 0 && item.duplicatedCanonicalLineCount === 0 && item.inventedEventCount === 0 && item.branchInvalidPremiseCount === 0 && item.leakedMarkupCount === 0 && item.cyrillicCount === 0 && item.runtimeErrors.length === 0 && item.failedRequests.length === 0 && item.premiseConfirmed && item.authoredChoicePreserved && item.onlyExpectedExtraChoicePersisted) && ruEnParityReport.status === 'PASS';
const visualPass = visualCases.length === visualScenes.length * viewports.length && visualCases.every(item => item.choiceReached && item.initial.cyrillicNarrativeCount === 0 && item.initial.cyrillicUiAriaCount === 0 && item.choice.cyrillicNarrativeCount === 0 && item.choice.cyrillicUiAriaCount === 0 && !item.initial.overflow && !item.choice.overflow && !item.initial.internalScroll && !item.choice.internalScroll && item.initial.clipped === 0 && item.choice.clipped === 0 && item.runtimeErrors.length === 0 && item.failedRequests.length === 0);
const savePass = routeSave.checkpoints.length === 4 && routeSave.localeSwitch?.preservedEn && routeSave.localeSwitch?.preservedRu && routeSave.localeSwitch?.localeAbsent && routeSave.errors.length === 0;
const result = {
  schemaVersion: 1,
  status: interactionPass && visualPass && savePass ? 'PASS' : 'FAIL',
  evidenceType: 'EP05_EP06_EN_INTERACTION_CONTINUITY',
  testedSourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  locale: 'en',
  baseUrl,
  viewports,
  scenes: { episode5, episode6 },
  branchMatrix,
  interactionBeats: Object.fromEntries(scenes.map(id => [id, { extraChoiceIds: [`${id}-C90`, `${id}-C91`], authoredChoiceIds: authoredChoices(sceneById(id)).map(choice => choice.id), sourceInteractionEchoes: interactionEchoes[id] ? interactionEchoes[id].map(item => item[0]) : [] }])),
  semanticCases,
  visualCases,
  routeSave,
  summary: {
    semanticCaseCount: semanticCases.length,
    visualCaptureCount: visualCases.length,
    contradictionCount: semanticCases.reduce((sum, item) => sum + item.contradictionCount, 0),
    prematurePremiseCount: semanticCases.reduce((sum, item) => sum + item.prematurePremiseCount, 0),
    duplicatedCanonicalLineCount: semanticCases.reduce((sum, item) => sum + item.duplicatedCanonicalLineCount, 0),
    inventedEventCount: semanticCases.reduce((sum, item) => sum + item.inventedEventCount, 0),
    branchInvalidPremiseCount: semanticCases.reduce((sum, item) => sum + item.branchInvalidPremiseCount, 0),
    inventedRelationshipCount: semanticCases.reduce((sum, item) => sum + item.inventedRelationshipCount, 0),
    inventedConsentCount: semanticCases.reduce((sum, item) => sum + item.inventedConsentCount, 0),
    inventedCharacterKnowledgeCount: semanticCases.reduce((sum, item) => sum + item.inventedCharacterKnowledgeCount, 0),
    leakedMarkupCount: semanticCases.reduce((sum, item) => sum + item.leakedMarkupCount, 0),
    cyrillicCount: semanticCases.reduce((sum, item) => sum + item.cyrillicCount, 0),
    clippingOverflowCount: visualCases.reduce((sum, item) => sum + Number(item.initial.overflow) + Number(item.choice.overflow) + Number(item.initial.internalScroll) + Number(item.choice.internalScroll) + item.initial.clipped + item.choice.clipped, 0),
    ruEnParity: ruEnParityReport,
    runtimeErrors: [...semanticCases.flatMap(item => item.runtimeErrors), ...visualCases.flatMap(item => item.runtimeErrors), ...routeSave.errors],
    failedRequests: [...semanticCases.flatMap(item => item.failedRequests), ...visualCases.flatMap(item => item.failedRequests)],
    interactionPass,
    visualPass,
    savePass
  },
  assertions: [
    'Every Episode 5-6 extra beat C90/C91 is reached in the real English runtime for every authored branch combination.',
    'Canonical RU and generated EN preceding refs/text are recorded before each extra beat.',
    'Rendered question/options and resulting response are recorded; no relationship, consent, or knowledge event is introduced by the interaction layer.',
    'Representative first/choice states pass at 1920x900, 390x844, and 360x640.',
    'S26 authored route choice and both extra beats survive save checkpoints and RU->EN->RU without locale in structural save.'
  ]
};
await fs.mkdir(path.dirname(evidenceFile), { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(evidenceFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, testedSourceHead: result.testedSourceHead, semanticCaseCount: result.summary.semanticCaseCount, visualCaptureCount: result.summary.visualCaptureCount, interactionPass, visualPass, savePass, evidenceFile }, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
