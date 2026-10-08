import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';
import { literarySeason } from '../../src/literary-season-data.js';
import { interactionBeats } from '../../src/literary-interactive-beats.js';

const root = process.cwd();
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4175/literary.html';
const output = path.resolve('artifacts/evidence/production-art-batch2/neighbors');
const viewports = [{ name: 'desktop', width: 1920, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const targets = [
  ['S01-before-airport', 'S01', 4, 'nick-arrives'],
  ['S01-after-damir', 'S01', 24, 'car-eric'],
  ['S48-before', 'S47', 0, 'alice-morning-harbour'],
  ['S48-after-opening', 'S48', 2, 'scene-start'],
  ['S26-before', 'S25', 0, 's25-damir-clarity-talk'],
  ['S26-after', 'S26', 2, 'guesthouse-courtyard'],
  ['S02-before-road', 'S01', 29, 'car-eric'],
  ['S02-after', 'S02', 31, 'roadside-cafe'],
  ['S60-before', 'S60', 1, 'scene-start'],
  ['S60-after', 'S41', 0, null]
].map(([key, sceneId, position, cue]) => ({ key, sceneId, position, cue }));

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const choices = {};
for (const scene of literarySeason.scenes) for (const chunk of scene.chunks ?? []) {
  const match = chunk.title.match(/(S\d{2}-C\d+)/);
  if (match) choices[match[1]] = 'A';
}
for (const [sceneId, beats] of Object.entries(interactionBeats)) for (let index = 0; index < beats.length; index += 1) choices[`${sceneId}-C${90 + index}`] = 'A';
const stateFor = target => ({ schemaVersion: 3, sceneId: target.sceneId, position: target.position, choices, finished: false, visited: ['S01', target.sceneId], runId: `batch2-neighbor-${target.key}-${Date.now()}`, revision: 0 });
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const evidence = { schemaVersion: 1, generatedAt: new Date().toISOString(), head, baseUrl, viewports, targets: [] };

try {
  for (const target of targets) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const errors = [], failedRequests = [], asset404s = [];
    page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
    page.on('requestfailed', request => { if (!request.url().endsWith('/sdk.js')) failedRequests.push(`${request.url()}:${request.failure()?.errorText ?? 'unknown'}`); });
    page.on('response', response => { if (response.url().includes('/assets/') && response.status() === 404) asset404s.push(response.url()); });
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(target) });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click();
    await page.locator('.literary-picture').waitFor();
    await page.waitForTimeout(100);
    const readback = await page.evaluate(() => {
      const picture = document.querySelector('.literary-picture');
      const image = picture?.querySelector('img');
      return {
        state: window.__LITERARY_QA__?.getState?.() ?? null,
        cue: picture?.dataset.visualBeat ?? null,
        asset: image?.dataset.asset ?? null,
        imageComplete: image?.complete ?? false,
        natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
        stageCount: document.querySelectorAll('.stage-character').length,
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1)
      };
    });
    const screenshotPath = path.join(output, `${target.key}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath });
    const bytes = await fs.readFile(screenshotPath);
    const pass = readback.state?.sceneId === target.sceneId && readback.state?.position === target.position && (!target.cue || readback.cue === target.cue) && readback.imageComplete && readback.natural.every(value => value > 0) && !readback.overflow && !readback.internalScroll && !errors.length && !failedRequests.length && !asset404s.length;
    evidence.targets.push({ ...target, viewport, status: pass ? 'PASS' : 'FAIL', errors, failedRequests, asset404s, readback, screenshot: screenshotPath, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    await context.close();
  }
} finally { await browser.close(); }

const failures = evidence.targets.filter(item => item.status !== 'PASS');
evidence.summary = { targets: evidence.targets.length, passes: evidence.targets.filter(item => item.status === 'PASS').length, failures: failures.length, consoleErrors: evidence.targets.reduce((n, item) => n + item.errors.length, 0), gameOwned404: evidence.targets.reduce((n, item) => n + item.asset404s.length, 0), failedRequests: evidence.targets.reduce((n, item) => n + item.failedRequests.length, 0) };
await fs.writeFile(path.join(output, 'neighbor-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', output, summary: evidence.summary }));
if (failures.length) process.exitCode = 1;
