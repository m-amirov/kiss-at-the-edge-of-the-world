import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root = process.cwd();
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html?qa=mobile-hud-overlap-audit';
const output = process.env.LITERARY_QA_HUD_OUTPUT ?? 'artifacts/evidence/mobile-hud-overlap-2026-10-08.json';
const screenshotDir = process.env.LITERARY_QA_HUD_SCREENSHOTS ?? 'artifacts/evidence/mobile-hud-overlap-2026-10-08';
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const viewports = [
  { name: 'mobile-small', width: 360, height: 640 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-wide', width: 412, height: 915 }
];
const sceneFilter = process.env.LITERARY_QA_HUD_SCENE ? new Set(process.env.LITERARY_QA_HUD_SCENE.split(',').map(value => value.trim()).filter(Boolean)) : null;
const defaultChoices = Object.fromEntries([...new Set(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)))].map(id => [id, 'A']));
const clone = value => JSON.parse(JSON.stringify(value));

const stateFor = (sceneId, position, choices, viewport) => ({
  schemaVersion: 3,
  sceneId,
  position,
  choices,
  finished: false,
  visited: [sceneId],
  runId: `mobile-hud-${sceneId}-${position}-${viewport}-${Date.now()}`,
  revision: 0
});

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const rect = element => {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
};

async function inspect(page) {
  return page.evaluate(async () => {
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const box = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const alphaBounds = async image => {
      if (!image?.complete || !image.naturalWidth) return null;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      try { context.drawImage(image, 0, 0); } catch { return null; }
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 20) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right < left || bottom < top) return null;
      return { left, top, right: right + 1, bottom: bottom + 1, width: right - left + 1, height: bottom - top + 1 };
    };
    const toViewport = (bounds, imageRect, natural) => bounds && imageRect && natural ? {
      left: imageRect.left + bounds.left / natural.width * imageRect.width,
      top: imageRect.top + bounds.top / natural.height * imageRect.height,
      right: imageRect.left + bounds.right / natural.width * imageRect.width,
      bottom: imageRect.top + bounds.bottom / natural.height * imageRect.height,
      width: bounds.width / natural.width * imageRect.width,
      height: bounds.height / natural.height * imageRect.height
    } : null;
    const hud = document.querySelector('.reader-header');
    const characters = [];
    for (const node of document.querySelectorAll('.stage-character')) {
      const image = node.querySelector('img');
      const imageRect = box(image);
      const alpha = await alphaBounds(image);
      const visible = toViewport(alpha, imageRect, image && { width: image.naturalWidth, height: image.naturalHeight });
      const critical = visible ? { ...visible, bottom: visible.top + visible.height * .3, height: visible.height * .3 } : null;
      characters.push({ id: [...node.classList].find(value => value.startsWith('stage-') && value !== 'stage-character')?.replace('stage-', '') ?? null, dom: box(node), image: imageRect, visible, critical });
    }
    const hudBox = box(hud);
    const overlaps = characters.filter(character => character.critical && hudBox && (overlap(character.critical, hudBox) > 0)).map(character => ({ id: character.id, pixels: overlap(character.critical, hudBox), visible: character.visible, critical: character.critical, hud: hudBox }));
    const sheetBox = box(document.querySelector('.reader-sheet'));
    const lowerOverlaps = characters.filter(character => character.critical && sheetBox && (overlap(character.critical, sheetBox) > 0)).map(character => ({ id: character.id, pixels: overlap(character.critical, sheetBox), critical: character.critical, readerSheet: sheetBox }));
    return {
      hud: hudBox,
      characters,
      overlaps,
      lowerOverlaps,
      readerSheet: sheetBox,
      sceneStage: box(document.querySelector('.scene-stage')),
      stageLayout: document.querySelector('.scene-stage')?.dataset.layout ?? null,
      presentation: document.querySelector('.literary-reader')?.dataset.presentation ?? null,
      screenshotState: window.__LITERARY_QA__?.getState?.() ?? null,
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      imageLoaded: [...document.querySelectorAll('.stage-character img')].every(image => image.complete && image.naturalWidth > 0)
    };
  });
}

await fs.mkdir(path.resolve(root, screenshotDir), { recursive: true });
const evidence = { schemaVersion: 1, sourceHead, generatedAt: new Date().toISOString(), baseUrl, viewports, scenes: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const scene of literarySeason.scenes.filter(item => !sceneFilter || sceneFilter.has(item.id))) {
      const flow = compileInteractivePlayback(scene, defaultChoices, 'ru');
      const positions = scene.id === 'S01' ? [0, 1, 2] : [0];
      for (const position of positions) {
        const state = stateFor(scene.id, position, defaultChoices, viewport.name);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(window.__LITERARY_QA__));
        const resume = page.getByRole('button', { name: /Продолжить|Continue|Новая игра|New game/ }).first();
        if (await resume.count()) await resume.click();
        if (process.env.LITERARY_QA_HUD_DISABLE_SAFE_ZONE === '1') await page.addStyleTag({ content: '.literary-reader .scene-stage{transform:none!important}' });
        await page.waitForTimeout(120);
        await page.waitForFunction(() => [...document.querySelectorAll('.stage-character img')].every(image => image.complete && image.naturalWidth > 0), { timeout: 10000 }).catch(() => {});
        const measurement = await inspect(page);
        const screenshot = path.join(root, screenshotDir, `${scene.id}-p${position + 1}-${viewport.name}.png`);
        await page.screenshot({ path: screenshot });
        evidence.scenes.push({ scene: scene.id, position, displayedPosition: `${position + 1}/${flow.length}`, viewport, text: flow[position]?.text ?? flow[position]?.question ?? '', status: measurement.overlaps.length || measurement.lowerOverlaps.length ? 'FAIL' : 'PASS', measurement, screenshot: path.relative(root, screenshot).replaceAll('\\', '/') });
      }
    }
    await context.close();
  }
} finally { await browser.close(); }
const failures = evidence.scenes.filter(item => item.status === 'FAIL');
evidence.summary = { scenes: literarySeason.scenes.length, states: evidence.scenes.length, failures: failures.length, failureStates: failures.map(item => `${item.scene}:${item.displayedPosition}:${item.viewport.width}x${item.viewport.height}`) };
await fs.writeFile(path.resolve(root, output), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ output, ...evidence.summary }, null, 2));
if (failures.length) process.exitCode = 1;
