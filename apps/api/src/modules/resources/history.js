/** File revisions belong to the resource; file bytes retain their existing lifetime. */
export function createResourceHistory(db, files) {
  const rows = db.prepare(
    "SELECT value FROM resource_file_history WHERE accountKey=? AND resourceId=? ORDER BY version DESC",
  );
  const insert = db.prepare(
    "INSERT OR IGNORE INTO resource_file_history VALUES (?, ?, ?, ?)",
  );
  function capture(principal, item) {
    insert.run(
      principal.accountKey,
      item.id,
      item.version,
      JSON.stringify({
        version: item.version,
        createdAt: item.updatedAt,
        fileId: item.fileId,
        supplementPreviewFileId: item.supplementPreviewFileId,
      }),
    );
  }
  function list(principal, item) {
    const saved = rows
      .all(principal.accountKey, item.id)
      .map((row) => JSON.parse(row.value));
    return saved.length
      ? saved
      : [
          {
            version: item.version,
            createdAt: item.updatedAt,
            fileId: item.fileId,
            supplementPreviewFileId: item.supplementPreviewFileId,
          },
        ];
  }
  function describe(principal, item) {
    return {
      items: list(principal, item).map((entry) => {
        try {
          return {
            ...entry,
            file: files.read(principal, entry.fileId),
            unavailable: false,
          };
        } catch (error) {
          if (error.status !== 503 && error.status !== 404) throw error;
          return { ...entry, file: null, unavailable: true };
        }
      }),
    };
  }
  return {
    readForExport(principal) {
      return db.prepare("SELECT resourceId,value FROM resource_file_history WHERE accountKey=?")
        .all(principal.accountKey)
        .map(row => ({ resourceId: row.resourceId, revision: JSON.parse(row.value) }));
    },
    capture,
    list,
    describe,
    remove(principal, id) {
      db.prepare(
        "DELETE FROM resource_file_history WHERE accountKey=? AND resourceId=?",
      ).run(principal.accountKey, id);
    },
  };
}
