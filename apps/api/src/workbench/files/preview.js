import sharp from "sharp";
import { createHash } from "node:crypto";
import { convertFile } from "./converter.js";
const internalKey = (value) => {
  const h = createHash("sha256").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
import { validateSchema } from "../content/schema.js";
import { invalidInput } from "../problems.js";
import { imageTypes } from "./index.js";
import { materialsError } from "../problems.js";
export function createPreviews({
  db,
  mutations,
  files,
  jobs,
  readBytes,
  directory,
  conversion = {},
}) {
  const pending = (fileId) => ({
    fileId,
    jobId: null,
    state: "pending",
    renditionFileId: null,
    pageCount: null,
    pages: [],
    issues: [],
  });
  function preview(principal, id) {
    files.read(principal, id);
    const row = db
      .prepare(
        "SELECT value FROM materials_previews WHERE fileId=? AND accountKey=?",
      )
      .get(id, principal.accountKey);
    return row ? JSON.parse(row.value) : pending(id);
  }
  function readRendition(principal, { fileId, renditionFileId }) {
    files.read(principal, fileId);
    files.read(principal, renditionFileId);
    const row = db.prepare(
      "SELECT value FROM materials_renditions WHERE fileId=? AND renditionId=? AND accountKey=?",
    ).get(fileId, renditionFileId, principal.accountKey);
    if (!row) throw invalidInput("/renditionFileId", "out-of-range");
    const rendition = JSON.parse(row.value);
    validateSchema("Preview", rendition);
    if (rendition.fileId !== fileId || rendition.renditionFileId !== renditionFileId) {
      throw invalidInput("/renditionFileId", "out-of-range");
    }
    for (const page of rendition.pages) files.read(principal, page.imageFileId);
    return rendition;
  }
  function save(principal, value) {
    validateSchema("Preview", value);
    db.prepare(
      "INSERT INTO materials_previews VALUES (?, ?, ?) ON CONFLICT(fileId) DO UPDATE SET value=excluded.value",
    ).run(value.fileId, principal.accountKey, JSON.stringify(value));
    if (value.renditionFileId)
      db.prepare(
        "INSERT INTO materials_renditions VALUES (?, ?, ?, ?) ON CONFLICT(fileId,renditionId) DO UPDATE SET value=excluded.value",
      ).run(
        value.fileId,
        value.renditionFileId,
        principal.accountKey,
        JSON.stringify(value),
      );
    return value;
  }
  function accept(principal, id, mutation) {
    const job = jobs.enqueue(
      {
        principal,
        kind: "preview",
        target: { kind: "file", id, version: null },
      },
      mutation,
    );
    save(principal, { ...preview(principal, id), jobId: job.id });
    return job;
  }
  async function requestPreview(principal, id, mutation) {
    return mutations.execute({ principal, ...mutation, body: {} }, () => {
      const current = preview(principal, id);
      return {
        status: 202,
        body: current.jobId
          ? jobs.get(principal, current.jobId)
          : accept(principal, id, mutation),
      };
    }).body;
  }
  const inFlight = new Map();
  let conversionQueue = Promise.resolve();
  const textConversions = new Map();
  async function ensurePreview(principal, id, { signal } = {}) {
    signal?.throwIfAborted();
    const current = preview(principal, id);
    if (["ready", "limited"].includes(current.state)) {
      files.read(principal, current.renditionFileId);
      current.pages.forEach((p) => files.read(principal, p.imageFileId));
      return current;
    }
    if (inFlight.has(id)) return inFlight.get(id);
    const work = (async () => {
      const file = files.read(principal, id);
      const supported =
        imageTypes.has(file.mediaType) ||
        [
          "text/html",
          "application/pdf",
          "application/msword",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ].includes(file.mediaType);
      if (!supported)
        return save(principal, {
          ...current,
          state: "failed",
          issues: ["unsupported-format"],
        });
      let result;
      try {
        // Conversions run one at a time; re-check the stop after queueing so a cancelled job never starts one.
        const next = conversionQueue.then(() => {
          signal?.throwIfAborted();
          return convertFile({
            bytes: readBytes(principal, id),
            mediaType: file.mediaType,
            ...conversion,
            directory: files.accountWorkDirectory(principal),
            signal,
          });
        });
        conversionQueue = next.catch(() => {});
        result = await next;
      } catch {
        // A kill caused by a stop is a cancel, not a conversion failure; the previous preview stays published.
        if (signal?.aborted) throw signal.reason;
        return save(principal, {
          ...preview(principal, id),
          state: "failed",
          issues: ["conversion-failed"],
        });
      }
      signal?.throwIfAborted();
      const attempt = preview(principal, id).jobId ?? id;
      const store = (name, bytes) =>
        files.store(
          principal,
          { name, bytes },
          {
            key: internalKey(`${attempt}/${name}`),
            method: "POST",
            path: `/internal/previews/${id}`,
          },
        );
      let rendition = result.pdf
        ? (await store("preview.pdf", result.pdf)).id
        : id;
      signal?.throwIfAborted();
      const pages = [];
      for (const page of result.pages) {
        const image = await store(page.name, page.bytes);
        signal?.throwIfAborted();
        pages.push({
          page: page.page,
          width: page.width,
          height: page.height,
          imageFileId: image.id,
        });
      }
      if (file.mediaType === "text/html") rendition = pages[0].imageFileId;
      signal?.throwIfAborted();
      return db.transaction(() =>
        save(principal, {
          ...preview(principal, id),
          state: result.legacy || result.issues.length ? "limited" : "ready",
          renditionFileId: rendition,
          pageCount: pages.length,
          pages,
          issues: result.legacy ? ["legacy-object-loss"] : result.issues,
        }),
      )();
    })();
    inFlight.set(id, work);
    try {
      return await work;
    } finally {
      inFlight.delete(id);
    }
  }
  async function crop(principal, input, mutation) {
    validateSchema("CropInput", input);
    const prior = mutations.peek({ principal, ...mutation, body: input });
    if (prior) {
      const saved = prior.body;
      files.read(principal, saved.id);
      return saved;
    }
    const l = input.location;
    let rendition;
    try {
      rendition = readRendition(principal, l);
    } catch (error) {
      if (error.problem?.type === "/problems/workbench/invalid-input" &&
          error.problem.field === "/renditionFileId" && error.problem.reason === "out-of-range")
        throw invalidInput("/location", "out-of-range");
      throw error;
    }
    if (!l.box || l.box.x + l.box.width > 1 || l.box.y + l.box.height > 1)
      throw invalidInput("/location", "out-of-range");
    const page = rendition.pages.find((p) => p.page === l.page);
    if (!page) throw invalidInput("/location/page", "out-of-range");
    const left = Math.floor(l.box.x * page.width),
      top = Math.floor(l.box.y * page.height);
    const width = Math.min(
      page.width - left,
      Math.max(1, Math.round(l.box.width * page.width)),
    );
    const height = Math.min(
      page.height - top,
      Math.max(1, Math.round(l.box.height * page.height)),
    );
    const bytes = await sharp(readBytes(principal, page.imageFileId))
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    // Bind the public key to the location, not just coincidentally identical pixels.
    const internal = await files.store(
      principal,
      { name: "crop.png", bytes },
      {
        key: internalKey(`${principal.accountKey}/${mutation.key}/crop`),
        method: "POST",
        path: "/internal/crops",
      },
    );
    return mutations.execute({ principal, ...mutation, body: input }, () => ({
      status: 201,
      body: internal,
    })).body;
  }
  const handler = {
    async run({ principal, job, signal, reportProgress }) {
      signal.throwIfAborted();
      const result = await ensurePreview(principal, job.target.id, { signal });
      signal.throwIfAborted();
      reportProgress({
        completed: result.pages.length,
        total: result.pageCount,
        unit: "pages",
      });
      return {
        state:
          result.state === "failed"
            ? "failed"
            : result.state === "limited"
              ? "partial"
              : "succeeded",
        outputFileIds: result.pages.map((p) => p.imageFileId),
        issues: result.issues.map((code) => ({
          code: "conversion-failed",
          unitId: `file:${job.target.id}`,
          field: null,
          detail: code,
        })),
      };
    },
    retry({ principal, job, mutation }) {
      const current = preview(principal, job.target.id);
      if (
        current.jobId &&
        current.jobId !== job.id &&
        ["queued", "running", "cancelling"].includes(
          jobs.get(principal, current.jobId).state,
        )
      )
        throw materialsError("job-running", 409);
      return accept(principal, job.target.id, mutation);
    },
  };
  return {
    // Used by resources only. Original files and existing preview jobs stay intact.
    async extractText(principal, id) {
      const file = files.read(principal, id);
      if (file.mediaType === "text/plain") {
        if (file.byteLength > 8 * 1024 * 1024)
          throw new Error("Text size limit exceeded");
        return [readBytes(principal, id).toString("utf8")];
      }
      if (file.mediaType !== "application/pdf")
        throw new Error("Text extraction requires PDF");
      mutations.assertAccountActive(principal);
      const abort = new AbortController();
      let settled;
      const done = new Promise(resolve => { settled = resolve; });
      const handle = { accountKey: principal.accountKey, abort, done };
      textConversions.set(handle, handle);
      try {
      const result = await convertFile({
        bytes: readBytes(principal, id),
        mediaType: file.mediaType,
        ...conversion,
        directory: files.accountWorkDirectory(principal),
        signal: abort.signal,
        textOnly: true,
        timeoutMs: 12000,
      });
      return result.textPages;
      } finally { textConversions.delete(handle); settled(); }
    },
    async convertWord(principal, id, {signal} = {}) {
      const file = files.read(principal, id);
      if (file.mediaType !== "application/msword") throw new Error("Native Word conversion requires DOC");
      const next = conversionQueue.then(() => convertFile({bytes: readBytes(principal, id),
        mediaType: file.mediaType, ...conversion, directory: files.accountWorkDirectory(principal), signal, wordOnly: true}));
      conversionQueue = next.catch(() => {});
      const result = await next;
      signal?.throwIfAborted();
      return files.store(principal, {name: "converted.docx", bytes: result.word}, {
        key: internalKey(`${id}/native-word-v1/${createHash("sha256").update(result.word).digest("hex")}`), method: "POST", path: `/internal/word/${id}`,
      });
    },
    preview,
    readRendition,
    requestPreview,
    ensurePreview,
    crop,
    close() {
      const handles = [...textConversions.values()];
      for (const handle of handles) handle.abort.abort();
      return Promise.all(handles.map(handle => handle.done));
    },
    async cancelAccountConversionsAndWait(accountKey) {
      const active = [...textConversions.values()].filter(handle => handle.accountKey === accountKey);
      for (const handle of active) handle.abort.abort();
      await Promise.all(active.map(handle => handle.done));
    },
    jobHandlers: { preview: handler },
  };
}
