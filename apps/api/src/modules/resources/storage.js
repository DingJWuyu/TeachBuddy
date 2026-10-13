import { storageError } from '../../workbench/files/index.js';
import { invalidInput } from '../../workbench/problems.js';

// Resource-owned durable intent. Acceptance and completion are separate facts;
// the public operation reports completion only after physical reclamation.
export function createResourceStorage({ db, mutations, reclamation, history, textSearch, current, all }) {
  const inFlight = new Map();
  const pending = (principal, id) => db.prepare("SELECT 1 FROM resource_purges WHERE accountKey=? AND id=? AND completed=0").get(principal.accountKey, id);
  function retained(principal, id) {
    return [all(principal).filter(item => item.id !== id), history.readForExport(principal).filter(row => row.resourceId !== id)];
  }
  async function finish(principal, id) {
    const identity = `${principal.accountKey}/${id}`;
    if (inFlight.has(identity)) return inFlight.get(identity);
    const work = (async () => {
      const row = db.prepare('SELECT * FROM resource_purges WHERE accountKey=? AND id=?').get(principal.accountKey, id);
      if (!row) throw storageError();
      if (!row.completed) {
        const roots = JSON.parse(row.roots);
        await reclamation.settle(principal, []);
        let settled = new Set();
        while (true) {
          const ids = db.transaction(() => reclamation.reserve(principal, id, roots, retained(principal, id)))();
          const added = ids.filter(id => !settled.has(id));
          if (!added.length) break;
          await reclamation.settle(principal, added);
          await textSearch.settle(principal, added);
          settled = new Set([...settled, ...added]);
        }
        mutations.assertAccountActive(principal);
        // All producers are stopped. No await between checking remaining owners,
        // unlinking bytes and committing completion. A crash leaves this intent.
        db.transaction(() => {
          const removed = reclamation.finish(principal, id, roots, retained(principal, id));
          for (const fileId of removed) db.prepare('DELETE FROM resource_text_cache WHERE accountKey=? AND fileId=?').run(principal.accountKey, fileId);
          history.remove(principal, id);
          db.prepare('DELETE FROM resource_items WHERE accountKey=? AND id=?').run(principal.accountKey, id);
          db.prepare('UPDATE resource_purges SET roots=NULL,completed=1 WHERE accountKey=? AND id=?').run(principal.accountKey, id);
        })();
      }
      return { status: 200, body: { id, permanentlyDeleted: true } };
    })();
    inFlight.set(identity, work);
    try { return await work; } finally { inFlight.delete(identity); }
  }
  return {
    assertExportable(principal) {
      if (db.prepare('SELECT 1 FROM resource_purges WHERE accountKey=? AND completed=0 LIMIT 1').get(principal.accountKey)) throw storageError();
    },
    assertEditable(principal, id) { if (pending(principal, id)) throw storageError(); },
    async purge({ principal, id, input, key }) {
      const accepted = mutations.execute({ principal, key, method: 'POST', path: `/api/modules/resources/items/${id}/purge`, body: input }, () => {
        const item = current(principal, id, input, true);
        if (!item.deletedAt) throw invalidInput('/id', 'invalid-reference');
        const roots = [...new Set([item, ...history.list(principal, item)].flatMap(item => [item.fileId, item.supplementPreviewFileId]).filter(Boolean))];
        db.prepare('INSERT INTO resource_purges VALUES (?,?,?,0)').run(id, principal.accountKey, JSON.stringify(roots));
        reclamation.reserve(principal, id, roots, retained(principal, id));
        return { status: 202, body: { id, pending: true } };
      });
      // A pre-reclamation product version may already have a final receipt.
      if (accepted.status === 200) return accepted;
      return finish(principal, id);
    },
    async resume() {
      for (const row of db.prepare('SELECT id,accountKey FROM resource_purges WHERE completed=0').all()) {
        try { await finish({ accountKey: row.accountKey }, row.id); }
        catch { /* Keep the locked intent; its original HTTP request can retry. */ }
      }
    },
  };
}

// Offline inspection stays with the storage owner. The coordinator visits the
// values inside the same stopped-instance database snapshot as every module.
export function inspectResourceStorage(db, visit) {
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='resource_purges'").get() &&
      db.prepare('SELECT 1 FROM resource_purges WHERE completed=0 LIMIT 1').get())
    throw new Error('Resource file reclamation is incomplete');
  for (const table of ['resource_items', 'resource_file_history']) {
    if (!db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)) continue;
    for (const row of db.prepare(`SELECT accountKey,value FROM ${table}`).all()) visit(JSON.parse(row.value), row.accountKey);
  }
}

export function resourceBackupOwner(db, id) {
  const current = db.prepare('SELECT accountKey FROM resource_items WHERE id=?').get(id);
  if (current || !db.prepare("SELECT 1 FROM sqlite_master WHERE name='resource_purges'").get()) return current;
  // Existing classroom links may point to a permanently removed resource.
  // The completed receipt still proves its account without retaining content.
  return db.prepare('SELECT accountKey FROM resource_purges WHERE id=? AND completed=1').get(id);
}
