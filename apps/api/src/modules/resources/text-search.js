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
export function createResourceTextSearch({ db, files, jobs }) {
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
      if (["application/pdf", "text/plain"].includes(file.mediaType))
        return { id, paged: file.mediaType === "application/pdf" };
      const preview = files.preview(principal, id);
      if (
        preview.renditionFileId &&
        files.read(principal, preview.renditionFileId).mediaType ===
          "application/pdf"
      )
        return { id: preview.renditionFileId, paged: true };
      if (
        preview.jobId &&
        ["queued", "running", "cancelling"].includes(
          jobs?.get(principal, preview.jobId).state,
        )
      )
        return { state: "pending" };
      return { state: "unavailable" };
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
      if (db.open) save.run(principal.accountKey, id, JSON.stringify(value));
    })();
    inFlight.set(key, work);
    try {
      await work;
    } finally {
      inFlight.delete(key);
    }
  }
  return {
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
      const needle = normalize(query);
      const result = items.filter((item) => {
        const metadataMatches = normalize(
          [item.title, item.note, fileInfo(item)?.name ?? ""].join("\n"),
        ).includes(needle);
        const entry = sources.get(item.id);
        const value = entry.id ? read(principal, entry.id) : entry;
        const state = value?.state || "pending";
        if (state !== "ready") {
          search[state]++;
          return metadataMatches;
        }
        for (const [index, text] of value.pages.entries()) {
          const display = readable(text);
          const normalized = normalize(display);
          const offset = normalized.indexOf(needle);
          if (offset < 0) continue;
          search.matches[item.id] = {
            page: entry.paged ? index + 1 : null,
            excerpt: excerpt(display, offset, needle.length),
          };
          return true;
        }
        return metadataMatches;
      });
      return { items: result, search };
    },
  };
}
