(() => {
  "use strict";
  function getPlan(){return GymAgentData.buildPlan(PROFILE,PLAN,window.EXERCISE_LIBRARY);}
  function getSnapshot(){
    const source=window.getGymDataSource?.()||{kind:"browser-local",ready:true,pendingWrites:false};
    return GymAgentData.buildSnapshot({profile:PROFILE,program:PLAN,library:window.EXERCISE_LIBRARY,state,source});
  }
  window.GymAgent=Object.freeze({version:1,getPlan,getSnapshot});
  document.getElementById("agentExportBtn")?.addEventListener("click",()=>{
    try{
      const snapshot=getSnapshot();
      const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}));
      const link=document.createElement("a");
      link.href=url;link.download=`gym-agent-${fmtDate()}.json`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){console.error(error);toast("账号数据尚未加载完成，请稍后导出");}
  });
})();
