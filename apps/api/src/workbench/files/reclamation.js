// File ownership is decided from module-owned snapshots supplied by composition.
// This module knows only managed storage and its preview/recognition/job edges.
function referencedFileIds(value, result = new Set()) {
  if (typeof value === 'string') result.add(value);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) referencedFileIds(child, result);
  return result;
}

export function createFileReclamation({ db, files, jobs, recognition, retainedValues, waitForReaders }) {
  function graph(principal) {
    const account = principal.accountKey;
    const records = db.prepare('SELECT * FROM materials_files WHERE accountKey=?').all(account);
    const ids = new Set(records.map(row => row.id));
    const edges = new Map(records.map(row => [row.id, new Set()]));
    function connect(source, value) {
      const targets = edges.get(source);
      if (targets) for (const id of referencedFileIds(value)) if (ids.has(id)) targets.add(id);
    }
    for (const table of ['materials_previews', 'materials_renditions'])
      for (const row of db.prepare(`SELECT fileId,value FROM ${table} WHERE accountKey=?`).all(account)) connect(row.fileId, JSON.parse(row.value));
    for (const job of jobs.list(principal).items)
      if (job.target.kind === 'file') connect(job.target.id, job.outputFileIds);
    // Preview conversion may have committed bytes before its final mapping.
    for (const row of db.prepare("SELECT path,body FROM workbench_mutation_keys WHERE accountKey=? AND path LIKE '/internal/previews/%'").all(account))
      connect(row.path.split('/').at(-1), JSON.parse(row.body));
    for (const [hash, value] of recognition.fileRetention(principal)) {
      const outputIds = [...referencedFileIds(value)].filter(id => ids.has(id));
      edges.set(value.resultId, new Set(outputIds));
      for (const id of outputIds) connect(id, outputIds);
      for (const row of records) if (row.sha256 === hash) connect(row.id, value);
    }
    return { records, edges };
  }
  function closure(roots, edges) {
    const found = new Set(roots), pending = [...found];
    for (const id of pending) for (const child of edges.get(id) ?? [])
      if (!found.has(child)) { found.add(child); pending.push(child); }
    return found;
  }
  function candidates(principal, roots, ownRetained) {
    const { records, edges } = graph(principal);
    const possible = closure(roots, edges);
    const retained = referencedFileIds([retainedValues(principal), ownRetained, jobs.list(principal).items.filter(job => job.target.kind !== 'file')]);
    // An unrelated retained original owns its whole preview/recognition graph.
    for (const row of records) if (!possible.has(row.id)) retained.add(row.id);
    const keep = closure(retained, edges);
    return records.filter(row => possible.has(row.id) && !keep.has(row.id)).map(row => row.id);
  }
  return {
    reserve(principal, ownerId, roots, ownRetained) {
      const ids = candidates(principal, roots, ownRetained);
      for (const id of ids) db.prepare('INSERT OR IGNORE INTO materials_file_reclamation VALUES (?,?,?)').run(id, principal.accountKey, ownerId);
      return ids;
    },
    async settle(principal, ids) {
      await waitForReaders(principal);
      await jobs.cancelFilesAndWait(principal, ids);
      await files.settleFileConversions(principal, ids);
      await recognition.settleFiles(principal, ids);
    },
    finish(principal, ownerId, roots, ownRetained) {
      // A stopped conversion may have left additional immutable output bytes.
      const ids = candidates(principal, roots, ownRetained);
      this.reserve(principal, ownerId, roots, ownRetained);
      files.removeBlobs(principal, ids);
      recognition.removeFiles(principal, ids);
      jobs.removeFiles(principal, ids);
      for (const id of ids) {
        for (const table of ['materials_previews', 'materials_renditions'])
          db.prepare(`DELETE FROM ${table} WHERE accountKey=? AND fileId=?`).run(principal.accountKey, id);
        db.prepare('DELETE FROM materials_files WHERE accountKey=? AND id=?').run(principal.accountKey, id);
      }
      db.prepare('DELETE FROM materials_file_reclamation WHERE accountKey=? AND ownerId=?').run(principal.accountKey, ownerId);
      return ids;
    },
  };
}
