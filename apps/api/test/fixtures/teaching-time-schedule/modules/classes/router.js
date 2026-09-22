/**
 * Fixture-only HTTP surface for the classes substitute.
 *
 * This is not the T51 contract: it exists so the isolated T52 suites and the
 * browser harness can create, delete and list the class/record stand-ins the
 * schedule ports read. Field shapes are deliberately minimal.
 */
import { Router } from 'express';
import { createFixtureStore, readBoolean, readString } from '../../lib/store.js';

export function createClassesFixtureRouter({ store }) {
  const router = Router();

  router.get('/items', (req, res) => {
    const items = store.listClasses(req.workbenchPrincipal.accountKey).map((row) => ({
      id: row.id,
      version: row.version,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt
    }));
    res.json({ items });
  });

  router.post('/items', (req, res) => {
    const name = readString(req.body, 'name', '未命名班级');
    const row = store.createClass(req.workbenchPrincipal.accountKey, { name });
    res.status(201).json(row);
  });

  router.post('/items/:id/deletion', (req, res) => {
    const deleted = readBoolean(req.body, 'deleted');
    res.json(store.setClassDeleted(req.workbenchPrincipal.accountKey, req.params.id, deleted));
  });

  router.get('/records', (req, res) => {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : null;
    const items = store.listRecords(req.workbenchPrincipal.accountKey, classId);
    res.json({ items });
  });

  router.post('/records', (req, res) => {
    const row = store.createRecord(req.workbenchPrincipal.accountKey, {
      classId: readString(req.body, 'classId'),
      recordedOn: readString(req.body, 'recordedOn'),
      note: readString(req.body, 'note'),
      position: readString(req.body, 'position'),
      unfinished: readString(req.body, 'unfinished'),
      commonIssues: readString(req.body, 'commonIssues'),
      nextNote: readString(req.body, 'nextNote')
    });
    res.status(201).json(row);
  });

  router.post('/records/:id/deletion', (req, res) => {
    const deleted = readBoolean(req.body, 'deleted');
    res.json(store.setRecordDeleted(req.workbenchPrincipal.accountKey, req.params.id, deleted));
  });

  return router;
}

export function createClassesFixtureModule({ db }) {
  const store = createFixtureStore(db);
  return {
    router: createClassesFixtureRouter({ store }),
    port: {
      readClass: (principal, id) => store.readClassReference(principal, id),
      readRecord: (principal, id) => store.readRecordReference(principal, id),
      listSourceRecords: () => ({ items: [] })
    },
    store
  };
}
