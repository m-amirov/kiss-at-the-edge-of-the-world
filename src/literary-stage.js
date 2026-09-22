/** Explicit scene director for the authored ten-episode season.
 * Cast and framing are properties of scenes, not of names accidentally
 * mentioned in the currently displayed prose paragraph.
 */
const group = ['S01','S02','S65','S04','S05','S07','S09','S11','S13','S16','S17',
  'S22','S26','S27','S59','S36','S60','S48','S58','S66'];
const pair = {
  eric: ['S06','S10','S14','S18','S23','S28','S49','S32','S50','S37','S51','S44'],
  nick: ['S15','S19','S24','S29','S52','S33','S53','S38','S54','S45'],
  damir: ['S08','S12','S20','S25','S30','S55','S34','S56','S39','S57','S46'],
};
const solo = ['S03','S41','S21','S61','S31','S62','S35','S63','S40','S64','S43','S47'];
const lead = Object.fromEntries(Object.entries(pair).flatMap(([person,ids])=>ids.map(id=>[id,person])));
const profiles = new Map([
  ...group.map(id=>[id,{cast:['alice','eric','nick','damir'],mood:'neutral'}]),
  ...Object.entries(pair).flatMap(([person,ids])=>ids.map(id=>[id,{cast:['alice',person],mood:'warm'}])),
  ...solo.map(id=>[id,{cast:['alice'],mood:'neutral'}])
]);
// Set a specific, stable direction once per scene. These are stage directions,
// not simulated facial expressions or text-keyword matching.
for (const id of ['S01','S08','S12','S23','S25','S26','S32','S33','S34','S36','S42']) {
  if(profiles.has(id)) profiles.get(id).mood='tense';
}
for (const id of ['S07','S09','S18','S19','S20','S28','S49','S52','S55','S56','S57','S59','S63','S66']) {
  if(profiles.has(id)) profiles.get(id).mood='playful';
}
for (const id of ['S37','S38','S39','S44','S45','S46','S47','S50','S51','S53','S54']) {
  if(profiles.has(id)) profiles.get(id).mood='intimate';
}

export const stageSceneIds = [...profiles.keys(),'S42'].sort();
export function stageForScene(sceneId, choices={}) {
  let spec=profiles.get(sceneId);
  if(sceneId==='S42'){
    const who={A:'eric',B:'nick',C:'damir'}[choices['S26-C1']];
    spec={cast:who?['alice',who]:['alice'],mood:'intimate'};
  }
  if(!spec)throw new Error(`Missing authored stage direction for ${sceneId}`);
  return {cast:[...spec.cast],mood:spec.mood,mode:spec.cast.length>2?'group':spec.cast.length===2?'pair':'solo'};
}

// One-off authored entrance/exit cues are tied to exact story beats, not
// substring matches of character names in arbitrary prose.
const beatCues = {
  S01: [
    {startsAt:0, cast:['alice']},
    {startsWith:'Мужчина держал картонную табличку',cast:['alice','nick']},
    {startsWith:'За стеклянными дверями аэропорта',cast:['alice','nick','eric']},
    {startsWith:'Четвёртый участник стоял у автомата',cast:['alice','nick','eric','damir']}
  ],
  S03: [
    {startsAt:0,cast:['alice']},
    {startsWith:'Дамир вошёл в гостиную',cast:['alice','damir']}
  ],
  S18: [
    {startsAt:0,cast:['alice','eric']},
    {contains:'Утром десятого дня',cast:['alice','eric','nick','damir']}
  ]
};
export function stageForPlayback(sceneId,flow,position,choices={}) {
  const base=stageForScene(sceneId,choices);
  const cues=beatCues[sceneId];
  if(!cues)return base;
  let cast=base.cast;
  for(let i=0;i<=Math.min(position,flow.length-1);i++){
    const lines=flow[i]?.paragraphs ?? [flow[i]?.text ?? ''];
    for(const cue of cues){
      if((cue.startsAt!==undefined && cue.startsAt===i) || (cue.startsWith && lines.some(text=>text.startsWith(cue.startsWith))) || (cue.contains && lines.some(text=>text.includes(cue.contains))))
        cast=cue.cast;
    }
  }
  return {cast:[...cast],mood:base.mood,mode:cast.length>2?'group':cast.length===2?'pair':'solo'};
}
