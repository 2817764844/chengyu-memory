/* 成语记忆 — main UI */
(function () {
  const state = {
    view: "gallery",
    pendingDelete: null,
    groupRowMin: 2,
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.galleryGrid = $("galleryGrid");
    els.galleryEmpty = $("galleryEmpty");
    els.gallerySearch = $("gallerySearch");
    els.userGroupsGrid = $("userGroupsGrid");
    els.groupsEmpty = $("groupsEmpty");
    els.bankList = $("bankList");
    els.bankSearch = $("bankSearch");
    els.manageIdiomList = $("manageIdiomList");
    els.toast = $("toast");
    els.confirmDialog = $("confirmDialog");
    els.confirmMessage = $("confirmMessage");
    els.headerBankCount = $("headerBankCount");
    els.headerUserCount = $("headerUserCount");
    els.bankCountInline = $("bankCountInline");
    els.groupRows = $("groupRows");
    els.singleText = $("singleText");
    els.singleMeaning = $("singleMeaning");
    els.singleExample = $("singleExample");
    els.singleMeaningHint = $("singleMeaningHint");
    els.singleId = $("singleId");
  }

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.hidden = true;
    }, 2400);
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll(".view-panel").forEach((p) => {
      p.classList.toggle("is-active", p.id === `view-${view}`);
    });
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === view);
    });
    if (view === "gallery") renderGallery();
    if (view === "manage") renderManageList();
    if (view === "groups") renderUserGroups();
    if (view === "bank") renderBank();
  }

  function updateCounts() {
    const bankN = ChengyuDictionary.bankSize();
    const userN = ChengyuStorage.listIdioms().length;
    els.headerBankCount.textContent = String(bankN);
    els.headerUserCount.textContent = String(userN);
    if (els.bankCountInline) els.bankCountInline.textContent = String(bankN);
  }

  function autofillMeaning(textInput, meaningInput, hintEl, exampleInput) {
    const text = ChengyuDictionary.normalizeText(textInput.value);
    if (!text) {
      if (hintEl) hintEl.hidden = true;
      return;
    }
    const hit = ChengyuDictionary.lookup(text);
    if (hit) {
      if (!meaningInput.value.trim() || meaningInput.dataset.autofill === "1") {
        meaningInput.value = hit.meaning;
        meaningInput.dataset.autofill = "1";
      }
      if (exampleInput && hit.example && !exampleInput.value.trim()) {
        exampleInput.value = hit.example;
      }
      if (hintEl) hintEl.hidden = true;
    } else if (!meaningInput.value.trim()) {
      if (hintEl) hintEl.hidden = false;
      meaningInput.dataset.autofill = "0";
    }
  }

  function createFlipCard(item, options) {
    const opts = options || {};
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flip-card";
    btn.setAttribute("aria-label", `${item.text}，点击查看释义`);

    const inner = document.createElement("div");
    inner.className = "flip-card-inner";

    const front = document.createElement("div");
    front.className = "flip-face front";
    front.innerHTML = `<p class="idiom-text">${escapeHtml(item.text)}</p><p class="reveal-hint">点击查看释义</p>`;

    const back = document.createElement("div");
    back.className = "flip-face back";
    const meaning = item.meaning || "（未填写释义）";
    const example = item.example ? `<p class="idiom-example">例：${escapeHtml(item.example)}</p>` : "";
    back.innerHTML = `<p class="idiom-text">${escapeHtml(item.text)}</p><p class="idiom-meaning">${escapeHtml(meaning)}</p>${example}`;

    if (opts.editable && item.id) {
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-button";
      editBtn.textContent = "编辑";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        loadSingleForm(item);
        setView("manage");
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-button";
      delBtn.textContent = "删除";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDelete("idiom", item.id, item.text);
      });
      actions.append(editBtn, delBtn);
      back.appendChild(actions);
    }

    const similarBlock = renderInlineSimilar(item.text, item.meaning);
    if (similarBlock) back.appendChild(similarBlock);

    inner.append(front, back);
    btn.appendChild(inner);

    btn.addEventListener("click", () => {
      const open = btn.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    return btn;
  }

  function renderInlineSimilar(text, meaning) {
    const sug = ChengyuSimilarMatcher.suggestForIdiom(text, meaning);
    if (!sug.items.length) return null;
    const wrap = document.createElement("div");
    wrap.className = "user-suggest";
    const label = document.createElement("p");
    label.textContent =
      sug.source === "bank" ? "词库近义推荐：" : sug.source === "local" ? "根据释义本地匹配：" : "近义推荐：";
    wrap.appendChild(label);
    const row = document.createElement("div");
    row.className = "bank-similar";
    sug.items.forEach((s) => {
      const mini = document.createElement("div");
      mini.className = "mini-card";
      mini.innerHTML = `<b>${escapeHtml(s.text)}</b>${escapeHtml(truncate(s.meaning, 40))}`;
      row.appendChild(mini);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function renderGallery() {
    const q = (els.gallerySearch.value || "").trim().toLowerCase();
    const items = ChengyuStorage.listIdioms().filter((it) => {
      if (!q) return true;
      return (
        it.text.toLowerCase().includes(q) ||
        (it.meaning || "").toLowerCase().includes(q)
      );
    });

    els.galleryGrid.innerHTML = "";
    const hasItems = items.length > 0;
    els.galleryEmpty.hidden = hasItems;
    els.galleryGrid.hidden = !hasItems;

    items.forEach((item) => {
      els.galleryGrid.appendChild(createFlipCard(item, { editable: true }));
    });
    updateCounts();
  }

  function renderUserGroups() {
    const groups = ChengyuStorage.listGroups();
    els.userGroupsGrid.innerHTML = "";
    els.groupsEmpty.hidden = groups.length > 0;
    els.userGroupsGrid.hidden = groups.length === 0;

    groups.forEach((g) => {
      const card = document.createElement("article");
      card.className = "group-card";
      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.justifyContent = "space-between";
      head.style.gap = "8px";

      const h3 = document.createElement("h3");
      h3.textContent = g.title;
      head.appendChild(h3);

      const actions = document.createElement("div");
      actions.className = "record-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => loadGroupForm(g));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "icon-button";
      del.textContent = "删除";
      del.addEventListener("click", () => confirmDelete("group", g.id, g.title));
      actions.append(edit, del);
      head.appendChild(actions);
      card.appendChild(head);

      if (g.note) {
        const note = document.createElement("p");
        note.className = "muted";
        note.textContent = g.note;
        card.appendChild(note);
      }

      const members = document.createElement("div");
      members.className = "members";
      (g.members || []).forEach((m) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${escapeHtml(m.text)}<small>${escapeHtml(truncate(m.meaning || "暂无释义", 28))}</small>`;
        members.appendChild(chip);
      });
      card.appendChild(members);

      const flipWrap = document.createElement("div");
      flipWrap.className = "card-grid";
      flipWrap.style.marginTop = "12px";
      (g.members || []).forEach((m) => {
        flipWrap.appendChild(
          createFlipCard({ text: m.text, meaning: m.meaning, example: "" }, { editable: false })
        );
      });
      card.appendChild(flipWrap);

      els.userGroupsGrid.appendChild(card);
    });
  }

  function renderBank() {
    const q = (els.bankSearch.value || "").trim().toLowerCase();
    const rows = ChengyuSimilarMatcher.allBankSuggestions().filter((row) => {
      if (!q) return true;
      return (
        row.text.toLowerCase().includes(q) ||
        row.meaning.toLowerCase().includes(q) ||
        row.similar.some((s) => s.text.toLowerCase().includes(q))
      );
    });

    els.bankList.innerHTML = "";
    rows.forEach((row) => {
      const art = document.createElement("article");
      art.className = "bank-item";
      art.innerHTML = `<div class="bank-head"><strong>${escapeHtml(row.text)}</strong><span>${escapeHtml(row.meaning)}</span></div>`;
      if (row.example) {
        const ex = document.createElement("p");
        ex.className = "muted";
        ex.textContent = `例：${row.example}`;
        art.appendChild(ex);
      }
      const sim = document.createElement("div");
      sim.className = "bank-similar";
      row.similar.forEach((s) => {
        const m = document.createElement("div");
        m.className = "mini-card";
        m.innerHTML = `<b>${escapeHtml(s.text)}</b>${escapeHtml(truncate(s.meaning, 48))}`;
        sim.appendChild(m);
      });
      art.appendChild(sim);

      const act = document.createElement("div");
      act.className = "bank-actions";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "ghost-button";
      add.textContent = "加入我的成语";
      add.addEventListener("click", () => {
        try {
          ChengyuStorage.saveIdiom({
            text: row.text,
            meaning: row.meaning,
            example: row.example,
          });
          showToast(`已加入：${row.text}`);
          updateCounts();
        } catch (e) {
          showToast(e.message || "保存失败");
        }
      });
      act.appendChild(add);
      art.appendChild(act);

      els.bankList.appendChild(art);
    });
    updateCounts();
  }

  function renderManageList() {
    const items = ChengyuStorage.listIdioms();
    els.manageIdiomList.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.innerHTML = `<div class="record-main"><strong>${escapeHtml(it.text)}</strong><span>${escapeHtml(truncate(it.meaning, 60))}</span></div>`;
      const actions = document.createElement("div");
      actions.className = "record-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => loadSingleForm(it));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "icon-button";
      del.textContent = "删除";
      del.addEventListener("click", () => confirmDelete("idiom", it.id, it.text));
      actions.append(edit, del);
      li.appendChild(actions);
      els.manageIdiomList.appendChild(li);
    });
    updateCounts();
  }

  function loadSingleForm(item) {
    setFormMode("single");
    els.singleId.value = item.id || "";
    els.singleText.value = item.text || "";
    els.singleMeaning.value = item.meaning || "";
    els.singleMeaning.dataset.autofill = "0";
    els.singleExample.value = item.example || "";
    els.singleMeaningHint.hidden = !!item.meaning;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetSingleForm() {
    els.singleId.value = "";
    els.singleText.value = "";
    els.singleMeaning.value = "";
    els.singleMeaning.dataset.autofill = "0";
    els.singleExample.value = "";
    els.singleMeaningHint.hidden = true;
  }

  function setFormMode(mode) {
    const single = mode === "single";
    $("formSingle").hidden = !single;
    $("formGroup").hidden = single;
    document.querySelectorAll(".mode-pill").forEach((p) => {
      const on = p.getAttribute("data-mode") === mode;
      p.classList.toggle("is-active", on);
      p.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (!single && !els.groupRows.children.length) {
      resetGroupForm();
    }
  }

  function createGroupRow(index, preset) {
    const row = document.createElement("div");
    row.className = "group-row";
    row.dataset.index = String(index);

    const head = document.createElement("div");
    head.className = "group-row-head";
    head.innerHTML = `<span>成语 ${index + 1}</span>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
      if (els.groupRows.children.length <= state.groupRowMin) {
        showToast(`至少保留 ${state.groupRowMin} 条成语`);
        return;
      }
      row.remove();
      reindexGroupRows();
    });
    head.appendChild(remove);
    row.appendChild(head);

    const textLabel = document.createElement("label");
    textLabel.className = "field";
    textLabel.innerHTML = "<span>成语</span>";
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "group-text";
    textInput.placeholder = "输入成语";
    textLabel.appendChild(textInput);
    row.appendChild(textLabel);

    const meaningLabel = document.createElement("label");
    meaningLabel.className = "field";
    meaningLabel.innerHTML = "<span>释义</span>";
    const meaningInput = document.createElement("textarea");
    meaningInput.rows = 2;
    meaningInput.className = "group-meaning";
    meaningLabel.appendChild(meaningInput);
    const hint = document.createElement("p");
    hint.className = "field-hint group-hint";
    hint.hidden = true;
    hint.textContent = "词库未收录，请填写释义";
    meaningLabel.appendChild(hint);
    row.appendChild(meaningLabel);

    textInput.addEventListener("input", () => {
      autofillMeaning(textInput, meaningInput, hint, null);
    });
    textInput.addEventListener("blur", () => {
      autofillMeaning(textInput, meaningInput, hint, null);
    });

    if (preset) {
      textInput.value = preset.text || "";
      meaningInput.value = preset.meaning || "";
    }

    return row;
  }

  function reindexGroupRows() {
    [...els.groupRows.children].forEach((row, i) => {
      row.dataset.index = String(i);
      const label = row.querySelector(".group-row-head span");
      if (label) label.textContent = `成语 ${i + 1}`;
    });
  }

  function resetGroupForm(id) {
    $("groupId").value = id || "";
    $("groupTitle").value = "";
    $("groupNote").value = "";
    els.groupRows.innerHTML = "";
    createDefaultGroupRows();
  }

  function createDefaultGroupRows() {
    els.groupRows.appendChild(createGroupRow(0));
    els.groupRows.appendChild(createGroupRow(1));
  }

  function loadGroupForm(group) {
    setFormMode("group");
    $("groupId").value = group.id;
    $("groupTitle").value = group.title || "";
    $("groupNote").value = group.note || "";
    els.groupRows.innerHTML = "";
    group.members.forEach((m, i) => {
      els.groupRows.appendChild(createGroupRow(i, m));
    });
    setView("manage");
  }

  function confirmDelete(kind, id, label) {
    state.pendingDelete = { kind, id };
    els.confirmMessage.textContent = `确定删除「${label}」吗？此操作不可撤销。`;
    els.confirmDialog.showModal();
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncate(s, n) {
    const t = String(s || "");
    return t.length > n ? `${t.slice(0, n)}…` : t;
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-view")));
    });

    document.querySelectorAll("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-jump")));
    });

    els.gallerySearch.addEventListener("input", renderGallery);

    els.bankSearch.addEventListener("input", renderBank);

    document.querySelectorAll(".mode-pill").forEach((pill) => {
      pill.addEventListener("click", () => setFormMode(pill.getAttribute("data-mode")));
    });

    els.singleText.addEventListener("input", () => {
      autofillMeaning(els.singleText, els.singleMeaning, els.singleMeaningHint, els.singleExample);
    });
    els.singleText.addEventListener("blur", () => {
      autofillMeaning(els.singleText, els.singleMeaning, els.singleMeaningHint, els.singleExample);
    });
    els.singleMeaning.addEventListener("input", () => {
      els.singleMeaning.dataset.autofill = "0";
      if (els.singleMeaning.value.trim()) els.singleMeaningHint.hidden = true;
    });

    $("singleReset").addEventListener("click", resetSingleForm);

    $("singleForm").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const saved = ChengyuStorage.saveIdiom({
          id: els.singleId.value || undefined,
          text: els.singleText.value,
          meaning: els.singleMeaning.value,
          example: els.singleExample.value,
        });
        showToast(`已保存：${saved.text}`);
        resetSingleForm();
        renderManageList();
        renderGallery();
      } catch (err) {
        showToast(err.message || "保存失败");
      }
    });

    $("groupAddRow").addEventListener("click", () => {
      els.groupRows.appendChild(createGroupRow(els.groupRows.children.length));
    });

    $("groupReset").addEventListener("click", () => resetGroupForm());

    $("groupForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const members = [...els.groupRows.querySelectorAll(".group-row")].map((row) => ({
        text: row.querySelector(".group-text").value,
        meaning: row.querySelector(".group-meaning").value,
      }));
      try {
        const saved = ChengyuStorage.saveGroup({
          id: $("groupId").value || undefined,
          title: $("groupTitle").value,
          note: $("groupNote").value,
          members,
        });
        members.forEach((m) => {
          if (m.text.trim()) {
            try {
              ChengyuStorage.saveIdiom({
                text: m.text,
                meaning: m.meaning,
              });
            } catch {
              /* ignore duplicate text issues */
            }
          }
        });
        showToast(`已保存近义组：${saved.title}`);
        resetGroupForm();
        renderUserGroups();
        renderGallery();
        renderManageList();
      } catch (err) {
        showToast(err.message || "保存失败");
      }
    });

    $("confirmOk").addEventListener("click", (e) => {
      e.preventDefault();
      const pending = state.pendingDelete;
      if (!pending) return;
      if (pending.kind === "idiom") {
        ChengyuStorage.deleteIdiom(pending.id);
        showToast("已删除成语");
        renderGallery();
        renderManageList();
      } else if (pending.kind === "group") {
        ChengyuStorage.deleteGroup(pending.id);
        showToast("已删除近义组");
        renderUserGroups();
      }
      state.pendingDelete = null;
      els.confirmDialog.close();
    });
  }

  function boot() {
    cacheElements();
    bindEvents();
    createDefaultGroupRows();
    updateCounts();
    renderGallery();
    renderBank();
    renderUserGroups();
    renderManageList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();