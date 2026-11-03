(() => {
  const L=window.EXERCISE_LIBRARY||{};
  const use=(exerciseId,prescription={})=>{
    const base=L[exerciseId];
    if(!base) throw new Error(`Unknown exerciseId: ${exerciseId}`);
    return {exerciseId,n:base.name,u:prescription.u??base.unit,step:prescription.step??base.step??0,rest:prescription.rest??base.defaultRest??0,note:prescription.note??base.note??"",...prescription};
  };
  const restDay=(id,title,focus)=>({id,title,focus,time:"—",isRest:true,ex:[]});
  // 七天上/下肢 AB 周期；旧版训练归档保留，不影响已完成的上肢 A。
  window.TRAINING_PROGRAM = [
    {id:"upperA",title:"上肢 A",focus:"胸部优先 · 背宽与手臂",time:"45–60",ex:[
      use("machine_chest_press",{"w":null,"s":3,"minR":8,"r":12,"rir":3,"rest":120,"goal":"目标 8–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"胸部主动发力，不耸肩。"}),
      use("neutral_grip_lat_pulldown",{"w":null,"s":3,"minR":8,"r":12,"rir":3,"rest":90,"goal":"目标 8–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"使用掌心相对握把，拉至上胸，不要耸肩或明显后仰。"}),
      use("chest_supported_row",{"w":null,"s":2,"minR":10,"r":12,"rir":3,"rest":90,"goal":"目标 10–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"胸口贴稳靠垫，手肘沿舒适轨迹向后，不耸肩。"}),
      use("cable_lateral_raise",{"w":null,"s":2,"minR":12,"r":15,"rir":3,"rest":60,"goal":"目标 12–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"手肘微屈，不甩身体，保持中束持续张力。"}),
      use("rope_triceps_pushdown",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":60,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"上臂固定，底部完全伸直。"}),
      use("db_curl",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":60,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"上臂固定，不借力。"}),
    ]},
    {id:"lowerA",title:"下肢 A",focus:"股四头肌 · 腘绳肌 · 核心",time:"45–55",ex:[
      use("leg_press",{"w":null,"s":3,"minR":8,"r":12,"rir":3,"rest":120,"goal":"目标 8–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"腰背贴稳，不锁死膝盖。"}),
      use("seated_leg_curl",{"w":null,"s":3,"minR":10,"r":15,"rir":3,"rest":75,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"调整膝盖与器械转轴位置，缓慢还原，不借惯性。"}),
      use("leg_extension",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":75,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"顶部稍停，不要猛踢。"}),
      use("calf_raise",{"w":null,"s":2,"minR":12,"r":20,"rir":3,"rest":60,"goal":"目标 12–20 次；全组达到 20 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"底部拉伸，顶部收缩，不弹。"}),
      use("dead_bug",{"w":null,"s":2,"minR":8,"r":10,"rir":3,"rest":60,"goal":"每侧 8–10 次，优先控制腰背贴稳；目标 8–10 次；全组达到 10 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"腰部贴地，动作慢。"}),
    ]},
    restDay("rest3","恢复 / 轻有氧","主动恢复 · 可选步行或单车 20–30 分钟"),
    {id:"upperB",title:"上肢 B",focus:"背厚 · 上胸 · 后束与手臂",time:"45–60",ex:[
      use("incline_db_press",{"w":null,"s":3,"minR":8,"r":12,"rir":3,"rest":120,"goal":"目标 8–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"凳子调整至约20–30°，使用可控重量，避免过度耸肩。"}),
      use("chest_supported_row",{"w":null,"s":3,"minR":8,"r":12,"rir":3,"rest":90,"goal":"目标 8–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"胸口贴稳靠垫，手肘沿舒适轨迹向后，不耸肩。"}),
      use("neutral_grip_lat_pulldown",{"w":null,"s":2,"minR":8,"r":12,"rir":3,"rest":90,"goal":"目标 8–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"使用掌心相对握把，拉至上胸，不要耸肩或明显后仰。"}),
      use("reverse_pec_deck",{"w":null,"s":2,"minR":12,"r":15,"rir":3,"rest":60,"goal":"目标 12–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"不耸肩，手臂向后打开。"}),
      use("hammer_curl",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":60,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"掌心相对，上臂固定。"}),
      use("rope_triceps_pushdown",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":60,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"上臂固定，底部完全伸直。"}),
    ]},
    restDay("rest5","恢复 / 轻有氧","主动恢复 · 可选步行或单车 20–30 分钟"),
    {id:"lowerB",title:"下肢 B",focus:"腿部 · 臀部 · 核心",time:"45–55",ex:[
      use("hack_squat",{"w":null,"s":3,"minR":8,"r":10,"rir":3,"rest":120,"goal":"目标 8–10 次；全组达到 10 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"背部贴稳，控制下放，膝盖轨迹稳定。"}),
      use("machine_hip_thrust",{"w":null,"s":3,"minR":10,"r":12,"rir":3,"rest":90,"goal":"目标 10–12 次；全组达到 12 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"顶端伸髋收紧臀部，不用腰椎过伸代偿。"}),
      use("leg_curl",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":75,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"动作完整，避免弹震。"}),
      use("calf_raise",{"w":null,"s":2,"minR":12,"r":20,"rir":3,"rest":60,"goal":"目标 12–20 次；全组达到 20 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"底部拉伸，顶部收缩，不弹。"}),
      use("reverse_crunch",{"w":null,"s":2,"minR":10,"r":15,"rir":3,"rest":60,"goal":"目标 10–15 次；全组达到 15 次、RIR≥2、动作稳定且没有关节痛后才小幅加重。首两周先做1–2组、RIR 3–4。","note":"将骨盆缓慢卷离垫子，不要靠甩腿和惯性。"}),
    ]},
    restDay("rest7","休息","固定休息 · 周日"),
  ];
})();
