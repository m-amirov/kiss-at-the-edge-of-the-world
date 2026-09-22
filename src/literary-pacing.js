import { compileScenePlayback } from './literary-engine.js';
import { interactionBeats, interactionEchoes, interactionTargets } from './literary-interactive-beats.js';

// Counts refer to the fully resolved manuscript's canonical A read. They are
// placement markers, not generated text and not a count of mutually exclusive
// paragraphs shown to every player.
const paragraphCount = {
 S01:48,S02:65,S65:106,S03:85,S04:128,S05:95,S06:96,S07:115,S08:95,S66:101,
 S09:37,S10:47,S11:37,S12:69,S13:59,S14:51,S15:59,S16:34,S17:48,S18:59,
 S19:66,S20:44,S21:14,S61:21,S22:46,S23:41,S24:28,S25:33,S58:29,S26:11,
 S27:13,S59:9,S28:15,S49:11,S29:9,S52:12,S30:12,S55:11,S31:10,S62:6,
 S32:14,S50:6,S33:11,S53:6,S34:12,S56:6,S35:5,S63:5,S36:6,S37:8,
 S51:7,S38:9,S54:9,S39:8,S57:7,S40:6,S64:6,S60:4,S41:10,S42:5,
 S43:5,S44:6,S45:4,S46:5,S47:4,S48:5
};
const countWords = text => text.trim().split(/\s+/u).length;

/** A page holds up to three short manuscript paragraphs or 95 words, whichever
 * comes first. No manuscript sentence is deleted or paraphrased. A choice and
 * its selected response always begin fresh pages so save positions stay stable.
 */
export function compileInteractivePlayback(scene, choices={}) {
  const original=compileScenePlayback(scene,choices);
  const beats=interactionBeats[scene.id]||[];
  const targets=interactionTargets(scene,paragraphCount[scene.id]);
  const result=[];
  let pending=[],words=0,start=0,paragraphNumber=0,beatIndex=0;
  const flush=()=>{
    if(!pending.length)return;
    result.push({type:'page',paragraphs:pending.map(x=>x.text),text:pending.map(x=>x.text).join('\n\n'),
      sourceStart:start,sourceEnd:pending.at(-1).sourceIndex});
    pending=[];words=0;
  };
  function addParagraph(text,sourceIndex){
    if(!text)return;
    const nextWords=countWords(text);
    if(pending.length && (pending.length>=3 || words+nextWords>95))flush();
    if(!pending.length)start=sourceIndex;
    pending.push({text,sourceIndex});words+=nextWords;
  }
  function insertBeat(beat,index,sourceIndex){
    flush();const id=`${scene.id}-C${90+index}`;
    const selected=choices[id];
    if(!selected){
      result.push({type:'choice',id,question:beat.question,options:beat.options.map(({code,label})=>({code,label})),sourceStart:sourceIndex,sourceEnd:sourceIndex});
      return false;
    }
    const option=beat.options.find(o=>o.code===selected);
    if(!option)throw new Error(`Invalid extra choice ${id}=${selected}`);
    result.push({type:'page',paragraphs:[option.text],text:option.text,sourceStart:sourceIndex,sourceEnd:sourceIndex,decisionResult:id});
    return true;
  }
  for(let index=0;index<original.length;index++){
    const entry=original[index];
    if(entry.type==='paragraph'){
      addParagraph(entry.text,index);paragraphNumber++;
      if(paragraphNumber===1){
        for(const [id,a,b] of interactionEchoes[scene.id]||[]){
          const echo=choices[id]==='A'?a:choices[id]==='B'?b:null;
          if(echo){flush();result.push({type:'page',paragraphs:[echo],text:echo,sourceStart:index,sourceEnd:index,echoOf:id});}
        }
      }
      while(beatIndex<beats.length && paragraphNumber>=targets[beatIndex]){
        if(!insertBeat(beats[beatIndex],beatIndex,index)){flush();return result;}
        beatIndex++;
      }
    }else{
      flush();result.push(entry);
      // The manuscript parser stops at the first unresolved authored choice.
      if(entry.type==='choice')return result;
    }
  }
  flush();
  // A shorter conditional branch may have fewer paragraphs than the canonical
  // placement marker. Never silently drop its own agency beat at the scene end.
  while(beatIndex<beats.length){
    if(!insertBeat(beats[beatIndex],beatIndex,original.length))return result;
    beatIndex++;
  }
  return result;
}
