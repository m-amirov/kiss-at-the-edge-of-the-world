import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualAt } from '../../src/literary-visual-directions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'output/playwright/rendered-coverage-audit');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const viewports = [{ name: 'desktop', width: 1920, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

const choices = {};
for (const scene of literarySeason.scenes) for (const chunk of scene.chunks ?? []) {
  const match = chunk.title.match(/(S\d{2}-C\d+)/);
  if (match) choices[match[1]] = 'A';
}

function targetFor(scene) {
  const flow = compileInteractivePlayback(scene, choices);
  let fallback = { index: 0, direction: visualAt(scene.id, flow[0], choices) };
  for (let index = 0; index < flow.length; index += 1) {
    const direction = visualAt(scene.id, flow[index], choices);
    if (direction.beatId !== 'scene-start' && direction.art) return { index, direction };
    fallback = { index, direction };
  }
  return fallback;
}

const stateFor = (scene, position) => ({ schemaVersion: 3, sceneId: scene.id, position, choices, finished: false, visited: ['S01', scene.id], runId: `rendered-audit-${scene.id}-${Date.now()}`, revision: 0 });
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { generatedAt: new Date().toISOString(), head: (await import('node:child_process')).execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), baseUrl, viewports, scenes: [] };

try {
  for (const scene of literarySeason.scenes) {
    const target = targetFor(scene);
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const errors = [];
      const responses = [];
      page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
      page.on('requestfailed', request => errors.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? 'unknown'}`));
      page.on('response', response => { if (response.url().includes('/assets/')) responses.push({ url: response.url(), status: response.status() }); });
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: stateFor(scene, target.index) });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Продолжить/ }).click();
      await page.locator('.literary-picture').waitFor();
      await page.waitForTimeout(50);
      const readback = await page.evaluate(() => {
        const picture = document.querySelector('.literary-picture');
        const image = picture?.querySelector('img');
        const style = picture ? getComputedStyle(picture) : null;
        const imageStyle = image ? getComputedStyle(image) : null;
        const rect = picture?.getBoundingClientRect();
        return {
          sceneId: document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
          cue: picture?.dataset.visualBeat ?? null,
          mode: picture?.dataset.mode ?? null,
          asset: image?.dataset.asset ?? null,
          desktopAsset: image?.dataset.desktopAsset ?? null,
          imageComplete: image?.complete ?? false,
          natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
          imageOpacity: imageStyle?.opacity ?? null,
          imageDisplay: imageStyle?.display ?? null,
          imageVisibility: imageStyle?.visibility ?? null,
          pictureBackground: style?.backgroundImage ?? null,
          pictureRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          edgeToEdge: Boolean(rect && rect.left <= .5 && rect.top <= .5 && innerWidth - rect.right <= .5 && innerHeight - rect.bottom <= .5),
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
          stageCount: document.querySelectorAll('.stage-character').length
        };
      });
      const screenshot = path.join(output, `${scene.id}-${viewport.name}.png`);
      await page.screenshot({ path: screenshot });
      const bytes = await fs.readFile(screenshot);
      const desktopFile = target.direction.art?.file ?? null;
      const portraitCandidate = desktopFile && path.join(root, 'assets', target.direction.art.type === 'cg' ? 'cg' : 'backgrounds', desktopFile.replace('.png', '-portrait.png'));
      const expectedFile = viewport.width < 680 && portraitCandidate && await fs.stat(portraitCandidate).then(() => desktopFile.replace('.png', '-portrait.png')).catch(() => desktopFile) || desktopFile;
      const expected = target.direction.art ? `${target.direction.art.type === 'cg' ? 'cg' : 'background'}/${expectedFile}` : null;
      const assetLoaded = readback.imageComplete && readback.natural[0] > 0 && readback.natural[1] > 0 && readback.imageOpacity !== '0' && readback.imageDisplay !== 'none' && readback.imageVisibility !== 'hidden';
      const status = expected ? (assetLoaded && readback.asset && `${readback.mode === 'cinematic' ? 'cg' : 'background'}/${readback.asset}` === expected && !errors.length ? 'PASS' : 'FAIL') : (!readback.asset && readback.mode === 'environment' ? 'INTENTIONAL_NO_ART' : 'FAIL');
      evidence.scenes.push({ sceneId: scene.id, targetIndex: target.index, expected, viewport: { name: viewport.name, width: viewport.width, height: viewport.height }, status, errors, assetResponses: responses.filter(item => item.url.includes(readback.asset ?? '__missing__')), readback, screenshot, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, actualPixelsReceived: true });
      await context.close();
    }
  }
} finally { await browser.close(); }

const failures = evidence.scenes.filter(item => item.status === 'FAIL');
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify({ ...evidence, summary: { scenes: literarySeason.scenes.length, captures: evidence.scenes.length, failures: failures.length, failureScenes: [...new Set(failures.map(item => item.sceneId))] } }, null, 2));
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', output, scenes: literarySeason.scenes.length, captures: evidence.scenes.length, failures: failures.length, failureScenes: [...new Set(failures.map(item => item.sceneId))] }));
if (failures.length) process.exitCode = 1;
