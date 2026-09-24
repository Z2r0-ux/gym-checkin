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

  window.TRAINING_PROGRAM = [
    {id:"pushA",day:"周一",title:"Push A",focus:"胸 + 肩 + 三头｜力量优先",time:"60–75",ex:[
      use("barbell_bench_press",{w:37.5,s:4,r:6,rir:2,goal:"4组都做到6次后，加2.5kg"}),
      use("incline_db_press",{w:10,s:3,r:10,rir:2,goal:"10/10/10 后加重量"}),
      use("machine_shoulder_press",{w:30,s:3,r:10,rir:2,goal:"10/10/10 后加重量"}),
      use("cable_lateral_raise",{w:7.5,s:3,r:15,rir:2,goal:"15/15/15 后加重量"}),
      use("rope_triceps_pushdown",{w:10,s:3,r:12,rir:2,goal:"12/12/12 后加重量"})
    ]},
    {id:"pullA",day:"周二",title:"Pull A",focus:"背 + 二头｜宽度与拉力",time:"65–80",ex:[
      use("assisted_pullup",{w:30,s:4,r:10,rir:2,goal:"4组都10次后减少辅助重量"}),
      use("barbell_row",{w:37.5,s:4,r:8,rir:2,goal:"4组都8次后，加2.5kg"}),
      use("lat_pulldown",{w:20,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("seated_cable_row",{w:26,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("face_pull",{w:15,s:3,r:15,rir:2,goal:"先保证标准动作"}),
      use("db_curl",{w:7.5,s:3,r:12,rir:2,goal:"12/12/12 后再加重量"})
    ]},
    {id:"legsA",day:"周三",title:"Legs A + Core",focus:"腿部力量 + 核心",time:"65–80",ex:[
      use("barbell_back_squat",{w:72.5,s:4,r:6,rir:2,goal:"4组都6次后，加2.5–5kg"}),
      use("hack_squat",{w:65,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("leg_curl",{w:20,s:3,r:15,rir:2,goal:"三组15次后加重量",note:"第一次若不合适直接现场调整，以RIR 1–2为准。"}),
      use("leg_extension",{w:20,s:3,r:15,rir:2,goal:"三组15次后加重量"}),
      use("cable_crunch",{w:10,s:3,r:15,rir:2,goal:"先掌握主动卷曲躯干"}),
      use("plank",{w:0,s:3,r:45,rir:2,goal:"稳定做到45–60秒"})
    ]},
    {id:"pushB",day:"周四",title:"Push B",focus:"胸 + 肩 + 三头｜增肌优先",time:"60–75",ex:[
      use("incline_barbell_bench_press",{w:32.5,s:4,r:8,rir:2,goal:"4组都8次后，加2.5kg"}),
      use("machine_chest_press",{w:12.5,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("pec_deck",{w:16,s:3,r:15,rir:1,goal:"三组15次后加重量"}),
      use("cable_lateral_raise",{w:7.5,s:3,r:15,rir:2,goal:"三组15次后加重量"}),
      use("assisted_dip",{w:28,s:3,r:10,rir:2,goal:"三组10次后减少辅助重量"})
    ]},
    {id:"pullB",day:"周五",title:"Pull B + Core",focus:"背部厚度 + 二头 + 核心",time:"65–80",ex:[
      use("one_arm_db_row",{w:15,s:3,r:12,rir:2,goal:"每侧12/12/12 后加重量"}),
      use("seated_cable_row",{w:26,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("straight_arm_pulldown",{w:10,s:3,r:15,rir:2,goal:"三组15次后加重量"}),
      use("reverse_pec_deck",{w:14,s:3,r:15,rir:2,goal:"三组15次后加重量"}),
      use("hammer_curl",{w:7.5,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("ez_bar_curl",{w:22.5,s:3,r:10,rir:2,goal:"10/10/10 后加重量"}),
      use("dead_bug",{w:0,s:3,r:10,rir:2,goal:"稳定完成后再进阶健腹轮"})
    ]},
    {id:"legsB",day:"周六",title:"Legs B + Cardio",focus:"腿部增肌 + 有氧",time:"65–85",ex:[
      use("hack_squat",{w:65,s:3,r:12,rir:2,goal:"12/12/12 后加重量"}),
      use("leg_press",{w:80,s:3,r:15,rir:2,goal:"三组15次后加重量",note:"第一次按实际器械调整；腰背贴稳，不锁死膝盖。"}),
      use("leg_curl",{w:20,s:3,r:15,rir:2,goal:"三组15次后加重量"}),
      use("leg_extension",{w:20,s:3,r:15,rir:2,goal:"三组15次后加重量"}),
      use("calf_raise",{w:20,s:3,r:20,rir:2,goal:"三组20次后加重量"}),
      use("incline_walk",{w:25,s:1,r:25,rir:2,goal:"每周至少2次有氧"})
    ]},
    {id:"rest",day:"周日",title:"休息",focus:"恢复日",time:"—",ex:[]}
  ];
})();