/**
 * B12 test fixture module.
 *
 * This is not a product module: it is a test-process fixture mounted only by
 * the isolated runner / API tests with an explicit catalog override, and it is
 * never part of `@refatos/shared`'s catalog or the production build. It
 * implements the frozen module seam (`create<Id>Module({db, mutations})` ->
 * `{router, port}`) so B12 can prove identity, idempotency, transaction
 * rollback and account isolation end to end before B13 lands.
 */
import express from 'express';
import crypto from 'node:crypto';
import { schema } from '../../../../../src/workbench/schema.js';
import { createMutationHandler } from '../../../../../src/workbench/http.js';
import { contractError, problems } from '../../../../../src/workbench/problems.js';

const createBody = schema.object([
  ['value', schema.string({ minLength: 1, maxLength: 200 })]
]);

function notFound() {
  return contractError(problems.notFound());
}

function itemRow(accountKey, value) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    accountKey,
    version: 1,
    value,
    createdAt: now,
    updatedAt: now
  };
}

export function createWorkbenchProbeModule({ db, mutations }) {
  const insert = db.prepare(`
    INSERT INTO workbench_probe_items (id, accountKey, version, value, createdAt, updatedAt)
    VALUES (@id, @accountKey, @version, @value, @createdAt, @updatedAt)
  `);
  const selectOne = db.prepare(
    'SELECT id, version, value, createdAt, updatedAt FROM workbench_probe_items WHERE id = ? AND accountKey = ?'
  );
  const selectAll = db.prepare(
    'SELECT id, version, value, createdAt, updatedAt FROM workbench_probe_items WHERE accountKey = ? ORDER BY id'
  );

  const router = express.Router();

  router.post('/items', createMutationHandler({
    mutations,
    bodySchema: createBody,
    method: 'POST',
    write({ principal, body }) {
      const item = itemRow(principal.accountKey, body.value);
      insert.run(item);
      return { status: 201, body: { id: item.id, version: item.version, value: item.value } };
    }
  }));

  router.get('/items', (req, res) => {
    res.json({ items: selectAll.all(req.workbenchPrincipal.accountKey) });
  });

  router.get('/items/:id', (req, res) => {
    const item = selectOne.get(req.params.id, req.workbenchPrincipal.accountKey);
    if (!item) throw notFound();
    res.json(item);
  });

  // Writes one row and then fails inside the same transaction: proves the
  // ledger and the business row roll back together and that the key stays
  // retryable.
  router.post('/items/:id/fail', createMutationHandler({
    mutations,
    bodySchema: createBody,
    method: 'POST',
    write({ principal, body }) {
      insert.run(itemRow(principal.accountKey, body.value));
      throw contractError(problems.temporarilyUnavailable());
    }
  }));

  // Writes one row and then raises an unknown storage failure: the write layer
  // must roll back and map it to the contract 503 without leaking details.
  router.post('/items/:id/explode', createMutationHandler({
    mutations,
    bodySchema: createBody,
    method: 'POST',
    write({ principal, body }) {
      insert.run(itemRow(principal.accountKey, body.value));
      throw new Error('simulated unknown storage failure');
    }
  }));

  return {
    router,
    port: {
      readProbe(principal, id) {
        const item = selectOne.get(id, principal?.accountKey);
        if (!item) throw notFound();
        return item;
      }
    }
  };
}
