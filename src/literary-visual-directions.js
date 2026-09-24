/** Authored, stable visual timeline for the 66-scene literary edition.
 * A beat starts at a source chunk/paragraph address, never because a rendered
 * sentence mentions a character or a visual keyword. Unillustrated places
 * intentionally use the neutral stage instead of borrowing a false location.
 */
export const visualScenes = {
  S01:['Кефлавик: зал прилёта','день 1, утро','keflavik-airport-arrivals-v1.png'],
  S02:['Автомобиль по дороге в Рейкьявик','день 1, день'],
  S65:['Гостевой дом Рейкьявика: кухня и комнаты','день 1, вечер'],
  S03:['Гостевой дом Рейкьявика: гостиная','день 2, утро'],
  S04:['Þingvellir: парковка и тропа','день 2, день'],
  S05:['Гостевой дом и дорога к Hveragerði','день 3, утро','s05-hveragerdi-road.png'],
 S06:['Геотермальная долина Hveragerði','день 3, день'],
 S07:['Общая кухня гостевого дома Hveragerði','день 3, вечер'],
 S08:['Гостевой дом Hveragerði: комнаты и общая зона','день 4, утро'],
  S66:['Теплица Hveragerði: грядки и кафе','день 4, день','s66-hveragerdi-greenhouse.png'],
  S09:['Гостевой дом → водопад Skógafoss','день 5, утро'],
  S10:['АЗС и дорога к Vík','день 5, день'],
  S11:['Reynisfjara: чёрный пляж','день 6, утро','reynisfjara-master.png'],
  S12:['Кафе Vík','день 6, день'],
  S13:['Vík → Скафтафетль: тропа и блокнот','день 7, утро'],
  S14:['Скафтафетль: тропа над ледниковой равниной','день 7, день'],
  S15:['Парковка и лагуна Jökulsárlón','день 8, день'],
  S16:['Гостевой дом у дороги','день 8, вечер'],
 S17:['Гостевой дом Höfn','день 9, день','s18-hofn-harbour.png'],
 S18:['Höfn: гостевой дом и маяк','день 9, вечер','s18-hofn-harbour.png'],
  S19:['Бассейн Höfn','день 9, вечер'],
  S20:['Гостевой дом Höfn: комната и завтрак','день 10'],
  S21:['Номер Алисы, Höfn','день 9, вечер'],
  S61:['Улицы и магазины Höfn','день 10'],
  S22:['Дорога по восточным фьордам','день 11','eastfjords-road-master.png'],
  S23:['Причал восточных фьордов','день 11'],
  S24:['Причал восточных фьордов','день 12, утро'],
  S25:['Гостевой дом восточных фьордов','день 12'],
  S58:['Общая кухня гостевого дома','день 12, вечер'],
  S26:['Гостевой дом восточных фьордов: коридор и двор','день 12, вечер'],
  S27:['Приозёрная тропа Egilsstaðir: настил','день 13'],
  S59:['Совместный обед группы','день 13'],
  S28:['Размеченная тропа и обзорная площадка','день 14'],
  S49:['Зал гостевого дома: танец у окна','день 14, вечер'],
  S29:['Гостевой дом: просмотр записи Ника','день 14'],
  S52:['Улицы, почта и мастерская','день 14'],
  S30:['Личный разговор Алисы и Дамира','день 14'],
  S55:['Конная ферма','день 14'],
  S31:['Самостоятельный день Алисы','день 14'],
  S62:['Книжный магазин','день 14'],
  S32:['Гостевой дом: разговор с Эриком','день 15'],
  S50:['Прогулка по Акюрейри','день 15','akureyri-street-master.png'],
  S33:['Гостиничный номер Акюрейри: тизер','день 15'],
  S53:['Улицы и бассейн Акюрейри','день 16'],
  S34:['Гостевой дом: отменённый вечер','день 16'],
  S56:['Кафе с музыкантами','день 16, вечер'],
  S35:['Номер Алисы: работа над статьёй','день 16'],
  S63:['Небольшой концертный зал','день 16, вечер'],
  S36:['Отель → дорога Snæfellsnes','день 17'],
  S37:['Гостевой дом: Эрик и Алиса','день 18'],
  S51:['Совместный ужин Эрика и Алисы','день 19'],
  S38:['Повседневный день Алисы и Ника','день 18'],
  S54:['Совместный вечер Алисы и Ника','день 19'],
  S39:['Разговор Алисы и Дамира','день 18'],
  S57:['Дамир и Алиса: рассвет','день 19'],
  S40:['Номер Алисы: ноутбук у окна','день 18'],
  S64:['Пешеходная тропа Snæfellsnes','день 19'],
  S60:['Общая кухня: ужин при лампах','день 19, вечер'],
  S41:['Рейкьявик: кафе, видеозвонок редактору','день 20'],
  S42:['Рейкьявик: индивидуальное свидание','день 20, вечер'],
 S43:['Книжный магазин и набережная Рейкьявика','день 20','reykjavik-harbour-master.png'],
 S44:['Гавань Рейкьявика: прощание Эрика','день 21, утро','reykjavik-harbour-master.png'],
  S45:['Рейкьявик: просмотр финального фильма Ника','день 21'],
  S46:['Автобус → аэропорт Кефлавик','день 21'],
  S47:['Утренняя гавань Рейкьявика','день 21, утро'],
  S48:['Общая кухня: последний завтрак','день 21, утро']
};

// Format: [chunkIndex, paragraphIndex]. Changes persist to the next cue.
// Every cue is an explicit editorial decision; never infer actions from prose.
const cues = {
 S01:[{at:[0,4],id:'nick-arrives',cast:['alice','nick']},
      {at:[0,16],id:'airport-outside',cast:['alice','nick','eric'],location:'Кефлавик: выход под дождь'},
      {at:[0,24],id:'damir-arrives',cast:['alice','nick','eric','damir']},
      {at:[2,0],id:'car-eric',location:'Автомобиль: переднее сиденье',art:null,cast:['alice','eric','nick','damir'],when:{'S01-C1':'A'}},
      {at:[3,0],id:'car-nick',location:'Автомобиль: заднее сиденье',art:null,cast:['alice','eric','nick','damir'],when:{'S01-C1':'B'}},
      {at:[4,0],id:'car-damir',location:'Автомобиль: заднее сиденье',art:null,cast:['alice','eric','nick','damir'],when:{'S01-C1':'C'}}],
 S02:[{at:[0,31],id:'roadside-cafe',location:'Придорожное кафе',art:'s02-roadside-cafe.png'}],
 S03:[{at:[0,0],id:'editor-call',cast:['alice'],art:null},
      {at:[4,0],id:'damir-enters',cast:['alice','damir']}],
 S04:[{at:[0,4],id:'thingvellir-trail',location:'Þingvellir: тропа и ущелье',art:'thingvellir-master.png'}],
 S09:[{at:[0,8],id:'skogafoss-trail',location:'Skógafoss: водопад',art:'skogafoss-master.png'}],
 S10:[{at:[0,0],id:'s10-vik-road-song',location:'АЗС у дороги к Vík: переднее сиденье автомобиля',cast:['alice','eric'],art:'cg/s10-vik-road-song.png'},
      {at:[6,0],id:'s10-vik-arrival',location:'Гостевой дом Vík: заселение',cast:['alice','nick','eric','damir'],art:null}],
 S12:[{at:[0,0],id:'s12-vik-cafe-damir',location:'Кафе Vík: стол у окна',cast:['alice','damir'],art:'cg/s12-vik-cafe-damir.png'},
      {at:[11,0],id:'s12-vik-street',location:'Улица Vík после кафе',cast:['alice','damir'],art:null}],
 S13:[{at:[0,7],id:'skaftafell-parking',location:'Скафтафетль: информационный центр',art:null},
      {at:[0,12],id:'skaftafell-notebook',location:'Скафтафетль: тропа и блокнот',art:'cg/s13-skaftafell-travelers.png'}],
 S15:[{at:[0,5],id:'jokulsarlon-lagoon',location:'Jökulsárlón: лагуна',art:'jokulsarlon-master.png'}],
 S18:[{at:[0,5],id:'hofn-lighthouse',location:'Höfn: прогулка к маяку',art:'s18-hofn-harbour.png',cast:['alice','eric']},
      {at:[0,35],id:'hofn-dance',location:'Höfn: танец у гавани',art:'cg/s18-hofn-dance-lights.png',cast:['alice','eric']},
      {at:[0,39],id:'hofn-walk-back',location:'Höfn: обратная дорога',art:'s18-hofn-harbour.png'},
      {at:[5,1],id:'hofn-day10-room',location:'Höfn: комната на следующее утро',time:'день 10, утро',art:null,cast:['alice']},
      {at:[5,3],id:'hofn-day10-breakfast',location:'Höfn: общий завтрак',time:'день 10, утро',art:null,cast:['alice','eric','nick','damir']}],
 S26:[{at:[0,2],id:'guesthouse-courtyard',location:'Двор у гостевого дома',art:null,cast:['alice','eric','nick','damir']},
      {at:[2,0],id:'route-eric',cast:['alice','eric'],when:{'S26-C1':'A'}},
      {at:[7,0],id:'eric-consensual-embrace',cast:['alice','eric'],art:'cg/s26-eric-choice.png',when:{'S26-C1':'A'}},
      {at:[8,0],id:'route-nick',cast:['alice','nick'],when:{'S26-C1':'B'}},
      {at:[14,0],id:'route-damir',cast:['alice','damir'],when:{'S26-C1':'C'}},
      {at:[20,0],id:'route-independent',cast:['alice'],when:{'S26-C1':'D'}}],
 S33:[{at:[0,1],id:'hotel-teaser',location:'Гостиница Акюрейри: личный голос в тизере',art:null,cast:['alice','nick']}],
 S36:[{at:[0,1],id:'snaefellsnes-drive',location:'Дорога по Snæfellsnes',art:'snaefellsnes-master.png'}],
 S41:[{at:[0,1],id:'editor-cafe-call',location:'Рейкьявик: кафе, видеозвонок редактору',art:null}],
 S44:[{at:[0,0],id:'eric-morning-harbour',location:'Рейкьявик: утренняя гавань',art:null,cast:['alice','eric']},
      {at:[4,0],id:'eric-month-later',location:'Город Алисы: мастерская и новая дата',time:'спустя месяц',art:'cg/s44-eric-epilogue-month-later.png',cast:['alice','eric']}],
 S45:[{at:[0,0],id:'nick-film-final',location:'Рейкьявик: просмотр финального монтажа',art:'cg/s45-reykjavik-warm-montage.png',cast:['alice','nick']},
      {at:[4,0],id:'nick-month-later',location:'Дом Алисы: монтаж на выходных',time:'спустя месяц',art:'cg/s45-nick-home-epilogue-month-later.png',cast:['alice','nick']}],
 S46:[{at:[0,0],id:'airport-bus',location:'Автобус до аэропорта',art:null,cast:['alice','damir']},
      {at:[0,1],id:'airport-checkin',location:'Кефлавик: стойка регистрации',art:'cg/s46-airport-goodbye.png'},
      {at:[4,0],id:'damir-month-later',location:'Аэропортовый автобус: поздняя встреча',time:'спустя месяц',art:'cg/s46-damir-epilogue-month-later.png',cast:['alice','damir']}],
 S47:[{at:[0,0],id:'alice-morning-harbour',location:'Рейкьявик: утренняя городская гавань',art:'cg/s47-reykjavik-harbour-alice.png',cast:['alice']},
      {at:[4,0],id:'alice-month-later',location:'Дом Алисы: новый маршрут',time:'спустя месяц',art:'cg/s47-alice-home-epilogue-month-later.png',cast:['alice']}],
 S06:[{at:[6,6],id:'s06-eric-alice-stream',location:'Геотермальная долина Hveragerði: площадка над ручьём',art:'cg/s06-hveragerdi-eric-alice.png',cast:['alice','eric']}],
 S07:[{at:[3,0],id:'s07-kitchen-pasta',location:'Общая кухня Hveragerði: плита и стол',art:'cg/s07-kitchen-pasta.png',cast:['alice','nick','eric','damir']},
      {at:[3,42],id:'s07-kitchen-cards',location:'Общая кухня Hveragerði: карточная игра',art:'cg/s07-kitchen-cards.png',cast:['alice','nick','eric','damir']}],
 S08:[{at:[2,0],id:'s08-guesthouse-strap',location:'Гостевой дом Hveragerði: лестница и коридор',art:'cg/s08-guesthouse-strap.png',cast:['alice','damir']}],
 S48:[{at:[5,0],id:'group-hotel-exit',location:'Выход из гостевого дома',art:null,cast:['alice','eric','nick','damir']}]
};

const address = ([chunk,paragraph])=>chunk*10000+paragraph;
const openingCast={S01:['alice'],S03:['alice'],S18:['alice','eric']};
const validArt = art=>art===null || typeof art==='string';
export function visualBoundary(sceneId, sourceRef){
 const list=cues[sceneId];
 return Boolean(list && list.some(c=>c.at[0]===sourceRef?.chunk && c.at[1]===sourceRef?.paragraph));
}

/** Resolve by immutable manuscript paragraph addresses, not page counts or text.
 * The cast of the active beat is retained through choices and new page layouts.
 */
export function visualAt(sceneId,entry,choices={},baseCast=['alice']){
 const record=visualScenes[sceneId];
 if(!record)throw new Error(`Missing visual scene contract: ${sceneId}`);
 const [baseLocation,baseTime,baseBackground]=record;
 const state={sceneId,beatId:'scene-start',location:baseLocation,time:baseTime,cast:[...(openingCast[sceneId]??baseCast)],art:baseBackground ? {type:'background',presentation:'environment',file:baseBackground}:null};
 const ref=entry?.sourceEndRef ?? entry?.sourceStartRef;
 const at=ref?address([ref.chunk,ref.paragraph]):-1;
 for(const cue of cues[sceneId]??[]){
  if(address(cue.at)>at)continue;
  if(cue.when && !Object.entries(cue.when).every(([id,code])=>choices[id]===code))continue;
  if('location' in cue)state.location=cue.location;
  if('time' in cue)state.time=cue.time;
  if('cast' in cue)state.cast=[...cue.cast];
  if('art' in cue){
   if(!validArt(cue.art))throw new Error(`Invalid art for ${sceneId}/${cue.id}`);
   state.art=cue.art===null?null:cue.art.startsWith('cg/')?{type:'cg',presentation:'cinematic',file:cue.art.slice(3)}:{type:'background',presentation:'environment',file:cue.art};
  }
  state.beatId=cue.id;
 }
 return state;
}
/** The terminal reader position is one past the last page after the final
 * "Далее" click. Keep the last authored visual beat on the completion screen
 * instead of resolving an undefined entry back to the scene opening art. */
export function visualEntryForPosition(flow,position){
 return flow[position] ?? flow.at(-1) ?? null;
}
export const visualCues=cues;
