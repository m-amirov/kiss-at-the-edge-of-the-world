#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';

const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html?qa=mobile-choice-ui-fix';
const output = process.env.LITERARY_QA_OUTPUT ?? 'output/playwright/mobile-choice-ui-fix';
const evidencePath = process.env.LITERARY_QA_EVIDENCE ?? 'artifacts/evidence/mobile-choice-ui-fix.json';
const viewports = [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1920, height: 900 }];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage(); const consoleErrors = []; const failedRequests = [];
    page.on('pageerror', error => consoleErrors.push(String(error)));
    page.on('requestfailed', request => failedRequests.push(request.url()));
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: { schemaVersion: 3, sceneId: 'S01', position: 0, choices: {}, finished: false, visited: ['S01'], runId: `choice-ui-${viewport.width}`, revision: 0 } });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Продолжить|Новая игра/ }).first().click();
    for (let step = 0; step < 1600; step += 1) {
      const state = await page.evaluate(() => { const qa = window.__LITERARY_QA__; const current = qa.getFlow()[qa.getScreen().position]; return { type: current?.type, multilineCandidate: current?.type === 'choice' && current.options.some(option => option.label.length >= 45) }; });
      if (state.multilineCandidate) break;
      if (state.type === 'choice') await page.locator('.choice-button').first().click();
      else await page.evaluate(() => document.querySelector('[data-stage-advance]')?.click());
    }
    await page.locator('.choice-button').first().waitFor();
    const metrics = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.choice-button')];
      return buttons.map(button => {
        const rect = button.getBoundingClientRect(); const marker = getComputedStyle(button, '::before'); const after = getComputedStyle(button, '::after');
        const range = document.createRange(); range.selectNodeContents(button); const text = range.getBoundingClientRect();
        const markerRight = Number.parseFloat(marker.left) + Number.parseFloat(marker.width) + Number.parseFloat(marker.borderRightWidth);
        return { label: button.textContent, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }, textRect: { left: text.left, right: text.right, top: text.top, bottom: text.bottom, height: text.height }, paddingLeft: Number.parseFloat(getComputedStyle(button).paddingLeft), marker: { content: marker.content, width: marker.width, height: marker.height, borderRight: marker.borderRightWidth, borderBottom: marker.borderBottomWidth, transform: marker.transform, right: markerRight }, afterContent: after.content, enabled: !button.disabled };
      });
    });
    const beforeChoices = await page.evaluate(() => Object.keys(window.__LITERARY_QA__.getState().choices).length);
    const screenshot = path.join(output, `MOBILE_CHOICE_UI_FIX-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot }); const bytes = await fs.readFile(screenshot);
    await page.locator('.choice-button').first().click();
    await page.waitForTimeout(100);
    const afterChoices = await page.evaluate(() => Object.keys(window.__LITERARY_QA__.getState().choices).length);
    const overlap = metrics.filter(item => item.rect.left + item.marker.right > item.textRect.left - 6).length;
    const clippedText = metrics.filter(item => item.textRect.left < item.rect.left || item.textRect.right > item.rect.right || item.textRect.top < item.rect.top || item.textRect.bottom > item.rect.bottom).length;
    const brokenGlyph = metrics.filter(item => item.marker.content !== '""' || item.afterContent !== 'none' || item.marker.borderRight === '0px' || item.marker.borderBottom === '0px').length;
    const tappable = metrics.every(item => item.enabled && item.rect.height >= 44 && item.rect.width >= 44);
    const screen = await page.evaluate(() => window.__LITERARY_QA__.getScreen());
    captures.push({ viewport, state: `${screen.sceneId} multiline choice`, screenshot, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, actualPixelsReceived: true, brokenGlyph, overlap, clippedText, tappable, multilineAligned: metrics.filter(item => item.textRect.height > 30).every(item => item.paddingLeft >= item.marker.right + 8), choiceCountDelta: afterChoices - beforeChoices, doubleTrigger: afterChoices - beforeChoices !== 1, consoleErrors, failedRequests, metrics });
    await context.close();
  }
} finally { await browser.close(); }
const status = captures.every(item => item.brokenGlyph === 0 && item.overlap === 0 && item.clippedText === 0 && item.tappable && item.multilineAligned && !item.doubleTrigger && item.consoleErrors.length === 0 && item.failedRequests.length === 0) ? 'PASS' : 'FAIL';
const evidence = { schemaVersion: 1, evidenceType: 'MOBILE_CHOICE_UI_FIX', status, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), generatedAt: new Date().toISOString(), baseUrl, captures };
await fs.mkdir(path.dirname(evidencePath), { recursive: true }); await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status, evidenceType: evidence.evidenceType, captures: captures.map(({ viewport, brokenGlyph, overlap, clippedText, tappable, doubleTrigger, screenshot }) => ({ viewport, brokenGlyph, overlap, clippedText, tappable, doubleTrigger, screenshot })) }, null, 2));
if (status !== 'PASS') process.exitCode = 1;
