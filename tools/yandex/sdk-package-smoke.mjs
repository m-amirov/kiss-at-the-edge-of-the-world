#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argument = name => process.argv.slice(2).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
const root = path.resolve(argument('--root') ?? '.');
const output = path.resolve(argument('--output') ?? 'output/playwright/yandex-sdk-package-smoke');
const evidenceFile = path.resolve(argument('--evidence') ?? 'artifacts/evidence/yandex-sdk-package-smoke.json');
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const sdk = "window.__yandexSdkSmoke=[];window.YaGames={init:async()=>{window.__yandexSdkSmoke.push('init');return{environment:{i18n:{lang:'ru'}},features:{LoadingAPI:{ready:()=>window.__yandexSdkSmoke.push('ready')},GameplayAPI:{start:()=>window.__yandexSdkSmoke.push('start'),stop:()=>window.__yandexSdkSmoke.push('stop')}},getPlayer:async()=>({getData:async()=>({}),setData:async()=>{}}),on:()=>{},off:()=>{}}}};";
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf' };

if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(`RC root has no index.html: ${root}`);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/sdk.js') { response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); response.end(sdk); return; }
  const file = path.resolve(root, url.pathname.replace(/^\/+/, '') || 'index.html');
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const viewports = [{ width: 1920, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }];
const results = [];
await fsp.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport }); const page = await context.newPage();
    const consoleErrors = [], failedRequests = [], sdkResponses = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => consoleErrors.push(String(error)));
    page.on('requestfailed', request => failedRequests.push(request.url()));
    page.on('response', response => { if (new URL(response.url()).pathname === '/sdk.js') sdkResponses.push(response.status()); });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home, [data-qa-failure]')));
    const bootState = await page.evaluate(() => window.__LITERARY_QA__?.getState?.());
    if (!await page.locator('[data-qa-failure]').count()) {
      await page.getByRole('button', { name: /Новая игра/ }).click();
      await page.waitForSelector('[data-stage-advance]');
      await page.locator('[data-stage-advance]').click();
    }
    const state = await page.evaluate((before) => {
      const after = window.__LITERARY_QA__?.getState?.();
      return { mode: window.__LITERARY_QA__?.getPlatformMode?.(), sdkEvents: window.__yandexSdkSmoke ?? [], failure: document.querySelector('[data-qa-failure]')?.dataset.qaFailure ?? null, progression: Boolean(after && before && (after.sceneId !== before.sceneId || after.position > before.position)), overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
    }, bootState);
    const screenshot = path.join(output, `home-${viewport.width}x${viewport.height}.png`); await page.screenshot({ path: screenshot });
    results.push({ viewport, sdkResponses, state, consoleErrors, failedRequests, screenshot }); await context.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
const status = results.length === viewports.length && results.every(result => result.sdkResponses.join(',') === '200' && result.state.mode === 'yandex' && result.state.sdkEvents.filter(event => event === 'init').length === 1 && result.state.sdkEvents.filter(event => event === 'ready').length === 1 && result.state.progression && !result.state.failure && !result.state.overflow && result.consoleErrors.length === 0 && result.failedRequests.length === 0) ? 'PASS' : 'FAIL';
const evidence = { status, baseUrl: 'ephemeral local Yandex-compatible /sdk.js proxy', root, viewports, results };
await fsp.mkdir(path.dirname(evidenceFile), { recursive: true }); await fsp.writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status, evidenceFile, results: results.map(({ viewport, sdkResponses, state, consoleErrors, failedRequests }) => ({ viewport, sdkResponses, mode: state.mode, events: state.sdkEvents, consoleErrors: consoleErrors.length, failedRequests: failedRequests.length })) }, null, 2));
if (status !== 'PASS') process.exitCode = 1;
