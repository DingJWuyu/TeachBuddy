import { createMutationHandler } from '../../workbench/http.js';
import { validateNoQuery } from '../../workbench/schema.js';
import { validate } from '../../workbench/content/mathSchema.js';
import { contractError, invalidInput, problems } from '../../workbench/problems.js';

// Ordering is an account preference, separate from manuscript revisions.
export function createLessonOrder({ db, repository, mutations }) {
  const read = db.prepare('SELECT version, lessonIds FROM lesson_order WHERE accountKey = ?');
  const write = db.prepare('INSERT INTO lesson_order(accountKey, version, lessonIds) VALUES (?, ?, ?) ON CONFLICT(accountKey) DO UPDATE SET version = excluded.version, lessonIds = excluded.lessonIds');
  function account(principal) {
    if (!principal?.accountKey) throw contractError(problems.unauthenticated());
    return principal.accountKey;
  }
  function get(principal) {
    const key = account(principal);
    const saved = read.get(key);
    const rows = repository.listLessonsForAccount(key);
    const existing = new Set(rows.map(row => row.id));
    const prior = saved ? JSON.parse(saved.lessonIds).filter(id => existing.has(id)) : [];
    const known = new Set(prior);
    return { version: saved?.version ?? 0, lessonIds: [...rows.filter(row => !known.has(row.id)).map(row => row.id), ...prior] };
  }
  function sort(principal, rows) {
    const positions = new Map(get(principal).lessonIds.map((id, index) => [id, index]));
    return rows.sort((a, b) => positions.get(a.id) - positions.get(b.id));
  }
  function mount(router) {
    router.get('/order', (req, res) => {
      validateNoQuery(req.query);
      res.json(get(req.workbenchPrincipal));
    });
    router.put('/order', createMutationHandler({
      mutations, method: 'PUT',
      validate(body, req) {
        validateNoQuery(req.query);
        return validate('UpdateLessonOrder', body);
      },
      write({ principal, body }) {
        const current = get(principal);
        if (body.baseVersion !== current.version) throw contractError(problems.versionConflict(current.version));
        const ids = new Set(current.lessonIds);
        if (body.lessonIds.length !== ids.size || body.lessonIds.some(id => !ids.has(id))) throw invalidInput('/lessonIds', 'invalid-reference');
        const result = { version: current.version + 1, lessonIds: body.lessonIds };
        write.run(account(principal), result.version, JSON.stringify(result.lessonIds));
        return { status: 200, body: result };
      },
    }));
  }
  return { sort, mount };
}
