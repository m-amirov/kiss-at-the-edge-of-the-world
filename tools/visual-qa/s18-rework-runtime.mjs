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
const output = path.resolve(process.env.S18_REWORK_OUTPUT ?? path.join(root, 'artifacts/evidence/s18-rework-2026-10-10/runtime'));
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const currentHead = process.env.GIT_HEAD ?? null;
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const views = [
  { name: 'desktop', width: 1920, height: 900 },
  { name: 'portrait390', width: 390, height: 844 },
  { name: 'portrait360', width: 360, height: 640 }
];
const target = { sceneId: 'S18', beatId: 'hofn-lighthouse', id: 'S18-hofn-lighthouse' };
const sdkStub = `window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},adv:{showFullscreenAdv({callbacks}){callbacks?.onClose?.();}},getPlayer:async()=>({getData:async()=>({}),setData:async()=>{}}),on(){},off(){}})};`;
const allChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const choices = { ...allChoices, 'S17-C2': 'A', 'S18-C1': 'A' };
const scene = literarySeason.scenes.find(item => item.id === target.sceneId);
const flow = compileInteractivePlayback(scene, choices);
const position = flow.findIndex(entry => visualAt(target.sceneId, entry, choices, stageForScene(target.sceneId, choices).cast).beatId === target.beatId);
if (position < 0) throw new Error('S18 hofn-lighthouse cue is not reachable');
const captures = [
  { label: 'previous', position: Math.max(0, position - 1) },
  { label: 'target', position },
  { label: 'next', position: Math.min(flow.length - 1, position + 1) }
];
const stateFor = capture => ({ schemaVersion: 3, sceneId: target.sceneId, position: capture.position, choices, finished: false, visited: ['S01', target.sceneId], runId: `s18-rework-${target.id}-${capture.label}-${Date.now()}`, revision: 0 });
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rect = node => { const box = node?.getBoundingClientRect(); return box && { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
const readback = () => {
  const box = node => { const value = node?.getBoundingClientRect(); return value && { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height }; };
  const picture = document.querySelector('.literary-picture');
  const image = picture?.querySelector('img');
  const stage = [...document.querySelectorAll('.stage-character')];
  const sheet = document.querySelector('.reader-sheet');
  return {
    cue: picture?.dataset.visualBeat ?? null,
    asset: image?.dataset.asset ?? null,
    desktopAsset: image?.dataset.desktopAsset ?? null,
    natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
    stageCount: stage.length,
    stageMode: document.querySelector('.scene-stage')?.dataset.mode ?? null,
    stageLayout: document.querySelector('.scene-stage')?.dataset.layout ?? null,
    stageCharacters: stage.map(node => ({ className: node.className, rect: box(node), imageRect: box(node.querySelector('img')) })),
    sheetRect: box(sheet),
    viewport: [innerWidth, innerHeight],
    overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
    imagesReady: [...document.images].every(item => item.complete && item.naturalWidth > 0),
    readable: Boolean(document.querySelector('.reader-paragraph')?.getBoundingClientRect().height)
  };
};
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { generatedAt: new Date().toISOString(), currentHead, baseUrl, target, targetPosition: position, flowLength: flow.length, captures: [] };
try {
  for (const view of views) for (const capture of captures) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
    const page = await context.newPage();
    const consoleErrors = [], failedRequests = [], notFound = [];
    page.on('pageerror', error => consoleErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push(request.url()));
    page.on('response', response => { if (response.status() === 404) notFound.push(response.url()); });
    await page.addInitScript({ content: sdkStub });
    await page.route('**/sdk.js', route => route.fulfill({ contentType: 'text/javascript', body: sdkStub }));
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(capture) });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await page.locator('.reader-sheet').waitFor();
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode?.().catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const file = path.join(output, `${capture.label}-${view.name}-${view.width}x${view.height}.png`);
    await page.screenshot({ path: file });
    const bytes = await fs.readFile(file);
    evidence.captures.push({ label: capture.label, position: capture.position, view, file, sha256: digest(bytes), bytes: bytes.length, readback: await page.evaluate(readback), consoleErrors, failedRequests, notFound });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
const expectedMediaFailures = evidence.captures.flatMap(item => item.failedRequests.filter(url => /\/assets\/audio\//i.test(url)).map(url => ({ file: item.file, url })));
const failures = evidence.captures.filter(item => item.consoleErrors.length || item.failedRequests.some(url => !/\/assets\/audio\//i.test(url)) || item.notFound.length || item.readback.overflow || item.readback.internalScroll || !item.readback.imagesReady || !item.readback.readable);
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', currentHead, captures: evidence.captures.length, failures: failures.length, expectedMediaFailures, output }, null, 2));
