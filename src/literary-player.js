import { literarySeason } from './literary-season-data.js';
import { compileScenePlayback, nextLiteraryScene, literarySaveKey, cleanLiteraryText } from './literary-engine.js';
import { createCloudSaveQueue } from './save-state.js';
import { stageForScene } from './literary-stage.js';
import { visualAt, visualEntryForPosition } from './literary-visual-directions.js';
import { compileInteractivePlayback } from './literary-pacing.js';
import { applyLiteraryLocale, createTranslator, validateLiteraryInteractionLocale } from './localization.js';
import { literaryLocaleBundles } from './literary-localization-bundle.js';
import { interactionBeats } from './literary-interactive-beats.js';
import { createDialogueHistory } from './literary-history.js';
import { createAudioDirector } from './audio-director.js';
import { musicCues, musicCueForScene } from './music-cues.js';
import { createPlatformLifecycleController } from './platform/lifecycle.js';
import { createImagePreloader, createVisualLayerController } from './literary-media.js';

export async function startLiteraryPlayer({ initPlatform, audioBaseUrl } = {}) {
if(typeof initPlatform!=='function')throw new TypeError('initPlatform is required');
const canonicalById = new Map(literarySeason.scenes.map(scene => [scene.id, scene]));
let runtimeSeason = literarySeason;
let byId = canonicalById;
const app = document.getElementById('literary-app');
const textSettingsKey = 'kiss-at-the-edge-of-the-world:literary-settings:v1';
const literaryCloudKey = 'kiss-at-the-edge-of-the-world:literary-season:v1';
const routeName = { A: 'routeEric', B: 'routeNick', C: 'routeDamir', D: 'routeAlice' };
const endingHeadings = {
  S44: 'endingEric',
  S45: 'endingNick',
  S46: 'endingDamir',
  S47: 'endingAlice'
};
// Presentation-only focal points. Values are percentages of the source image;
// the authored visual event remains the source of truth for which asset shows.
  const focalPointByAsset = {
    's02-roadside-cafe.webp': '50% 48%',
    's13-skaftafell-travelers.webp': '50% 42%',
    's18-hofn-dance-lights.webp': '50% 44%',
    's18-hofn-lighthouse.webp': '50% 42%',
    's18-hofn-lighthouse-portrait.webp': '50% 54%',
    's18-hofn-harbour.webp': '90% 50%',
    's26-eric-choice.webp': '50% 40%',
    's26-route-choice-courtyard-final.webp': '50% 42%',
    's26-route-choice-courtyard-final-portrait.webp': '50% 50%',
  's23-eric-harbor-plan.webp': '50% 42%',
  's24-nick-pier-consent.webp': '50% 42%',
  's25-damir-clarity-talk.webp': '50% 42%',
  's26-nick-choice.webp': '50% 42%',
  's26-damir-choice.webp': '50% 42%',
  's26-alice-choice.webp': '50% 42%',
  's27-egilsstadir-boardwalk-portrait.webp': '50% 72%',
  's49-reykjahlid-window-dance-portrait.webp': '50% 35%',
  's29-nick-playback.webp': '50% 42%',
  's52-glove-found.webp': '50% 38%',
  's44-eric-epilogue-month-later.webp': '50% 48%',
  's45-nick-home-epilogue-month-later.webp': '50% 45%',
  's46-damir-epilogue-month-later.webp': '50% 44%',
    's47-alice-home-epilogue-month-later.webp': '67% 44%'
    ,'s03-editor-call.webp':'50% 34%'
    ,'s03-editor-call-portrait.webp':'50% 31%'
  };
const portraitAssetByDesktopAsset = {
  's06-hveragerdi-eric-alice.webp':'s06-hveragerdi-eric-alice-portrait.webp',
  's07-kitchen-pasta.webp':'s07-kitchen-pasta-portrait.webp',
  's07-kitchen-cards.webp':'s07-kitchen-cards-portrait.webp',
  's08-guesthouse-strap.webp':'s08-guesthouse-strap-portrait.webp',
  's05-hveragerdi-road.webp':'s05-hveragerdi-road-portrait.webp',
  's66-hveragerdi-greenhouse.webp':'s66-hveragerdi-greenhouse-portrait.webp',
  's13-skaftafell-travelers.webp':'s13-skaftafell-travelers-portrait.webp',
  's18-hofn-dance-lights.webp':'s18-hofn-dance-lights-portrait.webp',
  's26-eric-choice.webp':'s26-eric-choice-portrait.webp',
  's23-eric-harbor-plan.webp':'s23-eric-harbor-plan-portrait.webp',
  's24-nick-pier-consent.webp':'s24-nick-pier-consent-portrait.webp',
  's25-damir-clarity-talk.webp':'s25-damir-clarity-talk-portrait.webp',
  's26-nick-choice.webp':'s26-nick-choice-portrait.webp',
  's26-damir-choice.webp':'s26-damir-choice-portrait.webp',
  's26-alice-choice.webp':'s26-alice-choice-portrait.webp',
  's45-reykjavik-warm-montage.webp':'s45-reykjavik-warm-montage-portrait.webp',
  's46-airport-goodbye.webp':'s46-airport-goodbye-portrait.webp',
  's47-reykjavik-harbour-alice.webp':'s47-reykjavik-harbour-alice-portrait.webp',
  's44-eric-epilogue-month-later.webp':'s44-eric-epilogue-month-later-portrait.webp',
  's45-nick-home-epilogue-month-later.webp':'s45-nick-home-epilogue-month-later-portrait.webp',
  's46-damir-epilogue-month-later.webp':'s46-damir-epilogue-month-later-portrait.webp',
  's47-alice-home-epilogue-month-later.webp':'s47-alice-home-epilogue-month-later-portrait.webp',
  's10-vik-road-song.webp':'s10-vik-road-song-portrait.webp',
  's12-vik-cafe-damir.webp':'s12-vik-cafe-damir-portrait.webp',
  's14-skaftafell-pace.webp':'s14-skaftafell-pace-portrait.webp',
  's16-guesthouse-help.webp':'s16-guesthouse-help-portrait.webp',
  's16-kitchen-soup.webp':'s16-kitchen-soup-portrait.webp'
  ,'s17-hofn-guesthouse.webp':'s17-hofn-guesthouse-portrait.webp'
  ,'s19-hofn-pool.webp':'s19-hofn-pool-portrait.webp'
  ,'s20-hofn-damir-kitchen.webp':'s20-hofn-damir-kitchen-portrait.webp'
  ,'s21-alice-hofn-room.webp':'s21-alice-hofn-room-portrait.webp'
  ,'s61-hofn-streets.webp':'s61-hofn-streets-portrait.webp'
  ,'s27-egilsstadir-boardwalk.webp':'s27-egilsstadir-boardwalk-portrait.webp'
  ,'s28-hverfjall-hood.webp':'s28-hverfjall-hood-portrait.webp'
  ,'s49-reykjahlid-window-dance.webp':'s49-reykjahlid-window-dance-portrait.webp'
  ,'s29-nick-playback.webp':'s29-nick-playback-portrait.webp'
  ,'s52-glove-found.webp':'s52-glove-found-portrait.webp'
  ,'s30-damir-sleeve-promise.webp':'s30-damir-sleeve-promise-portrait.webp'
  ,'s55-shum-first-step.webp':'s55-shum-first-step-portrait.webp'
  ,'s31-alice-independent-evening.webp':'s31-alice-independent-evening-portrait.webp'
  ,'s62-alice-bookstore-choice.webp':'s62-alice-bookstore-choice-portrait.webp'
  ,'s32-eric-calendar-crossroads.webp':'s32-eric-calendar-crossroads-portrait.webp'
  ,'s33-nick-teaser-reveal.webp':'s33-nick-teaser-reveal-portrait.webp'
  ,'s53-nick-no-camera-pool.webp':'s53-nick-no-camera-pool-portrait.webp'
  ,'s34-cancelled-evening.webp':'s34-cancelled-evening-portrait.webp'
  ,'s56-cafe-musicians.webp':'s56-cafe-musicians-portrait.webp'
  ,'s63-alice-solo-concert.webp':'s63-alice-solo-concert-portrait.webp'
  ,'s37-eric-alice-cafe.webp':'s37-eric-alice-cafe-portrait.webp'
  ,'s03-editor-call-damir.webp':'s03-editor-call-damir-portrait.webp'
  ,'s18-hofn-breakfast-group.webp':'s18-hofn-breakfast-group-portrait.webp'
  ,'s38-alice-nick-ordinary-day.webp':'s38-alice-nick-ordinary-day-portrait.webp'
  ,'s54-alice-nick-karaoke.webp':'s54-alice-nick-karaoke-portrait.webp'
  ,'s39-alice-damir-cafe.webp':'s39-alice-damir-cafe-portrait.webp'
  ,'s40-alice-laptop-window.webp':'s40-alice-laptop-window-portrait.webp'
  ,'s64-alice-snaefellsnes-trail.webp':'s64-alice-snaefellsnes-trail-portrait.webp'
  ,'s26-eastfjords-courtyard-group.webp':'s26-eastfjords-courtyard-group-portrait.webp'
  ,'s48-guesthouse-exit-group.webp':'s48-guesthouse-exit-group-portrait.webp'
  ,'s18-hofn-harbour.webp':'s18-hofn-harbour-portrait.webp'
  ,'s18-hofn-lighthouse.webp':'s18-hofn-lighthouse-portrait.webp'
  ,'s26-power-outage-notebook.webp':'s26-power-outage-notebook-portrait.webp'
  ,'s44-eric-morning-harbour.webp':'s44-eric-morning-harbour-portrait.webp'
  ,'s46-airport-bus.webp':'s46-airport-bus-portrait.webp'
  ,'s42-harbour-cafe.webp':'s42-harbour-cafe-portrait.webp'
  ,'s01-airport-outside-batch2.webp':'s01-airport-outside-batch2-portrait.webp'
  ,'s01-damir-arrives-batch2.webp':'s01-damir-arrives-batch2-portrait.webp'
  ,'s48-last-breakfast-batch2.webp':'s48-last-breakfast-batch2-portrait.webp'
  ,'s26-route-choice-courtyard-batch2.webp':'s26-route-choice-courtyard-batch2-portrait.webp'
  ,'s26-route-choice-courtyard-final.webp':'s26-route-choice-courtyard-final-portrait.webp'
  ,'s02-van-group-batch2.webp':'s02-van-group-batch2-portrait.webp'
  ,'s02-roadside-cafe-group.webp':'s02-roadside-cafe-group-portrait.webp'
  ,'s03-editor-call.webp':'s03-editor-call-portrait.webp'
  ,'s60-souvenir-kitchen-batch2.webp':'s60-souvenir-kitchen-batch2-portrait.webp'
  ,'s65-locked-kitchen-hallway.webp':'s65-locked-kitchen-hallway-portrait.webp'
  ,'s65-locked-kitchen-keys.webp':'s65-locked-kitchen-keys-portrait.webp'
};
 function assetFileForViewport(art,selectedLocale=locale){
  const portrait=window.matchMedia?.('(max-width: 680px) and (orientation: portrait)').matches;
  const desktopFile=art.localeFiles?.[selectedLocale]??art.file;
  if(!portrait)return desktopFile;
  return art.localePortraitFiles?.[selectedLocale]??portraitAssetByDesktopAsset[desktopFile]??desktopFile;
}
const stageAsset = { alice:'alice-stage.webp', eric:'eric-stage.webp', nick:'nick-stage.webp', damir:'damir-stage.webp' };
// This value is consumed by a url() inside src/literary.css; resolve from the
// stylesheet directory so the cover never becomes /src/assets/... at runtime.
const cover = '../assets/branding/menu-hero.webp';
const blank = () => ({ schemaVersion:3,sceneId:'S01',position:0,choices:{},finished:false, visited:['S01'],runId:`literary-${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, revision:0 });
function parseSaved(raw) {
  try {
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(![1,2,3].includes(s?.schemaVersion) || !canonicalById.has(s.sceneId) || !Number.isInteger(s.position) || s.position<0 ||
       !s.choices || typeof s.choices!=='object' || Array.isArray(s.choices))return null;
    if(Object.entries(s.choices).some(([id,code])=> !/^S\d{2}-C\d+$/.test(id)|| !/^[A-D]$/.test(code)))return null;
    return { ...s, schemaVersion:3, position:s.schemaVersion<3?0:s.position,
      migrationNotice:s.schemaVersion<3, visited:Array.isArray(s.visited)?s.visited.filter(id=>canonicalById.has(id)):[s.sceneId],revision:s.revision??0 };
  } catch { return null; }
}
function loadLocal(){try{const saved=localStorage.getItem(literarySaveKey);const parsed=parseSaved(saved);
  if(parsed?.migrationNotice){localStorage.setItem(`${literarySaveKey}:pre-visual-directions-backup`,saved);localStorage.setItem(literarySaveKey,JSON.stringify(parsed));}
  return parsed;}catch{return null}}
let reader=loadLocal()??blank();
const dialogueHistory=createDialogueHistory();
let hasSave=Boolean(loadLocal());
let cloudLocked=false;
let cloudCandidate=null;
let menuOpen=true;
let modal=null;
let platform=null;
let locale='ru';
let t=createTranslator(locale);
let cloudQueue=null;
const audioDirector=createAudioDirector({audioBaseUrl});
const imagePreloader=createImagePreloader();
const visualLayers=createVisualLayerController({root:app,preload:imagePreloader.preload});
const audioCueById=new Map(musicCues.map(cue=>[cue.cueId,{...cue,file:`${cue.cueId}.ogg`} ]));
const menuAudioCue=audioCueById.get('main-theme');
let lifecycle=null;
let settings=(()=>{try{return{scale:1,contrast:false,motion:false,...JSON.parse(localStorage.getItem(textSettingsKey)||'{}')}}catch{return{scale:1,contrast:false,motion:false}}})();
function gameplayShouldBeActive(){return !menuOpen && !lifecycle?.isPaused()}
lifecycle=createPlatformLifecycleController({
  app,
  document,
  setGameplayActive:active=>platform?.setGameplayActive(active),
  isGameplayActive:()=>!menuOpen,
  onPause:()=>{audioDirector.pause()},
  onResume:()=>{audioDirector.resume().catch(()=>{})}
});
function loadRuntimeSeason(selectedLocale,qaLocaleOverride){
  if(selectedLocale==='ru')return literarySeason;
  const localeData=literaryLocaleBundles[selectedLocale];
  if(!localeData)throw Error(`BLOCKED_EN_CORPUS_INCOMPLETE: missing locale bundle ${selectedLocale}`);
  const firstMissingSceneIndex=literarySeason.scenes.findIndex(scene=>!localeData.scenes?.[scene.id]);
  const sceneIds=qaLocaleOverride==='en'
    ?literarySeason.scenes.slice(0,firstMissingSceneIndex<0?literarySeason.scenes.length:firstMissingSceneIndex).map(scene=>scene.id)
    :literarySeason.scenes.map(scene=>scene.id);
  if(qaLocaleOverride==='en' && !sceneIds.length)throw Error('BLOCKED_EN_CORPUS_INCOMPLETE: no contiguous localized scenes');
  const scopedScenes=Object.fromEntries(sceneIds.map(id=>[id,localeData.scenes?.[id]]).filter(([,scene])=>scene));
  const scopedBeats=Object.fromEntries(sceneIds.map(id=>[id,localeData.interactionBeats?.[id]]).filter(([,beats])=>beats));
  const scopedEchoes=Object.fromEntries(Object.entries(localeData.interactionEchoes??{}).filter(([id])=>sceneIds.includes(id)));
  const boundedData=qaLocaleOverride==='en'?{...localeData,scenes:scopedScenes,interactionBeats:scopedBeats,interactionEchoes:scopedEchoes}:localeData;
  const interactionSceneIds=sceneIds.filter(id=>Object.prototype.hasOwnProperty.call(interactionBeats,id));
  const interactionReport=validateLiteraryInteractionLocale(interactionBeats,boundedData,{sceneIds:interactionSceneIds});
  if(interactionReport.status!=='PASS')throw Error('BLOCKED_EN_CORPUS_INCOMPLETE: '+interactionReport.errors.join('; '));
  return applyLiteraryLocale(literarySeason,boundedData,{sceneIds});
}
function persist() {
  reader.revision=(reader.revision??0)+1;
  try {localStorage.setItem(literarySaveKey,JSON.stringify(reader));hasSave=true;}catch{}
  if(cloudQueue && (platform?.mode==='yandex'||platform?.mode==='vk-games'))cloudQueue.enqueue(reader).catch(()=>{});
}
function recordDialogueState(){dialogueHistory.record(reader)}
function rollbackNarrative(){
  const previous=dialogueHistory.rollback();
  if(!previous)return false;
  reader={...previous,revision:reader.revision,runId:reader.runId};
  cloudQueue?.invalidate();
  renderReader();
  return true;
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
const interactiveSelector='button,a,input,select,textarea,summary,[role="button"],[role="link"],[contenteditable="true"],[data-interactive]';
const tapThreshold=10;
let lastPointerActivationAt=0;
let lastStageInput='none';
function isInteractiveTarget(target){return target instanceof Element && Boolean(target.closest(interactiveSelector));}
function advanceNarrative(){
  if(menuOpen || lifecycle.isPaused())return false;
  const scene=byId.get(reader.sceneId);if(!scene)return false;
  const flow=compileInteractivePlayback(scene,reader.choices,locale);
  const current=flow[reader.position];
  if(current?.type==='choice')return false;
  if(current?.type==='page'){
    recordDialogueState();
    reader.position=Math.min(reader.position+1,flow.length);
  }else{
    const next=nextLiteraryScene(reader.sceneId,reader.choices);
    if(!next || !byId.has(next))return false;
    recordDialogueState();
    reader.sceneId=next;reader.position=0;
    if(!reader.visited.includes(next))reader.visited.push(next);
    const crossedEpisode=byId.get(next)?.episode!==scene.episode;
    persist();renderReader();
    if(crossedEpisode&&platform?.mode==='vk-games')platform.showInterstitial({atBoundary:true}).catch(error=>console.warn('[platform] interstitial unavailable',error));
    return true;
  }
  persist();renderReader();return true;
}
function activateStage(event){
  if(isInteractiveTarget(event.target))return false;
  const now=performance.now();
  // Debounce only rapid pointer taps and the synthetic click that follows a
  // pointerup. Keyboard and a later independent click remain responsive.
  if(event.type==='pointerup'){
    if(lastStageInput==='pointer' && now-lastPointerActivationAt<180)return false;
  }else if(event.type==='click' && lastStageInput==='pointer' && now-lastPointerActivationAt<180)return false;
  else if(event.type==='keydown')lastStageInput='keyboard';
  const advanced=advanceNarrative();
  if(event.type==='pointerup' && advanced){
    lastPointerActivationAt=now;
    lastStageInput='pointer';
  }
  return advanced;
}
function bindStageNavigation(picture){
  picture.tabIndex=0;
  picture.dataset.stageAdvance='true';
  picture.setAttribute('role','group');
  picture.setAttribute('aria-label',t('stageAdvanceAria'));
  let pointer=null;
  let suppressClickUntil=0;
  picture.addEventListener('pointerdown',event=>{
    if(event.button!==0 || isInteractiveTarget(event.target))return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  picture.addEventListener('pointerup',event=>{
    if(!pointer || pointer.id!==event.pointerId || isInteractiveTarget(event.target)){pointer=null;return;}
    const moved=Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>tapThreshold;
    pointer=null;
    if(moved){suppressClickUntil=performance.now()+300;return;}
    activateStage(event);
  });
  picture.addEventListener('pointercancel',()=>{pointer=null});
  picture.addEventListener('click',event=>{
    // Pointer activation above already handles ordinary taps/clicks. This
    // fallback keeps keyboard-generated clicks and assistive-tech activation
    // safe without allowing a pointerup + click pair to advance twice.
    if(performance.now()<suppressClickUntil)return;
    activateStage(event);
  });
  picture.addEventListener('keydown',event=>{
    if(!['Enter',' ','Spacebar','ArrowRight'].includes(event.key))return;
    event.stopPropagation();
    event.preventDefault();
    activateStage(event);
  });
}
function bindStageTapTarget(node){
  let pointer=null;
  let suppressClickUntil=0;
  node.addEventListener('pointerdown',event=>{
    if(event.button!==0 || isInteractiveTarget(event.target))return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  node.addEventListener('pointerup',event=>{
    if(!pointer || pointer.id!==event.pointerId || isInteractiveTarget(event.target)){pointer=null;return;}
    const moved=Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>tapThreshold;
    pointer=null;
    if(moved){suppressClickUntil=performance.now()+300;return;}
    activateStage(event);
  });
  node.addEventListener('pointercancel',()=>{pointer=null});
  node.addEventListener('click',event=>{
    if(performance.now()<suppressClickUntil)return;
    activateStage(event);
  });
}
function goHome(){menuOpen=true;modal=null;renderMenu()}
function startNew(){
  if(hasSave && !window.confirm(t('confirmNew')))return;
  cloudLocked=true;dialogueHistory.clear();reader=blank();persist();menuOpen=false;modal=null;renderReader();
}
function continueGame(){menuOpen=false;modal=null;renderReader()}
function panel(headingKey,children){
  modal=headingKey;const section=el('','home-panel');section.append(el(t(headingKey),'section-title','h2'));
  children(section);section.append(button(t('backMenu'),()=>{modal=null;renderMenu()},'small-button'));
  return section;
}
function episodeSelection(section){
  section.append(el(t('episodesDescription'),'small-note'));
  const known=new Set(reader.visited||[]);
  const episodes=[...new Set(runtimeSeason.scenes.map(scene=>scene.episode))].sort((a,b)=>a-b);
  for(const ep of episodes){
    const first=runtimeSeason.scenes.find(s=>s.episode===ep);
    const unlocked=runtimeSeason.scenes.some(s=>s.episode===ep&&known.has(s.id));
    const item=button(t(unlocked?'episodeUnlocked':'episodeLocked',{episode:ep}),()=>{
      if(!unlocked)return;
      if(!window.confirm(t('episodeReplayConfirm',{episode:ep})))return;
      // A chapter replay from its first scene requires rebuilding later state;
      // using only the original choices from before this episode is safe.
      const epChoiceIds=literarySeason.scenes.filter(s=>s.episode>=ep).map(s=>s.id);
      for(const id of Object.keys(reader.choices)){
        if(epChoiceIds.some(prefix=>id.startsWith(prefix+'-')))delete reader.choices[id];
      }
      dialogueHistory.clear();reader.sceneId=first.id;reader.position=0;reader.finished=false;reader.migrationNotice=false;reader.visited=reader.visited.filter(id=>byId.get(id).episode<ep);reader.visited.push(first.id);
      cloudLocked=true;persist();continueGame();
    },'episode-select');item.disabled=!unlocked;section.append(item);
  }
}
function settingsPanel(section){
  const size=button('',()=>{const scales=[.9,1,1.12,1.25];settings.scale=scales[(scales.indexOf(settings.scale)+1)%scales.length];applySettings();draw()},'setting-button');
  const contrast=button('',()=>{settings.contrast=!settings.contrast;applySettings();draw()},'setting-button');
  const motion=button('',()=>{settings.motion=!settings.motion;applySettings();draw()},'setting-button');
  const audioMute=button('',()=>{audioDirector.setMuted(!audioDirector.getState().muted);draw()},'setting-button');
  const audioVolume=document.createElement('input');audioVolume.type='range';audioVolume.min='0';audioVolume.max='1';audioVolume.step='0.05';audioVolume.className='setting-volume';audioVolume.addEventListener('input',()=>audioDirector.setVolume(audioVolume.value));
  function draw(){const audio=audioDirector.getState();size.textContent=t('textSize',{percent:Math.round(settings.scale*100)});contrast.textContent=t('contrast',{state:t(settings.contrast?'contrastOn':'contrastOff')});motion.textContent=t('motion',{state:t(settings.motion?'motionOff':'motionSystem')});audioMute.textContent=`${locale==='ru'?'Музыка':'Music'}: ${audio.muted?(locale==='ru'?'выкл.':'off'):(locale==='ru'?'вкл.':'on')}`;audioVolume.value=String(audio.volume)}
  draw();section.append(size,contrast,motion,audioMute,audioVolume);
}
function renderMenu(){
  visualLayers.clear();
  platform?.setGameplayActive(false);
  // Preserve the main theme across menu/settings/episodes navigation.
  // Re-rendering menu UI must not pause or restart the audio stream.
  audioDirector.setCue(menuAudioCue);
  if(!lifecycle.isPaused())audioDirector.resume().catch(()=>{});
  menuOpen=true;app.className='literary-home';app.dataset.presentation=modal?`menu-${modal.toLowerCase()}`:'menu-home';app.style.setProperty('--cover',`url('${cover}')`);app.replaceChildren();
  const section=el('','literary-home-card');app.append(section);
  section.append(el(t('menuKicker'),'kicker'),el(t('gameTitle'),'home-title','h1'));
  if(modal){const draw={episodes:episodeSelection,settings:settingsPanel}[modal];section.append(panel(modal,draw??(x=>x.append(el(t('standaloneSummary',{eric:t(routeName.A),nick:t(routeName.B),damir:t(routeName.C),alice:t(routeName.D)}),'home-summary')))));return;}
  section.append(el(t('menuSummary'),'home-summary'));
  const actions=el('','home-actions');
  if(hasSave)actions.append(button(t('continueEpisode',{episode:byId.get(reader.sceneId).episode}),continueGame,'primary'));
  actions.append(button(t('newGame'),startNew,hasSave?'':'primary'));
  const secondary=el('','home-actions-secondary');
  for(const [name,label] of [['episodes',t('episodes')],['settings',t('settings')]])secondary.append(button(label,()=>{modal=name;renderMenu()}));
  actions.append(secondary);
  section.append(actions);
  if(cloudCandidate)section.append(button(t('restoreCloud'),()=>{if(!window.confirm(t('restoreCloudConfirm')))return;cloudLocked=true;dialogueHistory.clear();reader=cloudCandidate;cloudCandidate=null;persist();continueGame()}));
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
function artMode(scene, entry, choices, isEnding) {
  const direction=visualAt(scene.id,entry,choices,stageForScene(scene.id,choices).cast);
  if (entry?.type==='choice') return direction.art?.type==='cg'?'choice-cg':'choice';
  if (isEnding && entry?.type!=='page') return 'ending';
  if (isEnding && entry?.type==='page' && entry===null) return 'ending';
  if (direction.art?.type==='cg') return 'cg';
  if (direction.art?.type==='background') return 'background';
  return direction.cast?.length ? 'sprite-dialogue' : 'background';
}
function renderReader(){
  if(menuOpen)return renderMenu();
  platform?.setGameplayActive(gameplayShouldBeActive());
  const scene=byId.get(reader.sceneId);if(!scene){goHome();return}
  audioDirector.setCue(audioCueById.get(musicCueForScene(scene.id)));
  if(!lifecycle.isPaused())audioDirector.resume().catch(()=>{});
  const flow=compileInteractivePlayback(scene,reader.choices,locale);reader.position=Math.min(reader.position,flow.at(-1)?.type==='choice'?Math.max(0,flow.length-1):flow.length);
  const isEnding=['S44','S45','S46','S47'].includes(scene.id);
  const mode=artMode(scene,flow[reader.position],reader.choices,isEnding);
  app.className='literary-reader';app.dataset.presentation=mode;
  // Replace only the text/controls. Never detach an unchanged visual frame:
  // doing so restarts sprite entrance animations and flashes the background.
  for(const child of [...app.children])if(!child.classList.contains('literary-picture'))child.remove();
  const current=flow[reader.position];
  const visualEntry=visualEntryForPosition(flow,reader.position);
  const direction=visualAt(scene.id,visualEntry,reader.choices,stageForScene(scene.id,reader.choices).cast);
  const art=direction.art;
  const stageMode=direction.cast.length>2?'group':direction.cast.length===2?'pair':'solo';
  const stageMood=stageForScene(scene.id,reader.choices).mood;
  const file=art?assetFileForViewport(art,locale):null;
  const assetUrl=art?`./assets/${art.type==='cg'?'cg':'backgrounds'}/${file}`:null;
  const showSprites=art?.presentation!=='cinematic';
  const visualKey=JSON.stringify([assetUrl,art?.presentation??null,showSprites?direction.cast:[],showSprites?stageMode:null,showSprites?stageMood:null,art?.type]);
  const assets=[...(assetUrl?[assetUrl]:[]),...(showSprites?direction.cast.map(person=>`./assets/characters/${stageAsset[person]}`):[])];
  function annotatePicture(picture){
    picture.dataset.presentation=mode;
    picture.dataset.visualBeat=direction.beatId;
    picture.dataset.location=direction.location;
    picture.dataset.time=direction.time;
  }
  function buildPicture(){
    const picture=el('','literary-picture');picture.setAttribute('aria-hidden','true');
    picture.dataset.presentation=mode;
    picture.dataset.mode=art?.presentation??(art?.type==='cg'?'cinematic':'environment');
    annotatePicture(picture);
    if(art){
      const img=el('','','img');
      img.src=assetUrl;img.alt='';img.decoding='async';img.dataset.desktopAsset=art.file;img.dataset.asset=file;
      img.addEventListener('error',()=>{picture.dataset.assetError=file},{once:true});
      picture.append(img);
      picture.style.setProperty('--focus',focalPointByAsset[file]??focalPointByAsset[art.file]??'50% 50%');
      if(art.type==='cg'){picture.classList.add('is-cg');picture.style.setProperty('--cg-url',`url("${img.src}")`)}
    } else picture.classList.add('no-art');
    if(showSprites)picture.append(renderStage({...direction,mode:stageMode,mood:stageMood}));
    picture.append(el('','literary-vignette'));
    bindStageNavigation(picture);
    return picture;
  }
  visualLayers.present({key:visualKey,assets,build:buildPicture,onReuse:annotatePicture});
  // Preheat the next distinct visual beat, instead of fetching it during a tap.
  // Limit to a single upcoming image; the LRU bounds memory on mobile.
  let prefetchUrl=null;
  for(let position=reader.position+1;position<flow.length;position++){
    const future=visualAt(scene.id,visualEntryForPosition(flow,position),reader.choices,stageForScene(scene.id,reader.choices).cast).art;
    if(!future)continue;
    const nextFile=assetFileForViewport(future,locale);
    const nextUrl=`./assets/${future.type==='cg'?'cg':'backgrounds'}/${nextFile}`;
    if(nextUrl!==assetUrl){prefetchUrl=nextUrl;break}
  }
  if(!prefetchUrl){
    const nextId=nextLiteraryScene(scene.id,reader.choices);
    const nextScene=byId.get(nextId);
    if(nextScene){
      const nextFlow=compileInteractivePlayback(nextScene,reader.choices,locale);
      const nextDirection=visualAt(nextId,visualEntryForPosition(nextFlow,0),reader.choices,stageForScene(nextId,reader.choices).cast);
      if(nextDirection.art){
        const nextFile=assetFileForViewport(nextDirection.art,locale);
        const nextUrl=`./assets/${nextDirection.art.type==='cg'?'cg':'backgrounds'}/${nextFile}`;
        if(nextUrl!==assetUrl)prefetchUrl=nextUrl;
      }
    }
  }
  if(prefetchUrl)imagePreloader.preload(prefetchUrl);
  const header=el('','reader-header');
  const back=button(locale==='ru'?'Назад':'Back',rollbackNarrative,'small-button dialogue-back');back.disabled=!dialogueHistory.canRollback();
  header.append(button('☰ '+t('menu'),goHome,'small-button'),back,el(t('episode')+` ${scene.episode} / 10`,'chapter-index'),el(t('readerHeaderTitle'),'draft-indicator'));
  header.setAttribute('aria-label',t('sceneAria',{title:scene.title,episode:scene.episode}));
  app.append(header);
  const sheet=el('','reader-sheet');
  if(!isEnding)sheet.setAttribute('aria-label',cleanLiteraryText(scene.title));
  if(reader.migrationNotice){sheet.append(el(t('migrationNotice'),'migration-note'));reader.migrationNotice=false;persist();}
  if(current?.type==='page'){
    const content=el('','reader-content');
    for(const paragraph of current.paragraphs)content.append(el(cleanLiteraryText(paragraph),'reader-paragraph','p'));
    sheet.append(content);
    const footer=el('','reader-footer');
    footer.append(el(`${reader.position+1} / ${flow.length}`,'page-counter'));
    footer.append(el('','advance-cue','span'));
    sheet.append(footer);
  } else if(current?.type==='choice'){
    const content=el('','reader-content');
    content.append(el(t('yourChoice'),'choice-label'));
    if(current.question)content.append(el(current.question,'decision-question','p'));
    const options=el('','reader-options');
    for(const opt of current.options)options.append(button(cleanLiteraryText(opt.label),()=>{lastStageInput='none';lastPointerActivationAt=0;recordDialogueState();reader.choices[current.id]=opt.code;persist();renderReader()},'choice-button'));
    content.append(options);
    sheet.append(content);
  }else{
    const next=nextLiteraryScene(reader.sceneId,reader.choices);
    if(next && byId.has(next))sheet.append(button(t('nextScene',{scene:next}),()=>{lastStageInput='none';lastPointerActivationAt=0;advanceNarrative()},'primary'));
    else if(isEnding){
      if(!reader.finished){reader.finished=true;persist()}
      sheet.classList.add('terminal-sheet');
      sheet.append(button(t('returnMenu'),goHome,'primary'));
      sheet.prepend(el(t(endingHeadings[scene.id]),'reader-scene','h2'));
    }else{sheet.append(el(t('structuralError'),'reader-paragraph'));sheet.append(button(t('returnMenu'),goHome,'primary'))}
  }
  bindStageTapTarget(sheet);
  app.append(sheet);
}
window.addEventListener('keydown',event=>{
  if(menuOpen || !['Enter',' ','Spacebar','ArrowRight'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || isInteractiveTarget(event.target) || isInteractiveTarget(document.activeElement) || document.activeElement?.closest?.('[data-stage-advance]'))return;
  if(advanceNarrative())event.preventDefault();
});
window.addEventListener('pointerdown',()=>{audioDirector.unlock().catch(()=>{})},{passive:true});
window.addEventListener('keydown',()=>{audioDirector.unlock().catch(()=>{})},{passive:true});
document.addEventListener('visibilitychange',()=>lifecycle.setDocumentHidden(Boolean(document.hidden)));
window.addEventListener('blur',()=>lifecycle.pause('window'));
window.addEventListener('focus',()=>lifecycle.resume('window'));
function renderBootFailure(error){
  platform?.setGameplayActive(false);
  app.className='literary-home';
  app.dataset.qaFailure=String(error?.message||'').startsWith('BLOCKED_EN_CORPUS_INCOMPLETE')?'en-corpus':'yandex-sdk';
  const message=app.dataset.qaFailure==='en-corpus'?String(error.message):t('sdkError');
  app.replaceChildren(el(message,'structural-error','p'));
}
applySettings();
// Versioned cloud key: never interpret old 12-episode progression as new literary scenes.
// A late cloud response cannot overwrite deliberate new-game actions or a local save.
const bootHadLocal=hasSave;
async function boot(){
 try{
  const result=await initPlatform({cloudKey:literaryCloudKey,onCloudState:raw=>{
   const candidate=parseSaved(raw);
   if(!candidate || cloudLocked)return;
   if(bootHadLocal || hasSave){cloudCandidate=candidate; if(menuOpen)renderMenu();return}
   reader=candidate;hasSave=true;
   try{localStorage.setItem(literarySaveKey,JSON.stringify(reader))}catch{}
   if(menuOpen)renderMenu();
  },onCloudError:error=>{console.warn('[platform] cloud storage unavailable',error);},onPause:()=>lifecycle.pause('platform'),onResume:()=>lifecycle.resume('platform')});
  platform=result;
  locale=platform.locale;
  t=createTranslator(locale);
  document.documentElement.lang=locale;
  document.title=t('gameTitle');
  app.setAttribute('aria-label',t('gameTitle'));
  runtimeSeason=loadRuntimeSeason(locale,platform.qaLocaleOverride);
  byId=new Map(runtimeSeason.scenes.map(scene=>[scene.id,scene]));
  if(!byId.has(reader.sceneId))throw Error(`BLOCKED_EN_CORPUS_INCOMPLETE: missing scene ${reader.sceneId}`);
  renderMenu();
  platform.setGameplayActive(gameplayShouldBeActive());
  platform.markInteractiveReady();
  if(platform.mode==='yandex'||platform.mode==='vk-games'){
    cloudQueue=createCloudSaveQueue(snapshot=>platform.save(snapshot),{onError:error=>console.warn('[platform] cloud write unavailable',error)});
    // Explicit new-game reset may have happened while SDK was initializing.
    if(cloudLocked)cloudQueue.enqueue(reader).catch(()=>{});
  }
 }catch(error){
   console.error(error);
   renderBootFailure(error);
 }
}
window.__LITERARY_QA__={
  getState:()=>structuredClone(reader),
  getFlow:()=>compileInteractivePlayback(byId.get(reader.sceneId),reader.choices,locale),
  getScenes:()=>runtimeSeason.scenes.map(s=>s.id),
  getLocale:()=>locale,
  getPlatformMode:()=>platform?.mode??'booting',
  getPersistenceKeys:()=>({local:literarySaveKey,cloud:literaryCloudKey}),
  getScreen:()=>({menuOpen,sceneId:reader.sceneId,position:reader.position}),
  getVisualCache:()=>({ ...visualLayers.getState(), cachedImages:imagePreloader.getSize(), pendingImages:imagePreloader.getPendingSize?.()??0 }),
  getViewport:()=>({
    innerWidth:window.innerWidth,
    innerHeight:window.innerHeight,
    devicePixelRatio:window.devicePixelRatio,
    orientation:window.matchMedia?.('(orientation: portrait)').matches?'portrait':'landscape',
    desktopMedia:window.matchMedia?.('(min-width: 681px)').matches??false,
    root:document.documentElement.getBoundingClientRect().toJSON(),
    body:document.body.getBoundingClientRect().toJSON(),
    app:app?.getBoundingClientRect?.().toJSON?.()??null
  }),
  getLifecycle:()=>lifecycle.getState(),
  getPlatformDiagnostics:()=>platform?.diagnostics?.map(event=>structuredClone(event))??[],
  getRuntimeTrace:()=>{
    const scene=byId.get(reader.sceneId),flow=compileInteractivePlayback(scene,reader.choices,locale),entry=flow[reader.position]??flow.at(-1)??null;
    const visualEntry=visualEntryForPosition(flow,reader.position);
    const direction=visualAt(scene.id,visualEntry,reader.choices,stageForScene(scene.id,reader.choices).cast);
    const text=entry?.text??entry?.question??'';
    let hash=2166136261;for(const char of text)hash=Math.imul(hash^char.charCodeAt(0),16777619);
    return {displayedPosition:`${reader.position+1}/${flow.length}`,sceneId:scene.id,entryId:entry?.id??null,entryType:entry?.type??null,sourceStartRef:entry?.sourceStartRef??null,sourceEndRef:entry?.sourceEndRef??null,dialogueHash:(hash>>>0).toString(16),speaker:null,platformMode:platform?.mode??'booting',revision:reader.revision,choiceState:structuredClone(reader.choices),location:direction.location,visualBeat:direction.beatId,background:direction.art?.file??null,cast:direction.cast,stage:stageForScene(scene.id,reader.choices)};
  },
  // QA methods are strictly read-only; preview and the old game have separate state keys.
};
boot();
}
