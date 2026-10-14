import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.env.CONFIRM_DIALOG_OUTPUT ?? path.join(root, 'artifacts/evidence/confirm-dialog-runtime'));
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4174/literary.html';
const currentHead = process.env.GIT_HEAD ?? null;
const views = [{ name: 'desktop', width: 1920, height: 900 }, { name: 'mobile', width: 390, height: 844 }, { name: 'mobile-small', width: 360, height: 640 }];
const localState = { schemaVersion: 3, sceneId: 'S03', position: 2, choices: { 'S01-C1': 'A' }, finished: false, visited: ['S01', 'S03'], runId: 'confirm-dialog-local', revision: 7 };
const cloudState = { schemaVersion: 3, sceneId: 'S03', position: 0, choices: {}, finished: false, visited: ['S01', 'S03'], runId: 'confirm-dialog-cloud', revision: 3 };
const sdkStub = `window.YaGames={init:async()=>({environment:{i18n:{lang:window.__CONFIRM_LOCALE__||'ru'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},getPlayer:async()=>({getData:async()=>({'kiss-at-the-edge-of-the-world:literary-season:v1':${JSON.stringify(cloudState)}}),setData:async()=>{}}),on(){},off(){}})};`;
const playwright = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function meaningfulState(state) { return { sceneId: state.sceneId, position: state.position, choices: state.choices, finished: state.finished, visited: state.visited }; }

async function createPage(browser, view, locale, cloud = false) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, isMobile: view.width < 600, hasTouch: view.width < 600 });
  const page = await context.newPage();
  const errors = [], missing = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() === 404 && !response.url().endsWith('/sdk.js')) missing.push(response.url()); });
  await page.addInitScript({ content: `window.__CONFIRM_LOCALE__=${JSON.stringify(locale)};${cloud ? sdkStub : ''}` });
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('__confirm_dialog_seeded') === '1') return;
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('__confirm_dialog_seeded', '1');
  }, { key: literarySaveKey, value: localState });
  await page.route('**/sdk.js', route => route.fulfill({ contentType: 'text/javascript', body: cloud ? sdkStub : '' }));
  await page.goto(`${baseUrl}?lang=${locale}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
  if (cloud) await page.locator('.cloud-restore').waitFor();
  return { context, page, errors, missing };
}

async function dialogSnapshot(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const app = document.querySelector('#literary-app');
    const active = document.activeElement;
    const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
    return {
      open: Boolean(dialog),
      ariaModal: dialog?.getAttribute('aria-modal') ?? null,
      labelledBy: dialog?.getAttribute('aria-labelledby') ?? null,
      describedBy: dialog?.getAttribute('aria-describedby') ?? null,
      appInert: Boolean(app?.inert),
      appAriaHidden: app?.getAttribute('aria-hidden') ?? null,
      activeAction: active?.getAttribute('data-confirm-dialog-action') ?? null,
      buttonCount: buttons.length,
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      dialogRect: dialog ? (() => { const r = dialog.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; })() : null
    };
  });
}

async function openNew(page, locale) {
  await page.getByRole('button', { name: locale === 'ru' ? 'Новая игра' : 'New Game', exact: true }).click();
  await page.locator('[role="dialog"]').waitFor();
}

async function openEpisodeReplay(page, locale) {
  if (await page.locator('.home-panel').count()) await page.getByRole('button', { name: locale === 'ru' ? '← К меню' : '← Menu', exact: true }).click();
  await page.getByRole('button', { name: locale === 'ru' ? 'Эпизоды' : 'Episodes', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${locale === 'ru' ? 'Эпизод' : 'Episode'} 1 ·`) }).click();
  await page.locator('[role="dialog"]').waitFor();
}

async function openCloud(page) {
  await page.locator('.cloud-restore').click();
  await page.locator('[role="dialog"]').waitFor();
}

async function touchClick(page, selector) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error(`touch target missing: ${targetSelector}`);
    const init = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 1, button: 0 };
    target.dispatchEvent(new PointerEvent('pointerdown', init));
    target.dispatchEvent(new PointerEvent('pointerup', init));
    target.dispatchEvent(new MouseEvent('click', init));
  }, selector);
}

async function doubleTouchConfirm(page) {
  await page.evaluate(() => {
    const button = document.querySelector('[data-confirm-dialog-action="confirm"]');
    if (!button) throw new Error('confirm button missing');
    for (let index = 0; index < 2; index += 1) {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
      button.click();
    }
  });
}

async function assertClosed(page) {
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  const state = await page.evaluate(() => window.__LITERARY_QA__.getState());
  return state;
}

await fs.mkdir(output, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { schemaVersion: 1, status: 'FAIL', generatedAt: new Date().toISOString(), currentHead, baseUrl, viewports: views, captures: [], scenarios: [] };
try {
  for (const locale of ['ru', 'en']) for (const view of views) {
    const run = await createPage(browser, view, locale);
    const { page, errors, missing } = run;
    await openNew(page, locale);
    const opened = await dialogSnapshot(page);
    const screenshot = path.join(output, `new-game-${locale}-${view.name}.png`);
    await page.screenshot({ path: screenshot });
    const bytes = await fs.readFile(screenshot);
    evidence.captures.push({ scenario: 'new-game-confirm', locale, view, screenshot, screenshotSha256: digest(bytes), screenshotBytes: bytes.length, opened, errors: [...errors], missing: [...missing] });
    const beforeCancel = await page.evaluate(() => window.__LITERARY_QA__.getState());
    await touchClick(page, '[data-confirm-dialog-action="cancel"]');
    const afterCancel = await assertClosed(page);
    assert.deepEqual(meaningfulState(afterCancel), meaningfulState(beforeCancel), `${locale}/${view.name}: cancel changed save state`);
    await openNew(page, locale);
    const beforeEscape = await page.evaluate(() => window.__LITERARY_QA__.getState());
    await page.keyboard.press('Escape');
    const afterEscape = await assertClosed(page);
    assert.deepEqual(meaningfulState(afterEscape), meaningfulState(beforeEscape), `${locale}/${view.name}: Escape changed save state`);
    await openNew(page, locale);
    const beforeBack = await page.evaluate(() => window.__LITERARY_QA__.getState());
    await page.evaluate(() => history.back());
    const afterBack = await assertClosed(page);
    assert.deepEqual(meaningfulState(afterBack), meaningfulState(beforeBack), `${locale}/${view.name}: Back changed save state`);
    await openNew(page, locale);
    await doubleTouchConfirm(page);
    const afterConfirm = await page.waitForFunction(() => window.__LITERARY_QA__.getScreen().sceneId === 'S01').then(() => page.evaluate(() => window.__LITERARY_QA__.getState()));
    assert.equal(afterConfirm.sceneId, 'S01', `${locale}/${view.name}: confirm did not start a new game`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
    const afterReload = await page.evaluate(() => window.__LITERARY_QA__.getState());
    assert.equal(afterReload.sceneId, 'S01', `${locale}/${view.name}: confirmed save did not survive reload`);
    evidence.scenarios.push({ scenario: 'new-game', locale, view, cancel: true, escape: true, back: true, touchConfirmOnce: true, saveLoad: true });
    await run.context.close();
  }

  {
    const run = await createPage(browser, views[0], 'ru');
    const { page } = run;
    await openEpisodeReplay(page, 'ru');
    const beforeCancel = await page.evaluate(() => window.__LITERARY_QA__.getState());
    await page.keyboard.press('Escape');
    const afterCancel = await assertClosed(page);
    assert.deepEqual(meaningfulState(afterCancel), meaningfulState(beforeCancel), 'episode replay cancel changed save state');
    await openEpisodeReplay(page, 'ru');
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    const replayed = await page.waitForFunction(() => window.__LITERARY_QA__.getScreen().sceneId === 'S01').then(() => page.evaluate(() => window.__LITERARY_QA__.getState()));
    assert.equal(replayed.sceneId, 'S01', 'episode replay confirm did not rewind to episode start');
    assert.equal(replayed.position, 0, 'episode replay confirm did not reset position');
    evidence.scenarios.push({ scenario: 'episode-replay', locale: 'ru', view: views[0], cancel: true, confirm: true, semantics: 'episode-start-and-later-choice-reset' });
    await run.context.close();
  }

  {
    const run = await createPage(browser, views[1], 'en', true);
    const { page, errors, missing } = run;
    await openCloud(page);
    const opened = await dialogSnapshot(page);
    const screenshot = path.join(output, 'cloud-restore-en-mobile.png');
    await page.screenshot({ path: screenshot });
    const bytes = await fs.readFile(screenshot);
    evidence.captures.push({ scenario: 'cloud-restore-confirm', locale: 'en', view: views[1], screenshot, screenshotSha256: digest(bytes), screenshotBytes: bytes.length, opened, errors: [...errors], missing: [...missing] });
    const beforeCancel = await page.evaluate(() => window.__LITERARY_QA__.getState());
    await touchClick(page, '[data-confirm-dialog-action="cancel"]');
    const afterCancel = await assertClosed(page);
    assert.deepEqual(meaningfulState(afterCancel), meaningfulState(beforeCancel), 'cloud restore cancel changed local save');
    await openCloud(page);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    const restored = await page.waitForFunction(() => window.__LITERARY_QA__.getState().runId === 'confirm-dialog-cloud').then(() => page.evaluate(() => window.__LITERARY_QA__.getState()));
    assert.deepEqual(meaningfulState(restored), meaningfulState(cloudState), 'cloud restore confirm did not replace the local save');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
    const loaded = await page.evaluate(() => window.__LITERARY_QA__.getState());
    assert.deepEqual(meaningfulState(loaded), meaningfulState(cloudState), 'cloud restore did not survive save/load');
    evidence.scenarios.push({ scenario: 'cloud-restore', locale: 'en', view: views[1], cancel: true, confirm: true, saveLoad: true });
    await run.context.close();
  }
} finally {
  await browser.close();
}
const failures = evidence.captures.filter(item => item.errors.length || item.missing.length || !item.opened.open || item.opened.ariaModal !== 'true' || !item.opened.appInert || item.opened.appAriaHidden !== 'true' || item.opened.overflow || !item.opened.dialogRect || item.opened.dialogRect.left < 0 || item.opened.dialogRect.right > item.view.width || item.opened.dialogRect.top < 0 || item.opened.dialogRect.bottom > item.view.height);
evidence.status = failures.length ? 'FAIL' : 'PASS';
evidence.failures = failures;
await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: evidence.status, output, captures: evidence.captures.length, scenarioCount: evidence.scenarios.length, failures: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;
