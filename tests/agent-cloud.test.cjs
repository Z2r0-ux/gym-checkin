const test=require("node:test");
const assert=require("node:assert/strict");
const {loadContext}=require("../scripts/agent-context.cjs");
const {readCloud}=require("../scripts/agent-cloud.cjs");
const userId="12345678-1234-1234-1234-123456789abc";
const token="fixture-user-access-token";
function setup({noState=false,invalidUser=false,failHistory=false}={}){
  const context=loadContext(),requests=[];
  const config={url:"https://example.supabase.co",publishableKey:"fixture-public-key",table:"user_state",historyTable:"workout_history"};
  const legacy={_archiveKey:"a",type:"workout",localDate:"2026-10-29",doneSets:1};
  const state={currentDay:context.program[0].id,cycle:{number:1,day:1},days:{},history:[legacy],_meta:{updatedAt:"2026-11-02T00:00:00Z"},access_token:token};
  const history=[{archive_key:"a",workout_date:"2026-10-29",record_type:"workout",data:{doneSets:2}},
    {archive_key:"b",workout_date:"2026-10-30",record_type:"rest",data:{restKind:"inserted"}},
    {archive_key:"c",workout_date:"2026-10-31",record_type:"skip",data:{}}];
  const fetchImpl=async(url,options)=>{
    url=new URL(url);requests.push({url,options});
    assert.equal(options.method,"GET");assert.equal(options.redirect,"error");
    assert.equal(url.origin,config.url);assert.equal(options.headers.Authorization,`Bearer ${token}`);
    let data;
    if(url.pathname==="/auth/v1/user")data={id:invalidUser?"not-a-user-id":userId,email:"not-exported@example.com"};
    else{
      assert.equal(url.searchParams.get("user_id"),`eq.${userId}`);
      assert.ok(!url.searchParams.get("select").includes("*"));
      if(url.pathname.endsWith("/user_state"))data=noState?[]:[{data:state,updated_at:state._meta.updatedAt}];
      else{
        assert.equal(url.pathname,"/rest/v1/workout_history");
        if(failHistory)return new Response(JSON.stringify({secret:token}),{status:403});
        // Simulate a server that caps responses at 2 despite a requested limit of 500.
        const offset=Number(url.searchParams.get("offset"));data=history.slice(offset,offset+2);
      }
    }
    return new Response(JSON.stringify(data),{status:200});
  };
  return {...context,config,accessToken:token,fetchImpl,requests};
}
test("cloud reader verifies identity, scopes every query and reads all capped pages",async()=>{
  const input=setup(),snapshot=await readCloud(input);
  assert.equal(input.requests[0].url.pathname,"/auth/v1/user");
  assert.equal(snapshot.source.kind,"supabase");
  assert.equal(snapshot.source.pendingWrites,null);
  assert.equal(snapshot.history.length,3);
  assert.equal(snapshot.history[0].doneSets,2);
  assert.equal(snapshot.summary.workouts,1);
  assert.equal(snapshot.summary.rests,1);
  assert.equal(snapshot.summary.skips,1);
  assert.deepEqual(input.requests.filter(r=>r.url.pathname.endsWith("workout_history")).map(r=>r.url.searchParams.get("offset")),["0","2","3"]);
  const output=JSON.stringify(snapshot);
  assert.ok(!output.includes(token));assert.ok(!output.includes(userId));assert.ok(!output.includes("not-exported@example.com"));
});
test("history still exports when no current-state row exists",async()=>{
  const result=await readCloud(setup({noState:true}));
  assert.equal(result.current,null);assert.equal(result.source.stateAvailable,false);
  assert.equal(result.history.length,3);assert.equal(result.summary.workouts,1);
});
test("missing token does not make a network request",async()=>{
  const input=setup();await assert.rejects(()=>readCloud({...input,accessToken:null}),/GYM_ACCESS_TOKEN/);
  assert.equal(input.requests.length,0);
});
test("invalid authenticated user ID stops before querying any table",async()=>{
  const input=setup({invalidUser:true});await assert.rejects(()=>readCloud(input),/user ID/);
  assert.equal(input.requests.length,1);
});
test("access denial fails, does not return partial records, and does not echo response secrets",async()=>{
  const input=setup({failHistory:true});
  await assert.rejects(()=>readCloud(input),error=>error.message.includes("HTTP 403")&&!error.message.includes(token));
});
test("HTTP and credential-bearing base URLs are rejected before transmitting the token",async()=>{
  for(const url of ["http://example.supabase.co","https://user:password@example.supabase.co"]){
    const input=setup();await assert.rejects(()=>readCloud({...input,config:{...input.config,url}}),/HTTPS/);
    assert.equal(input.requests.length,0);
  }
});
