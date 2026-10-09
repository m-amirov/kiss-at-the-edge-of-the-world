import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { productSnapshot, repositoryIdentity, verifyArtAcceptance } from '../../tools/release/art-acceptance.mjs';

const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (root, name, data) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
  return digest(file);
};
const ROLES = ['ceos_reasoner_web','ceos_bulk_checker_web','ceos_art_director_web'];
const RISK = new Set(['S01','S07','S18','S26','S38','S44','S63']);
function makeFixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'visual-acceptance-v4-'));
  execFileSync('git',['init','-q'],{cwd:root});
  execFileSync('git',['config','user.email','fixture@example.invalid'],{cwd:root});
  execFileSync('git',['config','user.name','fixture'],{cwd:root});
  write(root,'assets/a.png','fixture-asset');
  write(root,'assets/a.webp','fixture-runtime');
  const manifest='assets/asset-manifest.json',rights='assets/provenance/rights-manifest.json';
  write(root,manifest,{assets:[{id:'a',path:'assets/a.png',runtimePath:'assets/a.webp'}]});
  write(root,rights,{assets:[{path:'assets/a.png'}]});
  write(root,'src/literary-visual-directions.js','assets/a.png assets/a.webp');
  execFileSync('git',['add','.'],{cwd:root});
  execFileSync('git',['commit','-qm','fixture'],{cwd:root});
  const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const frames=new Map(), scenes=[];
  const viewports=[['desktop',1920,900],['portrait390',390,844],['portrait360',360,640]];
  for(let n=1;n<=66;n++){
    const id='S'+String(n).padStart(2,'0'), captures=[];
    for(const [view,width,height] of viewports){
      const name='artifacts/evidence/frames/'+id+'-'+view+'.png';
      const hash=write(root,name,id+' '+view+' screenshot fixture');
      const capture={sceneId:id,cue:'scene-start',currentHead:sourceHead,
        viewport:{name:view,width,height},screenshot:name,screenshotSha256:hash,
        screenshotBytes:fs.statSync(path.join(root,name)).size,manifest:{id:'a'},
        readback:{sceneId:id,assetMatches:true,overflow:false,internalScroll:false},
        errors:[],failed:[],runError:null};
      frames.set(id+':'+view,capture);captures.push(capture);
    }
    scenes.push({sceneId:id,cue:'scene-start',captures});
  }
  const matrix={status:'PASS',sourceHead,scope:{expectedScenes:66,coveredScenes:66,captures:198},failures:[],scenes};
  const matrixPath='artifacts/evidence/matrix.json';
  const matrixSha=write(root,matrixPath,matrix);
  const reviews=ROLES.map(role=>({role,phase:'acceptance',status:'PASS',sourceHead,
    taskId:null,reviewTraceId:null,actualPixelsReceived:true,
    reviewedItems:[],evidenceRefs:[],receivedEvidenceRefs:[],visualEvidence:[],
    decision:'The reviewed screenshots visibly match their authored scene context.',
    findings:[],unresolved:[]}));
  function add(id,viewport,review){
    const f=frames.get(id+':'+viewport),ref=id+':'+viewport;
    review.reviewedItems.push(id+':scene-start');
    review.evidenceRefs.push(ref);review.receivedEvidenceRefs.push(ref);
    review.visualEvidence.push({ref,sceneId:id,viewport,path:f.screenshot,sha256:f.screenshotSha256,
      observation:'Visual staging in '+id+' shows a legible scene backdrop and subject placement.'});
  }
  for(let n=1;n<=66;n++){
    const id='S'+String(n).padStart(2,'0');
    add(id,'portrait390',reviews[(n-1)%3]);
    if(RISK.has(id))add(id,'desktop',reviews[(n-1)%3]);
  }
  const webRefs=ROLES.map((role,i)=>{
    const name='artifacts/evidence/'+role+'.json';
    return {path:name,sha256:write(root,name,reviews[i]),role,taskId:null,reviewTraceId:null,actualPixelsReceived:true};
  });
  const record={schemaVersion:4,assurance:'visual-content',recordType:'production-art-acceptance',
    status:'PASS',verdict:'PASS_PRODUCTION_ART_66_66',sourceProductHead:sourceHead,
    repository:{...repositoryIdentity(root),sourceProductHead:sourceHead},
    sourceProductSnapshot:productSnapshot(root),
    acceptedSceneCoverage:{expected:66,covered:66,remaining:0},placeholders:0,brokenPaths:0,
    manifestSha256:digest(path.join(root,manifest)),rightsManifestSha256:digest(path.join(root,rights)),
    acceptedAssets:[{path:'assets/a.png',sha256:digest(path.join(root,'assets/a.png'))}],
    runtimeAssets:[{path:'assets/a.webp',sha256:digest(path.join(root,'assets/a.webp'))}],
    webHigh:{assurance:'visual-content',result:'PASS',reviews:webRefs},
    evidence:{matrix:{path:matrixPath,sha256:matrixSha,sourceHead}},
    verifier:{type:'source-bound-production-art-verifier',source:'test fixture'}};
  return {root,record,reviews,matrix,frames};
}
function mutateReview(f,i,change) {
  change(f.reviews[i]);
  f.record.webHigh.reviews[i].sha256=write(f.root,'artifacts/evidence/'+ROLES[i]+'.json',f.reviews[i]);
}
function mutateMatrix(f,change) {
  change(f.matrix);
  f.record.evidence.matrix.sha256=write(f.root,'artifacts/evidence/matrix.json',f.matrix);
}
const verify=f=>verifyArtAcceptance({root:f.root,recordOverride:f.record});
test('v4 content mode accepts all scenes and high-risk desktop/portrait frames without provider IDs',()=>{
  const f=makeFixture();const result=verify(f);
  assert.equal(result.status,'PASS',JSON.stringify(result));
  assert.equal(result.assurance,'visual-content');
});
const cases=[
  ['missing assurance',f=>{delete f.record.webHigh.assurance},'ART_ACCEPTANCE_ASSURANCE_INVALID'],
  ['missing image receipt',f=>mutateReview(f,0,r=>{r.receivedEvidenceRefs.shift()}),'ART_ACCEPTANCE_PIXEL_RECEIPT_MISSING'],
  ['missing actual pixels',f=>mutateReview(f,0,r=>{r.actualPixelsReceived=false}),'ART_ACCEPTANCE_PIXEL_RECEIPT_MISSING'],
  ['review REWORK',f=>mutateReview(f,0,r=>{r.status='REWORK'}),'ART_ACCEPTANCE_WEB_EVIDENCE_NOT_PASS'],
  ['review reservations',f=>mutateReview(f,0,r=>{r.semanticVerdict='PASS_WITH_RESERVATIONS'}),'ART_ACCEPTANCE_CONTENT_REVIEW_INVALID'],
  ['unresolved finding',f=>mutateReview(f,0,r=>{r.unresolved.push('S07 wrong cast')}),'ART_ACCEPTANCE_CONTENT_REVIEW_INVALID'],
  ['generic pixel observation',f=>mutateReview(f,0,r=>{r.visualEvidence[0].observation='PASS'}),'ART_ACCEPTANCE_CONTENT_REVIEW_INVALID'],
  ['wrong source screenshot hash',f=>mutateReview(f,0,r=>{r.visualEvidence[0].sha256='0'.repeat(64)}),'ART_ACCEPTANCE_CONTENT_FRAME_MISMATCH'],
  ['missing scene review',f=>mutateReview(f,0,r=>{
    const i=r.visualEvidence.findIndex(x=>x.sceneId==='S04');
    r.visualEvidence.splice(i,1);r.evidenceRefs.splice(i,1);r.receivedEvidenceRefs.splice(i,1);
  }),'ART_ACCEPTANCE_CONTENT_COVERAGE_INCOMPLETE'],
  ['missing high-risk desktop',f=>mutateReview(f,0,r=>{
    const i=r.visualEvidence.findIndex(x=>x.sceneId==='S01'&&x.viewport==='desktop');
    r.visualEvidence.splice(i,1);r.evidenceRefs.splice(i,1);r.receivedEvidenceRefs.splice(i,1);
  }),'ART_ACCEPTANCE_CONTENT_COVERAGE_INCOMPLETE'],
  ['different viewport in review',f=>mutateReview(f,0,r=>{r.visualEvidence[0].viewport='desktop'}),'ART_ACCEPTANCE_CONTENT_FRAME_MISMATCH'],
  ['changed physical PNG',f=>{fs.writeFileSync(path.join(f.root,f.frames.get('S01:desktop').screenshot),'tampered')} ,'ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_HASH_MISMATCH'],
  ['only 65 scenes in matrix',f=>mutateMatrix(f,m=>{m.scenes.pop()}),'ART_ACCEPTANCE_CONTENT_MATRIX_INVALID'],
  ['incorrect visual readback',f=>mutateMatrix(f,m=>{m.scenes[0].captures[0].readback.assetMatches=false}),'ART_ACCEPTANCE_CONTENT_MATRIX_INVALID'],
  ['stale source matrix',f=>mutateMatrix(f,m=>{m.sourceHead='0'.repeat(40)}),'ART_ACCEPTANCE_EVIDENCE_SOURCE_MISMATCH'],
  ['wrong reviewer identity',f=>mutateReview(f,2,r=>{r.role='other_model'}),'ART_ACCEPTANCE_CONTENT_REVIEW_INVALID'],
];
for(const [label,change,expected] of cases){
  test('v4 blocks '+label,()=>{const f=makeFixture();change(f);const actual=verify(f);assert.equal(actual.code,expected,JSON.stringify(actual))});
}
