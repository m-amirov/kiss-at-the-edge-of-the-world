#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { literarySaveKey } from '../../src/literary-engine.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html';
const output = path.resolve(root, process.env.LITERARY_QA_OUTPUT ?? 'artifacts/evidence/ep09-10-route-runtime');
const evidencePath = path.resolve(root, process.env.LITERARY_QA_EVIDENCE ?? 'artifacts/evidence/ep09-10-route-browser.json');
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const variants = [
  ['eric', 'active', 'A', 'S44'], ['eric', 'paused', 'A', 'S44'], ['eric', 'active', 'B', 'S47'], ['eric', 'active', 'C', 'S47'], ['eric', 'paused', 'B', 'S47'], ['eric', 'paused', 'C', 'S47'], ['eric', 'closed', null, 'S47'],
  ['nick', 'active', 'A', 'S45'], ['nick', 'paused', 'A', 'S45'], ['nick', 'active', 'B', 'S47'], ['nick', 'active', 'C', 'S47'], ['nick', 'paused', 'B', 'S47'], ['nick', 'paused', 'C', 'S47'], ['nick', 'closed', null, 'S47'],
  ['damir', 'active', 'A', 'S46'], ['damir', 'paused', 'A', 'S46'], ['damir', 'active', 'B', 'S47'], ['damir', 'active', 'C', 'S47'], ['damir', 'paused', 'B', 'S47'], ['damir', 'paused', 'C', 'S47'], ['damir', 'closed', null, 'S47'],
  ['alice', 'active', null, 'S47']
].map(([route, routeStatus, finalChoice, ending]) => ({ route, routeStatus, finalChoice, ending }));
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const statusChoice = { eric: 'S32-C1', nick: 'S33-C1', damir: 'S34-C1' };
const routeScene = { eric: 'S37', nick: 'S38', damir: 'S39' };
const cyrillic = /[А-Яа-яЁё]/gu;

function seededChoices(variant) {
  const choices = { 'S26-C1': routeCodes[variant.route] };
  if (statusChoice[variant.route]) choices[statusChoice[variant.route]] = variant.routeStatus === 'active' ? 'A' : variant.routeStatus === 'paused' ? 'B' : 'C';
  return choices;
}
function seed(variant) { return { schemaVersion: 3, sceneId: 'S36', position: 0, choices: seededChoices(variant), finished: false, visited: ['S01', 'S26', 'S36'], runId: `ep09-10-${variant.route}-${variant.routeStatus}-${variant.finalChoice ?? 'none'}-${Date.now()}`, revision: 0 }; }
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

async function capture(page, file) { await page.screenshot({ path: file }); const bytes = await fs.readFile(file); return { path: file, sha256: hash(bytes), bytes: bytes.length }; }
async function main() {
  await fs.mkdir(output, { recursive: true });
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const variant of variants) for (const viewport of viewports) {
      const context = await browser.newContext({ viewport }); const page = await context.newPage(); page.setDefaultTimeout(8000); await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = []; const failed = []; page.on('pageerror', error => errors.push(String(error))); page.on('requestfailed', request => failed.push(request.url()));
      await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); }, { key: literarySaveKey, value: seed(variant) });
      const url = locale => `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}qa=ep09-10-route&lang=${locale}`;
      const boot = async locale => { await page.goto(url(locale), { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue|Продолжить|New Game|Новая игра/ }).first().click(); await page.locator('.reader-sheet').waitFor(); };
      const read = async () => page.evaluate(() => {
        const qa = window.__LITERARY_QA__; const state = qa.getState(); const screen = qa.getScreen(); const flow = qa.getFlow(); const current = flow[screen.position]; const app = document.querySelector('#literary-app'); const sheet = document.querySelector('.reader-content'); const buttons = [...document.querySelectorAll('button')].filter(button => button.offsetParent !== null);
        return { state, current: current ? { type: current.type, id: current.id ?? null, text: current.text ?? '', question: current.question ?? null, options: current.options ?? [], sourceStartRef: current.sourceStartRef ?? null, sourceEndRef: current.sourceEndRef ?? null, decisionResult: current.decisionResult ?? null } : null, visible: app?.innerText ?? '', cyrillicCount: (app?.innerText.match(/[А-Яа-яЁё]/gu) ?? []).length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.documentElement.scrollHeight > document.documentElement.clientHeight, internalScroll: Boolean(sheet && sheet.scrollHeight > sheet.clientHeight + 1), controlsWithinViewport: buttons.every(button => { const r = button.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) };
      });
      await boot('en');
      const captures = []; const interactions = []; const saves = []; let localeSwitch = null; let priorScene = null; let steps = 0;
      while (steps++ < 900) {
        const before = await read(); const sceneId = before.state.sceneId;
        if (sceneId !== priorScene) { priorScene = sceneId; const file = path.join(output, `${variant.route}-${variant.routeStatus}-${variant.finalChoice ?? 'none'}-${viewport.width}x${viewport.height}-${sceneId}.png`); captures.push({ sceneId, cyrillicCount: before.cyrillicCount, overflow: before.overflow, internalScroll: before.internalScroll, controlsWithinViewport: before.controlsWithinViewport, screenshot: await capture(page, file) }); }
        if (sceneId === 'S36' && before.state.position === 0 && !saves.some(item => item.checkpoint === 'episode-9-entry')) saves.push({ checkpoint: 'episode-9-entry', state: before.state });
        if (sceneId === 'S41' && !localeSwitch) {
          const preserved = before.state;
          await page.goto(url('ru'), { waitUntil: 'networkidle' }); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: preserved }); await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click(); const ru = await read();
          await page.goto(url('en'), { waitUntil: 'networkidle' }); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: ru.state }); await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue|New Game/ }).first().click(); const en = await read();
          await page.goto(url('ru'), { waitUntil: 'networkidle' }); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: en.state }); await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click(); const ruAgain = await read();
          await page.goto(url('en'), { waitUntil: 'networkidle' }); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: ruAgain.state }); await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue|New Game/ }).first().click(); localeSwitch = { scenes: [preserved.sceneId, ru.state.sceneId, en.state.sceneId, ruAgain.state.sceneId], sameScene: [ru.state.sceneId, en.state.sceneId, ruAgain.state.sceneId].every(scene => scene === preserved.sceneId), ruCyrillicCount: ru.cyrillicCount, enCyrillicCount: en.cyrillicCount, structuralSaveHasLocale: Object.hasOwn(ru.state, 'locale') || Object.hasOwn(en.state, 'locale') }; priorScene = null; continue;
        }
        if (before.current?.type === 'choice') {
          const id = before.current.id; const choice = id.endsWith('-C90') ? 'A' : id === 'S42-C1' ? variant.finalChoice : id === 'S36-C1' || id === `${routeScene[variant.route]}-C1` || id === 'S41-C1' ? 'A' : 'A';
          if (!choice) throw new Error(`Unexpected authored choice ${id} for ${variant.route}/${variant.routeStatus}`);
          const index = before.current.options.findIndex(option => option.code === choice);
          if (index < 0) throw new Error(`Missing ${choice} at ${id}`);
          if (id.endsWith('-C90')) { const file = path.join(output, `${variant.route}-${variant.routeStatus}-${variant.finalChoice ?? 'none'}-${viewport.width}x${viewport.height}-${sceneId}-${id}.png`); interactions.push({ sceneId, id, insertionSourceRef: before.current.sourceStartRef, question: before.current.question, beforeVisible: before.visible, screenshot: await capture(page, file) }); }
          await page.locator('.choice-button').nth(index).click(); const after = await read();
          if (id.endsWith('-C90')) { interactions.at(-1).resultingText = after.current?.text ?? ''; interactions.at(-1).followingSourceRef = after.current?.sourceStartRef ?? null; interactions.at(-1).routePreserved = after.state.choices['S26-C1'] === before.state.choices['S26-C1']; saves.push({ checkpoint: `after-${id}`, state: after.state }); }
          if (id === 'S36-C1' || id === `${routeScene[variant.route]}-C1` || id === 'S42-C1') saves.push({ checkpoint: `after-${id}`, state: after.state });
        } else if (before.current?.type === 'page') { await page.evaluate(() => { const stage = document.querySelector('[data-stage-advance]'); if (stage) stage.dispatchEvent(new MouseEvent('click', { bubbles: true })); else document.querySelector('.reader-sheet > button.primary')?.click(); }); }
        else { const next = page.locator('.reader-sheet > button.primary'); if (!await next.count()) break; await next.click(); }
        const state = await read(); if (['S44', 'S45', 'S46', 'S47'].includes(state.state.sceneId) && state.state.position === 0) { const final = path.join(output, `${variant.route}-${variant.routeStatus}-${variant.finalChoice ?? 'none'}-${viewport.width}x${viewport.height}-ending-${state.state.sceneId}.png`); captures.push({ sceneId: state.state.sceneId, cyrillicCount: state.cyrillicCount, overflow: state.overflow, internalScroll: state.internalScroll, controlsWithinViewport: state.controlsWithinViewport, screenshot: await capture(page, final) }); break; }
      }
      const final = await read(); const enText = [...captures.map(item => item.cyrillicCount), final.cyrillicCount].reduce((sum, count) => sum + count, 0); const expectedRoute = variant.route === 'alice' || variant.routeStatus === 'closed' ? ['S36', 'S40', 'S64', 'S60', 'S41', 'S43', 'S48', 'S47'] : ['S36', routeScene[variant.route], { eric: 'S51', nick: 'S54', damir: 'S57' }[variant.route], 'S60', 'S41', 'S42', 'S48', variant.ending];
      results.push({ variant, viewport, sourceHead, captures, interactions, saves, localeSwitch, finalScene: final.state.sceneId, expectedRoute, seenScenes: captures.map(item => item.sceneId), cyrillicCount: enText, overflowCount: captures.filter(item => item.overflow).length, internalScrollCount: captures.filter(item => item.internalScroll).length, controlsOutsideViewport: captures.filter(item => !item.controlsWithinViewport).length, errors, failed }); await context.close();
    }
  } finally { await browser.close(); }
  const pass = results.length === variants.length * viewports.length && results.every(result => result.finalScene === result.variant.ending && result.expectedRoute.every(scene => result.seenScenes.includes(scene)) && result.interactions.length >= 4 && result.interactions.every(item => item.routePreserved && !cyrillic.test(`${item.question}\n${item.resultingText}`)) && result.cyrillicCount === 0 && result.overflowCount === 0 && result.internalScrollCount === 0 && result.controlsOutsideViewport === 0 && result.errors.length === 0 && result.failed.length === 0 && result.localeSwitch?.sameScene && result.localeSwitch.ruCyrillicCount > 0 && result.localeSwitch.enCyrillicCount === 0 && !result.localeSwitch.structuralSaveHasLocale);
  const evidence = { schemaVersion: 1, status: pass ? 'PASS' : 'BLOCKED', testedSourceHead: sourceHead, generatedAt: new Date().toISOString(), baseUrl, viewports, variants, results };
  await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`); console.log(JSON.stringify({ status: evidence.status, testedSourceHead: sourceHead, runs: results.length, failures: results.filter(result => result.finalScene !== result.variant.ending || result.errors.length || result.failed.length || result.cyrillicCount || result.overflowCount || result.internalScrollCount || result.controlsOutsideViewport || !result.localeSwitch?.sameScene).map(result => ({ variant: result.variant, viewport: result.viewport, finalScene: result.finalScene, errors: result.errors, failed: result.failed })) }, null, 2)); if (!pass) process.exitCode = 2;
}
main().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
