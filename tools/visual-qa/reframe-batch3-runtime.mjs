import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualAt } from '../../src/literary-visual-directions.js';
import { stageForScene } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = path.resolve(process.env.REFRAME_BATCH3_OUTPUT ?? path.join(root, 'artifacts/evidence/reframe-batch3-2026-10-08'));
const phase = process.env.REFRAME_BATCH3_PHASE ?? 'before';
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4188/literary.html';
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const views = [{ name: 'desktop', width: 1920, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const targets = [
  { id: 'S46-airport-bus', sceneId: 'S46', beatId: 'airport-bus' },
  { id: 'S42-scene-start-A', sceneId: 'S42', beatId: 's42-harbour-cafe', route: 'A' },
  { id: 'S42-scene-start-B', sceneId: 'S42', beatId: 's42-harbour-cafe', route: 'B' },
  { id: 'S42-scene-start-C', sceneId: 'S42', beatId: 's42-harbour-cafe', route: 'C' },
  { id: 'S01-nick-arrives', sceneId: 'S01', beatId: 'nick-arrives' },
  { id: 'S18-scene-start', sceneId: 'S18', beatId: 'scene-start' },
  { id: 'S28-scene-start', sceneId: 'S28', beatId: 'scene-start' },
  { id: 'S30-scene-start', sceneId: 'S30', beatId: 'scene-start' }
];
const sdkStub = `window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},adv:{showFullscreenAdv({callbacks}){callbacks?.onClose?.();}},getPlayer:async()=>({getData:async()=>({}),setData:async()=>{}}),on(){},off(){}})};`;
const allChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const choicesFor = target => ({ ...allChoices, ...(target.route ? { 'S26-C1': target.route } : {}) });
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
const flowFor = target => compileInteractivePlayback(sceneById(target.sceneId), choicesFor(target));
function targetPosition(target) {
  const flow = flowFor(target);
  const position = flow.findIndex(entry => visualAt(target.sceneId, entry, choicesFor(target), stageForScene(target.sceneId, choicesFor(target)).cast).beatId === target.beatId);
  if (position < 0) throw new Error(`Missing visual beat ${target.sceneId}/${target.beatId}${target.route ? `/${target.route}` : ''}`);
  return { flow, position };
}
function stateFor(target, position) {
  return { schemaVersion: 3, sceneId: target.sceneId, position, choices: choicesFor(target), finished: false, visited: ['S01', target.sceneId], runId: `reframe-batch3-${phase}-${target.id}-${Date.now()}`, revision: 0 };
}
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function targetReadback() {
  const picture = document.querySelector('.literary-picture');
  const image = picture?.querySelector('img');
  const app = document.querySelector('.literary-reader');
  const sheet = document.querySelector('.reader-sheet');
  const stage = [...document.querySelectorAll('.stage-character')];
  const allImages = [...document.images];
  const rect = node => { const box = node?.getBoundingClientRect(); return box && { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
  return {
    sceneId: window.__LITERARY_QA__?.getScreen?.().sceneId ?? document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
    cue: picture?.dataset.visualBeat ?? null,
    asset: image?.dataset.asset ?? null,
    desktopAsset: image?.dataset.desktopAsset ?? null,
    natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
    presentation: document.querySelector('#literary-app')?.dataset.presentation ?? null,
    stageCount: stage.length,
    stageMode: document.querySelector('.scene-stage')?.dataset.mode ?? null,
    stageLayout: document.querySelector('.scene-stage')?.dataset.layout ?? null,
    stageCharacters: stage.map(node => ({ className: node.className, rect: rect(node), imageRect: rect(node.querySelector('img')) })),
    pictureRect: rect(picture),
    sheetRect: rect(sheet),
    appRect: rect(app),
    viewport: [innerWidth, innerHeight],
    overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
    edgeToEdge: Boolean(rect(picture) && rect(picture).left === 0 && rect(picture).top === 0 && Math.abs(rect(picture).width - innerWidth) <= 1 && Math.abs(rect(picture).height - innerHeight) <= 1),
    imagesReady: allImages.every(item => item.complete && item.naturalWidth > 0),
    readable: Boolean(document.querySelector('.reader-paragraph')?.getBoundingClientRect().height)
  };
}
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { generatedAt: new Date().toISOString(), phase, currentHead: process.env.GIT_HEAD ?? null, baseUrl, targets: [] };
try {
  for (const target of targets) {
    const { flow, position } = targetPosition(target);
    const capturePositions = [{ label: 'previous', position: Math.max(0, position - 1) }, { label: 'target', position }, { label: 'next', position: Math.min(flow.length - 1, position + 1) }];
    const targetEvidence = { ...target, targetPosition: position, flowLength: flow.length, captures: [] };
    for (const view of views) for (const capture of capturePositions) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
      const page = await context.newPage();
      const consoleErrors = [], failedRequests = [], notFound = [];
      page.on('pageerror', error => consoleErrors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('requestfailed', request => failedRequests.push(request.url()));
      page.on('response', response => { if (response.status() === 404) notFound.push(response.url()); });
      await page.addInitScript({ content: sdkStub });
      await page.route('**/sdk.js', route => route.fulfill({ contentType: 'text/javascript', body: sdkStub }));
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(target, capture.position) });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Продолжить/ }).click();
      await page.locator('.reader-sheet').waitFor();
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode?.().catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      const readback = await page.evaluate(targetReadback);
      const file = path.join(output, `${phase}-${target.id}-${capture.label}-${view.name}-${view.width}x${view.height}.png`);
      await page.screenshot({ path: file });
      const bytes = await fs.readFile(file);
      targetEvidence.captures.push({ label: capture.label, position: capture.position, view, file, sha256: digest(bytes), bytes: bytes.length, readback, consoleErrors, failedRequests, notFound });
      await context.close();
    }
    evidence.targets.push(targetEvidence);
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output, `evidence-${phase}.json`), JSON.stringify(evidence, null, 2));
const failures = evidence.targets.flatMap(target => target.captures.filter(capture => capture.consoleErrors.length || capture.failedRequests.length || capture.notFound.length || capture.readback.overflow || capture.readback.internalScroll || !capture.readback.edgeToEdge || !capture.readback.imagesReady));
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', phase, targets: evidence.targets.length, captures: evidence.targets.reduce((sum, target) => sum + target.captures.length, 0), failures: failures.length, output }, null, 2));
