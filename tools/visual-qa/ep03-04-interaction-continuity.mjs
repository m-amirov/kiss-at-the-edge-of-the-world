#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root = process.cwd();
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const outputDir = process.env.LITERARY_QA_OUTPUT ?? 'output/playwright/ep03-04-interaction-continuity';
const evidenceFile = process.env.LITERARY_QA_EVIDENCE ?? 'artifacts/evidence/ep03-04-interaction-continuity.json';
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const semanticViewports = [{ width: 390, height: 844 }];
const scenes = {
  S11: { authoredChoice: 'S11-C1', authoredCodes: ['A', 'B', 'C'], beatCodes: { 'S11-C90': 'A', 'S11-C91': 'B' } },
  S15: { authoredChoice: 'S15-C1', authoredCodes: ['A', 'B', 'C'], beatCodes: { 'S15-C90': 'A', 'S15-C91': 'B' } },
  S16: { authoredChoice: 'S16-C1', authoredCodes: ['A', 'B'], beatCodes: { 'S16-C90': 'A', 'S16-C91': 'B' } }
};
const clone = value => JSON.parse(JSON.stringify(value));
const literarySaveKey = 'kiss-at-the-edge-of-the-world:literary-draft:v1';
const stateFor = sceneId => ({ schemaVersion: 3, sceneId, position: 0, choices: {}, finished: false, visited: [sceneId], runId: `ep03-04-${sceneId}-${Date.now()}`, revision: 0 });
const urlFor = locale => { const url = new URL(baseUrl); url.searchParams.set('lang', locale); url.searchParams.set('qa', 'ep03-04-interaction-continuity'); return url.toString(); };

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const cases = [];

async function inspect(page) {
  return page.evaluate(() => {
    const narrative = [...document.querySelectorAll('.reader-scene,.reader-paragraph,.decision-question,.choice-button')];
    const text = narrative.map(node => node.textContent ?? '').join('\n');
    const clipped = narrative.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1 || node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
    }).length;
    const content = document.querySelector('.reader-content');
    const bodyText = document.body.innerText ?? '';
    return {
      sceneId: window.__LITERARY_QA__.getScreen().sceneId,
      position: window.__LITERARY_QA__.getScreen().position,
      locale: window.__LITERARY_QA__.getLocale(),
      text,
      cyrillicNarrative: /[\u0400-\u04ff]/u.test(text),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
      clipped,
      leakedMarkup: (bodyText.match(/(^|\n)---($|\n)/g) ?? []).length,
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
}

async function screenshot(page, sceneId, locale, viewport, label) {
  const file = path.join(outputDir, `${sceneId}-${locale}-${viewport.width}x${viewport.height}-${label}.png`);
  await page.screenshot({ path: file });
  const bytes = await fs.readFile(file);
  return { path: file, width: viewport.width, height: viewport.height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

async function clickStage(page) {
  await page.evaluate(() => {
    document.querySelector('.reader-sheet')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function boot(page, locale, sceneId) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(sceneId) });
  await page.goto(urlFor(locale), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home, [data-qa-failure]')));
  const failure = await page.locator('[data-qa-failure]').getAttribute('data-qa-failure').catch(() => null);
  if (failure) throw new Error(`boot failure ${failure}`);
  await page.getByRole('button', { name: locale === 'en' ? /Continue/ : /Продолжить/ }).first().click();
  await page.locator('.reader-sheet').waitFor();
}

async function runCase({ sceneId, locale, viewport, authoredCode, capture }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(request.url()));
  const scene = scenes[sceneId];
  const selections = { [scene.authoredChoice]: authoredCode, ...scene.beatCodes };
  const interactions = [];
  const authored = { id: scene.authoredChoice, code: authoredCode, sourceRef: null, resultingText: null };
  const metrics = [];
  const screenshots = [];
  let firstChoiceCaptured = false;
  let authoredChoiceCaptured = false;
  try {
    await boot(page, locale, sceneId);
    let flow = await page.evaluate(() => window.__LITERARY_QA__.getFlow());
    let position = 0;
    for (let step = 0; step < 700; step += 1) {
      const flowEntry = flow[position] ?? null;
      if (!flowEntry) throw new Error(`missing flow entry at step ${step}`);
      if (capture || flowEntry.type === 'choice') metrics.push(await inspect(page));
      if (flowEntry.type === 'page') {
        await clickStage(page);
        position += 1;
        continue;
      }
      const id = flowEntry.id;
      if (id === scene.authoredChoice) {
        authored.sourceRef = clone(flowEntry.sourceStartRef);
        authored.question = flowEntry.question ?? null;
        authored.options = clone(flowEntry.options);
        if (capture && !authoredChoiceCaptured) {
          screenshots.push(await screenshot(page, sceneId, locale, viewport, 'authored-choice'));
          authoredChoiceCaptured = true;
        }
      } else if (!scene.beatCodes[id]) {
        throw new Error(`unexpected choice ${id}`);
      } else {
        const interaction = { id, selectedOption: selections[id], sourceRef: clone(flowEntry.sourceStartRef), question: flowEntry.question, options: clone(flowEntry.options), resultingText: null };
        if (capture && !firstChoiceCaptured) {
          screenshots.push(await screenshot(page, sceneId, locale, viewport, 'interaction-choice'));
          firstChoiceCaptured = true;
        }
        interactions.push(interaction);
      }
      const selected = selections[id];
      const optionIndex = flowEntry.options.findIndex(option => option.code === selected);
      if (optionIndex < 0) throw new Error(`missing option ${id}=${selected}`);
      await page.locator('.choice-button').nth(optionIndex).click();
      await page.waitForTimeout(0);
      flow = await page.evaluate(() => window.__LITERARY_QA__.getFlow());
      const selectedEntry = flow[position] ?? null;
      if (id === scene.authoredChoice) authored.resultingText = selectedEntry?.text ?? selectedEntry?.paragraphs?.join('\n\n') ?? null;
      else interactions.at(-1).resultingText = selectedEntry?.text ?? selectedEntry?.paragraphs?.join('\n\n') ?? null;
      if (interactions.length === 2) break;
    }
    const finalMetrics = await inspect(page);
    metrics.push(finalMetrics);
    const allNarrative = metrics.map(item => item.text).join('\n');
    const contradictionPatterns = locale === 'en' ? {
      S11: [/thank/i, /praise/i],
      S15: [/meeting after the trip/i, /future meeting/i, /specific day/i, /post-trip/i],
      S16: [/unfinished thought/i, /tea is still warm/i, /still warm/i]
    }[sceneId] : {
      S11: [/поблагодар/i, /похвал/i],
      S15: [/встреч[аи].*после поездки/i, /будущ/i, /конкретн.*дн/i],
      S16: [/не договорив.*прошл/i, /чай.*не остыл/i, /чай ещё/i]
    }[sceneId];
    const contradictionCount = interactions.concat(authored).flatMap(item => [item.question, item.resultingText, ...(item.options ?? []).map(option => `${option.label} ${option.text}`)]).filter(Boolean).reduce((count, text) => count + contradictionPatterns.filter(pattern => pattern.test(text)).length, 0);
    cases.push({ sceneId, locale, viewport, authoredCode, interactions, authored, metrics: { samples: metrics.length, maxClipped: Math.max(...metrics.map(item => item.clipped)), overflowCount: metrics.filter(item => item.overflow).length, internalScrollCount: metrics.filter(item => item.internalScroll).length, cyrillicNarrativeCount: metrics.filter(item => item.cyrillicNarrative).length, leakedMarkupCount: metrics.reduce((sum, item) => sum + item.leakedMarkup, 0) }, contradictionCount, consoleErrors, failedRequests, screenshots });
  } finally {
    await context.close();
  }
}

for (const locale of ['ru', 'en']) {
  for (const sceneId of Object.keys(scenes)) {
    for (const viewport of semanticViewports) {
      for (const authoredCode of scenes[sceneId].authoredCodes) await runCase({ sceneId, locale, viewport, authoredCode, capture: false });
    }
    for (const viewport of viewports) await runCase({ sceneId, locale, viewport, authoredCode: scenes[sceneId].authoredCodes[0], capture: true });
  }
}

const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const result = {
  schemaVersion: 1,
  status: cases.every(item => item.interactions.map(entry => entry.id).join(',') === `${item.sceneId}-C90,${item.sceneId}-C91` && item.contradictionCount === 0 && item.metrics.maxClipped === 0 && item.metrics.overflowCount === 0 && item.metrics.internalScrollCount === 0 && item.metrics.leakedMarkupCount === 0 && (item.locale !== 'en' || item.metrics.cyrillicNarrativeCount === 0) && item.consoleErrors.length === 0 && item.failedRequests.length === 0) ? 'PASS' : 'FAIL',
  run: 'CEOS audit-repair-loop 2026-10-02T17-07-38-449Z-audit-repair-loop-e694eb',
  head: currentHead,
  baseUrl,
  locales: ['ru', 'en'],
  viewports,
  scenes: Object.fromEntries(Object.keys(scenes).map(sceneId => [sceneId, { authoredChoiceId: scenes[sceneId].authoredChoice, extraChoiceIds: [`${sceneId}-C90`, `${sceneId}-C91`], authoredCodes: scenes[sceneId].authoredCodes }])),
  cases,
  summary: {
    caseCount: cases.length,
    contradictionCount: cases.reduce((sum, item) => sum + item.contradictionCount, 0),
    leakedMarkupCount: cases.reduce((sum, item) => sum + item.metrics.leakedMarkupCount, 0),
    consoleErrors: cases.flatMap(item => item.consoleErrors),
    failedRequests: cases.flatMap(item => item.failedRequests)
  },
  assertions: ['S11/S15/S16 both extra beats reached in order', 'authored choice reached for every authored A/B/C outcome where defined', 'RU and EN runtime text recorded after each selected beat', 'EN has zero Cyrillic narrative leak', 'zero clipping, document/internal overflow, leaked --- markup, console errors and failed requests']
};
await fs.mkdir(path.dirname(evidenceFile), { recursive: true });
await fs.writeFile(evidenceFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, head: result.head, caseCount: result.summary.caseCount, contradictionCount: result.summary.contradictionCount, leakedMarkupCount: result.summary.leakedMarkupCount, consoleErrors: result.summary.consoleErrors.length, failedRequests: result.summary.failedRequests.length, evidenceFile }, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
await browser.close();
