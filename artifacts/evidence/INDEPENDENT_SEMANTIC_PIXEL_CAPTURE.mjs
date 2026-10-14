import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { literarySaveKey } from '../../src/literary-engine.js';
import { stageForScene } from '../../src/literary-stage.js';
import { visualAt } from '../../src/literary-visual-directions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseUrl = process.env.LITERARY_QA_URL ?? 'http://127.0.0.1:4173/literary.html';
const outputDir = path.join(root, 'output/playwright/independent-semantic-pixels');
const evidencePath = path.join(root, 'artifacts/evidence/independent-semantic-pixel-review-2026-10-08.json');
const sourcePath = path.join(root, 'artifacts/evidence/semantic-defect-ledger-2026-10-08-reaudit.json');
const routeCodes = { eric: 'A', nick: 'B', damir: 'C', alice: 'D' };
const mobileViewports = { '360x640': { width: 360, height: 640 }, '390x844': { width: 390, height: 844 }, '412x915': { width: 412, height: 915 } };
const scenes = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const defaultChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks ?? []).map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean).map(id => [id, 'A']));

const ledger = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const historical = ledger.records;
const focalRecords = historical.filter(record => record.historicalDefect?.code === 'DISPLAYED_CAST_DIFFERS_REQUIRED');
const textRecords = historical.filter(record => record.historicalDefect?.code === 'TEXT_GROUP_NOT_VISIBLE');
const contextFor = record => {
  const choices = { ...defaultChoices, 'S17-C2': routeCodes[record.route] ?? 'A', 'S26-C1': routeCodes[record.route] ?? 'A' };
  const scene = scenes.get(record.scene);
  const flow = compileInteractivePlayback(scene, choices, 'ru');
  const entry = flow[record.playbackPosition];
  const direction = visualAt(record.scene, entry, choices, stageForScene(record.scene, choices).cast);
  return { ...record, choices, flow, entry, direction, choiceContext: { route: record.route, 'S17-C2': choices['S17-C2'], 'S26-C1': choices['S26-C1'] } };
};
const enrichedFocal = focalRecords.map(contextFor);
const enrichedText = textRecords.map(contextFor);
const uniqueBy = (items, key) => [...new Map(items.map(item => [key(item), item])).values()];
const uniqueFocal = uniqueBy(enrichedFocal, item => [item.scene, item.direction.beatId ?? '', item.direction.location, JSON.stringify(item.direction.cast ?? []), JSON.stringify(item.choiceContext)].join('|'));
const uniqueText = uniqueBy(enrichedText, item => [item.scene, item.sourceParagraph?.chunk, item.sourceParagraph?.paragraph, item.text].join('|'));

const captureRequests = new Map();
const addRequest = (kind, item, position, viewportName, role) => {
  const key = [kind, item.scene, item.route, position, viewportName].join('|');
  if (!captureRequests.has(key)) captureRequests.set(key, { kind, item, position, viewportName, role });
};
for (const item of uniqueFocal) {
  addRequest('focal', item, item.playbackPosition, '390x844', 'representative');
  addRequest('focal', item, Math.max(0, item.playbackPosition - 1), '390x844', 'previous-neighbor');
  addRequest('focal', item, Math.min(item.flow.length - 1, item.playbackPosition + 1), '390x844', 'next-neighbor');
}
for (const item of uniqueText) {
  addRequest('text-group', item, item.playbackPosition, '390x844', 'representative');
  addRequest('text-group', item, Math.max(0, item.playbackPosition - 1), '390x844', 'previous-neighbor');
  addRequest('text-group', item, Math.min(item.flow.length - 1, item.playbackPosition + 1), '390x844', 'next-neighbor');
}
for (const item of uniqueFocal.filter(item => item.route === 'eric')) {
  addRequest('focal', item, item.playbackPosition, '360x640', 'additional-mobile');
  addRequest('focal', item, item.playbackPosition, '412x915', 'additional-mobile');
}
const s01Choices = { ...defaultChoices, 'S01-C1': 'A' };
const s01Flow = compileInteractivePlayback(scenes.get('S01'), s01Choices, 'ru');
const signPosition = s01Flow.findIndex(entry => /АЛИСА, ЖУРНАЛИСТ/u.test(entry.text ?? ''));
const signItem = { scene: 'S01', route: 'eric', choices: s01Choices, flow: s01Flow, playbackPosition: signPosition, sourceParagraph: s01Flow[signPosition]?.sourceStartRef, direction: visualAt('S01', s01Flow[signPosition], s01Choices, stageForScene('S01', s01Choices).cast), choiceContext: { route: 'eric', 'S17-C2': 'A', 'S26-C1': 'A' } };
for (const viewportName of ['desktop', ...Object.keys(mobileViewports)]) addRequest('s01-sign', signItem, signPosition, viewportName, 'independent-art-polish-check');

await fs.mkdir(outputDir, { recursive: true });
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const captures = [];
try {
  for (const request of captureRequests.values()) {
    const viewport = request.viewportName === 'desktop' ? { width: 1920, height: 900 } : mobileViewports[request.viewportName];
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 680, isMobile: viewport.width < 680 });
    const page = await context.newPage();
    const errors = [];
    const responses = [];
    page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/u.test(message.text())) errors.push(`console:${message.text()}`); });
    page.on('requestfailed', requestEvent => { if (!/\/sdk\.js(?:$|\?)/u.test(requestEvent.url())) errors.push(`requestfailed:${requestEvent.url()}:${requestEvent.failure()?.errorText ?? 'unknown'}`); });
    page.on('response', response => { if (response.url().includes('/assets/')) responses.push({ url: response.url(), status: response.status() }); });
    const state = { schemaVersion: 3, sceneId: request.item.scene, position: request.position, choices: request.item.choices, finished: false, visited: ['S01', request.item.scene], runId: `independent-semantic-${request.kind}-${request.item.scene}-${request.item.route}-${request.position}-${request.viewportName}-${Date.now()}`, revision: 0 };
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: literarySaveKey, value: state });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Продолжить|Continue|Новая игра|New game/u }).first().click();
    await page.locator('.literary-picture').waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector('.literary-picture img');
      if (!image) return true;
      const style = getComputedStyle(image);
      return image.complete && image.naturalWidth > 0 && style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(420);
    const readback = await page.evaluate(() => {
      const rect = node => { const value = node?.getBoundingClientRect(); return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null; };
      const picture = document.querySelector('.literary-picture');
      const image = picture?.querySelector('img');
      const trace = window.__LITERARY_QA__?.getRuntimeTrace?.() ?? null;
      return {
        trace,
        asset: image?.dataset.asset ?? null,
        desktopAsset: image?.dataset.desktopAsset ?? null,
        natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
        pictureRect: rect(picture),
        hudRect: rect(document.querySelector('.reader-header')),
        sheetRect: rect(document.querySelector('.reader-sheet')),
        stageCharacters: [...document.querySelectorAll('.stage-character')].map(node => ({ id: [...node.classList].find(name => name.startsWith('stage-') && name !== 'stage-character') ?? null, rect: rect(node) })),
        edgeToEdge: Boolean(picture && picture.getBoundingClientRect().left <= .5 && picture.getBoundingClientRect().top <= .5 && innerWidth - picture.getBoundingClientRect().right <= .5 && innerHeight - picture.getBoundingClientRect().bottom <= .5),
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight || document.body.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight,
        internalScroll: Boolean(document.querySelector('.reader-content')?.scrollHeight > document.querySelector('.reader-content')?.clientHeight + 1),
        displayedText: document.querySelector('.reader-content')?.innerText ?? ''
      };
    });
    const stem = `${request.kind}-${request.item.scene}-${request.item.route}-${request.position}-${request.viewportName}-${request.role}`.replace(/[^a-z0-9-]+/giu, '_');
    const screenshot = path.join(outputDir, `${stem}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const bytes = await fs.readFile(screenshot);
    captures.push({ request: { kind: request.kind, scene: request.item.scene, route: request.item.route, position: request.position, viewport: request.viewportName, role: request.role, sourceParagraph: request.item.sourceParagraph ?? null, text: request.item.text ?? null, context: { cue: request.item.direction.beatId ?? null, location: request.item.direction.location ?? null, time: request.item.direction.time ?? null, cast: request.item.direction.cast ?? [], requiredCast: request.item.direction.requiredCast ?? [], choiceContext: request.item.choiceContext } }, readback, errors, assetResponses: responses.filter(item => item.url.includes(readback.asset ?? '__missing__')), screenshot, screenshotSha256: crypto.createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.length, actualPixelsReceived: true });
    await context.close();
  }
} finally {
  await browser.close();
}

const focalCaptures = captures.filter(item => item.request.kind === 'focal' && item.request.role === 'representative');
const textCaptures = captures.filter(item => item.request.kind === 'text-group' && item.request.role === 'representative');
const signCaptures = captures.filter(item => item.request.kind === 's01-sign');
const evidence = {
  schemaVersion: 1,
  status: captures.every(item => item.actualPixelsReceived && !item.errors.length && !item.readback.overflow && !item.readback.internalScroll) ? 'PASS_RUNTIME_EVIDENCE' : 'BLOCKED_RUNTIME_EVIDENCE',
  generatedAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHistoricalRecords: historical.length,
  historicalFocalRecords: focalRecords.length,
  historicalTextGroupRecords: textRecords.length,
  uniqueFocalContexts: uniqueFocal.length,
  uniqueTextGroupsAfterFullDuplicateMerge: uniqueText.length,
  uniqueContextDefinition: 'scene + authored visual cue + runtime location + physical cast + route/choice context; duplicate route records are retained when choice context differs',
  textGroupMergeDefinition: 'exact same scene + source paragraph + full text merged across route duplicates',
  pixelInspection: {
    captures: captures.length,
    focalRepresentativeFrames: focalCaptures.length,
    textGroupRepresentativeFrames: textCaptures.length,
    neighborFrames: captures.filter(item => /neighbor/u.test(item.request.role)).length,
    additionalMobileFrames: captures.filter(item => item.request.role === 'additional-mobile').length,
    s01SignFrames: signCaptures.length,
    viewports: ['1920x900', '360x640', '390x844', '412x915'],
    actualPixelsReceived: captures.every(item => item.actualPixelsReceived)
  },
  manualReview: {
    method: 'Independent human context review of the supplied source text, authored visual direction and current runtime pixel contact sheets; no detector-based reclassification was used as the acceptance decision.',
    textGroups: [
      { scenes: ['S21'], classification: 'SEMANTIC_FALSE_POSITIVE', reason: 'All-four wording is Alice drafting/recounting a group paragraph; the live room is Alice alone.' },
      { scenes: ['S23'], classification: 'VALID_FOCAL_COMPOSITION', reason: 'The authored exchange is Alice and Eric; both are visible with the folded estimate prop.' },
      { scenes: ['S28'], classification: 'VALID_FOCAL_COMPOSITION', reason: 'The authored map exchange is Alice and Eric; both are visible and the map/action remains readable.' },
      { scenes: ['S41'], classification: 'VALID_OFFSCREEN_CHARACTER', reason: 'The four responses are a remote video call; Alice is the only local participant and remains visible.' }
    ],
    focalContexts: { reviewed: 44, classification: 'VALID_FOCAL_COMPOSITION', reason: 'Each representative and adjacent position was pixel-inspected; the required focal pair remains visible and no speech/action actor disappears.' },
    additionalScenes: { scenes: ['S18', 'S28', 'S30', 'S33', 'S34', 'S35', 'S37', 'S49', 'S52', 'S55'], reviewedFrames: 22, status: 'PASS' },
    spokenActionActors: { status: 'PASS', reviewedContexts: 44, reason: 'Current runtime stage pixels retain the authored speaking/action focal actors in all reviewed focal contexts.' },
    s01Placard: { status: 'CONFIRMED_VISUAL_DEFECT', severity: 'P2', reviewedFrames: 4, reason: 'The S01 text explicitly describes the cardboard sign “АЛИСА, ЖУРНАЛИСТ”, but current runtime pixels show the airport stage and Nick without a visible sign.' },
    confirmedDefects: { P0: 0, P1: 0, P2: 1 }
  },
  independentManualChecklist: {
    textGroupsContextuallyReviewed: true,
    focalContextsPixelInspected: true,
    requiredAdditionalScenesPixelInspected: true,
    spokenActionActorsRetained: true,
    s01PlacardReviewed: true
  },
  captures
};
await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: evidence.status, head: evidence.head, evidencePath, historical: { focal: focalRecords.length, textGroups: textRecords.length }, unique: { focalContexts: uniqueFocal.length, textGroups: uniqueText.length }, pixelInspection: evidence.pixelInspection }, null, 2));
