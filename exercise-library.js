/* 可搜索的只读动作目录。独立于训练周期、localStorage 和云同步逻辑。 */
(() => {
  "use strict";
  const library=Object.values(window.EXERCISE_LIBRARY||{});
  const program=window.TRAINING_PROGRAM||[];
  const searchEl=document.getElementById("librarySearch");
  const categoryEl=document.getElementById("libraryCategory");
  const resultsEl=document.getElementById("libraryResults");
  const countEl=document.getElementById("libraryShown");
  const totalEl=document.getElementById("libraryTotal");
  if(!searchEl||!categoryEl||!resultsEl||!countEl||!totalEl)return;

  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const categories={
    "胸":/胸/,"背":/背/,"肩":/肩|后束/,"手臂":/二头|三头|肱肌/,
    "腿":/腿|股四头|小腿/,"臀":/臀/,"核心":/核心/,"有氧与恢复":/有氧|恢复/
  };
  const normalize=value=>String(value||"").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g,"");
  const planDays=new Map();
  program.forEach((day,i)=>(day.ex||[]).forEach(ex=>{
    if(!ex.exerciseId)return;
    const value=planDays.get(ex.exerciseId)||new Set();
    value.add(i+1);
    planDays.set(ex.exerciseId,value);
  }));

  function render(){
    const query=normalize(searchEl.value);
    const category=categoryEl.value;
    const visible=library.filter(ex=>{
      const matchedCategory=category==="全部"||Boolean(categories[category]?.test(ex.category||""));
      const lookup=normalize([ex.name,ex.id,ex.equipment,ex.category,...(ex.aliases||[])].join(" "));
      return matchedCategory&&(!query||lookup.includes(query));
    });
    totalEl.textContent=`共 ${library.length} 个动作`;
    countEl.textContent=`显示 ${visible.length} / ${library.length} 个动作`;
    if(!visible.length){
      resultsEl.innerHTML='<div class="libraryEmpty">没有找到匹配的动作，可尝试其他关键词或切换分类。</div>';
      return;
    }
    resultsEl.innerHTML=visible.map(ex=>{
      const days=Array.from(planDays.get(ex.id)||[]).sort((a,b)=>a-b);
      const inPlan=days.length>0;
      const rest=Number(ex.defaultRest||0);
      return `<details class="libraryItem">
        <summary class="librarySummary">
          <div class="librarySummaryMain"><b>${escapeHtml(ex.name)}</b><span>${escapeHtml(ex.category||"未分类")} · ${escapeHtml(ex.equipment||"不限器械")}</span></div>
          ${inPlan?'<span class="libraryInPlan">计划中</span>':""}
          <span class="libraryChevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="libraryDetails">
          <div class="libraryInfoGrid">
            <div><span>部位</span><b>${escapeHtml(ex.category||"未分类")}</b></div>
            <div><span>器械</span><b>${escapeHtml(ex.equipment||"不限器械")}</b></div>
            <div><span>记录单位</span><b>${escapeHtml(ex.unit||"—")}</b></div>
            <div><span>建议组间休息</span><b>${rest?rest+" 秒":"不适用"}</b></div>
          </div>
          <div class="libraryDetailLabel">动作要点</div>
          <p class="libraryTechnique">${escapeHtml(ex.note||"以稳定、受控的动作幅度完成练习。")}</p>
          ${ex.aliases?.length?`<p class="libraryAliases">也称：${escapeHtml(ex.aliases.join("、"))}</p>`:""}
          <div class="libraryPlanUse">${inPlan?`当前计划：${days.map(d=>`Day ${d}`).join("、")}`:"当前训练计划尚未安排此动作"}</div>
        </div>
      </details>`;
    }).join("");
  }
  searchEl.addEventListener("input",render);
  categoryEl.addEventListener("change",render);
  render();
})();