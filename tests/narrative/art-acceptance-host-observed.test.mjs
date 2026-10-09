import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { productSnapshot, repositoryIdentity, verifyArtAcceptance } from '../../tools/release/art-acceptance.mjs';
import { HOST_OBSERVED_ART_ASSURANCE, HOST_OBSERVED_ART_POLICY, verifyHostObservedArtControl } from '../../tools/release/host-observed-art-review.mjs';

const ROLES = ['ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web'];
const VIEWS = [['desktop',1920,900],['portrait390',390,844],['portrait360',360,640]];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function write(root, name, value) {
  const file=path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,typeof value==='string'||Buffer.isBuffer(value) ? value : JSON.stringify(value,null,2)+'\n');
  return hash(fs.readFileSync(file));
}
function fakeHeader(width,height) {
  // Controlled synthetic PNG-header fixture; production bytes are actual browser PNGs.
  const b=Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
  b.writeUInt32BE(13,8);b.write('IHDR',12,'ascii');
  b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);
  return b;
}
function makeFixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'host-observed-art-v1-'));
  execFileSync('git',['init','-q'],{cwd:root});
  execFileSync('git',['config','user.email','fixture@example.invalid'],{cwd:root});
  execFileSync('git',['config','user.name','fixture'],{cwd:root});
  write(root,'assets/a.png','fixture-asset');
  write(root,'assets/a.webp','fixture-runtime');
  const manifest='assets/asset-manifest.json', rights='assets/provenance/rights-manifest.json';
  write(root,manifest,{assets:[{id:'a',path:'assets/a.png',runtimePath:'assets/a.webp'}]});
  write(root,rights,{assets:[{path:'assets/a.png'}]});
  write(root,'src/literary-visual-directions.js','assets/a.png assets/a.webp');
  execFileSync('git',['add','.'],{cwd:root});
  execFileSync('git',['commit','-qm','fixture'],{cwd:root});
  const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const scenes=[], map=new Map();
  for(let i=1;i<=66;i++){
    const sceneId='S'+String(i).padStart(2,'0'),captures=[];
    for(const [name,width,height] of VIEWS) {
      const screenshot='artifacts/evidence/frames/'+sceneId+'-'+name+'.png';
      const png=fakeHeader(width,height);
      const checksum=write(root,screenshot,png);
      const capture={sceneId,cue:'opening',currentHead:sourceHead,
        viewport:{name,width,height},screenshot,screenshotSha256:checksum,
        screenshotBytes:png.length,manifest:{id:'a'},readback:{sceneId,assetMatches:true,overflow:false,internalScroll:false},
        errors:[],failed:[],runError:null};
      captures.push(capture);map.set(sceneId+':'+name,capture);
    }
    scenes.push({sceneId,cue:'opening',captures});
  }
  const matrix={status:'PASS',sourceHead,scope:{expectedScenes:66,coveredScenes:66,captures:198},failures:[],scenes};
  const matrixPath='artifacts/evidence/matrix.json',matrixSha=write(root,matrixPath,matrix);
  const reviewRecords=[];
  for(const [roleIndex,role] of ROLES.entries())for(const scene of scenes){
    const i=Number(scene.sceneId.slice(1));
    const evidenceRefs=[],visualEvidence=[],attachments=[];
    for(const capture of scene.captures){
      const ref='codex-input-image-'+(attachments.length+1);
      evidenceRefs.push(ref);
      const info={ref,sceneId:scene.sceneId,cue:capture.cue,viewport:capture.viewport.name,
        path:capture.screenshot,sha256:capture.screenshotSha256,bytes:capture.screenshotBytes};
      visualEvidence.push({...info,observation:'The characters and environment are clearly composed for '+scene.sceneId+' '+capture.viewport.name,verdict:'PASS'});
      attachments.push({...info,mime:'image/png',dimensions:[capture.viewport.width,capture.viewport.height]});
    }
    const responseText='Observed '+scene.sceneId+' in all three viewport renders with grounded art composition for '+role;
    const review={
      role,phase:'acceptance',status:'PASS',semanticVerdict:'PASS',sourceHead,actualPixelsReceived:true,
      reviewedItems:[scene.sceneId+':opening'],evidenceRefs,receivedEvidenceRefs:[...evidenceRefs],
      responseText, decision:'This scene passes the independent visual review on all supplied screens.',
      visualEvidence,findings:[],unresolved:[],
      hostObservedReceipt:{
        schema:'codex.web.host-observed.receipt.v1',policy:HOST_OBSERVED_ART_POLICY,
        providerAttested:false,providerTaskId:null,providerResponseId:null,reviewTraceId:null,
        sourceHead,role,
        route:{model:'chatgpt-web/gpt-6-sol',reasoningEffort:'high',providerAttested:false},
        browser:{traceId:'trace-'+roleIndex+'-'+i,userTurnIdentity:'user-'+roleIndex+'-'+i,
          assistantTurnIdentity:'assistant-'+roleIndex+'-'+i,submission:'accepted',completion:'final'},
        response:{status:'completed',textSha256:hash(responseText)},
        attachments
      }
    };
    const file='artifacts/evidence/reviews/'+role+'-'+scene.sceneId+'.json';
    const sha256=write(root,file,review);
    reviewRecords.push({file,review,reference:{path:file,sha256,role,actualPixelsReceived:true,taskId:null,reviewTraceId:null}});
  }
  const record={
    schemaVersion:5,policy:HOST_OBSERVED_ART_POLICY,assurance:HOST_OBSERVED_ART_ASSURANCE,
    recordType:'production-art-acceptance',status:'PASS',verdict:'PASS_PRODUCTION_ART_66_66',
    sourceProductHead:sourceHead,repository:{...repositoryIdentity(root),sourceProductHead:sourceHead},
    sourceProductSnapshot:productSnapshot(root),
    acceptedSceneCoverage:{expected:66,covered:66,remaining:0},
    placeholders:0,brokenPaths:0,manifestSha256:hash(fs.readFileSync(path.join(root,manifest))),
    rightsManifestSha256:hash(fs.readFileSync(path.join(root,rights))),
    acceptedAssets:[{path:'assets/a.png',sha256:hash(fs.readFileSync(path.join(root,'assets/a.png')))}],
    runtimeAssets:[{path:'assets/a.webp',sha256:hash(fs.readFileSync(path.join(root,'assets/a.webp')))}],
    webHigh:{assurance:HOST_OBSERVED_ART_ASSURANCE,policy:HOST_OBSERVED_ART_POLICY,
      providerAttested:false,result:'PASS',reviews:reviewRecords.map(x=>x.reference)},
    evidence:{matrix:{path:matrixPath,sha256:matrixSha,sourceHead}},
    compatibility:{manifestMappings:'PASS'},verifier:{type:'source-bound-production-art-verifier',source:'test fixture'}
  };
  return {root,record,reviewRecords,map,matrix};
}
function mutate(f,index,fn) {
  const target=f.reviewRecords[index];
  fn(target.review);
  target.reference.sha256=write(f.root,target.file,target.review);
}
const check=f=>verifyArtAcceptance({root:f.root,recordOverride:f.record});
test('HOST_OBSERVED_ART_ACCEPTANCE_V1 covers 594 frame-role pairs and accepts no provider IDs',()=>{
  const f=makeFixture(); const x=check(f);
  assert.equal(x.status,'PASS',JSON.stringify(x));
  assert.equal(x.assurance,HOST_OBSERVED_ART_ASSURANCE);
});
test('accepts observed user-turn acknowledgement with no synthetic user ID and viewport bound by physical PNG/matrix',()=>{
  const f=makeFixture();
  mutate(f,0,r=>{
    r.hostObservedReceipt.browser.userTurnIdentity=null;
    r.hostObservedReceipt.browser.submissionEvidence='user_turn';
    for(const item of r.hostObservedReceipt.attachments) {
      item.viewport=null;
      item.dimensions=null;
    }
  });
  const result=check(f);
  assert.equal(result.status,'PASS',JSON.stringify(result));
});
test('S38 scoped control verifies three real-role contracts for three viewports, not full season',()=>{
  const f=makeFixture();
  const entries=f.reviewRecords.filter(x=>x.review.reviewedItems.includes('S38:opening'))
    .map(x=>({reference:x.reference,evidence:x.review}));
  const result=verifyHostObservedArtControl({
    projectRoot:f.root,matrix:f.matrix,sourceHead:f.record.sourceProductHead,
    sceneId:'S38',reviewEntries:entries
  });
  assert.equal(result.status,'PASS',JSON.stringify(result));
  assert.equal(result.imageReviews,9);
  assert.equal(result.controlSceneId,'S38');
  f.record.webHigh.reviews=entries.map(x=>x.reference);
  assert.equal(check(f).code,'ART_ACCEPTANCE_HOST_COVERAGE_INCOMPLETE');
});
test('S38 scoped control accepts a one-scene runtime matrix without promoting it to full season',()=>{
  const f=makeFixture();
  const scopedMatrix={...f.matrix,status:'BLOCKED',scope:{expectedScenes:66,coveredScenes:1,expectedCaptures:3,captures:3},scenes:[f.matrix.scenes[37]]};
  const entries=f.reviewRecords.filter(x=>x.review.reviewedItems.includes('S38:opening'))
    .map(x=>({reference:x.reference,evidence:x.review}));
  const result=verifyHostObservedArtControl({
    projectRoot:f.root,matrix:scopedMatrix,sourceHead:f.record.sourceProductHead,
    sceneId:'S38',reviewEntries:entries
  });
  assert.equal(result.status,'PASS',JSON.stringify(result));
  assert.equal(result.imageReviews,9);
  assert.equal(result.controlSceneId,'S38');
});
test('S38 scoped control blocks a host-observed GPT-5.6 route under the GPT-6 Sol policy',()=>{
  const f=makeFixture();
  const entries=f.reviewRecords.filter(x=>x.review.reviewedItems.includes('S38:opening'))
    .map(x=>({reference:x.reference,evidence:{...x.review,hostObservedReceipt:{...x.review.hostObservedReceipt,route:{...x.review.hostObservedReceipt.route,model:'gpt-5.6-sol'}}}}));
  const result=verifyHostObservedArtControl({
    projectRoot:f.root,matrix:f.matrix,sourceHead:f.record.sourceProductHead,
    sceneId:'S38',reviewEntries:entries
  });
  assert.equal(result.code,'BLOCKED_MODEL_ROUTE_POLICY_MISMATCH',JSON.stringify(result));
});
test('S38 scoped control rejects any extra scene or missing viewport',()=>{
  const f=makeFixture();
  const entries=f.reviewRecords.filter(x=>x.review.reviewedItems.includes('S38:opening'))
    .map(x=>({reference:x.reference,evidence:x.review}));
  entries[0].evidence.visualEvidence.pop();
  entries[0].evidence.evidenceRefs.pop();
  entries[0].evidence.receivedEvidenceRefs.pop();
  entries[0].evidence.hostObservedReceipt.attachments.pop();
  assert.equal(verifyHostObservedArtControl({
    projectRoot:f.root,matrix:f.matrix,sourceHead:f.record.sourceProductHead,
    sceneId:'S38',reviewEntries:entries
  }).code,'ART_ACCEPTANCE_HOST_COVERAGE_INCOMPLETE');
  assert.equal(verifyHostObservedArtControl({
    projectRoot:f.root,matrix:f.matrix,sourceHead:f.record.sourceProductHead,
    sceneId:'S67',reviewEntries:entries
  }).code,'ART_ACCEPTANCE_HOST_CONTROL_INVALID');
});
const cases=[
  ['missing host receipt',f=>mutate(f,0,r=>{delete r.hostObservedReceipt}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['provider attested spoof',f=>mutate(f,0,r=>{r.hostObservedReceipt.providerAttested=true}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['fabricated provider task ID',f=>mutate(f,0,r=>{r.hostObservedReceipt.providerTaskId='local-id'}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['missing browser user identity',f=>mutate(f,0,r=>{r.hostObservedReceipt.browser.userTurnIdentity=''}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['wrong model route',f=>mutate(f,0,r=>{r.hostObservedReceipt.route.model='chatgpt-web/light'}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['wrong effort',f=>mutate(f,0,r=>{r.hostObservedReceipt.route.reasoningEffort='medium'}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['missing user-turn ack when browser has no user ID',f=>mutate(f,0,r=>{
    r.hostObservedReceipt.browser.userTurnIdentity=null;
  }),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['fabricated user-turn ack value',f=>mutate(f,0,r=>{
    r.hostObservedReceipt.browser.userTurnIdentity=null;
    r.hostObservedReceipt.browser.submissionEvidence='send_clicked';
  }),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['explicitly wrong attachment viewport',f=>mutate(f,0,r=>{
    r.hostObservedReceipt.attachments[0].viewport='portrait390';
  }),'ART_ACCEPTANCE_HOST_FRAME_MISMATCH'],
  ['explicitly wrong attachment dimensions',f=>mutate(f,0,r=>{
    r.hostObservedReceipt.attachments[0].dimensions=[390,844];
  }),'ART_ACCEPTANCE_HOST_FRAME_MISMATCH'],
  ['response tampered',f=>mutate(f,0,r=>{r.responseText+=' appended'}),'ART_ACCEPTANCE_HOST_RECEIPT_INVALID'],
  ['duplicate host browser trace',f=>mutate(f,1,r=>{r.hostObservedReceipt.browser.traceId=f.reviewRecords[0].review.hostObservedReceipt.browser.traceId}),'ART_ACCEPTANCE_HOST_RECEIPT_DUPLICATE'],
  ['missing one viewport for role',f=>mutate(f,0,r=>{
    r.visualEvidence.pop();r.evidenceRefs.pop();r.receivedEvidenceRefs.pop();r.hostObservedReceipt.attachments.pop();
  }),'ART_ACCEPTANCE_HOST_COVERAGE_INCOMPLETE'],
  ['wrong actual screenshot bytes',f=>mutate(f,0,r=>{
    r.visualEvidence[0].sha256='0'.repeat(64);r.hostObservedReceipt.attachments[0].sha256='0'.repeat(64);
  }),'ART_ACCEPTANCE_HOST_COVERAGE_DUPLICATE_OR_MISMATCH'],
  ['wrong cue',f=>mutate(f,0,r=>{
    r.visualEvidence[0].cue='wrong';r.hostObservedReceipt.attachments[0].cue='wrong';
  }),'ART_ACCEPTANCE_HOST_FRAME_MISMATCH'],
  ['stale source',f=>mutate(f,0,r=>{r.sourceHead='f'.repeat(40)}),'ART_ACCEPTANCE_EVIDENCE_SOURCE_MISMATCH'],
  ['semantic rework',f=>mutate(f,0,r=>{r.status='REWORK'}),'ART_ACCEPTANCE_WEB_EVIDENCE_NOT_PASS'],
  ['unresolved findings',f=>mutate(f,0,r=>{r.unresolved=['S01-crop']}),'ART_ACCEPTANCE_HOST_REVIEW_INVALID'],
  ['over ten image attachments',f=>mutate(f,0,r=>{
    for(let i=4;i<=11;i++){const ref='codex-input-image-'+i;const a={...r.hostObservedReceipt.attachments[0],ref};
      r.hostObservedReceipt.attachments.push(a);r.visualEvidence.push({...r.visualEvidence[0],ref});
      r.evidenceRefs.push(ref);r.receivedEvidenceRefs.push(ref);}
  }),'ART_ACCEPTANCE_HOST_ATTACHMENTS_INVALID'],
  ['bad accepted image format',f=>mutate(f,0,r=>{
    r.hostObservedReceipt.attachments[0].mime='image/jpeg';
  }),'ART_ACCEPTANCE_HOST_FRAME_MISMATCH'],
  ['incorrect source policy',f=>{f.record.policy='visual-content'},'ART_ACCEPTANCE_ASSURANCE_INVALID'],
  ['missing role review',f=>{f.record.webHigh.reviews.pop()},'ART_ACCEPTANCE_HOST_COVERAGE_INCOMPLETE'],
];
for(const [name,update,expected] of cases){
  test('host-observed blocks '+name,()=>{
    const f=makeFixture();update(f);
    const result=check(f);
    assert.equal(result.code,expected,JSON.stringify(result));
  });
}
test('host-observed rejects changed physical PNG',()=>{
  const f=makeFixture();
  fs.writeFileSync(path.join(f.root,f.map.get('S01:desktop').screenshot),'altered');
  assert.equal(check(f).code,'ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_HASH_MISMATCH');
});
test('host-observed rejects record from wrong source even if role files match',()=>{
  const f=makeFixture();f.record.sourceProductHead='0'.repeat(40);
  assert.equal(check(f).code,'ART_ACCEPTANCE_SOURCE_HEAD_NOT_ANCESTOR');
});
