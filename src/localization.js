export const supportedLocales=Object.freeze(['ru','en']);
export const sourceRef={chunk:(s,i)=>s+'.C'+String(i).padStart(3,'0'),paragraph:(s,c,i)=>s+'.C'+String(c).padStart(3,'0')+'.P'+String(i).padStart(3,'0')};
const ui={
 ru:{newGame:'Новая игра',continueEpisode:'Продолжить · эпизод {episode}',episodes:'Эпизоды',settings:'Настройки',menu:'Меню',backMenu:'← К меню',yourChoice:'ТВОЙ ВЫБОР',episode:'ЭПИЗОД',returnMenu:'Вернуться в меню',nextScene:'Следующая сцена → {scene}',confirmNew:'Начать новое прохождение? Текущий прогресс будет заменён.',structuralError:'Следующая сцена недоступна: ошибка структуры сценария.',sdkError:'Ошибка инициализации Yandex SDK. Продолжить QA невозможно.'},
 en:{newGame:'New Game',continueEpisode:'Continue · Episode {episode}',episodes:'Episodes',settings:'Settings',menu:'Menu',backMenu:'← Menu',yourChoice:'YOUR CHOICE',episode:'EPISODE',returnMenu:'Return to Menu',nextScene:'Next scene → {scene}',confirmNew:'Start a new playthrough? Your current progress will be replaced.',structuralError:'The next scene is unavailable because of a story structure error.',sdkError:'Yandex SDK initialization failed. QA cannot continue.'}
};
export function createTranslator(locale){if(!supportedLocales.includes(locale))throw Error('UNSUPPORTED_LOCALE:'+locale);return(key,values={})=>{const value=ui[locale][key];if(!value)throw Error('MISSING_UI_TRANSLATION:'+locale+':'+key);return value.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??'{'+name+'}'));};}
export function applyLiteraryLocale(source,localeData,{sceneIds=source.scenes.map(scene=>scene.id)}={}){
 if(localeData.locale==='ru')return source;
 const expected=new Set(sceneIds),scopedScenes=source.scenes.filter(scene=>expected.has(scene.id));
 const report=validateLiteraryLocale(source,localeData,{sceneIds});
 if(report.status!=='PASS')throw Error('BLOCKED_EN_CORPUS_INCOMPLETE: '+report.errors.join('; '));
 return{...source,scenes:scopedScenes.map(scene=>{const localized=localeData.scenes[scene.id];return{...scene,title:localized.title,chunks:scene.chunks.map((chunk,ci)=>{const translated=localized.chunks[sourceRef.chunk(scene.id,ci)];return{...chunk,localizedTitle:translated.title,paragraphs:chunk.paragraphs.map((_,pi)=>translated.paragraphs[sourceRef.paragraph(scene.id,ci,pi)])};})};})};
}
export function validateLiteraryLocale(source,data,{sceneIds=source.scenes.map(x=>x.id)}={}){
 const errors=[],expected=new Set(sceneIds),actual=new Set(Object.keys(data?.scenes||{}));
 for(const id of expected)if(!actual.has(id))errors.push('missing scene '+id);for(const id of actual)if(!expected.has(id))errors.push('extra scene '+id);
 for(const scene of source.scenes.filter(x=>expected.has(x.id))){const translated=data?.scenes?.[scene.id];if(!translated)continue;if(!translated.title?.trim())errors.push('empty title '+scene.id);
  const ec=new Set(scene.chunks.map((_,i)=>sourceRef.chunk(scene.id,i))),ac=new Set(Object.keys(translated.chunks||{}));for(const ref of ec)if(!ac.has(ref))errors.push('missing chunk '+ref);for(const ref of ac)if(!ec.has(ref))errors.push('extra chunk '+ref);
  scene.chunks.forEach((chunk,ci)=>{const target=translated.chunks?.[sourceRef.chunk(scene.id,ci)];if(!target)return;const ep=new Set(chunk.paragraphs.map((_,pi)=>sourceRef.paragraph(scene.id,ci,pi))),ap=new Set(Object.keys(target.paragraphs||{}));for(const ref of ep)if(!ap.has(ref)||!target.paragraphs[ref]?.trim())errors.push('missing paragraph '+ref);for(const ref of ap)if(!ep.has(ref))errors.push('extra paragraph '+ref);});
 }
 return{status:errors.length?'BLOCKED_EN_CORPUS_INCOMPLETE':'PASS',errors,sceneCount:expected.size};
}
export function validateLiteraryInteractionLocale(canonicalBeats,localeData,{sceneIds=Object.keys(canonicalBeats)}={}){
 const errors=[],expected=new Set(sceneIds),actual=new Set(Object.keys(localeData?.interactionBeats||{}));
 for(const id of expected)if(!actual.has(id))errors.push('missing interaction beats '+id);
 for(const id of actual)if(!expected.has(id))errors.push('extra interaction beats '+id);
 for(const id of expected){
  const source=canonicalBeats[id]||[],translated=localeData?.interactionBeats?.[id];
  if(!translated)continue;
  if(translated.length!==source.length)errors.push(`interaction beat count ${id}`);
  for(const [index,beat] of translated.entries()){
   if(!beat.question?.trim())errors.push(`empty interaction question ${id}.${index}`);
   if(!Array.isArray(beat.options)||beat.options.length!==2)errors.push(`invalid interaction options ${id}.${index}`);
   for(const option of beat.options||[])if(!option.label?.trim()||!option.text?.trim())errors.push(`empty interaction option ${id}.${index}.${option.code??'?'}`);
  }
 }
 return{status:errors.length?'BLOCKED_EN_CORPUS_INCOMPLETE':'PASS',errors,sceneCount:expected.size};
}
