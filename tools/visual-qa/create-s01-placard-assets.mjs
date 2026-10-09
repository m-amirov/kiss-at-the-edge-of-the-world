import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);

const [wideSource, portraitSource, outputDir] = process.argv.slice(2);
if (!wideSource || !portraitSource || !outputDir) {
  throw new Error('usage: node create-s01-placard-assets.mjs <wide-source> <portrait-source> <output-dir>');
}

const root = path.resolve(outputDir);
await fs.mkdir(root, { recursive: true });

const toDataUri = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
const wide = await toDataUri(wideSource);
const portrait = await toDataUri(portraitSource);

const variants = [
  {
    locale: 'ru',
    first: 'АЛИСА,',
    second: 'ЖУРНАЛИСТ',
    wide: { width: 1672, height: 941, x: 825, y: 348, rotate: -7, size: 28, smear: [858, 918, 386] },
    portrait: { width: 940, height: 1672, x: 520, y: 565, rotate: -13, size: 23, smear: [558, 600, 598] },
  },
  {
    locale: 'en',
    first: 'ALICE,',
    second: 'JOURNALIST',
    wide: { width: 1672, height: 941, x: 825, y: 348, rotate: -7, size: 28, smear: [858, 918, 386] },
    portrait: { width: 940, height: 1672, x: 520, y: 565, rotate: -13, size: 23, smear: [558, 600, 598] },
  },
];

const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const svgFor = ({ source, width, height, x, y, rotate, size, smear, first, second }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><filter id="ink-cloud"><feGaussianBlur stdDeviation="6"/></filter></defs>
  <image href="${source}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>
  <g transform="rotate(${rotate} ${x} ${y})" text-anchor="middle" font-family="Segoe Print, Comic Sans MS, cursive" font-weight="700" font-size="${size}" letter-spacing="1.5" fill="#34241c" stroke="#34241c" stroke-width="1.2" stroke-linejoin="round" opacity="0.96">
    <text x="${x}" y="${y}" dy="0">${esc(first)}</text>
    <text x="${x}" y="${y + size + 10}">${esc(second)}</text>
  </g>
  <g transform="rotate(${rotate + 0.8} ${x + 1} ${y + 1})" text-anchor="middle" font-family="Segoe Print, Comic Sans MS, cursive" font-weight="700" font-size="${size}" letter-spacing="1.5" fill="none" stroke="#6e4937" stroke-width="0.8" opacity="0.24">
    <text x="${x + 1}" y="${y + 1}">${esc(first)}</text>
    <text x="${x + 1}" y="${y + size + 11}">${esc(second)}</text>
  </g>
  <g transform="rotate(${rotate} ${x} ${y})" opacity="0.76">
    <ellipse cx="${(smear[0] + smear[1]) / 2}" cy="${smear[2]}" rx="${(smear[1] - smear[0]) / 2}" ry="${Math.max(14, size * 0.62)}" fill="#969696" opacity="0.62" filter="url(#ink-cloud)"/>
    <path d="M ${smear[0]} ${smear[2]} C ${smear[0] + 14} ${smear[2] - 6}, ${smear[1] - 15} ${smear[2] + 6}, ${smear[1]} ${smear[2]}" fill="none" stroke="#777777" stroke-width="${Math.max(16, size * 0.7)}" stroke-linecap="round" opacity="0.68" filter="url(#ink-cloud)"/>
    <path d="M ${smear[0] + 7} ${smear[2] + 8} C ${smear[0] + 25} ${smear[2] + 1}, ${smear[1] - 17} ${smear[2] + 10}, ${smear[1] - 2} ${smear[2] + 4}" fill="none" stroke="#656565" stroke-width="${Math.max(6, size * 0.27)}" stroke-linecap="round" opacity="0.78"/>
  </g>
</svg>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const variant of variants) {
    for (const format of ['wide', 'portrait']) {
      const spec = variant[format];
      const source = format === 'wide' ? wide : portrait;
      await page.setContent(svgFor({ source, ...spec, first: variant.first, second: variant.second }));
      await page.locator('svg').screenshot({ path: path.join(root, `s01-nick-arrives-placard-${variant.locale}${format === 'portrait' ? '-portrait' : ''}.png`) });
    }
  }
} finally {
  await browser.close();
}
