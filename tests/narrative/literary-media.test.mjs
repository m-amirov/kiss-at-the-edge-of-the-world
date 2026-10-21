import test from 'node:test';
import assert from 'node:assert/strict';
import {createImagePreloader,createVisualLayerController} from '../../src/literary-media.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function pending(){let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
function root(){
 return{dataset:{},children:[],
   prepend(n){n.parent=this;n.isConnected=true;this.children.unshift(n)},
   insertBefore(n,before){n.parent=this;n.isConnected=true;const i=this.children.indexOf(before);if(i<0)this.children.push(n);else this.children.splice(i,0,n)}
 };
}
function node(id){
 return{id,parent:null,isConnected:false,
   classList:{set:new Set(),add(...xs){for(const x of xs)this.set.add(x)},remove(...xs){for(const x of xs)this.set.delete(x)}},
   get nextSibling(){const i=this.parent.children.indexOf(this);return this.parent.children[i+1]??null},
   remove(){if(!this.parent)return;const i=this.parent.children.indexOf(this);this.parent.children.splice(i,1);this.parent=null;this.isConnected=false}
 };
}
test('image preload waits for decode, deduplicates repeated sources, bounds cache',async()=>{
 let count=0;class ImageStub{set src(v){count++;Promise.resolve().then(()=>this.onload())}decode(){return Promise.resolve()}}
 const c=createImagePreloader({ImageClass:ImageStub,capacity:2});
 const p=c.preload('a.webp');assert.equal(c.preload('a.webp'),p);assert.equal(await p,true);
 assert.equal(count,1);assert.equal(await c.preload('b.webp'),true);assert.equal(await c.preload('c.webp'),true);assert.equal(c.getSize(),2);
});
test('repeat lines reuse same picture and do not restart sprite animation',()=>{
 const container=root(),c=createVisualLayerController({root:container,preload:()=>Promise.resolve(true)});
 assert.equal(c.present({key:'A',build:()=>node('A')}),'mounted');
 const first=container.children[0];
 for(let i=0;i<20;i++)assert.equal(c.present({key:'A',build:()=>node('wrong')}),'reused');
 assert.equal(container.children[0],first);assert.equal(c.getState().transitions,0);assert.equal(c.getState().reused,20);
});
test('old picture remains until next image is decoded and crossfaded',async()=>{
 const container=root(),p=pending(),frames=[],timers=[];
 const c=createVisualLayerController({root:container,preload:()=>p.promise,frame:fn=>frames.push(fn),schedule:fn=>timers.push(fn)});
 c.present({key:'A',build:()=>node('A')});const old=container.children[0];
 c.present({key:'B',assets:['B.webp'],build:()=>node('B')});
 assert.deepEqual(container.children.map(n=>n.id),['A']);
 p.resolve(true);await flush();
 assert.deepEqual(container.children.map(n=>n.id),['A','B']);
 assert.equal(container.children[1].classList.set.has('scene-visual-next'),true);
 for(const fn of frames)fn();
 assert.equal(container.children[1].classList.set.has('scene-visual-visible'),true);
 for(const fn of timers)fn();
 assert.deepEqual(container.children.map(n=>n.id),['B']);assert.equal(old.isConnected,false);
});
test('fast taps cancel stale loads, including a return to previous image',async()=>{
 const container=root(),p=pending(),c=createVisualLayerController({root:container,preload:u=>u==='B.webp'?p.promise:Promise.resolve(true),frame:f=>f(),schedule:f=>f()});
 c.present({key:'A',build:()=>node('A')});
 c.present({key:'B',assets:['B.webp'],build:()=>node('B')});
 c.present({key:'A',build:()=>node('wrong')});
 p.resolve(true);await flush();
 assert.deepEqual(container.children.map(n=>n.id),['A']);
 c.present({key:'C',assets:['C.webp'],build:()=>node('C')});await flush();
 assert.deepEqual(container.children.map(n=>n.id),['C']);
});
test('failed preloads preserve the current visual and report an error',async()=>{
 const container=root(),c=createVisualLayerController({root:container,preload:()=>Promise.resolve(false)});
 c.present({key:'A',build:()=>node('A')});
 c.present({key:'bad',assets:['bad.webp'],build:()=>node('bad')});await flush();
 assert.deepEqual(container.children.map(n=>n.id),['A']);
 assert.equal(container.dataset.visualError,'preload-failed');assert.equal(c.getState().failed,1);
});
