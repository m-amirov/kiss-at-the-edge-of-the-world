#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html?qa=full-route-interaction';
const output = process.env.LITERARY_QA_OUTPUT ?? 'artifacts/evidence/full-route-interaction-regression-2026-10-01';
const outputDir = output.endsWith('.json') ? path.dirname(output) : output;
const locale = new URL(baseUrl).searchParams.get('lang') === 'en' ? 'en' : 'ru';
const labels = locale === 'en'
  ? { menu: '☰ Menu', settings: 'Settings', episodes: 'Episodes', back: /← Menu/, continue: /Continue/ }
  : { menu: '☰ Меню', settings: 'Настройки', episodes: 'Эпизоды', back: /К меню/, continue: /Продолжить/ };
const evidenceFile = output.endsWith('.json') ? output : path.join(output, 'evidence.json');
const routes = { eric: { code: 'A', ending: 'S44' }, nick: { code: 'B', ending: 'S45' }, damir: { code: 'C', ending: 'S46' }, alice: { code: 'D', ending: 'S47' } };
const viewports = [
  { name: 'desktop', width: 1920, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-small', width: 360, height: 640 },
];
const routeFilter = process.env.LITERARY_QA_ROUTES?.split(',').map(item => item.trim()).filter(Boolean);
const viewportFilter = process.env.LITERARY_QA_VIEWPORTS?.split(',').map(item => item.trim()).filter(Boolean);
const selectedRoutes = Object.entries(routes).filter(([route]) => !routeFilter?.length || routeFilter.includes(route));
const selectedViewports = viewports.filter(viewport => !viewportFilter?.length || viewportFilter.includes(`${viewport.width}x${viewport.height}`));
const clone = value => JSON.parse(JSON.stringify(value));
const sameProgress = (a, b) => JSON.stringify({ sceneId: a.sceneId, position: a.position, choices: a.choices, visited: a.visited }) === JSON.stringify({ sceneId: b.sceneId, position: b.position, choices: b.choices, visited: b.visited });

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];

async function state(page) { return page.evaluate(() => ({ saved: window.__LITERARY_QA__.getState(), screen: window.__LITERARY_QA__.getScreen(), flow: window.__LITERARY_QA__.getFlow() })); }
async function menuGuard(page) {
  const before = (await state(page)).saved;
  await page.getByRole('button', { name: labels.menu, exact: true }).click();
  const opened = (await state(page)).saved;
  if (!sameProgress(before, opened)) throw new Error('menu open advanced narrative');
  await page.getByRole('button', { name: labels.settings, exact: true }).click();
  if (!sameProgress(before, (await state(page)).saved)) throw new Error('settings advanced narrative');
  await page.getByRole('button', { name: labels.back }).click();
  await page.getByRole('button', { name: labels.episodes, exact: true }).click();
  if (!sameProgress(before, (await state(page)).saved)) throw new Error('episodes advanced narrative');
  await page.getByRole('button', { name: labels.back }).click();
  await page.getByRole('button', { name: labels.continue }).click();
  if (!sameProgress(before, (await state(page)).saved)) throw new Error('continue from menu changed narrative');
}
async function stageAction(page, viewport, mode) {
  const stage = page.locator('[data-stage-advance]');
  if (mode === 'keyboard') {
    await stage.focus();
    await page.keyboard.press('ArrowRight');
    return;
  }
  const box = await stage.boundingBox();
  if (!box) throw new Error('stage advance target has no bounds');
  if (mode === 'touch' && viewport.name === 'mobile') {
    await page.touchscreen.tap(box.x + box.width * .72, box.y + box.height * .28);
  } else {
    await stage.click({ position: { x: box.width * .72, y: box.height * .28 } });
  }
}

try {
  for (const [route, contract] of selectedRoutes) for (const viewport of selectedViewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.name === 'mobile', isMobile: viewport.name === 'mobile' });
    const page = await context.newPage();
    const errors = []; const failed = []; const ignoredFailedRequests = []; const layoutFindings = []; const controlledReaderScrolls = [];
    const modes = viewport.name.startsWith('mobile') ? ['touch', 'keyboard'] : ['click', 'keyboard'];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => {
      const failure = { url: request.url(), errorText: request.failure()?.errorText ?? 'unknown' };
      if (failure.errorText === 'net::ERR_ABORTED' && /\/assets\/audio\/music\//u.test(failure.url)) ignoredFailedRequests.push({ ...failure, reason: 'intentional audio cue replacement or teardown' });
      else failed.push(failure);
    });
    page.on('response', response => {
      if (response.status() >= 400 && !/\/sdk\.js(?:$|\?)/u.test(response.url())) failed.push({ url: response.url(), status: response.status() });
    });
    await page.route('**/sdk.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.YaGames = undefined;' }));
    await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: literarySaveKey, value: { schemaVersion: 3, sceneId: 'S01', position: 0, choices: {}, finished: false, visited: ['S01'], runId: `interaction-${route}-${viewport.name}-${Date.now()}`, revision: 0 } });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: labels.continue }).click();
    await menuGuard(page);
    let steps = 0; let choiceBoundaries = 0; let saveLoadChecked = false; let doubleAdvanceFailures = 0; let terminal = null;
    while (steps < 1800) {
      const current = await state(page);
      const layout = await page.evaluate(() => {
        const content = document.querySelector('.reader-content');
        return {
          viewport: [innerWidth, innerHeight],
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
          scrollTop: document.scrollingElement?.scrollTop ?? 0,
        };
      });
      if (layout.overflow) layoutFindings.push({ kind: 'unexpected-document-overflow', sceneId: current.saved.sceneId, position: current.saved.position, layout });
      if (layout.internalScroll) controlledReaderScrolls.push({ sceneId: current.saved.sceneId, position: current.saved.position, layout, reason: 'reader-content has explicit controlled overflow:auto; document viewport remains fixed' });
      if (current.saved.finished && await page.locator('.terminal-sheet').count()) {
        terminal = current.saved;
        break;
      }
      const entry = current.flow[current.saved.position];
      if (!entry) {
        const next = page.locator('.reader-sheet > .primary');
        if (!await next.count()) throw new Error(`soft-lock at ${current.saved.sceneId}:${current.saved.position}`);
        await next.click();
        steps += 1;
        continue;
      }
      if (entry.type === 'choice') {
        choiceBoundaries += 1;
        const beforeChoice = clone(current.saved);
        const stage = page.locator('[data-stage-advance]');
        const box = await stage.boundingBox();
        if (!box) throw new Error('choice stage has no bounds');
        await page.mouse.click(box.x + box.width * .72, box.y + box.height * .12);
        if (!sameProgress(beforeChoice, (await state(page)).saved)) throw new Error(`tap advanced at choice boundary ${entry.id}`);
        const selected = entry.id === 'S17-C2' || entry.id === 'S26-C1' ? contract.code : entry.options[0]?.code;
        const index = entry.options.findIndex(option => option.code === selected);
        if (index < 0) throw new Error(`missing choice ${selected} for ${entry.id}`);
        await page.locator('.choice-button').nth(index).click();
        const afterChoice = await state(page);
        if (afterChoice.saved.choices[entry.id] !== selected || afterChoice.saved.position !== beforeChoice.position || afterChoice.saved.sceneId !== beforeChoice.sceneId) throw new Error(`choice boundary advanced unexpectedly ${entry.id}`);
        steps += 1;
        continue;
      }
      if (entry.type === 'page') {
        const before = current.saved;
        const mode = modes[steps % modes.length];
        await stageAction(page, viewport, mode);
        const after = (await state(page)).saved;
        const advancedOne = after.sceneId === before.sceneId && after.position === before.position + 1;
        const crossedScene = after.sceneId !== before.sceneId && after.position === 0 && after.visited.length === before.visited.length + 1;
        if (!advancedOne && !crossedScene) { doubleAdvanceFailures += 1; const visibleChoices = await page.locator('.choice-button').count(); throw new Error(`unexpected advance ${before.sceneId}:${before.position} -> ${after.sceneId}:${after.position} via ${mode}; entry=${entry.type}; visibleChoices=${visibleChoices}; active=${await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName)}`); }
        if (!saveLoadChecked && steps > 12) {
          const snapshot = clone(after);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: labels.continue }).click();
          const restored = (await state(page)).saved;
          if (!sameProgress(snapshot, restored)) throw new Error(`save/load mismatch at ${snapshot.sceneId}:${snapshot.position}; expected=${JSON.stringify({ sceneId: snapshot.sceneId, position: snapshot.position, choices: snapshot.choices, visited: snapshot.visited })}; actual=${JSON.stringify({ sceneId: restored.sceneId, position: restored.position, choices: restored.choices, visited: restored.visited })}`);
          saveLoadChecked = true;
        }
      } else {
        const next = page.locator('.reader-sheet > .primary');
        if (!await next.count()) throw new Error(`missing continuation at ${current.saved.sceneId}:${current.saved.position}`);
        await next.click();
      }
      steps += 1;
    }
    if (!terminal) throw new Error(`route did not terminate within ${steps} steps`);
    const result = { route, viewport: { width: viewport.width, height: viewport.height }, ending: terminal.sceneId, expectedEnding: contract.ending, finished: terminal.finished, visited: terminal.visited.length, choiceCount: Object.keys(terminal.choices).length, steps, choiceBoundaries, saveLoadChecked, doubleAdvanceFailures, layoutFindings, controlledReaderScrolls, ignoredFailedRequests, errors, failed };
    results.push(result);
    await context.close();
  }
} catch (error) {
  results.push({ status: 'FAIL', error: String(error), errors: [], failed: [], layoutFindings: [], controlledReaderScrolls: [], ignoredFailedRequests: [] });
} finally {
  await browser.close();
}

const expectedCases = selectedRoutes.length * selectedViewports.length;
const pass = results.length === expectedCases && results.every(item => item.ending === item.expectedEnding && item.finished && item.saveLoadChecked && item.doubleAdvanceFailures === 0 && item.layoutFindings.length === 0 && item.errors.length === 0 && item.failed.length === 0);
const evidence = { schemaVersion: 1, status: pass ? 'PASS' : 'FAIL', generatedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baseUrl, interactionModel: ['click', 'touch', 'keyboard'], requirements: ['choice boundary guard', 'menu/settings/episodes guard', 'save/load', '4/4 endings', 'no skipped chunks', 'no double-advance', 'no soft-lock', 'HTTP 4xx/5xx absent', 'document overflow absent', 'controlled reader-content scroll classified separately'], results };
await fs.writeFile(evidenceFile, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
if (!pass) process.exitCode = 1;
