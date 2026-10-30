const columns = {
  classes: ['deletedAt'],
  students: ['classId', 'studentNumber', 'deletedAt'],
  records: ['scope', 'subjectId', 'occurredOn', 'deletedAt'],
  exams: ['occurredOn', 'deletedAt'],
  results: ['examId', 'classId', 'deletedAt'],
  imports: ['examId', 'classId', 'state', 'deletedAt'],
  tags: ['normalizedName', 'mergedIntoId']
};
export const kinds = Object.keys(columns);
export function createClassroomRepository(db) {
  const statements = Object.fromEntries(kinds.map(kind => {
    const fields = ['accountKey', 'id', 'version', 'value', ...columns[kind]];
    return [kind, {
      get: db.prepare(`SELECT value FROM classroom_${kind} WHERE accountKey=? AND id=?`),
      list: db.prepare(`SELECT value FROM classroom_${kind} WHERE accountKey=? ORDER BY id`),
      write: db.prepare(`INSERT INTO classroom_${kind} (${fields.join(',')}) VALUES (${fields.map(x => '@' + x).join(',')}) ON CONFLICT(accountKey,id) DO UPDATE SET ${fields.slice(2).map(x => `${x}=excluded.${x}`).join(',')}`)
    }];
  }));
  return {
    // Statistics read all facts inside one transaction so a concurrent re-import cannot mix old and new results in one response.
    snapshot(read) {
      return db.transaction(read)();
    },
    get(kind, accountKey, id) {
      const row = statements[kind].get.get(accountKey, id);
      return row ? JSON.parse(row.value) : null;
    },
    list(kind, accountKey) {
      return statements[kind].list.all(accountKey).map(row => JSON.parse(row.value));
    },
    write(kind, accountKey, value) {
      const row = {
        accountKey,
        id: value.id,
        version: value.version,
        value: JSON.stringify(value)
      };
      for (const field of columns[kind]) {
        row[field] = value[field] ?? null;
      }
      statements[kind].write.run(row);
      return value;
    }
  };
}
