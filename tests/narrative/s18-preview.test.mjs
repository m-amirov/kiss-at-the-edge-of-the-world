import assert from 'node:assert/strict';
import fs from 'node:fs';
import { s18Preview, visibleS18Paragraphs, s18SceneLocations } from '../../src/s18-preview-data.js';

const literary = fs.readFileSync('content/season-1-literary-episode-05.md', 'utf8').replace(/\r\n/g, '\n');
const start = literary.indexOf('## S18.');
const end = literary.indexOf('##### Переход S18', start);
assert.ok(start >= 0 && end > start, 'approved S18 must exist in the manuscript');
const sourceS18 = literary.slice(start, end);
assert.equal(s18Preview.literaryText.replace(/\r\n/g, '\n').trimEnd(), sourceS18.trimEnd());
assert.deepEqual(s18Preview.choices.map(choice => choice.id), ['kiss', 'stay', 'leave']);

const section = (startTag, endTag) => {
  const a = sourceS18.indexOf(startTag);
  const b = endTag ? sourceS18.indexOf(endTag, a + startTag.length) : sourceS18.length;
  assert.ok(a >= 0 && b > a, `missing literary section: ${startTag}`);
  return sourceS18.slice(a, b);
};
const normalize = text => text.replace(/\s+/g, ' ').trim();
const paragraphs = text => text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !p.startsWith('#') && !p.startsWith('**Технический') && !p.startsWith('**Место/'));
const intro = section('Эрик ждал', '#### Выбор S18-C1');
const common = section('##### Общее продолжение S18', '**Технический переход');
const rawBranches = [
  section('##### A. Поцеловать Эрика', '##### B. Остаться рядом'),
  section('##### B. Остаться рядом', '##### C. Попросить закончить'),
  section('##### C. Попросить закончить', '##### Общее продолжение S18')
];
const responses = [
  section('##### S18-K', '##### S18-S'),
  section('##### S18-S', '##### S18-L'),
  section('##### S18-L')
];

assert.equal(s18Preview.lines.filter(line => line.text.includes('Алиса поставила крышку на ограждение')).length, 1, 'pre-choice paragraph must never be duplicated');
for (const [i, choice] of s18Preview.choices.entries()) {
  const expected = normalize([...paragraphs(intro), ...paragraphs(rawBranches[i]), ...paragraphs(common), ...paragraphs(responses[i])].join(' '));
  const shown = normalize(visibleS18Paragraphs(choice.id).join(' '));
  assert.equal(shown, expected, `all approved literary words, in order, must be visible on ${choice.id} path`);
  assert.ok(choice.lines.some(line => line.text.startsWith('Утром десятого дня') && line.scene === 'guesthouse-morning'));
  assert.ok(choice.lines.some(line => line.text.startsWith('Завтрак они ели') && line.scene === 'guesthouse-morning'));
  assert.ok(choice.lines.some(line => line.text.startsWith('Перед сном десятого дня') && line.scene === 'corridor-night'));
  assert.ok(choice.lines.some(line => line.scene === 'street-morning'));
  assert.ok(choice.lines.some(line => line.scene === 'town-day'));
  assert.equal(choice.lines.at(-1).scene, 'corridor-night');
}
assert.ok(s18Preview.lines.some(line => line.text.includes('Хотя последние годы') && line.text.startsWith('— Домой,') && line.speaker === 'Эрик'));
assert.ok(s18Preview.lines.some(line => line.text.includes('Уже минут двадцать не могу') && line.text.startsWith('— Я хотел написать сестре') && line.speaker === 'Эрик'));
assert.ok(s18Preview.choices[0].lines.some(line => line.text.includes('Только не как пункт маршрута') && line.speaker === 'Алиса'));
assert.ok(s18Preview.choices[1].lines.some(line => line.text.includes('Поцелуй пока не нужен') && line.speaker === 'Алиса'));
assert.ok(s18Preview.lines.some(line => line.text.includes('Ты умеешь петь') && line.speaker === 'Алиса'));
assert.ok(s18Preview.lines.some(line => line.text.includes('Я просто не стесняюсь этой песни') && line.speaker === 'Эрик'));
assert.ok(s18Preview.lines.some(line => line.visual === 'dance'));
for (const line of [...s18Preview.lines, ...s18Preview.choices.flatMap(choice => choice.lines)]) {
  assert.ok(s18SceneLocations[line.scene], `unknown S18 visual state: ${line.scene}`);
}

const main = fs.readFileSync('src/main.js', 'utf8');
assert.match(main, /const localState = previewMode \? null : loadState\(\)/);
assert.match(main, /if \(!previewMode\) initYandexPlatform/);
assert.match(main, /if \(!previewMode\) window\.addEventListener\('beforeunload'/);
assert.match(main, /if \(previewMode\) \{\s*window\.__YG_QA__ = Object\.freeze\(/);
assert.match(main, /sceneArt\.hidden = !isHarbour/);
console.log('s18-preview: PASS (full text fidelity x3, scene transitions, preview QA isolation)');
