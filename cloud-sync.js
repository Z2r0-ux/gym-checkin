(() => {
  const cfg = window.SUPABASE_CONFIG;
  const sdk = window.supabase;
  if (!cfg?.url || !cfg?.publishableKey || !sdk?.createClient) {
    console.warn("Supabase 未初始化，继续使用本机缓存模式。");
    return;
  }

  const client = sdk.createClient(cfg.url, cfg.publishableKey);
  const TABLE = cfg.table || "user_state";
  const OWNER_KEY = `${KEY}::cloud-migration-owner`;
  let currentUser = null;
  let saveTimer = null;
  let syncInFlight = false;
  let lastHandledUserId = null;

  const persistLocal = persist;

  function userCacheKey(userId) {
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

  function freshState() {
    state = {
      currentDay: PROFILE.defaultDay,
      days: {},
      history: [],
      _meta: { updatedAt: new Date().toISOString() }
    };
    PLAN.forEach(initDay);
    return state;
  }

  function storeLocalSnapshot() {
    persistLocal();
    if (currentUser) {
      localStorage.setItem(userCacheKey(currentUser.id), JSON.stringify(state));
    }
  }

  function setSyncStatus(label, detail) {
    const status = document.getElementById("cloudStatus");
    const info = document.getElementById("syncDetail");
    const mode = document.getElementById("dataModeText");
    if (status) status.textContent = label;
    if (info && detail) info.textContent = detail;
    if (mode) mode.textContent = currentUser ? "本机缓存 + Supabase 云同步" : "本机缓存 · 未登录云端";
  }

  function formatSyncTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  async function saveCloudState({ silent = true } = {}) {
    if (!currentUser || syncInFlight || !navigator.onLine) return false;
    syncInFlight = true;
    setSyncStatus("同步中…", "正在保存到 Supabase");
    try {
      ensureMeta();
      const updatedAt = state._meta.updatedAt;
      const { error } = await client
        .from(TABLE)
        .upsert({
          user_id: currentUser.id,
          data: state,
          updated_at: updatedAt
        }, { onConflict: "user_id" });
      if (error) throw error;
      localStorage.setItem(userCacheKey(currentUser.id), JSON.stringify(state));
      setSyncStatus("已同步", `最近同步 ${formatSyncTime(updatedAt)}`);
      if (!silent) toast("已同步到云端");
      return true;
    } catch (err) {
      console.error("Supabase save failed", err);
      setSyncStatus("同步失败 · 已保存在本机", err?.message || "稍后会再次尝试");
      if (!silent) toast("云同步失败，本机记录已保留");
      return false;
    } finally {
      syncInFlight = false;
    }
  }

  function scheduleCloudSave() {
    if (!currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCloudState(), 650);
  }

  persist = function persistWithCloud() {
    ensureMeta();
    state._meta.updatedAt = new Date().toISOString();
    storeLocalSnapshot();
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
    state = nextState;
    if (!state.currentDay) state.currentDay = PROFILE.defaultDay;
    if (!state.days) state.days = {};
    if (!Array.isArray(state.history)) state.history = [];
    ensureMeta();
    PLAN.forEach(initDay);
    storeLocalSnapshot();
    renderAll();
  }

  async function reconcileUser(user) {
    currentUser = user;
    renderAuth(user);
    setSyncStatus("正在读取云端…", "检查云端和本机数据");

    try {
      const remote = await fetchRemoteState(user.id);
      const userLocal = safeParse(localStorage.getItem(userCacheKey(user.id)));
      const migrationOwner = localStorage.getItem(OWNER_KEY);

      if (!remote) {
        if (userLocal) {
          applyState(userLocal);
        } else if (!migrationOwner) {
          // 第一个登录账号接管升级前的 gym_mobile_v3 数据。
          ensureMeta();
          localStorage.setItem(OWNER_KEY, user.id);
          storeLocalSnapshot();
        } else if (migrationOwner !== user.id) {
          // 防止同一设备切换账号时把 A 的训练数据上传给 B。
          freshState();
          storeLocalSnapshot();
          renderAll();
        }
        await saveCloudState();
        return;
      }

      const remoteState = remote.data;
      if (!remoteState?.days || !Array.isArray(remoteState?.history)) {
        throw new Error("云端训练数据格式不正确");
      }

      const localCandidate = userLocal;
      const localTime = Date.parse(localCandidate?._meta?.updatedAt || 0) || 0;
      const remoteTime = Date.parse(remote.updated_at || remoteState?._meta?.updatedAt || 0) || 0;

      if (localCandidate && localTime > remoteTime) {
        applyState(localCandidate);
        await saveCloudState();
      } else {
        applyState(remoteState);
        setSyncStatus("已同步", `云端数据已加载 ${formatSyncTime(remote.updated_at)}`);
      }
    } catch (err) {
      console.error("Supabase reconcile failed", err);
      setSyncStatus("云端连接失败 · 本机可继续使用", err?.message || "请检查 Supabase 配置");
    }
  }

  function renderAuth(user) {
    const signedOut = document.getElementById("signedOutPanel");
    const signedIn = document.getElementById("signedInPanel");
    const email = document.getElementById("authUserEmail");
    if (!signedOut || !signedIn) return;
    signedOut.classList.toggle("hidden", Boolean(user));
    signedIn.classList.toggle("hidden", !user);
    if (email && user) email.textContent = user.email || "已登录";
    if (!user) setSyncStatus("未登录 · 本机模式", "登录后启用云同步");
  }

  async function handleSession(session) {
    const user = session?.user || null;
    if (!user) {
      currentUser = null;
      lastHandledUserId = null;
      renderAuth(null);
      return;
    }
    if (lastHandledUserId === user.id && currentUser?.id === user.id) return;
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
    if (currentUser) await saveCloudState();
    const { error } = await client.auth.signOut();
    if (error) return toast("退出失败：" + error.message);
    currentUser = null;
    lastHandledUserId = null;
    renderAuth(null);
    toast("已退出云端账号");
  }

  document.getElementById("signInBtn")?.addEventListener("click", signIn);
  document.getElementById("signUpBtn")?.addEventListener("click", signUp);
  document.getElementById("signOutBtn")?.addEventListener("click", signOut);
  document.getElementById("syncNowBtn")?.addEventListener("click", () => saveCloudState({ silent: false }));

  window.addEventListener("online", () => {
    if (currentUser) saveCloudState();
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
