import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const program = fileURLToPath(new URL("../scripts/dev-host-observed-receipt-e2e.ts", import.meta.url));
const digest = (v: Buffer) => createHash("sha256").update(v).digest("hex");
const viewports = [["desktop",1920,900],["portrait390",390,844],["portrait360",360,640]] as const;
function png(width: number,height: number): Buffer {
  const b=Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
  b.writeUInt32BE(13,8); b.write("IHDR",12,"ascii");
  b.writeUInt32BE(width,16); b.writeUInt32BE(height,20);
  return b;
}
function setup() {
  const root=mkdtempSync(join(tmpdir(),"batch-e2e-preflight-"));
  const game=join(root,"game");
  const attachments=[];
  let index=0;
  for (const sceneId of ["S03","S18","S42"]) for(const [viewport,w,h] of viewports) {
    const buffer=png(w,h);
    const name="artifacts/screens/"+sceneId+"-"+viewport+".png";
    const file=join(game,name);
    mkdirSync(dirname(file),{recursive:true});
    writeFileSync(file,buffer);
    attachments.push({
      ref:"codex-input-image-"+(++index),sceneId,cue:"source-beat",viewport,
      path:name,sha256:digest(buffer),bytes:buffer.length,dimensions:[w,h]
    });
  }
  const turnId="batch1-ceos_reasoner_web-1",role="ceos_reasoner_web";
  const plan={
    status:"PENDING_WEB_HIGH",verdict:"NOT_RUN",sourceHead:"a".repeat(40),
    turns:[{turnId,role,attachments}]
  };
  const planPath=join(root,"plan.json");
  const output=join(root,"out","turn1.json");
  const save=()=>writeFileSync(planPath,JSON.stringify(plan));
  save();
  const run=() => spawnSync(process.execPath,[program,"--plan",planPath,"--turn-id",turnId,
    "--role",role,"--game-root",game,"--output",output,"--preflight-only"],
    {cwd:root,encoding:"utf8",timeout:20000});
  return {root,game,plan,planPath,output,save,run,attachments};
}

test("nine current-source PNGs preflight without browser launch or Git repository",()=>{
  const f=setup();
  try{
    const p=f.run();
    expect(p.status).toBe(0);
    const v=JSON.parse(p.stdout);
    expect(v.status).toBe("READY_BROWSER_TURN_PREFLIGHT");
    expect(v.browserInvoked).toBeFalse();
    expect(v.attachmentCount).toBe(9);
    expect(v.attachments).toHaveLength(9);
    expect(existsSync(f.output)).toBeFalse();
    expect(existsSync(f.output+".receipt.json")).toBeFalse();
  }finally{rmSync(f.root,{recursive:true,force:true});}
});
test("mismatched physical PNG hashes fail before any Web call",()=>{
  const f=setup();
  try{
    writeFileSync(join(f.game,f.attachments[0]!.path),"modified");
    const p=f.run();
    expect(p.status).not.toBe(0);
    expect(p.stderr).toContain("Batch PNG hash/size mismatch");
    expect(existsSync(f.output+".receipt.json")).toBeFalse();
  }finally{rmSync(f.root,{recursive:true,force:true});}
});
test("missing planned role prevents Web request",()=>{
  const f=setup();
  try{
    f.plan.turns[0]!.role="other_role";
    f.save();
    const p=f.run();
    expect(p.status).not.toBe(0);
    expect(p.stderr).toContain("unexecuted batch plan turn");
  }finally{rmSync(f.root,{recursive:true,force:true});}
});
