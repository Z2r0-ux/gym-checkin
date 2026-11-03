const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const {loadContext,root}=require("../scripts/agent-context.cjs");
const {buildPlan,buildSnapshot,mergeHistory}=require("../agent-data.js");
function fixture(){
  const context=loadContext(),day=context.program[0],exercise=day.ex[0];
  const sets=[{weight:40,reps:8,rir:1,done:true},{weight:40,reps:7,rir:2,done:false}];
  const state={currentDay:day.id,cycle:{number:2,day:1},sessionMode:"workout",
    days:{[day.id]:{note:"Private training note",ex:{[`ex_${exercise.exerciseId}`]:{weight:40,sets}}}},
    history:[{type:"workout",title:day.title,dayId:day.id,cycleNumber:1,cycleDay:1,localDate:"2026-10-29",
      submittedAt:"2026-10-29T10:00:00Z",doneSets:1,totalSets:2,pct:50,
      exercises:[{exerciseId:exercise.exerciseId,name:exercise.n,unit:exercise.u,weight:40,sets}]},
      {type:"rest",restKind:"inserted",localDate:"2026-10-30",note:"Recovery"},
      {type:"skip",restKind:"scheduled",localDate:"2026-10-31"}],
    _meta:{updatedAt:"2026-11-02T02:00:00Z"},email:"should-not-export@example.com",refresh_token:"not-for-export",ui:{collapsed:{}}};
  return {...context,state,source:{kind:"browser-local",ready:true,pendingWrites:false},generatedAt:"2026-11-02T02:10:00Z"};
}
test("public plan matches source and committed JSON, including rest days and target units",()=>{
  const {profile,program,library}=loadContext();
  const plan=buildPlan(profile,program,library);
  assert.equal(JSON.stringify(plan,null,2)+"\n",fs.readFileSync(path.join(root,"api/v1/plan.json"),"utf8"));
  assert.equal(plan.days.length,7);
  assert.equal(plan.days.filter(day=>day.isRest).length,3);
  assert.equal(plan.days[0].exercises[0].exerciseId,"machine_chest_press");
  assert.equal(plan.days[0].exercises[0].target.weight,null);
  assert.equal(plan.days[0].exercises[0].target.restSeconds,120);
   assert.equal(plan.days[0].exercises[0].target.repsMin,8);
   assert.equal(plan.days[0].requiresClearance,true);
   assert.equal(plan.days[1].id,"lowerA");
   assert.equal(plan.days[4].id,"rest5");
   assert.equal(plan.days[5].id,"lowerB");
  assert.equal(plan.days[0].exercises[1].unit,library.neutral_grip_lat_pulldown.unit);
  assert.ok(!JSON.stringify(plan).includes("publishableKey"));
  assert.ok(!JSON.stringify(plan).includes("storageKey"));
});
test("snapshot separates plan targets, actual draft and archives without mutation or auth data",()=>{
  const input=fixture(),before=JSON.stringify(input.state);
  const result=buildSnapshot(input);
  assert.equal(JSON.stringify(input.state),before);
  assert.equal(result.plan.days[0].exercises[0].target.weight,null);
  assert.equal(result.current.exercises[0].weight,40);
  assert.equal(result.current.exercises[0].sets[0].setNumber,1);
  assert.equal(result.current.exercises[0].sets[0].done,true);
  assert.equal(result.current.note,"Private training note");
  assert.deepEqual(result.summary,{historyRecords:3,workouts:1,rests:1,skips:1,completedSets:1,lastRecordDate:"2026-10-31"});
  assert.equal(result.source.stateUpdatedAt,input.state._meta.updatedAt);
  assert.equal(result.generatedAt,input.generatedAt);
  assert.ok(!JSON.stringify(result).includes("should-not-export"));
  assert.ok(!JSON.stringify(result).includes("refresh_token"));
  result.current.exercises[0].sets[0].weight=999;
  result.plan.days[0].exercises[0].target.weight=999;
  assert.equal(JSON.stringify(input.state),before);
  assert.equal(input.program[0].ex[0].w,null);
});
test("unknown legacy numeric values remain null and missing draft sets are not manufactured",()=>{
  const input=fixture();
  delete input.state.days[input.state.currentDay];
  delete input.state.cycle;
  input.state.history=[{type:"workout",localDate:"2026-10-29"}];
  const result=buildSnapshot(input);
  assert.equal(result.current.cycle.day,null);
  assert.equal(result.current.exercises[0].weight,null);
  assert.deepEqual(result.current.exercises[0].sets,[]);
  assert.equal(result.summary.completedSets,null);
});
test("legacy archive doneSets remains usable even if per-exercise data is absent",()=>{
  const input=fixture();input.state.history=[{doneSets:8,localDate:"2026-10-29"}];
  assert.equal(buildSnapshot(input).summary.completedSets,8);
});
test("unready account data fails instead of returning empty or previous-account history",()=>{
  const input=fixture();input.source.ready=false;
  assert.throws(()=>buildSnapshot(input),/DATA_NOT_READY/);
});
test("unrecognized current day is reported instead of inventing Day 1",()=>{
  const input=fixture();input.state.currentDay="unknown-legacy-day";delete input.state.cycle;
  assert.throws(()=>buildSnapshot(input),/INVALID_STATE/);
});
test("history-only cloud data preserves records without inventing a current draft",()=>{
  const input=fixture();
  const result=buildSnapshot({...input,state:null,history:input.state.history,source:{kind:"supabase",ready:true}});
  assert.equal(result.current,null);
  assert.equal(result.source.stateAvailable,false);
  assert.equal(result.source.pendingWrites,null);
  assert.equal(result.history.length,3);
});
test("history merges by migration-compatible stable key and sorts deterministically",()=>{
  const first={type:"workout",localDate:"2026-10-29",title:"Upper | A",doneSets:1};
  const duplicate={...first,doneSets:2};
  const merged=mergeHistory([{type:"rest",localDate:"2026-10-30"},first],[duplicate]);
  assert.equal(merged.length,2);
  assert.equal(merged[0].doneSets,2);
  const snapshot=buildSnapshot({...fixture(),state:null,history:merged});
  assert.ok(snapshot.history[0].archiveKey.includes("Upper %7C A"));
});
test("CLI converts an existing backup and preserves an existing snapshot's capture time",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gym-agent-test-"));
  try{
    const file=path.join(dir,"backup.json");fs.writeFileSync(file,JSON.stringify(fixture().state));
    const run=()=>spawnSync(process.execPath,["scripts/agent-read.mjs","file",file],{cwd:root,encoding:"utf8"});
    let result=run();assert.equal(result.status,0,result.stderr);
    const snapshot=JSON.parse(result.stdout);
    assert.equal(snapshot.source.kind,"export-file");assert.equal(snapshot.history.length,3);
    assert.ok(!result.stdout.includes("not-for-export"));
    fs.writeFileSync(file,JSON.stringify(snapshot));
    result=run();assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),snapshot);
    fs.writeFileSync(file,JSON.stringify({history:[]}));
    result=run();assert.notEqual(result.status,0);assert.equal(result.stdout,"");
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// 计划升级不能改变已经归档的旧训练动作和重量。
test("legacy upper A archive retains old exercises after plan upgrade",()=>{
 const input=fixture();
 input.state.history=[{type:"workout",cycleNumber:1,cycleDay:1,dayId:"upperA",title:"上肢 A",localDate:"2026-11-02",exercises:[{exerciseId:"barbell_bench_press",name:"杠铃卧推",unit:"kg",weight:37.5,sets:[{weight:37.5,reps:8,rir:2,done:true}]}]}];
 const result=buildSnapshot(input);
 assert.equal(result.history[0].exercises[0].exerciseId,"barbell_bench_press");
 assert.equal(result.history[0].exercises[0].weight,37.5);
 assert.equal(result.plan.days[0].exercises[0].exerciseId,"machine_chest_press");
});
