import { chromium } from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualCues } from '../../src/literary-visual-directions.js';

const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const requests = [];

function choicesFor(route = 'A') {
  const choices = {};
  for (const scene of literarySeason.scenes) {
    for (const chunk of scene.chunks ?? []) {
      const match = chunk.title.match(/Выбор\s+(S\d{2}-C\d+)/u);
      if (match) choices[match[1]] = 'A';
    }
  }
  choices['S05-C1'] = 'B';
  choices['S17-C2'] = 'A';
  choices['S18-C1'] = 'A';
  choices['S26-C1'] = route;
  choices['S26-C90'] = 'A';
  choices['S26-C91'] = 'A';
  for (const scene of literarySeason.scenes) {
    for (let guard = 0; guard < 20; guard += 1) {
      const pending = compileInteractivePlayback(scene, choices).find(item => item.type === 'choice');
      if (!pending) break;
      choices[pending.id] ??= pending.options?.[0]?.code ?? 'A';
    }
  }
  return choices;
}

const choices = choicesFor('A');
const scene = literarySeason.scenes.find(item => item.id === 'S18');
const flow = compileInteractivePlayback(scene, choices);
const cue = visualCues.S18.find(item => item.id === 'hofn-dance');
const cueIndex = flow.findIndex(entry => [entry.sourceStartRef, entry.sourceEndRef].some(ref => ref?.chunk === cue.at[0] && ref?.paragraph === cue.at[1]));
if (cueIndex < 1) throw new Error(`Cannot locate S18 dance cue in playable flow: ${cueIndex}`);
const state = { schemaVersion: 3, sceneId: 'S18', position: cueIndex - 1, choices, finished: false, visited: ['S01', 'S17', 'S18'], runId: 'image-request-count', revision: 0 };

await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
await page.route('**/sdk.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
page.on('request', request => { if (/\/assets\/(cg|backgrounds|characters)\//u.test(request.url())) requests.push(request.url()); });
await page.goto(baseUrl, { waitUntil: 'commit' });
await page.getByRole('button', { name: /Продолжить/ }).click();
await page.waitForFunction(() => [...document.querySelectorAll('.literary-picture > img')].some(image => image.complete && image.naturalWidth > 0));
const targetAsset = 's18-hofn-dance-lights-portrait.webp';
const requestsBeforeAdvance = [...requests];
await page.locator('.reader-sheet').click({ position: { x: 8, y: 8 } });
await page.waitForFunction(expected => [...document.querySelectorAll('.literary-picture > img')].some(image => image.dataset.asset === expected && image.complete && image.naturalWidth > 0 && image.style.opacity !== '0'), targetAsset);
const result = { baseUrl, cueIndex, total: requests.length, unique: new Set(requests).size, duplicates: requests.length - new Set(requests).size, targetRequestedBeforeAdvance: requestsBeforeAdvance.some(request => request.endsWith(`/assets/cg/${targetAsset}`)), requests };
console.log(JSON.stringify(result));
await context.close();
await browser.close();
