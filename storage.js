/* Persistence for user idioms and similar-meaning groups. */
(function (global) {
  const STORAGE_KEY = "chengyu-memory-v1";
  const DIRTY_KEY = "chengyu-sync-dirty";

  function createId() {
    if (global.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function defaultState() {
    return {
      idioms: [],
      groups: [],
      tombstones: { idioms: {}, groups: {} },
      version: 2,
    };
  }

  function read() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const state = {
        idioms: Array.isArray(parsed.idioms) ? parsed.idioms : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        tombstones:
          parsed.tombstones && typeof parsed.tombstones === "object"
            ? {
                idioms: { ...(parsed.tombstones.idioms || {}) },
                groups: { ...(parsed.tombstones.groups || {}) },
              }
            : { idioms: {}, groups: {} },
        version: parsed.version || 1,
      };
      if (state.version < 2) {
        state.version = 2;
        state.tombstones = state.tombstones || { idioms: {}, groups: {} };
      }
      return state;
    } catch {
      return defaultState();
    }
  }

  function write(state) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function notifyDirty() {
    try {
      global.localStorage.setItem(DIRTY_KEY, "1");
    } catch {
      /* ignore */
    }
    global.document &&
      global.document.dispatchEvent(new CustomEvent("chengyu:dirty"));
  }

  function clearDirty() {
    try {
      global.localStorage.removeItem(DIRTY_KEY);
    } catch {
      /* ignore */
    }
  }

  function isDirty() {
    try {
      return global.localStorage.getItem(DIRTY_KEY) === "1";
    } catch {
      return false;
    }
  }

  function exportBundle() {
    const state = read();
    return {
      idioms: state.idioms,
      groups: state.groups,
      tombstones: state.tombstones,
    };
  }

  function importBundle(bundle) {
    const incoming =
      global.CHENGYU_SYNC && global.CHENGYU_SYNC.mergeBundle
        ? global.CHENGYU_SYNC.mergeBundle(read(), bundle)
        : bundle;
    write({
      idioms: incoming.idioms || [],
      groups: incoming.groups || [],
      tombstones: incoming.tombstones || { idioms: {}, groups: {} },
      version: 2,
    });
    global.document &&
      global.document.dispatchEvent(new CustomEvent("chengyu:data-changed"));
  }

  function listIdioms() {
    return read().idioms.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function normalizeText(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, "");
  }

  function saveIdiom(record) {
    const state = read();
    const now = Date.now();
    let idx = state.idioms.findIndex((x) => x.id === record.id);
    if (idx < 0 && record.text) {
      const n = normalizeText(record.text);
      idx = state.idioms.findIndex((x) => normalizeText(x.text) === n);
    }
    const item = {
      id: record.id || createId(),
      text: String(record.text || "").trim(),
      meaning: String(record.meaning || "").trim(),
      example: String(record.example || "").trim(),
      createdAt: record.createdAt || now,
      updatedAt: now,
    };
    if (!item.text) {
      throw new Error("成语不能为空");
    }
    if (idx >= 0) {
      item.createdAt = state.idioms[idx].createdAt;
      state.idioms[idx] = item;
    } else {
      state.idioms.push(item);
    }
    if (state.tombstones.idioms[item.id]) {
      delete state.tombstones.idioms[item.id];
    }
    write(state);
    notifyDirty();
    return item;
  }

  function deleteIdiom(id) {
    const state = read();
    const now = Date.now();
    state.idioms = state.idioms.filter((x) => x.id !== id);
    state.tombstones.idioms[id] = now;
    state.groups = state.groups.map((g) => ({
      ...g,
      members: g.members.filter((m) => m.idiomId !== id),
      updatedAt: Math.max(g.updatedAt || 0, now),
    }));
    write(state);
    notifyDirty();
  }

  function getIdiom(id) {
    return read().idioms.find((x) => x.id === id) || null;
  }

  function listGroups() {
    return read()
      .groups.slice()
      .filter((g) => g.members && g.members.length >= 2)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function saveGroup(record) {
    const state = read();
    const now = Date.now();
    const members = (record.members || [])
      .map((m) => ({
        text: String(m.text || "").trim(),
        meaning: String(m.meaning || "").trim(),
        idiomId: m.idiomId || null,
      }))
      .filter((m) => m.text);

    if (members.length < 2) {
      throw new Error("近义组至少需要两个成语");
    }

    const item = {
      id: record.id || createId(),
      title: String(record.title || "").trim() || members.map((m) => m.text).join(" · "),
      note: String(record.note || "").trim(),
      members,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    const idx = state.groups.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      item.createdAt = state.groups[idx].createdAt;
      state.groups[idx] = item;
    } else {
      state.groups.push(item);
    }
    if (state.tombstones.groups[item.id]) {
      delete state.tombstones.groups[item.id];
    }
    write(state);
    notifyDirty();
    return item;
  }

  function deleteGroup(id) {
    const state = read();
    const now = Date.now();
    state.groups = state.groups.filter((g) => g.id !== id);
    state.tombstones.groups[id] = now;
    write(state);
    notifyDirty();
  }

  function getGroup(id) {
    return read().groups.find((x) => x.id === id) || null;
  }

  function exportJson() {
    return JSON.stringify(read(), null, 2);
  }

  global.ChengyuStorage = {
    read,
    write,
    listIdioms,
    saveIdiom,
    deleteIdiom,
    getIdiom,
    listGroups,
    saveGroup,
    deleteGroup,
    getGroup,
    exportJson,
    exportBundle,
    importBundle,
    createId,
    notifyDirty,
    clearDirty,
    isDirty,
  };
})(typeof window !== "undefined" ? window : globalThis);