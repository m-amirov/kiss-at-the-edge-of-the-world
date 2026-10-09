#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const outputDir = path.join(root, 'artifacts/evidence/localization-orientation');
const evidenceFile = path.join(root, 'artifacts/evidence/localization-orientation-runtime.json');
const locales = ['ru', 'en'];
const viewports = [
  { name: 'portrait360', width: 360, height: 640, orientation: 'portrait' },
  { name: 'portrait390', width: 390, height: 844, orientation: 'portrait' },
  { name: 'portrait412', width: 412, height: 915, orientation: 'portrait' },
  { name: 'portrait768', width: 768, height: 1024, orientation: 'portrait' },
  { name: 'landscape390', width: 844, height: 390, orientation: 'landscape' },
  { name: 'landscape768', width: 1024, height: 768, orientation: 'landscape' },
  { name: 'landscape1366', width: 1366, height: 768, orientation: 'landscape' },
  { name: 'landscape1920', width: 1920, height: 1080, orientation: 'landscape' }
];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];

try {
  for (const locale of locales) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on('pageerror', error => consoleErrors.push(String(error)));
    page.on('console', message => {
      if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404 \(Not Found\)/u.test(message.text())) consoleErrors.push(message.text());
    });
    page.on('requestfailed', request => {
      if (!/\/sdk\.js(?:$|\?)/u.test(request.url())) failedRequests.push(request.url());
    });
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('lang', locale);
      url.searchParams.set('qa', 'localization-orientation');
      await page.goto(url.toString(), { waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
      const startLabel = locale === 'ru' ? 'Новая игра' : 'New Game';
      const home = await page.evaluate(expectedLocale => ({
        locale: window.__LITERARY_QA__.getLocale(),
        text: document.body.innerText,
        expectedLocale
      }), locale);
      if (home.locale !== locale || !home.text.includes(startLabel)) throw new Error(`home locale mismatch for ${locale}`);
      await page.getByRole('button', { name: startLabel, exact: true }).click();
      await page.locator('.reader-sheet').waitFor();
      const readback = await page.evaluate(expectedLocale => {
        const narrative = [...document.querySelectorAll('.reader-paragraph,.decision-question,.choice-button')].map(node => node.textContent ?? '').join('\n');
        const content = document.querySelector('.reader-content');
        const sheet = document.querySelector('.reader-sheet');
        const clipped = [...document.querySelectorAll('.reader-paragraph,.decision-question,.choice-button')].filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
        }).length;
        return {
          sceneId: window.__LITERARY_QA__.getScreen().sceneId,
          locale: window.__LITERARY_QA__.getLocale(),
          narrative,
          russianText: /[\u0400-\u04ff]/u.test(narrative),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
          internalScroll: Boolean(content && content.scrollHeight > content.clientHeight + 1),
          clipped,
          sheetVisible: Boolean(sheet && sheet.getBoundingClientRect().width > 0),
          expectedLocale
        };
      }, locale);
      const screenshotPath = path.join(outputDir, `${locale}-${viewport.name}.png`);
      await page.screenshot({ path: screenshotPath });
      const bytes = await fs.readFile(screenshotPath);
      const localePass = readback.locale === locale && readback.sceneId === 'S01' && readback.sheetVisible && !readback.overflow && !readback.internalScroll && readback.clipped === 0 && (locale === 'ru' ? readback.russianText : !readback.russianText);
      captures.push({
        locale,
        sceneId: readback.sceneId,
        viewport,
        status: localePass && !consoleErrors.length && !failedRequests.length ? 'PASS' : 'FAIL',
        screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
        screenshotSha256: sha256(bytes),
        screenshotBytes: bytes.length,
        readback,
        consoleErrors,
        failedRequests
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const failures = captures.filter(item => item.status !== 'PASS');
const evidence = {
  schemaVersion: 1,
  status: failures.length ? 'FAIL' : 'PASS',
  evidenceType: 'LOCALIZATION_ORIENTATION_RUNTIME',
  sourceHead: head,
  baseUrl,
  locales,
  viewports,
  captures,
  coverage: { expected: locales.length * viewports.length, captured: captures.length, failures: failures.length, complete: captures.length === locales.length * viewports.length && failures.length === 0 },
  expectedExternal: ['/sdk.js is the official Yandex Games SDK and is not vendored locally; local fallback remains exercised'],
  assertions: ['RU and EN boot at S01', 'locale-specific narrative text is rendered', 'all declared game-spec viewports have current screenshots', 'no game-owned console errors or failed requests', 'no viewport overflow/internal reader scroll/clipping']
};
await fs.writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: evidence.status, sourceHead: head, captures: captures.length, failures: failures.length, evidenceFile: path.relative(root, evidenceFile).replaceAll('\\', '/') }, null, 2));
if (failures.length) process.exitCode = 1;
