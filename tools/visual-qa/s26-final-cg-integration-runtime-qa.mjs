import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';

const root = process.cwd();
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const output = path.resolve(process.env.S26_FINAL_CG_QA_OUTPUT ?? 'output/playwright/s26-final-cg-integration-2026-10-11');
const evidencePath = path.resolve(process.env.S26_FINAL_CG_EVIDENCE ?? 'artifacts/evidence/s26-final-cg-integration-2026-10-11.json');
const viewports = [
  { id: '1920x900', name: 'desktop', width: 1920, height: 900 },
  { id: '390x844', name: 'portrait390', width: 390, height: 844 },
  { id: '360x640', name: 'portrait360', width: 360, height: 640 }
];
const assets = {
  desktop: 's26-route-choice-courtyard-final.png',
  portrait: 's26-route-choice-courtyard-final-portrait.png'
};

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

function choicesForAllScenes() {
  const choices = {};
  for (const scene of literarySeason.scenes) {
    for (const item of scene.items ?? []) {
      if (item.type === 'choice' && item.id) choices[item.id] = item.options?.[0]?.code ?? 'A';
    }
  }
  choices['S26-C1'] = 'A';
  choices['S26-C90'] = 'A';
  choices['S26-C91'] = 'A';
  return choices;
}

const sceneStartChoices = choicesForAllScenes();
const routeChoiceChoices = choicesForAllScenes();
delete routeChoiceChoices['S26-C90'];
const s26 = literarySeason.scenes.find((scene) => scene.id === 'S26');
const routeChoiceFlow = compileInteractivePlayback(s26, routeChoiceChoices, 'ru');
const routeChoicePosition = routeChoiceFlow.findIndex((entry) => entry.type === 'choice');
if (routeChoicePosition < 0) throw new Error('S26 route choice position was not found');

const targets = [
  { id: 'scene-start', position: 0, choices: sceneStartChoices, expectedCue: 'scene-start', expectedEntryType: 'page' },
  { id: 'route-choice', position: routeChoicePosition, choices: routeChoiceChoices, expectedCue: 'guesthouse-courtyard', expectedEntryType: 'choice' }
];
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceAssets = {};
for (const [key, filename] of Object.entries(assets)) {
  const bytes = await fs.readFile(path.join(root, 'assets/cg', filename));
  sourceAssets[key] = { path: `assets/cg/${filename}`, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

await fs.mkdir(output, { recursive: true });
await fs.mkdir(path.dirname(evidencePath), { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = {
  schemaVersion: 1,
  recordType: 'S26_FINAL_CG_SCOPED_RUNTIME_QA',
  generatedAt: new Date().toISOString(),
  testedSourceHead: sourceHead,
  worktreeState: 'DIRTY_PRESERVED',
  baseUrl,
  sceneId: 'S26',
  sourceRef: 'S26.C000.P000 / S26.C000.P002',
  runtimeHarness: { mode: 'local-fallback', officialSdkBundled: false, sdkRequest: 'empty local test fixture to avoid expected offline /sdk.js 404' },
  assets: sourceAssets,
  targetMapping: { desktop: `assets/cg/${assets.desktop}`, portrait: `assets/cg/${assets.portrait}` },
  viewports,
  visualReview: { status: 'PENDING_LOCAL_PIXEL_REVIEW', actualPixelsReceived: true },
  captures: []
};

try {
  for (const target of targets) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const failedRequests = [];
      const assetFailures = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('requestfailed', (request) => { if (!request.url().endsWith('/sdk.js')) failedRequests.push(`${request.url()}:${request.failure()?.errorText ?? 'unknown'}`); });
      page.on('response', (response) => { if (response.url().includes('/assets/') && response.status() >= 400) assetFailures.push(`${response.status()}:${response.url()}`); });
      await page.route('**/sdk.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      const state = { schemaVersion: 3, sceneId: 'S26', position: target.position, choices: target.choices, finished: false, visited: ['S01', 'S26'], runId: `s26-final-cg-${Date.now()}`, revision: 0 };
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Продолжить|Continue/ }).first().click();
      await page.locator('.literary-picture').waitFor();
      await page.waitForFunction(() => { const image = document.querySelector('.literary-picture img'); return Boolean(image?.complete && image.naturalWidth > 0); });
      const readback = await page.evaluate(() => {
        const picture = document.querySelector('.literary-picture');
        const image = picture?.querySelector('img');
        const sheet = document.querySelector('.reader-sheet');
        const buttons = [...document.querySelectorAll('button')].filter((button) => button.offsetParent !== null);
        const qa = window.__LITERARY_QA__;
        return {
          trace: qa?.getRuntimeTrace?.() ?? null,
          cue: picture?.dataset.visualBeat ?? null,
          presentation: picture?.dataset.mode ?? null,
          asset: image?.dataset.asset ?? null,
          desktopAsset: image?.dataset.desktopAsset ?? null,
          imgSrc: image?.src ?? null,
          natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
          imageComplete: image?.complete ?? false,
          stageCount: document.querySelectorAll('.stage-character').length,
          choiceButtons: document.querySelectorAll('.choice-button').length,
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
          dialogueVisible: Boolean(sheet && sheet.offsetParent !== null),
          controlsWithinViewport: buttons.every((button) => { const rect = button.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; })
        };
      });
      const expectedAsset = viewport.width < 680 ? assets.portrait : assets.desktop;
      const functionalPass = readback.trace?.sceneId === 'S26'
        && readback.trace?.entryType === target.expectedEntryType
        && readback.cue === target.expectedCue
        && readback.asset === expectedAsset
        && readback.desktopAsset === assets.desktop
        && readback.imageComplete
        && readback.natural.every((value) => value > 0)
        && readback.presentation === 'cinematic'
        && readback.stageCount === 0
        && (target.expectedEntryType !== 'choice' || readback.choiceButtons > 0)
        && !readback.overflow
        && !readback.internalScroll
        && readback.dialogueVisible
        && readback.controlsWithinViewport
        && !pageErrors.length
        && !consoleErrors.length
        && !failedRequests.length
        && !assetFailures.length;
      const screenshot = path.join(output, `S26-${target.id}-${viewport.id}.png`);
      await page.screenshot({ path: screenshot });
      const bytes = await fs.readFile(screenshot);
      evidence.captures.push({ id: `S26-${target.id}-${viewport.id}`, target: target.id, viewport, expectedAsset, status: functionalPass ? 'PASS' : 'FAIL', pageErrors, consoleErrors, failedRequests, assetFailures, readback, screenshot, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, actualPixelsReceived: true });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

evidence.summary = {
  captures: evidence.captures.length,
  functionalPasses: evidence.captures.filter((capture) => capture.status === 'PASS').length,
  functionalFailures: evidence.captures.filter((capture) => capture.status !== 'PASS').length,
  pageErrors: evidence.captures.reduce((sum, capture) => sum + capture.pageErrors.length, 0),
  consoleErrors: evidence.captures.reduce((sum, capture) => sum + capture.consoleErrors.length, 0),
  failedRequests: evidence.captures.reduce((sum, capture) => sum + capture.failedRequests.length, 0),
  assetFailures: evidence.captures.reduce((sum, capture) => sum + capture.assetFailures.length, 0)
};
await fs.writeFile(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: evidence.summary.functionalFailures ? 'FAIL' : 'PASS', output, evidencePath, summary: evidence.summary }, null, 2));
if (evidence.summary.functionalFailures) process.exitCode = 1;
