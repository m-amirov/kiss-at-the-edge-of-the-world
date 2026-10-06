function targetName(target){
  if(typeof target==='string')return target;
  if(!target)return 'unknown';
  return target.dataset?.choiceId ?? target.id ?? target.className ?? target.tagName ?? 'unknown';
}

export function createInputLifecycle({debug=false,logger=()=>{}}={}){
  let generation=0;
  let context={generation:0,sceneId:null,choiceId:null};
  let semanticActionCount=0;
  const pointers=new Map();
  const trace=[];
  const record=(event,action,accepted,reason,current=context)=>{
    const entry={timestamp:performance.now(),pointerId:event?.pointerId??null,eventType:event?.type??'callback',pointerType:event?.pointerType??null,target:targetName(event?.target),sceneId:current.sceneId,choiceId:current.choiceId,generation:current.generation,action,accepted,reason,defaultPrevented:Boolean(event?.defaultPrevented),propagationStopped:Boolean(event?.cancelBubble)};
    if(debug){trace.push(entry);if(trace.length>256)trace.shift();logger(entry);}
    return {accepted,reason,entry};
  };
  const same=(a,b)=>Boolean(a&&b&&a.generation===b.generation&&a.sceneId===b.sceneId&&a.choiceId===b.choiceId);
  return Object.freeze({
    beginRender(next){context=Object.freeze({generation:++generation,sceneId:next.sceneId,choiceId:next.choiceId??null});record(null,'render',true,'render',context);return context;},
    pointerDown(event,owner=context){
      if(!same(owner,context))return record(event,'pointerdown',false,'stale-render',context);
      pointers.set(event.pointerId,{owner,used:false});return record(event,'pointerdown',true,'owned',context);
    },
    cancelPointer(event){pointers.delete(event.pointerId);return record(event,'pointercancel',true,'cancelled',context);},
    pointerUp(event,owner=context,action){
      const pointer=pointers.get(event.pointerId);pointers.delete(event.pointerId);
      if(!pointer)return record(event,action,false,'missing-pointerdown',context);
      if(pointer.used)return record(event,action,false,'gesture-already-used',context);
      if(!same(pointer.owner,owner)||!same(owner,context))return record(event,action,false,'stale-gesture',context);
      pointer.used=true;semanticActionCount++;return record(event,action,true,'owned-gesture',context);
    },
    click(event,owner=context,action){
      if(event.detail!==0)return record(event,action,false,'unowned-click',context);
      if(!same(owner,context))return record(event,action,false,'stale-keyboard-click',context);
      semanticActionCount++;return record(event,action,true,'keyboard-or-at',context);
    },
    callback(owner,action){
      if(!same(owner,context))return record(null,action,false,'stale-callback',context);
      return record(null,action,false,'callback-requires-explicit-owner',context);
    },
    snapshot(){return {generation:context.generation,sceneId:context.sceneId,choiceId:context.choiceId,semanticActionCount,trace:[...trace]};}
  });
}
