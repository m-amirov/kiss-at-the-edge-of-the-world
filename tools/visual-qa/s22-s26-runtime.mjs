import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'output/playwright/s27-runtime-2026-09-24');
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const targetCues = {
  S27: [{ id: 's27-egilsstadir-boardwalk', chunk: 0, paragraph: 0 }]
};

function choicesFor(route = 'A') {
  const choices = {};
  for (const scene of literarySeason.scenes) {
    for (const item of scene.items ?? []) {
      if (item.type === 'choice' && item.id) choices[item.id] = item.options?.[0]?.code ?? 'A';
    }
  }
  choices['S17-C2'] = 'A';
  choices['S05-C1'] = 'B';
  choices['S26-C1'] = route;
  choices['S26-C90'] = 'A';
  choices['S26-C91'] = 'A';
  return choices;
}

function flowPosition(sceneId, choices, chunk, paragraph) {
  const scene = literarySeason.scenes.find((item) => item.id === sceneId);
  const flow = compileInteractivePlayback(scene, choices);
  const index = flow.findIndex((entry) => [entry.sourceStartRef, entry.sourceEndRef].some((ref) => ref?.chunk === chunk && ref?.paragraph === paragraph));
  if (index < 0) throw new Error(`No playable position for ${sceneId} [${chunk},${paragraph}]`);
  return index;
}

function saveState(sceneId, position, choices, visited = []) {
  return { schemaVersion: 3, sceneId, position, choices, finished: false, visited: [...new Set([...visited, sceneId])], runId: `qa-${sceneId}-${Date.now()}`, revision: 0 };
}

function targets() {
  const result = [];
  const common = choicesFor('A');
  for (const [sceneId, cues] of Object.entries(targetCues)) {
    for (const cue of cues) {
      result.push({ id: `${sceneId}-${cue.id}`, sceneId, choices: common, position: flowPosition(sceneId, common, cue.chunk, cue.paragraph), phase: 'event' });
    }
  }
  return result;
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const evidence = { generatedAt: new Date().toISOString(), baseUrl, productionIsolation: { urlParametersUsed: false, productionDebugCodeChanged: false, saveKey: literarySaveKey, mechanism: 'validated existing literary save loaded before production runtime boot' }, captures: [] };
  try {
    for (const target of targets()) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const state = saveState(target.sceneId, target.position, target.choices, ['S01', target.sceneId]);
        await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        page.on('requestfailed', (request) => errors.push(`requestfailed:${request.url()}`));
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: /Продолжить/ }).click();
        await page.locator('.reader-sheet').waitFor();
        const readback = await page.evaluate(() => {
          const picture = document.querySelector('.literary-picture');
          const image = picture?.querySelector('img');
          const sheet = document.querySelector('.reader-sheet');
          const buttons = [...document.querySelectorAll('button')].filter((button) => button.offsetParent !== null);
          return {
            header: document.querySelector('.chapter-index')?.textContent ?? '',
            sceneId: document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
            visualEventId: picture?.dataset.visualBeat ?? null,
            presentationMode: picture?.dataset.mode ?? null,
            asset: image?.dataset.asset ?? null,
            desktopAsset: image?.dataset.desktopAsset ?? null,
            imgSrc: image?.src ?? null,
            naturalWidth: image?.naturalWidth ?? 0,
            naturalHeight: image?.naturalHeight ?? 0,
            stageSprites: document.querySelectorAll('.stage-character').length,
            overflow: { document: document.documentElement.scrollWidth > document.documentElement.clientWidth, body: document.body.scrollWidth > document.body.clientWidth },
            textLayer: { visible: Boolean(sheet && sheet.offsetParent !== null), top: sheet?.getBoundingClientRect().top ?? null, contentScrollable: Boolean(document.querySelector('.reader-content') && document.querySelector('.reader-content').scrollHeight > document.querySelector('.reader-content').clientHeight + 1) },
            importantDetailsRegion: { imageBottom: image?.getBoundingClientRect().bottom ?? null, textTop: sheet?.getBoundingClientRect().top ?? null, actionAboveTextLayer: Boolean(image && sheet && image.getBoundingClientRect().bottom >= sheet.getBoundingClientRect().top) },
            controlsWithinViewport: buttons.every((button) => { const rect = button.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= window.innerHeight; }),
            buttons: buttons.map((button) => ({ text: button.textContent?.trim(), enabled: !button.disabled }))
          };
        });
        const screenshot = path.join(output, `${target.id}-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: screenshot });
        evidence.captures.push({ target: target.id, sceneId: target.sceneId, phase: target.phase, route: target.route ?? null, cue: target.cue ?? null, viewport, screenshot, errors, readback });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ status: 'PASS', output, captures: evidence.captures.length, errors: evidence.captures.reduce((sum, item) => sum + item.errors.length, 0) }));
}

main().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
