/* Shared, read-only serialization. No storage, network or DOM access. */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.GymAgentData=Object.freeze(factory());
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const text=value=>value==null?null:String(value);
  const number=value=>value==null||value===""||!Number.isFinite(Number(value))?null:Number(value);
  const list=value=>Array.isArray(value)?value:[];
  function profileData(profile){
    return {id:profile.id,title:profile.title,phase:profile.phase,
      dailyTargets:list(profile.dailyTargets).map(item=>({label:item.label,value:item.value})),
      nutritionPrinciples:list(profile.nutritionPrinciples).map(item=>({title:item.title,detail:item.detail}))};
  }
  function buildPlan(profile,program,library){
    return {schemaVersion:1,kind:"gym-checkin.plan",profile:profileData(profile),
      days:program.map((day,index)=>({id:day.id,dayNumber:index+1,title:day.title,focus:day.focus,
        estimatedMinutes:day.time,isRest:day.isRest===true||day.ex.length===0,
        exercises:day.ex.map(ex=>({exerciseId:ex.exerciseId,name:ex.n,unit:ex.u,
          category:library[ex.exerciseId]?.category||null,equipment:library[ex.exerciseId]?.equipment||null,
          target:{weight:ex.w,sets:ex.s,reps:ex.r,rir:ex.rir,restSeconds:ex.rest||0},
          weightStep:ex.step||0,progression:ex.goal||"",note:ex.note||""}))}))};
  }
  function setsData(sets){
    return list(sets).map((set,index)=>({setNumber:index+1,weight:number(set.weight),
      reps:number(set.reps),rir:number(set.rir),done:set.done===true}));
  }
  function archiveKey(record){
    if(record._archiveKey)return String(record._archiveKey);
    return "v1|"+[record.submittedAt||"",record.localDate||record.date||"",record.type||"workout",
      record.cycleNumber??"",record.cycleDay??"",record.dayId||"",record.title||""
    ].map(value=>String(value).replaceAll("|","%7C")).join("|");
  }
  function historyData(record){
    const exercises=list(record.exercises).map(ex=>({exerciseId:text(ex.exerciseId),name:text(ex.name),
      unit:text(ex.unit),weight:number(ex.weight),sets:setsData(ex.sets)}));
    return {archiveKey:archiveKey(record),type:record.type||"workout",status:text(record.status),
      localDate:text(record.localDate||record.date),submittedAt:text(record.submittedAt),timezone:text(record.timezone),
      cycleNumber:number(record.cycleNumber),cycleDay:number(record.cycleDay),dayId:text(record.dayId),
      title:text(record.title),focus:text(record.focus),note:record.note||"",restKind:text(record.restKind),
      plannedDayId:text(record.plannedDayId),plannedTitle:text(record.plannedTitle),
      doneSets:number(record.doneSets),totalSets:number(record.totalSets),pct:number(record.pct),exercises};
  }
  function mergeHistory(...sources){
    const records=new Map();
    for(const record of sources.flat())if(record&&typeof record==="object")records.set(archiveKey(record),record);
    return [...records.values()].sort((a,b)=>String(a.localDate||a.date||"").localeCompare(String(b.localDate||b.date||""))||String(a.submittedAt||"").localeCompare(String(b.submittedAt||""))||archiveKey(a).localeCompare(archiveKey(b)));
  }
  function buildSnapshot({profile,program,library,state,history:rawHistory=state?.history,source,generatedAt=new Date().toISOString()}){
    if(!source||source.ready!==true)throw new Error("DATA_NOT_READY: wait for account data to finish loading");
    const history=mergeHistory(list(rawHistory)).map(historyData);
    let current=null;
    if(state){
      const dayIndex=number(state.cycle?.day);
      const day=program.find(item=>item.id===state.currentDay)||(Number.isInteger(dayIndex)&&dayIndex>0?program[dayIndex-1]:null);
      if(!day)throw new Error("INVALID_STATE: unknown training day");
      const draft=state.days?.[day.id];
      const last=state.lastArchive;
      current={cycle:{number:number(state.cycle?.number),day:dayIndex},dayId:day.id,
        sessionMode:state.sessionMode||((day.isRest||!day.ex.length)?"rest":"workout"),note:draft?.note||"",
        lastArchive:last?{localDate:text(last.localDate),submittedAt:text(last.submittedAt),timezone:text(last.timezone),type:text(last.type),title:text(last.title)}:null,
        exercises:day.ex.map((ex,index)=>{
          const saved=draft?.ex?.[ex.exerciseId?`ex_${ex.exerciseId}`:`${index}_${ex.n}`]||draft?.ex?.[`${index}_${ex.n}`];
          return {exerciseId:ex.exerciseId,name:ex.n,unit:ex.u,weight:number(saved?.weight),sets:setsData(saved?.sets)};
        })};
    }
    return {schemaVersion:1,kind:"gym-checkin.snapshot",generatedAt,
      source:{kind:source.kind,ready:true,stateAvailable:state!=null,stateUpdatedAt:text(source.stateUpdatedAt??state?._meta?.updatedAt),
        pendingWrites:typeof source.pendingWrites==="boolean"?source.pendingWrites:null},
      plan:buildPlan(profile,program,library),current,history,
      summary:{historyRecords:history.length,workouts:history.filter(item=>item.type==="workout").length,
        rests:history.filter(item=>item.type==="rest").length,skips:history.filter(item=>item.type==="skip").length,
        completedSets:history.filter(item=>item.type==="workout").reduce((total,item)=>{
          const count=item.doneSets??(item.exercises.length?item.exercises.reduce((sum,ex)=>sum+ex.sets.filter(set=>set.done).length,0):null);
          return total===null||count===null?null:total+count;
        },0),
        lastRecordDate:history.at(-1)?.localDate||null}};
  }
  return {buildPlan,buildSnapshot,mergeHistory};
});
