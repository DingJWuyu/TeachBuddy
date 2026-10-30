/**
 * Atomic idempotent mutations.
 *
 * One logical write = one transaction: the business change and the confirmed
 * request record commit together or not at all. A module's `write` callback
 * runs inside that transaction, must be synchronous, and returns
 * `{status, body}` (or throws an Error carrying `status` + `problem`, which is
 * propagated unchanged).
 *
 * Scope is the verified account. A key binds the HTTP method, the concrete
 * request path and the parsed JSON body (object key order is irrelevant, array
 * order is not). The first successful result is replayed for the same key and
 * request, across process restarts; the same key with a different request is a
 * contract 409. A failed transaction records nothing, so the same key can be
 * retried. There is no TTL: records live until the account's data is cleared.
 */
import crypto from 'node:crypto';
import { contractError, problems } from './problems.js';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  return value;
}

export function requestFingerprint({ method, path, body }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ method, path, body: canonicalize(body ?? null) }))
    .digest('hex');
}

export function createMutations({ db, clock = () => new Date(), assertAccountActive = () => {} }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workbench_mutation_keys (
      accountKey TEXT NOT NULL,
      key TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      requestHash TEXT NOT NULL,
      status INTEGER NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      PRIMARY KEY (accountKey, key)
    );
  `);

  const selectStatement = db.prepare(
    'SELECT method, path, requestHash, status, body FROM workbench_mutation_keys WHERE accountKey = ? AND key = ?'
  );
  const insertStatement = db.prepare(`
    INSERT INTO workbench_mutation_keys (accountKey, key, method, path, requestHash, status, body, createdAt)
    VALUES (@accountKey, @key, @method, @path, @requestHash, @status, @body, @createdAt)
  `);
  const countStatement = db.prepare(
    'SELECT COUNT(*) AS count FROM workbench_mutation_keys WHERE accountKey = ?'
  );

  function checkedRequest({ principal, key, method, path, body }) {
    const accountKey = principal?.accountKey;
    if (typeof accountKey !== 'string' || !accountKey) {
      throw new Error('mutations.execute requires a verified principal.');
    }
    if (typeof key !== 'string' || !key) {
      throw new Error('mutations.execute requires an idempotency key.');
    }
    if (typeof method !== 'string' || !method || typeof path !== 'string' || !path) {
      throw new Error('mutations.execute requires the request method and path.');
    }
    const requestHash = requestFingerprint({ method, path, body });
    assertAccountActive(principal);
    return { accountKey, key, method, path, requestHash };
  }

  function confirmedResponse({ accountKey, key, method, path, requestHash }) {
    const existing = selectStatement.get(accountKey, key);
    if (existing) {
      if (existing.method !== method || existing.path !== path || existing.requestHash !== requestHash) {
        throw contractError(problems.idempotencyKeyReused());
      }
      return { status: existing.status, body: JSON.parse(existing.body) };
    }
    return null;
  }

  // Async preparation (for example reading an uploaded workbook) can replay a
  // completed write before opening its inputs. A miss does not reserve the key;
  // execute still checks the receipt and account again after preparation.
  function peek(request) {
    return confirmedResponse(checkedRequest(request));
  }

  function execute(request, write) {
    const checked = checkedRequest(request);
    if (typeof write !== 'function') {
      throw new Error('mutations.execute requires a write callback.');
    }
    // Lookup and write run in one synchronous call, so a concurrent request with the same key sees the committed receipt and replays it.
    const existing = confirmedResponse(checked);
    if (existing) return existing;
    const { principal } = request;
    const { accountKey, key, method, path, requestHash } = checked;

    const transaction = db.transaction(() => {
      assertAccountActive(principal);
      const result = write();
      if (result && typeof result.then === 'function') {
        throw new Error('A workbench write callback must be synchronous.');
      }
      const status = result?.status;
      const responseBody = result?.body;
      if (!Number.isInteger(status) || status < 200 || status > 299) {
        throw new Error('A workbench write callback must return a 2xx {status, body}.');
      }
      insertStatement.run({
        accountKey,
        key,
        method,
        path,
        requestHash,
        status,
        body: JSON.stringify(responseBody ?? null),
        createdAt: clock().toISOString()
      });
      return { status, body: responseBody };
    });

    return transaction.immediate();
  }

  return {
    execute,
    peek,
    assertAccountActive,

    /** Test/diagnostic helper: number of confirmed requests for one account. */
    count(accountKey) {
      return countStatement.get(accountKey).count;
    }
  };
}
