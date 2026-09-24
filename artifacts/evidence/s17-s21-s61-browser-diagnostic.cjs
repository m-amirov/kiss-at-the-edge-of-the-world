const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = path.resolve('artifacts/evidence/s17-s21-s61-runtime');
fs.mkdirSync(out, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = 'http://127.0.0.1:4173/literary.html';

async function state(page) {
  return page.evaluate(() => ({
    href: location.href,
    scene: document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0] ?? null,
    beat: document.querySelector('.literary-picture')?.dataset.visualBeat ?? null,
    buttons: [...document.querySelectorAll('button')].filter(x => x.offsetParent).map(x => ({ text: x.textContent.trim(), disabled: x.disabled })),
    storage: Object.keys(localStorage),
    bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
    htmlOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
  page.setDefaultTimeout(5000);
  const events = [], errors = [], failed = [];
  page.on('console', m => events.push({ type: 'console', level: m.type(), text: m.text() }));
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('framenavigated', f => events.push({ type: 'navigation', url: f.url() }));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const before = await state(page);
  const button = page.getByRole('button', { name: 'Новая игра', exact: true });
  const t0 = Date.now();
  let click = 'NOT_RUN', navigation = 'NOT_RUN', after = null, storageAfter = null;
  try {
    const nav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 1500 }).catch(e => ({ timeout: e.message }));
    await button.click({ timeout: 3000 });
    click = `PASS ${Date.now() - t0}ms`;
    navigation = JSON.stringify(await nav);
    after = await state(page);
    storageAfter = await page.evaluate(() => localStorage.getItem('literary-reader-state'));
  } catch (e) {
    click = `FAIL ${Date.now() - t0}ms ${e.message}`;
    after = await state(page).catch(x => ({ error: String(x) }));
  }
  const result = { url, browser: chrome, before, click, navigation, after, storageAfter, events, errors, failed };
  fs.writeFileSync(path.join(out, 'diagnostic.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
