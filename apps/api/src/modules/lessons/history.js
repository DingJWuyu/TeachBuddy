import { contractError, invalidInput, problems } from "../../workbench/problems.js";

// Full aggregates preserve the adopted content even when a source is removed.
// The caller's existing mutation transaction also commits the history snapshot.
export function createLessonHistory({ db, repository, requireLesson }) {
  const limit = 50;
  function snapshot(record) {
    return { record, sections: repository.listSections(record.id), references: repository.listReferences(record.id) };
  }
  function capture(record) {
    db.prepare("INSERT OR IGNORE INTO lesson_history VALUES (?, ?, ?, ?, ?, ?)")
      .run(record.id, record.accountKey, record.version, record.updatedAt, record.title, JSON.stringify(snapshot(record)));
    db.prepare(`DELETE FROM lesson_history WHERE lessonId=? AND version NOT IN
      (SELECT version FROM lesson_history WHERE lessonId=? ORDER BY version DESC LIMIT ?)`)
      .run(record.id, record.id, limit);
  }
  function list(principal, id) {
    const current = requireLesson(principal, id);
    const items = db.prepare("SELECT version, savedAt, title FROM lesson_history WHERE lessonId=? AND accountKey=? ORDER BY version DESC LIMIT ?")
      .all(id, current.accountKey, limit);
    if (!items.some(item => item.version === current.version))
      items.unshift({ version: current.version, savedAt: current.updatedAt, title: current.title });
    return { items: items.slice(0, limit), limit };
  }
  function get(principal, id, version) {
    const current = requireLesson(principal, id);
    if (!Number.isSafeInteger(version) || version < 1) throw invalidInput("/version", "out-of-range");
    if (current.version === version) return snapshot(current);
    const row = db.prepare("SELECT snapshot FROM lesson_history WHERE lessonId=? AND accountKey=? AND version=?")
      .get(id, current.accountKey, version);
    if (!row) throw contractError(problems.notFound());
    return JSON.parse(row.snapshot);
  }
  return { capture, list, get };
}
