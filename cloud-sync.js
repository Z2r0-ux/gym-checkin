(() => {
  const cfg = window.SUPABASE_CONFIG;
  const sdk = window.supabase;
  if (!cfg?.url || !cfg?.publishableKey || !sdk?.createClient) {
    console.warn("Supabase 未初始化，继续使用本机模式。");
    return;
  }

  const client = sdk.createClient(cfg.url, cfg.publishableKey);
  const TABLE = cfg.table || "user_state";
  const HISTORY_TABLE = cfg.historyTable || "workout_history";
  const LEGACY_OWNER_KEY = `${KEY}::cloud-migration-owner`;
  let currentUser = null;
  let cloudReady = false;
  let saveTimer = null;
  let syncInFlight = false;
  let needsResync = false;
  let lastHandledUserId = null;
  let knownHistoryKeys = new Set();

  // app.js 原始 persist：仅用于“未登录模式”的本机保存。
  const persistLocal = persist;

  function pendingKey(userId) {
    return `${KEY}::pending::${userId}`;
  }

  function historyPendingKey(userId) {
    return `${KEY}::history-pending::${userId}`;
  }

  function oldUserCacheKey(userId) {
    return `${KEY}::user::${userId}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      return obj?.days && typeof obj.days === "object" ? obj : null;
    } catch {
      return null;
    }
  }

  function ensureMeta(target = state) {
    if (!target._meta || typeof target._meta !== "object") target._meta = {};
    if (!target._meta.updatedAt) target._meta.updatedAt = new Date().toISOString();
    return target;
  }

  function currentStateSnapshot(target = state) {
    const snapshot = clone(ensureMeta(target));
    delete snapshot.history;
    return snapshot;
  }

  function makeFreshState() {
    state = {
      currentDay: PROFILE.defaultDay,
      days: {},
      history: [],
      _meta: { updatedAt: new Date().toISOString() }
    };
    PLAN.forEach(initDay);
    return state;
  }

  function normalizeState(nextState) {
    state = nextState || {};
    if (!state.currentDay) state.currentDay = PROFILE.defaultDay;
    if (!state.days) state.days = {};
    if (!Array.isArray(state.history)) state.history = [];
    ensureMeta();
    PLAN.forEach(initDay);
    return state;
  }

  function historyKey(record) {
    if (record?._archiveKey) return String(record._archiveKey);
    const parts = [
      record?.submittedAt || "",
      record?.localDate || record?.date || "",
      record?.type || "workout",
      record?.cycleNumber ?? "",
      record?.cycleDay ?? "",
      record?.dayId || "",
      record?.title || ""
    ].map(v => String(v).replaceAll("|", "%7C"));
    return `v1|${parts.join("|")}`;
  }

  function normalizeHistoryRecord(record) {
    const normalized = clone(record || {});
    normalized._archiveKey = historyKey(normalized);
    return normalized;
  }

  function historySortValue(record) {
    const submitted = Date.parse(record?.submittedAt || 0) || 0;
    if (submitted) return submitted;
    const byDate = Date.parse(`${record?.localDate || record?.date || "1970-01-01"}T00:00:00`) || 0;
    return byDate;
  }

  function mergeHistory(...lists) {
    const merged = new Map();
    lists.flat().filter(Boolean).forEach(record => {
      const normalized = normalizeHistoryRecord(record);
      merged.set(normalized._archiveKey, normalized);
    });
    return [...merged.values()].sort((a, b) => historySortValue(a) - historySortValue(b));
  }

  function readPendingHistory(userId) {
    try {
      const raw = JSON.parse(localStorage.getItem(historyPendingKey(userId)) || "[]");
      return Array.isArray(raw) ? raw.map(normalizeHistoryRecord) : [];
    } catch {
      return [];
    }
  }

  function writePendingHistory(userId, records) {
    if (!records.length) {
      localStorage.removeItem(historyPendingKey(userId));
      return;
    }
    localStorage.setItem(historyPendingKey(userId), JSON.stringify(records));
  }

  function queueHistoryRecords(records = state.history) {
    if (!currentUser || !Array.isArray(records) || !records.length) return false;
    const pending = readPendingHistory(currentUser.id);
    const pendingMap = new Map(pending.map(record => [record._archiveKey, record]));
    let changed = false;

    records.forEach(record => {
      const normalized = normalizeHistoryRecord(record);
      if (record && typeof record === "object" && !record._archiveKey) record._archiveKey = normalized._archiveKey;
      if (knownHistoryKeys.has(normalized._archiveKey) || pendingMap.has(normalized._archiveKey)) return;
      pendingMap.set(normalized._archiveKey, normalized);
      changed = true;
    });

    if (changed) writePendingHistory(currentUser.id, [...pendingMap.values()]);
    return changed;
  }

  function historyDate(record) {
    const direct = record?.localDate || record?.date;
    if (direct && /^\d{4}-\d{2}-\d{2}$/.test(String(direct))) return String(direct);
    const submitted = record?.submittedAt ? new Date(record.submittedAt) : new Date();
    return fmtDate(Number.isNaN(submitted.getTime()) ? new Date() : submitted);
  }

  function historyType(record) {
    return ["workout", "rest", "skip"].includes(record?.type) ? record.type : "workout";
  }

  function historyToRow(record, userId) {
    const normalized = normalizeHistoryRecord(record);
    const data = clone(normalized);
    delete data._archiveKey;
    const cycleNumber = Number(normalized.cycleNumber);
    const cycleDay = Number(normalized.cycleDay);
    return {
      user_id: userId,
      archive_key: normalized._archiveKey,
      workout_date: historyDate(normalized),
      record_type: historyType(normalized),
      cycle_number: Number.isFinite(cycleNumber) ? cycleNumber : null,
      cycle_day: Number.isFinite(cycleDay) ? cycleDay : null,
      data,
      created_at: normalized.submittedAt || new Date().toISOString()
    };
  }

  function rowToHistory(row) {
    const record = row?.data && typeof row.data === "object" ? clone(row.data) : {};
    record._archiveKey = row.archive_key;
    record.localDate ??= row.workout_date;
    record.date ??= row.workout_date;
    record.type ??= row.record_type;
    record.cycleNumber ??= row.cycle_number;
    record.cycleDay ??= row.cycle_day;
    record.submittedAt ??= row.created_at;
    return record;
  }

  async function fetchRemoteHistory(userId) {
    const pageSize = 1000;
    let from = 0;
    const rows = [];

    while (true) {
      const { data, error } = await client
        .from(HISTORY_TABLE)
        .select("archive_key, workout_date, record_type, cycle_number, cycle_day, data, created_at")
        .eq("user_id", userId)
        .order("workout_date", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    return rows.map(rowToHistory);
  }

  async function flushHistoryQueue(userId = currentUser?.id) {
    if (!userId) return true;
    const pending = readPendingHistory(userId);
    if (!pending.length) return true;
    if (!navigator.onLine) return false;

    const rows = pending.map(record => historyToRow(record, userId));
    const { error } = await client
      .from(HISTORY_TABLE)
      .upsert(rows, { onConflict: "user_id,archive_key" });
    if (error) throw error;

    pending.forEach(record => knownHistoryKeys.add(record._archiveKey));
    writePendingHistory(userId, []);
    return true;
  }

  function setSyncStatus(label, detail) {
    const status = document.getElementById("cloudStatus");
    const info = document.getElementById("syncDetail");
    const mode = document.getElementById("dataModeText");
    if (status) status.textContent = label;
    if (info && detail) info.textContent = detail;
    if (mode) {
      mode.textContent = currentUser
        ? "Supabase 主存储 · 当前状态与历史分表保存"
        : "未登录 · 本机保存";
    }
  }

  function formatSyncTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  function writePendingSnapshot() {
    if (!currentUser) return;
    localStorage.setItem(pendingKey(currentUser.id), JSON.stringify(currentStateSnapshot(state)));
  }

  function clearPendingIfSaved(userId, savedAt) {
    const key = pendingKey(userId);
    const pending = safeParse(localStorage.getItem(key));
    const pendingAt = pending?._meta?.updatedAt || "";
    if (!pending || pendingAt === savedAt) {
      localStorage.removeItem(key);
      return true;
    }
    return false;
  }

  async function saveCloudState({ silent = true } = {}) {
    if (!currentUser || !cloudReady) return false;

    if (!navigator.onLine) {
      setSyncStatus("离线 · 等待同步", "网络恢复后会自动上传临时修改和归档记录");
      return false;
    }

    if (syncInFlight) {
      needsResync = true;
      return false;
    }

    syncInFlight = true;
    const userId = currentUser.id;
    queueHistoryRecords(state.history);
    const snapshot = currentStateSnapshot(state);
    const updatedAt = snapshot._meta.updatedAt;
    setSyncStatus("同步中…", "正在保存当前状态和训练历史");

    try {
      // 先把新增历史写入独立表，再保存不含 history 的 user_state。
      // 这样即使第二步失败，历史也不会因为从 JSONB 中移除而丢失。
      await flushHistoryQueue(userId);

      const { error } = await client
        .from(TABLE)
        .upsert({
          user_id: userId,
          data: snapshot,
          updated_at: updatedAt
        }, { onConflict: "user_id" });

      if (error) throw error;

      const cleared = clearPendingIfSaved(userId, updatedAt);
      if (!cleared) needsResync = true;

      setSyncStatus(
        cleared ? "已同步" : "有新修改待同步",
        cleared ? `最近同步 ${formatSyncTime(updatedAt)}` : "正在继续同步最新修改"
      );
      if (!silent && cleared) toast("已同步到云端");
      return true;
    } catch (err) {
      console.error("Supabase save failed", err);
      setSyncStatus("同步失败 · 已临时保留", err?.message || "稍后可再次尝试");
      if (!silent) toast("云同步失败，修改暂存在本机待同步区");
      return false;
    } finally {
      syncInFlight = false;
      if (needsResync && currentUser?.id === userId) {
        needsResync = false;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveCloudState(), 250);
      }
    }
  }

  function scheduleCloudSave() {
    if (!currentUser || !cloudReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCloudState(), 650);
  }

  // 未登录：沿用 localStorage 完整保存。
  // 已登录：user_state 只保存当前状态；历史单独写入 workout_history。
  // 本机只保留当前状态 pending 和尚未成功写入的历史队列。
  persist = function persistByMode() {
    ensureMeta();
    state._meta.updatedAt = new Date().toISOString();

    if (!currentUser) {
      persistLocal();
      return;
    }

    if (!cloudReady) {
      setSyncStatus("云端尚未加载", "请联网完成云端读取后再记录训练");
      return;
    }

    queueHistoryRecords(state.history);
    writePendingSnapshot();
    scheduleCloudSave();
  };

  async function fetchRemoteState(userId) {
    const { data, error } = await client
      .from(TABLE)
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function applyState(nextState, history = null) {
    normalizeState(nextState);
    if (history) state.history = mergeHistory(history);
    renderAll();
  }

  async function reconcileUser(user) {
    currentUser = user;
    cloudReady = false;
    knownHistoryKeys = new Set();
    renderAuth(user);
    setSyncStatus("正在读取云端…", "正在加载当前状态和训练历史");

    // 清理上一版曾使用的“永久用户本机副本”，不迁移旧数据。
    localStorage.removeItem(LEGACY_OWNER_KEY);
    localStorage.removeItem(oldUserCacheKey(user.id));

    try {
      const [remote, cloudHistory] = await Promise.all([
        fetchRemoteState(user.id),
        fetchRemoteHistory(user.id)
      ]);
      cloudHistory.forEach(record => knownHistoryKeys.add(record._archiveKey));

      const pending = safeParse(localStorage.getItem(pendingKey(user.id)));
      const remoteLegacyHistory = Array.isArray(remote?.data?.history) ? remote.data.history : [];
      const pendingLegacyHistory = Array.isArray(pending?.history) ? pending.history : [];
      const queuedHistory = readPendingHistory(user.id);
      const combinedHistory = mergeHistory(cloudHistory, remoteLegacyHistory, pendingLegacyHistory, queuedHistory);
      const hasHistoryToMigrate = combinedHistory.some(record => !knownHistoryKeys.has(record._archiveKey));

      if (remote?.data) {
        if (!remote.data.days || typeof remote.data.days !== "object") {
          throw new Error("云端训练数据格式不正确");
        }

        const remoteTime = Date.parse(remote.updated_at || remote.data?._meta?.updatedAt || 0) || 0;
        const pendingTime = Date.parse(pending?._meta?.updatedAt || 0) || 0;
        const usePending = Boolean(pending && pendingTime > remoteTime);
        const chosen = clone(usePending ? pending : remote.data);
        delete chosen.history;

        cloudReady = true;
        applyState(chosen, combinedHistory);
        queueHistoryRecords(combinedHistory);

        // 旧版 user_state 若仍含 history，会在这里自动迁移到 workout_history，
        // 成功后再把 user_state 保存为“仅当前状态”。
        if (usePending || remoteLegacyHistory.length || pendingLegacyHistory.length || queuedHistory.length || hasHistoryToMigrate) {
          writePendingSnapshot();
          await saveCloudState();
        } else {
          localStorage.removeItem(pendingKey(user.id));
          setSyncStatus("已同步", `云端数据已加载 ${formatSyncTime(remote.updated_at)}`);
        }
        return;
      }

      // 新账号：不读取、不迁移未登录 localStorage，直接创建新的云端训练状态。
      cloudReady = true;
      if (pending) {
        const chosen = clone(pending);
        delete chosen.history;
        applyState(chosen, combinedHistory);
      } else {
        makeFreshState();
        state.history = combinedHistory;
        renderAll();
      }
      queueHistoryRecords(combinedHistory);
      writePendingSnapshot();
      await saveCloudState();
    } catch (err) {
      console.error("Supabase reconcile failed", err);
      cloudReady = false;
      setSyncStatus("云端读取失败", err?.message || "请检查网络或 Supabase 配置");
    }
  }

  function restoreAnonymousState() {
    const anonymous = safeParse(localStorage.getItem(KEY));
    if (anonymous) {
      normalizeState(anonymous);
    } else {
      makeFreshState();
      persistLocal();
    }
    renderAll();
  }

  function renderAuth(user) {
    const signedOut = document.getElementById("signedOutPanel");
    const signedIn = document.getElementById("signedInPanel");
    const email = document.getElementById("authUserEmail");
    if (!signedOut || !signedIn) return;
    signedOut.classList.toggle("hidden", Boolean(user));
    signedIn.classList.toggle("hidden", !user);
    if (email && user) email.textContent = user.email || "已登录";
    if (!user) setSyncStatus("未登录 · 本机模式", "训练记录保存在当前浏览器");
  }

  async function handleSession(session) {
    const user = session?.user || null;
    if (!user) {
      const wasSignedIn = Boolean(currentUser);
      currentUser = null;
      cloudReady = false;
      knownHistoryKeys = new Set();
      lastHandledUserId = null;
      renderAuth(null);
      if (wasSignedIn) restoreAnonymousState();
      return;
    }

    if (lastHandledUserId === user.id && currentUser?.id === user.id && cloudReady) return;
    lastHandledUserId = user.id;
    await reconcileUser(user);
  }

  async function signIn() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    if (!email || !password) return toast("请输入邮箱和密码");

    setSyncStatus("正在登录…", "连接 Supabase Auth");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(error);
      setSyncStatus("登录失败", error.message);
      return toast("登录失败：" + error.message);
    }

    await handleSession(data.session);
    toast("登录成功");
  }

  async function signUp() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    if (!email || !password) return toast("请输入邮箱和密码");
    if (password.length < 6) return toast("密码至少 6 位");

    setSyncStatus("正在注册…", "创建 Supabase 用户");
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
      console.error(error);
      setSyncStatus("注册失败", error.message);
      return toast("注册失败：" + error.message);
    }

    if (data.session) {
      await handleSession(data.session);
      toast("注册并登录成功");
    } else {
      setSyncStatus("请确认邮箱", "确认邮件中的链接后再登录");
      toast("注册成功，请先确认邮箱");
    }
  }

  async function signOut() {
    clearTimeout(saveTimer);
    if (currentUser && cloudReady && (
      localStorage.getItem(pendingKey(currentUser.id)) ||
      localStorage.getItem(historyPendingKey(currentUser.id))
    )) {
      await saveCloudState();
    }

    const { error } = await client.auth.signOut();
    if (error) return toast("退出失败：" + error.message);

    currentUser = null;
    cloudReady = false;
    knownHistoryKeys = new Set();
    lastHandledUserId = null;
    renderAuth(null);
    restoreAnonymousState();
    toast("已退出云端账号");
  }

  document.getElementById("signInBtn")?.addEventListener("click", signIn);
  document.getElementById("signUpBtn")?.addEventListener("click", signUp);
  document.getElementById("signOutBtn")?.addEventListener("click", signOut);
  document.getElementById("syncNowBtn")?.addEventListener("click", () => {
    if (currentUser && cloudReady) {
      queueHistoryRecords(state.history);
      writePendingSnapshot();
      saveCloudState({ silent: false });
    }
  });

  window.addEventListener("online", () => {
    if (!currentUser) return;
    if (!cloudReady) {
      reconcileUser(currentUser);
      return;
    }
    if (
      localStorage.getItem(pendingKey(currentUser.id)) ||
      localStorage.getItem(historyPendingKey(currentUser.id))
    ) saveCloudState();
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") handleSession(session);
    if (event === "SIGNED_OUT") handleSession(null);
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error(error);
      setSyncStatus("认证检查失败 · 本机模式", error.message);
      return;
    }
    handleSession(data.session);
  });
})();
