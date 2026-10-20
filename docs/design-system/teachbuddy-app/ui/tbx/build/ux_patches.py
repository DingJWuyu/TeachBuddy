# ---- UX pass (exec'd by patch_app.py after module_patches.py) -------------------
# Each edit is an exact, unique replacement into ui/app.js, like the rest.

# semester dialog: "copy from" always opens; with no other semester it lists "None"
replace('''                disabled: !candidates.length,
                onClick: () => setSourceOpen((open2) => !open2),''', '''                onClick: () => setSourceOpen((open2) => !open2),''')
replace('''            sourceOpen && candidates.length ? /* @__PURE__ */ (0, import_jsx_runtime75.jsx)("div", { className: "tb-copy-source-menu", role: "listbox", "aria-label": t67("\\u590D\\u5236\\u6765\\u6E90"), children: candidates.map(''', '''            sourceOpen && !candidates.length ? /* @__PURE__ */ (0, import_jsx_runtime75.jsx)("div", { className: "tb-copy-source-menu", role: "listbox", "aria-label": t67("\\u590D\\u5236\\u6765\\u6E90"), children: /* @__PURE__ */ (0, import_jsx_runtime75.jsxs)("button", { type: "button", role: "option", "aria-disabled": "true", "aria-selected": false, className: "tb-copy-source-option is-empty", onClick: () => closeSource({ restoreFocus: true }), children: [
              /* @__PURE__ */ (0, import_jsx_runtime75.jsx)("span", { className: "tb-copy-source-mark" }),
              /* @__PURE__ */ (0, import_jsx_runtime75.jsx)("span", { children: t67("\\u65E0") })
            ] }) }) : null,
            sourceOpen && candidates.length ? /* @__PURE__ */ (0, import_jsx_runtime75.jsx)("div", { className: "tb-copy-source-menu", role: "listbox", "aria-label": t67("\\u590D\\u5236\\u6765\\u6E90"), children: candidates.map(''')

# resources: the library writes through the page's own queue (so the page state,
# messages and conflicts stay one system) and sees the status line it shows
replace('''          onManage: manageTaxonomy,
          onOrganize: (action) => setOrganize({''', '''          onManage: manageTaxonomy,
          onWrite: write2,
          feedback: { message, error: error2, busy },
          onClearFeedback: operations.clearFeedback,
          onOrganize: (action) => setOrganize({''')
# resources: after a batch move / tag change the selection stays, so the next
# action can follow; archiving or restoring takes the items out of view
replace('patchScene({ selected: [], selectionMode: false, drafts });',
        'patchScene({ selected: ["archive", "restore"].includes(record2.input.action) ? [] : sceneRef.current.selected, drafts });')
