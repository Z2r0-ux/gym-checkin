(() => {
  const L=window.EXERCISE_LIBRARY||{};
  const use=(exerciseId,prescription={})=>{
    const base=L[exerciseId];
    if(!base) throw new Error(`Unknown exerciseId: ${exerciseId}`);
    return {
      exerciseId,
      n:base.name,
      u:prescription.u??base.unit,
      step:prescription.step??base.step??0,
      rest:prescription.rest??base.defaultRest??0,
      note:prescription.note??base.note??"",
      ...prescription
    };
  };
  const restDay=(id,title)=>({id,title,focus:"休息 / 散步恢复",time:"—",isRest:true,ex:[]});

  window.TRAINING_PROGRAM = [
    {id:"upperA",title:"上肢 A",focus:"推为主 · 拉为辅",time:"55–70",ex:[
      use("barbell_bench_press",{w:37.5,s:3,r:8,rir:2,rest:180,goal:"目标 6–8 次；3组都做到8次且 RIR≥1 后，加2.5kg"}),
      use("incline_db_press",{w:10,s:3,r:10,rir:2,rest:120,goal:"目标 8–10 次；3组都10次后再加重量"}),
      use("lat_pulldown",{w:20,s:3,r:10,rir:2,rest:120,goal:"目标 8–10 次；3组都10次后加重量"}),
      use("standing_db_lateral_raise",{w:7.5,s:3,r:15,rir:2,rest:75,goal:"目标 12–15 次；先保证不借力，再考虑加重量"}),
      use("rope_triceps_pushdown",{w:10,s:3,r:12,rir:2,rest:75,goal:"目标 10–12 次；3组都12次后加重量"})
    ]},
    {id:"lowerA",title:"下肢 A",focus:"前侧为主",time:"50–65",ex:[
      use("hack_squat",{w:65,s:3,r:8,rir:2,rest:180,goal:"目标 6–8 次；3组都8次且动作稳定后加重量",note:"长肢体优先使用哈克深蹲；背部贴稳，控制下放，膝盖轨迹稳定。"}),
      use("leg_curl",{w:20,s:3,r:12,rir:2,rest:90,goal:"目标 10–12 次；3组都12次后加重量"}),
      use("leg_extension",{w:20,s:3,r:15,rir:2,rest:90,goal:"目标 12–15 次；3组都15次后加重量"}),
      use("calf_raise",{w:20,s:3,r:15,rir:2,rest:75,goal:"目标 12–15 次；底部充分拉伸、顶部停顿"})
    ]},
    restDay("rest3","休息 / 散步恢复"),
    {id:"upperB",title:"上肢 B",focus:"拉为主 · 推为辅",time:"55–70",ex:[
      use("barbell_row",{w:37.5,s:3,r:8,rir:2,rest:150,goal:"目标 6–8 次；3组都8次且躯干稳定后加2.5kg"}),
      use("one_arm_db_row",{w:15,s:3,r:10,rir:2,rest:120,goal:"目标每侧 8–10 次；3组都10次后加重量"}),
      use("machine_chest_press",{w:12.5,s:3,r:12,rir:2,rest:90,goal:"目标 10–12 次；3组都12次后加重量"}),
      use("reverse_pec_deck",{w:14,s:3,r:15,rir:2,rest:75,goal:"目标 12–15 次；动作标准后再加重量"}),
      use("hammer_curl",{w:7.5,s:3,r:12,rir:2,rest:75,goal:"目标 10–12 次；3组都12次后加重量"})
    ]},
    {id:"lowerB",title:"下肢 B",focus:"后侧为主 + 核心",time:"50–65",ex:[
      use("romanian_deadlift",{w:20,s:3,r:8,rir:3,rest:180,goal:"首轮学习动作：6–8 次，以髋铰链和腘绳肌拉伸感为准；动作稳定后再逐步加重",note:"第一次先用空杆学习。膝微屈、髋向后推、杠贴腿运行；脊柱保持中立，不追求下放到地面。"}),
      use("leg_press",{w:80,s:3,r:10,rir:2,rest:150,goal:"目标 8–10 次；3组都10次后加重量"}),
      use("leg_curl",{w:20,s:3,r:12,rir:2,rest:90,goal:"目标 10–12 次；3组都12次后加重量"}),
      use("cable_crunch",{w:10,s:3,r:15,rir:2,rest:75,goal:"2–3组 × 12–15 次；动作质量优先，不追求堆组数"})
    ]},
    restDay("rest6","休息"),
    restDay("rest7","休息")
  ];
})();