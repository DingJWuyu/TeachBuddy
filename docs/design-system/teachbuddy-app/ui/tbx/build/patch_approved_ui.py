"""Generate approved UI corrections in the supplied legacy prototype bundle.

These components have no JSX source in the design input. Each exact transform
owns one documented behavior change. The checked-in bundle remains the input;
already-applied transforms are unchanged. Editable overlay components live in
../src and are rebuilt separately by build_current.py.
"""
from pathlib import Path


PATCHES = (
    (
        'feedback file selection snapshot',
        r'''    const addFiles = (list3) => setFiles((current) => [...current, ...[...list3].map((file) => ({ name: file.name || t67("\u622A\u56FE"), size: file.size }))].slice(0, 5));''',
        r'''    const addFiles = (list3) => {
      const added = Array.from(list3 || [], (file) => ({ name: file.name || t67("\u622A\u56FE"), size: file.size }));
      setFiles((current) => [...current, ...added].slice(0, 5));
    };''',
    ),
    (
        'localized material count',
        r'''        materials.length,
        " ",
        t67("\u4EFD\u6750\u6599")''',
        r'''        t67("{{count}} 份材料", { count: materials.length })''',
    ),
    (
        'category dialog React identity',
        r'''          ] }) }) })
        ]
      }
    );
  }
  function Taxonomy''',
        r'''          ] }) }, newCategory.openingId) })
        ]
      }
    );
  }
  function Taxonomy''',
    ),
    (
        'settings-language-tab-and-blur',
        r'''    return /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("div", { className: "settings-language", ref: root6, onKeyDown: (event) => {
      if (disabled) return;
''',
        r'''    return /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("div", { className: "settings-language", ref: root6, onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }, onKeyDown: (event) => {
      if (disabled) return;
      if (event.key === "Tab" && open2) {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
''',
    ),
    (
        'settings-dialog-tab-cycle',
        r'''        className: `settings-confirm ${className}`,
        "aria-labelledby": titleId,
        onCancel: (event) => {
          event.preventDefault();
          onClose();
        },
''',
        r'''        className: `settings-confirm ${className}`,
        "aria-labelledby": titleId,
        onCancel: (event) => {
          event.preventDefault();
          onClose();
        },
        onKeyDown: (event) => {
          if (event.key !== "Tab") return;
          const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
            .filter((element) => element.getClientRects().length && !element.closest("[inert]"));
          const edge = event.shiftKey ? controls[0] : controls.at(-1);
          if (document.activeElement === edge) {
            event.preventDefault();
            (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
          }
        },
''',
    ),
    (
        'settings-dialog-preserve-opening-focus',
        r'''            /* @__PURE__ */ (0, import_jsx_runtime83.jsx)("button", { type: "button", className: "wb-button", onClick: onClose, autoFocus: true, children: closeLabel || (confirmLabel ? t67("\u53D6\u6D88") : t67("\u5173\u95ED")) }),
''',
        r'''            /* @__PURE__ */ (0, import_jsx_runtime83.jsx)("button", { type: "button", className: "wb-button", onClick: onClose, children: closeLabel || (confirmLabel ? t67("\u53D6\u6D88") : t67("\u5173\u95ED")) }),
''',
    ),
    (
        'settings-data-focus-references-and-remove-reset-state',
        r'''    const { accountKey } = useWorkbenchShell();
    const exportContent = (0, import_react97.useRef)(null);
    const exportTrigger = (0, import_react97.useRef)(null);
    const returnToExport = (0, import_react97.useRef)(false);
    function focusExportAction() {
      const dialog = exportContent.current?.closest("dialog");
      if (dialog?.contains(document.activeElement)) dialog.querySelector(".settings-confirm-actions button")?.focus();
    }
    const [exportOpen, setExportOpen] = (0, import_react97.useState)(false);
''',
        r'''    const { accountKey } = useWorkbenchShell();
    const exportContent = (0, import_react97.useRef)(null);
    const exportTrigger = (0, import_react97.useRef)(null);
    const returnToExport = (0, import_react97.useRef)(false);
    function focusExportAction() {
      const dialog = exportContent.current?.closest("dialog");
      if (dialog?.contains(document.activeElement)) dialog.querySelector(".settings-confirm-actions button")?.focus();
      else document.activeElement?.closest(".reliability-pending")?.querySelector(".settings-disclosure-trigger")?.focus();
    }
    const [exportOpen, setExportOpen] = (0, import_react97.useState)(false);
''',
    ),
    (
        'settings-data-return-after-inline-confirmation',
        r'''    const action = useIdempotentSubmit({
      accountKey,
      name: "pending:manual-data"
    });
''',
        r'''    const action = useIdempotentSubmit({
      accountKey,
      name: "pending:manual-data"
    });
    (0, import_react97.useEffect)(() => {
      if (busy || action.pending || !returnToExport.current) return;
      returnToExport.current = false;
      if (document.activeElement === document.body) exportTrigger.current?.focus();
    }, [busy, action.pending]);
''',
    ),
    (
        'settings-data-focus-before-download2',
        r'''    async function download2(item) {
      setBusy(item.id);
''',
        r'''    async function download2(item) {
      focusExportAction();
      setBusy(item.id);
''',
    ),
    (
        'settings-data-focus-before-remove2',
        r'''    async function remove2(item) {
      setBusy(item.id);
''',
        r'''    async function remove2(item) {
      focusExportAction();
      setBusy(item.id);
''',
    ),
    (
        'settings-data-focus-before-retry',
        r'''    async function retry() {
      const isExport = action.pending?.payload.path === `${base4}/exports`;
      setBusy("retry");
''',
        r'''    async function retry() {
      const isExport = action.pending?.payload.path === `${base4}/exports`;
      returnToExport.current = !exportOpen && Boolean(document.activeElement?.closest(".reliability-pending"));
      focusExportAction();
      setBusy("retry");
''',
    ),
    (
        'settings-data-export-trigger-reference',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("button", { className: "wb-button", disabled: !!busy || !!action.pending, onClick: () => {
''',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("button", { ref: exportTrigger, className: "wb-button", disabled: !!busy || !!action.pending, onClick: () => {
''',
    ),
    (
        'settings-data-dialog-content-reference',
        r'''        /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("p", { children: t67("\u8D44\u6599\u5305\u5305\u542B\u5DF2\u4FDD\u5B58\u53CA\u5DF2\u5220\u9664\u7684\u8D44\u6599\u3001\u539F\u6587\u4EF6\u4E0E\u5BF9\u8BDD\u3002\u4E0B\u8F7D\u540E\u89E3\u538B\uFF0C\u6253\u5F00 index.html \u9605\u8BFB\u3002") }),
''',
        r'''        /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("p", { ref: exportContent, children: t67("\u8D44\u6599\u5305\u5305\u542B\u5DF2\u4FDD\u5B58\u53CA\u5DF2\u5220\u9664\u7684\u8D44\u6599\u3001\u539F\u6587\u4EF6\u4E0E\u5BF9\u8BDD\u3002\u4E0B\u8F7D\u540E\u89E3\u538B\uFF0C\u6253\u5F00 index.html \u9605\u8BFB\u3002") }),
''',
    ),
    (
        'settings-data-remove-outside-abandon',
        r'''        !exportOpen && action.pending && /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("div", { className: "reliability-pending", children: [
          /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("button", { className: "wb-button", disabled: !!busy, onClick: retry, children: t67("\u91CD\u8BD5\u786E\u8BA4\u64CD\u4F5C") }),
          /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)(SettingsDisclosure, { title: t67("\u67E5\u770B\u5F85\u786E\u8BA4\u8BF7\u6C42"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("pre", { children: JSON.stringify(action.pending, null, 2) }),
            /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("button", { className: "wb-button", onClick: () => setResetOpen(true), children: t67("\u653E\u5F03\u91CD\u8BD5") })
          ] })
        ] })''',
        r'''        !exportOpen && action.pending && /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("div", { className: "reliability-pending", children: [
          /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("button", { className: "wb-button", disabled: !!busy, onClick: retry, children: t67("\u91CD\u8BD5\u786E\u8BA4\u64CD\u4F5C") }),
          /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)(SettingsDisclosure, { title: t67("\u67E5\u770B\u5F85\u786E\u8BA4\u8BF7\u6C42"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("pre", { children: JSON.stringify(action.pending, null, 2) }),
          ] })
        ] })''',
    ),
    (
        'settings-data-remove-dialog-abandon',
        r'''        action.pending && /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("div", { className: "reliability-pending", children: [
          /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("button", { className: "wb-button", disabled: !!busy, onClick: retry, children: t67("\u91CD\u8BD5\u786E\u8BA4\u64CD\u4F5C") }),
          /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)(SettingsDisclosure, { title: t67("\u67E5\u770B\u5F85\u786E\u8BA4\u8BF7\u6C42"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("pre", { children: JSON.stringify(action.pending, null, 2) }),
            /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("button", { className: "wb-button", onClick: () => setResetOpen(true), children: t67("\u653E\u5F03\u91CD\u8BD5") })
          ] })
        ] })''',
        r'''        action.pending && /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("div", { className: "reliability-pending", children: [
          /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("button", { className: "wb-button", disabled: !!busy, onClick: retry, children: t67("\u91CD\u8BD5\u786E\u8BA4\u64CD\u4F5C") }),
          /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)(SettingsDisclosure, { title: t67("\u67E5\u770B\u5F85\u786E\u8BA4\u8BF7\u6C42"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("pre", { children: JSON.stringify(action.pending, null, 2) }),
          ] })
        ] })''',
    ),
    (
        'settings-data-remove-abandon-dialog',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime84.jsx)(SettingsConfirm, { show: resetOpen, title: t67("\u653E\u5F03\u91CD\u8BD5\uFF1F"), confirmLabel: t67("\u653E\u5F03\u91CD\u8BD5"), onClose: () => setResetOpen(false), onConfirm: () => {
        action.reset();
        setResetOpen(false);
      }, children: /* @__PURE__ */ (0, import_jsx_runtime84.jsx)("p", { children: t67("\u653E\u5F03\u91CD\u8BD5\u4E0D\u4F1A\u64A4\u9500\u5DF2\u5B8C\u6210\u7684\u64CD\u4F5C\u3002\u8BF7\u4FDD\u7559\u8BF7\u6C42\u5E76\u6838\u5BF9\u5F53\u524D\u8D44\u6599\u540E\u518D\u5F00\u59CB\u65B0\u64CD\u4F5C\u3002") }) })
''',
        r'''''',
    ),
    (
        'settings-avatar-trigger-reference',
        r'''    const avatarInput = (0, import_react98.useRef)(null);
''',
        r'''    const avatarInput = (0, import_react98.useRef)(null);
    const avatarTrigger = (0, import_react98.useRef)(null);
''',
    ),
    (
        'settings-avatar-focus-before-reading',
        r'''      const request2 = ++avatarRequest.current;
''',
        r'''      const request2 = ++avatarRequest.current;
      if (document.activeElement === avatarTrigger.current) {
        avatarInput.current?.closest(".settings-profile")?.querySelector(".settings-nickname-trigger, #settings-nickname")?.focus();
      }
''',
    ),
    (
        'settings-avatar-bind-trigger',
        r'''              /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("button", { type: "button", "aria-label": t67("\u9009\u62E9\u5934\u50CF"), disabled: avatarLoading || appearanceDisabled, onClick: () => avatarInput.current?.click(), children: /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [
''',
        r'''              /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("button", { ref: avatarTrigger, type: "button", "aria-label": t67("\u9009\u62E9\u5934\u50CF"), disabled: avatarLoading || appearanceDisabled, onClick: () => avatarInput.current?.click(), children: /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [
''',
    ),
    (
        'settings-avatar-focus-before-deletion',
        r'''              /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("button", { type: "button", "aria-label": t67("\u5220\u9664\u5934\u50CF"), disabled: !avatar || avatarLoading || appearanceDisabled, onClick: (event) => {
                if (document.activeElement === event.currentTarget) avatarTrigger.current?.focus();
                setAvatarError("");
                shell.setAppearance({ avatar: "" });
''',
        r'''              /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("button", { type: "button", "aria-label": t67("\u5220\u9664\u5934\u50CF"), disabled: !avatar || avatarLoading || appearanceDisabled, onClick: () => {
                setAvatarDeleteOpen(true);
''',
    ),
    (
        'question category current selection identity',
        r'''    editorRef.current = { value, scene, localKey };''',
        r'''    editorRef.current = { value, scene, localKey, selected: selected2 };''',
    ),
    (
        'question category response ownership',
        r'''    async function createCategory() {
      const kind = newCategory.kind;
      const item = { id: crypto.randomUUID(), name: categoryName.trim() };
      const next = await mutate("/taxonomy", { baseVersion: taxonomy.version, types: taxonomy.types, tags: taxonomy.tags, [kind]: [...taxonomy[kind], item] }, "PUT");
      setTaxonomy(next);
      newCategory.onAssign(item.id);
      setNewCategory(null);
      setMessage(t67("\u5206\u7C7B\u5DF2\u521B\u5EFA\uFF0C\u4FDD\u5B58\u9898\u76EE\u540E\u751F\u6548\u3002"));
    }
''',
        r'''    async function createCategory() {
      const { kind, openingId, target } = newCategory;
      const item = { id: crypto.randomUUID(), name: categoryName.trim() };
      const next = await mutate("/taxonomy", { baseVersion: taxonomy.version, types: taxonomy.types, tags: taxonomy.tags, [kind]: [...taxonomy[kind], item] }, "PUT");
      setTaxonomy(next);
      const current = editorRef.current;
      if (current.value && current.scene.kind === target.kind && current.scene.id === target.id
        && (target.kind !== "import" || current.selected === target.draftId)) {
        const assign = (question) => ({ ...question, ...(kind === "types"
          ? { typeId: item.id } : { tagIds: [...new Set([...question.tagIds, item.id])] }) });
        const value = target.kind === "import"
          ? { ...current.value, drafts: current.value.drafts.map((draft) => draft.id === target.draftId ? assign(draft) : draft) }
          : assign(current.value);
        setValue(value);
        writeLocal(accountKey, current.localKey, value);
      }
      setNewCategory((current) => current?.openingId === openingId ? null : current);
      setMessage(t67("\u5206\u7C7B\u5DF2\u521B\u5EFA\uFF0C\u4FDD\u5B58\u9898\u76EE\u540E\u751F\u6548\u3002"));
    }
''',
    ),
    (
        'question category opening target',
        r'''        openCategory: (kind, onAssign) => {
          setCategoryName("");
          setMessage("");
          setNewCategory({ openingId: crypto.randomUUID(), kind, onAssign });
        },''',
        r'''        openCategory: (kind) => {
          setCategoryName("");
          setMessage("");
          setNewCategory({ openingId: crypto.randomUUID(), kind,
            target: { kind: scene.kind, id: scene.id, draftId: selected2 } });
        },''',
    ),
    (
        'question type create without captured question callback',
        r'''        openCategory("types", (id3) => onChange({ typeId: id3 }));''',
        r'''        openCategory("types");''',
    ),
    (
        'question tag create without captured question callback',
        r'''        openCategory("tags", (id3) => onChange({ tagIds: [...q4.tagIds, id3] }));''',
        r'''        openCategory("tags");''',
    ),
    (
        'question original actual scroll containers',
        r'''    const pageNode = (0, import_react39.useRef)(null);
    const scrollKey = `${fileId}:${page}`;
    const restoreScroll = () => {
      if (!pageNode.current) return;
      const saved = scene.scrollPositions?.[scrollKey];
      pageNode.current.scrollTop = saved?.top ?? 0;
      pageNode.current.scrollLeft = saved?.left ?? 0;
    };''',
        r'''    const originalNode = (0, import_react39.useRef)(null);
    const pageNode = (0, import_react39.useRef)(null);
    const scrollKey = `${fileId}:${page}`;
    const restoreScroll = () => {
      const image2 = pageNode.current?.querySelector("img");
      if (!image2?.complete || !image2.naturalWidth) return;
      const saved = scene.scrollPositions?.[scrollKey];
      pageNode.current.scrollTop = saved?.top ?? 0;
      pageNode.current.scrollLeft = saved?.left ?? 0;
      originalNode.current.scrollTop = saved?.paneTop ?? 0;
    };
    const rememberScroll = () => {
      const image2 = pageNode.current?.querySelector("img");
      if (!image2?.complete || !image2.naturalWidth) return;
      onScene({ scrollPositions: { ...scene.scrollPositions, [scrollKey]: {
        top: pageNode.current.scrollTop, left: pageNode.current.scrollLeft,
        paneTop: originalNode.current.scrollTop
      } } });
    };''',
    ),
    (
        'question original outer scroll consumer',
        r'''    return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("section", { className: `q-original${paragraphView ? " is-word-view" : ""}`, "aria-label": t67("\u539F\u59CB\u6750\u6599"), children: [''',
        r'''    return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("section", { ref: originalNode, onScroll: rememberScroll, className: `q-original${paragraphView ? " is-word-view" : ""}`, "aria-label": t67("\u539F\u59CB\u6750\u6599"), children: [''',
    ),
    (
        'question original inner scroll consumer',
        r'''            onScroll: (event) => onScene({ scrollPositions: {
              ...scene.scrollPositions,
              [scrollKey]: { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }
            } }),''',
        r'''            onScroll: rememberScroll,''',
    ),
    (
        'question original immutable page identity',
        r'''                  /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
                    ControlledImage,
                    {
                      fileId: current.imageFileId,
                      alt: t67("\u539F\u7A3F\u7B2C {{page}} \u9875", { page }),
                      widthMm: 170
                    }
                  ),''',
        r'''                  /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
                    ControlledImage,
                    {
                      fileId: current.imageFileId,
                      alt: t67("\u539F\u7A3F\u7B2C {{page}} \u9875", { page }),
                      widthMm: 170
                    },
                    current.imageFileId
                  ),''',
    ),
    (
        'SW-RES-02.taxonomy-read-state',
        r'''    const [listLoading, setListLoading] = (0, import_react52.useState)(true);
''',
        r'''    const [taxonomyLoaded, setTaxonomyLoaded] = (0, import_react52.useState)(false);
    const [listLoading, setListLoading] = (0, import_react52.useState)(true);
''',
    ),
    (
        'SW-RES-02.taxonomy-read-success',
        r'''      ]).then(async ([list3, taxonomy, activeItems, deleted]) => {
        if (!active4) return;
        receiveSearch(list3);
        setAllItems([...activeItems.items, ...deleted.items]);
        setTax(taxonomy);
''',
        r'''      ]).then(async ([list3, taxonomy, activeItems, deleted]) => {
        if (!active4) return;
        receiveSearch(list3);
        setAllItems([...activeItems.items, ...deleted.items]);
        setTax(taxonomy);
        setTaxonomyLoaded(true);
''',
    ),
    (
        'SW-RES-02.draft-associations',
        r'''    const draft = item ? scene.drafts[item.id] ?? metadata(item) : null;
''',
        r'''    const storedDraft = item ? scene.drafts[item.id] ?? metadata(item) : null;
    const draft = storedDraft && taxonomyLoaded ? {
      ...storedDraft,
      folderId: tax.folders.some((folder) => folder.id === storedDraft.folderId) ? storedDraft.folderId : null,
      tagIds: storedDraft.tagIds.filter((id3) => tax.tags.some((tag) => tag.id === id3))
    } : storedDraft;
''',
    ),
    (
        'EA-shared-02.resource-dialog-focus-scope',
        r'''  function ResourceDialog({ label: label2, onClose, children }) {
    const ref = (0, import_react49.useRef)(null);
    useModuleDialogFocus(ref, onClose);
    (0, import_react49.useEffect)(() => {
      ref.current?.querySelector("input:not([type=file]), textarea, select")?.focus();
    }, []);
    return /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(
      "div",
      {
        className: "res-overlay",
        onClick: (event) => {
          if (event.target === event.currentTarget) onClose();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(
          "div",
          {
            ref,
            className: "res-dialog",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": label2,
            children
          }
        )
      }
    );
  }
''',
        r'''  var ResourceDialogVisible = (0, import_react49.createContext)(true);
  function ResourceDialogPresence({ present, children }) {
    const opening2 = (0, import_react49.useRef)({ present: false, key: 0 });
    if (present && !opening2.current.present) opening2.current.key += 1;
    opening2.current.present = Boolean(present);
    return /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(ResourceDialogVisible.Provider, {
      value: Boolean(present),
      children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(ModulePresence, { present, children }, opening2.current.key)
    });
  }
  function ResourceDialogFocus({ dialogRef, onClose }) {
    useModuleDialogFocus(dialogRef, onClose);
    (0, import_react49.useEffect)(() => {
      dialogRef.current?.querySelector("input:not([type=file]), textarea, select")?.focus();
    }, [dialogRef]);
    return null;
  }
  function ResourceDialog({ label: label2, onClose, children }) {
    const ref = (0, import_react49.useRef)(null);
    const active4 = (0, import_react49.useContext)(ResourceDialogVisible);
    return /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(
      "div",
      {
        className: "res-overlay",
        onClick: (event) => {
          if (event.target === event.currentTarget) onClose();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)(
          "div",
          {
            ref,
            className: "res-dialog",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": label2,
            children: [
              active4 && /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(ResourceDialogFocus, { dialogRef: ref, onClose }),
              children
            ]
          }
        )
      }
    );
  }
''',
    ),
    (
        'EA-shared-02.resource-dialog-presence-duplicate',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ModulePresence, { present: Boolean(pending?.duplicateMatches?.length), children: pending?.duplicateMatches?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(ResourceDialog, { label: t67("\u53D1\u73B0\u91CD\u590D\u8D44\u6599"), onClose: skipDuplicate, children: [
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("h2", { children: t67("\u8FD9\u4EFD\u6587\u4EF6\u5DF2\u7ECF\u6536\u5F55\u8FC7") }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)("p", { children: [
          "\u201C",
          pending.input.title,
          t67("\u201D\u4E0E\u4EE5\u4E0B\u8D44\u6599\u7684\u6587\u4EF6\u5185\u5BB9\u76F8\u540C\uFF1A")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("ul", { children: pending.duplicateMatches.map((match) => /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)("li", { children: [
          match.title,
          match.deletedAt ? t67("\uFF08\u5DF2\u5F52\u6863\uFF09") : ""
        ] }, match.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("p", { children: t67("\u53EF\u8DF3\u8FC7\u8FD9\u4EFD\u8D44\u6599\uFF0C\u6216\u53E6\u5B58\u4E00\u4EFD\u5E76\u5206\u522B\u6574\u7406\u3002") }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)("div", { className: "res-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(
            "button",
            {
              className: "res-primary",
              disabled: busy,
              onClick: skipDuplicate,
              children: [
                " ",
                t67("\u8DF3\u8FC7\u8FD9\u4EFD\u8D44\u6599"),
                " "
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(
            "button",
            {
              disabled: busy,
              onClick: () => operations.keepDuplicate(),
              children: [
                " ",
                t67("\u4ECD\u7136\u53E6\u5B58\u4E00\u4EFD"),
                " "
              ]
            }
          )
        ] })
      ] }) }),
''',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ResourceDialogPresence, { present: Boolean(pending?.duplicateMatches?.length), children: pending?.duplicateMatches?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(ResourceDialog, { label: t67("\u53D1\u73B0\u91CD\u590D\u8D44\u6599"), onClose: skipDuplicate, children: [
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("h2", { children: t67("\u8FD9\u4EFD\u6587\u4EF6\u5DF2\u7ECF\u6536\u5F55\u8FC7") }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)("p", { children: [
          "\u201C",
          pending.input.title,
          t67("\u201D\u4E0E\u4EE5\u4E0B\u8D44\u6599\u7684\u6587\u4EF6\u5185\u5BB9\u76F8\u540C\uFF1A")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("ul", { children: pending.duplicateMatches.map((match) => /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)("li", { children: [
          match.title,
          match.deletedAt ? t67("\uFF08\u5DF2\u5F52\u6863\uFF09") : ""
        ] }, match.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("p", { children: t67("\u53EF\u8DF3\u8FC7\u8FD9\u4EFD\u8D44\u6599\uFF0C\u6216\u53E6\u5B58\u4E00\u4EFD\u5E76\u5206\u522B\u6574\u7406\u3002") }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)("div", { className: "res-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(
            "button",
            {
              className: "res-primary",
              disabled: busy,
              onClick: skipDuplicate,
              children: [
                " ",
                t67("\u8DF3\u8FC7\u8FD9\u4EFD\u8D44\u6599"),
                " "
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(
            "button",
            {
              disabled: busy,
              onClick: () => operations.keepDuplicate(),
              children: [
                " ",
                t67("\u4ECD\u7136\u53E6\u5B58\u4E00\u4EFD"),
                " "
              ]
            }
          )
        ] })
      ] }) }),
''',
    ),
    (
        'EA-shared-02.resource-dialog-presence-taxonomy',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ModulePresence, { present: !!scene.taxonomyDraft?.edit, children: scene.taxonomyDraft?.edit && /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(
        TaxonomyDialog,
        {
          value: tax,
          draft: scene.taxonomyDraft,
          onChange: changeTaxonomy,
          onSave: saveTaxonomy,
          onClose: () => patchScene({ taxonomyDraft: null }),
          disabled,
          items: allItems
        }
      ) }),
''',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ResourceDialogPresence, { present: !!scene.taxonomyDraft?.edit, children: scene.taxonomyDraft?.edit && /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(
        TaxonomyDialog,
        {
          value: tax,
          draft: scene.taxonomyDraft,
          onChange: changeTaxonomy,
          onSave: saveTaxonomy,
          onClose: () => patchScene({ taxonomyDraft: null }),
          disabled,
          items: allItems
        }
      ) }),
''',
    ),
    (
        'EA-shared-02.resource-dialog-presence-history',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ModulePresence, { present: historyOpen && !!item, children: historyOpen && item && /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(
        FileHistory,
        {
          client,
          item,
          disabled,
          onClose: () => setHistoryOpen(false),
          onRestore: (entry) => {
            setHistoryOpen(false);
            write2(
              `${root5}/items/${item.id}/restore-file`,
              { baseVersion: item.version, fileVersion: entry.version },
              "restore-file",
              "POST"
            );
          }
        }
      ) }),
''',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ResourceDialogPresence, { present: historyOpen && !!item, children: historyOpen && item && /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(
        FileHistory,
        {
          client,
          item,
          disabled,
          onClose: () => setHistoryOpen(false),
          onRestore: (entry) => {
            setHistoryOpen(false);
            write2(
              `${root5}/items/${item.id}/restore-file`,
              { baseVersion: item.version, fileVersion: entry.version },
              "restore-file",
              "POST"
            );
          }
        }
      ) }),
''',
    ),
    (
        'EA-shared-02.resource-dialog-presence-organize',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ModulePresence, { present: !!organize, children: organize && /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(
        Organize,
        {
          ...organize,
          tax,
          disabled,
          onClose: () => setOrganize(null),
          onSave: (input) => {
            setOrganize(null);
            write2(`${root5}/items/organize`, input, "organize", "POST");
          }
        }
      ) }),
''',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ResourceDialogPresence, { present: !!organize, children: organize && /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(
        Organize,
        {
          ...organize,
          tax,
          disabled,
          onClose: () => setOrganize(null),
          onSave: (input) => {
            setOrganize(null);
            write2(`${root5}/items/organize`, input, "organize", "POST");
          }
        }
      ) }),
''',
    ),
    (
        'EA-shared-02.resource-dialog-presence-conflict',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ModulePresence, { present: !!conflict, children: conflict && /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(ResourceDialog, { label: t67("\u7248\u672C\u51B2\u7A81"), onClose: () => operations.dismissConflict(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("h2", { children: t67("\u5185\u5BB9\u5DF2\u5728\u5176\u4ED6\u5730\u65B9\u66F4\u65B0") }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("p", { children: conflict.record.purpose === "organize" ? t67("\u6240\u9009\u8D44\u6599\u4E2D\u6709\u5185\u5BB9\u5DF2\u53D8\u5316\uFF0C\u672C\u6B21\u6574\u7406\u5168\u90E8\u672A\u751F\u6548\u3002\u8BF7\u5173\u95ED\u63D0\u793A\u540E\u91CD\u65B0\u9009\u62E9\u8D44\u6599\u3002") : t67("\u4F60\u7684\u8F93\u5165\u4ECD\u4FDD\u7559\u3002\u5F53\u524D\u8D44\u6E90\uFF1A{{value}}\uFF0C\u7248\u672C {{detail}}\u3002", { value: item?.title ?? "", detail: item?.version ?? "" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("pre", { children: item?.note }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(
          "button",
          {
            onClick: () => {
              if (item && conflict.record.purpose === "metadata")
                edit({ baseVersion: item.version });
              operations.dismissConflict();
              reportError2(t67("\u8BF7\u6838\u5BF9\u5206\u7C7B\u548C\u7B14\u8BB0\uFF0C\u518D\u6B21\u4FDD\u5B58"));
            },
            children: [
              " ",
              t67("\u4FDD\u7559\u8349\u7A3F\u5E76\u5BF9\u7167\u5F53\u524D\u7248\u672C"),
              " "
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("button", { onClick: () => operations.dismissConflict(), children: t67("\u7A0D\u540E\u5904\u7406") })
      ] }) }),
''',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ResourceDialogPresence, { present: !!conflict, children: conflict && /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(ResourceDialog, { label: t67("\u7248\u672C\u51B2\u7A81"), onClose: () => operations.dismissConflict(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("h2", { children: t67("\u5185\u5BB9\u5DF2\u5728\u5176\u4ED6\u5730\u65B9\u66F4\u65B0") }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("p", { children: conflict.record.purpose === "organize" ? t67("\u6240\u9009\u8D44\u6599\u4E2D\u6709\u5185\u5BB9\u5DF2\u53D8\u5316\uFF0C\u672C\u6B21\u6574\u7406\u5168\u90E8\u672A\u751F\u6548\u3002\u8BF7\u5173\u95ED\u63D0\u793A\u540E\u91CD\u65B0\u9009\u62E9\u8D44\u6599\u3002") : t67("\u4F60\u7684\u8F93\u5165\u4ECD\u4FDD\u7559\u3002\u5F53\u524D\u8D44\u6E90\uFF1A{{value}}\uFF0C\u7248\u672C {{detail}}\u3002", { value: item?.title ?? "", detail: item?.version ?? "" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("pre", { children: item?.note }),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsxs)(
          "button",
          {
            onClick: () => {
              if (item && conflict.record.purpose === "metadata")
                edit({ baseVersion: item.version });
              operations.dismissConflict();
              reportError2(t67("\u8BF7\u6838\u5BF9\u5206\u7C7B\u548C\u7B14\u8BB0\uFF0C\u518D\u6B21\u4FDD\u5B58"));
            },
            children: [
              " ",
              t67("\u4FDD\u7559\u8349\u7A3F\u5E76\u5BF9\u7167\u5F53\u524D\u7248\u672C"),
              " "
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime41.jsx)("button", { onClick: () => operations.dismissConflict(), children: t67("\u7A0D\u540E\u5904\u7406") })
      ] }) }),
''',
    ),
    (
        'math current list query and read sequence refs',
        r'''    const history = useDraftHistory();
    const ggbFlush = (0, import_react58.useRef)(null);''',
        r'''    const listQuery = (0, import_react58.useRef)({ search: search3, deleted });
    const listRequest = (0, import_react58.useRef)(0);
    listQuery.current = { search: search3, deleted };
    const history = useDraftHistory();
    const ggbFlush = (0, import_react58.useRef)(null);''',
    ),
    (
        'math list latest query and response guard',
        r'''    async function refresh() {
      const epoch = generation.current;
      try {
        const result = await mathRequest(
          `${base3}?q=${encodeURIComponent(search3)}&state=${deleted ? "deleted" : "active"}`
        );
        if (epoch === generation.current) setItems(result.items);
      } catch (e3) {
        if (epoch === generation.current) handleError(e3);
      }
    }''',
        r'''    async function refresh() {
      const epoch = generation.current;
      const query = listQuery.current;
      const request2 = ++listRequest.current;
      const current = () => epoch === generation.current && request2 === listRequest.current
        && query.search === listQuery.current.search && query.deleted === listQuery.current.deleted;
      try {
        const result = await mathRequest(
          `${base3}?q=${encodeURIComponent(query.search)}&state=${query.deleted ? "deleted" : "active"}`
        );
        if (current()) setItems(result.items);
      } catch (e3) {
        if (current()) handleError(e3);
      }
    }''',
    ),
    (
        'expose retained presence to current overlay',
        r'''    createPortal: require_react_dom().createPortal,''',
        r'''    createPortal: require_react_dom().createPortal,
    ModulePresence,''',
    ),
    (
        'retained confirm confirmDiscard',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ModulePresence, { present: confirmDiscard, children: confirmDiscard && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ConfirmDialog, { title: t67("\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F"), message: t67("\u6B64\u8BBE\u5907\u4E0A\u7684\u8FD9\u4EFD\u8349\u7A3F\u5C06\u88AB\u5220\u9664\uFF0C\u5DF2\u7ECF\u4FDD\u5B58\u7684\u9898\u76EE\u4E0D\u53D7\u5F71\u54CD\u3002"), confirmLabel: t67("\u653E\u5F03\u4FEE\u6539"), onCancel: () => cancelDiscard(), onConfirm: discardDraft }) }),''',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ConfirmDialog, { present: confirmDiscard, title: t67("\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F"), message: t67("\u6B64\u8BBE\u5907\u4E0A\u7684\u8FD9\u4EFD\u8349\u7A3F\u5C06\u88AB\u5220\u9664\uFF0C\u5DF2\u7ECF\u4FDD\u5B58\u7684\u9898\u76EE\u4E0D\u53D7\u5F71\u54CD\u3002"), confirmLabel: t67("\u653E\u5F03\u4FEE\u6539"), onCancel: () => cancelDiscard(), onConfirm: discardDraft }),''',
    ),
    (
        'retained confirm copyCandidate',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ModulePresence, { present: Boolean(copyCandidate), children: copyCandidate && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ConfirmDialog, { title: t67("\u66FF\u6362\u672A\u5B8C\u6210\u7684\u9898\u76EE\uFF1F"), message: t67("\u4F60\u8FD8\u6709\u4E00\u4EFD\u672A\u5B8C\u6210\u7684\u65B0\u9898\u8349\u7A3F\u3002\u5F00\u59CB\u8FD9\u6B21\u6539\u7F16\u4F1A\u66FF\u6362\u5B83\uFF0C\u5DF2\u4FDD\u5B58\u7684\u9898\u76EE\u4E0D\u53D7\u5F71\u54CD\u3002"), confirmLabel: t67("\u66FF\u6362\u5E76\u5F00\u59CB\u6539\u7F16"), onCancel: () => cancelCopy(), onConfirm: replaceWithCopy }) }),''',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ConfirmDialog, { present: Boolean(copyCandidate), title: t67("\u66FF\u6362\u672A\u5B8C\u6210\u7684\u9898\u76EE\uFF1F"), message: t67("\u4F60\u8FD8\u6709\u4E00\u4EFD\u672A\u5B8C\u6210\u7684\u65B0\u9898\u8349\u7A3F\u3002\u5F00\u59CB\u8FD9\u6B21\u6539\u7F16\u4F1A\u66FF\u6362\u5B83\uFF0C\u5DF2\u4FDD\u5B58\u7684\u9898\u76EE\u4E0D\u53D7\u5F71\u54CD\u3002"), confirmLabel: t67("\u66FF\u6362\u5E76\u5F00\u59CB\u6539\u7F16"), onCancel: () => cancelCopy(), onConfirm: replaceWithCopy }),''',
    ),
    (
        'retained confirm lifecycleAction',
        r'''          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ModulePresence, { present: Boolean(lifecycleAction), children: lifecycleAction && (0, import_jsx_runtime29.jsx)(globalThis.__tbx.KitConfirmDialog, {
              title: `${lifecycleAction.mode === "purge" ? t67("\u5F7B\u5E95\u5220\u9664") : lifecycleAction.mode === "restore" ? t67("\u6062\u590D") : t67("\u5F52\u6863")}${lifecycleAction.kind === "import" ? t67("\u6750\u6599") : t67("\u9898\u76EE")}\uFF1F`,
              message: lifecycleAction.mode === "purge" ? t67("\u201C{{value}}\u201D\u53CA\u5176\u672C\u5730\u8349\u7A3F\u5C06\u5F7B\u5E95\u5220\u9664\uFF0C\u65E0\u6CD5\u6062\u590D\u3002{{detail}}", { value: lifecycleAction.item.title || t67("\u672A\u547D\u540D\u9898\u76EE"), detail: lifecycleAction.kind === "import" ? t67("\u5DF2\u5165\u5E93\u7684\u9898\u76EE\u4F1A\u4FDD\u7559\u3002") : t67("\u5DF2\u6709\u6539\u7F16\u9898\u4F1A\u4FDD\u7559\u3002") }) : lifecycleAction.mode === "restore" ? t67("\u6062\u590D\u540E\uFF0C\u4F1A\u91CD\u65B0\u51FA\u73B0\u5728\u9898\u5E93\u4E2D\u3002") : t67("\u5C06\u79FB\u51FA\u5F53\u524D\u5217\u8868\u3002\u4E4B\u540E\u53EF\u4EE5\u5728\u5DE6\u4FA7\u7684\u201C\u5DF2\u5F52\u6863\u201D\u91CC\u6062\u590D\u6216\u5F7B\u5E95\u5220\u9664\u3002"),
              danger: lifecycleAction.mode === "purge",
              icon: lifecycleAction.mode === "restore" ? "restore" : "trash",
              busy,
              confirmLabel: busy ? t67("\u6B63\u5728\u5904\u7406\u2026") : lifecycleAction.mode === "purge" ? t67("\u5F7B\u5E95\u5220\u9664") : lifecycleAction.mode === "restore" ? t67("\u786E\u8BA4\u6062\u590D") : t67("\u786E\u8BA4\u5F52\u6863"),
              onConfirm: confirmLifecycle,
              onCancel: () => cancelLifecycle(),
              children: message && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("p", { className: "q-error", role: "alert", children: message })
            }) }),''',
        r'''          (0, import_jsx_runtime29.jsx)(globalThis.__tbx.KitConfirmDialog, { present: Boolean(lifecycleAction),
              title: `${lifecycleAction?.mode === "purge" ? t67("\u5F7B\u5E95\u5220\u9664") : lifecycleAction?.mode === "restore" ? t67("\u6062\u590D") : t67("\u5F52\u6863")}${lifecycleAction?.kind === "import" ? t67("\u6750\u6599") : t67("\u9898\u76EE")}\uFF1F`,
              message: lifecycleAction?.mode === "purge" ? t67("\u201C{{value}}\u201D\u53CA\u5176\u672C\u5730\u8349\u7A3F\u5C06\u5F7B\u5E95\u5220\u9664\uFF0C\u65E0\u6CD5\u6062\u590D\u3002{{detail}}", { value: lifecycleAction?.item.title || t67("\u672A\u547D\u540D\u9898\u76EE"), detail: lifecycleAction?.kind === "import" ? t67("\u5DF2\u5165\u5E93\u7684\u9898\u76EE\u4F1A\u4FDD\u7559\u3002") : t67("\u5DF2\u6709\u6539\u7F16\u9898\u4F1A\u4FDD\u7559\u3002") }) : lifecycleAction?.mode === "restore" ? t67("\u6062\u590D\u540E\uFF0C\u4F1A\u91CD\u65B0\u51FA\u73B0\u5728\u9898\u5E93\u4E2D\u3002") : t67("\u5C06\u79FB\u51FA\u5F53\u524D\u5217\u8868\u3002\u4E4B\u540E\u53EF\u4EE5\u5728\u5DE6\u4FA7\u7684\u201C\u5DF2\u5F52\u6863\u201D\u91CC\u6062\u590D\u6216\u5F7B\u5E95\u5220\u9664\u3002"),
              danger: lifecycleAction?.mode === "purge",
              icon: lifecycleAction?.mode === "restore" ? "restore" : "trash",
              busy,
              confirmLabel: busy ? t67("\u6B63\u5728\u5904\u7406\u2026") : lifecycleAction?.mode === "purge" ? t67("\u5F7B\u5E95\u5220\u9664") : lifecycleAction?.mode === "restore" ? t67("\u786E\u8BA4\u6062\u590D") : t67("\u786E\u8BA4\u5F52\u6863"),
              onConfirm: confirmLifecycle,
              onCancel: () => cancelLifecycle(),
              children: message && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("p", { className: "q-error", role: "alert", children: message })
            }),''',
    ),
    (
        'retained confirm pendingDelete',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(ModulePresence, { present: Boolean(pendingDelete), children: pendingDelete && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(
        ConfirmDialog,
        {
          title: t67(pendingDelete.kind === "types" ? "\u5220\u9664\u9898\u578B" : "\u5220\u9664\u6807\u7B7E"),
          message: t67(pendingDelete.kind === "types" ? "\u5220\u9664\u9898\u578B\u201C{{name}}\u201D\u5E76\u89E3\u9664 {{affected}} \u9053\u9898\u7684\u5173\u8054\uFF1F\u9898\u76EE\u672C\u8EAB\u4F1A\u4FDD\u7559\u3002" : "\u5220\u9664\u6807\u7B7E\u201C{{name}}\u201D\u5E76\u89E3\u9664 {{affected}} \u9053\u9898\u7684\u5173\u8054\uFF1F\u9898\u76EE\u672C\u8EAB\u4F1A\u4FDD\u7559\u3002", { name: pendingDelete.name, affected: pendingDelete.affected }),
          confirmLabel: t67(pendingDelete.kind === "types" ? "\u5220\u9664\u9898\u578B" : "\u5220\u9664\u6807\u7B7E"),
          onCancel: () => setPendingDelete(null),
          onConfirm: () => {
            setDraft((current) => ({ ...current, [pendingDelete.kind]: current[pendingDelete.kind].filter((item) => item.id !== pendingDelete.id) }));
            setPendingDelete(null);
          }
        }
      ) })''',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(
        ConfirmDialog,
        {
          present: Boolean(pendingDelete),
          title: t67(pendingDelete?.kind === "types" ? "\u5220\u9664\u9898\u578B" : "\u5220\u9664\u6807\u7B7E"),
          message: t67(pendingDelete?.kind === "types" ? "\u5220\u9664\u9898\u578B\u201C{{name}}\u201D\u5E76\u89E3\u9664 {{affected}} \u9053\u9898\u7684\u5173\u8054\uFF1F\u9898\u76EE\u672C\u8EAB\u4F1A\u4FDD\u7559\u3002" : "\u5220\u9664\u6807\u7B7E\u201C{{name}}\u201D\u5E76\u89E3\u9664 {{affected}} \u9053\u9898\u7684\u5173\u8054\uFF1F\u9898\u76EE\u672C\u8EAB\u4F1A\u4FDD\u7559\u3002", { name: pendingDelete?.name, affected: pendingDelete?.affected }),
          confirmLabel: t67(pendingDelete?.kind === "types" ? "\u5220\u9664\u9898\u578B" : "\u5220\u9664\u6807\u7B7E"),
          onCancel: () => setPendingDelete(null),
          onConfirm: () => {
            setDraft((current) => ({ ...current, [pendingDelete?.kind]: current[pendingDelete?.kind].filter((item) => item.id !== pendingDelete?.id) }));
            setPendingDelete(null);
          }
        }
      )''',
    ),
    (
        'retained confirm dialog',
        r'''      /* @__PURE__ */ (0, import_jsx_runtime41.jsx)(ModulePresence, { present: !!dialog, children: dialog && (0, import_jsx_runtime41.jsx)(globalThis.__tbx.KitConfirmDialog, {
        title: dialog.kind === "replace" ? t67("\u66F4\u65B0\u5F53\u524D\u6587\u4EF6") : dialog.kind === "purge" ? t67("\u5F7B\u5E95\u5220\u9664\u8D44\u6599") : dialog.item.deletedAt ? t67("\u6062\u590D\u8D44\u6599") : t67("\u5F52\u6863\u8D44\u6599"),
        message: dialog.kind === "replace" ? `${file?.name ?? ""} \u2192 ${dialog.source.name}` : dialog.kind === "purge" ? t67("\u201C{{title}}\u201D\u5C06\u4ECE\u8D44\u6E90\u5E93\u6C38\u4E45\u5220\u9664\uFF0C\u65E0\u6CD5\u6062\u590D\u3002", { title: dialog.item.title }) : dialog.item.deletedAt ? t67("\u6062\u590D\u540E\u53EF\u4EE5\u7EE7\u7EED\u67E5\u770B\u548C\u6574\u7406\u8FD9\u4EFD\u8D44\u6599\u3002") : t67("\u8D44\u6599\u4F1A\u79FB\u5165\u201C\u5DF2\u5F52\u6863\u8D44\u6599\u201D\uFF0C\u53EF\u4EE5\u968F\u65F6\u6062\u590D\u3002"),
        children: dialog.kind === "replace" ? (0, import_jsx_runtime41.jsx)("p", { children: t67("\u540D\u79F0\u3001\u6587\u4EF6\u5939\u3001\u6807\u7B7E\u548C\u5907\u6CE8\u90FD\u4F1A\u4FDD\u7559\u3002") }) : null,
        danger: dialog.kind === "purge",
        icon: dialog.kind === "replace" ? "upload" : dialog.item?.deletedAt ? "restore" : "trash",
        disabled,
        confirmLabel: dialog.kind === "replace" ? t67("\u66F4\u65B0") : dialog.kind === "purge" ? t67("\u5F7B\u5E95\u5220\u9664") : dialog.item.deletedAt ? t67("\u6062\u590D") : t67("\u5F52\u6863"),
        onConfirm: operations.confirmOperation,
        onCancel: () => operations.dismissConfirmation()
      }) })''',
        r'''      (0, import_jsx_runtime41.jsx)(globalThis.__tbx.KitConfirmDialog, { present: !!dialog,
        title: dialog?.kind === "replace" ? t67("\u66F4\u65B0\u5F53\u524D\u6587\u4EF6") : dialog?.kind === "purge" ? t67("\u5F7B\u5E95\u5220\u9664\u8D44\u6599") : dialog?.item.deletedAt ? t67("\u6062\u590D\u8D44\u6599") : t67("\u5F52\u6863\u8D44\u6599"),
        message: dialog?.kind === "replace" ? `${file?.name ?? ""} \u2192 ${dialog?.source.name}` : dialog?.kind === "purge" ? t67("\u201C{{title}}\u201D\u5C06\u4ECE\u8D44\u6E90\u5E93\u6C38\u4E45\u5220\u9664\uFF0C\u65E0\u6CD5\u6062\u590D\u3002", { title: dialog?.item.title }) : dialog?.item.deletedAt ? t67("\u6062\u590D\u540E\u53EF\u4EE5\u7EE7\u7EED\u67E5\u770B\u548C\u6574\u7406\u8FD9\u4EFD\u8D44\u6599\u3002") : t67("\u8D44\u6599\u4F1A\u79FB\u5165\u201C\u5DF2\u5F52\u6863\u8D44\u6599\u201D\uFF0C\u53EF\u4EE5\u968F\u65F6\u6062\u590D\u3002"),
        children: dialog?.kind === "replace" ? (0, import_jsx_runtime41.jsx)("p", { children: t67("\u540D\u79F0\u3001\u6587\u4EF6\u5939\u3001\u6807\u7B7E\u548C\u5907\u6CE8\u90FD\u4F1A\u4FDD\u7559\u3002") }) : null,
        danger: dialog?.kind === "purge",
        icon: dialog?.kind === "replace" ? "upload" : dialog?.item?.deletedAt ? "restore" : "trash",
        disabled,
        confirmLabel: dialog?.kind === "replace" ? t67("\u66F4\u65B0") : dialog?.kind === "purge" ? t67("\u5F7B\u5E95\u5220\u9664") : dialog?.item.deletedAt ? t67("\u6062\u590D") : t67("\u5F52\u6863"),
        onConfirm: operations.confirmOperation,
        onCancel: () => operations.dismissConfirmation()
      })''',
    ),
    (
        'math retained confirmation',
        r'''    const dialog = /* @__PURE__ */ (0, import_jsx_runtime43.jsx)(ModulePresence, { present: !!message, children: message && /* @__PURE__ */ (0, import_jsx_runtime43.jsx)(MathConfirmDialog, { title: message.title ?? t67("\u786E\u8BA4\u64CD\u4F5C"), message: message.text, confirmLabel: message.confirmLabel ?? t67("\u7EE7\u7EED"), onConfirm: () => finish(true), onCancel: () => finish(false) }) });''',
        r'''    const dialog = /* @__PURE__ */ (0, import_jsx_runtime43.jsx)(ConfirmDialog, { present: !!message, title: message?.title ?? t67("\u786E\u8BA4\u64CD\u4F5C"), message: message?.text, confirmLabel: message?.confirmLabel ?? t67("\u7EE7\u7EED"), onConfirm: () => finish(true), onCancel: () => finish(false) });''',
    ),
    (
        'remove obsolete math confirmation focus wrapper',
        r'''  function MathConfirmDialog(props) {
    const ref = (0, import_react55.useRef)(null);
    useMathDialogKeys(ref);
    return /* @__PURE__ */ (0, import_jsx_runtime43.jsx)("div", { ref, className: "wb-dialog-host", children: /* @__PURE__ */ (0, import_jsx_runtime43.jsx)(ConfirmDialog, { ...props }) });
  }''',
        r'''  // Shared confirmation owns the keyboard and retained exit.''',
    ),    (
        'SW-SCHEDULE-02.month-more-drag-hit-target',
        r'''        eventData: (node2) => {
          const event = eventsRef.current.find((value) => value.id === node2.dataset.eventId);''',
        r'''        eventData: (node2) => {
          panel.current?.classList.add("is-dragging");
          if (gesture.current) gesture.current.dragged = true;
          const event = eventsRef.current.find((value) => value.id === node2.dataset.eventId);''',
    ),
    (
        'SW-SCHEDULE-02.month-more-drag-cleanup',
        r'''      const track = (event) => {
        const current = gesture.current;
        if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 5) current.dragged = true;
      };
      window.addEventListener("pointermove", track);
      return () => {
        draggable.destroy();
        window.removeEventListener("pointermove", track);
      };''',
        r'''      const track = (event) => {
        const current = gesture.current;
        if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 5) current.dragged = true;
      };
      const restore = () => panel.current?.classList.remove("is-dragging");
      const cancel = (event) => { if (event.key === "Escape") restore(); };
      window.addEventListener("pointermove", track);
      window.addEventListener("mouseup", restore);
      window.addEventListener("touchend", restore);
      window.addEventListener("touchcancel", restore);
      window.addEventListener("keydown", cancel, true);
      return () => {
        draggable.destroy(); restore();
        window.removeEventListener("pointermove", track);
        window.removeEventListener("mouseup", restore);
        window.removeEventListener("touchend", restore);
        window.removeEventListener("touchcancel", restore);
        window.removeEventListener("keydown", cancel, true);
      };''',
    ),
    (
        'question taxonomy confirmation retains prior input focus',
        r'''              onClick: async () => {
                setDeleting(true);''',
        r'''              onClick: async (event) => {
                event.currentTarget.closest('.q-taxonomy-row')?.querySelector('input')?.focus();
                setDeleting(true);''',
    ),

    (
        'settings-avatar-confirmation-state',
        r'''    const avatarTrigger = (0, import_react98.useRef)(null);
''',
        r'''    const avatarTrigger = (0, import_react98.useRef)(null);
    const [avatarDeleteOpen, setAvatarDeleteOpen] = (0, import_react98.useState)(false);
''',
    ),
    (
        'settings-avatar-shared-confirmation',
        r'''            /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("input", { ref: avatarInput, type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true, onChange: chooseAvatar })
''',
        r'''            /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("input", { ref: avatarInput, type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true, onChange: chooseAvatar }),
            /* @__PURE__ */ (0, import_jsx_runtime85.jsx)(globalThis.__tbx.KitConfirmDialog, { present: avatarDeleteOpen, title: t67("\u5220\u9664\u5934\u50CF"), onCancel: () => setAvatarDeleteOpen(false), onConfirm: () => {
              setAvatarDeleteOpen(false);
              avatarTrigger.current?.focus();
              setAvatarError("");
              shell.setAppearance({ avatar: "" });
            } })
''',
    ),
)


def main():
    bundle = Path(__file__).resolve().parents[2] / "app.js"
    original = bundle.read_text(encoding="utf-8")
    updated = original
    for name, before, after in PATCHES:
        if (after and updated.count(after) == 1) or (not after and before not in updated):
            continue
        if updated.count(before) != 1:
            raise SystemExit(f"Cannot locate the expected prototype source: {name}")
        updated = updated.replace(before, after, 1)
    if updated != original:
        bundle.write_text(updated, encoding="utf-8")
    print("Approved legacy UI changes are applied.")


if __name__ == "__main__":
    main()
