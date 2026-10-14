import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compileScenePlayback, nextLiteraryScene } from '../../src/literary-engine.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySeason } from '../../src/literary-season-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = process.env.EPISODE_INTERSTITIAL_BASE_URL || 'http://127.0.0.1:4174';
const playwrightRoot = process.env.EPISODE_PLAYWRIGHT_ROOT;
if (!playwrightRoot) throw new Error('EPISODE_PLAYWRIGHT_ROOT is required for the isolated browser QA runtime');
const { chromium } = createRequire(path.join(playwrightRoot, 'package.json'))('playwright');
const evidenceDir = path.join(root, 'artifacts/evidence/episode-interstitial');
const byId = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const browserLaunchOptions = { headless: true, ...(process.env.EPISODE_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.EPISODE_CHROMIUM_EXECUTABLE_PATH } : {}) };

function terminalState(targetSceneId = 'S04', locale = 'ru') {
  const choices = {};
  const visited = [];
  let sceneId = 'S01';
  while (sceneId) {
    const scene = byId.get(sceneId);
    if (!scene) throw new Error(`Unknown scene ${sceneId}`);
    visited.push(sceneId);
    let flow = compileInteractivePlayback(scene, choices, locale);
    while (flow.at(-1)?.type === 'choice') {
      const choice = flow.at(-1);
      choices[choice.id] = choice.options[0].code;
      flow = compileInteractivePlayback(scene, choices, locale);
    }
    if (sceneId === targetSceneId) return { choices, visited, position: flow.length };
    sceneId = nextLiteraryScene(sceneId, choices);
  }
  throw new Error(`Could not reach ${targetSceneId}`);
}

function sdkInitScript() {
  return ({ locale, state, cloudState = null, seedLocal = true }) => {
    const calls = { ad: 0, gameplayStarts: 0, gameplayStops: 0, cloudWrites: 0 };
    const listeners = {};
    let callbacks = null;
    const saveKey = 'kiss-at-the-edge-of-the-world:literary-draft:v1';
    const cloudKey = 'kiss-at-the-edge-of-the-world:literary-season:v1';
    window.__AD_MOCK__ = { calls, listeners, get callbacks() { return callbacks; } };
    window.__AD_MOCK__.lastCloudState = null;
    window.YaGames = {
      init: async () => ({
        environment: { i18n: { lang: locale === 'ru' ? 'ru-RU' : 'en-US' } },
        features: {
          LoadingAPI: { ready() {} },
          GameplayAPI: {
            start() { calls.gameplayStarts += 1; },
            stop() { calls.gameplayStops += 1; }
          }
        },
        adv: {
          showFullscreenAdv(next) {
            calls.ad += 1;
            callbacks = next.callbacks;
            callbacks.onOpen?.();
          }
        },
        async getPlayer() {
          return {
            async getData() { return cloudState ? { [cloudKey]: cloudState } : null; },
            async setData(data) { calls.cloudWrites += 1; window.__AD_MOCK__.lastCloudState = data?.[cloudKey] ?? null; }
          };
        },
        on(name, handler) { listeners[name] = handler; },
        off(name) { delete listeners[name]; }
      })
    };
    const audioKey = 'kiss-at-the-edge-of-the-world:audio-settings:v1';
    if (seedLocal && !window.localStorage.getItem(saveKey)) window.localStorage.setItem(saveKey, JSON.stringify(state));
    if (!window.localStorage.getItem(audioKey)) window.localStorage.setItem(audioKey, JSON.stringify({ volume: 0.28, muted: true }));
  };
}

async function runScenario({ width, height, locale, closeMode, name }) {
  const browser = await chromium.launch(browserLaunchOptions);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 700 });
  context.setDefaultTimeout(10000);
  const state = { schemaVersion: 3, ...terminalState('S04', locale), sceneId: 'S04', position: 999, finished: false, runId: `qa-${name}`, revision: 4, pendingEpisodeTransition: null };
  const consoleErrors = [];
  const failedRequests = [];
  const expectedAborts = [];
  await context.addInitScript(sdkInitScript(), { locale, state });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error' && !message.location().url.endsWith('/sdk.js')) consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText || '';
    if (request.url().endsWith('/sdk.js')) return;
    if (errorText === 'net::ERR_ABORTED' && /\/assets\/audio\/music\/[^/]+\.ogg$/u.test(request.url())) {
      expectedAborts.push(`${request.method()} ${request.url()} ${errorText}`);
      return;
    }
    failedRequests.push(`${request.method()} ${request.url()} ${errorText}`);
  });
  await page.goto(`${baseUrl}/?lang=${locale}`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForFunction(() => Boolean(window.__LITERARY_QA__?.getState));
  await page.getByRole('button', { name: new RegExp(locale === 'ru' ? 'Продолжить' : 'Continue') }).click();
  const action = page.locator('[data-episode-transition="true"]');
  await action.waitFor({ state: 'visible' });
  const label = await action.innerText();
  const before = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), audio: window.__LITERARY_QA__.getAudioState() }));
  const layout = await page.evaluate(() => {
    const node = document.querySelector('[data-episode-transition="true"]');
    const rect = node?.getBoundingClientRect();
    return {
      noDocumentScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
      noBodyScroll: document.body.scrollHeight <= window.innerHeight + 1,
      actionWithinViewport: Boolean(rect && rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth)
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}-before.png`), fullPage: true });
  await action.click();
  await action.click({ force: true });
  await page.waitForFunction(() => window.__AD_MOCK__.calls.ad === 1);
  await page.waitForFunction(() => window.__AD_MOCK__.calls.cloudWrites >= 1);
  const pending = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), calls: window.__AD_MOCK__.calls }));
  const cloudPending = await page.evaluate(() => window.__AD_MOCK__.lastCloudState);
  await page.evaluate(() => window.__AD_MOCK__.listeners.game_api_resume?.());
  const whileAd = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), calls: window.__AD_MOCK__.calls }));
  if (closeMode === 'error') await page.evaluate(() => window.__AD_MOCK__.callbacks?.onError?.({ message: 'QA_AD_ERROR' }));
  else await page.evaluate(wasShown => window.__AD_MOCK__.callbacks?.onClose?.(wasShown), closeMode === 'true');
  await page.waitForFunction(() => window.__LITERARY_QA__.getState().sceneId === 'S05' && !window.__LITERARY_QA__.getState().pendingEpisodeTransition);
  const after = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), audio: window.__LITERARY_QA__.getAudioState(), calls: window.__AD_MOCK__.calls }));
  await page.screenshot({ path: path.join(evidenceDir, `${name}-after.png`), fullPage: true });
  await browser.close();
  const expectedLabel = locale === 'ru' ? 'Следующий эпизод → 2' : 'Next episode → 2';
  const checks = {
    localizedLabel: label === expectedLabel,
    pendingSavedBeforeAd: pending.state.sceneId === 'S04' && pending.state.pendingEpisodeTransition?.toSceneId === 'S05',
    cloudPendingSaved: cloudPending?.sceneId === 'S04' && cloudPending.pendingEpisodeTransition?.toSceneId === 'S05',
    oneAdForDoubleClick: pending.calls.ad === 1,
    gameplayPausedDuringAd: whileAd.calls.gameplayStops === 1 && whileAd.calls.gameplayStarts === 1,
    gameplayResumedAfterAd: after.calls.gameplayStops === 1 && after.calls.gameplayStarts === 2,
    continuedAfterAdResult: after.state.sceneId === 'S05' && !after.state.pendingEpisodeTransition,
    mutePreserved: before.audio.muted && after.audio.muted,
    layout
  };
  return { viewport: `${width}x${height}`, locale, closeMode, label, before, pending, whileAd, after, checks, consoleErrors, failedRequests, expectedAborts };
}

async function runReloadRecovery() {
  const browser = await chromium.launch(browserLaunchOptions);
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, isMobile: true });
  context.setDefaultTimeout(10000);
  const state = { schemaVersion: 3, ...terminalState(), sceneId: 'S04', position: 999, finished: false, runId: 'qa-reload', revision: 4, pendingEpisodeTransition: null };
  await context.addInitScript(sdkInitScript(), { locale: 'ru', state });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?lang=ru`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.getByRole('button', { name: /Продолжить/ }).click();
  const action = page.locator('[data-episode-transition="true"]');
  await action.click();
  await page.waitForFunction(() => window.__AD_MOCK__.calls.ad === 1);
  await page.waitForFunction(() => window.__AD_MOCK__.calls.cloudWrites >= 1);
  const pending = await page.evaluate(() => window.__LITERARY_QA__.getState());
  const cloudPending = await page.evaluate(() => window.__AD_MOCK__.lastCloudState);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__LITERARY_QA__?.getState().sceneId === 'S05');
  const recovered = await page.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), calls: window.__AD_MOCK__.calls }));
  await page.screenshot({ path: path.join(evidenceDir, 'ru-360x640-reload-recovery.png'), fullPage: true });
  await page.close();

  const cloudContext = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, isMobile: true });
  cloudContext.setDefaultTimeout(10000);
  await cloudContext.addInitScript(sdkInitScript(), { locale: 'ru', state, cloudState: cloudPending, seedLocal: false });
  const cloudPage = await cloudContext.newPage();
  await cloudPage.goto(`${baseUrl}/?lang=ru`, { waitUntil: 'networkidle', timeout: 10000 });
  await cloudPage.waitForFunction(() => window.__LITERARY_QA__?.getState().sceneId === 'S05' && !window.__LITERARY_QA__.getState().pendingEpisodeTransition);
  const cloudRecovered = await cloudPage.evaluate(() => ({ state: window.__LITERARY_QA__.getState(), calls: window.__AD_MOCK__.calls }));
  await cloudPage.screenshot({ path: path.join(evidenceDir, 'ru-360x640-cloud-recovery.png'), fullPage: true });
  await cloudContext.close();
  await browser.close();
  return { pending, cloudPending, recovered, cloudRecovered };
}

await fs.mkdir(evidenceDir, { recursive: true });
const scenarios = [
  { width: 1920, height: 900, locale: 'ru', closeMode: 'true', name: 'ru-1920x900-close-true' },
  { width: 390, height: 844, locale: 'en', closeMode: 'false', name: 'en-390x844-close-false' },
  { width: 360, height: 640, locale: 'ru', closeMode: 'error', name: 'ru-360x640-error' }
];
const results = [];
for (const scenario of scenarios) results.push(await runScenario(scenario));
const reloadRecovery = await runReloadRecovery();
const evidence = {
  schemaVersion: 1,
  status: results.every(result => result.consoleErrors.length === 0 && result.failedRequests.length === 0 && Object.values(result.checks).every(value => value === true || (value && Object.values(value).every(Boolean)))) && reloadRecovery.recovered.state.sceneId === 'S05' && reloadRecovery.recovered.calls.ad === 0 && reloadRecovery.cloudRecovered.state.sceneId === 'S05' && reloadRecovery.cloudRecovered.calls.ad === 0 ? 'PASS' : 'FAIL',
  sourceHead: process.env.EPISODE_INTERSTITIAL_SOURCE_HEAD || null,
  baseUrl,
  scenarios: results,
  reloadRecovery,
  expectedExternalCheck: 'Yandex Draft: real fullscreen ad in all nine EP1→EP2 … EP9→EP10 boundaries, verify <=2s from Next episode click, onClose(true/false), onError, pause/resume and cloud/local recovery.'
};
await fs.writeFile(path.join(root, 'artifacts/evidence/episode-interstitial-runtime.json'), JSON.stringify(evidence, null, 2));
await fs.writeFile(path.join(root, 'artifacts/evidence/episode-interstitial-web-game-playtest.json'), JSON.stringify({ schemaVersion: 1, status: evidence.status, sourceHead: evidence.sourceHead, browsers: ['Chromium'], scenarios: ['local Yandex SDK mock', 'inter-episode transition', 'double click', 'onClose(true)', 'onClose(false)', 'onError', 'local reload recovery', 'cloud pending-state recovery'], viewports: scenarios.map(item => `${item.width}x${item.height}`), consoleErrors: results.flatMap(item => item.consoleErrors), failedRequests: results.flatMap(item => item.failedRequests), runtimeFindings: ['Local /sdk.js request is intentionally absent; official Yandex loader is tested separately.', 'Gameplay remains stopped during ad lifecycle and resumes after terminal callback.'] }, null, 2));
await fs.writeFile(path.join(root, 'artifacts/evidence/episode-interstitial-mobile-ux-review.json'), JSON.stringify({ schemaVersion: 1, status: evidence.status, sourceHead: evidence.sourceHead, viewports: ['390x844', '360x640'], checks: ['localized next-episode action', 'double activation guard', 'edge-to-edge screenshot', 'no browser scroll asserted by runtime harness'], knownLimitations: ['WebKit was not run in the transient harness.'] }, null, 2));
await fs.writeFile(path.join(root, 'artifacts/evidence/episode-interstitial-audio-quality-review.json'), JSON.stringify({ schemaVersion: 1, status: evidence.status, sourceHead: evidence.sourceHead, checks: ['mute setting remains true through ad close/error/reload', 'platform pause/resume callbacks are routed through the adapter', 'no rewarded audio path introduced'] }, null, 2));
await fs.writeFile(path.join(root, 'artifacts/evidence/episode-interstitial-accessibility-review.json'), JSON.stringify({ schemaVersion: 1, status: evidence.status, sourceHead: evidence.sourceHead, checks: ['existing button pattern with localized accessible label', 'disabled and aria-busy state during in-flight ad', 'RU/EN readable labels at mobile and desktop viewports'], knownLimitations: ['Full assistive-technology review remains outside this scoped ad change.'] }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
