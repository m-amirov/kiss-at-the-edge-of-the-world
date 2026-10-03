#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey, nextLiteraryScene } from '../../src/literary-engine.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html';
const output = process.env.LITERARY_QA_OUTPUT ?? path.join(root, 'artifacts/evidence/ep07-08-route-runtime');
const evidencePath = process.env.LITERARY_QA_EVIDENCE ?? path.join(root, 'artifacts/evidence/ep07-08-route-browser.json');
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const routes = {
  eric: { code: 'A', final: 'S50', scenes: ['S27', 'S59', 'S28', 'S49', 'S32', 'S50'] },
  nick: { code: 'B', final: 'S53', scenes: ['S27', 'S59', 'S29', 'S52', 'S33', 'S53'] },
  damir: { code: 'C', final: 'S56', scenes: ['S27', 'S59', 'S30', 'S55', 'S34', 'S56'] },
  alice: { code: 'D', final: 'S63', scenes: ['S27', 'S59', 'S31', 'S62', 'S35', 'S63'] }
};
const cyrillic = /[А-Яа-яЁё]/u;

function allAuthoredChoices(routeCode) {
  const choices = {};
  for (const scene of literarySeason.scenes) {
    for (const item of scene.items ?? []) {
      if (item.type === 'choice' && item.id) choices[item.id] = item.options?.[0]?.code ?? 'A';
    }
  }
  choices['S17-C2'] = 'A';
  choices['S26-C1'] = routeCode;
  choices['S26-C90'] = 'A';
  for (const sceneId of ['S27', 'S59', 'S28', 'S49', 'S29', 'S52', 'S30', 'S55', 'S31', 'S62', 'S32', 'S50', 'S33', 'S53', 'S34', 'S56', 'S35', 'S63']) choices[`${sceneId}-C90`] = 'A';
  return choices;
}

function flowPosition(sceneId, choices, predicate) {
  const scene = literarySeason.scenes.find((item) => item.id === sceneId);
  const flow = compileInteractivePlayback(scene, choices, 'en');
  const index = flow.findIndex(predicate);
  if (index < 0) throw new Error(`No playable position for ${sceneId}`);
  return index;
}

function saveState(sceneId, position, choices, visited) {
  return { schemaVersion: 3, sceneId, position, choices, finished: false, visited: [...new Set(visited)], runId: `ep07-08-${sceneId}-${Date.now()}`, revision: 0 };
}

function routeAtScene(sceneId, choices) {
  if (sceneId === 'S26') return 'route selection';
  return { A: 'eric', B: 'nick', C: 'damir', D: 'alice' }[choices['S26-C1']] ?? null;
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const [route, contract] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const choices = allAuthoredChoices(contract.code);
        const s26Choices = { ...choices };
        delete s26Choices['S26-C1'];
        const s26Flow = compileInteractivePlayback(literarySeason.scenes.find((scene) => scene.id === 'S26'), s26Choices, 'en');
        const s26Position = s26Flow.findIndex((entry) => entry.type === 'choice' && entry.id === 'S26-C1');
        if (s26Position < 0) throw new Error('S26-C1 route lock is not playable');
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors = [];
        const failed = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        page.on('requestfailed', (request) => failed.push(request.url()));
        const state = saveState('S26', s26Position, s26Choices, ['S01', 'S26']);
        await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); }, { key: literarySaveKey, value: state });
        const url = (locale) => `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}qa=ep07-08-route&lang=${locale}`;
        const boot = async (locale = 'en') => {
          await page.goto(url(locale), { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: /Continue|Продолжить|New Game|Новая игра/ }).first().click();
          await page.locator('.reader-sheet').waitFor();
        };
        const read = async () => page.evaluate(() => {
          const qa = window.__LITERARY_QA__;
          const saved = qa.getState();
          const screen = qa.getScreen();
          const flow = qa.getFlow();
          const current = flow[screen.position];
          const visible = document.querySelector('#literary-app')?.innerText ?? '';
          const buttons = [...document.querySelectorAll('button')].filter((button) => button.offsetParent !== null);
          const sheet = document.querySelector('.reader-sheet');
          return {
            saved,
            current: current ? { type: current.type, id: current.id ?? null, sourceStartRef: current.sourceStartRef ?? null, sourceEndRef: current.sourceEndRef ?? null, text: current.text ?? '', question: current.question ?? null, options: current.options ?? null, decisionResult: current.decisionResult ?? null, echoOf: current.echoOf ?? null } : null,
            header: document.querySelector('.chapter-index')?.textContent ?? '',
            visibleText: visible,
            cyrillicCount: (visible.match(/[А-Яа-яЁё]/gu) ?? []).length,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.documentElement.scrollHeight > document.documentElement.clientHeight,
            internalScroll: Boolean(document.querySelector('.reader-content') && document.querySelector('.reader-content').scrollHeight > document.querySelector('.reader-content').clientHeight + 1),
            controlsWithinViewport: buttons.every((button) => { const rect = button.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= window.innerHeight; }),
            visibleButtons: buttons.map((button) => ({ text: button.textContent?.trim() ?? '', disabled: button.disabled })),
            viewport: [window.innerWidth, window.innerHeight]
          };
        });
        const captures = [];
        const saveChecks = [];
        const interactionCases = [];
        let localeSwitch = null;
        let steps = 0;
        let previousScene = null;
        let seenS27ForLocale = false;
        await boot('en');
        while (steps < 650) {
          const before = await read();
          const sceneId = before.saved.sceneId;
          if (sceneId !== previousScene) {
            previousScene = sceneId;
            captures.push({ phase: 'scene-entry', sceneId, route, viewport, header: before.header, cyrillicCount: before.cyrillicCount, overflow: before.overflow, internalScroll: before.internalScroll, controlsWithinViewport: before.controlsWithinViewport, screenshot: null });
            if (contract.scenes.includes(sceneId) && ['S27', 'S59', 'S28', 'S49', 'S29', 'S52', 'S30', 'S55', 'S31', 'S62', 'S32', 'S50', 'S33', 'S53', 'S34', 'S56', 'S35', 'S63'].includes(sceneId)) {
              const screenshot = path.join(output, `${route}-${viewport.width}x${viewport.height}-${sceneId}.png`);
              await page.screenshot({ path: screenshot });
              const bytes = await fs.readFile(screenshot);
              captures.at(-1).screenshot = { path: screenshot, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
            }
            if (sceneId === 'S27' && !seenS27ForLocale) {
              const beforeLocale = before.saved;
              await page.goto(url('ru'), { waitUntil: 'networkidle' });
              await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: beforeLocale });
              await page.reload({ waitUntil: 'networkidle' });
              await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click();
              const ru = await read();
              await page.goto(url('en'), { waitUntil: 'networkidle' });
              await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: ru.saved });
              await page.reload({ waitUntil: 'networkidle' });
              await page.getByRole('button', { name: /Continue|New Game/ }).first().click();
              const en = await read();
              await page.goto(url('ru'), { waitUntil: 'networkidle' });
              await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: en.saved });
              await page.reload({ waitUntil: 'networkidle' });
              await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click();
              const ruAgain = await read();
              await page.goto(url('en'), { waitUntil: 'networkidle' });
              await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: ruAgain.saved });
              await page.reload({ waitUntil: 'networkidle' });
              await page.getByRole('button', { name: /Continue|New Game/ }).first().click();
              localeSwitch = { beforeScene: beforeLocale.sceneId, ruScene: ru.saved.sceneId, enScene: en.saved.sceneId, ruAgainScene: ruAgain.saved.sceneId, sameScene: [beforeLocale.sceneId, ru.saved.sceneId, en.saved.sceneId, ruAgain.saved.sceneId].every((item) => item === beforeLocale.sceneId), ruCyrillicCount: ru.cyrillicCount, enCyrillicCount: en.cyrillicCount, structuralSaveHasLocale: Object.hasOwn(ru.saved, 'locale') || Object.hasOwn(en.saved, 'locale') };
              previousScene = sceneId;
              seenS27ForLocale = true;
            }
          }
          if (before.current?.type === 'choice') {
            const selected = before.current.id.endsWith('-C1') && before.current.id === 'S26-C1' ? contract.code : 'A';
            const optionIndex = before.current.options.findIndex((option) => option.code === selected);
            if (optionIndex < 0) throw new Error(`Missing option ${selected} at ${before.current.id}`);
            if (before.current.id.endsWith('-C90')) {
              const afterState = { ...before.saved, position: before.saved.position + 1 };
              interactionCases.push({ sceneId, extraChoiceId: before.current.id, insertionSourceRef: before.current.sourceStartRef, precedingVisibleText: before.visibleText, renderedQuestion: before.current.question, renderedOptions: before.current.options, selectedOption: selected, routeBefore: routeAtScene(sceneId, before.saved.choices) });
              await page.locator('.choice-button').nth(optionIndex).click();
              const after = await read();
              interactionCases.at(-1).resultingText = after.current?.text ?? '';
              interactionCases.at(-1).followingSourceRef = after.current?.sourceStartRef ?? null;
              interactionCases.at(-1).routeAfter = routeAtScene(after.saved.sceneId, after.saved.choices);
              interactionCases.at(-1).routeStatePreserved = after.saved.choices['S26-C1'] === before.saved.choices['S26-C1'];
              void afterState;
            } else {
              await page.locator('.choice-button').nth(optionIndex).click();
              if (before.current.id === 'S26-C1') saveChecks.push({ checkpoint: 'after-S26-route-lock', state: (await read()).saved });
              if (before.current.id === 'S32-C1' || before.current.id === 'S33-C1' || before.current.id === 'S34-C1') saveChecks.push({ checkpoint: `after-${before.current.id}`, state: (await read()).saved });
            }
          } else if (before.current?.type === 'page') {
            if (sceneId === 'S27' && before.saved.position === 0) saveChecks.push({ checkpoint: 'first-Episode-7-scene', state: before.saved });
            await page.evaluate(() => {
              const control = document.querySelector('[data-stage-advance]');
              if (control) control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              else document.querySelector('.reader-sheet > button.primary')?.click();
            });
            const after = await read();
            if (after.current?.decisionResult?.endsWith('-C90')) saveChecks.push({ checkpoint: `after-${after.current.decisionResult}`, state: after.saved });
          } else {
            const next = page.locator('.reader-sheet > button.primary');
            if (await next.count()) await next.click();
            else break;
          }
          const after = await read();
          if (after.saved.sceneId === contract.final && after.saved.position === 0) {
            saveChecks.push({ checkpoint: 'Episode-8-representative-state', state: after.saved });
            const screenshot = path.join(output, `${route}-${viewport.width}x${viewport.height}-${contract.final}.png`);
            await page.screenshot({ path: screenshot });
            const bytes = await fs.readFile(screenshot);
            captures.push({ phase: 'scene-entry', sceneId: contract.final, route, viewport, header: after.header, cyrillicCount: after.cyrillicCount, overflow: after.overflow, internalScroll: after.internalScroll, controlsWithinViewport: after.controlsWithinViewport, screenshot: { path: screenshot, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length } });
            break;
          }
          if (after.saved.sceneId === 'S36') throw new Error(`Unexpected Episode 9 entry at route ${route}`);
          steps += 1;
        }
        const finalState = await read();
        const sceneSet = captures.filter((capture) => capture.phase === 'scene-entry').map((capture) => capture.sceneId);
        const expectedSceneSet = ['S26', ...contract.scenes];
        const routeStateMismatches = sceneSet.filter((sceneId) => !expectedSceneSet.includes(sceneId)).length;
        results.push({ sourceHead, route, viewport, sceneSet, expectedSceneSet: contract.scenes, finalScene: finalState.saved.sceneId, steps, captures, interactionCases, saveChecks, localeSwitch, errors, failed, routeStateMismatches, cyrillicCount: captures.reduce((sum, capture) => sum + capture.cyrillicCount, 0), overflowCount: captures.filter((capture) => capture.overflow).length, internalScrollCount: captures.filter((capture) => capture.internalScroll).length });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const pass = results.length === 12 && results.every((result) => result.sceneSet.filter((sceneId) => sceneId !== 'S26').join(',') === routes[result.route].scenes.join(',') && result.finalScene === routes[result.route].final && result.errors.length === 0 && result.failed.length === 0 && result.routeStateMismatches === 0 && result.cyrillicCount === 0 && result.overflowCount === 0 && result.internalScrollCount === 0 && result.localeSwitch?.sameScene && result.localeSwitch.ruCyrillicCount > 0 && result.localeSwitch.enCyrillicCount === 0);
  const evidence = { schemaVersion: 1, status: pass ? 'PASS' : 'BLOCKED', sourceHead, generatedAt: new Date().toISOString(), baseUrl, viewports, routes, saveKey: literarySaveKey, results };
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ status: evidence.status, sourceHead, results: results.map(({ route, viewport, sceneSet, finalScene, errors, failed, routeStateMismatches, cyrillicCount, overflowCount, internalScrollCount, localeSwitch }) => ({ route, viewport, sceneSet, finalScene, errors, failed, routeStateMismatches, cyrillicCount, overflowCount, internalScrollCount, localeSwitch })) }, null, 2));
  if (!pass) process.exitCode = 2;
}

main().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
