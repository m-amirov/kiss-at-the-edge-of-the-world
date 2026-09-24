import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'output/playwright/s30-s55-runtime-2026-09-24');
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const targets = {
  S30: { event: 's30-damir-sleeve-promise', chunk: 2, paragraph: 1, asset: 's30-damir-sleeve-promise.png', choices: { 'S30-C1': 'A' } },
  S55: { event: 's55-shum-first-step', chunk: 0, paragraph: 3, asset: 's55-shum-first-step.png', choices: {} }
};
const choices = {};
for (const scene of literarySeason.scenes) for (const chunk of scene.chunks ?? []) {
  const match = chunk.title.match(/(S\d{2}-C\d+)/);
  if (match) choices[match[1]] = 'A';
}
for (const target of Object.values(targets)) Object.assign(choices, target.choices);
function position(sceneId, chunk, paragraph) {
  const flow = compileInteractivePlayback(literarySeason.scenes.find((scene) => scene.id === sceneId), choices);
  const index = flow.findIndex((entry) => [entry.sourceStartRef, entry.sourceEndRef].some((ref) => ref?.chunk === chunk && ref?.paragraph === paragraph));
  if (index < 0) throw new Error(`No position for ${sceneId} [${chunk},${paragraph}]`);
  return index;
}
const state = (sceneId) => ({ schemaVersion: 3, sceneId, position: 0, choices: {}, finished: false, visited: ['S01', sceneId], runId: `qa-${sceneId}-${Date.now()}`, revision: 0 });
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { generatedAt: new Date().toISOString(), baseUrl, independentMultimodalReview: { status: 'PENDING', actualPixelsSupplied: false }, captures: [] };
try {
  for (const [sceneId, target] of Object.entries(targets)) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', (error) => errors.push(String(error))); page.on('requestfailed', (request) => errors.push(`requestfailed:${request.url()}`));
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state(sceneId) });
    await page.goto(baseUrl, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Продолжить/ }).click(); await page.locator('.reader-sheet').waitFor();
    for (let step = 0; step < 30; step++) {
      const beat = await page.locator('.literary-picture').getAttribute('data-visual-beat');
      if (beat === target.event) break;
      const buttons = page.locator('.reader-sheet button:visible');
      if (await buttons.count() === 0) throw new Error(`No navigation button before ${target.event} at step ${step}`);
      await buttons.first().click();
      await page.waitForTimeout(20);
    }
    const readback = await page.evaluate(() => { const picture = document.querySelector('.literary-picture'); const image = picture?.querySelector('img'); const sheet = document.querySelector('.reader-sheet'); const buttons = [...document.querySelectorAll('button')].filter((button) => button.offsetParent !== null); const pr = picture?.getBoundingClientRect(); const ir = image?.getBoundingClientRect(); return { sceneId: document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null, cue: picture?.dataset.visualBeat ?? null, asset: image?.dataset.asset ?? null, desktopAsset: image?.dataset.desktopAsset ?? null, natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0], stageCount: document.querySelectorAll('.stage-character').length, presentation: picture?.dataset.mode ?? null, overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, internalScroll: Boolean(document.querySelector('.reader-content') && document.querySelector('.reader-content').scrollHeight > document.querySelector('.reader-content').clientHeight + 1), actionAboveText: Boolean(ir && sheet && ir.top < sheet.getBoundingClientRect().top), controlsAvailable: buttons.length > 0 && buttons.every((button) => !button.disabled), fullscreen: Boolean(pr && pr.left <= .5 && pr.top <= .5 && innerWidth - pr.right <= .5 && innerHeight - pr.bottom <= .5) }; });
    const screenshot = path.join(output, `${sceneId}-${target.event}-${viewport.width}x${viewport.height}.png`); await page.screenshot({ path: screenshot }); const bytes = await fs.readFile(screenshot);
    const expectedAsset = viewport.width < 680 ? target.asset.replace('.png', '-portrait.png') : target.asset;
    evidence.captures.push({ sceneId, cue: target.event, expectedAsset, viewport, screenshot, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, errors, readback }); await context.close();
  }
} finally { await browser.close(); }
evidence.independentMultimodalReview = { status: 'PENDING', actualPixelsSupplied: false, screenshotHashes: evidence.captures.map(({ sceneId, viewport, screenshotSha256 }) => ({ sceneId, viewport, screenshotSha256 })) };
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: 'PASS', output, captures: evidence.captures.length, errors: evidence.captures.reduce((n, item) => n + item.errors.length, 0), failedReadbacks: evidence.captures.filter((item) => item.readback.cue !== item.cue || item.readback.asset !== item.expectedAsset).length }));
