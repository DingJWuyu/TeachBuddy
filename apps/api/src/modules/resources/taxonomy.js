import { casefold as fold } from "../../workbench/text.js";
import { contractError, problems } from "../../workbench/problems.js";
export function invalidTaxonomy(field, detail) {
  return Object.assign(new Error(detail), {
    status: 422,
    problem: { type: "/problems/materials/invalid-taxonomy", field, detail },
  });
}
export function createTaxonomy({ db, all, save, now }) {
  const get = db.prepare(
    "SELECT value FROM resource_taxonomy WHERE accountKey=?",
  );
  const put = db.prepare(
    "INSERT INTO resource_taxonomy VALUES (?,?) ON CONFLICT(accountKey) DO UPDATE SET value=excluded.value",
  );
  const readStored = (principal) => {
    const row = get.get(principal.accountKey);
    return row ? JSON.parse(row.value) : null;
  };
  const read = principal => readStored(principal) ?? { version: 1, folders: [], tags: [] };
  function validateLinks(principal, input) {
    const tax = read(principal);
    if (input.folderId && !tax.folders.some((f) => f.id === input.folderId))
      throw invalidTaxonomy("/folderId", "文件夹不存在");
    if (
      new Set(input.tagIds).size !== input.tagIds.length ||
      input.tagIds.some((id) => !tax.tags.some((t) => t.id === id))
    )
      throw invalidTaxonomy("/tagIds", "标签不存在或重复");
  }
  function update(principal, input) {
    const old = read(principal);
    if (input.baseVersion !== old.version)
      throw contractError(problems.versionConflict(old.version));
    const folders = input.folders.map((f) => ({ ...f, name: f.name.trim() }));
    const tags = input.tags.map((t) => ({ ...t, name: t.name.trim() }));
    const byId = new Map(folders.map((f) => [f.id, f]));
    const oldById = new Map(old.folders.map((f) => [f.id, f]));
    function ancestor(id, field) {
      const seen = new Set();
      while (id && !byId.has(id)) {
        if (seen.has(id) || !oldById.has(id))
          throw invalidTaxonomy(field, "父文件夹不存在");
        seen.add(id);
        id = oldById.get(id).parentId;
      }
      return id;
    }
    folders.forEach((f, i) => {
      f.parentId = ancestor(f.parentId, `/folders/${i}/parentId`);
    });
    for (const [group, items] of [
      ["folders", folders],
      ["tags", tags],
    ]) {
      const ids = new Set(),
        names = new Set();
      for (const [i, item] of items.entries()) {
        const name =
          (group === "folders" ? (item.parentId ?? "root") + ":" : "") +
          fold(item.name);
        if (!item.name || ids.has(item.id) || names.has(name))
          throw invalidTaxonomy(`/${group}/${i}`, "名称为空、同名或身份重复");
        ids.add(item.id);
        names.add(name);
        if (group === "folders") {
          let cursor = item,
            depth = 0;
          const seen = new Set();
          while (cursor) {
            if (seen.has(cursor.id) || ++depth > 10)
              throw invalidTaxonomy(
                `/folders/${i}/parentId`,
                "文件夹循环或超过十层",
              );
            seen.add(cursor.id);
            cursor = byId.get(cursor.parentId);
          }
        }
      }
    }
    const tagIds = new Set(tags.map((t) => t.id));
    for (const item of all(principal)) {
      const folderId = ancestor(item.folderId, "/folders");
      const nextTags = item.tagIds.filter((id) => tagIds.has(id));
      if (folderId !== item.folderId || nextTags.length !== item.tagIds.length)
        save(principal, {
          ...item,
          folderId,
          tagIds: nextTags,
          version: item.version + 1,
          updatedAt: now(),
        });
    }
    const result = { version: old.version + 1, folders, tags };
    put.run(principal.accountKey, JSON.stringify(result));
    return result;
  }
  return { read, readStored, update, validateLinks };
}
