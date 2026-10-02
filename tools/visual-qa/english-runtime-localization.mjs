#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const outputDir = process.env.LITERARY_QA_OUTPUT ?? 'output/playwright/english-runtime-localization';
const evidenceFile = process.env.LITERARY_QA_EVIDENCE ?? 'artifacts/evidence/english-runtime-localization.json';
const targets = ['S01', 'S05', 'S08', 'S66'];
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const stateFor = sceneId => ({ schemaVersion: 3, sceneId, position: 0, choices: {}, finished: false, visited: [sceneId], runId: `english-runtime-${sceneId}`, revision: 0 });
const clone = value => JSON.parse(JSON.stringify(value));
const sameStructuralState = (a, b) => JSON.stringify({ sceneId: a.sceneId, position: a.position, choices: a.choices, finished: a.finished, visited: a.visited }) === JSON.stringify({ sceneId: b.sceneId, position: b.position, choices: b.choices, finished: b.finished, visited: b.visited });
const urlFor = locale => { const url = new URL(baseUrl); url.searchParams.set('lang', locale); url.searchParams.set('qa', 'english-runtime-localization'); return url.toString(); };

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];

async function boot(page, locale) {
  await page.goto(urlFor(locale), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home, [data-qa-failure]')));
  const boot = await page.evaluate(() => ({ locale: window.__LITERARY_QA__?.getLocale?.(), mode: window.__LITERARY_QA__?.getPlatformMode?.(), failure: document.querySelector('[data-qa-failure]')?.dataset.qaFailure ?? null }));
  if (boot.failure) throw new Error(`boot failure ${boot.failure}`);
  if (boot.locale !== locale) throw new Error(`locale mismatch: expected ${locale}, got ${boot.locale}`);
  await page.getByRole('button', { name: locale === 'en' ? /Continue/ : /Продолжить/ }).first().click();
  await page.locator('.reader-sheet').waitFor();
  return boot;
}

async function inspect(page) {
  return page.evaluate(() => {
    const narrative = [...document.querySelectorAll('.reader-scene,.reader-paragraph,.decision-question,.choice-button')];
    const text = narrative.map(node => node.textContent ?? '').join('\n');
    const clipped = narrative.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1 || node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
    }).length;
    const content = document.querySelector('.reader-content');
    const choices = [...document.querySelectorAll('.choice-button')].map(button => button.textContent.trim());
    return {
      sceneId: window.__LITERARY_QA__.getScreen().sceneId,
      locale: window.__LITERARY_QA__.getLocale(),
      narrativeText: text,
      hasEnglishProse: Boolean(document.querySelector('.reader-paragraph')),
      russianNarrativeLeak: /[\u0400-\u04ff]/u.test(text),
      choiceLabels: choices,
      choiceLabelsEnglish: choices.length > 0 && choices.every(label => !/[\u0400-\u04ff]/u.test(label)),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
      clipped,
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
}

async function clickStage(page) {
  const stage = page.locator('[data-stage-advance]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('stage advance target is not visible');
  await stage.click({ position: { x: box.width * 0.72, y: box.height * 0.28 } });
}

async function advanceToChoice(page) {
  for (let step = 0; step < 700; step += 1) {
    const type = await page.evaluate(() => window.__LITERARY_QA__.getFlow()[window.__LITERARY_QA__.getScreen().position]?.type ?? null);
    if (type === 'choice') {
      await page.locator('.choice-button').first().waitFor();
      return;
    }
    if (type !== 'page') throw new Error(`no choice reachable after ${step} steps`);
    await clickStage(page);
  }
  throw new Error('choice search exceeded 700 pages');
}

async function captureTarget(sceneId, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleErrors = []; const failedRequests = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(request.url()));
  try {
    await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); }, { key: literarySaveKey, value: stateFor(sceneId) });
    const bootState = await boot(page, 'en');
    const initial = await inspect(page);
    const initialScreenshot = path.join(outputDir, `${sceneId}-prose-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: initialScreenshot });
    const initialBytes = await fs.readFile(initialScreenshot);
    await advanceToChoice(page);
    const choice = await inspect(page);
    const choiceScreenshot = path.join(outputDir, `${sceneId}-choice-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: choiceScreenshot });
    const choiceBytes = await fs.readFile(choiceScreenshot);
    const result = {
      sceneId, viewport, boot: bootState, initial, choice,
      screenshots: [
        { path: initialScreenshot, width: viewport.width, height: viewport.height, bytes: initialBytes.length, sha256: crypto.createHash('sha256').update(initialBytes).digest('hex') },
        { path: choiceScreenshot, width: viewport.width, height: viewport.height, bytes: choiceBytes.length, sha256: crypto.createHash('sha256').update(choiceBytes).digest('hex') }
      ],
      consoleErrors, failedRequests
    };
    captures.push(result);
  } finally {
    await context.close();
  }
}

async function checkSaveLoadAndLocaleSwitch() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleErrors = []; const failedRequests = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(request.url()));
  try {
    await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); }, { key: literarySaveKey, value: stateFor('S05') });
    await boot(page, 'ru');
    await clickStage(page);
    const beforeReload = await page.evaluate(() => window.__LITERARY_QA__.getState());
    const keysBefore = await page.evaluate(() => window.__LITERARY_QA__.getPersistenceKeys());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
    await page.getByRole('button', { name: /Продолжить/ }).first().click();
    await page.locator('.reader-sheet').waitFor();
    const afterReload = await page.evaluate(() => window.__LITERARY_QA__.getState());
    const beforeLocaleSwitch = clone(afterReload);
    await page.goto(urlFor('en'), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
    await page.getByRole('button', { name: /Continue/ }).first().click();
    await page.locator('.reader-sheet').waitFor();
    const afterLocaleSwitch = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), keys: window.__LITERARY_QA__.getPersistenceKeys(), locale: window.__LITERARY_QA__.getLocale() }));
    return {
      saveLoadPreserved: sameStructuralState(beforeReload, afterReload),
      localeSwitchPreserved: sameStructuralState(beforeLocaleSwitch, afterLocaleSwitch.state),
      localeAfterSwitch: afterLocaleSwitch.locale,
      persistenceKeysStable: JSON.stringify(keysBefore) === JSON.stringify(afterLocaleSwitch.keys) && keysBefore.local === literarySaveKey,
      states: { beforeReload, afterReload, beforeLocaleSwitch, afterLocaleSwitch: afterLocaleSwitch.state },
      keys: { before: keysBefore, after: afterLocaleSwitch.keys },
      consoleErrors, failedRequests
    };
  } finally {
    await context.close();
  }
}

let switchResult;
try {
  for (const sceneId of targets) for (const viewport of viewports) await captureTarget(sceneId, viewport);
  switchResult = await checkSaveLoadAndLocaleSwitch();
} finally {
  await browser.close();
}

const capturePass = captures.length === targets.length * viewports.length && captures.every(item => item.initial.hasEnglishProse && !item.initial.russianNarrativeLeak && !item.choice.russianNarrativeLeak && item.choice.choiceLabelsEnglish && !item.initial.overflow && !item.choice.overflow && !item.initial.internalScroll && !item.choice.internalScroll && item.initial.clipped === 0 && item.choice.clipped === 0 && item.consoleErrors.length === 0 && item.failedRequests.length === 0);
const status = capturePass && switchResult.saveLoadPreserved && switchResult.localeSwitchPreserved && switchResult.localeAfterSwitch === 'en' && switchResult.persistenceKeysStable && switchResult.consoleErrors.length === 0 && switchResult.failedRequests.length === 0 ? 'PASS' : 'FAIL';
const evidence = {
  schemaVersion: 1,
  status,
  evidenceType: 'ENGLISH_RUNTIME_LOCALIZATION',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  baseUrl,
  locales: { productionSource: 'Yandex SDK locale', qaOverride: 'local ?lang=ru|en only' },
  targets, viewports,
  captures,
  saveLoadAndLocaleSwitch: switchResult,
  assertions: ['actual English prose', 'English choice labels', 'no Russian narrative leakage', 'no viewport overflow/clipping', 'local save/load', 'locale switch leaves structural save unchanged', 'stable local/cloud persistence keys', 'zero console errors', 'zero failed asset requests']
};
await fs.mkdir(path.dirname(evidenceFile), { recursive: true });
await fs.writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status, captures: captures.length, choicesWithEnglish: captures.filter(item => item.choice.choiceLabelsEnglish).length, consoleErrors: captures.reduce((n, item) => n + item.consoleErrors.length, 0) + (switchResult?.consoleErrors.length ?? 0), failedRequests: captures.reduce((n, item) => n + item.failedRequests.length, 0) + (switchResult?.failedRequests.length ?? 0), saveLoad: switchResult?.saveLoadPreserved, localeSwitch: switchResult?.localeSwitchPreserved, evidenceFile }, null, 2));
if (status !== 'PASS') process.exitCode = 1;
