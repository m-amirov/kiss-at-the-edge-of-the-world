import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cssPath = fileURLToPath(new URL('../../src/literary.css', import.meta.url));
const css = fs.readFileSync(cssPath, 'utf8');
const player = fs.readFileSync(fileURLToPath(new URL('../../src/literary-player.js', import.meta.url)), 'utf8');
const assetManifest = JSON.parse(fs.readFileSync(`${root}/assets/asset-manifest.json`, 'utf8'));

test('production literary UI bundles the approved Cinematic Romance fonts locally', () => {
  for (const file of ['assets/fonts/CormorantGaramond[wght].ttf', 'assets/fonts/Manrope[wght].ttf']) {
    const stat = fs.statSync(`${root}/${file}`);
    assert.ok(stat.size > 10000, `${file} must be a real bundled font`);
  }
  assert.match(css, /font-family:'Cinematic Cormorant'/);
  assert.match(css, /font-family:'Cinematic Manrope'/);
  assert.match(css, /url\('\.\.\/assets\/fonts\/CormorantGaramond\[wght\]\.ttf'\)/);
  assert.match(css, /url\('\.\.\/assets\/fonts\/Manrope\[wght\]\.ttf'\)/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(player, /const cover = '\.\.\/assets\/backgrounds\/snaefellsnes-master\.png'/);
  assert.doesNotMatch(player, /const cover = '\.\/assets\/backgrounds\/snaefellsnes-master\.png'/);
});

test('production literary UI preserves mobile reading and control invariants', () => {
  assert.match(css, /\.reader-content\{[^}]*overflow:auto/);
  assert.match(css, /\.reader-footer\{flex:0 0 auto\}/);
  assert.match(css, /\.choice-button\{[^}]*min-height:52px/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /orientation:landscape/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('Cinematic A mobile polish keeps artwork visible without a nested menu scroller', () => {
  assert.match(css, /\.literary-home::after\{[^}]*linear-gradient/);
  assert.match(css, /\.literary-home-card\{[^}]*overflow:visible/);
  assert.match(css, /\.literary-home-card \.chapter-list\{display:grid;grid-template-columns:repeat\(2/);
  assert.match(css, /\.scene-stage\[data-mode="group"\] \.stage-character\{width:36vw/);
  assert.match(css, /\.literary-reader:has\(\.literary-picture\.is-cg\) \.reader-sheet\{max-height:min\(35dvh,300px\)/);
});

test('ending screens use authored emotional headings instead of engine copy', () => {
  for (const heading of ['Дорога, которую выбирают вдвоём', 'Без чужого голоса', 'Начать заново — вместе', 'Свой следующий маршрут']) {
    assert.match(player, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(player, /Конец первого сезона|Это завершение выбранной истории|начать другое прохождение можно из меню/);
  assert.match(player, /sheet\.prepend\(el\(endingHeadings\[scene\.id\]/);
});

test('all production reader states use explicit fullscreen presentation modes', () => {
  assert.match(player, /app\.dataset\.presentation=modal\?`menu-/);
  assert.match(player, /function artMode\(scene, entry, choices, isEnding\)/);
  for (const mode of ['background','sprite-dialogue','choice','choice-cg','cg','ending']) {
    assert.match(css, new RegExp(`data-presentation[\\s\\S]{0,120}${mode}`));
  }
  assert.match(player, /focalPointByAsset/);
  assert.match(player, /picture\.style\.setProperty\('--focus'/);
});

test('fullscreen scene layers do not reintroduce a card shell or mobile overflow', () => {
  assert.match(css, /\.literary-reader\[data-presentation\][\s\S]*?\.reader-sheet/);
  assert.match(css, /data-presentation="choice"[\s\S]*?reader-content[\s\S]*?overflow:visible/);
  assert.match(css, /literary-picture:not\(\.is-cg\) > img/);
  assert.match(css, /object-fit: cover/);
});

test('every active production CG has an explicit portrait derivative mapping', () => {
  const active = ['s13-skaftafell-travelers','s18-hofn-dance-lights','s26-eric-choice','s44-eric-epilogue-month-later','s45-nick-home-epilogue-month-later','s45-reykjavik-warm-montage','s46-airport-goodbye','s46-damir-epilogue-month-later','s47-alice-home-epilogue-month-later','s47-reykjavik-harbour-alice'];
  for (const id of active) {
    const asset = assetManifest.assets.find(entry => entry.id === id);
    assert.ok(asset?.portraitAsset, `${id} needs an explicit portraitAsset`);
    assert.ok(fs.existsSync(`${root}/${asset.portraitAsset}`), `${id} portrait file must exist`);
    assert.match(player, new RegExp(`'${asset.path.split('/').pop()}'\\s*:`));
  }
});

test('legacy-only Myvatn background is not falsely reported as active literary runtime art', () => {
  const asset = assetManifest.assets.find(entry => entry.id === 'myvatn-pool-master');
  assert.equal(asset?.status, 'available-unassigned');
  assert.match(asset?.runtime ?? '', /Legacy src\/season-data\.js only/);
});
