import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { createMutationHandler, withPathId } from '../../../workbench/http.js';
import { contractError, invalidInput, problems } from '../../../workbench/problems.js';
import { contractSchemas, schema, validateBody, validateNoQuery } from '../../../workbench/schema.js';

export const migrations = [{
  id: 'schedule_reminders_0001_notifications',
  up(db) {
    db.exec(`CREATE TABLE schedule_notifications (
      id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, entryId TEXT NOT NULL,
      originDate TEXT NOT NULL, title TEXT NOT NULL, dueAt TEXT NOT NULL,
      readAt TEXT, dismissedAt TEXT,
      UNIQUE(accountKey, entryId, originDate)
    );`);
  }
}];

const action = schema.string({ enum: ['read', 'unread', 'dismiss'] });
const single = schema.object({ action });
const batch = schema.object({ ids: schema.array(contractSchemas.id), action });
function validateBatch(body) {
  validateBody(batch, body);
  if (!body.ids.length) throw invalidInput('/ids', 'out-of-range');
  const seen = new Set();
  body.ids.forEach((id, i) => {
    if (seen.has(id)) throw invalidInput(`/ids/${i}`, 'duplicate-id');
    seen.add(id);
  });
  return body;
}
export function projectNotification(row) {
  return {
    id: row.id, key: { entryId: row.entryId, originDate: row.originDate || null },
    title: row.title, dueAt: row.dueAt, readAt: row.readAt, dismissedAt: row.dismissedAt
  };
}

export function createReminders({ db, mutations, schedule, clock }) {
  if (!db || !mutations?.execute || !schedule?.listReminderCandidates || !clock?.now) {
    throw new TypeError('Reminders require database, mutations, schedule and clock.');
  }
  const insert = db.prepare(`INSERT INTO schedule_notifications
    (id, accountKey, entryId, originDate, title, dueAt) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(accountKey, entryId, originDate) DO NOTHING`);
  const find = db.prepare('SELECT * FROM schedule_notifications WHERE accountKey = ? AND id = ?');
  const list = db.prepare(`SELECT * FROM schedule_notifications
    WHERE accountKey = ? AND dismissedAt IS NULL ORDER BY dueAt DESC, id ASC`);
  const markRead = db.prepare('UPDATE schedule_notifications SET readAt = COALESCE(readAt, ?) WHERE accountKey = ? AND id = ?');
  const markUnread = db.prepare('UPDATE schedule_notifications SET readAt = NULL WHERE accountKey = ? AND id = ?');
  const dismiss = db.prepare('UPDATE schedule_notifications SET dismissedAt = COALESCE(dismissedAt, ?) WHERE accountKey = ? AND id = ?');
  function captureDue(principal, now) {
    for (const candidate of schedule.listReminderCandidates(principal, now)) {
      insert.run(randomUUID(), principal.accountKey, candidate.key.entryId,
        candidate.key.originDate ?? '', candidate.title, candidate.dueAt);
    }
  }
  const settleAndList = db.transaction((principal) => {
    captureDue(principal, clock.now());
    const items = list.all(principal.accountKey).map(projectNotification);
    return { items, unreadCount: items.filter(item => item.readAt === null).length };
  });
  function change(principal, ids, action) {
    const now = clock.now();
    captureDue(principal, now);
    for (const id of ids) {
      if (!find.get(principal.accountKey, id)) throw contractError(problems.notFound());
    }
    for (const id of ids) {
      if (action === 'unread') markUnread.run(principal.accountKey, id);
      else (action === 'read' ? markRead : dismiss).run(now, principal.accountKey, id);
    }
    return ids.map(id => projectNotification(find.get(principal.accountKey, id)));
  }
  const router = Router();
  router.get('/notifications', (req, res) => {
    validateNoQuery(req.query);
    res.json(settleAndList.immediate(req.workbenchPrincipal));
  });
  router.post('/notifications/:id', createMutationHandler({
    mutations, method: 'POST', validate: withPathId(body => validateBody(single, body)),
    write: ({ principal, body, request }) => ({
      status: 200, body: change(principal, [request.params.id], body.action)[0]
    })
  }));
  router.post('/notification-actions', createMutationHandler({
    mutations, method: 'POST', validate: validateBatch,
    write: ({ principal, body }) => ({ status: 200, body: { items: change(principal, body.ids, body.action) } })
  }));
  return {
    router,
    captureDue,

  };
}
