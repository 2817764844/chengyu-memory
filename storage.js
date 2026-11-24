/* Persistence for user idioms and similar-meaning groups. */
(function (global) {
  const STORAGE_KEY = "chengyu-memory-v1";

  function createId() {
    if (global.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function defaultState() {
    return { idioms: [], groups: [], version: 1 };
  }

  function read() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        idioms: Array.isArray(parsed.idioms) ? parsed.idioms : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        version: parsed.version || 1,
      };
    } catch {
      return defaultState();
    }
  }

  function write(state) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    if (idx < 0 && record.id) {
      idx = -1;
    }
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
    write(state);
    return item;
  }

  function deleteIdiom(id) {
    const state = read();
    state.idioms = state.idioms.filter((x) => x.id !== id);
    state.groups = state.groups.map((g) => ({
      ...g,
      members: g.members.filter((m) => m.idiomId !== id),
    }));
    write(state);
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
    const members = (record.members || []).map((m) => ({
      text: String(m.text || "").trim(),
      meaning: String(m.meaning || "").trim(),
      idiomId: m.idiomId || null,
    })).filter((m) => m.text);

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
    write(state);
    return item;
  }

  function deleteGroup(id) {
    const state = read();
    state.groups = state.groups.filter((g) => g.id !== id);
    write(state);
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
    createId,
  };
})(typeof window !== "undefined" ? window : globalThis);