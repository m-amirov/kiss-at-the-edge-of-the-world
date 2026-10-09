import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualAt } from '../../src/literary-visual-directions.js';
import { stageForScene } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const phase = process.env.FOUR_SCENE_ART_REPAIR_PHASE ?? 'before';
const output = path.resolve(process.env.FOUR_SCENE_ART_REPAIR_OUTPUT ?? path.join(root, `artifacts/evidence/four-scene-art-repair-${phase}-2026-10-09`));
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4188/literary.html';
const viewports = [
  { name: 'desktop', width: 1920, height: 900 },
  { name: 'portrait360', width: 360, height: 640 },
  { name: 'portrait390', width: 390, height: 844 },
  { name: 'portrait412', width: 412, height: 915 },
];
const targets = [
  { sceneId: 'S07', cue: 's07-kitchen-pasta' },
  { sceneId: 'S18', cue: 'hofn-lighthouse' },
  { sceneId: 'S26', cue: 'scene-start' },
  { sceneId: 'S38', cue: 's38-ordinary-day' },
];
const locales = ['ru', 'en'];
const sdkStub = `window.YaGames={init:async()=>({environment:{i18n:{lang:window.__QA_LOCALE__||'ru'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},adv:{showFullscreenAdv({callbacks}){callbacks?.onClose?.();}},getPlayer:async()=>({getData:async()=>({}),setData:async()=>{}}),on(){},off(){}})};`;
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const choicesFor = scene => {
  const choices = Object.fromEntries(literarySeason.scenes
    .flatMap(item => item.chunks.map(chunk => chunk.title.match(/(?:Выбор|Отклик)\s+(S\d{2}-C\d+)/u)?.[1]))
    .filter(Boolean)
    .map(id => [id, 'A']));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const flow = compileInteractivePlayback(scene, choices);
    const pending = flow.find(entry => entry.type === 'choice' && choices[entry.id] == null);
    if (!pending) return choices;
    choices[pending.id] = pending.options?.[0]?.code ?? 'A';
  }
  throw new Error(`Unable to resolve choices for ${scene.id}`);
};
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
function targetPosition(target, choices) {
  const scene = sceneById(target.sceneId);
  const flow = compileInteractivePlayback(scene, choices);
  const position = target.cue === 'scene-start'
    ? 0
    : flow.findIndex(entry => visualAt(target.sceneId, entry, choices, stageForScene(target.sceneId, choices).cast).beatId === target.cue);
  if (position < 0) throw new Error(`Missing visual cue ${target.sceneId}/${target.cue}`);
  return { position, flow };
}
function stateFor(target, position, choices, locale) {
  return { schemaVersion: 3, sceneId: target.sceneId, position, choices, finished: false, visited: ['S01', target.sceneId], runId: `four-scene-art-repair-${phase}-${target.sceneId}-${locale}-${Date.now()}`, revision: 0 };
}
function rect(node) {
  const box = node?.getBoundingClientRect();
  return box && { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
}
function readback() {
  const picture = document.querySelector('.literary-picture');
  const image = picture?.querySelector('img');
  const content = document.querySelector('.reader-content');
  const screen = window.__LITERARY_QA__?.getScreen?.();
  const box = node => {
    const value = node?.getBoundingClientRect();
    return value && { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  return {
    sceneId: screen?.sceneId ?? null,
    cue: picture?.dataset.visualBeat ?? null,
    asset: image?.dataset.asset ?? null,
    desktopAsset: image?.dataset.desktopAsset ?? null,
    natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
    imageRect: box(image),
    pictureRect: box(picture),
    viewport: [innerWidth, innerHeight],
    text: content?.innerText ?? '',
    overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
    imagesReady: [...document.images].every(item => item.complete && item.naturalWidth > 0),
  };
}

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];
try {
  for (const locale of locales) for (const target of targets) {
    const choices = choicesFor(sceneById(target.sceneId));
    const { position } = targetPosition(target, choices);
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage();
      const errors = [];
      const failedRequests = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('requestfailed', request => { if (!/\/sdk\.js(?:$|\?)/u.test(request.url())) failedRequests.push(request.url()); });
      await page.addInitScript(({ key, value, locale: initialLocale }) => { window.__QA_LOCALE__ = initialLocale; localStorage.setItem(key, JSON.stringify(value)); }, { key: literarySaveKey, value: stateFor(target, position, choices, locale), locale });
      await page.route('**/sdk.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: sdkStub }));
      const url = new URL(baseUrl);
      url.searchParams.set('lang', locale);
      url.searchParams.set('qa', 'four-scene-art-repair');
      await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 15000 });
      const continueButton = page.getByRole('button', { name: /Продолжить|Continue|New Game|Новая игра/u }).first();
      if (await continueButton.count()) await continueButton.click();
      await page.locator('.reader-sheet').waitFor();
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode?.().catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      const state = await page.evaluate(readback);
      const screenshot = path.join(output, `${target.sceneId}-${target.cue}-${locale}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      const bytes = await fs.readFile(screenshot);
      captures.push({ phase, locale, target, viewport, sourceHead, screenshot: path.relative(root, screenshot).replaceAll('\\', '/'), screenshotSha256: sha256(bytes), screenshotBytes: bytes.length, readback: state, errors, failedRequests });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const failures = captures.filter(item => item.errors.length || item.failedRequests.length || item.readback.sceneId !== item.target.sceneId || item.readback.overflow || item.readback.internalScroll || !item.readback.imagesReady);
const evidence = { schemaVersion: 1, recordType: 'four-scene-art-repair-runtime', status: failures.length ? 'FAIL' : 'PASS', phase, generatedAt: new Date().toISOString(), sourceHead, baseUrl, locales, viewports, targets, captures, failures: failures.map(item => ({ locale: item.locale, target: item.target, viewport: item.viewport, errors: item.errors, failedRequests: item.failedRequests, readback: item.readback })) };
await fs.writeFile(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: evidence.status, phase, sourceHead, captures: captures.length, failures: failures.length, evidence: path.relative(root, path.join(output, 'evidence.json')).replaceAll('\\', '/') }, null, 2));
if (failures.length) process.exitCode = 2;
