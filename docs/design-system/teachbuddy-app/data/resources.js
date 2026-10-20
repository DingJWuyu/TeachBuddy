var TeachBuddyAdapters;
(TeachBuddyAdapters ||= {}).resources = (() => {
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

  // prototype/current-ui/data/data/resources.js
  var resources_exports = {};
  __export(resources_exports, {
    handleResources: () => handleResources
  });
  async function handleResources(req, ctx) {
    const prefix = "/api/modules/resources";
    if (!req.path.startsWith(prefix + "/")) return void 0;
    const path = req.path.slice(prefix.length);
    const method = req.method;
    const input = req.body ?? {};
    const store = ctx.state.resources ??= {
      items: [],
      taxonomy: { version: 1, folders: [], tags: [] },
      history: {},
      requests: {}
    };
    const copy = (value) => structuredClone(value);
    const notFound = () => ctx.problem("/problems/workbench/not-found", 404);
    const invalid = (field, reason = "invalid-reference") => ctx.problem("/problems/workbench/invalid-input", 422, { field, reason });
    const taxError = (field, detail) => ctx.problem("/problems/materials/invalid-taxonomy", 422, { field, detail });
    const fileEntry = (id2) => ctx.files.get(id2);
    const fileMeta = (id2) => {
      const entry = fileEntry(id2);
      return entry?.metadata ?? entry?.meta ?? entry;
    };
    const capture = (item2) => {
      (store.history[item2.id] ??= []).unshift({
        version: item2.version,
        createdAt: item2.updatedAt,
        fileId: item2.fileId,
        supplementPreviewFileId: item2.supplementPreviewFileId
      });
    };
    const changed = (item2, patch) => {
      Object.assign(item2, patch, { version: item2.version + 1, updatedAt: ctx.now() });
      return item2;
    };
    const checkVersion = (item2, value, allowDeleted = false) => {
      if (!item2) return notFound();
      if (item2.version !== value.baseVersion)
        return ctx.problem("/problems/workbench/version-conflict", 409, { currentVersion: item2.version });
      if (item2.deletedAt && !allowDeleted) return ctx.problem("/problems/workbench/object-deleted", 410);
      return null;
    };
    const checkLinks = (value) => {
      if (value.folderId && !store.taxonomy.folders.some((folder) => folder.id === value.folderId))
        return taxError("/folderId", "\u6587\u4EF6\u5939\u4E0D\u5B58\u5728");
      if (!Array.isArray(value.tagIds) || new Set(value.tagIds).size !== value.tagIds.length || value.tagIds.some((id2) => !store.taxonomy.tags.some((tag) => tag.id === id2)))
        return taxError("/tagIds", "\u6807\u7B7E\u4E0D\u5B58\u5728\u6216\u91CD\u590D");
      return null;
    };
    const fold = (value) => String(value ?? "").normalize("NFC").toLocaleLowerCase().replace(/ß/g, "ss").replace(/\s+/gu, " ").replace(/(?<=\p{Script=Han}) (?=\p{Script=Han})/gu, "").trim();
    const key = req.headers?.get("Idempotency-Key");
    const requestIdentity = key && `${method}:${path}:${key}`;
    const fingerprint = JSON.stringify(input);
    if (method !== "GET" && requestIdentity && store.requests[requestIdentity]) {
      const saved = store.requests[requestIdentity];
      if (saved.fingerprint !== fingerprint) return ctx.problem("/problems/workbench/idempotency-key-reused", 409);
      return ctx.json(copy(saved.body), saved.status);
    }
    const done = (body, status = 200) => {
      if (method !== "GET" && requestIdentity) store.requests[requestIdentity] = { fingerprint, body: copy(body), status };
      return ctx.json(copy(body), status);
    };
    if (path === "/taxonomy" && method === "GET") return done(store.taxonomy);
    if (path === "/taxonomy" && method === "PUT") {
      const old = store.taxonomy;
      if (input.baseVersion !== old.version) return ctx.problem("/problems/workbench/version-conflict", 409, { currentVersion: old.version });
      if (!Array.isArray(input.folders) || !Array.isArray(input.tags)) return invalid("/folders", "invalid-type");
      const folders = input.folders.map((folder) => ({ ...folder, name: String(folder.name ?? "").trim() }));
      const tags = input.tags.map((tag) => ({ ...tag, name: String(tag.name ?? "").trim() }));
      const byId = new Map(folders.map((folder) => [folder.id, folder]));
      const oldById = new Map(old.folders.map((folder) => [folder.id, folder]));
      const ancestor = (id2) => {
        const visited = /* @__PURE__ */ new Set();
        while (id2 && !byId.has(id2)) {
          if (visited.has(id2) || !oldById.has(id2)) return void 0;
          visited.add(id2);
          id2 = oldById.get(id2).parentId;
        }
        return id2 || null;
      };
      for (const folder of folders) {
        const parent = ancestor(folder.parentId);
        if (parent === void 0) return taxError("/folders", "\u7236\u6587\u4EF6\u5939\u4E0D\u5B58\u5728");
        folder.parentId = parent;
      }
      for (const [group, entries] of [["folders", folders], ["tags", tags]]) {
        const ids = /* @__PURE__ */ new Set(), names = /* @__PURE__ */ new Set();
        for (const [index, entry] of entries.entries()) {
          const name = (group === "folders" ? (entry.parentId ?? "root") + ":" : "") + fold(entry.name);
          if (!entry.name || ids.has(entry.id) || names.has(name)) return taxError(`/${group}/${index}`, "\u540D\u79F0\u4E3A\u7A7A\u3001\u540C\u540D\u6216\u8EAB\u4EFD\u91CD\u590D");
          ids.add(entry.id);
          names.add(name);
          if (group === "folders") {
            const visited = /* @__PURE__ */ new Set();
            let cursor = entry;
            while (cursor) {
              if (visited.has(cursor.id) || visited.size >= 10) return taxError(`/folders/${index}/parentId`, "\u6587\u4EF6\u5939\u5FAA\u73AF\u6216\u8D85\u8FC7\u5341\u5C42");
              visited.add(cursor.id);
              cursor = byId.get(cursor.parentId);
            }
          }
        }
      }
      const tagIds = new Set(tags.map((tag) => tag.id));
      for (const item2 of store.items) {
        const folderId = item2.folderId && !byId.has(item2.folderId) ? null : ancestor(item2.folderId);
        const nextTags = item2.tagIds.filter((id2) => tagIds.has(id2));
        if (folderId !== item2.folderId || nextTags.length !== item2.tagIds.length) changed(item2, { folderId: folderId ?? null, tagIds: nextTags });
      }
      store.taxonomy = { version: old.version + 1, folders, tags };
      return done(store.taxonomy);
    }
    if (path === "/search/retry" && method === "POST") return done({ accepted: true });
    if (path === "/items/organize" && method === "POST") {
      if (!Array.isArray(input.items) || !["move", "add-tags", "archive", "restore"].includes(input.action)) return invalid("/items");
      if (new Set(input.items.map((item2) => item2.id)).size !== input.items.length) return invalid("/items", "duplicate-id");
      const selected = input.items.map((entry) => store.items.find((item2) => item2.id === entry.id));
      for (const [index, item2] of selected.entries()) {
        const error2 = checkVersion(item2, input.items[index], input.action === "restore");
        if (error2) return error2;
        if (input.action === "restore" && !item2.deletedAt) return invalid("/items");
      }
      if (input.action === "move" || input.action === "add-tags") {
        const error2 = checkLinks({ folderId: input.action === "move" ? input.folderId : null, tagIds: input.action === "add-tags" ? input.tagIds : [] });
        if (error2) return error2;
      }
      return done({ items: selected.map((item2) => changed(item2, input.action === "move" ? { folderId: input.folderId } : input.action === "add-tags" ? { tagIds: [.../* @__PURE__ */ new Set([...item2.tagIds, ...input.tagIds])] } : { deletedAt: input.action === "archive" ? ctx.now() : null })) });
    }
    if (path === "/items" && method === "POST") {
      if (!fileEntry(input.fileId)) return notFound();
      if (typeof input.title !== "string" || !input.title.trim()) return invalid("/title", "empty-content");
      const error2 = checkLinks(input);
      if (error2) return error2;
      const timestamp = ctx.now();
      const item2 = {
        id: ctx.id(),
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        title: input.title,
        folderId: input.folderId ?? null,
        tagIds: [...input.tagIds],
        note: input.note ?? "",
        fileId: input.fileId,
        supplementPreviewFileId: null
      };
      store.items.push(item2);
      capture(item2);
      return done(item2, 201);
    }
    if (path === "/items" && method === "GET") {
      const query = req.url.searchParams;
      const folderId = query.get("folderId");
      const inFolder = (id2) => {
        const seen = /* @__PURE__ */ new Set();
        while (id2 && !seen.has(id2)) {
          if (id2 === folderId) return true;
          seen.add(id2);
          id2 = store.taxonomy.folders.find((folder) => folder.id === id2)?.parentId;
        }
        return false;
      };
      let items = store.items.filter(
        (item2) => (query.get("state") === "deleted" ? item2.deletedAt !== null : item2.deletedAt === null) && (!folderId || inFolder(item2.folderId)) && query.getAll("tagIds").every((id2) => item2.tagIds.includes(id2)) && (!query.get("mediaType") || fileMeta(item2.fileId)?.mediaType === query.get("mediaType")) && (!query.get("sha256") || fileMeta(item2.fileId)?.sha256 === query.get("sha256"))
      ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      const needle = fold(query.get("q"));
      if (!needle) return done({ items });
      const search = { pending: 0, unavailable: 0, failed: 0, matches: {}, ocr: { pendingPages: 0, unprocessedPages: 0, failedPages: 0 } };
      const matches = [];
      for (const item2 of items) {
        const entry = fileEntry(item2.supplementPreviewFileId || item2.fileId);
        const meta = fileMeta(item2.supplementPreviewFileId || item2.fileId);
        let pages = entry?.textPages ?? entry?.pagesText ?? entry?.text?.pages ?? [];
        if (!Array.isArray(pages)) pages = [];
        if (!pages.length && typeof entry?.text === "string") pages = [entry.text];
        const blob = entry?.blob ?? entry?.file ?? (entry instanceof Blob ? entry : null);
        if (!pages.length && blob && ["text/plain", "text/html", "text/markdown", "application/json"].includes(meta?.mediaType ?? blob.type)) {
          pages = [await blob.text()];
          if ((meta?.mediaType ?? blob.type) === "text/html") pages = [pages[0].replace(/<[^>]+>/g, " ")];
        }
        if (!pages.some((page) => String(page?.text ?? page).trim())) search.unavailable++;
        let hit = false;
        for (const [index, page] of pages.entries()) {
          const text = String(page?.text ?? page).replace(/\s+/g, " ").trim();
          const offset = fold(text).indexOf(needle);
          if (offset < 0) continue;
          const start = Math.max(0, offset - 35), end = Math.min(text.length, offset + needle.length + 75);
          search.matches[item2.id] = { page: meta?.mediaType === "text/plain" ? null : index + 1, excerpt: (start ? "\u2026" : "") + text.slice(start, end) + (end < text.length ? "\u2026" : "") };
          hit = true;
          break;
        }
        if (hit || fold([item2.title, item2.note, fileMeta(item2.fileId)?.name].join("\n")).includes(needle)) matches.push(item2);
      }
      return done({ items: matches, search });
    }
    const match = /^\/items\/([^/]+)(?:\/(history|file|supplement-preview|restore-file|deletion|purge))?$/.exec(path);
    if (!match) return void 0;
    const [, id, operation] = match;
    const item = store.items.find((item2) => item2.id === id);
    if (!item) return notFound();
    if (method === "GET" && !operation) return done(item);
    if (method === "GET" && operation === "history") return done({ items: (store.history[id] ?? []).map((entry) => ({ ...entry, file: fileMeta(entry.fileId) ? { ...fileMeta(entry.fileId), blob: void 0, file: void 0 } : null, unavailable: !fileEntry(entry.fileId) })) });
    if (!["PUT", "POST"].includes(method)) return void 0;
    const error = checkVersion(item, input, ["deletion", "purge"].includes(operation));
    if (error) return error;
    if (!operation && method === "PUT") {
      if (typeof input.title !== "string" || !input.title.trim()) return invalid("/title", "empty-content");
      const linkError = checkLinks(input);
      if (linkError) return linkError;
      return done(changed(item, { title: input.title, note: input.note ?? "", folderId: input.folderId ?? null, tagIds: [...input.tagIds] }));
    }
    if (operation === "file" && method === "PUT") {
      if (!fileEntry(input.fileId)) return notFound();
      changed(item, { fileId: input.fileId, supplementPreviewFileId: null });
      capture(item);
      return done(item);
    }
    if (operation === "supplement-preview" && method === "PUT") {
      if (item.fileId !== input.fileId) return invalid("/fileId", "out-of-range");
      if (input.supplementPreviewFileId && fileMeta(input.supplementPreviewFileId)?.mediaType !== "application/pdf") return invalid("/supplementPreviewFileId", "out-of-range");
      changed(item, { supplementPreviewFileId: input.supplementPreviewFileId ?? null });
      capture(item);
      return done(item);
    }
    if (operation === "restore-file" && method === "POST") {
      const revision = store.history[id]?.find((entry) => entry.version === input.fileVersion);
      if (!revision) return invalid("/fileVersion");
      if (!fileEntry(revision.fileId)) return notFound();
      changed(item, { fileId: revision.fileId, supplementPreviewFileId: revision.supplementPreviewFileId });
      capture(item);
      return done(item);
    }
    if (operation === "deletion" && method === "POST") return done(changed(item, { deletedAt: input.deleted ? item.deletedAt ?? ctx.now() : null }));
    if (operation === "purge" && method === "POST") {
      if (!item.deletedAt) return invalid("/id");
      store.items = store.items.filter((entry) => entry.id !== id);
      delete store.history[id];
      return done({ id, permanentlyDeleted: true });
    }
    return void 0;
  }
  return __toCommonJS(resources_exports);
})();
