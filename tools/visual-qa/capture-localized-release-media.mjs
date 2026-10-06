import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.RELEASE_MEDIA_PORT ?? 4174);
const baseUrl = `http://127.0.0.1:${port}/literary.html`;
const marketingDir = path.join(root, 'artifacts/marketing');
const evidenceDir = path.join(root, 'artifacts/evidence/release-media');
const playwright = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

const sha256 = async file => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const head = git(['rev-parse', 'HEAD']).stdout.trim();
if (git(['status', '--porcelain=v1', '--untracked-files=all']).stdout.trim()) throw new Error('Release media capture requires a clean source worktree.');

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 125));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

const server = spawn(process.execPath, ['tools/dev-server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true
});

try {
  await waitForServer();
  await fs.mkdir(marketingDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  const browser = await playwright.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const videos = [];
  try {
    for (const locale of ['ru', 'en']) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: evidenceDir, size: { width: 1920, height: 1080 } } });
      const page = await context.newPage();
      const video = page.video();
      await page.goto(`${baseUrl}?lang=${locale}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.__LITERARY_QA__ && document.querySelector('.literary-home')));
      const home = await page.evaluate(() => ({ locale: window.__LITERARY_QA__.getLocale(), ui: document.body.innerText }));
      if (home.locale !== locale) throw new Error(`Runtime locale mismatch: expected ${locale}, got ${home.locale}`);
      if (locale === 'ru' ? !home.ui.includes('Продолжить') : !home.ui.includes('Continue')) throw new Error(`Localized home UI is missing for ${locale}`);
      await page.getByRole('button', { name: locale === 'ru' ? /Продолжить/ : /Continue/ }).first().click();
      await page.locator('.reader-sheet').waitFor();
      const initial = await page.evaluate(() => ({ sceneId: window.__LITERARY_QA__.getScreen().sceneId, locale: window.__LITERARY_QA__.getLocale(), text: document.querySelector('.reader-content')?.innerText ?? '' }));
      if (initial.sceneId !== 'S01' || initial.locale !== locale) throw new Error(`Unexpected initial runtime state for ${locale}`);
      if (locale === 'ru' ? !/[\u0400-\u04ff]/u.test(initial.text) : /[\u0400-\u04ff]/u.test(initial.text)) throw new Error(`Narrative locale mismatch for ${locale}`);
      await page.screenshot({ path: path.join(evidenceDir, `release-media-${locale}-start.png`) });
      for (let second = 0; second < 21; second += 1) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
      }
      const final = await page.evaluate(() => ({ sceneId: window.__LITERARY_QA__.getScreen().sceneId, locale: window.__LITERARY_QA__.getLocale(), text: document.querySelector('.reader-content')?.innerText ?? '' }));
      if (final.locale !== locale || (locale === 'ru' ? !/[\u0400-\u04ff]/u.test(final.text) : /[\u0400-\u04ff]/u.test(final.text))) throw new Error(`Runtime locale changed during capture for ${locale}`);
      await page.screenshot({ path: path.join(evidenceDir, `release-media-${locale}-end.png`) });
      await context.close();
      const webm = await video.path();
      const output = path.join(marketingDir, `kiss-at-the-edge-of-the-world-${locale}.mp4`);
      const conversion = spawnSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { encoding: 'utf8' });
      if (conversion.status !== 0) throw new Error(`ffmpeg failed for ${locale}: ${conversion.stderr}`);
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', output], { encoding: 'utf8' });
      if (probe.status !== 0) throw new Error(`ffprobe failed for ${locale}: ${probe.stderr}`);
      const data = JSON.parse(probe.stdout);
      const stream = data.streams?.[0] ?? {};
      const stat = await fs.stat(output);
      videos.push({
        locale,
        path: path.relative(root, output).replaceAll('\\', '/'),
        dimensions: { width: Number(stream.width), height: Number(stream.height) },
        durationSeconds: Number(data.format?.duration),
        sizeBytes: stat.size,
        gameplayRatio: 1,
        sha256: await sha256(output),
        sourceHead: head,
        runtimeIdentity: { entrypoint: 'literary.html', sha256: await sha256(path.join(root, 'literary.html')) },
        capturedAt: new Date().toISOString(),
        viewport: { width: 1920, height: 1080, orientation: 'landscape' },
        capturedRuntimeState: { sceneId: initial.sceneId, uiLocale: locale },
        manualReview: {
          realGameplay: { status: 'NOT_REVIEWED', evidence: null },
          systemUiAbsent: { status: 'NOT_REVIEWED', evidence: null },
          yandexUiAbsent: { status: 'NOT_REVIEWED', evidence: null },
          artificialBlackBarsAbsent: { status: 'NOT_REVIEWED', evidence: null },
          localeMatchesDraft: { status: 'NOT_REVIEWED', evidence: null }
        }
      });
    }
  } finally { await browser.close(); }
  const evidence = { schemaVersion: 1, publicationType: 'first-publication', videos };
  await fs.writeFile(path.join(root, 'artifacts/evidence/final-gameplay-videos.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'CAPTURED_AWAITING_MANUAL_REVIEW', sourceHead: head, videos: videos.map(({ locale, path: videoPath, sha256: videoSha256 }) => ({ locale, path: videoPath, sha256: videoSha256 })) }, null, 2));
} finally {
  server.kill();
}
