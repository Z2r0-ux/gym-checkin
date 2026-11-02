const {buildSnapshot,mergeHistory}=require("../agent-data.js");
async function readCloud({profile,program,library,config,accessToken,fetchImpl=fetch}){
  if(!accessToken)throw new Error("Set GYM_ACCESS_TOKEN to your Supabase user access token");
  const base=new URL(config.url);
  if(base.protocol!=="https:"||base.username||base.password)throw new Error("Supabase URL must use HTTPS without embedded credentials");
  const headers={apikey:config.publishableKey,Authorization:`Bearer ${accessToken}`,Accept:"application/json"};
  async function get(path,params={}){
    const url=new URL(path,base);url.search=new URLSearchParams(params).toString();
    const response=await fetchImpl(url,{method:"GET",headers,redirect:"error",signal:AbortSignal.timeout(20000),cache:"no-store"});
    if(!response.ok)throw new Error(`Cloud read failed: HTTP ${response.status} at ${url.pathname}`);
    return response.json();
  }
  const user=await get("/auth/v1/user");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id||""))throw new Error("Authenticated user ID is missing or invalid");
  const stateRows=await get(`/rest/v1/${config.table||"user_state"}`,{user_id:`eq.${user.id}`,select:"data,updated_at"});
  if(!Array.isArray(stateRows)||stateRows.length>1)throw new Error("Expected at most one cloud state row");
  const row=stateRows[0]||null;
  if(row&&(!row.data?.days||typeof row.data.days!=="object"||Array.isArray(row.data.days)))throw new Error("Cloud state has an invalid days field");
  if(row?.data.history!=null&&!Array.isArray(row.data.history))throw new Error("Cloud state has invalid legacy history");
  const records=[];
  const pageSize=500;
  for(let offset=0;;){
    const page=await get(`/rest/v1/${config.historyTable||"workout_history"}`,{
      user_id:`eq.${user.id}`,select:"archive_key,workout_date,record_type,cycle_number,cycle_day,data,created_at",
      order:"workout_date.asc,created_at.asc,archive_key.asc",limit:String(pageSize),offset:String(offset)});
    if(!Array.isArray(page))throw new Error("Cloud history is not an array");
    if(!page.length)break;
    records.push(...page.map(item=>({...item.data,_archiveKey:item.archive_key,
      localDate:item.data?.localDate??item.workout_date,type:item.data?.type??item.record_type,
      cycleNumber:item.data?.cycleNumber??item.cycle_number,cycleDay:item.data?.cycleDay??item.cycle_day,
      submittedAt:item.data?.submittedAt??item.created_at})));
    // Continue even if the server caps pages below our requested limit.
    offset+=page.length;
  }
  return buildSnapshot({profile,program,library,state:row?.data||null,
    history:mergeHistory(row?.data.history||[],records),
    source:{kind:"supabase",ready:true,stateUpdatedAt:row?.updated_at,pendingWrites:null}});
}
module.exports={readCloud};
