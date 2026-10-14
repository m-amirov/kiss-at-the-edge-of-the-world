import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualCues } from '../../src/literary-visual-directions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.LITERARY_QA_OUTPUT ? path.resolve(process.env.LITERARY_QA_OUTPUT) : path.join(root, 'artifacts/evidence/image-preload-transitions-2026-10-11');
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html';
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const networkProfiles = {
  normal: null,
  fast3g: { latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 },
  slow3g: { latency: 400, downloadThroughput: 400_000 / 8, uploadThroughput: 400_000 / 8 }
};

function choicesFor(route = 'A') {
  const choices = {};
  for (const scene of literarySeason.scenes) {
    for (const chunk of scene.chunks ?? []) {
      const id = chunk.title.match(/Выбор\s+(S\d{2}-C\d+)/u)?.[1];
      if (id) choices[id] = 'A';
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

function flowPosition(sceneId, choices, chunk, paragraph) {
  const scene = literarySeason.scenes.find(item => item.id === sceneId);
  const flow = compileInteractivePlayback(scene, choices);
  const index = flow.findIndex(entry => [entry.sourceStartRef, entry.sourceEndRef].some(ref => ref?.chunk === chunk && ref?.paragraph === paragraph));
  if (index < 0) throw new Error(`No playable position for ${sceneId} [${chunk},${paragraph}]`);
  return index;
}

function cuePosition(sceneId, cueId, choices) {
  const cue = visualCues[sceneId].find(item => item.id === cueId);
  if (!cue) throw new Error(`Missing cue ${sceneId}/${cueId}`);
  return flowPosition(sceneId, choices, cue.at[0], cue.at[1]);
}

function saveState(sceneId, position, choices, visited = []) {
  return { schemaVersion: 3, sceneId, position, choices, finished: false, visited: [...new Set([...visited, sceneId])], runId: `qa-${sceneId}-${Date.now()}`, revision: 0 };
}

async function readback(page) {
  return page.evaluate(() => {
    const picture = document.querySelector('.literary-picture');
    const layers = [...document.querySelectorAll('.literary-picture > img')];
    const active = layers.find(image => image.style.opacity !== '0') ?? layers.at(-1);
    const content = document.querySelector('.reader-content');
    return {
      viewport: [innerWidth, innerHeight],
      visual: picture ? { ...picture.dataset } : null,
      layers: layers.map(image => ({ asset: image.dataset.asset ?? null, desktopAsset: image.dataset.desktopAsset ?? null, complete: image.complete, naturalWidth: image.naturalWidth, opacity: image.style.opacity || '1', transition: image.style.transition || getComputedStyle(image).transition })),
      activeAsset: active?.dataset.asset ?? null,
      activeDecoded: Boolean(active?.complete && active.naturalWidth > 0),
      stageSprites: document.querySelectorAll('.stage-character').length,
      bodyOverflow: document.body.scrollWidth > document.body.clientWidth || document.body.scrollHeight > document.body.clientHeight,
      contentScrollable: Boolean(content && content.scrollHeight > content.clientHeight + 1),
      qa: window.__LITERARY_QA__?.getImagePreloadStats?.() ?? null,
      imageErrors: window.__IMAGE_ERRORS__ ?? []
    };
  });
}

async function waitForDecoded(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.literary-picture > img')].some(image => image.complete && image.naturalWidth > 0 && image.style.opacity !== '0'), null, { timeout: 90000 });
  await page.waitForTimeout(260);
}

async function waitForAsset(page, asset) {
  await page.waitForFunction(expected => [...document.querySelectorAll('.literary-picture > img')].some(image => image.dataset.asset === expected && image.complete && image.naturalWidth > 0 && image.style.opacity !== '0'), asset, { timeout: 90000 });
  await page.waitForTimeout(260);
}

async function advance(page) {
  // The production reader intentionally lets the non-interactive text layer
  // advance too; clicking its padding avoids a mobile overlay hit-test race.
  await page.locator('.reader-sheet').click({ position: { x: 8, y: 8 } });
}

async function openReader(page) {
  const continueButton = page.getByRole('button', { name: /Продолжить/ });
  if (await continueButton.count()) await continueButton.click();
  else await page.getByRole('button', { name: 'Новая игра', exact: true }).click();
  await page.locator('.reader-sheet').waitFor();
  await waitForDecoded(page);
}

async function setupPage(browser, { viewport, profile = 'normal', state, reducedMotion = false, blockPath = null }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  context.setDefaultTimeout(90000);
  await context.addInitScript(({ key, value }) => {
    if (value && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    window.__IMAGE_ERRORS__ = [];
    window.addEventListener('literary:image-error', event => window.__IMAGE_ERRORS__.push(event.detail));
  }, { key: literarySaveKey, value: state ?? null });
  await page.route('**/sdk.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (blockPath) await page.route(`**/${blockPath}`, route => route.abort());
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? 'unknown'}`));
  page.on('request', request => {
    if (/\/assets\/(cg|backgrounds|characters)\//u.test(request.url())) requests.push(request.url());
  });
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  if (networkProfiles[profile]) await client.send('Network.emulateNetworkConditions', { offline: false, ...networkProfiles[profile] });
  await page.goto(baseUrl, { waitUntil: 'commit', timeout: 30000 });
  await page.getByRole('button', { name: /Новая игра|Продолжить/ }).first().waitFor({ timeout: 90000 });
  return { context, page, errors, requests };
}

async function scenario(browser, name, options, action) {
  const run = await setupPage(browser, options);
  try {
    await openReader(run.page);
    const result = await action(run.page, run);
    const expectedErrors = options.expectedErrors ?? [];
    const isTeardownAbort = error => /^requestfailed:.+\/assets\/(?:audio\/[^:]+|branding\/kiss-at-the-edge-cover\.png):net::ERR_ABORTED$/u.test(error);
    const ignoredRequestFailures = run.errors.filter(isTeardownAbort);
    let screenshot = null;
    if (options.capture) {
      const screenshotPath = path.join(output, `${name}-${options.viewport.width}x${options.viewport.height}.png`);
      await run.page.screenshot({ path: screenshotPath });
      const bytes = await fs.readFile(screenshotPath);
      screenshot = { path: screenshotPath, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength };
    }
    return {
      name,
      viewport: options.viewport,
      profile: options.profile ?? 'normal',
      errors: run.errors.filter(error => !isTeardownAbort(error) && !expectedErrors.some(expected => error.includes(expected))),
      ignoredRequestFailures,
      assetRequests: run.requests,
      screenshot,
      result
    };
  } finally {
    await run.context.close();
  }
}

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
await fs.mkdir(output, { recursive: true });
const evidence = {
  generatedAt: new Date().toISOString(),
  sourceHead: process.env.SOURCE_HEAD ?? 'a34a9d0fb3adae1da9746404a06c79c25b63f5c0',
  baseUrl,
  runner: 'installed Google Chrome via bundled Playwright library; playwright-cli unavailable because HCS_E_HYPERV_NOT_INSTALLED',
  scenarios: []
};

try {
  evidence.scenarios.push(await scenario(browser, 'cold-launch-desktop', { viewport: viewports[0], capture: true }, async page => readback(page)));
  evidence.scenarios.push(await scenario(browser, 'cold-launch-390', { viewport: viewports[1], capture: true }, async page => readback(page)));
  evidence.scenarios.push(await scenario(browser, 'cold-launch-360', { viewport: viewports[2], capture: true }, async page => readback(page)));

  const s18Choices = choicesFor('A');
  const s18Dance = cuePosition('S18', 'hofn-dance', s18Choices);
  const s18Before = saveState('S18', Math.max(0, s18Dance - 1), s18Choices, ['S01', 'S17', 'S18']);
  evidence.scenarios.push(await scenario(browser, 's18-slow3g-transition', { viewport: viewports[1], profile: 'slow3g', state: s18Before, capture: true }, async (page, run) => {
    const before = await readback(page);
    await advance(page);
    const during = await readback(page);
    await waitForAsset(page, 's18-hofn-dance-lights-portrait.webp');
    const after = await readback(page);
    return { before, during, after, keptDecodedLayer: during.layers.some(layer => layer.complete && layer.naturalWidth > 0 && layer.opacity !== '0'), expectedTarget: 's18-hofn-dance-lights-portrait.webp' };
  }));

  const s26Choices = choicesFor('A');
  const s26Start = saveState('S26', 0, s26Choices, ['S01', 'S17', 'S18', 'S26']);
  evidence.scenarios.push(await scenario(browser, 's26-final-cg-before-choice', { viewport: viewports[0], profile: 'fast3g', state: s26Start, capture: true }, async page => readback(page)));
  const s26Eric = cuePosition('S26', 'route-eric', s26Choices);
  evidence.scenarios.push(await scenario(browser, 's26-route-cg-mobile', { viewport: viewports[1], profile: 'slow3g', state: saveState('S26', s26Eric, s26Choices, ['S01', 'S17', 'S18', 'S26']), capture: true }, async page => readback(page)));

  evidence.scenarios.push(await scenario(browser, 'rapid-pages-menu-back-save', { viewport: viewports[0], state: s18Before }, async page => {
    const before = await readback(page);
    for (let i = 0; i < 5; i += 1) await advance(page);
    const afterRapid = await readback(page);
    await page.getByRole('button', { name: /Меню/ }).click();
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await waitForDecoded(page);
    const afterMenu = await readback(page);
    await page.reload();
    await openReader(page);
    const afterReload = await readback(page);
    return { before, afterRapid, afterMenu, afterReload, restoredSameAsset: afterReload.activeAsset === afterMenu.activeAsset };
  }));

  const s26RouteState = saveState('S26', s26Eric, s26Choices, ['S01', 'S17', 'S18', 'S26']);
  evidence.scenarios.push(await scenario(browser, 'orientation-mapping', { viewport: viewports[0], state: s26RouteState }, async page => {
    const desktop = await readback(page);
    await page.setViewportSize(viewports[1]);
    await waitForAsset(page, 's26-eric-choice-portrait.webp');
    const portrait = await readback(page);
    await page.setViewportSize(viewports[0]);
    await waitForAsset(page, 's26-eric-choice.webp');
    const landscape = await readback(page);
    return { desktop, portrait, landscape, portraitAssetChanged: desktop.activeAsset !== portrait.activeAsset, landscapeRestored: landscape.activeAsset === desktop.activeAsset };
  }));

  evidence.scenarios.push(await scenario(browser, 'reduced-motion', { viewport: viewports[1], profile: 'fast3g', state: s18Before, reducedMotion: true }, async page => {
    const before = await readback(page);
    await advance(page);
    await waitForAsset(page, 's18-hofn-dance-lights-portrait.webp');
    const after = await readback(page);
    return { before, after, noTransition: after.layers.every(layer => layer.transition === 'none' || layer.transition === 'all 0s ease 0s') };
  }));

  evidence.scenarios.push(await scenario(browser, 'image-error-fallback', { viewport: viewports[1], profile: 'slow3g', state: s18Before, blockPath: 'assets/cg/s18-hofn-dance-lights-portrait.webp', expectedErrors: ['s18-hofn-dance-lights-portrait.webp'] }, async page => {
    const before = await readback(page);
    await advance(page);
    await page.waitForTimeout(900);
    const after = await readback(page);
    return { before, after, stableFallback: after.layers.some(layer => layer.complete && layer.naturalWidth > 0) || after.layers.length === 0, diagnostics: after.imageErrors };
  }));

  const sequence = await scenario(browser, 's18-sequence-fast3g-request-count', { viewport: viewports[2], profile: 'fast3g', state: saveState('S18', 0, s18Choices, ['S01', 'S17', 'S18']) }, async (page, run) => {
    const assets = [];
    for (let i = 0; i < 7; i += 1) {
      await waitForDecoded(page);
      assets.push((await readback(page)).activeAsset);
      await advance(page);
    }
    await waitForDecoded(page);
    assets.push((await readback(page)).activeAsset);
    return { assets, totalAssetRequests: run.requests.length, uniqueAssetRequests: new Set(run.requests).size, duplicateRequestCount: run.requests.length - new Set(run.requests).size };
  });
  evidence.scenarios.push(sequence);
} finally {
  await browser.close();
}

await fs.mkdir(output, { recursive: true });
const jsonPath = path.join(output, 'evidence.json');
await fs.writeFile(jsonPath, JSON.stringify(evidence, null, 2));
const summary = {
  status: evidence.scenarios.every(scenario => scenario.errors.length === 0) ? 'PASS' : 'FAIL',
  scenarios: evidence.scenarios.length,
  errors: evidence.scenarios.reduce((sum, scenario) => sum + scenario.errors.length, 0),
  output: jsonPath,
  sha256: crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex')
};
console.log(JSON.stringify(summary));
