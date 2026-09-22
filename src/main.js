import { initialState, season, canChoose, applyEffect, resolveEnding } from './season-data.js';
import { SAVE_SCHEMA_VERSION, canHydrateCloud, createCloudSaveQueue, nextStateMetadata, promoteProvisionalState } from './save-state.js';
import { initYandexPlatform, bindBrowserPauseFallback } from './yandex-sdk.js';
import { s18Preview, s18SceneLocations } from './s18-preview-data.js';

const previewMode = new URLSearchParams(location.search).get('preview') === 's18';
const SAVE_KEY = 'kiss-at-the-edge-of-the-world:season-1:v4';
const LEGACY_SAVE_KEY = 'kiss-at-the-edge-of-the-world:season-1:v3';
const LEGACY_SAVE_KEY_V2 = 'kiss-at-the-edge-of-the-world:season-1:v2';
const localState = previewMode ? null : loadState();
const state = previewMode ? initialState({ provisional: true }) : (localState ?? initialState({ provisional: true }));
let platform = { mode: 'local-fallback', language: 'ru', save: async () => {}, showFullscreenAd: async () => false };
const cloudSaveQueue = previewMode ? null : createCloudSaveQueue(snapshot => platform.save(snapshot));
let cloudHydrated = false;
// Локальный прогресс не блокирует более свежую копию с другого устройства.
// Блокировка включается только сознательным New Game или первым действием
// поверх временного состояния.
let cloudLocked = false;
let resetInProgress = false;
const app = document.querySelector('#app');
let previewIndex = 0;
let previewChoice = null;

app.innerHTML = `
  <section class="game-shell" data-scene="season-1">
    <img id="scene-art" class="scene-art" src="/assets/backgrounds/keflavik-airport-arrivals-v1.png" alt="Зал выдачи багажа аэропорта Кефлавика" />
    <canvas id="scene-canvas" aria-hidden="true"></canvas>
    <div class="atmosphere" aria-hidden="true"></div>
    <div class="hud"><p id="episode-label" class="episode-label"></p><p id="location" class="location"></p></div>
    <section class="dialogue" aria-live="polite">
      <img id="portrait" class="portrait" src="/assets/characters/alice-master.png" alt="" />
      <div class="speaker-row"><span id="speaker" class="speaker"></span><span id="progress" class="progress"></span></div>
      <p id="scene-title" class="scene-title"></p><p id="text" class="dialogue-text"></p>
      <div id="actions" class="actions"></div>
      <button id="continue" class="continue" type="button">Продолжить <span aria-hidden="true">↵</span></button>
    </section>
    <p id="save-status" class="save-status" role="status"></p>
    <button id="menu-trigger" class="menu-trigger" type="button" aria-label="Открыть главное меню" title="Меню">☰ <span>Меню</span></button>
    <section id="game-menu" class="game-menu" role="dialog" aria-modal="true" aria-label="Главное меню" hidden>
      <div class="menu-cover" aria-hidden="true"></div>
      <div class="menu-card">
        <p class="menu-kicker">ИНТЕРАКТИВНЫЙ РОМАН · ИСЛАНДИЯ</p>
        <h1>Поцелуй<br/><em>на краю света</em></h1>
        <p class="menu-description">Три недели дорог. Три возможные истории любви. И решение, которое останется только твоим.</p>
        <p class="menu-build-status">Игровой прототип · прежняя краткая редакция сценария</p>
        <nav id="menu-main" class="menu-controls" aria-label="Действия игры">
          <button id="menu-continue" type="button" class="menu-primary">Начать историю</button>
          <button id="menu-new" type="button">Новая игра</button>
          <button id="menu-literary" type="button">Новый полный сезон · 10 эпизодов</button>
          <button id="menu-episodes" type="button">Эпизоды</button>
          <button id="menu-settings" type="button">Настройки чтения</button>
          <button id="menu-gallery" type="button">Галерея Исландии</button>
          <button id="menu-about" type="button">Об игре</button>
        </nav>
        <section id="menu-panel" class="menu-panel" aria-live="polite" hidden></section>
        <p id="menu-progress" class="menu-progress"></p>
        <p class="menu-footnote">Черновая игровая версия · не выпускать как готовый литературный сезон</p>
      </div>
    </section>
  </section>`;

const canvas = document.querySelector('#scene-canvas');
const ctx = canvas.getContext('2d');
const sceneArt = document.querySelector('#scene-art');
const portrait = document.querySelector('#portrait');
const dialogue = document.querySelector('.dialogue');
const episodeLabel = document.querySelector('#episode-label');
const locationNode = document.querySelector('#location');
const sceneTitle = document.querySelector('#scene-title');
const speakerNode = document.querySelector('#speaker');
const progressNode = document.querySelector('#progress');
const textNode = document.querySelector('#text');
const actionsNode = document.querySelector('#actions');
const continueButton = document.querySelector('#continue');
const saveStatus = document.querySelector('#save-status');
const gameMenu = document.querySelector('#game-menu');
const menuTrigger = document.querySelector('#menu-trigger');
const menuPanel = document.querySelector('#menu-panel');
const menuMain = document.querySelector('#menu-main');
const menuContinue = document.querySelector('#menu-continue');
const menuProgress = document.querySelector('#menu-progress');
const SETTINGS_KEY = 'kiss-at-the-edge-of-the-world:reader-settings:v1';
const defaultSettings = Object.freeze({ scale: 1, contrast: false, reducedMotion: false });
function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { scale: [0.9, 1, 1.12, 1.25].includes(value.scale) ? value.scale : 1,
      contrast: value.contrast === true, reducedMotion: value.reducedMotion === true };
  } catch { return { ...defaultSettings }; }
}
let readerSettings = previewMode ? { ...defaultSettings } : readSettings();
function applySettings() {
  document.documentElement.style.setProperty('--reader-scale', String(readerSettings.scale));
  document.body.classList.toggle('high-contrast', readerSettings.contrast);
  document.body.classList.toggle('reduced-motion', readerSettings.reducedMotion);
}
function setSettings(patch) {
  readerSettings = { ...readerSettings, ...patch };
  applySettings();
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(readerSettings)); } catch { /* private browsing */ }
}
function showPanel(title, draw) {
  menuMain.hidden = true;
  menuPanel.hidden = false;
  menuPanel.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = title; menuPanel.append(heading);
  draw(menuPanel);
  const back = document.createElement('button'); back.type = 'button'; back.textContent = '← Назад';
  back.className = 'menu-back'; back.addEventListener('click', () => { menuPanel.hidden = true; menuMain.hidden = false; menuContinue.focus(); });
  menuPanel.append(back);
}
function appendMenuButton(target, text, callback) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
  button.addEventListener('click', callback); target.append(button); return button;
}
function showEpisodes() {
  showPanel('Эпизоды текущего прототипа', panel => {
    const intro = document.createElement('p');
    intro.textContent = 'Текущая игровая сборка: старая редакция из 12 коротких эпизодов. Новый литературный сезон из 10 эпизодов доступен в основном меню игры. Старая редакция оставлена отдельно для совместимости сохранений.';
    panel.append(intro);
    const list = document.createElement('ol'); list.className = 'episode-list';
    for (let episode = 1; episode <= season.episodes; episode += 1) {
      const item = document.createElement('li');
      const reached = state.visitedEpisodes.includes(episode);
      const current = node().episode === episode;
      item.textContent = `Эпизод ${episode} · ${current ? 'вы читаете сейчас' : reached ? 'открыт' : 'пока не открыт'}`;
      if (!reached) item.className = 'locked';
      list.append(item);
    }
    panel.append(list);
    const note = document.createElement('p'); note.textContent = 'Пропуск эпизодов отключён: он нарушил бы последовательность решений и сохранённые отношения.'; panel.append(note);
  });
}
function showSettings() {
  showPanel('Настройки чтения', panel => {
    const update = () => {
      panel.querySelector('[data-setting="text"]').textContent = `Размер текста: ${Math.round(readerSettings.scale * 100)}%`;
      panel.querySelector('[data-setting="contrast"]').textContent = `Контрастность: ${readerSettings.contrast ? 'повышенная' : 'обычная'}`;
      panel.querySelector('[data-setting="motion"]').textContent = `Анимация: ${readerSettings.reducedMotion ? 'выключена' : 'системная'}`;
    };
    const size = appendMenuButton(panel, '', () => { const list = [0.9, 1, 1.12, 1.25]; setSettings({ scale: list[(list.indexOf(readerSettings.scale) + 1) % list.length] }); update(); }); size.dataset.setting = 'text';
    const contrast = appendMenuButton(panel, '', () => { setSettings({ contrast: !readerSettings.contrast }); update(); }); contrast.dataset.setting = 'contrast';
    const motion = appendMenuButton(panel, '', () => { setSettings({ reducedMotion: !readerSettings.reducedMotion }); update(); }); motion.dataset.setting = 'motion';
    update();
  });
}
const gallery = [
  ['Кефлавик', '/assets/backgrounds/keflavik-airport-arrivals-v1.png'],
  ['Рейкьявик', '/assets/backgrounds/reykjavik-harbour-master.png'],
  ['Þingvellir', '/assets/backgrounds/thingvellir-master.png'],
  ['Skógafoss', '/assets/backgrounds/skogafoss-master.png'],
  ['Восточные фьорды', '/assets/backgrounds/eastfjords-road-master.png'],
  ['Snæfellsnes', '/assets/backgrounds/snaefellsnes-master.png']
];
function showGallery() {
  showPanel('Галерея Исландии', panel => {
    const grid = document.createElement('div'); grid.className = 'gallery-grid';
    gallery.forEach(([title, image]) => {
      const card = document.createElement('figure');
      const img = document.createElement('img'); img.src = image; img.alt = title; img.loading = 'lazy';
      const caption = document.createElement('figcaption'); caption.textContent = title;
      card.append(img, caption); grid.append(card);
    });
    panel.append(grid);
  });
}
function showAbout() {
  showPanel('Об игре', panel => {
    const paragraphs = [
      'Алиса прилетает в Исландию, чтобы написать материал о путешествии. Неожиданная встреча с бывшим возлюбленным и новые знакомства меняют её планы.',
      'В игре представлены романтические направления Эрика, Ника и Дамира, а также самостоятельная линия Алисы.',
      'ВНИМАНИЕ: текущая игровая версия использует старый сокращённый сценарий из 12 эпизодов. Новая литературная редакция рассчитана на 10 эпизодов: написаны 1–10; он запускается из основного меню, а эта прежняя версия оставлена для совместимости сохранений. Не является релизной версией.',
      'Управление: кнопка «Продолжить» или клавиша Enter. Прогресс сохраняется локально и, при доступности Яндекс SDK, в облаке.'
    ];
    paragraphs.forEach(value => { const element = document.createElement('p'); element.textContent = value; panel.append(element); });
  });
}
let menuOpen = !previewMode;
function refreshMenu() {
  if (previewMode) return;
  const hasProgress = Boolean(localState) || !state.provisional || state.nodeId !== 'ep1-intro' || state.lineIndex > 0;
  menuContinue.textContent = hasProgress ? 'Продолжить историю' : 'Начать историю';
  const current = node();
  menuProgress.textContent = hasProgress ? `Сохранение: эпизод ${current.episode} · ${current.title}` : 'Новое прохождение · прогресс пока не создан';
}
function setMenuOpen(open) {
  if (previewMode) return;
  menuOpen = Boolean(open);
  gameMenu.hidden = !menuOpen;
  menuTrigger.tabIndex = menuOpen ? -1 : 0;
  dialogue.inert = menuOpen;
  dialogue.setAttribute('aria-hidden', String(menuOpen));
  menuTrigger.setAttribute('aria-expanded', String(menuOpen));
  if (menuOpen) { refreshMenu(); menuPanel.hidden = true; menuMain.hidden = false; menuContinue.focus(); }
  else { continueButton.focus(); }
}
menuTrigger.addEventListener('click', () => setMenuOpen(!menuOpen));
menuContinue.addEventListener('click', () => { if (state.provisional) ensureConsciousRun(); setMenuOpen(false); });
document.querySelector('#menu-new').addEventListener('click', () => {
  if (window.confirm('Начать новую историю? Текущий прогресс будет заменён.')) resetGame();
});
document.querySelector('#menu-literary').addEventListener('click', () => { window.location.href = './literary.html'; });
document.querySelector('#menu-episodes').addEventListener('click', showEpisodes);
document.querySelector('#menu-settings').addEventListener('click', showSettings);
document.querySelector('#menu-gallery').addEventListener('click', showGallery);
document.querySelector('#menu-about').addEventListener('click', showAbout);
applySettings();
if (previewMode) { menuTrigger.hidden = true; gameMenu.hidden = true; }
else { gameMenu.hidden = false; refreshMenu(); }


const portraitBySpeaker = {
  'Алиса': '/assets/characters/alice-master.png', 'Эрик': '/assets/characters/eric-master.png',
  'Ник': '/assets/characters/nick-master.png', 'Дамир': '/assets/characters/damir-master.png',
  'Редактор': '/assets/characters/alice-master.png', 'Хозяйка': '/assets/characters/alice-master.png',
  'Партнёр': '/assets/characters/alice-master.png', 'Система': '/assets/characters/alice-master.png'
};
const portraitVariantsByNode = {
  'ep1-intro': { 'Алиса': '/assets/characters/alice-reflective.png' },
  'ep5-drive': { 'Дамир': '/assets/characters/damir-vulnerable.png' },
  'ep8-eric': { 'Эрик': '/assets/characters/eric-tender.png' },
  'ep8-nick': { 'Ник': '/assets/characters/nick-serious.png' },
  'ep8-damir': { 'Дамир': '/assets/characters/damir-vulnerable.png' },
  'ep9-conflict': {
    'Эрик': '/assets/characters/eric-tender.png',
    'Ник': '/assets/characters/nick-serious.png',
    'Дамир': '/assets/characters/damir-vulnerable.png'
  },
  'ending-eric': { 'Эрик': '/assets/characters/eric-tender.png' },
  'ending-nick': { 'Ник': '/assets/characters/nick-serious.png' },
  'ending-damir': { 'Дамир': '/assets/characters/damir-vulnerable.png' },
  'ending-alice': { 'Алиса': '/assets/characters/alice-reflective.png' }
};

function node() { return season.nodes[state.nodeId] ?? season.nodes['ep1-intro']; }

function renderS18Preview() {
  const lines = previewChoice ? previewChoice.lines : s18Preview.lines;
  const line = lines[previewIndex];
  const isChoicePoint = !previewChoice && previewIndex === s18Preview.lines.length - 1;
  const scene = line?.scene ?? 'harbour-evening';
  episodeLabel.textContent = 'ВИЗУАЛЬНЫЙ SLICE · S18';
  locationNode.textContent = s18SceneLocations[scene] ?? s18SceneLocations['harbour-evening'];
  sceneTitle.textContent = s18Preview.title;
  speakerNode.textContent = line?.narration ? '' : line?.speaker || '';
  progressNode.textContent = `${previewIndex + 1} / ${lines.length}`;
  dialogue.classList.toggle('narration', Boolean(line?.narration));
  textNode.textContent = line?.text || '';
  portrait.hidden = Boolean(line?.narration);
  portrait.style.display = line?.narration ? 'none' : '';
  portrait.src = line?.speaker === 'Эрик' ? '/assets/characters/eric-tender.png' : '/assets/characters/alice-reflective.png';
  portrait.alt = line?.narration ? '' : `Портрет: ${line?.speaker}`;
  const isHarbour = scene === 'harbour-evening';
  document.querySelector('.game-shell').dataset.previewScene = scene;
  document.querySelector('.game-shell').dataset.previewVisual = line?.visual ?? 'walk';
  // The approved manuscript crosses to the next day. Never show a night-time
  // harbour picture behind morning breakfast or the guesthouse corridor.
  sceneArt.hidden = !isHarbour;
  sceneArt.src = line?.visual === 'dance' ? s18Preview.danceCg
    : line?.visual === 'romance' ? s18Preview.cg : s18Preview.background;
  sceneArt.alt = line?.visual === 'dance' ? 'Алиса и Эрик танцуют на набережной Höfn'
    : line?.visual === 'romance' ? 'Алиса и Эрик рядом у гавани Höfn'
    : isHarbour ? 'Вечерняя гавань Höfn' : '';
  actionsNode.replaceChildren();
  continueButton.hidden = isChoicePoint || previewIndex >= lines.length - 1;
  if (isChoicePoint) s18Preview.choices.forEach(choice => {
    const button = document.createElement('button');
    button.className = 'choice'; button.type = 'button'; button.textContent = choice.label;
    button.addEventListener('click', () => {
      previewChoice = choice; previewIndex = 0; renderS18Preview();
    });
    actionsNode.append(button);
  });
  if (previewChoice && previewIndex >= lines.length - 1) {
    const button = document.createElement('button');
    button.className = 'choice'; button.type = 'button'; button.textContent = 'Повторить S18';
    button.addEventListener('click', () => {
      previewChoice = null; previewIndex = 0; renderS18Preview();
    });
    actionsNode.append(button);
  }
  dialogue.scrollTop = 0;
}

function render() {
  const current = node();
  if (current.terminal && !current.ending) { state.nodeId = resolveEnding(state); state.lineIndex = 0; saveState(); return render(); }
  const line = current.lines[state.lineIndex] ?? current.lines[0] ?? { speaker: 'Алиса', text: '' };
  episodeLabel.textContent = `ЭПИЗОД ${current.episode} ИЗ ${season.episodes}`;
  locationNode.textContent = current.location; sceneTitle.textContent = current.title ?? '';
  speakerNode.textContent = line.narration ? '' : line.speaker; progressNode.textContent = `${state.lineIndex + 1} / ${current.lines.length}`;
  dialogue.classList.toggle('narration', Boolean(line.narration));
  textNode.textContent = line.text.replace(/\{\{careerThesis\}\}/g, thesisLabel(state.careerThesis)).replace(/\{\{careerConsequence\}\}/g, thesisConsequence(state.careerThesis)).replace(/\{\{ericRouteReflection\}\}/g, ericRouteReflection(state));
  portrait.hidden = Boolean(line.narration);
  portrait.style.display = line.narration ? 'none' : '';
  portrait.src = portraitVariantsByNode[state.nodeId]?.[line.speaker] ?? portraitBySpeaker[line.speaker] ?? portraitBySpeaker.Алиса;
  portrait.alt = line.narration || line.speaker === 'Система' ? '' : `Портрет: ${line.speaker}`;
  sceneArt.src = current.cg ?? current.background ?? '/assets/backgrounds/reykjavik-harbour-master.png';
  const atEnd = state.lineIndex >= current.lines.length - 1;
  continueButton.hidden = !(atEnd ? current.next : true);
  actionsNode.replaceChildren();
  if (atEnd && current.choices) current.choices.filter(choice => canChoose(choice, state)).forEach(choice => {
    const button = document.createElement('button'); button.className = 'choice'; button.type = 'button'; button.textContent = choice.label;
    button.addEventListener('click', () => choose(choice)); actionsNode.append(button);
  });
  if (current.ending) {
    continueButton.hidden = true;
    const button = document.createElement('button'); button.className = 'choice'; button.type = 'button'; button.textContent = 'Начать сезон заново';
    button.addEventListener('click', () => resetGame({ showAd: true })); actionsNode.append(button);
  }
  saveState();
}

function advance() {
  if (menuOpen) return;
  if (previewMode) { const max = previewChoice ? previewChoice.lines.length - 1 : s18Preview.lines.length - 1; if (previewIndex < max) previewIndex += 1; renderS18Preview(); return; }
  ensureConsciousRun();
  const current = node();
  if (state.lineIndex < current.lines.length - 1) state.lineIndex += 1;
  else if (current.next) { state.nodeId = current.next; state.lineIndex = 0; markEpisode(); }
  saveStatus.textContent = 'Сохранено'; saveState({ cloud: true, advance: true }); render();
}

function choose(choice) { ensureConsciousRun(); applyEffect(state, choice.effect); state.nodeId = choice.next; state.lineIndex = 0; markEpisode(); saveStatus.textContent = 'Выбор сохранён'; saveState({ cloud: true, advance: true }); render(); }
function markEpisode() { const episode = season.nodes[state.nodeId]?.episode; if (episode && !state.visitedEpisodes.includes(episode)) state.visitedEpisodes.push(episode); }
function ensureConsciousRun() {
  if (!state.provisional) return;
  Object.assign(state, promoteProvisionalState(state));
  cloudLocked = true;
  cloudSaveQueue.invalidate();
}
async function resetGame({ showAd = false } = {}) {
  if (showAd) await platform.showFullscreenAd?.();
  resetInProgress = true;
  cloudLocked = true;
  cloudSaveQueue.invalidate();
  Object.assign(state, initialState());
  localStorage.removeItem(LEGACY_SAVE_KEY);
  localStorage.removeItem(LEGACY_SAVE_KEY_V2);
  try { await saveState({ cloud: true }); } catch { /* local reset remains authoritative when SDK is unavailable */ }
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  window.location.reload();
}
function saveState({ cloud = false, advance = false } = {}) {
  if (state.provisional) return Promise.resolve({ skipped: true, reason: 'provisional' });
  if (advance) Object.assign(state, nextStateMetadata(state));
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  return cloud ? cloudSaveQueue.enqueue(state) : Promise.resolve();
}
function thesisLabel(thesis) {
  return ({ people: 'людях, которые решились на перемены', place: 'месте, которое меняет привычный взгляд', choice: 'выборе, за который человек отвечает сам' })[thesis] || 'людях и решениях, которые ещё нельзя назвать окончательными';
}
function thesisConsequence(thesis) {
  return ({ people: 'Редактор попросил продолжить серию портретов и дал Алисе контакт следующего героя.', place: 'Редактор предложил Алисе отдельную колонку о местах, которые меняют человека.', choice: 'Редактор оставил Алисе право вести авторскую серию без готового шаблона.' })[thesis] || 'Редактор попросил прислать следующий план после возвращения.';
}
function ericRouteReflection(currentState) {
  if (currentState.flags.includes('eric-kitchen-open')) return 'После пробного дома и супа мы договорились не прятать планы за словом «потом».';
  if (currentState.flags.includes('eric-kitchen-paused')) return 'После пробного дома и супа мы оставили друг другу тёплое место, но не стали выдавать его за готовое решение.';
  if (currentState.flags.includes('eric-conflict-open')) return 'Мы продолжили путь после паузы, но не сделали вид, что одного разговора достаточно.';
  return 'Эрик исправил свой маршрут делом: сначала спросил, потом показал, что именно меняет.';
}
function normalizeState(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const base = initialState();
  const normalized = { ...base, ...candidate, schemaVersion: SAVE_SCHEMA_VERSION };
  normalized.runId = candidate.runId || `legacy-${candidate.updatedAt || 0}`;
  normalized.runStartedAt = Number.isFinite(candidate.runStartedAt) ? candidate.runStartedAt : (candidate.updatedAt || 0);
  normalized.revision = Number.isInteger(candidate.revision) ? candidate.revision : 0;
  normalized.updatedAt = Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : normalized.runStartedAt;
  normalized.provisional = false;
  normalized.flags = Array.isArray(candidate.flags) ? [...new Set(candidate.flags)] : [];
  normalized.trust = { ...base.trust, ...(candidate.trust || {}) };
  if (normalized.routeIntent && normalized.routeIntent !== 'none' && !normalized.flags.includes(`route-${normalized.routeIntent}`)) normalized.flags.push(`route-${normalized.routeIntent}`);
  return normalized;
}
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY_V2);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch { return null; }
}
function stateProgressScore(candidate) {
  if (!candidate?.nodeId || !season.nodes[candidate.nodeId]) return -1;
  const episode = season.nodes[candidate.nodeId]?.episode ?? 0;
  const line = Number.isFinite(candidate.lineIndex) ? candidate.lineIndex : 0;
  const visited = Array.isArray(candidate.visitedEpisodes) ? candidate.visitedEpisodes.length : 0;
  return episode * 100000 + line * 100 + visited;
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.floor(innerWidth * ratio); canvas.height = Math.floor(innerHeight * ratio);
  canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.clearRect(0, 0, canvas.width, canvas.height);
}

continueButton.addEventListener('click', advance); window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !previewMode) { if (menuOpen) setMenuOpen(false); else setMenuOpen(true); return; } if (menuOpen || event.repeat || !['Enter', ' '].includes(event.key) || event.target.closest('button, input, select, textarea')) return; event.preventDefault(); advance(); });
['contextmenu', 'selectstart', 'dragstart'].forEach(type => document.addEventListener(type, event => { if (event.target.closest('canvas, .game-shell')) event.preventDefault(); }));

// Preview QA has an intentionally separate, read-only contract. In particular,
// reset()/setScenario() cannot write or expose the main game's save state.
const layoutSnapshot = () => ({ viewport: { width: innerWidth, height: innerHeight }, items: [
  { id: 'scene-canvas', scene: previewMode ? 's18-preview' : 'season-1', bounds: canvas.getBoundingClientRect().toJSON(), visible: true, active: true, critical: true, mustNotOverlap: false },
  { id: 'scene-art', scene: previewMode ? 's18-preview' : 'season-1', bounds: sceneArt.getBoundingClientRect().toJSON(), visible: !sceneArt.hidden, active: !sceneArt.hidden, critical: true, mustNotOverlap: false },
  { id: 'dialogue', scene: previewMode ? 's18-preview' : 'season-1', bounds: dialogue.getBoundingClientRect().toJSON(), visible: true, active: true, critical: true, mustNotOverlap: true, overlapGroup: 'dialogue' },
  { id: 'continue', scene: previewMode ? 's18-preview' : 'season-1', bounds: continueButton.getBoundingClientRect().toJSON(), visible: !continueButton.hidden, active: !continueButton.hidden, critical: true, mustNotOverlap: true, overlapGroup: 'dialogue' }
] });
if (previewMode) {
  window.__YG_QA__ = Object.freeze({
    getLayoutSnapshot: layoutSnapshot,
    getPreviewSnapshot: () => ({
      preview: true, branch: previewChoice?.id ?? null, index: previewIndex,
      length: (previewChoice ? previewChoice.lines : s18Preview.lines).length,
      scene: (previewChoice ? previewChoice.lines : s18Preview.lines)[previewIndex]?.scene ?? null,
      text: textNode.textContent, choices: [...actionsNode.querySelectorAll('button')].map(button => button.textContent)
    })
  });
} else {
  window.__YG_QA__ = {
    getLayoutSnapshot: layoutSnapshot,
    getState: () => structuredClone(state),
    getCurrentNode: () => ({ ...node(), choices: node().choices?.map(choice => ({ id: choice.id, label: choice.label, enabled: canChoose(choice, state) })) }),
    reset: resetGame,
    setScenario(route = 'alice') {
      Object.assign(state, initialState(), { routeIntent: route, nodeId: 'ep12-finale', lineIndex: 0, commitment: true, boundaries: 2, repairDebt: 0, flags: route === 'alice' ? ['conscious-solo'] : ['concrete-plan', `${route}-conflict-repaired`], trust: { eric: 3, nick: 3, damir: 3 } });
      saveState(); render();
    }
  };
}

resizeCanvas(); if (previewMode) renderS18Preview(); else { render(); setMenuOpen(true); }

const removeBrowserPauseFallback = previewMode ? () => {} : bindBrowserPauseFallback({
  onPause: () => { document.querySelector('.game-shell')?.setAttribute('data-paused', 'true'); },
  onResume: () => { document.querySelector('.game-shell')?.removeAttribute('data-paused'); }
});
if (!previewMode) initYandexPlatform({
  onLanguage: language => { window.__YG_QA__.platformLanguage = language || 'ru'; },
  onCloudState: cloudState => {
    const normalizedCloud = normalizeState(cloudState);
    if (resetInProgress || cloudLocked || cloudHydrated || !normalizedCloud || stateProgressScore(normalizedCloud) < 0) return;
    const shouldHydrate = canHydrateCloud(normalizedCloud, state);
    if (shouldHydrate) Object.assign(state, normalizedCloud);
    cloudHydrated = true;
    if (shouldHydrate) { saveState(); render(); refreshMenu(); }
  },
  onPause: () => { document.querySelector('.game-shell')?.setAttribute('data-paused', 'true'); },
  onResume: () => { document.querySelector('.game-shell')?.removeAttribute('data-paused'); }
}).then(nextPlatform => {
  platform = nextPlatform;
  window.__YG_QA__.platformMode = platform.mode;
  window.__YG_QA__.platformLanguage = platform.language || window.__YG_QA__.platformLanguage || 'ru';
}).catch(() => { window.__YG_QA__.platformMode = 'local-fallback'; });
if (!previewMode) window.addEventListener('beforeunload', () => { removeBrowserPauseFallback(); if (!resetInProgress) saveState({ cloud: true }); });
