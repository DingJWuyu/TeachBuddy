/**
 * Fixture lessons substitute: only the `readForTeachingLink` port T53 will add
 * to the real lessons module, plus a minimal fixture HTTP surface.
 */
import { Router } from 'express';
import { createFixtureStore, readBoolean, readString } from '../../lib/store.js';

export function createLessonsFixtureModule({ db }) {
  const store = createFixtureStore(db);
  const router = Router();

  router.get('/items', (req, res) => {
    const items = store.listLessons(req.workbenchPrincipal.accountKey).map((row) => ({
      id: row.id,
      version: row.version,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt
    }));
    res.json({ items });
  });

  router.post('/items', (req, res) => {
    const title = readString(req.body, 'title', '未命名备课');
    res.status(201).json(store.createLesson(req.workbenchPrincipal.accountKey, { title }));
  });

  router.post('/items/:id/deletion', (req, res) => {
    const deleted = readBoolean(req.body, 'deleted');
    res.json(store.setLessonDeleted(req.workbenchPrincipal.accountKey, req.params.id, deleted));
  });

  return {
    router,
    port: {
      readForTeachingLink: (principal, id) => store.readLessonReference(principal, id)
    }
  };
}
