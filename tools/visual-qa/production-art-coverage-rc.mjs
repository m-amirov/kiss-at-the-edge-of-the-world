#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { visualCues, visualScenes } from '../../src/literary-visual-directions.js';

const root = process.cwd();
const output = path.resolve(root, process.env.PRODUCTION_ART_COVERAGE_OUTPUT ?? 'artifacts/evidence/production-art-coverage-rc-2026-10-09');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4182/literary.html?qa=production-art-coverage-rc&lang=ru';
const viewports = [
  { name: 'desktop', width: 1920, height: 900 },
  { name: 'portrait390', width: 390, height: 844 },
  { name: 'portrait360', width: 360, height: 640 },
];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashFile = async file => sha256(await fs.readFile(file));
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const manifest = JSON.parse(await fs.readFile(path.join(root, 'assets/asset-manifest.json'), 'utf8'));
const manifestEntries = [...(manifest.assets ?? []), ...(manifest.previewAssets ?? [])];
const manifestByRuntime = new Map(manifestEntries.flatMap(entry => [
  [entry.runtimePath, entry],
  [entry.runtimePortraitAsset, entry],
].filter(([key]) => key)));
const manifestByPath = new Map(manifestEntries.map(entry => [entry.path, entry]));
const manifestByBasename = new Map(manifestEntries.flatMap(entry => [
  [entry.path, entry],
  [entry.portraitAsset, entry],
  [entry.runtimePath, entry],
  [entry.runtimePortraitAsset, entry],
].filter(([key]) => key).map(([key, value]) => [path.basename(key), value])));

function choicesFor(scene) {
  const choices = Object.fromEntries(literarySeason.scenes
    .flatMap(item => item.chunks.map(chunk => chunk.title.match(/(?:Выбор|Отклик)\s+(S\d{2}-C\d+)/u)?.[1]))
    .filter(Boolean)
    .map(id => [id, 'A']));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const flow = compileInteractivePlayback(scene, choices);
    const pending = flow.find(entry => entry.type === 'choice' && choices[entry.id] == null);
    if (!pending) return choices;
    choices[pending.id] = pending.options[0]?.code;
  }
  throw new Error(`Unable to resolve choices for ${scene.id}`);
}

function positionFor(scene, cue, choices) {
  const flow = compileInteractivePlayback(scene, choices);
  if (!cue) return 0;
  const index = flow.findIndex(entry => [entry.sourceStartRef, entry.sourceEndRef]
    .some(ref => ref?.chunk === cue.at[0] && ref?.paragraph === cue.at[1]));
  if (index < 0 && cue.at[0] === 0 && cue.at[1] === 0) return 0;
  if (index < 0) throw new Error(`Missing runtime position for ${scene.id}/${cue.id} at ${cue.at.join(':')}`);
  return index;
}

function expectedArt(sceneId, cue, choices) {
  const scene = visualScenes[sceneId];
  const state = cue
    ? (cue.art == null ? { file: scene?.[2] ?? null, type: 'background' } : { file: cue.art.replace(/^cg\//, ''), runtimePath: `assets/${cue.art}`, type: cue.art.startsWith('cg/') ? 'cg' : 'background' })
    : { file: scene?.[2] ?? null, runtimePath: scene?.[2] ? `assets/${scene[2]}` : null, type: 'background' };
  if (!state.runtimePath && state.file) state.runtimePath = `assets/${state.file}`;
  return state;
}

const allTargets = literarySeason.scenes.map(scene => {
  const cues = visualCues[scene.id] ?? [];
  const cue = cues[0] ?? null;
  const choices = choicesFor(scene);
  return {
    sceneId: scene.id,
    title: scene.title,
    cue: cue?.id ?? 'scene-start',
    source: cue ? { chunk: cue.at[0], paragraph: cue.at[1] } : { type: 'scene-start' },
    authoredCues: cues.map(item => ({ id: item.id, at: item.at, art: item.art ?? null, cast: item.cast ?? null, presentation: item.presentation ?? null })),
    expected: expectedArt(scene.id, cue, choices),
    position: positionFor(scene, cue, choices),
    choices,
  };
});
const targetFilter = process.env.PRODUCTION_ART_COVERAGE_SCENES?.split(',').map(item => item.trim()).filter(Boolean);
const targets = targetFilter?.length ? allTargets.filter(target => targetFilter.includes(target.sceneId)) : allTargets;

await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];
try {
  for (const target of targets) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.name !== 'desktop', isMobile: viewport.name !== 'desktop' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    const failed = [];
    const ignoredFailedRequests = [];
    let audioReady = false;
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
    page.on('requestfailed', request => {
      if (/\/sdk\.js(?:$|\?)/u.test(request.url())) return;
      const errorText = request.failure()?.errorText ?? 'failed';
      if (audioReady && /\/assets\/audio\/music\//u.test(request.url()) && errorText === 'net::ERR_ABORTED') {
        ignoredFailedRequests.push({ url: request.url(), errorText, reason: 'post-ready browser teardown abort' });
        return;
      }
      failed.push({ url: request.url(), errorText });
    });
    await page.route('**/sdk.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.YaGames = undefined;' }));
    await page.addInitScript(() => {
      const NativeAudio = window.Audio;
      window.__PRODUCTION_ART_QA__ = { audio: null };
      window.Audio = function ProductionArtQaAudio(...args) {
        const audio = new NativeAudio(...args);
        window.__PRODUCTION_ART_QA__.audio = audio;
        return audio;
      };
    });
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: literarySaveKey,
      value: { schemaVersion: 3, sceneId: target.sceneId, position: target.position, choices: target.choices, finished: false, visited: ['S01', target.sceneId], runId: `production-art-coverage-${target.sceneId}-${viewport.width}`, revision: 0 },
    });
    const screenshot = path.join(output, `${target.sceneId}-${target.cue}-${viewport.width}x${viewport.height}.png`);
    let readback = null;
    let runError = null;
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
      const continueButton = page.getByRole('button', { name: /Продолжить|Continue|New Game|Новая игра/ }).first();
      if (await continueButton.count()) await continueButton.click();
      await page.locator('.reader-sheet').waitFor();
      await page.waitForFunction(() => {
        const audio = window.__PRODUCTION_ART_QA__?.audio;
        return !audio || (audio.readyState > 0 && Number.isFinite(audio.duration) && audio.duration > 0);
      }, null, { timeout: 5000 });
      audioReady = true;
      await page.waitForTimeout(120);
      readback = await page.evaluate(() => {
        const image = document.querySelector('.literary-picture img');
        const picture = document.querySelector('.literary-picture');
        const content = document.querySelector('.reader-content');
        const state = window.__LITERARY_QA__?.getState?.();
        const flow = window.__LITERARY_QA__?.getFlow?.() ?? [];
        const entry = state ? flow[state.position] : null;
        const rect = image?.getBoundingClientRect();
        return {
          sceneId: state?.sceneId ?? null,
          position: state?.position ?? null,
          sourceRef: entry?.sourceStartRef ?? null,
          cue: picture?.dataset.visualBeat ?? null,
          asset: image?.dataset.asset ?? null,
          desktopAsset: image?.dataset.desktopAsset ?? null,
          natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
          stageCount: document.querySelectorAll('.stage-character').length,
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
          imageRect: rect && { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          viewport: [innerWidth, innerHeight],
        };
      });
      await page.screenshot({ path: screenshot, fullPage: false });
    } catch (error) {
      runError = String(error?.stack ?? error);
    }
      const screenshotBytes = runError ? null : await fs.readFile(screenshot);
      const expectedRuntime = target.expected.runtimePath ?? null;
      const runtimeAsset = readback?.asset ? `assets/${readback.asset}` : null;
      const mapping = expectedRuntime ? manifestByRuntime.get(expectedRuntime) ?? manifestByPath.get(expectedRuntime) ?? manifestByBasename.get(path.basename(expectedRuntime)) ?? null : null;
      const audioEvidence = await page.evaluate(() => {
        const audio = window.__PRODUCTION_ART_QA__?.audio;
        return { cueId: window.__LITERARY_QA__?.getAudioState?.().cueId ?? null, readyState: audio?.readyState ?? 0, duration: Number.isFinite(audio?.duration) ? audio.duration : null };
      }).catch(() => ({ cueId: null, readyState: 0, duration: null }));
      const intentionalMenuCueAborts = failed.filter(item => item.errorText === 'net::ERR_ABORTED' && /\/assets\/audio\/music\/main-theme\.ogg$/u.test(item.url) && audioReady && audioEvidence.cueId !== 'main-theme' && audioEvidence.readyState > 0);
      if (intentionalMenuCueAborts.length) {
        ignoredFailedRequests.push(...intentionalMenuCueAborts.map(item => ({ ...item, reason: 'abandoned menu cue during intentional reader cue switch' })));
        for (const item of intentionalMenuCueAborts) failed.splice(failed.indexOf(item), 1);
      }
      const physical = mapping ? [mapping.path, mapping.portraitAsset, mapping.runtimePath, mapping.runtimePortraitAsset].filter(Boolean) : [];
    const physicalFiles = [];
    for (const item of physical) {
      const file = path.join(root, item);
      physicalFiles.push({ path: item, exists: await fs.stat(file).then(() => true).catch(() => false), sha256: await fs.stat(file).then(() => hashFile(file)).catch(() => null) });
    }
    captures.push({
      sceneId: target.sceneId,
      title: target.title,
      cue: target.cue,
      source: target.source,
      expected: { ...target.expected, runtime: expectedRuntime },
      authoredCues: target.authoredCues,
      viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
      currentHead: sourceHead,
      screenshot: rel(screenshot),
      screenshotSha256: screenshotBytes ? sha256(screenshotBytes) : null,
      screenshotBytes: screenshotBytes?.length ?? 0,
      readback: readback ? { ...readback, runtimeAsset, expectedRuntime, assetMatches: runtimeAsset ? [mapping?.runtimePath, mapping?.runtimePortraitAsset].filter(Boolean).some(item => path.basename(item) === path.basename(runtimeAsset)) : false } : null,
      manifest: mapping ? { id: mapping.id, path: mapping.path, runtimePath: mapping.runtimePath ?? null, runtimePortraitAsset: mapping.runtimePortraitAsset ?? null, dimensions: mapping.dimensions ?? null } : null,
      physicalFiles,
      audioEvidence,
      errors,
      failed,
      ignoredFailedRequests,
      runError,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const sceneIds = [...new Set(captures.map(item => item.sceneId))];
const failures = captures.filter(item => item.runError || item.errors.length || item.failed.length || !item.readback || item.readback.sceneId !== item.sceneId || !item.readback.assetMatches || item.readback.overflow || item.readback.internalScroll || !item.manifest || item.physicalFiles.some(file => !file.exists));
const evidence = {
  schemaVersion: 1,
  recordType: 'production-art-coverage-matrix',
  status: failures.length === 0 && sceneIds.length === literarySeason.scenes.length ? 'PASS' : 'BLOCKED',
  visualAcceptance: 'PENDING_WEB_HIGH',
  generatedAt: new Date().toISOString(),
  sourceHead,
  baseUrl,
  scope: { expectedScenes: literarySeason.scenes.length, coveredScenes: sceneIds.length, expectedCaptures: targets.length * viewports.length, captures: captures.length, viewports: viewports.map(item => `${item.width}x${item.height}`) },
  failures: failures.map(item => ({ sceneId: item.sceneId, cue: item.cue, viewport: item.viewport, error: item.runError, errors: item.errors, failed: item.failed, readback: item.readback, expected: item.expected, manifest: item.manifest, physicalFiles: item.physicalFiles })),
  scenes: targets.map(target => ({ sceneId: target.sceneId, title: target.title, cue: target.cue, source: target.source, authoredCues: target.authoredCues, expected: target.expected, captures: captures.filter(item => item.sceneId === target.sceneId) })),
};
await fs.writeFile(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: evidence.status, sourceHead, scenes: sceneIds.length, captures: captures.length, failures: failures.length, output: rel(path.join(output, 'evidence.json')) }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 2;
