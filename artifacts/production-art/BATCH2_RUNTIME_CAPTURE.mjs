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
const output = path.resolve(process.env.BATCH2_QA_OUTPUT ?? 'artifacts/evidence/production-art-batch2');
const only = process.env.BATCH2_ONLY?.split(',').filter(Boolean);
const viewports = [{ name: 'desktop', width: 1920, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const targets = [
  { key: 'S01-airport-outside', sceneId: 'S01', position: 9, cue: 'airport-outside', asset: 's01-airport-outside-batch2.webp', cast: ['alice', 'nick', 'eric'] },
  { key: 'S01-damir-arrives', sceneId: 'S01', position: 14, cue: 'damir-arrives', asset: 's01-damir-arrives-batch2.webp', cast: ['alice', 'nick', 'eric', 'damir'] },
  { key: 'S48-scene-start', sceneId: 'S48', position: 0, cue: 'scene-start', asset: 's48-last-breakfast-batch2.webp', cast: ['alice', 'eric', 'nick', 'damir'] },
  { key: 'S26-scene-start', sceneId: 'S26', position: 0, cue: 'scene-start', asset: 's26-route-choice-courtyard-batch2.webp', cast: ['alice', 'eric', 'nick', 'damir'] },
  { key: 'S02-scene-start', sceneId: 'S02', position: 0, cue: 'scene-start', asset: 's02-van-group-batch2.webp', cast: ['alice', 'eric', 'nick', 'damir'] },
  { key: 'S60-scene-start', sceneId: 'S60', position: 0, cue: 'scene-start', asset: 's60-souvenir-kitchen-batch2.webp', cast: ['alice', 'eric', 'nick', 'damir'] }
].filter(item => !only || only.includes(item.key));

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const choices = {};
for (const scene of literarySeason.scenes) for (const chunk of scene.chunks ?? []) {
  const match = chunk.title.match(/(S\d{2}-C\d+)/);
  if (match) choices[match[1]] = 'A';
}
for (const [sceneId, beats] of Object.entries(interactionBeats)) for (let index = 0; index < beats.length; index += 1) choices[`${sceneId}-C${90 + index}`] = 'A';
const stateFor = target => ({ schemaVersion: 3, sceneId: target.sceneId, position: target.position, choices, finished: false, visited: ['S01', target.sceneId], runId: `batch2-${target.key}-${Date.now()}`, revision: 0 });
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const evidence = { schemaVersion: 1, generatedAt: new Date().toISOString(), head, baseUrl, viewports, targets: [] };

try {
  for (const target of targets) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    const asset404s = [];
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
      const rect = picture?.getBoundingClientRect();
      const style = picture ? getComputedStyle(picture) : null;
      const imageStyle = image ? getComputedStyle(image) : null;
      const qa = window.__LITERARY_QA__;
      return {
        state: qa?.getState?.() ?? null,
        cue: picture?.dataset.visualBeat ?? null,
        presentation: picture?.dataset.mode ?? null,
        asset: image?.dataset.asset ?? null,
        desktopAsset: image?.dataset.desktopAsset ?? null,
        natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
        imageComplete: image?.complete ?? false,
        stageCount: document.querySelectorAll('.stage-character').length,
        edgeToEdge: Boolean(rect && rect.left <= .5 && rect.top <= .5 && innerWidth - rect.right <= .5 && innerHeight - rect.bottom <= .5),
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
        opacity: imageStyle?.opacity ?? null,
        display: imageStyle?.display ?? null,
        visibility: imageStyle?.visibility ?? null,
        pictureBackground: style?.backgroundImage ?? null
      };
    });
    const screenshotPath = path.join(output, `${target.key}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath });
    const bytes = await fs.readFile(screenshotPath);
    const portraitAsset = target.asset.replace('.webp', '-portrait.webp');
    const expectedAsset = viewport.width < 680 && await fs.stat(path.join(root, 'assets/cg', portraitAsset)).then(() => true).catch(() => false) ? portraitAsset : target.asset;
    const pass = readback.state?.sceneId === target.sceneId && readback.cue === target.cue && readback.asset === expectedAsset && readback.imageComplete && readback.natural.every(value => value > 0) && readback.presentation === 'cinematic' && readback.stageCount === 0 && readback.edgeToEdge && !readback.overflow && !readback.internalScroll && !errors.length && !failedRequests.length && !asset404s.length;
    evidence.targets.push({ key: target.key, sceneId: target.sceneId, position: target.position, expectedCue: target.cue, expectedAsset, cast: target.cast, viewport, status: pass ? 'PASS' : 'FAIL', errors, failedRequests, asset404s, readback, screenshot: screenshotPath, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, actualPixelsReceived: true });
    await context.close();
  }
} finally { await browser.close(); }

const failures = evidence.targets.filter(item => item.status !== 'PASS');
evidence.summary = { targets: evidence.targets.length, passes: evidence.targets.filter(item => item.status === 'PASS').length, failures: failures.length, consoleErrors: evidence.targets.reduce((n, item) => n + item.errors.length, 0), gameOwned404: evidence.targets.reduce((n, item) => n + item.asset404s.length, 0), failedRequests: evidence.targets.reduce((n, item) => n + item.failedRequests.length, 0) };
await fs.writeFile(path.join(output, 'runtime-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', output, summary: evidence.summary }));
if (failures.length) process.exitCode = 1;
