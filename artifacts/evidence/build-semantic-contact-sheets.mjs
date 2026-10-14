import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const sharp = (await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs').href)).default;
const evidence = JSON.parse(fs.readFileSync('artifacts/evidence/independent-semantic-pixel-review-2026-10-08.json', 'utf8'));
const groups = [
  ['focal-representatives', evidence.captures.filter(item => item.request.kind === 'focal' && item.request.role === 'representative'), 4],
  ['focal-additional-mobile', evidence.captures.filter(item => item.request.kind === 'focal' && item.request.role === 'additional-mobile'), 4],
  ['text-group-representatives', evidence.captures.filter(item => item.request.kind === 'text-group' && item.request.role === 'representative'), 2],
  ['s01-sign', evidence.captures.filter(item => item.request.kind === 's01-sign'), 2]
];
for (const [name, items, columns] of groups) {
  const tileWidth = 280;
  const tileHeight = 390;
  const rows = Math.ceil(items.length / columns);
  const layers = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const image = await sharp(item.screenshot).resize({ width: tileWidth, height: tileHeight, fit: 'cover' }).png().toBuffer();
    const label = `${item.request.scene} ${item.request.route} p${item.request.position} ${item.request.viewport}`;
    const overlay = Buffer.from(`<svg width="${tileWidth}" height="34"><rect width="100%" height="100%" fill="#000" fill-opacity="0.72"/><text x="8" y="23" fill="white" font-size="16" font-family="Arial">${label}</text></svg>`);
    layers.push({ input: image, left, top });
    layers.push({ input: overlay, left, top: top + tileHeight - 34 });
  }
  await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: { r: 18, g: 22, b: 28 } } })
    .composite(layers)
    .png()
    .toFile(`output/playwright/independent-semantic-pixels/${name}.png`);
  console.log(`${name}: ${items.length} frames`);
}
