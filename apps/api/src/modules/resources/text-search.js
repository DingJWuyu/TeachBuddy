import { fold } from "./casefold.js";

const readable = (text) =>
  text
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/(?<=\p{Script=Han}) (?=\p{Script=Han})/gu, "")
    .trim();
const normalize = (text) => fold(readable(text));

function excerpt(text, offset, length) {
  // Full case folding can expand a character (ß -> ss). Map the match back
  // to original characters so the excerpt keeps both the hit and its casing.
  let folded = 0,
    position = 0,
    start = null,
    end = text.length;
  for (const char of text) {
    if (start === null && folded >= Math.max(0, offset - 35)) start = position;
    if (folded >= offset + length + 75) {
      end = position;
      break;
    }
    folded += fold(char).length;
    position += char.length;
  }
  start ??= 0;
  return (
    (start ? "…" : "") +
    text.slice(start, end) +
    (end < text.length ? "…" : "")
  ).slice(0, 400);
}

// Cache only immutable file text, not resource membership or search results.
// The resource's current file/supplement and filters are resolved on every read.
export function createResourceTextSearch({ db, files, jobs, recognition, mutations }) {
  const cached = db.prepare(
    "SELECT value FROM resource_text_cache WHERE accountKey=? AND fileId=?",
  );
  const save = db.prepare(
    "INSERT OR REPLACE INTO resource_text_cache VALUES (?, ?, ?)",
  );
  const inFlight = new Map();
  function read(principal, id) {
    const row = cached.get(principal.accountKey, id);
    return row ? JSON.parse(row.value) : null;
  }
  function source(principal, item) {
    try {
      const id = item.supplementPreviewFileId || item.fileId;
      const file = files.read(principal, id);
      const preview = files.preview(principal, id);
      const ocrSource = preview.renditionFileId
        ? { fileId: id, renditionFileId: preview.renditionFileId }
        : null;
      if (["application/pdf", "text/plain"].includes(file.mediaType))
        return { id, paged: file.mediaType === "application/pdf", ocrSource };
      if (
        preview.renditionFileId &&
        files.read(principal, preview.renditionFileId).mediaType ===
          "application/pdf"
      )
        return { id: preview.renditionFileId, paged: true, ocrSource };
      if (
        preview.jobId &&
        ["queued", "running", "cancelling"].includes(
          jobs?.get(principal, preview.jobId).state,
        )
      )
        return { state: "pending", ocrSource };
      return { state: "unavailable", ocrSource };
    } catch (error) {
      if (![404, 503].includes(error.status)) throw error;
      return { state: "failed" };
    }
  }
  async function extract(principal, id) {
    const key = `${principal.accountKey}/${id}`;
    if (inFlight.has(key)) return inFlight.get(key);
    const work = (async () => {
      let value;
      try {
        const pages = await files.extractText(principal, id);
        value = {
          state: pages.some((text) => text.trim()) ? "ready" : "unavailable",
          pages,
        };
      } catch {
        value = { state: "failed", pages: [] };
      }
      if (db.open) {
        mutations.assertAccountActive(principal);
        save.run(principal.accountKey, id, JSON.stringify(value));
      }
    })();
    inFlight.set(key, work);
    try {
      await work;
    } finally {
      inFlight.delete(key);
    }
  }
  return {
    async settle(principal, ids) {
      await Promise.allSettled(ids.map(id => inFlight.get(`${principal.accountKey}/${id}`)).filter(Boolean));
    },
    retry(principal) {
      db.prepare(
        "DELETE FROM resource_text_cache WHERE accountKey=? AND json_extract(value,'$.state')='failed'",
      ).run(principal.accountKey);
      return { accepted: true };
    },
    async search(principal, items, query, fileInfo) {
      const sources = new Map(
        items.map((item) => [item.id, source(principal, item)]),
      );
      // Bound each search response to one uncached document; the UI continues
      // while pending > 0. No detached worker or duplicate conversion pipeline.
      const missing = [...sources.values()].find(
        (entry) => entry.id && !read(principal, entry.id),
      );
      if (missing) await extract(principal, missing.id);
      const search = { pending: 0, unavailable: 0, failed: 0, matches: {} };
      if (recognition)
        search.ocr = { pendingPages: 0, unprocessedPages: 0, failedPages: 0 };
      const needle = normalize(query);
      const result = items.filter((item) => {
        const metadataMatches = normalize(
          [item.title, item.note, fileInfo(item)?.name ?? ""].join("\n"),
        ).includes(needle);
        const entry = sources.get(item.id);
        const value = entry.id ? read(principal, entry.id) : entry;
        const state = value?.state || "pending";
        if (state !== "ready") search[state]++;
        const pages = (value?.pages ?? []).map((text, index) => ({
          page: entry.paged ? index + 1 : null,
          text,
        }));
        if (recognition && entry.ocrSource) {
          try {
            const summary = recognition.get(principal, entry.ocrSource);
            for (const page of summary.pages) {
              if (["queued", "running", "cancelling"].includes(page.state))
                search.ocr.pendingPages++;
              else if (["failed", "interrupted"].includes(page.state))
                search.ocr.failedPages++;
              else if (
                page.state === "unprocessed" &&
                !value?.pages?.[page.page - 1]?.trim()
              )
                search.ocr.unprocessedPages++;
              if (page.state !== "ready") continue;
              const recognized = recognition.readPage(principal, {
                ...entry.ocrSource,
                page: page.page,
              });
              pages.push({
                page: page.page,
                text: recognized.text,
                recognition: {
                  resultId: recognized.resultId,
                  location: recognized.location,
                },
              });
            }
          } catch {
            // A broken OCR result must not hide this file's native text or
            // prevent other resources from being searched.
            search.failed += state === "failed" ? 0 : 1;
          }
        }
        pages.sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
        for (const page of pages) {
          const display = readable(page.text);
          const normalized = normalize(display);
          const offset = normalized.indexOf(needle);
          if (offset < 0) continue;
          search.matches[item.id] = {
            page: page.page,
            excerpt: excerpt(display, offset, needle.length),
            ...(page.recognition ? { recognition: page.recognition } : {}),
          };
          return true;
        }
        return metadataMatches;
      });
      return { items: result, search };
    },
  };
}
