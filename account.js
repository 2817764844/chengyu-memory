/* 账号、云同步、版本与检查更新（「我的」页）。 */
(function () {
  const syncApi = window.CHENGYU_SYNC;
  const sessionKey = "chengyu-session";
  const syncedAtKey = "chengyu-sync-at";
  const syncApiReady = Boolean(syncApi && window.ChengyuStorage);

  const guestPanel = document.querySelector("#accountGuest");
  const userPanel = document.querySelector("#accountUser");
  const syncStatus = document.querySelector("#accountSync");
  const form = document.querySelector("#accountForm");
  const emailInput = document.querySelector("#accountEmail");
  const passwordInput = document.querySelector("#accountPassword");
  const formError = document.querySelector("#accountFormError");
  const submitButton = document.querySelector("#accountSubmit");
  const emailLabel = document.querySelector("#accountEmailLabel");
  const syncButton = document.querySelector("#accountSyncNow");

  if (!guestPanel || !syncApiReady) {
    return;
  }

  let mode = "login";
  let syncing = false;
  let syncQueued = false;
  let syncMessage = "";

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  function cloudConfig() {
    const source = window.CHENGYU_CLOUD || {};
    const url = String(source.url || "").trim().replace(/\/+$/, "");
    const anonKey = String(source.anonKey || "").trim();
    if (!url || !anonKey) {
      return null;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return null;
      }
    } catch {
      return null;
    }
    return { url, anonKey };
  }

  function readSession() {
    const session = readJson(sessionKey, null);
    if (!session || !session.access_token || !session.user || !session.user.id) {
      return null;
    }
    return session;
  }

  function writeSession(session) {
    if (!session) {
      try {
        localStorage.removeItem(sessionKey);
      } catch {
        /* ignore */
      }
      return;
    }
    writeJson(sessionKey, {
      access_token: session.access_token,
      refresh_token: session.refresh_token || "",
      expires_at: Number(session.expires_at) || 0,
      user: { id: session.user.id, email: session.user.email || "" },
    });
  }

  function setFormError(message) {
    if (!formError) return;
    formError.hidden = !message;
    formError.textContent = message || "";
  }

  function setSyncStatus(kind, text) {
    if (!syncStatus) return;
    syncStatus.className = `account-sync is-${kind || "idle"}`;
    syncStatus.textContent = text;
  }

  function formatClock(ms) {
    if (!ms) return "";
    try {
      return new Date(ms).toLocaleString("zh-CN", { hour12: false });
    } catch {
      return "";
    }
  }

  function renderSyncStatus() {
    const config = cloudConfig();
    const session = readSession();
    if (!config) {
      setSyncStatus("warn", "云同步未配置。本机数据仍会保存。");
      return;
    }
    if (!session) {
      setSyncStatus("idle", "未登录。登录后可将成语与近义组同步到云端。");
      return;
    }
    if (syncing) {
      setSyncStatus("busy", "正在同步…");
      return;
    }
    if (syncMessage) {
      setSyncStatus("warn", syncMessage);
      return;
    }
    const at = Number(localStorage.getItem(syncedAtKey) || 0);
    const dirty = ChengyuStorage.isDirty();
    if (dirty) {
      setSyncStatus("warn", "本机有未上传的改动，稍后会自动同步。");
      return;
    }
    if (at) {
      setSyncStatus("ok", `已与云端同步（${formatClock(at)}）。`);
      return;
    }
    setSyncStatus("ok", "已登录。可在下方手动同步。");
  }

  function renderAccount() {
    const session = readSession();
    const loggedIn = Boolean(session);
    guestPanel.hidden = loggedIn;
    userPanel.hidden = !loggedIn;
    if (loggedIn && emailLabel) {
      emailLabel.textContent = session.user.email || "已登录";
    }
    renderSyncStatus();
    if (window.ChengyuAppUpdate && typeof window.ChengyuAppUpdate.refreshVersionLabel === "function") {
      window.ChengyuAppUpdate.refreshVersionLabel();
    }
  }

  async function cloudFetch(path, options) {
    const config = cloudConfig();
    if (!config) {
      const error = new Error("云同步未配置");
      throw error;
    }
    const headers = Object.assign(
      { apikey: config.anonKey, "Content-Type": "application/json" },
      (options && options.headers) || {},
    );
    const response = await fetch(`${config.url}${path}`, {
      method: (options && options.method) || "GET",
      headers,
      body: options && options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
    }
    if (!response.ok) {
      const error = new Error((body && body.msg) || (body && body.message) || "请求失败");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function sessionFromAuth(body) {
    if (!body || typeof body !== "object") return null;
    if (body.access_token && body.user) return body;
    if (body.session && body.session.access_token) return body.session;
    return null;
  }

  async function ensureSession() {
    const session = readSession();
    if (!session) return null;
    const expiresAt = Number(session.expires_at) || 0;
    if (!expiresAt || expiresAt * 1000 > Date.now() + 60000) {
      return session;
    }
    if (!session.refresh_token) return session;
    const body = await cloudFetch("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    const next = sessionFromAuth(body);
    if (!next) throw new Error("登录状态已失效，请重新登录。");
    writeSession(next);
    return readSession();
  }

  async function fetchRemote(session) {
    const rows = await cloudFetch(
      `/rest/v1/chengyu_state?select=idioms,groups,tombstones,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
      },
    );
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0];
  }

  async function writeRemote(session, bundle, remote) {
    const payload = {
      user_id: session.user.id,
      idioms: bundle.idioms,
      groups: bundle.groups,
      tombstones: bundle.tombstones,
      updated_at: new Date().toISOString(),
    };
    const headers = {
      Authorization: `Bearer ${session.access_token}`,
      Prefer: "return=representation",
    };
    if (!remote) {
      const created = await cloudFetch("/rest/v1/chengyu_state", {
        method: "POST",
        headers,
        body: payload,
      });
      return Array.isArray(created) ? created[0] : created;
    }
    const updated = await cloudFetch(
      `/rest/v1/chengyu_state?user_id=eq.${encodeURIComponent(session.user.id)}&updated_at=eq.${encodeURIComponent(remote.updated_at)}`,
      {
        method: "PATCH",
        headers,
        body: {
          idioms: payload.idioms,
          groups: payload.groups,
          tombstones: payload.tombstones,
          updated_at: payload.updated_at,
        },
      },
    );
    if (Array.isArray(updated) && !updated.length) {
      return null;
    }
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async function syncNow() {
    const config = cloudConfig();
    const session = readSession();
    if (!config || !session) {
      renderSyncStatus();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      syncMessage = "网络不可用，稍后会自动重试。";
      renderSyncStatus();
      return;
    }
    if (syncing) {
      syncQueued = true;
      return;
    }
    syncing = true;
    syncMessage = "";
    renderSyncStatus();
    try {
      let saved = false;
      for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
        const current = await ensureSession();
        const remote = await fetchRemote(current);
        const remoteBundle = remote
          ? syncApi.normalizeBundle({
              idioms: remote.idioms,
              groups: remote.groups,
              tombstones: remote.tombstones,
            })
          : syncApi.normalizeBundle({ idioms: [], groups: [], tombstones: {} });
        const localBundle = ChengyuStorage.exportBundle();
        const merged = syncApi.mergeBundle(localBundle, remoteBundle);
        if (!syncApi.bundlesEqual(merged, localBundle)) {
          ChengyuStorage.importBundle(merged);
        }
        if (remote && syncApi.bundlesEqual(merged, remoteBundle) && !ChengyuStorage.isDirty()) {
          saved = true;
          break;
        }
        try {
          const written = await writeRemote(current, merged, remote);
          saved = Boolean(written);
        } catch (error) {
          if (error.status === 409) continue;
          throw error;
        }
      }
      if (!saved) {
        throw new Error("云端正在被另一台设备更新，请稍后再试。");
      }
      ChengyuStorage.clearDirty();
      localStorage.setItem(syncedAtKey, String(Date.now()));
    } catch (error) {
      syncMessage = (error && error.message) || "同步失败";
    } finally {
      syncing = false;
      renderSyncStatus();
      if (syncQueued) {
        syncQueued = false;
        syncNow();
      }
    }
  }

  function scheduleSync() {
    if (!readSession()) return;
    clearTimeout(scheduleSync._t);
    scheduleSync._t = setTimeout(() => syncNow(), 800);
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  async function submitAccount(event) {
    event.preventDefault();
    setFormError("");
    const email = String(emailInput.value || "").trim();
    const password = String(passwordInput.value || "");
    if (!validEmail(email)) {
      setFormError("请输入有效邮箱。");
      return;
    }
    if (password.length < 6) {
      setFormError("密码至少 6 位。");
      return;
    }
    submitButton.disabled = true;
    try {
      let body;
      if (mode === "register") {
        body = await cloudFetch("/auth/v1/signup", {
          method: "POST",
          body: { email, password },
        });
      } else {
        body = await cloudFetch("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email, password },
        });
      }
      const session = sessionFromAuth(body);
      if (!session) {
        setFormError(mode === "register" ? "注册成功，请查收验证邮件后登录。" : "登录失败。");
        return;
      }
      writeSession(session);
      renderAccount();
      await syncNow();
    } catch (error) {
      setFormError((error && error.message) || "请求失败");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function signOut() {
    writeSession(null);
    syncMessage = "";
    renderAccount();
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll("[data-account-mode]").forEach((btn) => {
      const on = btn.getAttribute("data-account-mode") === mode;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (submitButton) {
      submitButton.textContent = mode === "register" ? "注册" : "登录";
    }
  }

  form.addEventListener("submit", submitAccount);
  document.querySelector("#accountSignOut")?.addEventListener("click", signOut);
  syncButton?.addEventListener("click", () => syncNow());
  document.querySelectorAll("[data-account-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-account-mode")));
  });

  document.addEventListener("chengyu:dirty", scheduleSync);
  document.addEventListener("chengyu:view", (e) => {
    if (e.detail === "account") {
      renderAccount();
    }
  });

  window.ChengyuAccount = { syncNow, renderAccount };
  setMode("login");
  renderAccount();
})();