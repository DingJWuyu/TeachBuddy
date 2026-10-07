import { randomUUID } from "node:crypto";
import { validateSchema } from "../content/schema.js";
import { contractError, problems, invalidInput } from "../problems.js";
export const jobKinds = ["preview", "extraction", "export", "question-asset", "recognition"];
const active = new Set(["queued", "running", "cancelling"]);
export function materialsError(type, status = 422, field = "", detail = "") {
  return Object.assign(new Error(type), {
    status,
    problem: { type: `/problems/materials/${type}`, field, detail },
  });
}
export function createJobs({ db, mutations, files, clock = () => new Date(), logger, isAccountActive = () => true }) {
  let handlers,
    executing = false,
    closed = false,
    controller;
  const stamp = () => clock().toISOString();
  function save(principal, job) {
    validateSchema("Job", job);
    if (
      job.progress.total !== null &&
      job.progress.completed > job.progress.total
    )
      throw new Error("Invalid job progress");
    db.prepare(
      "INSERT INTO materials_jobs VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    ).run(job.id, principal.accountKey, JSON.stringify(job));
    return job;
  }
  function get(principal, id) {
    validateSchema("Id", id, "/path/id");
    const row = db
      .prepare("SELECT value FROM materials_jobs WHERE id=? AND accountKey=?")
      .get(id, principal.accountKey);
    if (!row) throw contractError(problems.notFound());
    return JSON.parse(row.value);
  }
  function list(principal, kind) {
    if (kind !== undefined && !jobKinds.includes(kind))
      throw invalidInput("/query/kind", "out-of-range");
    return {
      items: db
        .prepare(
          "SELECT value FROM materials_jobs WHERE accountKey=? ORDER BY rowid DESC",
        )
        .all(principal.accountKey)
        .map((r) => JSON.parse(r.value))
        .filter((j) => !kind || j.kind === kind),
    };
  }
  function enqueue({ principal, kind, target }, mutation) {
    if (closed) throw materialsError('job-running', 409);
    if (!db.inTransaction)
      throw new Error("jobs.enqueue requires the accepting transaction");
    const job = save(principal, {
      id: randomUUID(),
      kind,
      target,
      state: "queued",
      createdAt: stamp(),
      updatedAt: stamp(),
      attemptOf: mutation?.attemptOf ?? null,
      progress: {
        completed: 0,
        total: null,
        unit: ["preview", "recognition"].includes(kind) ? "pages" : "stages",
      },
      outputFileIds: [],
      issues: [],
    });
    setImmediate(() =>
      pump().catch((error) =>
        logger?.error("materials job persistence failed", error),
      ),
    );
    return job;
  }
  function cancel(principal, id, mutation) {
    const result = mutations.execute(
      { principal, ...mutation, body: {} },
      () => {
        const job = get(principal, id);
        if (active.has(job.state)) {
          job.state = "cancelling";
          job.updatedAt = stamp();
          save(principal, job);
        }
        return { status: 200, body: job };
      },
    );
    if (controller?.id === id) controller.abort.abort();
    setImmediate(() =>
      pump().catch((error) =>
        logger?.error("materials job persistence failed", error),
      ),
    );
    return result.body;
  }
  function retry(principal, id, input, mutation) {
    validateSchema("RetryJob", input);
    return mutations.execute({ principal, ...mutation, body: input }, () => {
      const job = get(principal, id);
      if (
        !["preview", "extraction", "recognition"].includes(job.kind) ||
        !["partial", "failed", "interrupted", "cancelled"].includes(job.state)
      )
        throw materialsError("job-not-retryable", 409);
      if (
        new Set(input.unitIds).size !== input.unitIds.length ||
        input.unitIds.some((id) => !job.issues.some((i) => i.unitId === id))
      )
        throw invalidInput("/unitIds", "out-of-range");
      const next = handlers[job.kind].retry({
        principal,
        job,
        unitIds: input.unitIds,
        mutation: { ...mutation, attemptOf: job.id },
      });
      if (next?.then) throw new Error("Job retry must be synchronous");
      next.attemptOf = job.id;
      save(principal, next);
      return { status: 202, body: next };
    }).body;
  }
  async function pump() {
    if (!handlers || executing || closed) return;
    executing = true;
    try {
      while (!closed) {
        const row = db
          .prepare(
            "SELECT * FROM materials_jobs WHERE json_extract(value, '$.state') IN ('queued','cancelling') ORDER BY rowid LIMIT 1",
          )
          .get();
        if (!row) break;
        const principal = { accountKey: row.accountKey };
        let job = JSON.parse(row.value);
        if (job.state === "cancelling" || !isAccountActive(row.accountKey)) {
          save(principal, { ...job, state: "cancelled", updatedAt: stamp() });
          continue;
        }
        job = save(principal, { ...job, state: "running", updatedAt: stamp() });
        const abort = new AbortController();
        let settle;
        const done = new Promise(resolve => { settle = resolve; });
        controller = { id: job.id, accountKey: row.accountKey, abort, done, settle };
        let result, cleanupFailed = false;
        try {
          result = await handlers[job.kind].run({
            principal,
            job,
            signal: abort.signal,
            reportProgress(progress) {
              if (closed) return;
              const current = get(principal, job.id);
              if (current.state === "running")
                save(principal, { ...current, progress, updatedAt: stamp() });
            },
          });
          if (!["succeeded", "partial", "failed"].includes(result?.state))
            throw new Error("Invalid handler result");
          result = {
            state: result.state,
            outputFileIds: result.outputFileIds,
            issues: result.issues,
          };
          for (const id of result.outputFileIds) files.read(principal, id);
          validateSchema("Job", { ...job, ...result });
        } catch (error) {
          cleanupFailed = error?.code === 'recognition-cleanup';
          result = {
            state: "failed",
            outputFileIds: [],
            issues: [
              {
                code: "conversion-failed",
                unitId: null,
                field: null,
                detail: cleanupFailed ? "尚未确认识别进程停止，请稍后重试。" : "任务未完成，原件仍保留。",
              },
            ],
          };
        }
        if (closed) {
          // Persist the handler's evidence before releasing close's waiter.
          // A shutdown interrupts this attempt; it never turns it successful.
          const current = get(principal, job.id);
          save(principal, { ...current, ...result, state: cleanupFailed ? 'failed' : 'interrupted', updatedAt: stamp(),
            issues: [...result.issues, { code: 'interrupted', unitId: null, field: null, detail: '服务关闭，未自动重发。' }].slice(-500) });
          controller.settle(); controller = undefined;
          break;
        }
        const current = get(principal, job.id);
        save(principal, {
          ...current,
          ...result,
          state: current.state === "cancelling" && !cleanupFailed ? "cancelled" : result.state,
          updatedAt: stamp(),
        });
        controller.settle();
        controller = undefined;
      }
    } finally {
      controller?.settle();
      executing = false;
    }
  }
  function start(bindings) {
    if (handlers) throw new Error("jobs.start can only run once");
    for (const kind of jobKinds)
      if (
        typeof bindings[kind]?.run !== "function" ||
        (["preview", "extraction", "recognition"].includes(kind) &&
          typeof bindings[kind].retry !== "function")
      )
        throw new Error(`Missing materials handler: ${kind}`);
    handlers = bindings;
    for (const row of db.prepare("SELECT * FROM materials_jobs").all()) {
      const job = JSON.parse(row.value);
      if (job.state === "running" || job.state === "cancelling")
        save(
          { accountKey: row.accountKey },
          {
            ...job,
            state: job.state === "running" ? "interrupted" : "cancelled",
            updatedAt: stamp(),
            issues: [
              ...job.issues,
              {
                code: "interrupted",
                unitId: null,
                field: null,
                detail: "服务重启，未自动重发。",
              },
            ].slice(-500),
          },
        );
    }
    setImmediate(() =>
      pump().catch((error) =>
        logger?.error("materials job persistence failed", error),
      ),
    );
  }
  return {
    async cancelAccountAndWait(accountKey) {
      // Revocation is already durable before this call. Queued work must never
      // enter a handler, including after a server restart.
      db.transaction(() => {
        for (const row of db.prepare('SELECT value FROM materials_jobs WHERE accountKey=?').all(accountKey)) {
          const job = JSON.parse(row.value);
          if (active.has(job.state)) save({ accountKey }, { ...job,
            state: controller?.id === job.id ? 'cancelling' : 'cancelled', updatedAt: stamp() });
        }
      })();
      const current = controller?.accountKey === accountKey ? controller : null;
      if (current) { current.abort.abort(); await current.done; }
    },
    enqueue,
    get,
    list,
    cancel,
    retry,
    start,
    close() {
      closed = true;
      const current = controller;
      current?.abort.abort();
      return current?.done ?? Promise.resolve();
    },
  };
}
