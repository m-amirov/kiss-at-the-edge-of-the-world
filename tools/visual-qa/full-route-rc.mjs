#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const output = process.env.LITERARY_QA_OUTPUT ?? 'output/playwright/full-route-rc-2026-09-30-fixed';
const evidencePath = process.env.LITERARY_QA_EVIDENCE ?? 'artifacts/evidence/full-route-runtime-qa-2026-09-30.json';
const routes = { eric: { code: 'A', ending: 'S44' }, nick: { code: 'B', ending: 'S45' }, damir: { code: 'C', ending: 'S46' }, alice: { code: 'D', ending: 'S47' } };
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const actionTimeoutMs = Number(process.env.LITERARY_QA_ACTION_TIMEOUT_MS ?? 5000);
try {
  for (const [route, contract] of Object.entries(routes)) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(actionTimeoutMs);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = []; const failed = []; const ignoredExternal = []; const checkpoints = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('requestfailed', (request) => /\/sdk\.js(?:$|\?)/u.test(request.url()) ? ignoredExternal.push(request.url()) : failed.push(request.url()));
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: literarySaveKey,
      value: { schemaVersion: 3, sceneId: 'S01', position: 0, choices: {}, finished: false, visited: ['S01'], runId: `rc-${route}-${viewport.width}-${Date.now()}`, revision: 0 }
    });
    let steps = 0; let terminal = null; let lastState = null; let lastScene = null; let runError = null;
    try {
      console.log(`[route=${route} viewport=${viewport.width}x${viewport.height} scene=BOOT]`);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: actionTimeoutMs });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
      await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click({ timeout: actionTimeoutMs });
      while (steps < 1600) {
      const state = await page.evaluate((routeCode) => {
        const qa = window.__LITERARY_QA__;
        const saved = qa.getState(); const screen = qa.getScreen(); const flow = qa.getFlow(); const current = flow[screen.position];
        const result = { sceneId: saved.sceneId, position: saved.position, type: current?.type, id: current?.id };
        if (current?.type === 'page') {
          const stage = document.querySelector('[data-stage-advance]');
          if (!stage) throw new Error(`Missing stage control at ${saved.sceneId}:${saved.position}`);
          stage.click();
        }
        else if (current?.type === 'choice') {
          const code = current.id === 'S17-C2' || current.id === 'S26-C1' ? routeCode : current.options[0]?.code;
          const index = current.options.findIndex((option) => option.code === code);
          if (index < 0) throw new Error(`Missing choice code ${code} in ${current.id}`);
          result.code = code;
          document.querySelectorAll('.choice-button')[index].click();
        } else {
          const next = document.querySelector('.reader-sheet > button.primary');
          if (next) next.click();
          else { result.terminal = true; result.finished = saved.finished; result.visited = saved.visited.length; result.choiceCount = Object.keys(saved.choices).length; }
        }
        return result;
      }, contract.code);
      lastState = state;
      if (state.sceneId !== lastScene) {
        lastScene = state.sceneId;
        console.log(`[route=${route} viewport=${viewport.width}x${viewport.height} scene=${lastScene} step=${steps}]`);
      }
      if (['S17', 'S26'].includes(state.sceneId) && !checkpoints.includes(state.sceneId)) {
        checkpoints.push(state.sceneId);
        await page.screenshot({ path: `${output}/${route}-${viewport.width}x${viewport.height}-${state.sceneId}.png` });
      }
      if (state.terminal) {
        terminal = state;
        await page.screenshot({ path: `${output}/${route}-${viewport.width}x${viewport.height}-${state.sceneId}-ending.png` });
        break;
      }
      steps += 1;
      }
      if (!terminal) throw new Error(`Step limit reached at ${JSON.stringify(lastState)}`);
    } catch (error) {
      runError = String(error?.stack ?? error);
      console.error(`[route=${route} viewport=${viewport.width}x${viewport.height} failed lastState=${JSON.stringify(lastState)}] ${runError}`);
    }
    results.push({ route, viewport, ending: terminal?.sceneId ?? null, expectedEnding: contract.ending, finished: terminal?.finished ?? false, visited: terminal?.visited ?? 0, choiceCount: terminal?.choiceCount ?? 0, steps, routeChoice: true, softLocks: runError ? 1 : 0, runError, lastState, errors, failed, ignoredExternal, checkpoints });
    await context.close();
  }
} finally { await browser.close(); }
const status = results.length === 8 && results.every((item) => item.ending === item.expectedEnding && item.finished && item.softLocks === 0 && item.errors.length === 0 && item.failed.length === 0) ? 'PASS' : 'BLOCK';
const evidence = { schemaVersion: 1, status, generatedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baseUrl, requirements: ['4/4 endings', 'desktop and mobile', 'console errors 0', 'game-owned failed requests 0', 'soft-lock 0'], externalExpected: ['/sdk.js is the official Yandex Games SDK and is not vendored locally'], results };
await fs.mkdir(path.dirname(evidencePath), { recursive: true });
await fs.writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status, results }, null, 2));
