"""Apply TeachBuddy redesign hooks to the original compiled app.js.

Reads the pristine bundle from teachbuddy-original and writes the patched
bundle into the working prototype. Every edit is an exact, unique string
replacement so a failed match stops the build instead of silently drifting.
"""
import sys, pathlib

SRC = pathlib.Path('/home/claude/teachbuddy-original/current-ui/ui/app.js')
DST = pathlib.Path('/home/claude/teachbuddy/ui/app.js')

text = SRC.read_text(encoding='utf-8')

def replace(old, new, count=1):
    global text
    found = text.count(old)
    if found != count:
        sys.exit(f'patch failed ({found} matches, expected {count}): {old[:90]!r}')
    text = text.replace(old, new)

def delegate(name, jsx_runtime, signature):
    """Rename `function Name(sig)` to Name__orig and route renders through the
    overlay (globalThis.__tbx[Name]) when it provides a replacement."""
    replace(f'  function {name}({signature}) {{',
            f'  function {name}(props) {{\n'
            f'    const Next = globalThis.__tbx?.{name};\n'
            f'    return Next ? (0, {jsx_runtime}.jsx)(Next, {{ ...props, Original: {name}__orig }}) : {name}__orig(props);\n'
            f'  }}\n'
            f'  function {name}__orig({signature}) {{')

# ---- components the redesign replaces -------------------------------------
delegate('AuthCharacters', 'import_jsx_runtime3', '{ trackingRef, field, expression: expression2, passwordVisible }')
delegate('BrandMark', 'import_jsx_runtime2', '{ mark: mark2 = "T", wordmark = "TeachBuddy" }')
delegate('AuthEntryLayout', 'import_jsx_runtime4', '{\n    children,\n    surface,\n    expression: expression2 = "idle",\n    passwordVisible = false\n  }')
delegate('Sidebar', 'import_jsx_runtime76', '{ modulePaths = {}, model, routePath, onNavigate, mobileOpen, onCloseMobile, isNarrow, railCollapsed, onExpand, openSurface, onToggleSurface, onOpenSurface, onCloseSurface, accountName }')
delegate('AuxiliaryPanel', 'import_jsx_runtime15', '{ hidden: hidden2 = false }')
delegate('Home', 'import_jsx_runtime17', '{ returnPath }')
delegate('AgentWorkspace', 'import_jsx_runtime14', '{ variant = "panel" }')
delegate('CalendarEditor', 'import_jsx_runtime70', '{ draft, onPatch, onClose, onConfirm, onDelete, onMoveItem, locked, labels: labels2, onLabels, accountKey, status, onRetry, onReload, onAdoptServer, error: error2 }')
delegate('SupportHelp', 'import_jsx_runtime81', '')
delegate('Library', 'import_jsx_runtime35', '{\n    scene,\n    patchScene,\n    items,\n    allItems,\n    tax,\n    files,\n    previews,\n    fileErrors = {},\n    client,\n    busy,\n    loading,\n    searchInfo,\n    onRetrySearch,\n    listRef,\n    breadcrumbs,\n    onOpen,\n    onUpload,\n    onFolders,\n    foldersOpen,\n    onOrganize\n  }')
delegate('WorkspaceHome', 'import_jsx_runtime46', '{ items, search: search3, deleted, busy, client, accountKey, onSearch, onDeleted, onNew, onOpen, onImport, onImportSource, onRestore, onPurge }')
delegate('Topbar', 'import_jsx_runtime79', '{ route, collapsed, toggleSidebar, surface, setSurface, assistantOpen, onToggleAssistant, children }')


# ---- sign-in subtitle under the heading -----------------------------------
replace('/* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "ae-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { children: closed ? MODE_COPY.register.heading : copy3.heading || copy3.title }) }),',
        '/* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "ae-card-head", children: [/* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { children: closed ? MODE_COPY.register.heading : copy3.heading || copy3.title }), !closed && globalThis.__tbx?.authSubtitles?.[mode] ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "tbx-auth-sub", children: globalThis.__tbx.authSubtitles[mode] }) : null] }),')


# ---- icons: the overlay's glyphs win, drawn a touch lighter ------------------
replace('        strokeWidth,\n        strokeLinecap: "round",\n        strokeLinejoin: "round",\n        "aria-hidden": "true",\n        children: ICON_PATHS[name25]',
        '        strokeWidth: globalThis.__tbx?.glyphs?.[name25] ? Math.min(strokeWidth, 1.75) : strokeWidth,\n        strokeLinecap: "round",\n        strokeLinejoin: "round",\n        "aria-hidden": "true",\n        children: globalThis.__tbx?.glyphs?.[name25] ?? ICON_PATHS[name25]')

# ---- the side panel stays mounted on modules that have one, so it can animate --
replace('(panelOpen || assistant) && /* @__PURE__ */ (0, import_jsx_runtime86.jsx)(AuxiliaryPanel, { hidden: !panelOpen || logoutBlocked })',
        '(hasPanel || assistant) && /* @__PURE__ */ (0, import_jsx_runtime86.jsx)(AuxiliaryPanel, { hidden: !panelOpen || logoutBlocked, available: hasPanel, routeName: route.name })')

# ---- feedback: each kind of note gets its own reply ------------------------------
replace('/* @__PURE__ */ (0, import_jsx_runtime77.jsx)("h2", { id: "tb-feedback-title", children: t67("\\u5DF2\\u8BB0\\u5F55\\uFF0C\\u8C22\\u8C22\\u4F60\\u7684\\u53CD\\u9988\\uFF01") }),',
        '/* @__PURE__ */ (0, import_jsx_runtime77.jsx)("h2", { id: "tb-feedback-title", children: globalThis.__tbx?.feedbackReplies?.[type]?.title ?? t67("\\u5DF2\\u8BB0\\u5F55\\uFF0C\\u8C22\\u8C22\\u4F60\\u7684\\u53CD\\u9988\\uFF01") }),\n        globalThis.__tbx?.feedbackReplies?.[type]?.note ? /* @__PURE__ */ (0, import_jsx_runtime77.jsx)("p", { className: "tbx-feedback-note", children: globalThis.__tbx.feedbackReplies[type].note }) : null,')

# ---- question slips: show type and tags in the list ------------------------
replace('''                        documentAssets(q4.body).figures[0] && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(DocumentView, { value: { version: 2, blocks: [documentAssets(q4.body).figures[0]] } })
                      ]
                    },
                    q4.id
                  ) }, q4.id))''', '''                        documentAssets(q4.body).figures[0] && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(DocumentView, { value: { version: 2, blocks: [documentAssets(q4.body).figures[0]] } }),
                        (q4.typeId || q4.tagIds?.length) ? /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("span", { className: "tbx-slip-meta", children: [
                          q4.typeId && taxonomy.types.find((x) => x.id === q4.typeId) ? /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("span", { className: "tbx-slip-type", "data-type": taxonomy.types.findIndex((x) => x.id === q4.typeId) % 4, children: taxonomy.types.find((x) => x.id === q4.typeId).name }, "type") : null,
                          ...(q4.tagIds || []).slice(0, 2).map((id3) => taxonomy.tags.find((x) => x.id === id3)).filter(Boolean).map((tag) => /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("span", { className: "tbx-slip-tag", children: tag.name }, tag.id)),
                          (q4.tagIds || []).length > 2 ? /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("span", { className: "tbx-slip-tag", children: "+" + ((q4.tagIds || []).length - 2) }, "more") : null
                        ] }) : null
                      ]
                    },
                    q4.id
                  ) }, q4.id))''')

# ---- schedule: calendar / task-board focus ---------------------------------
replace('''${shell.isPanelOpen && shell.panelMode === "ai" ? " has-ai" : ""}`, "data-region": "schedule"''',
        '''${shell.isPanelOpen ? " has-ai" : ""}`, "data-region": "schedule"''')
replace('''" has-ai" : ""}`, "data-region": "schedule", children: [''',
        '''" has-ai" : ""}`, "data-region": "schedule", "data-focus": scene.focus === "tasks" && globalThis.__tbx?.TaskBoard ? "tasks" : "calendar", "data-editing": draft ? "true" : "false", children: [''')
replace('''/* @__PURE__ */ (0, import_jsx_runtime72.jsx)(ViewMenu, { view: scene.view, onChange: changeView }),''',
        '''globalThis.__tbx?.FocusToggle ? (0, import_jsx_runtime72.jsx)(globalThis.__tbx.FocusToggle, { value: scene.focus || "calendar", onChange: (focus) => updateScene({ focus }) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime72.jsx)(ViewMenu, { view: scene.view, onChange: changeView }),''')
replace('''        /* @__PURE__ */ (0, import_jsx_runtime72.jsx)(
          TimeGrid,
          {
            view: scene.view,''', '''        scene.focus === "tasks" && globalThis.__tbx?.TaskBoard ? (0, import_jsx_runtime72.jsx)(globalThis.__tbx.TaskBoard, {
          entries: data.entries,
          occurrences: data.occurrences,
          daily: data.daily,
          labels: data.labels,
          zone,
          now,
          today,
          draftId: draft?.id,
          onOpen: openEntry,
          onNew: (unscheduled) => create3(void 0, void 0, false, unscheduled),
          draft,
          onPatchDraft: patchContent,
          onChanged: reload,
          helpers: { localParts, formatClock, titleOf }
        }) : /* @__PURE__ */ (0, import_jsx_runtime72.jsx)(
          TimeGrid,
          {
            view: scene.view,''')

# ---- settings: content background (three patterns + your own picture) ------
replace('var backgrounds = [["grid", "\\u7F51\\u683C"], ["parchment", "\\u7F8A\\u76AE\\u7EB8"], ["circles", "\\u5706\\u5F62"], ["stripes", "\\u6761\\u7EB9"]];',
        'var backgrounds = [["grid", "\\u7F51\\u683C"], ["parchment", "\\u7F8A\\u76AE\\u7EB8"], ["circles", "\\u5706\\u5F62"]];')
replace('children: /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("div", { className: "settings-background-options", role: "group"',
        'children: globalThis.__tbx?.BackgroundChoices ? (0, import_jsx_runtime85.jsx)(globalThis.__tbx.BackgroundChoices, { value: background, image: shell.appearance.backgroundImage || "", disabled: appearanceDisabled, onChange: (patch2) => shell.setAppearance(patch2), choices: backgrounds.map(([value, text8]) => [value, t67(text8)]) }) : /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("div", { className: "settings-background-options", role: "group"')
replace('        "data-background": appearance.background,\n        "data-reading-size"',
        '        "data-background": appearance.background === "custom" && !appearance.backgroundImage ? "grid" : appearance.background,\n'
        '        style: appearance.background === "custom" && appearance.backgroundImage ? { "--tbx-bg-image": `url("${appearance.backgroundImage}")` } : void 0,\n'
        '        "data-reading-size"')

# ---- settings: sign-out asks first; the agreement and danger zone come from the overlay
replace('/* @__PURE__ */ (0, import_jsx_runtime85.jsx)("button", { className: "wb-button", disabled: logoutState === "running", onClick: exitAccount, children:',
        '/* @__PURE__ */ (0, import_jsx_runtime85.jsx)("button", { className: "wb-button", disabled: logoutState === "running", onClick: () => logoutState === "unknown" ? exitAccount() : setModal("logout"), children:')
replace('      /* @__PURE__ */ (0, import_jsx_runtime85.jsx)(SettingsConfirm, { show: modal === "agreement",',
        '      /* @__PURE__ */ (0, import_jsx_runtime85.jsx)(SettingsConfirm, { show: modal === "logout", title: t67("\\u8981\\u9000\\u51FA TeachBuddy \\u5417\\uFF1F"), className: "settings-logout-dialog", confirmLabel: t67("\\u9000\\u51FA\\u767B\\u5F55"), onClose: () => setModal(null), onConfirm: () => {\n'
        '        setModal(null);\n'
        '        exitAccount();\n'
        '      }, children: /* @__PURE__ */ (0, import_jsx_runtime85.jsx)("p", { children: t67("\\u4F60\\u7684\\u9898\\u5E93\\u3001\\u65E5\\u7A0B\\u548C\\u8D44\\u6599\\u90FD\\u5DF2\\u5B89\\u5168\\u4FDD\\u5B58\\u3002\\u4E0B\\u6B21\\u767B\\u5F55\\uFF0C\\u4E00\\u5207\\u90FD\\u5728\\u539F\\u5904\\u7B49\\u4F60\\u3002") }) }),\n'
        '      /* @__PURE__ */ (0, import_jsx_runtime85.jsx)(SettingsConfirm, { show: modal === "agreement",')
replace('className: "settings-reading-dialog", onClose: () => setModal(null), children: /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("div", { className: "settings-agreement-paper"',
        'className: "settings-reading-dialog", onClose: () => setModal(null), children: globalThis.__tbx?.AgreementPaper ? (0, import_jsx_runtime85.jsx)(globalThis.__tbx.AgreementPaper, {}) : /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("div", { className: "settings-agreement-paper"')
replace('dangerActions: /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("section", { className: "settings-sheet settings-danger-section"',
        'dangerActions: globalThis.__tbx?.DangerZone ? (0, import_jsx_runtime85.jsx)(globalThis.__tbx.DangerZone, { onDelete: () => setModal("delete") }) : /* @__PURE__ */ (0, import_jsx_runtime85.jsxs)("section", { className: "settings-sheet settings-danger-section"')

# ---- settings: export packages can be deleted ---------------------------------
replace('  function workbenchPut(path4, body, idempotencyKey) {\n    return request("PUT", path4, { body, idempotencyKey, write: true });\n  }',
        '  function workbenchPut(path4, body, idempotencyKey) {\n    return request("PUT", path4, { body, idempotencyKey, write: true });\n  }\n'
        '  function workbenchDelete(path4) {\n    return request("DELETE", path4, { idempotencyKey: crypto.randomUUID(), write: true });\n  }')
replace('    async function retry() {\n      const isExport = action.pending?.payload.path === `${base4}/exports`;',
        '    async function remove2(item) {\n'
        '      setBusy(item.id);\n'
        '      setError("");\n'
        '      try {\n'
        '        await workbenchDelete(`${base4}/exports/${item.id}`);\n'
        '        await refresh();\n'
        '      } catch (e3) {\n'
        '        setError(e3.message || t67("\\u5220\\u9664\\u672A\\u5B8C\\u6210\\uFF0C\\u8BF7\\u91CD\\u8BD5\\u3002"));\n'
        '      } finally {\n'
        '        setBusy("");\n'
        '      }\n'
        '    }\n'
        '    async function retry() {\n      const isExport = action.pending?.payload.path === `${base4}/exports`;')
replace('children: exports.map((item) => /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("li", { children: [',
        'children: exports.map((item) => globalThis.__tbx?.ExportItem ? (0, import_jsx_runtime84.jsx)(globalThis.__tbx.ExportItem, { item, date: date(item.snapshotAt), state: t67(states2[item.state]), busy: !!busy, working: busy === item.id, onDownload: () => download2(item), onDelete: () => remove2(item) }, item.id) : /* @__PURE__ */ (0, import_jsx_runtime84.jsxs)("li", { children: [')

exec(open('/home/claude/build/math_patches.py', encoding='utf-8').read())
exec(open('/home/claude/build/question_patches.py', encoding='utf-8').read())
exec(open('/home/claude/build/classroom_patches.py', encoding='utf-8').read())
exec(open('/home/claude/build/shell_patches.py', encoding='utf-8').read())
exec(open('/home/claude/build/schedule_patches.py', encoding='utf-8').read())
exec(open('/home/claude/build/module_patches.py', encoding='utf-8').read())
exec(open('/home/claude/build/ux_patches.py', encoding='utf-8').read())

# ---- bridge: expose internals the overlay builds on ------------------------
BRIDGE = '''
  // TeachBuddy redesign bridge: internals shared with ui/tbx.js
  globalThis.__tb = {
    React: require_react(),
    createPortal: require_react_dom().createPortal,
    i18n: i18n_default,
    useTranslation,
    useAuth,
    useAgent,
    useRoute,
    navigate,
    followAnchor,
    useWorkbenchShell,
    ShellContext,
    useScene,
    Icon,
    Icon2,
    Popover,
    Markdown,
    remarkMath,
    rehypeKatex,
    workbenchGet,
    workbenchPost,
    workbenchPut,
    workbenchDelete,
    SettingsConfirm,
    FileImage,
    isDeletedAccount,
    workbenchModules,
    moduleDisplayName,
    SearchModal,
    Notifications,
    FeedbackPanel,
    TutorialPanel,
    PrivacyPanel,
    SupportMenu,
    CoachMark,
    TutorialCelebration,
    ToolCard,
    ObjectLink,
    agentMarkdown: markdown,
    agentLabels: { states, reasons, labels },
    SidebarHead,
    NavigationStatus,
    NavigationBusy,
    groupDisplayName,
    modulePath,
    withSearch,
    HOME_PATH,
    SUPPORT_MENU_ITEMS,
    workbenchModulesAll: workbenchModules,
    questionKit: { QuestionIcon, DocumentView, ImportList, sourceText, documentAssets },
    mathKit: { useAuxiliaryAssistant, MathWebAssistant, WorkIllustration },
    scheduleKit: { CalendarOverlay, CalendarDialog, RepeatDialog, ReminderDialog, LabelDialog, ConflictPreview, endOf, endTimeProblem, changeEnd, defaultTime, presetRepeat, repeatLabel, reminderLabel, dstAdjustment, todayInZone }
  };
  globalThis.__tbx?.installLocales?.(i18n_default);
'''
replace('  // apps/web/src/main.jsx\n  var import_jsx_runtime89', BRIDGE + '\n  // apps/web/src/main.jsx\n  var import_jsx_runtime89')

DST.write_text(text, encoding='utf-8')
print('app.js patched')
