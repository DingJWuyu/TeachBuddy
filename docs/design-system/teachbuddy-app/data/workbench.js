var TeachBuddyAdapters;
(TeachBuddyAdapters ||= {}).workbench = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // prototype/current-ui/data/data/workbench.js
  var workbench_exports = {};
  __export(workbench_exports, {
    handleWorkbench: () => handleWorkbench
  });
  var catalog = [
    { id: "questions", name: "\u9898\u5E93", path: "/questions", navigation: "sidebar", auxiliaryPanel: true, webEnabled: true, requires: [] },
    { id: "math", name: "\u6570\u5B66\u5DE5\u574A", path: "/math", navigation: "sidebar", auxiliaryPanel: true, webEnabled: true, requires: [] },
    { id: "resources", name: "\u8D44\u6E90\u5E93", path: "/resources", navigation: "sidebar", auxiliaryPanel: true, webEnabled: true, requires: [] },
    { id: "schedule", name: "\u65E5\u7A0B", path: "/calendar", navigation: "top", auxiliaryPanel: true, webEnabled: true, requires: [] },
    { id: "classroom", name: "\u73ED\u7EA7", path: "/classroom", navigation: "sidebar", auxiliaryPanel: true, webEnabled: true, requires: [] }
  ];
  var defaults = {
    readingSize: "standard",
    motion: "system",
    externalAi: "deepseek",
    theme: "light",
    background: "grid",
    avatar: "",
    backgroundImage: "",
    locale: "zh-CN"
  };
  var paths = /* @__PURE__ */ new Set([
    "/api/workbench/context",
    "/api/modules",
    "/api/reliability/v1/context",
    "/api/workbench/navigation",
    "/api/reliability/v1/preferences"
  ]);
  var record = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  var clone = (value) => structuredClone(value);
  var validId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function defaultNavigation() {
    return {
      structureVersion: 1,
      defaultLayoutVersion: 1,
      groups: [
        { id: "teaching-group", name: "\u6559\u5B66", nameKey: "teaching", moduleIds: catalog.filter((item) => item.webEnabled && item.navigation === "sidebar").map((item) => item.id) },
        { id: "ungrouped", name: "\u672A\u5206\u7EC4", nameKey: "ungrouped", moduleIds: [] }
      ],
      hiddenModuleIds: []
    };
  }
  function validNavigation(layout) {
    if (!record(layout) || Object.keys(layout).some((key) => !["structureVersion", "defaultLayoutVersion", "groups", "hiddenModuleIds"].includes(key)) || layout.structureVersion !== 1 || layout.defaultLayoutVersion !== 1 || !Array.isArray(layout.groups) || !layout.groups.length || layout.groups.length > 100 || !Array.isArray(layout.hiddenModuleIds) || layout.hiddenModuleIds.length > 500) return false;
    const groups = /* @__PURE__ */ new Set();
    const modules = /* @__PURE__ */ new Set();
    for (const group of layout.groups) {
      if (!record(group) || Object.keys(group).some((key) => !["id", "name", "nameKey", "moduleIds"].includes(key)) || !validId(group.id) || groups.has(group.id) || typeof group.name !== "string" || !group.name.trim() || group.name.length > 80 || !Array.isArray(group.moduleIds) || group.moduleIds.length > 500) return false;
      groups.add(group.id);
      if (group.nameKey !== void 0 && !(group.nameKey === "teaching" && group.id === "teaching-group" && group.name === "\u6559\u5B66" || group.nameKey === "ungrouped" && group.id === "ungrouped" && group.name === "\u672A\u5206\u7EC4")) return false;
      for (const id of group.moduleIds) {
        if (!validId(id) || modules.has(id)) return false;
        modules.add(id);
      }
    }
    for (const id of layout.hiddenModuleIds) {
      if (!validId(id) || modules.has(id)) return false;
      modules.add(id);
    }
    return layout.groups.at(-1).id === "ungrouped";
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!record(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  function preferenceError(values) {
    if (!record(values)) return { field: "/values", reason: "invalid-type" };
    for (const key of Object.keys(values)) {
      if (!Object.hasOwn(defaults, key)) return { field: `/values/${key}`, reason: "unknown-field" };
    }
    const choices = {
      readingSize: ["standard", "large"],
      motion: ["system", "reduce"],
      externalAi: ["deepseek", "doubao"],
      theme: ["light", "dark"],
      background: ["grid", "parchment", "circles", "stripes", "custom"],
      locale: ["zh-CN", "en"]
    };
    for (const [name, options] of Object.entries(choices)) {
      if ((["readingSize", "motion", "externalAi"].includes(name) || Object.hasOwn(values, name)) && !options.includes(values[name])) {
        return { field: `/values/${name}`, reason: "out-of-range" };
      }
    }
    if (Object.hasOwn(values, "avatar") && (typeof values.avatar !== "string" || values.avatar.length > 131072 || values.avatar !== "" && !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(values.avatar))) {
      return { field: "/values/avatar", reason: "out-of-range" };
    }
    if (Object.hasOwn(values, "backgroundImage") && (typeof values.backgroundImage !== "string" || values.backgroundImage.length > 3145728 || values.backgroundImage !== "" && !/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(values.backgroundImage))) {
      return { field: "/values/backgroundImage", reason: "out-of-range" };
    }
    return null;
  }
  async function handleWorkbench(req, ctx) {
    const path = req.path.replace(/\/$/, "");
    if (!paths.has(path)) return void 0;
    const problem = (type, status, extra = {}) => ctx.problem(`/problems/workbench/${type}`, status, extra);
    const invalid = (field, reason) => problem("invalid-input", 422, { field, reason });
    const accountKey = ctx.state.account?.accountKey;
    if (!accountKey) return problem("unauthenticated", 401);
    const state = ctx.state.workbench ??= { recoveryId: "5e2bc40e-3535-4d64-bafe-6d1bd410f97a", accounts: {} };
    state.accounts ??= {};
    if (!Object.hasOwn(state.accounts, accountKey)) {
      Object.defineProperty(state.accounts, accountKey, { enumerable: true, configurable: true, writable: true, value: {
        navigation: { id: "navigation", version: 1, layout: defaultNavigation(), updatedAt: null },
        preferences: { version: 1, values: { ...defaults }, updatedAt: null },
        receipts: {}
      } });
    }
    const account = state.accounts[accountKey];
    const isNavigation = path === "/api/workbench/navigation";
    const isPreferences = path === "/api/reliability/v1/preferences";
    if ((isNavigation || isPreferences) && req.url.search) return invalid("/query", "unknown-field");
    if (req.method === "GET") {
      if (path === "/api/workbench/context") return ctx.json({ accountKey });
      if (path === "/api/modules") return ctx.json({ version: 4, items: clone(catalog) });
      if (path === "/api/reliability/v1/context") return ctx.json({ recoveryId: state.recoveryId });
      return ctx.json(clone(isNavigation ? account.navigation : account.preferences));
    }
    if (req.method !== "PUT" || !isNavigation && !isPreferences) return problem("not-found", 404);
    const body = req.body;
    if (!record(body)) return invalid("/", "invalid-type");
    const valueName = isNavigation ? "layout" : "values";
    const unknown = Object.keys(body).find((name) => !["baseVersion", valueName].includes(name));
    if (unknown) return invalid(`/${unknown}`, "unknown-field");
    if (!Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1) return invalid("/baseVersion", "out-of-range");
    if (isNavigation && !validNavigation(body.layout)) return invalid("/layout", "out-of-range");
    if (isPreferences) {
      const error = preferenceError(body.values);
      if (error) return invalid(error.field, error.reason);
    }
    const key = req.headers.get("Idempotency-Key");
    if (!key) return invalid("/headers/Idempotency-Key", "required");
    if (!uuid.test(key)) return invalid("/headers/Idempotency-Key", "invalid-type");
    const signature = JSON.stringify({ method: req.method, path, body: canonical(body) });
    const receipt = account.receipts[key];
    if (receipt) {
      if (receipt.signature !== signature) return problem("idempotency-key-reused", 409);
      return ctx.json(clone(receipt.body));
    }
    const current = isNavigation ? account.navigation : account.preferences;
    if (body.baseVersion !== current.version) return problem("version-conflict", 409, { currentVersion: current.version });
    const updatedAt = new Date(ctx.now()).toISOString();
    const next = isNavigation ? { id: "navigation", version: current.version + 1, layout: clone(body.layout), updatedAt } : { version: current.version + 1, values: { ...current.values, ...clone(body.values) }, updatedAt };
    account[isNavigation ? "navigation" : "preferences"] = next;
    account.receipts[key] = { signature, body: clone(next) };
    return ctx.json(clone(next));
  }
  return __toCommonJS(workbench_exports);
})();
