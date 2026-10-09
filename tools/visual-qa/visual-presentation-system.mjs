import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.env.VISUAL_PRESENTATION_OUTPUT ?? path.join(root, 'artifacts/evidence/visual-presentation-system'));
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html';
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const views = [{ width: 1920, height: 900, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }, { width: 360, height: 640, name: 'mobile-small' }];
const allChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const cloudSnapshot = { schemaVersion: 3, sceneId: 'S03', position: 0, choices: allChoices, finished: false, visited: ['S01', 'S03'], runId: 'visual-presentation-cloud', revision: 0 };
const localMenuSnapshot = { schemaVersion: 3, sceneId: 'S01', position: 0, choices: {}, finished: false, visited: ['S01'], runId: 'visual-presentation-local', revision: 0 };
const sdkStub = `window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},adv:{showFullscreenAdv({callbacks}){callbacks?.onClose?.();}},getPlayer:async()=>({getData:async()=>({'kiss-at-the-edge-of-the-world:literary-season:v1':${JSON.stringify(cloudSnapshot)}}),setData:async()=>{}}),on(){},off(){}})};`;
const scenarios = [
  { id: 'menu', label: 'main-menu' },
  { id: 'S03', label: 'single-character', ref: [0, 0], expectedCue: 'editor-call', maxCast: 1 },
  { id: 'S18', label: 'two-person-dialogue', ref: [0, 0], expectedCue: 'scene-start', maxCast: 2 },
  { id: 'S02', label: 'group-arrival', ref: [0, 0], expectedCue: 'scene-start', maxCast: 2 },
  { id: 'S06', label: 'full-scene-cg', ref: [6, 6], expectedCue: 's06-eric-alice-stream', maxCast: 0 }
];

function position(sceneId, ref) {
  const scene = literarySeason.scenes.find(item => item.id === sceneId);
  const flow = compileInteractivePlayback(scene, allChoices);
  const index = flow.findIndex(entry => [entry.sourceStartRef, entry.sourceEndRef].some(source => source?.chunk === ref[0] && source?.paragraph === ref[1]));
  if (index < 0) throw new Error(`Missing ${sceneId} source ${ref.join(':')}`);
  return index;
}
function savedState(scenario) {
  return { schemaVersion: 3, sceneId: scenario.id, position: position(scenario.id, scenario.ref), choices: allChoices, finished: false, visited: ['S01', scenario.id], runId: `visual-presentation-${scenario.id}-${Date.now()}`, revision: 0 };
}
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { generatedAt: new Date().toISOString(), currentHead: process.env.GIT_HEAD ?? null, baseUrl, captures: [] };
try {
  for (const scenario of scenarios) for (const view of views) {
    const context = await browser.newContext({ viewport: view });
    const page = await context.newPage();
    const errors = [], missing = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() === 404) missing.push(response.url()); });
    await page.addInitScript({ content: sdkStub });
    await page.route('**/sdk.js', route => route.fulfill({ contentType: 'text/javascript', body: sdkStub }));
    const initialState = scenario.id === 'menu' ? localMenuSnapshot : savedState(scenario);
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: initialState });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__LITERARY_QA__?.getPlatformMode?.() !== 'booting');
    if (scenario.id === 'menu') await page.waitForFunction(() => { const action = document.querySelector('.cloud-restore'); const rect = action?.getBoundingClientRect(); return Boolean(action && getComputedStyle(action).visibility !== 'hidden' && rect && rect.width > 0 && rect.height > 0); });
    if (scenario.id !== 'menu') {
      await page.getByRole('button', { name: /Продолжить/ }).click();
      await page.locator('.reader-sheet').waitFor();
      await page.waitForFunction(() => { const image = document.querySelector('.literary-picture img'); return Boolean(image?.complete && image.naturalWidth > 0); });
      // `complete` proves decode eligibility, but not that Chrome has committed the
      // decoded frame to the compositor. Wait for decode plus two subsequent paints
      // so a screenshot cannot capture the initial dark fallback frame.
      await page.evaluate(async () => {
        const picture = document.querySelector('.literary-picture');
        const images = [...(picture?.querySelectorAll('img') ?? [])];
        await Promise.all(images.map(image => image.decode?.().catch(() => {})));
        // Character entrances are part of the composed frame too: settle them
        // before inspecting a pair or group presentation.
        await Promise.all((picture?.getAnimations({ subtree: true }) ?? []).map(animation => animation.finished.catch(() => {})));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
    }
    const readback = await page.evaluate(() => {
      const picture = document.querySelector('.literary-picture');
      const image = picture?.querySelector('img');
      const sheet = document.querySelector('.reader-sheet');
      const action = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Восстановить облачный прогресс'));
      const appRect = document.querySelector('.literary-home,.literary-reader')?.getBoundingClientRect();
      const stage = [...document.querySelectorAll('.stage-character')];
      const stageBoxes = stage.map(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const image = node.querySelector('img');
        return { className: node.className, width: rect.width, height: rect.height, opacity: style.opacity, visibility: style.visibility, imageNatural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0] };
      });
      return {
        sceneId: document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
        cue: picture?.dataset.visualBeat ?? null,
        asset: image?.dataset.asset ?? null,
        natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
        mode: picture?.dataset.mode ?? null,
        platformMode: window.__LITERARY_QA__?.getPlatformMode?.() ?? null,
        stageCount: stage.length,
        stageBoxes,
        cloudRestore: action ? { className: action.className, parent: action.parentElement?.className ?? null } : null,
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
        edgeToEdge: Boolean(appRect && appRect.left <= .5 && appRect.top <= .5 && innerWidth - appRect.right <= .5 && innerHeight - appRect.bottom <= .5),
        sheetTop: sheet?.getBoundingClientRect().top ?? null
      };
    });
    const screenshot = path.join(output, `${scenario.label}-${view.name}-${view.width}x${view.height}.png`);
    await page.screenshot({ path: screenshot });
    const bytes = await fs.readFile(screenshot);
    let restoreInteraction = null;
    if (scenario.id === 'menu') {
      page.once('dialog', dialog => dialog.accept());
      await page.locator('.cloud-restore').click();
      await page.locator('.reader-sheet').waitFor();
      restoreInteraction = await page.evaluate(() => ({ state: window.__LITERARY_QA__?.getState?.(), restoreVisible: Boolean(document.querySelector('.cloud-restore')) }));
    }
    evidence.captures.push({ scenario: scenario.label, view, screenshot, screenshotSha256: digest(bytes), screenshotBytes: bytes.length, expectedCue: scenario.expectedCue ?? null, maxCast: scenario.maxCast ?? null, readback, restoreInteraction, errors, missing });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
const failures = evidence.captures.filter(capture => capture.errors.length || capture.missing.length || capture.readback.overflow || capture.readback.internalScroll || !capture.readback.edgeToEdge || (capture.scenario === 'main-menu' && (!capture.readback.cloudRestore || capture.readback.cloudRestore.parent !== 'home-utility' || capture.restoreInteraction?.state?.sceneId !== 'S03' || capture.restoreInteraction.restoreVisible)) || (capture.expectedCue && capture.readback.cue !== capture.expectedCue) || (capture.maxCast != null && capture.readback.stageCount > capture.maxCast));
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', output, captures: evidence.captures.length, failures: failures.length }));
