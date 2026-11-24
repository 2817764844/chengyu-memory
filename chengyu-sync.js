/* 成语与近义组的云合并逻辑（浏览器 + 可选 Node 测试共用）。 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.CHENGYU_SYNC = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function asTime(value) {
    const t = Number(value);
    if (!Number.isFinite(t) || t < 0) {
      return 0;
    }
    return Math.floor(t);
  }

  function normalizeTombstones(source) {
    const base = source && typeof source === "object" ? source : {};
    const idioms = base.idioms && typeof base.idioms === "object" ? base.idioms : {};
    const groups = base.groups && typeof base.groups === "object" ? base.groups : {};
    return { idioms: { ...idioms }, groups: { ...groups } };
  }

  function normalizeBundle(bundle) {
    const source = bundle && typeof bundle === "object" ? bundle : {};
    return {
      idioms: Array.isArray(source.idioms) ? source.idioms.slice() : [],
      groups: Array.isArray(source.groups) ? source.groups.slice() : [],
      tombstones: normalizeTombstones(source.tombstones),
    };
  }

  function indexById(list) {
    const map = new Map();
    (list || []).forEach((item) => {
      if (item && item.id) {
        map.set(item.id, item);
      }
    });
    return map;
  }

  function mergeTombstones(left, right) {
    const out = { idioms: {}, groups: {} };
    ["idioms", "groups"].forEach((kind) => {
      const ids = new Set([
        ...Object.keys(left[kind] || {}),
        ...Object.keys(right[kind] || {}),
      ]);
      ids.forEach((id) => {
        const l = asTime(left[kind] && left[kind][id]);
        const r = asTime(right[kind] && right[kind][id]);
        const best = Math.max(l, r);
        if (best > 0) {
          out[kind][id] = best;
        }
      });
    });
    return out;
  }

  function resolveRecord(id, localItem, remoteItem, lDel, rDel) {
    const lUp = localItem ? asTime(localItem.updatedAt) : 0;
    const rUp = remoteItem ? asTime(remoteItem.updatedAt) : 0;
    const lMark = Math.max(lUp, asTime(lDel));
    const rMark = Math.max(rUp, asTime(rDel));

    if (lMark === 0 && rMark === 0) {
      return null;
    }

    const pickLocal = lMark > rMark || (lMark === rMark && lUp >= rUp);
    const winnerDel = pickLocal ? asTime(lDel) : asTime(rDel);
    const winnerUp = pickLocal ? lUp : rUp;
    const winnerItem = pickLocal ? localItem : remoteItem;

    if (winnerDel > 0 && winnerDel >= winnerUp) {
      return null;
    }
    return winnerItem || (pickLocal ? remoteItem : localItem) || null;
  }

  function mergeList(localList, remoteList, localTombs, remoteTombs, kind) {
    const localMap = indexById(localList);
    const remoteMap = indexById(remoteList);
    const ids = new Set([
      ...localMap.keys(),
      ...remoteMap.keys(),
      ...Object.keys(localTombs[kind] || {}),
      ...Object.keys(remoteTombs[kind] || {}),
    ]);
    const out = [];
    ids.forEach((id) => {
      const item = resolveRecord(
        id,
        localMap.get(id),
        remoteMap.get(id),
        localTombs[kind] && localTombs[kind][id],
        remoteTombs[kind] && remoteTombs[kind][id],
      );
      if (item) {
        out.push(item);
      }
    });
    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return out;
  }

  function mergeBundle(local, cloud) {
    const left = normalizeBundle(local);
    const right = normalizeBundle(cloud);
    const tombstones = mergeTombstones(left.tombstones, right.tombstones);
    return {
      idioms: mergeList(left.idioms, right.idioms, left.tombstones, right.tombstones, "idioms"),
      groups: mergeList(left.groups, right.groups, left.tombstones, right.tombstones, "groups"),
      tombstones,
    };
  }

  function bundlesEqual(left, right) {
    return JSON.stringify(normalizeBundle(left)) === JSON.stringify(normalizeBundle(right));
  }

  return {
    normalizeBundle,
    mergeBundle,
    mergeTombstones,
    bundlesEqual,
  };
});