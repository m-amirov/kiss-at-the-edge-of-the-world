/** Literary draft interpreter: preserve manuscript paragraphs; choose one authored branch.
 * This reader is deliberately separate from the legacy Yandex save/cloud contract.
 */
export const literarySaveKey = 'kiss-at-the-edge-of-the-world:literary-draft:v1';
export const order = ['S01','S02','S65','S03','S04','S05','S06','S07','S08','S66','S09','S10','S11','S12','S13','S14','S15','S16','S17','S22','S23','S24','S25','S58','S26','S27','S59','S36','S60','S41','S48'];
const EVENINGS = {A:'eric',B:'nick',C:'damir',D:'alice'};
const E_CODES = {E:'A',N:'B',D:'C',A:'D'};
const indexedChoices = /^([A-D])\.\s+(.*)$/;
const isCommon = t => /^(?:Общее продолжение|Переход)/i.test(t);
const isTechnical = t => /^Техническ/i.test(t) || /^Переход S\d+/i.test(t);
const isChoiceHeader = t => /^Выбор\s+S\d{2}-C\d+/i.test(t);
const isConditionalHeader = t => /^Отклик(?:\s|$)|^Продолжение\s+S\d+-C\d+/i.test(t);
function codeChoice(choices,id){return choices[id] ?? null;}
function oneOf(choices,id,codes){return codes.includes(codeChoice(choices,id));}
function derived(choices) {
  return {
    careerThesis: { A:'people',B:'place',C:'own-choice' }[choices['S02-C1']],
    'damir-care': { A:'warm',B:'neutral',C:'personal' }[choices['S08-C1']],
    weatherChoice: { A:'nick',B:'erik',C:'damir' }[choices['S05-C1']],
    skogafossVoice: { A:'eric',B:'nick',C:'damir' }[choices['S09-C1']],
    ericTone: { A:'playful',B:'quiet' }[choices['S10-C1']],
    eveningState: EVENINGS[choices['S17-C2']],
    routeIntent: EVENINGS[choices['S26-C1']],
    routeStatus: ['S32-C1','S33-C1','S34-C1'].some(id=>choices[id]==='C')?'closed':(['S32-C1','S33-C1','S34-C1'].some(id=>choices[id]==='B')?'paused':'active')
  };
}

/** All conditional headings in the approved S01–S26/S65/S66 manuscript must be accounted for.
 * Unknown conditional markers throw rather than leaking mutually exclusive prose.
 */
export function conditional(sceneId, title, choices) {
  const t=title.trim();
  if (isCommon(t) || isChoiceHeader(t) || isTechnical(t)) return true;
  const vars=derived(choices);
  const inlineValues=[...t.matchAll(/`([\w.-]+)=([\w.-]+)`/g)];
  if(indexedChoices.test(t) && inlineValues.length && inlineValues.every(x=>Object.hasOwn(vars,x[1]))) {
    return inlineValues.some(x=>vars[x[1]]===x[2]);
  }
  if (/^S17-N-[ABC]\b/i.test(t)) return oneOf(choices,'S15-C1', t[6]);
  if (/^S17-E-[AB]\b/i.test(t)) return oneOf(choices,'S13-C1', t[6]);
  if (/^S17-D-[AB]\b/i.test(t)) return oneOf(choices,'S16-C1', t[6]);
  let m=t.match(/^S18-([KSL])\b/);
  if(m)return oneOf(choices,'S18-C1', {K:'A',S:'B',L:'C'}[m[1]]);
  m=t.match(/^S19-P-([ABC])\b/);
  if(m)return oneOf(choices,'S19-C1',m[1]);
  m=t.match(/^S19-([KHD])\b/);
  if(m)return oneOf(choices,'S19-C2',{K:'A',H:'B',D:'C'}[m[1]]);
  m=t.match(/^S20-([KTL])\b/);
  if(m)return oneOf(choices,'S20-C1',{K:'A',T:'B',L:'C'}[m[1]]);
  m=t.match(/^S21-M-([ABC])\b/);
  if(m)return oneOf(choices,'S21-C1',m[1]);
  m=t.match(/^S61-R-([ABC])\b/);
  if(m)return oneOf(choices,'S21-C1',m[1]);
  m=t.match(/^S2([345])-I-([KSLHD])\b/);
  if(m){
    const config={ '3':['A','S18-C1',{K:'A',S:'B',L:'C'}], '4':['B','S19-C2',{K:'A',H:'B',D:'C'}], '5':['C','S20-C1',{K:'A',T:'B',L:'C'}]}[m[1]];
    return oneOf(choices,'S17-C2',config[0]) && oneOf(choices,config[1],config[2][m[2]]);
  }
  if(/^S25-E-PAGE\b/.test(t))return oneOf(choices,'S23-C1','A');
  if(/^S25-E-READERS\b/.test(t))return oneOf(choices,'S23-C1','B');
  if(/^S58-P-C\b/.test(t))return oneOf(choices,'S58-C1','C');
  if(/^S58-P-OTHER\b/.test(t))return oneOf(choices,'S58-C1','ABD');
  m=t.match(/^S26-[ENDA]-([ENDA])\b/);
  if(m)return oneOf(choices,'S17-C2',E_CODES[m[1]]);
  // Explicit backtick state predicates in the literary script (including 'or').
  if(t.startsWith('Если ')) {
    const matches=[...t.matchAll(/`([\w.-]+)=([\w.-]+)`/g)];
    if(matches.length){
      // Later payoff headings explicitly reference authored earlier choices.
      if(matches.every(x=>/^S\d{2}-C\d+$/.test(x[1])))
        return matches.some(x=>choices[x[1]]===x[2]);
      const sameName=matches.every(x=>x[1]===matches[0][1]);
      if(sameName && Object.hasOwn(vars,matches[0][1]))return matches.some(x=>vars[x[1]]===x[2]);
      throw new Error(`Unrecognized state condition ${sceneId}: ${t}`);
    }
    m=t.match(/S(\d{2})-C(\d)/);
    if(m){
      const id=`S${m[1]}-C${m[2]}`;
      if (/выбрано\s+[ABC]\b/.test(t))return oneOf(choices,id,t.match(/выбрано\s+([ABC])\b/)[1]);
      if (id==='S01-C1')return oneOf(choices,id,
        /Ником или Дамиром/.test(t) ? 'BC' :
        /Дамиром/.test(t) && !/Ником или Дамиром/.test(t) ? 'C' :
        /Эриком или Ником/.test(t) ? 'AB' :
        /Эриком/.test(t) ? 'A' : /Ником/.test(t) ? 'B':'?');
      if (id==='S02-C1')return oneOf(choices,id,/люд/i.test(t)?'A':/мест/i.test(t)?'B':/личное решение|собственный выбор/i.test(t)?'C':'?');
      if (id==='S05-C1')return oneOf(choices,id,/Ника или Дамира/.test(t)?'AC':/Эрика/.test(t)?'B':/Нику/.test(t)?'A':/Дамиром/.test(t)?'C':'?');
      if (id==='S04-C1')return oneOf(choices,id,/разрешила/.test(t)?'A':/отказалась/.test(t)?'B':/группов/.test(t)?'C':'?');
      if (id==='S08-C1')return oneOf(choices,id,/кофе/.test(t)?'A':/дистанц/.test(t)?'B':/Брюссел/.test(t)?'C':'?');
      throw new Error(`Unknown choice conditional ${sceneId}: ${t}`);
    }
    throw new Error(`Unrecognized conditional heading ${sceneId}: ${t}`);
  }
  return true;
}

function typeOfHeading(t) {
  if(isChoiceHeader(t))return 'choice';
  if(isConditionalHeader(t))return 'conditional-group';
  if(/^Если(?:\s|$)|^S\d{2}-[A-Z]/i.test(t))return 'conditional';
  if(isTechnical(t))return 'technical';
  return 'other';
}

export function compileScenePlayback(scene, choices={}) {
  const input=scene.chunks;
  const output=[];
  const paragraphs=(chunk,chunkIndex)=>{
    for(let paragraphIndex=0;paragraphIndex<chunk.paragraphs.length;paragraphIndex++){
      let p=chunk.paragraphs[paragraphIndex];
      if (p.startsWith('- ') && /→\s*S\d+/.test(p)) continue;
      if (/^Выбирается ровно одна линия/.test(p))continue;
      if (/^Утром дня 11\s*[—–-]\s*S22/.test(p))continue;
      if (/^К вечеру вещи высохли/.test(p))p=p.replace(/Утром дня 11\s*[—–-]\s*S22\.?.*$/,'Утром они выехали дальше.');
      if(p)output.push({type:'paragraph',text:p,sourceRef:{chunk:chunkIndex,paragraph:paragraphIndex}});
    }
  };
  let halted=false;
  function walk(from,to){
    let i=from;
    while(i<to && !halted){
      const item=input[i];const kind=typeOfHeading(item.title);
      if (kind==='technical') {i++;continue;}
      if (kind==='conditional-group') {
        const level=item.level;const groupOptions=[];let j=i+1;
        const optionLevel=level+1;
        while(j<to){
          const next=input[j];
          if(next.level<=level|| (next.level===optionLevel&&isCommon(next.title)))break;
          const mo=next.title.match(indexedChoices);
          if(mo&&next.level===optionLevel)groupOptions.push({at:j,code:mo[1],title:next.title});
          j++;
        }
        if(groupOptions.length===0)throw new Error(`Empty conditional group ${scene.id}: ${item.title}`);
        const postStart=input.findIndex((ch,idx)=>idx>groupOptions[groupOptions.length-1].at && idx<j && ch.level===optionLevel && /^S\d{2}-[A-Z]/.test(ch.title));
        let selected=null;
        for(const opt of groupOptions){
          if(conditional(scene.id,opt.title,choices) && (
            /S\d+-C\d+/.test(item.title)&&!item.title.includes('вечер')?oneOf(choices,item.title.match(/S\d+-C\d+/)[0],opt.code):true
          )) {selected=opt;break;}
        }
        if(!selected)throw new Error(`Unresolved conditional group ${scene.id}: ${item.title}`);
        const idx=groupOptions.indexOf(selected);
        walk(selected.at,idx+1<groupOptions.length?groupOptions[idx+1].at:(postStart>=0?postStart:j));
        if(postStart>=0)walk(postStart,j);
        i=j;continue;
      }
      if(kind==='choice'){
        const id=item.title.match(/S\d{2}-C\d+/)?.[0];
        if(!id)throw new Error(`No choice id ${scene.id}`);
        const level=item.level;const optionLevel=level+1;
        let options=[];let j=i+1;
        // The literary S17 evening choice is a target list, not option subsections.
        if(id==='S17-C2'){
          options=[
            {code:'A',label:'Пойти с Эриком к маяку'},
            {code:'B',label:'Пойти с Ником в бассейн'},
            {code:'C',label:'Принять приглашение Дамира на завтрашний вечер'},
            {code:'D',label:'Провести время самостоятельно'}
          ];j=i+1;
        }else{
          while(j<to){
            const next=input[j];
            if(next.level<=level || (next.level===optionLevel&&isCommon(next.title) && !/исхода/.test(next.title)))break;
            const opt=next.title.match(indexedChoices);
            if(opt&&next.level===optionLevel)options.push({at:j,code:opt[1],label:opt[2].replace(/\s*\([^)]*\)/g,'').trim(),localizedLabel:(next.localizedTitle??next.title).match(indexedChoices)?.[2]?.replace(/\s*\([^)]*\)/g,'').trim()??opt[2].replace(/\s*\([^)]*\)/g,'').trim()});
            j++;
          }
        }
        if(options.length<2)throw new Error(`Incomplete options for ${id}: ${options.length}`);
        let selected=codeChoice(choices,id);
        if(!selected){
          output.push({type:'choice',id,options:options.map(o=>({code:o.code,label:o.localizedLabel??o.label})),sourceRef:{chunk:i,paragraph:0}});
          halted=true;return false;
        }
        const optionIndex=options.findIndex(x=>x.code===selected);
        if(optionIndex<0)throw new Error(`Invalid ${id}=${selected}`);
        if(id!=='S17-C2'){
          const opt=options[optionIndex];
          walk(opt.at,optionIndex+1<options.length?options[optionIndex+1].at:j);
        }
        // after S17-C2, switch scene immediately, not to another literary paragraph.
        if(id==='S17-C2')return false;
        i=j;continue;
      }
      if(kind==='conditional' && !conditional(scene.id,item.title,choices)){i++;continue;}
      paragraphs(item,i);i++;
    }
    return true;
  }
  walk(0,input.length);
  return output;
}

export function nextLiteraryScene(sceneId, choices={}) {
  if(sceneId==='S17')return ({A:'S18',B:'S19',C:'S20',D:'S21'})[choices['S17-C2']]??null;
  if(['S18','S19','S20','S61'].includes(sceneId))return 'S22';
  if(sceneId==='S21')return 'S61';
  // Pre-lock common chapters remain playable without an early route selection.
  if(sceneId==='S26')return 'S27';
  if(order.indexOf(sceneId)>=0 && order.indexOf(sceneId)<order.indexOf('S26'))return order[order.indexOf(sceneId)+1];
  if(sceneId==='S27')return 'S59';
  if(sceneId==='S48'){
    const route=EVENINGS[choices['S26-C1']];
    const closed=['S32-C1','S33-C1','S34-C1'].some(id=>choices[id]==='C')||
      ['S37-C1','S38-C1','S39-C1'].some(id=>choices[id]==='B')||
      choices['S42-C1']!=='A';
    return closed||route==='alice'?'S47':({eric:'S44',nick:'S45',damir:'S46'})[route]??null;
  }
  if(['S44','S45','S46','S47'].includes(sceneId))return null;
  if(sceneId==='S43')return 'S48';
  const selected=EVENINGS[choices['S26-C1']];
  if(!selected)return null;
  const crisisChoice={eric:'S32-C1',nick:'S33-C1',damir:'S34-C1'}[selected];
  const crisisClosed=crisisChoice && choices[crisisChoice]==='C';
  const closeAfterClimax=['S37-C1','S38-C1','S39-C1'].some(id=>choices[id]==='B');
  const romanceEnded=crisisClosed || closeAfterClimax;
  // A pause does not reopen another love interest; the player may resume or
  // close the current route explicitly at its next chapter.
  if(sceneId==='S35')return 'S63';
  if(sceneId==='S63')return 'S36';
  if(sceneId==='S40')return 'S64';
  if(sceneId==='S64')return 'S60';
  if(sceneId==='S60')return 'S41';
  if(sceneId==='S41')return romanceEnded||selected==='alice'?'S43':'S42';
  if(sceneId==='S42')return choices['S42-C1']==='A'?'S48':'S43';

  if(sceneId==='S36')return romanceEnded||selected==='alice'?'S40':({eric:'S37',nick:'S38',damir:'S39'})[selected];
  const routeMap={
    eric:{S59:'S28',S28:'S49',S49:'S32',S32:crisisClosed?'S35':'S50',S50:'S36',S37:closeAfterClimax?'S40':'S51',S51:'S60'},
    nick:{S59:'S29',S29:'S52',S52:'S33',S33:crisisClosed?'S35':'S53',S53:'S36',S38:closeAfterClimax?'S40':'S54',S54:'S60'},
    damir:{S59:'S30',S30:'S55',S55:'S34',S34:crisisClosed?'S35':'S56',S56:'S36',S39:closeAfterClimax?'S40':'S57',S57:'S60'},
    alice:{S59:'S31',S31:'S62',S62:'S35'}
  };
  return routeMap[selected]?.[sceneId]??null;
}

export function cleanLiteraryText(text){return String(text).replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\*([^*]+)\*/g,'$1');}
