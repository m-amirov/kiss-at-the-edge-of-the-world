import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualAt, visualEntryForPosition } from '../../src/literary-visual-directions.js';
import { stageForScene } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const phase = process.env.S01_PLACARD_PHASE ?? 'before';
const output = path.resolve(process.env.S01_PLACARD_OUTPUT ?? path.join(root, 'artifacts/evidence/s01-placard-2026-10-08', phase));
const port = Number(process.env.S01_PLACARD_PORT ?? 4188);
const baseUrl = process.env.S01_PLACARD_URL ?? `http://127.0.0.1:${port}/literary.html`;
const views = [
  { name: 'desktop', width: 1920, height: 900 },
  { name: 'mobile-360', width: 360, height: 640 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 }
];
const locales = ['ru', 'en'];
const sceneId = 'S01';
const targetBeat = 'nick-arrives';
const allChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(id => [id, 'A']));
Object.assign(allChoices, { 'S01-C90': 'A', 'S01-C91': 'A' });
const scene = literarySeason.scenes.find(item => item.id === sceneId);
const flowFor = locale => compileInteractivePlayback(scene, allChoices, locale);
const positionFor = locale => {
  const flow = flowFor(locale);
  const position = flow.findIndex(entry => visualAt(sceneId, entry, allChoices, stageForScene(sceneId, allChoices).cast).beatId === targetBeat);
  if (position < 0) throw new Error(`Missing visual beat ${sceneId}/${targetBeat}/${locale}`);
  const outsidePosition = flow.findIndex(entry => visualAt(sceneId, entry, allChoices, stageForScene(sceneId, allChoices).cast).beatId === 'airport-outside');
  if (outsidePosition < 0) throw new Error(`Missing excluded visual beat ${sceneId}/airport-outside/${locale}`);
  return { flow, position, outsidePosition };
};
const stateFor = (position, locale) => ({
  schemaVersion: 3,
  sceneId,
  position,
  choices: allChoices,
  finished: false,
  visited: [sceneId],
  runId: `s01-placard-${phase}-${locale}-${Date.now()}`,
  revision: 0
});
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rect = node => {
  const box = node?.getBoundingClientRect();
  return box && { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
};
const readback = () => {
  const box = node => {
    const value = node?.getBoundingClientRect();
    return value && { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  const picture = document.querySelector('.literary-picture');
  const image = picture?.querySelector('img');
  const sheet = document.querySelector('.reader-sheet');
  const stage = [...document.querySelectorAll('.stage-character')];
  return {
    locale: document.documentElement.lang,
    sceneId: window.__LITERARY_QA__?.getScreen?.().sceneId ?? null,
    cue: picture?.dataset.visualBeat ?? null,
    asset: image?.dataset.asset ?? null,
    desktopAsset: image?.dataset.desktopAsset ?? null,
    natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
    presentation: document.querySelector('#literary-app')?.dataset.presentation ?? null,
    stageCount: stage.length,
    stageCharacters: stage.map(node => ({ className: node.className, rect: box(node), imageRect: box(node.querySelector('img')) })),
    pictureRect: box(picture),
    sheetRect: box(sheet),
    viewport: [innerWidth, innerHeight],
    overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
    edgeToEdge: Boolean(box(picture) && box(picture).left === 0 && box(picture).top === 0 && Math.abs(box(picture).width - innerWidth) <= 1 && Math.abs(box(picture).height - innerHeight) <= 1),
    imagesReady: [...document.images].every(item => item.complete && item.naturalWidth > 0),
    readable: Boolean(document.querySelector('.reader-paragraph')?.getBoundingClientRect().height),
    visibleText: [...document.querySelectorAll('.reader-paragraph')].map(node => node.textContent).join('\n')
  };
};

await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  phase,
  currentHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  baseUrl,
  target: { sceneId, beatId: targetBeat, authoredAddress: { chunk: 0, paragraph: 4 }, excludedNeighbor: { beatId: 'airport-outside', authoredAddress: { chunk: 0, paragraph: 16 } } },
  captures: []
};
try {
  for (const locale of locales) {
    const { flow, position, outsidePosition } = positionFor(locale);
    for (const view of views) {
      for (const capture of [
        { label: 'previous', position: Math.max(0, position - 1) },
        { label: 'target', position },
        { label: 'next', position: Math.min(flow.length - 1, position + 1) },
        { label: 'excluded-airport-outside', position: outsidePosition }
      ]) {
        const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, locale: locale === 'ru' ? 'ru-RU' : 'en-US' });
        const page = await context.newPage();
        const consoleErrors = [], failedRequests = [], notFound = [];
        const sdkStub = `window.YaGames={init:async()=>({environment:{i18n:{lang:'${locale}'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},adv:{showFullscreenAdv({callbacks}){callbacks?.onClose?.();}},getPlayer:async()=>({getData:async()=>({}),setData:async()=>{}}),on(){},off(){}})};`;
        page.on('pageerror', error => consoleErrors.push(String(error)));
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('requestfailed', request => failedRequests.push(request.url()));
        page.on('response', response => { if (response.status() === 404) notFound.push(response.url()); });
        await page.route('**/sdk.js', route => route.fulfill({ contentType: 'text/javascript', body: sdkStub }));
        await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(capture.position, locale) });
        await page.goto(`${baseUrl}?lang=${locale}`, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: locale === 'ru' ? /Продолжить/ : /Continue/ }).click();
        await page.locator('.reader-sheet').waitFor();
        await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
        await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode?.().catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
        const rb = await page.evaluate(readback);
        const file = path.join(output, `${locale}-${capture.label}-${view.name}-${view.width}x${view.height}.png`);
        await page.screenshot({ path: file });
        const bytes = await fs.readFile(file);
        evidence.captures.push({ locale, label: capture.label, requestedPosition: capture.position, view, file, sha256: digest(bytes), bytes: bytes.length, readback: rb, consoleErrors, failedRequests, notFound });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
const failures = evidence.captures.filter(capture => capture.consoleErrors.length || capture.failedRequests.length || capture.notFound.length || capture.readback.overflow || !capture.readback.edgeToEdge || !capture.readback.imagesReady || !capture.readback.readable);
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', phase, captures: evidence.captures.length, failures: failures.length, output }, null, 2));
