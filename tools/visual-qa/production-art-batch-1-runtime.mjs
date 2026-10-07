import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'artifacts/evidence/production-art-batch-1-runtime-2026-10-07');
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html?qa=production-art-batch-1&lang=en';
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }];
const targets = [
  { id: 'CG-1', sceneId: 'S44', at: [0, 0], cue: 'eric-morning-harbour', asset: 'cg/s44-eric-morning-harbour.webp', portrait: 'cg/s44-eric-morning-harbour-portrait.webp', previous: 'S42', next: 'S46' },
  { id: 'CG-2', sceneId: 'S46', at: [0, 0], cue: 'airport-bus', asset: 'cg/s46-airport-bus.webp', portrait: 'cg/s46-airport-bus-portrait.webp', previous: 'S44', next: 'S47' },
  { id: 'CG-3', sceneId: 'S42', at: [4, 0], cue: 's42-harbour-cafe', asset: 'cg/s42-harbour-cafe.webp', portrait: 'cg/s42-harbour-cafe-portrait.webp', previous: 'S41', next: 'S44' },
  { id: 'CG-4', sceneId: 'S18', at: [5, 1], position: 40, cue: 'hofn-day10-room', asset: 'cg/s18-hofn-day10-room.webp', portrait: 'cg/s18-hofn-day10-room-portrait.webp', previous: 'S17', next: 'S19' },
  { id: 'CG-5', sceneId: 'S03', at: [0, 0], cue: 'editor-call', asset: 'cg/s03-editor-call.webp', portrait: 'cg/s03-editor-call-portrait.webp', previous: 'S02', next: 'S04' },
];
const seedChoices = ['S01-C1', 'S02-C1', 'S04-C1', 'S05-C1', 'S08-C1', 'S09-C1', 'S13-C1', 'S15-C1', 'S16-C1', 'S17-C2', 'S18-C1', 'S19-C2', 'S20-C1', 'S21-C1', 'S23-C1', 'S26-C1', 'S32-C1', 'S33-C1', 'S34-C1', 'S37-C1', 'S38-C1', 'S39-C1', 'S42-C1'];
const everyChoice = literarySeason.scenes.flatMap((scene) => scene.chunks.map((chunk) => chunk.title.match(/Выбор\s+(S\d{2}-C\d+)/)?.[1]).filter(Boolean));
const choices = Object.fromEntries([...new Set([...seedChoices, ...everyChoice])].map((id) => [id, 'A']));
Object.assign(choices, { 'S18-C2': 'A', 'S18-C90': 'A', 'S18-C91': 'A' });
function position(sceneId, at) {
  const scene = literarySeason.scenes.find((item) => item.id === sceneId);
  let flow = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    flow = compileInteractivePlayback(scene, choices);
    const pending = flow.find((entry) => entry.type === 'choice');
    if (!pending) break;
    choices[pending.id] ??= pending.options[0].code;
  }
  const index = flow.findIndex((entry) => [entry.sourceStartRef, entry.sourceEndRef].some((ref) => ref?.chunk === at[0] && ref?.paragraph === at[1]));
  if (index < 0) throw new Error(`No position for ${sceneId} [${at.join(',')}]`);
  return index;
}
const makeState = (target) => ({ schemaVersion: 3, sceneId: target.sceneId, position: target.position ?? position(target.sceneId, target.at), choices, finished: false, visited: ['S01', target.sceneId], runId: `production-art-batch-1-${target.id}`, revision: 0 });
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { generatedAt: new Date().toISOString(), baseline: '7899a736750baea4b83f6abee951d219a35dbbee', baseUrl, targets, captures: [] };
try {
  for (const target of targets) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror:${String(error)}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
    page.on('requestfailed', (request) => errors.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? 'unknown'}`));
    await page.route('**/sdk.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.YaGames = undefined;' }));
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: makeState(target) });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const continueButton = page.getByRole('button', { name: /Продолжить|Continue|New Game|Новая игра/ }).first();
    if (await continueButton.count()) await continueButton.click();
    await page.locator('.reader-sheet').waitFor();
    await page.waitForTimeout(800);
    const readback = await page.evaluate(() => {
      const picture = document.querySelector('.literary-picture');
      const image = picture?.querySelector('img');
      const sheet = document.querySelector('.reader-sheet');
      const content = document.querySelector('.reader-content');
      const pr = picture?.getBoundingClientRect();
      const ir = image?.getBoundingClientRect();
      const sr = sheet?.getBoundingClientRect();
      const state = window.__LITERARY_QA__?.getState?.();
      return {
        sceneId: state?.sceneId ?? document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
        position: state?.position ?? null,
        sourceRef: window.__LITERARY_QA__?.getFlow?.()?.[state?.position]?.sourceStartRef ?? null,
        flowLength: window.__LITERARY_QA__?.getFlow?.()?.length ?? null,
        flowRefs: window.__LITERARY_QA__?.getFlow?.()?.map((entry) => entry.sourceStartRef) ?? [],
        cue: picture?.dataset.visualBeat ?? null,
        asset: image?.dataset.asset ?? null,
        desktopAsset: image?.dataset.desktopAsset ?? null,
        natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
        stageCount: document.querySelectorAll('.stage-character').length,
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
        pictureRect: pr && { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom, width: pr.width, height: pr.height },
        imageRect: ir && { left: ir.left, top: ir.top, right: ir.right, bottom: ir.bottom, width: ir.width, height: ir.height },
        textPanelRect: sr && { left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom, width: sr.width, height: sr.height },
        viewport: [innerWidth, innerHeight],
      };
    });
    const screenshot = path.join(output, `${target.id}-${target.sceneId}-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const bytes = await fs.readFile(screenshot);
    evidence.captures.push({ target: target.id, sceneId: target.sceneId, cue: target.cue, viewport, expectedAsset: path.basename(target.asset), screenshot, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, errors, readback });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
const failures = evidence.captures.filter((capture) => capture.errors.length || capture.readback.sceneId !== capture.sceneId || capture.readback.cue !== capture.cue || capture.readback.asset !== capture.expectedAsset || capture.readback.overflow || capture.readback.internalScroll);
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', output, captures: evidence.captures.length, failures: failures.length, errors: evidence.captures.reduce((count, capture) => count + capture.errors.length, 0) }));
if (failures.length) process.exitCode = 1;
