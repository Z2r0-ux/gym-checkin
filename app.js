const PROFILE = window.APP_PROFILE;
const PLAN = window.TRAINING_PROGRAM;
const KEY = PROFILE.storageKey;

let state = JSON.parse(localStorage.getItem(KEY) || "{}");
if (!state.currentDay) state.currentDay = PROFILE.defaultDay;
if (!state.days) state.days = {};
if (!state.history) state.history = [];

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function initDay(day) {
  if (!state.days[day.id]) state.days[day.id] = { note: "", ex: {} };
  day.ex.forEach((x, i) => {
    const k = keyFor(x, i);
    if (!state.days[day.id].ex[k]) {
      state.days[day.id].ex[k] = {
        weight: x.w,
        sets: Array.from({ length: x.s }, () => ({ reps: x.r, rir: x.rir, done: false }))
      };
      return;
    }

    const existing = state.days[day.id].ex[k];
    if (!Array.isArray(existing.sets)) existing.sets = [];
    while (existing.sets.length < x.s) {
      existing.sets.push({ reps: x.r, rir: x.rir, done: false });
    }
    if (existing.sets.length > x.s) existing.sets = existing.sets.slice(0, x.s);
    if (existing.weight === undefined || existing.weight === null) existing.weight = x.w;
  });
}

PLAN.forEach(initDay);
persist();

function keyFor(ex, i) {
  return `${i}_${ex.n}`;
}

function currentPlan() {
  return PLAN.find(d => d.id === state.currentDay) || PLAN[0];
}

function calc(day) {
  let total = 0;
  let done = 0;
  let doneEx = 0;
  day.ex.forEach((x, i) => {
    const entry = state.days[day.id]?.ex?.[keyFor(x, i)];
    const sets = entry?.sets || [];
    total += sets.length;
    const finished = sets.filter(v => v.done).length;
    done += finished;
    if (sets.length && finished === sets.length) doneEx++;
  });
  return { total, done, doneEx, pct: total ? Math.round(done / total * 100) : 0 };
}

function fmtDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1600);
}

function renderProfile() {
  document.title = PROFILE.title;
  document.getElementById("appTitle").textContent = PROFILE.title;
  document.getElementById("todayText").textContent = `${fmtDate()} · ${PROFILE.phase}`;
  document.getElementById("targetPhase").textContent = PROFILE.phase;

  const targets = document.getElementById("dailyTargets");
  targets.innerHTML = PROFILE.dailyTargets.map(item => `
    <div class="nutriCard"><b>${item.value}</b><span>${item.label}</span></div>
  `).join("");

  const principles = document.getElementById("nutritionPrinciples");
  principles.innerHTML = PROFILE.nutritionPrinciples.map(item => `
    <div class="settingsRow"><div class="left"><b>${item.title}</b><span>${item.detail}</span></div></div>
  `).join("");
}

function renderDays() {
  const el = document.getElementById("dayStrip");
  el.innerHTML = PLAN.map(d => {
    const c = calc(d);
    return `<button class="daychip ${d.id === state.currentDay ? "active" : ""}" data-id="${d.id}">
      <strong>${d.day.replace("周", "")}</strong><span>${d.id === "rest" ? "休息" : c.pct + "%"}</span>
    </button>`;
  }).join("");

  el.querySelectorAll(".daychip").forEach(b => {
    b.onclick = () => {
      state.currentDay = b.dataset.id;
      persist();
      renderAll();
    };
  });
}

function renderWorkout() {
  const day = currentPlan();
  const c = calc(day);
  document.getElementById("heroEyebrow").textContent = day.id === "rest" ? "恢复" : "今日训练";
  document.getElementById("heroTitle").textContent = day.title;
  document.getElementById("heroSub").textContent = day.focus;
  document.getElementById("statSets").textContent = `${c.done}/${c.total}`;
  document.getElementById("statEx").textContent = `${c.doneEx}/${day.ex.length}`;
  document.getElementById("statTime").textContent = day.time;
  document.getElementById("progressPct").textContent = `${c.pct}%`;
  document.getElementById("progressRing").style.setProperty("--p", c.pct);
  document.getElementById("dayNote").value = state.days[day.id]?.note || "";

  const list = document.getElementById("exerciseList");
  if (!day.ex.length) {
    list.innerHTML = `<div class="historyCard" style="text-align:center;padding:28px 16px">
      <div style="font-size:32px;margin-bottom:8px">☾</div>
      <b>今天休息</b>
      <div class="historyMeta">可以散步、简单拉伸、轻松活动。不要为了补课额外塞大量训练。</div>
    </div>`;
    document.getElementById("finishWorkout").classList.add("hidden");
    return;
  }

  document.getElementById("finishWorkout").classList.remove("hidden");
  list.innerHTML = day.ex.map((x, i) => {
    const k = keyFor(x, i);
    const s = state.days[day.id].ex[k];
    const all = s.sets.every(v => v.done);
    const repUnit = x.n === "平板支撑" ? "秒" : "次";
    return `<div class="exercise ${all ? "complete" : ""}" data-k="${k}" data-i="${i}">
      <div class="exHead">
        <div>
          <div class="exName">${i + 1}. ${x.n}</div>
          <div class="exMeta">${x.s} 组 · 目标 ${x.r}${repUnit} · RIR ${x.rir} · 休息 ${x.rest || 0} 秒</div>
          <div class="exGoal">${x.goal}</div>
        </div>
        <button class="collapseBtn">⌄</button>
      </div>
      <div class="exBody">
        <div class="weightBox">
          <button class="stepBtn" data-w="-1">−</button>
          <div class="weightCenter">
            <input inputmode="decimal" value="${s.weight}" data-weight>
            <small>${x.u}</small>
          </div>
          <button class="stepBtn" data-w="1">＋</button>
        </div>
        <div class="sets">
          ${s.sets.map((set, si) => `
            <div class="setrow" data-si="${si}">
              <div class="setNum">S${si + 1}</div>
              <div class="repWrap">
                <button class="miniBtn" data-rep="-1">−</button>
                <div class="repVal">${set.reps}</div>
                <button class="miniBtn" data-rep="1">＋</button>
              </div>
              <div class="rirPills">
                ${[3, 2, 1, 0].map(v => `<button class="rirPill ${Number(set.rir) === v ? "sel" : ""}" data-rir="${v}">${v}</button>`).join("")}
              </div>
              <button class="doneBtn ${set.done ? "on" : ""}" data-done>${set.done ? "✓" : "○"}</button>
            </div>`).join("")}
        </div>
        <div class="exNote">${x.note}</div>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".exercise").forEach(card => {
    const i = Number(card.dataset.i);
    const x = day.ex[i];
    const k = card.dataset.k;
    const s = state.days[day.id].ex[k];

    card.querySelector(".collapseBtn").onclick = () => card.querySelector(".exBody").classList.toggle("hidden");

    const wi = card.querySelector("[data-weight]");
    wi.onchange = () => {
      s.weight = Number(wi.value) || 0;
      persist();
    };

    card.querySelectorAll("[data-w]").forEach(b => {
      b.onclick = () => {
        if (!x.step) return;
        s.weight = Math.max(0, Math.round((Number(s.weight) + Number(b.dataset.w) * x.step) * 10) / 10);
        persist();
        renderAll();
      };
    });

    card.querySelectorAll(".setrow").forEach(row => {
      const si = Number(row.dataset.si);
      const set = s.sets[si];

      row.querySelectorAll("[data-rep]").forEach(b => {
        b.onclick = () => {
          set.reps = Math.max(0, Number(set.reps) + Number(b.dataset.rep));
          persist();
          renderAll();
        };
      });

      row.querySelectorAll("[data-rir]").forEach(b => {
        b.onclick = () => {
          set.rir = Number(b.dataset.rir);
          persist();
          renderAll();
        };
      });

      row.querySelector("[data-done]").onclick = () => {
        set.done = !set.done;
        persist();
        if (set.done && x.rest > 0) startRest(x.rest);
        renderAll();
      };
    });
  });
}

document.getElementById("dayNote").oninput = e => {
  const d = currentPlan();
  state.days[d.id].note = e.target.value;
  persist();
};

let timerInt = null;
let timerLeft = 0;

function startRest(sec) {
  clearInterval(timerInt);
  timerLeft = sec;
  document.getElementById("restTimer").classList.add("show");
  paintTimer();
  timerInt = setInterval(() => {
    timerLeft--;
    paintTimer();
    if (timerLeft <= 0) {
      clearInterval(timerInt);
      document.getElementById("restTimer").classList.remove("show");
      toast("休息结束，可以开始下一组");
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    }
  }, 1000);
}

function paintTimer() {
  const m = Math.floor(timerLeft / 60);
  const s = timerLeft % 60;
  document.getElementById("timerDisplay").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

document.getElementById("timerPlus").onclick = () => {
  timerLeft += 30;
  paintTimer();
};

document.getElementById("timerSkip").onclick = () => {
  clearInterval(timerInt);
  document.getElementById("restTimer").classList.remove("show");
};

function renderHistory() {
  const el = document.getElementById("historyList");
  if (!state.history.length) {
    el.innerHTML = `<div class="historyCard"><b>还没有完成记录</b><div class="historyMeta">完成一次训练后会出现在这里。</div></div>`;
    return;
  }

  el.innerHTML = state.history.slice().reverse().map(h => `
    <div class="historyCard">
      <div class="historyTop"><b>${h.title}</b><span>${h.date}</span></div>
      <div class="historyMeta">${h.doneSets}/${h.totalSets} 工作组 · 完成度 ${h.pct}%${h.note ? ` · ${h.note}` : ""}</div>
    </div>`).join("");
}

function renderAll() {
  renderDays();
  renderWorkout();
  renderHistory();
}

renderProfile();
renderAll();

document.getElementById("finishWorkout").onclick = () => {
  const d = currentPlan();
  const c = calc(d);
  document.getElementById("finishSummary").textContent = `今天完成 ${c.done}/${c.total} 个工作组，完成度 ${c.pct}%。`;
  document.getElementById("finishSheet").classList.add("show");
};

document.getElementById("sheetCancel").onclick = () => document.getElementById("finishSheet").classList.remove("show");

document.getElementById("sheetConfirm").onclick = () => {
  const d = currentPlan();
  const c = calc(d);
  state.history.push({
    date: fmtDate(),
    dayId: d.id,
    title: d.title,
    doneSets: c.done,
    totalSets: c.total,
    pct: c.pct,
    note: state.days[d.id].note || ""
  });
  persist();
  document.getElementById("finishSheet").classList.remove("show");
  toast("已保存本次训练");
  renderHistory();
};

document.querySelectorAll(".navBtn").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".navBtn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
    document.getElementById(`view${b.dataset.view}`).classList.add("active");
  };
});

function exportData() {
  const payload = {
    schemaVersion: 1,
    profileId: PROFILE.id,
    exportedAt: new Date().toISOString(),
    ...state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `训练打卡_${fmtDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

document.getElementById("exportBtn").onclick = exportData;
document.getElementById("quickExport").onclick = exportData;

document.getElementById("importInput").onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!obj.days || !obj.history) throw new Error("invalid data");
    state = {
      currentDay: obj.currentDay || PROFILE.defaultDay,
      days: obj.days,
      history: obj.history
    };
    PLAN.forEach(initDay);
    persist();
    renderAll();
    toast("导入成功");
  } catch {
    toast("导入失败：文件格式不正确");
  } finally {
    e.target.value = "";
  }
};

document.getElementById("resetDay").onclick = () => {
  const d = currentPlan();
  if (!confirm(`确定重置 ${d.title} 的本次打卡吗？`)) return;
  delete state.days[d.id];
  initDay(d);
  persist();
  renderAll();
  toast("已重置当前训练日");
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
