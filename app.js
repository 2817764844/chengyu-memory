/* 成语记忆 — UI */
(function () {
  const state = {
    view: "gallery",
    pendingDelete: null,
    groupRowMin: 2,
    detailItem: null,
    openBankId: null,
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
    els.detailDialog = $("detailDialog");
    els.detailTitle = $("detailTitle");
    els.detailMeaning = $("detailMeaning");
    els.detailExample = $("detailExample");
    els.detailSimilar = $("detailSimilar");
    els.detailSimilarList = $("detailSimilarList");
    els.detailFooter = $("detailFooter");
    els.detailEdit = $("detailEdit");
    els.detailDelete = $("detailDelete");
    els.detailClose = $("detailClose");
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
    document.querySelectorAll(".page").forEach((p) => {
      p.classList.toggle("is-active", p.id === `view-${view}`);
    });
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === view);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    document.dispatchEvent(new CustomEvent("chengyu:view", { detail: view }));
    if (view === "gallery") renderGallery();
    if (view === "manage") renderManageList();
    if (view === "groups") renderUserGroups();
    if (view === "bank") renderBank();
    if (view === "account" && window.ChengyuAccount) {
      window.ChengyuAccount.renderAccount();
    }
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

  function fillSimilarList(text, meaning) {
    const sug = ChengyuSimilarMatcher.suggestForIdiom(text, meaning);
    els.detailSimilarList.innerHTML = "";
    if (!sug.items.length) {
      els.detailSimilar.hidden = true;
      return;
    }
    els.detailSimilar.hidden = false;
    els.detailSimilar.querySelector(".modal__section-title").textContent =
      sug.source === "bank"
        ? "词库近义"
        : sug.source === "local"
          ? "释义匹配近义"
          : "近义推荐";
    sug.items.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(s.text)}</strong><span>${escapeHtml(s.meaning)}</span>`;
      els.detailSimilarList.appendChild(li);
    });
  }

  function closeDetail() {
    if (!els.detailDialog.open) return;
    els.detailDialog.close();
    document.body.classList.remove("modal-open");
    state.detailItem = null;
  }

  function openDetail(item, options) {
    const opts = options || {};
    state.detailItem = item;
    els.detailTitle.textContent = item.text || "";
    els.detailMeaning.textContent = item.meaning || "（未填写释义）";
    if (item.example) {
      els.detailExample.hidden = false;
      els.detailExample.textContent = `例：${item.example}`;
    } else {
      els.detailExample.hidden = true;
    }
    fillSimilarList(item.text, item.meaning);

    const editable = opts.editable && item.id;
    els.detailFooter.hidden = !editable;
    if (editable) {
      els.detailEdit.onclick = () => {
        closeDetail();
        loadSingleForm(item);
        setView("manage");
      };
      els.detailDelete.onclick = () => {
        closeDetail();
        confirmDelete("idiom", item.id, item.text);
      };
    }

    document.body.classList.add("modal-open");
    els.detailDialog.showModal();
  }

  function createIdiomTile(item, options) {
    const opts = options || {};
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "idiom-tile";
    btn.innerHTML = `<p class="idiom-tile__text">${escapeHtml(item.text)}</p><p class="idiom-tile__hint">点击查看释义</p>`;
    btn.addEventListener("click", () => openDetail(item, opts));
    return btn;
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
      els.galleryGrid.appendChild(createIdiomTile(item, { editable: true }));
    });
    updateCounts();
  }

  function renderUserGroups() {
    const groups = ChengyuStorage.listGroups();
    els.userGroupsGrid.innerHTML = "";
    els.groupsEmpty.hidden = groups.length > 0;

    groups.forEach((g) => {
      const block = document.createElement("article");
      block.className = "group-block";

      const headDiv = document.createElement("div");
      headDiv.className = "group-block__head";

      const h3 = document.createElement("h3");
      h3.textContent = g.title;

      const actions = document.createElement("div");
      actions.className = "list__actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn btn--ghost btn--sm";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => loadGroupForm(g));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--ghost btn--sm";
      del.textContent = "删除";
      del.addEventListener("click", () => confirmDelete("group", g.id, g.title));
      actions.append(edit, del);
      headDiv.append(h3, actions);
      block.appendChild(headDiv);

      if (g.note) {
        const note = document.createElement("p");
        note.className = "group-block__note";
        note.textContent = g.note;
        block.appendChild(note);
      }

      const chipRow = document.createElement("div");
      chipRow.className = "chip-row";
      (g.members || []).forEach((m) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "member-chip";
        chip.textContent = m.text;
        chip.title = m.meaning || "";
        chip.addEventListener("click", () =>
          openDetail({ text: m.text, meaning: m.meaning, example: "" }, { editable: false })
        );
        chipRow.appendChild(chip);
      });
      block.appendChild(chipRow);

      els.userGroupsGrid.appendChild(block);
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
      const id = `bank-${row.text}`;
      const card = document.createElement("article");
      card.className = "bank-card";
      if (state.openBankId === id) card.classList.add("is-open");

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "bank-card__toggle";
      toggle.innerHTML = `<span class="bank-card__word">${escapeHtml(row.text)}</span><span class="bank-card__summary">${escapeHtml(row.meaning)}</span><svg class="bank-card__chev" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>`;
      toggle.addEventListener("click", () => {
        const willOpen = !card.classList.contains("is-open");
        document.querySelectorAll(".bank-card.is-open").forEach((other) => {
          other.classList.remove("is-open");
        });
        if (willOpen) {
          card.classList.add("is-open");
          state.openBankId = id;
        } else {
          state.openBankId = null;
        }
      });

      const body = document.createElement("div");
      body.className = "bank-card__body";
      if (row.example) {
        const ex = document.createElement("p");
        ex.className = "bank-card__example";
        ex.textContent = `例：${row.example}`;
        body.appendChild(ex);
      }

      const list = document.createElement("ul");
      list.className = "tag-list";
      row.similar.forEach((s) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${escapeHtml(s.text)}</strong><span>${escapeHtml(truncate(s.meaning, 72))}</span>`;
        list.appendChild(li);
      });
      body.appendChild(list);

      const act = document.createElement("div");
      act.className = "bank-card__actions";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn btn--primary btn--sm";
      add.textContent = "加入我的成语";
      add.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          ChengyuStorage.saveIdiom({
            text: row.text,
            meaning: row.meaning,
            example: row.example,
          });
          showToast(`已加入：${row.text}`);
          updateCounts();
        } catch (err) {
          showToast(err.message || "保存失败");
        }
      });
      act.appendChild(add);
      body.appendChild(act);

      card.append(toggle, body);
      els.bankList.appendChild(card);
    });
    updateCounts();
  }

  function renderManageList() {
    const items = ChengyuStorage.listIdioms();
    els.manageIdiomList.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.className = "list__row";
      const main = document.createElement("div");
      main.className = "list__main";
      main.innerHTML = `<strong>${escapeHtml(it.text)}</strong><span>${escapeHtml(truncate(it.meaning, 56))}</span>`;
      li.appendChild(main);
      const actions = document.createElement("div");
      actions.className = "list__actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn btn--ghost btn--sm";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => loadSingleForm(it));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--ghost btn--sm";
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
    document.querySelectorAll(".segmented__btn").forEach((p) => {
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
    remove.className = "btn btn--ghost btn--sm";
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
    textLabel.innerHTML = '<span class="field__label">成语</span>';
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "group-text";
    textInput.placeholder = "输入成语";
    textLabel.appendChild(textInput);
    row.appendChild(textLabel);

    const meaningLabel = document.createElement("label");
    meaningLabel.className = "field";
    meaningLabel.innerHTML = '<span class="field__label">释义</span>';
    const meaningInput = document.createElement("textarea");
    meaningInput.rows = 2;
    meaningInput.className = "group-meaning";
    meaningLabel.appendChild(meaningInput);
    const hint = document.createElement("p");
    hint.className = "field__hint group-hint";
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

  function bindEvents() {
    $("brandHome").addEventListener("click", (e) => {
      e.preventDefault();
      setView("gallery");
    });

    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-view")));
    });

    document.querySelectorAll("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-jump")));
    });

    els.gallerySearch.addEventListener("input", renderGallery);
    els.bankSearch.addEventListener("input", renderBank);

    document.querySelectorAll(".segmented__btn").forEach((pill) => {
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
              ChengyuStorage.saveIdiom({ text: m.text, meaning: m.meaning });
            } catch {
              /* ignore */
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

    els.detailClose.addEventListener("click", closeDetail);
    els.detailDialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
    });
    els.detailDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDetail();
    });
    els.detailDialog.addEventListener("click", (e) => {
      if (e.target === els.detailDialog) closeDetail();
    });
  }

  function boot() {
    cacheElements();
    bindEvents();
    document.addEventListener("chengyu:data-changed", () => {
      renderGallery();
      renderManageList();
      renderUserGroups();
      updateCounts();
    });
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

  window.__openDetailForDemo = openDetail;
})();