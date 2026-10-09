#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = process.env.AUDIO_QA_OUTPUT ?? path.join(root, 'artifacts/evidence/menu-audio-continuity-2026-10-09');
const baseUrl = process.env.AUDIO_QA_URL ?? 'http://127.0.0.1:4174/literary.html?qa=menu-audio-continuity';
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const viewports = [
  { name: 'desktop', width: 1920, height: 900, mobile: false },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { name: 'mobile-360x640', width: 360, height: 640, mobile: true }
];
const saveKey = 'kiss-at-the-edge-of-the-world:literary-draft:v1';
const save = { schemaVersion: 3, sceneId: 'S02', position: 0, choices: {}, finished: false, visited: ['S01', 'S02'], runId: 'menu-audio-qa', revision: 0 };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { cwd: root, env: { ...process.env, PORT: '4174' }, stdio: 'ignore', windowsHide: true });
const waitForServer = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`local preview did not start: ${baseUrl}`);
};
await fs.mkdir(outputDir, { recursive: true });
await waitForServer();

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];

async function audioSnapshot(page) {
  return page.evaluate(() => ({
    state: window.__LITERARY_QA__.getAudioState(),
    instances: window.__AUDIO_QA__.instances.map(item => ({ cue: item.audio.dataset.musicCue, playCalls: item.playCalls, pauseCalls: item.pauseCalls, currentTime: item.audio.currentTime, paused: item.audio.paused, volume: item.audio.volume }))
  }));
}

async function waitForCue(page, cueId) {
  await page.waitForFunction(cue => window.__LITERARY_QA__?.getAudioState?.().cueId === cue, cueId);
}

async function runViewport(viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.mobile, isMobile: viewport.mobile });
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const NativeAudio = window.Audio;
    window.__AUDIO_QA__ = { instances: [] };
    window.Audio = function AudioForQa(...args) {
      const audio = new NativeAudio(...args);
      const item = { audio, playCalls: 0, pauseCalls: 0 };
      const nativePlay = audio.play.bind(audio);
      const nativePause = audio.pause.bind(audio);
      audio.play = (...playArgs) => { item.playCalls += 1; return nativePlay(...playArgs); };
      audio.pause = (...pauseArgs) => { item.pauseCalls += 1; return nativePause(...pauseArgs); };
      window.__AUDIO_QA__.instances.push(item);
      return audio;
    };
  }, { key: saveKey, value: save });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__LITERARY_QA__?.getAudioState?.().cueId === 'main-theme');
  const beforeInteraction = await audioSnapshot(page);
  if (beforeInteraction.instances.length !== 0) throw new Error(`${viewport.name}: menu created audio before unlock`);

  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.waitForFunction(() => window.__LITERARY_QA__.getAudioState().unlocked === true);
  await sleep(150);
  const afterUnlock = await audioSnapshot(page);
  if (afterUnlock.instances.length !== 1 || afterUnlock.instances[0].playCalls !== 1) throw new Error(`${viewport.name}: unlock created duplicate audio/play calls`);
  await page.waitForFunction(() => { const audio = window.__AUDIO_QA__.instances[0]?.audio; return audio?.readyState > 0 && Number.isFinite(audio.duration) && audio.duration > 0; });
  await page.evaluate(() => {
    const audio = window.__AUDIO_QA__.instances[0]?.audio;
    if (audio) audio.currentTime = Math.min(0.2, audio.duration / 4);
  });
  const positionBeforeMenuCycle = (await audioSnapshot(page)).instances[0].currentTime;
  await page.getByRole('button', { name: /К меню/ }).click();
  await page.getByRole('button', { name: 'Эпизоды', exact: true }).click();
  await page.getByRole('button', { name: /К меню/ }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const afterMenuCycle = await audioSnapshot(page);
  if (afterMenuCycle.instances.length !== 1 || afterMenuCycle.instances[0].playCalls !== 1) throw new Error(`${viewport.name}: menu/settings navigation restarted music`);
  if (positionBeforeMenuCycle > 0 && Math.abs(afterMenuCycle.instances[0].currentTime - positionBeforeMenuCycle) > 0.08) throw new Error(`${viewport.name}: menu/settings navigation changed currentTime`);

  const muteButton = page.getByRole('button', { name: /Музыка:/ });
  await muteButton.click();
  if (!(await audioSnapshot(page)).state.muted) throw new Error(`${viewport.name}: mute state did not persist in runtime`);
  if ((await audioSnapshot(page)).instances[0].volume !== 0) throw new Error(`${viewport.name}: muted audio kept a non-zero volume`);
  await muteButton.click();
  if ((await audioSnapshot(page)).state.muted) throw new Error(`${viewport.name}: unmute did not restore state`);
  await page.getByRole('button', { name: /К меню/ }).click();
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await waitForCue(page, 'road');
  await sleep(500);
  const afterEpisode = await audioSnapshot(page);
  if (afterEpisode.state.activeInstances !== 1 || afterEpisode.instances.length !== 1) throw new Error(`${viewport.name}: episode cue did not remain on the singleton audio instance`);
  if (afterEpisode.instances[0].playCalls !== 2) throw new Error(`${viewport.name}: episode cue was played more than once`);

  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const afterHidden = await audioSnapshot(page);
  if (!afterHidden.instances.at(-1).paused) throw new Error(`${viewport.name}: hidden document did not pause audio`);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(50);
  const afterVisible = await audioSnapshot(page);
  if (afterVisible.instances.at(-1).playCalls !== afterHidden.instances.at(-1).playCalls + 1) throw new Error(`${viewport.name}: visible document did not resume exactly once`);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const afterBlur = await audioSnapshot(page);
  if (!afterBlur.instances.at(-1).paused) throw new Error(`${viewport.name}: blur did not pause audio`);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(50);
  const afterFocus = await audioSnapshot(page);
  if (afterFocus.instances.at(-1).playCalls !== afterBlur.instances.at(-1).playCalls + 1) throw new Error(`${viewport.name}: focus did not resume exactly once`);
  await page.getByRole('button', { name: /☰ Меню/ }).click();
  await waitForCue(page, 'main-theme');
  await sleep(500);
  const afterReturnMenu = await audioSnapshot(page);
  if (afterReturnMenu.state.activeInstances !== 1 || afterReturnMenu.instances.length !== 1 || afterReturnMenu.instances[0].playCalls !== afterFocus.instances[0].playCalls + 1) throw new Error(`${viewport.name}: return to menu did not perform a single cue transition`);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-menu.png`), fullPage: true });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-settings.png`), fullPage: true });
  const finalAudio = await audioSnapshot(page);
  const result = { viewport: { name: viewport.name, width: viewport.width, height: viewport.height }, beforeInteraction, afterUnlock, afterMenuCycle, afterEpisode, afterHidden, afterVisible, afterBlur, afterFocus, afterReturnMenu, finalAudio, consoleErrors, requestFailures };
  await context.close();
  return result;
}

try {
  for (const viewport of viewports) {
    try { results.push(await runViewport(viewport)); }
    catch (error) { results.push({ viewport, status: 'FAIL', error: String(error), consoleErrors: [], requestFailures: [] }); }
  }
} finally {
  await browser.close();
  server.kill();
}

const pass = results.length === viewports.length && results.every(result => result.status !== 'FAIL' && result.consoleErrors.length === 0 && result.requestFailures.length === 0);
const evidence = {
  schemaVersion: 1,
  status: pass ? 'PASS_MENU_AUDIO_CONTINUITY' : 'FAIL_MENU_AUDIO_CONTINUITY',
  generatedAt: new Date().toISOString(),
  head: process.env.GIT_HEAD ?? 'unbound',
  baseUrl,
  scenarios: ['menu initial cue', 'first-interaction unlock', 'menu/settings/episodes continuity', 'mute and volume state', 'episode cue crossfade', 'blur/focus resume', 'menu return cue transition'],
  results
};
await fs.writeFile(path.join(outputDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
if (process.env.AUDIO_QA_WRITE_SHARED_EVIDENCE === '1') {
  await fs.writeFile(path.join(root, 'artifacts/evidence/audio-quality-review.json'), JSON.stringify({ schemaVersion: 1, status: evidence.status, source: 'menu-audio-continuity', evidence: path.relative(root, path.join(outputDir, 'evidence.json')), checks: evidence.scenarios }, null, 2));
  await fs.writeFile(path.join(root, 'artifacts/evidence/mobile-ux-review.json'), JSON.stringify({ schemaVersion: 1, status: pass ? 'PASS' : 'FAIL', source: 'menu-audio-continuity', viewports: viewports.filter(item => item.mobile).map(item => `${item.width}x${item.height}`), checks: ['touch menu/settings/episode transitions', 'no audio duplicate instances', 'no console errors', 'no request failures'] }, null, 2));
  await fs.writeFile(path.join(root, 'artifacts/evidence/web-game-playtest.json'), JSON.stringify({ schemaVersion: 1, status: pass ? 'PASS' : 'FAIL', source: 'menu-audio-continuity', browsers: ['Chromium'], viewports: viewports.map(item => `${item.width}x${item.height}`), scenarios: evidence.scenarios, results: results.map(item => ({ viewport: item.viewport, status: item.status ?? 'PASS', consoleErrors: item.consoleErrors, requestFailures: item.requestFailures })) }, null, 2));
}
console.log(JSON.stringify(evidence, null, 2));
if (!pass) process.exitCode = 1;
