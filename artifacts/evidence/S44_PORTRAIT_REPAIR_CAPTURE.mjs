import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const phase = process.env.S44_CAPTURE_PHASE ?? 'after';
const outputDir = path.join(root, 'output/playwright/s44-portrait-repair');
const evidencePath = path.join(outputDir, `${phase}.json`);
const viewports = [
  { name: 'desktop', width: 1920, height: 900 },
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 }
];
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

const choices = Object.fromEntries(literarySeason.scenes
  .flatMap(scene => scene.chunks ?? [])
  .map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1])
  .filter(Boolean)
  .map(id => [id, 'A']));
const sceneMap = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const flowFor = sceneId => compileInteractivePlayback(sceneMap.get(sceneId), choices);
const lastPage = sceneId => {
  const flow = flowFor(sceneId);
  for (let position = flow.length - 1; position >= 0; position -= 1) {
    if (flow[position]?.type === 'page') return position;
  }
  return 0;
};
const targets = [
  { id: 'previous-scene-S43', sceneId: 'S43', position: lastPage('S43') },
  { id: 's44-before-current', sceneId: 'S44', position: 0 },
  { id: 's44-after-next', sceneId: 'S44', position: 1 }
];
const stateFor = target => ({
  schemaVersion: 3,
  sceneId: target.sceneId,
  position: target.position,
  choices,
  finished: false,
  visited: ['S01', target.sceneId],
  runId: `s44-portrait-repair-${phase}-${target.id}-${Date.now()}`,
  revision: 0
});

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];
try {
  for (const target of targets) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width < 680, isMobile: viewport.width < 680 });
    const page = await context.newPage();
    const errors = [];
    const responses = [];
    page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/u.test(message.text())) errors.push(`console:${message.text()}`); });
    page.on('requestfailed', request => { if (!/\/sdk\.js(?:$|\?)/u.test(request.url())) errors.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? 'unknown'}`); });
    page.on('response', response => { if (response.url().includes('/assets/')) responses.push({ url: response.url(), status: response.status() }); });
    const state = stateFor(target);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Продолжить|Continue|Новая игра|New game/u }).first().click();
    await page.locator('.literary-picture').waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector('.literary-picture img');
      if (!image) return true;
      const style = getComputedStyle(image);
      return image.complete && image.naturalWidth > 0 && style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(420);
    const readback = await page.evaluate(() => {
      const rect = node => { const value = node?.getBoundingClientRect(); return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null; };
      const picture = document.querySelector('.literary-picture');
      const image = picture?.querySelector('img');
      return {
        sceneId: document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
        cue: picture?.dataset.visualBeat ?? null,
        mode: picture?.dataset.mode ?? null,
        asset: image?.dataset.asset ?? null,
        desktopAsset: image?.dataset.desktopAsset ?? null,
        imageComplete: image?.complete ?? false,
        natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
        pictureRect: rect(picture),
        imageRect: rect(image),
        hudRect: rect(document.querySelector('.reader-header')),
        sheetRect: rect(document.querySelector('.reader-sheet')),
        footerRect: rect(document.querySelector('.reader-footer')),
        stageCharacters: [...document.querySelectorAll('.stage-character')].map(node => ({ id: [...node.classList].find(name => name.startsWith('stage-') && name !== 'stage-character') ?? null, rect: rect(node) })),
        edgeToEdge: Boolean(picture && picture.getBoundingClientRect().left <= .5 && picture.getBoundingClientRect().top <= .5 && innerWidth - picture.getBoundingClientRect().right <= .5 && innerHeight - picture.getBoundingClientRect().bottom <= .5),
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight || document.body.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight,
        internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1)
      };
    });
    const file = path.join(outputDir, `${phase}-${target.id}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const bytes = await fs.readFile(file);
    captures.push({ phase, target, viewport, readback, errors, assetResponses: responses.filter(item => item.url.includes(readback.asset ?? '__missing__')), screenshot: file, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, actualPixelsReceived: true });
    await context.close();
  }
} finally {
  await browser.close();
}

const evidence = {
  schemaVersion: 1,
  phase,
  generatedAt: new Date().toISOString(),
  head: process.env.S44_CAPTURE_HEAD_OVERRIDE ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  baseUrl,
  targets,
  viewports,
  captures,
  summary: { captures: captures.length, errors: captures.filter(item => item.errors.length).length, missingPixels: captures.filter(item => !item.actualPixelsReceived).length }
};
await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ phase, head: evidence.head, evidencePath, summary: evidence.summary }, null, 2));
