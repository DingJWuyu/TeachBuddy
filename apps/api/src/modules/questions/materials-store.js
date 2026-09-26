import { documentText, images } from "./materials-content.js";
import { randomUUID } from "node:crypto";
import { notFound, versionConflict, objectDeleted } from "./contract.js";
export const materialsMigrations = [
  {
    id: "questions_materials_001",
    up(db) {
      db.exec(`
CREATE TABLE questions_materials_meta (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
CREATE TABLE questions_materials_imports (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
CREATE TABLE questions_materials_taxonomy (accountKey TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE questions_materials_tasks (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
`);
    },
  },
];
export function createMaterialsStore(db, repository, now = () => new Date()) {
  const stamp = () => now().toISOString();
  const tables = {
    imports: "questions_materials_imports",
    tasks: "questions_materials_tasks",
    meta: "questions_materials_meta",
  };
  const get = (kind, p, id) => {
    const row = db
      .prepare(`SELECT value FROM ${tables[kind]} WHERE id=? AND accountKey=?`)
      .get(id, p.accountKey);
    if (!row) throw notFound();
    return JSON.parse(row.value);
  };
  const save = (kind, p, value) => {
    db.prepare(
      `INSERT INTO ${tables[kind]} VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE accountKey=excluded.accountKey`,
    ).run(value.id, p.accountKey, JSON.stringify(value));
    return value;
  };
  const list = (kind, p) =>
    db
      .prepare(`SELECT value FROM ${tables[kind]} WHERE accountKey=?`)
      .all(p.accountKey)
      .map((r) => JSON.parse(r.value));
  function question(p, id) {
    const q = repository.getForAccount(p.accountKey, id);
    if (!q) throw notFound();
    let meta;
    try {
      meta = get("meta", p, id);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const { accountKey, sourceQuestionId, ...value } = q;
    return {
      ...value,
      source:
        value.source.kind === "copy"
          ? {
              ...value.source,
              snapshot: {
                ...value.source.snapshot,
                answerStatus:
                  value.source.snapshot.answerStatus ??
                  (documentText(value.source.snapshot.solution).trim() ||
                  images(value.source.snapshot.solution).length
                    ? "present"
                    : "absent"),
              },
            }
          : value.source,
      answerStatus:
        documentText(q.solution).trim() || images(q.solution).length
          ? "present"
          : "absent",
      typeId: meta?.typeId ?? null,
      tagIds: meta?.tagIds ?? [],
    };
  }
  function writeQuestion(p, q) {
    const record = {
      ...q,
      accountKey: p.accountKey,
      sourceQuestionId: q.source.kind === "copy" ? q.source.questionId : null,
    };
    if (repository.getForAccount(p.accountKey, q.id)) repository.update(record);
    else repository.insert(record);
    save("meta", p, {
      id: q.id,
      answerStatus: q.answerStatus,
      typeId: q.typeId,
      tagIds: q.tagIds,
    });
    return q;
  }
  const taxonomy = (p) => {
    const row = db
      .prepare(
        "SELECT value FROM questions_materials_taxonomy WHERE accountKey=?",
      )
      .get(p.accountKey);
    return row ? JSON.parse(row.value) : { version: 1, types: [], tags: [] };
  };
  return {
    db,
    get,
    save,
    list,
    question,
    writeQuestion,
    purgeQuestion(p, id) {
      repository.removeForAccount(p.accountKey, id);
      db.prepare('DELETE FROM questions_materials_meta WHERE accountKey=? AND id=?').run(p.accountKey, id);
      db.prepare("DELETE FROM questions_materials_tasks WHERE accountKey=? AND json_extract(value, '$.question.id')=?").run(p.accountKey, id);
    },
    purgeImport(p, id) {
      db.prepare('DELETE FROM questions_materials_imports WHERE accountKey=? AND id=?').run(p.accountKey, id);
      db.prepare("DELETE FROM questions_materials_tasks WHERE accountKey=? AND json_extract(value, '$.importId')=?").run(p.accountKey, id);
    },
    taxonomy,
    stamp,
    questions: (p) =>
      repository.listForAccount(p.accountKey).map((q) => question(p, q.id)),
    saveTaxonomy(p, v) {
      db.prepare(
        "INSERT INTO questions_materials_taxonomy VALUES (?,?) ON CONFLICT(accountKey) DO UPDATE SET value=excluded.value",
      ).run(p.accountKey, JSON.stringify(v));
      return v;
    },
    fresh: () => ({
      id: randomUUID(),
      version: 1,
      createdAt: stamp(),
      updatedAt: stamp(),
      deletedAt: null,
    }),
    bump: (q) => ({ ...q, version: q.version + 1, updatedAt: stamp() }),
    check(q, base, active = true) {
      if (q.version !== base) throw versionConflict(q.version);
      if (active && q.deletedAt) throw objectDeleted();
    },
  };
}
