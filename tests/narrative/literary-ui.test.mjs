import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cssPath = fileURLToPath(new URL('../../src/literary.css', import.meta.url));
const css = fs.readFileSync(cssPath, 'utf8');
const player = fs.readFileSync(fileURLToPath(new URL('../../src/literary-player.js', import.meta.url)), 'utf8');
const localization = fs.readFileSync(fileURLToPath(new URL('../../src/localization.js', import.meta.url)), 'utf8');
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
  assert.match(player, /const cover = runtimeAssetUrl\('branding\/kiss-at-the-edge-cover\.png'\)/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*?\.literary-home::before[\s\S]*?background-position:\s*18%\s*center/);
  assert.match(fs.readFileSync(fileURLToPath(new URL('../../literary.html', import.meta.url)), 'utf8'), /assets\/branding\/kiss-at-the-edge-icon\.png/);
});

test('production literary UI preserves mobile reading and control invariants', () => {
  assert.match(css, /\.reader-content\{[^}]*overflow:auto/);
  assert.match(css, /\.reader-footer\{flex:0 0 auto\}/);
  assert.match(css, /\.choice-button\{[^}]*min-height:52px/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /orientation:landscape/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('main menu keeps only the supported actions and has no retired panels or footer', () => {
  assert.match(player, /\['episodes',t\('episodes'\)\]/);
  assert.match(player, /t\('continueEpisode'/);
  assert.match(player, /button\(t\('newGame'\),startNew/);
  assert.doesNotMatch(player, /Галерея|Об игре|История доступна от начала до одного из четырёх финалов/);
  assert.doesNotMatch(player, /galleryPanel|literary-gallery/);
  assert.doesNotMatch(css, /literary-gallery/);
  assert.match(css, /\.home-actions-secondary \{ display: grid; grid-template-columns: repeat\(2/);
  assert.match(css, /\.home-actions-secondary \{ grid-template-columns: 1fr; \}/);
});

test('cloud restore is an explicitly separated utility action, not a primary menu CTA', () => {
  assert.match(player, /const utility=el\('','home-utility'\)/);
  assert.match(player, /'cloud-restore'\)/);
  assert.match(css, /\.home-utility\{[\s\S]*?border-top/);
  assert.match(css, /\.cloud-restore\{[\s\S]*?font-size:\.86em/);
});

test('background staging prioritizes readable key speakers over a group lineup', () => {
  assert.match(player, /stageCastForPresentation\(direction\)/);
  assert.match(player, /stage\.dataset\.layout=direction\.stageComposition/);
  assert.doesNotMatch(player, /direction\.cast\.length>2\?direction\.cast\.slice\(0,2\)/);
  assert.match(player, /cast:presentationCast,mode:presentationCast\.length>2\?'group':presentationCast\.length===2\?'pair':'solo'/);
  assert.match(player, /require three or four people/i);
  assert.match(css, /\.scene-stage\[data-mode="solo"\]\{inset:4% 10% 23%/);
  assert.match(css, /\.scene-stage\[data-mode="solo"\] \.stage-character\{width:72vw/);
  assert.match(css, /\.scene-stage\[data-mode="group"\]\[data-count="4"\]/);
});

test('narrative navigation is stage-first and retired text controls are absent', () => {
  assert.doesNotMatch(player, /Далее|К выбору|skip-to-choice/);
  assert.match(player, /bindStageNavigation\(picture\)/);
  assert.match(player, /bindStageTapTarget\(sheet\)/);
  assert.match(player, /picture\.dataset\.stageAdvance='true'/);
  assert.match(player, /picture\.setAttribute\('aria-label',t\('stageAdvanceAria'\)\)/);
  assert.match(player, /pointerdown/);
  assert.match(player, /pointerup/);
  assert.match(player, /picture\.addEventListener\('click'/);
  assert.match(player, /picture\.addEventListener\('keydown'/);
  assert.match(player, /event\.stopPropagation\(\)/);
  assert.match(player, /tapThreshold=10/);
  assert.match(player, /Math\.hypot\(event\.clientX-pointer\.x,event\.clientY-pointer\.y\)>tapThreshold/);
  assert.match(player, /interactiveSelector/);
  assert.match(player, /advanceNarrative\(\)/);
  assert.match(player, /\['Enter',' ','Spacebar','ArrowRight'\]/);
  assert.match(player, /isInteractiveTarget\(event\.target\)/);
  assert.match(css, /\.advance-cue\{/);
  assert.match(css, /\.literary-picture\[data-stage-advance\]:focus-visible/);
  assert.match(css, /\.choice-button::before\{/);
  assert.match(css, /\.choice-button::before\{[\s\S]*?border-right:2px solid[\s\S]*?border-bottom:2px solid[\s\S]*?rotate\(-45deg\)/);
  assert.match(css, /\.choice-button::after\{\s*content:none/);
  assert.doesNotMatch(css, /\.choice-button::(?:before|after)\{[^}]*content:\s*['"][^'"]+['"]/);
  assert.match(css, /\.choice-button\{[\s\S]*?min-height:56px/);
});

test('Cinematic A mobile polish keeps artwork visible without a nested menu scroller', () => {
  assert.match(css, /\.literary-home::after\{[^}]*linear-gradient/);
  assert.match(css, /\.literary-home-card\{[^}]*overflow:visible/);
  assert.match(css, /\.literary-home-card \.chapter-list\{display:grid;grid-template-columns:repeat\(2/);
  assert.match(css, /\.scene-stage\[data-mode="group"\] \.stage-character\{width:36vw/);
  assert.match(css, /\.literary-reader:has\(\.literary-picture\.is-cg\) \.reader-sheet\{max-height:min\(60dvh,460px\)/);
});

test('ending screens use authored emotional headings instead of engine copy', () => {
  for (const key of ['endingEric', 'endingNick', 'endingDamir', 'endingAlice']) {
    assert.match(player, new RegExp(`endingHeadings[\\s\\S]*${key}`));
    assert.match(localization, new RegExp(`${key}:`));
  }
  assert.doesNotMatch(player, /Конец первого сезона|Это завершение выбранной истории|начать другое прохождение можно из меню/);
  assert.match(player, /sheet\.prepend\(el\(t\(endingHeadings\[scene\.id\]\)/);
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

test('mobile cinematic presentation fills the viewport without empty bands', () => {
  assert.match(css, /\.literary-reader\[data-presentation\] \.literary-picture\.is-cg::before\{display:none!important\}/);
  assert.match(css, /object-fit:cover!important/);
  assert.doesNotMatch(css, /\.literary-reader\[data-presentation\][\s\S]*?object-fit:\s*contain/);
  assert.match(css, /\.literary-reader\[data-presentation\] \.literary-picture \{[^}]*z-index: 0/);
  assert.match(css, /\.literary-reader\[data-presentation\] \.reader-header\{background:transparent!important\}/);
});

test('every active production CG has an explicit portrait derivative mapping', () => {
  const active = ['s13-skaftafell-travelers','s18-hofn-dance-lights','s26-eric-choice','s44-eric-epilogue-month-later','s45-nick-home-epilogue-month-later','s45-reykjavik-warm-montage','s46-airport-goodbye','s46-damir-epilogue-month-later','s47-alice-home-epilogue-month-later','s47-reykjavik-harbour-alice'];
  for (const id of active) {
    const asset = assetManifest.assets.find(entry => entry.id === id);
    assert.ok(asset?.portraitAsset, `${id} needs an explicit portraitAsset`);
    assert.ok(fs.existsSync(`${root}/${asset.portraitAsset}`), `${id} portrait file must exist`);
    assert.match(player, new RegExp(`'${asset.runtimePath.split('/').pop()}'\\s*:`));
  }
});

test('legacy-only Myvatn background is not falsely reported as active literary runtime art', () => {
  const asset = assetManifest.assets.find(entry => entry.id === 'myvatn-pool-master');
  assert.equal(asset?.status, 'available-unassigned');
  assert.match(asset?.runtime ?? '', /Legacy src\/season-data\.js only/);
});
