import { literarySeason } from './literary-season-data.js';
import { compileScenePlayback, nextLiteraryScene, literarySaveKey, cleanLiteraryText } from './literary-engine.js';
import { initYandexPlatform } from './yandex-sdk.js';
import { createCloudSaveQueue } from './save-state.js';
import { stageForScene } from './literary-stage.js';
import { visualAt, visualEntryForPosition } from './literary-visual-directions.js';
import { compileInteractivePlayback } from './literary-pacing.js';

const byId = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
const app = document.getElementById('literary-app');
const textSettingsKey = 'kiss-at-the-edge-of-the-world:literary-settings:v1';
const literaryCloudKey = 'kiss-at-the-edge-of-the-world:literary-season:v1';
const routeName = { A: 'Эрик', B: 'Ник', C: 'Дамир', D: 'Алиса' };
const stageAsset = { alice:'alice-stage.png', eric:'eric-stage.png', nick:'nick-stage.png', damir:'damir-stage.png' };
// This value is consumed by a url() inside src/literary.css; resolve from the
// stylesheet directory so the cover never becomes /src/assets/... at runtime.
const cover = '../assets/backgrounds/snaefellsnes-master.png';
const blank = () => ({ schemaVersion:3,sceneId:'S01',position:0,choices:{},finished:false, visited:['S01'],runId:`literary-${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, revision:0 });
function parseSaved(raw) {
  try {
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(![1,2,3].includes(s?.schemaVersion) || !byId.has(s.sceneId) || !Number.isInteger(s.position) || s.position<0 ||
       !s.choices || typeof s.choices!=='object' || Array.isArray(s.choices))return null;
    if(Object.entries(s.choices).some(([id,code])=> !/^S\d{2}-C\d+$/.test(id)|| !/^[A-D]$/.test(code)))return null;
    return { ...s, schemaVersion:3, position:s.schemaVersion<3?0:s.position,
      migrationNotice:s.schemaVersion<3, visited:Array.isArray(s.visited)?s.visited.filter(id=>byId.has(id)):[s.sceneId],revision:s.revision??0 };
  } catch { return null; }
}
function loadLocal(){try{const saved=localStorage.getItem(literarySaveKey);const parsed=parseSaved(saved);
  if(parsed?.migrationNotice){localStorage.setItem(`${literarySaveKey}:pre-visual-directions-backup`,saved);localStorage.setItem(literarySaveKey,JSON.stringify(parsed));}
  return parsed;}catch{return null}}
let reader=loadLocal()??blank();
let hasSave=Boolean(loadLocal());
let cloudLocked=false;
let cloudCandidate=null;
let menuOpen=true;
let modal=null;
let platform=null;
let cloudQueue=null;
let settings=(()=>{try{return{scale:1,contrast:false,motion:false,...JSON.parse(localStorage.getItem(textSettingsKey)||'{}')}}catch{return{scale:1,contrast:false,motion:false}}})();
function persist() {
  reader.revision=(reader.revision??0)+1;
  try {localStorage.setItem(literarySaveKey,JSON.stringify(reader));hasSave=true;}catch{}
  if(cloudQueue && platform?.mode==='yandex')cloudQueue.enqueue(reader).catch(()=>{});
}
function applySettings(){
  document.documentElement.style.setProperty('--literary-scale',String([.9,1,1.12,1.25].includes(settings.scale)?settings.scale:1));
  document.body.classList.toggle('literary-contrast',Boolean(settings.contrast));
  document.body.classList.toggle('literary-motionless',Boolean(settings.motion));
  try{localStorage.setItem(textSettingsKey,JSON.stringify(settings))}catch{}
}
function el(value='',className='',tag='div'){
  const node=document.createElement(tag); if(className)node.className=className; if(value)node.textContent=value;return node;
}
function button(label,handler,className=''){
  const b=el(label,className,'button');b.type='button';b.addEventListener('click',handler);return b;
}
function goHome(){menuOpen=true;modal=null;renderMenu()}
function startNew(){
  if(hasSave && !window.confirm('Начать новое прохождение? Текущий прогресс этой литературной редакции будет заменён.'))return;
  cloudLocked=true; reader=blank();persist();menuOpen=false;modal=null;renderReader();
}
function continueGame(){menuOpen=false;modal=null;renderReader()}
function panel(heading,children){
  modal=heading;const section=el('','home-panel');section.append(el(heading,'section-title','h2'));
  children(section);section.append(button('← К меню',()=>{modal=null;renderMenu()},'small-button'));
  return section;
}
function episodeSelection(section){
  section.append(el('Открываются по мере прохождения. При возвращении к прочитанной сцене ваши поздние решения будут сброшены, чтобы не смешивать разные варианты истории.','small-note'));
  const known=new Set(reader.visited||[]);
  for(let ep=1;ep<=literarySeason.episodes;ep++){
    const first=literarySeason.scenes.find(s=>s.episode===ep);
    const unlocked=literarySeason.scenes.some(s=>s.episode===ep&&known.has(s.id));
    const item=button(`Эпизод ${ep}${unlocked?' · открыт':' · пока не пройден'}`,()=>{
      if(!unlocked)return;
      if(!window.confirm(`Вернуться к началу эпизода ${ep}? Выборы, сделанные позже, будут сброшены.`))return;
      // A chapter replay from its first scene requires rebuilding later state;
      // using only the original choices from before this episode is safe.
      const epChoiceIds=literarySeason.scenes.filter(s=>s.episode>=ep).map(s=>s.id);
      for(const id of Object.keys(reader.choices)){
        if(epChoiceIds.some(prefix=>id.startsWith(prefix+'-')))delete reader.choices[id];
      }
      reader.sceneId=first.id;reader.position=0;reader.finished=false;reader.migrationNotice=false;reader.visited=reader.visited.filter(id=>byId.get(id).episode<ep);reader.visited.push(first.id);
      cloudLocked=true;persist();continueGame();
    },'episode-select');item.disabled=!unlocked;section.append(item);
  }
}
function settingsPanel(section){
  const size=button('',()=>{const scales=[.9,1,1.12,1.25];settings.scale=scales[(scales.indexOf(settings.scale)+1)%scales.length];applySettings();draw()},'setting-button');
  const contrast=button('',()=>{settings.contrast=!settings.contrast;applySettings();draw()},'setting-button');
  const motion=button('',()=>{settings.motion=!settings.motion;applySettings();draw()},'setting-button');
  function draw(){size.textContent=`Размер текста · ${Math.round(settings.scale*100)}%`;contrast.textContent=`Повышенная контрастность · ${settings.contrast?'да':'нет'}`;motion.textContent=`Анимация · ${settings.motion?'отключена':'системная'}`}
  draw();section.append(size,contrast,motion);
}
function galleryPanel(section){
  const images=[
    ['Кефлавик', 'backgrounds', 'keflavik-airport-arrivals-v1.png'],
    ['Рейкьявик', 'backgrounds', 'reykjavik-harbour-master.png'],
    ['Skógafoss', 'backgrounds', 'skogafoss-master.png'],
    ['Snæfellsnes', 'backgrounds', 'snaefellsnes-master.png'],
    ['Планирование маршрута', 'cg', 's02-expedition-planning-iceland.png'],
    ['Скафтафетль', 'cg', 's13-skaftafell-travelers.png'],
    ['Танец в Höfn', 'cg', 's18-hofn-dance-lights.png'],
    ['Монтаж Ника', 'cg', 's45-reykjavik-warm-montage.png'],
    ['Прощание Дамира', 'cg', 's46-airport-goodbye.png'],
    ['Финал Алисы', 'cg', 's47-reykjavik-harbour-alice.png']
  ];
  const gallery=el('','literary-gallery');
  for(const [name,folder,file] of images){
    const fig=el('','','figure');
    const img=el('','','img');
    img.src=`./assets/${folder}/${file}`;
    img.alt=name;
    img.loading='lazy';
    fig.append(img,el(name,'','figcaption'));
    gallery.append(fig);
  }
  section.append(gallery);
}
function renderMenu(){
  menuOpen=true;app.className='literary-home';app.style.setProperty('--cover',`url('${cover}')`);app.replaceChildren();
  const section=el('','literary-home-card');app.append(section);
  section.append(el('РОМАНТИЧЕСКАЯ ИСТОРИЯ · ИСЛАНДИЯ','kicker'),el('Поцелуй на краю света','home-title','h1'));
  if(modal){const draw={Эпизоды:episodeSelection,Настройки:settingsPanel,Галерея:galleryPanel}[modal];section.append(panel(modal,draw??(x=>x.append(el('Четыре самостоятельных исхода: Эрик, Ник, Дамир и Алиса. Прогресс этой редакции сохраняется отдельно от прежней короткой версии.','home-summary')))));return;}
  section.append(el('Три недели дороги. Три возможные истории любви. И возможность выбрать себя.','home-summary'));
  const actions=el('','home-actions');
  if(hasSave)actions.append(button(`Продолжить · эпизод ${byId.get(reader.sceneId).episode}`,continueGame,'primary'));
  actions.append(button('Новая игра',startNew,'primary'));
  for(const name of ['Эпизоды','Настройки','Галерея','Об игре'])actions.append(button(name,()=>{modal=name;renderMenu()}));
  section.append(actions);
  section.append(el('История доступна от начала до одного из четырёх финалов. Финальная редакторская и платформенная приёмка ещё не пройдена.','small-note'));
  if(cloudCandidate)section.append(button('Восстановить облачный прогресс',()=>{if(!window.confirm('Заменить текущее локальное сохранение облачным?'))return;cloudLocked=true;reader=cloudCandidate;cloudCandidate=null;persist();continueGame()}));
  const chapters=el('','chapter-list');chapters.append(el('ДЕСЯТЬ ЭПИЗОДОВ','chapter-heading','h2'));
  for(let ep=1;ep<=10;ep++){const visited=(reader.visited||[]).some(id=>byId.get(id)?.episode===ep);chapters.append(el(`${String(ep).padStart(2,'0')} · ${visited?'открыт':'впереди'}`,visited?'':'planned'))}
  section.append(chapters);
}
function renderStage(direction) {
  const stage=el('','scene-stage');
  stage.dataset.count=String(direction.cast.length);
  stage.dataset.mode=direction.mode;
  stage.dataset.mood=direction.mood;
  direction.cast.forEach((person,index)=>{
    const figure=el('',`stage-character stage-${person}`);
    figure.dataset.mood=direction.mood;
    figure.style.setProperty('--stage-index',index);
    const image=el('','','img');
    image.src=`./assets/characters/${stageAsset[person]}`;
    image.alt='';image.decoding='async';
    figure.append(image);stage.append(figure);
  });
  return stage;
}
function renderReader(){
  if(menuOpen)return renderMenu();
  const scene=byId.get(reader.sceneId);if(!scene){goHome();return}
  const flow=compileInteractivePlayback(scene,reader.choices);reader.position=Math.min(reader.position,flow.at(-1)?.type==='choice'?Math.max(0,flow.length-1):flow.length);
  app.className='literary-reader';app.replaceChildren();
  const current=flow[reader.position];
  const visualEntry=visualEntryForPosition(flow,reader.position);
  const direction=visualAt(scene.id,visualEntry,reader.choices,stageForScene(scene.id,reader.choices).cast);
  const art=direction.art;
  const picture=el('','literary-picture');picture.setAttribute('aria-hidden','true');
  picture.dataset.visualBeat=direction.beatId;picture.dataset.location=direction.location;picture.dataset.time=direction.time;
  if(art){const img=el('','','img');img.src=`./assets/${art.type==='cg'?'cg':'backgrounds'}/${art.file}`;img.alt='';img.decoding='async';picture.append(img);if(art.type==='cg'){picture.classList.add('is-cg');picture.style.setProperty('--cg-url',`url("${img.src}")`)}}
  else picture.classList.add('no-art');
  if(art?.type!=='cg') picture.append(renderStage({...direction,mode:direction.cast.length>2?'group':direction.cast.length===2?'pair':'solo',mood:stageForScene(scene.id,reader.choices).mood}));
  picture.append(el('','literary-vignette'));app.append(picture);
  const header=el('','reader-header');header.append(button('☰ Меню',goHome,'small-button'),el(`ЭПИЗОД ${scene.episode} / 10 · ${scene.id}`,'chapter-index'),el('ПОЦЕЛУЙ НА КРАЮ СВЕТА','draft-indicator'));app.append(header);
  const sheet=el('','reader-sheet');sheet.append(el(cleanLiteraryText(scene.title),'reader-scene','h2'));
  if(reader.migrationNotice){sheet.append(el('После обновления визуальных переходов продолжение начинается с начала текущей сцены. Прежний прогресс и выборы сохранены.','migration-note'));reader.migrationNotice=false;persist();}
  if(current?.type==='page'){
    const content=el('','reader-content');
    for(const paragraph of current.paragraphs)content.append(el(cleanLiteraryText(paragraph),'reader-paragraph','p'));
    sheet.append(content);
    const footer=el('','reader-footer');
    footer.append(el(`${reader.position+1} / ${flow.length}`,'page-counter'));
    const nextDecision=flow.findIndex((entry,index)=>index>reader.position+1 && entry.type==='choice');
    if(nextDecision>=0)footer.append(button('К выбору ⇢',()=>{reader.position=nextDecision;persist();renderReader()},'skip-to-choice'));
    footer.append(button('Далее →',()=>{reader.position++;persist();renderReader()},'primary'));
    sheet.append(footer);
  } else if(current?.type==='choice'){
    const content=el('','reader-content');
    content.append(el('ТВОЙ ВЫБОР','choice-label'));
    if(current.question)content.append(el(current.question,'decision-question','p'));
    const options=el('','reader-options');
    for(const opt of current.options)options.append(button(cleanLiteraryText(opt.label),()=>{reader.choices[current.id]=opt.code;persist();renderReader()},'choice-button'));
    content.append(options);
    sheet.append(content);
  }else{
    const next=nextLiteraryScene(reader.sceneId,reader.choices);
    if(next && byId.has(next))sheet.append(button(`Следующая сцена → ${next}`,()=>{reader.sceneId=next;reader.position=0;if(!reader.visited.includes(next))reader.visited.push(next);persist();renderReader()},'primary'));
    else if(['S44','S45','S46','S47'].includes(scene.id)){
      if(!reader.finished){reader.finished=true;persist()}
      const content=el('','reader-content');
      content.append(el('Конец первого сезона. Это завершение выбранной истории; начать другое прохождение можно из меню.','reader-paragraph'));
      sheet.append(content);
      sheet.append(button('Вернуться в меню',goHome,'primary'));
    }else{sheet.append(el('Следующая сцена недоступна: ошибка структуры сценария.','reader-paragraph'));sheet.append(button('В меню',goHome,'primary'))}
  }
  app.append(sheet);
}
window.addEventListener('keydown',event=>{
  if(menuOpen || !['Enter',' ','ArrowRight'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || ['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  const actions=app.querySelectorAll('.reader-footer button, .reader-sheet > button.primary');
  if(actions.length===1){event.preventDefault();actions[0].click()}
});
applySettings();renderMenu();
// Versioned cloud key: never interpret old 12-episode progression as new literary scenes.
// A late cloud response cannot overwrite deliberate new-game actions or a local save.
const bootHadLocal=hasSave;
initYandexPlatform({cloudKey:literaryCloudKey,onCloudState:raw=>{
  const candidate=parseSaved(raw);
  if(!candidate || cloudLocked)return;
  if(bootHadLocal || hasSave){cloudCandidate=candidate; if(menuOpen)renderMenu();return}
  reader=candidate;hasSave=true;
  try{localStorage.setItem(literarySaveKey,JSON.stringify(reader))}catch{}
  if(menuOpen)renderMenu();
}}).then(result=>{
  platform=result;
  if(platform.mode==='yandex'){
    cloudQueue=createCloudSaveQueue(snapshot=>platform.save(snapshot));
    // Explicit new-game reset may have happened while SDK was initializing.
    if(cloudLocked)cloudQueue.enqueue(reader).catch(()=>{});
  }
});
window.__LITERARY_QA__={
  getState:()=>structuredClone(reader),
  getFlow:()=>compileInteractivePlayback(byId.get(reader.sceneId),reader.choices),
  getScenes:()=>literarySeason.scenes.map(s=>s.id),
  getScreen:()=>({menuOpen,sceneId:reader.sceneId,position:reader.position}),
  // QA methods are strictly read-only; preview and the old game have separate state keys.
};
