(() => {
  const cfg = window.SUPABASE_CONFIG;
  const sdk = window.supabase;
  if (!cfg?.url || !cfg?.publishableKey || !sdk?.createClient) {
    console.warn("Supabase 未初始化，继续使用本机模式。");
    return;
  }

  const client = sdk.createClient(cfg.url, cfg.publishableKey);
  const TABLE = cfg.table || "user_state";
  const LEGACY_OWNER_KEY = `${KEY}::cloud-migration-owner`;
  let currentUser = null;
  let cloudReady = false;
  let saveTimer = null;
  let syncInFlight = false;
  let needsResync = false;
  let lastHandledUserId = null;

  // app.js 原始 persist：仅用于“未登录模式”的本机保存。
  const persistLocal = persist;

  function pendingKey(userId) {
    return `${KEY}::pending::${userId}`;
  }

  function oldUserCacheKey(userId) {
    return `${KEY}::user::${userId}`;
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      return obj?.days && Array.isArray(obj?.history) ? obj : null;
    } catch {
      return null;
    }
  }

  function ensureMeta(target = state) {
    if (!target._meta || typeof target._meta !== "object") target._meta = {};
    if (!target._meta.updatedAt) target._meta.updatedAt = new Date().toISOString();
    return target;
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

  function setSyncStatus(label, detail) {
    const status = document.getElementById("cloudStatus");
    const info = document.getElementById("syncDetail");
    const mode = document.getElementById("dataModeText");
    if (status) status.textContent = label;
    if (info && detail) info.textContent = detail;
    if (mode) {
      mode.textContent = currentUser
        ? "Supabase 主存储 · 本机仅临时待同步"
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
    localStorage.setItem(pendingKey(currentUser.id), JSON.stringify(state));
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
      setSyncStatus("离线 · 等待同步", "网络恢复后会自动上传临时修改");
      return false;
    }

    if (syncInFlight) {
      needsResync = true;
      return false;
    }

    syncInFlight = true;
    const userId = currentUser.id;
    const snapshot = JSON.parse(JSON.stringify(ensureMeta(state)));
    const updatedAt = snapshot._meta.updatedAt;
    setSyncStatus("同步中…", "正在保存到 Supabase");

    try {
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
  // 已登录：不再写完整长期本机副本，只覆盖一份临时 pending 快照；云端成功后立即删除。
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

  function applyState(nextState) {
    normalizeState(nextState);
    renderAll();
  }

  async function reconcileUser(user) {
    currentUser = user;
    cloudReady = false;
    renderAuth(user);
    setSyncStatus("正在读取云端…", "Supabase 是登录后的主数据源");

    // 清理上一版曾使用的“永久用户本机副本”，不迁移旧数据。
    localStorage.removeItem(LEGACY_OWNER_KEY);
    localStorage.removeItem(oldUserCacheKey(user.id));

    try {
      const remote = await fetchRemoteState(user.id);
      const pending = safeParse(localStorage.getItem(pendingKey(user.id)));

      if (remote?.data) {
        if (!remote.data.days || !Array.isArray(remote.data.history)) {
          throw new Error("云端训练数据格式不正确");
        }

        const remoteTime = Date.parse(remote.updated_at || remote.data?._meta?.updatedAt || 0) || 0;
        const pendingTime = Date.parse(pending?._meta?.updatedAt || 0) || 0;

        cloudReady = true;
        if (pending && pendingTime > remoteTime) {
          applyState(pending);
          await saveCloudState();
        } else {
          localStorage.removeItem(pendingKey(user.id));
          applyState(remote.data);
          setSyncStatus("已同步", `云端数据已加载 ${formatSyncTime(remote.updated_at)}`);
        }
        return;
      }

      // 新账号：不读取、不迁移未登录 localStorage，直接创建新的云端训练状态。
      cloudReady = true;
      if (pending) {
        applyState(pending);
      } else {
        makeFreshState();
        renderAll();
        writePendingSnapshot();
      }
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
    if (currentUser && cloudReady && localStorage.getItem(pendingKey(currentUser.id))) {
      await saveCloudState();
    }

    const { error } = await client.auth.signOut();
    if (error) return toast("退出失败：" + error.message);

    currentUser = null;
    cloudReady = false;
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
    if (localStorage.getItem(pendingKey(currentUser.id))) saveCloudState();
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
