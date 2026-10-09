export const supportedLocales=Object.freeze(['ru','en']);
export const sourceRef={chunk:(s,i)=>s+'.C'+String(i).padStart(3,'0'),paragraph:(s,c,i)=>s+'.C'+String(c).padStart(3,'0')+'.P'+String(i).padStart(3,'0')};
const ui={
 ru:{gameTitle:'Поцелуй на краю света',menuKicker:'РОМАНТИЧЕСКАЯ ИСТОРИЯ · ИСЛАНДИЯ',menuSummary:'Три недели дороги. Три возможные истории любви. И возможность выбрать себя.',standaloneSummary:'Четыре самостоятельных исхода: {eric}, {nick}, {damir} и {alice}. Прогресс этой редакции сохраняется отдельно от прежней короткой версии.',newGame:'Новая игра',continueEpisode:'Продолжить · эпизод {episode}',episodes:'Эпизоды',settings:'Настройки',menu:'Меню',backMenu:'← К меню',yourChoice:'ТВОЙ ВЫБОР',episode:'ЭПИЗОД',returnMenu:'Вернуться в меню',nextScene:'Следующая сцена → {scene}',confirmNew:'Начать новое прохождение? Текущий прогресс будет заменён.',structuralError:'Следующая сцена недоступна: ошибка структуры сценария.',sdkError:'Ошибка инициализации Yandex SDK. Продолжить QA невозможно.',routeEric:'Эрик',routeNick:'Ник',routeDamir:'Дамир',routeAlice:'Алиса',endingEric:'Дорога, которую выбирают вдвоём',endingNick:'Без чужого голоса',endingDamir:'Начать заново — вместе',endingAlice:'Свой следующий маршрут',episodesDescription:'Открываются по мере прохождения. При возвращении к прочитанной сцене ваши поздние решения будут сброшены, чтобы не смешивать разные варианты истории.',episodeUnlocked:'Эпизод {episode} · открыт',episodeLocked:'Эпизод {episode} · пока не пройден',episodeReplayConfirm:'Вернуться к началу эпизода {episode}? Выборы, сделанные позже, будут сброшены.',textSize:'Размер текста · {percent}%',contrast:'Повышенная контрастность · {state}',contrastOn:'да',contrastOff:'нет',motion:'Анимация · {state}',motionOff:'отключена',motionSystem:'системная',restoreCloud:'Восстановить облачный прогресс',restoreCloudConfirm:'Заменить текущее локальное сохранение облачным?',readerHeaderTitle:'ПОЦЕЛУЙ НА КРАЮ СВЕТА',stageAdvanceAria:'Нажмите на сцену или Enter, чтобы продолжить чтение',sceneAria:'{title}. Эпизод {episode}',migrationNotice:'После обновления визуальных переходов продолжение начинается с начала текущей сцены. Прежний прогресс и выборы сохранены.'},
 en:{gameTitle:'Kiss at the Edge of the World',menuKicker:'ROMANTIC STORY · ICELAND',menuSummary:'Three weeks on the road. Three possible love stories. And the chance to choose yourself.',standaloneSummary:'Four independent endings: {eric}, {nick}, {damir}, and {alice}. This edition saves progress separately from the earlier short version.',newGame:'New Game',continueEpisode:'Continue · Episode {episode}',episodes:'Episodes',settings:'Settings',menu:'Menu',backMenu:'← Menu',yourChoice:'YOUR CHOICE',episode:'EPISODE',returnMenu:'Return to Menu',nextScene:'Next scene → {scene}',confirmNew:'Start a new playthrough? Your current progress will be replaced.',structuralError:'The next scene is unavailable because of a story structure error.',sdkError:'Yandex SDK initialization failed. QA cannot continue.',routeEric:'Eric',routeNick:'Nick',routeDamir:'Damir',routeAlice:'Alice',endingEric:'The Road They Choose Together',endingNick:'Without Another Voice',endingDamir:'Starting Over — Together',endingAlice:'Her Next Route',episodesDescription:'Episodes open as you progress. Returning to a scene resets later decisions so different story variations do not mix.',episodeUnlocked:'Episode {episode} · unlocked',episodeLocked:'Episode {episode} · not reached',episodeReplayConfirm:'Return to the beginning of Episode {episode}? Later choices will be reset.',textSize:'Text size · {percent}%',contrast:'High contrast · {state}',contrastOn:'on',contrastOff:'off',motion:'Animation · {state}',motionOff:'off',motionSystem:'system',restoreCloud:'Restore cloud progress',restoreCloudConfirm:'Replace the current local save with the cloud save?',readerHeaderTitle:'KISS AT THE EDGE OF THE WORLD',stageAdvanceAria:'Click the scene or press Enter to continue reading',sceneAria:'{title}. Episode {episode}',migrationNotice:'After the visual transitions update, this scene will restart from its beginning. Your earlier progress and choices are preserved.'}
};
ui.ru.confirmDialogTitle='Подтвердите действие';
ui.ru.confirmDialogCancel='Отмена';
ui.ru.confirmDialogConfirm='Подтвердить';
ui.en.confirmDialogTitle='Confirm action';
ui.en.confirmDialogCancel='Cancel';
ui.en.confirmDialogConfirm='Confirm';
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
