import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import {
  createGuards,
  createMutationHandler,
  createWorkbenchErrorHandler,
  asyncHandler,
  isWriteMethod,
} from "../http.js";
import {
  contractError,
  problems,
  invalidInput,
  sendProblem,
} from "../problems.js";
import { validateIdPath, validateNoQuery } from "../schema.js";
import { context } from "./storage.js";
import { takeSnapshot, writeArchive } from "./portable.js";

const problem = (reason, detail) => ({
  type: `/problems/reliability/${reason}`,
  title: "资料操作未完成",
  status: reason === "archive-not-ready" ? 409 : 503,
  detail,
});
export function createReliability({
  db,
  mutations,
  identity,
  trustedOrigins,
  ready,
  filesDirectory,
  logger,
  loader,
}) {
  const directory = path.join(path.dirname(db.name), "personal-exports");
  const router = express.Router(),
    guards = createGuards({ identity, trustedOrigins });
  const running = new Map();
  const controller = new AbortController();
  let closed = false;
  const save = (record) =>
    db
      .prepare("UPDATE reliability_exports SET value=? WHERE id=?")
      .run(JSON.stringify(record), record.id);
  const read = (principal, id) => {
    const row = db
      .prepare("SELECT * FROM reliability_exports WHERE id=? AND accountKey=?")
      .get(id, principal.accountKey);
    if (!row) throw contractError(problems.notFound());
    return row;
  };
  function start(id) {
    if (running.has(id) || closed) return;
    const abort = new AbortController();
    let settle;
    const done = new Promise(resolve => { settle = resolve; });
    running.set(id, { abort, done });
    setImmediate(async () => {
      try {
        if (closed || abort.signal.aborted) return;
        const row = db
            .prepare("SELECT * FROM reliability_exports WHERE id=?")
            .get(id),
          record = JSON.parse(row.value);
        if (record.state !== "queued") return;
        record.state = "running";
        save(record);
        await writeArchive(
          JSON.parse(row.snapshot),
          filesDirectory,
          path.join(directory, `${id}.zip`),
          AbortSignal.any([controller.signal, abort.signal]),
        );
        if (closed) return;
        record.state = "ready";
        record.completedAt = new Date().toISOString();
        record.downloadPath = `/api/reliability/v1/exports/${id}/content`;
        save(record);
        db.prepare(
          "UPDATE reliability_exports SET snapshot=NULL WHERE id=?",
        ).run(id);
      } catch (error) {
        if (!closed) {
          const row = db
            .prepare("SELECT value FROM reliability_exports WHERE id=?")
            .get(id);
          if (row) {
            const record = JSON.parse(row.value);
            record.state = "failed";
            record.completedAt = new Date().toISOString();
            record.problem = problem(
              "temporarily-unavailable",
              "资料包生成失败，请检查文件是否完整及磁盘空间后重新导出。",
            );
            save(record);
          }
        }
        logger?.error("personal export failed", error);
      } finally {
        running.delete(id);
        settle();
      }
    });
  }
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(
    (req, res, next) =>
      isWriteMethod(req.method) ? guards.originGuard(req, res, next) : next(),
    guards.protectionGuard,
    guards.identityGuard,
  );
  router.use(
    asyncHandler(async (req, res, next) => {
      await ready();
      validateNoQuery(req.query);
      next();
    }),
    express.json({ limit: "16kb" }),
  );
  router.get("/context", (req, res) => {
    const receiptPath = path.join(
      path.dirname(db.name),
      "recovery-activated.json",
    );
    const receipt = fs.existsSync(receiptPath)
      ? JSON.parse(fs.readFileSync(receiptPath, "utf8"))
      : null;
    res.json({
      ...context(db),
      ...(receipt ? { recoveredFrom: receipt.backupCreatedAt } : {}),
    });
  });
  router.get("/exports", (req, res) =>
    res.json({
      items: db
        .prepare("SELECT value FROM reliability_exports WHERE accountKey=?")
        .all(req.workbenchPrincipal.accountKey)
        .map((r) => JSON.parse(r.value))
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
        ),
    }),
  );
  router.post(
    "/exports",
    createMutationHandler({
      mutations,
      method: "POST",
      validate(body) {
        if (
          !body ||
          Array.isArray(body) ||
          typeof body !== "object" ||
          Object.keys(body).length
        )
          throw invalidInput("/", "unknown-field");
        return body;
      },
      write({ principal }) {
        const id = randomUUID(),
          snapshot = takeSnapshot(db, principal, loader),
          record = {
            id,
            state: "queued",
            createdAt: snapshot.snapshotAt,
            snapshotAt: snapshot.snapshotAt,
            completedAt: null,
            downloadPath: null,
            problem: null,
          };
        db.prepare("INSERT INTO reliability_exports VALUES (?,?,?,?)").run(
          id,
          principal.accountKey,
          JSON.stringify(record),
          JSON.stringify(snapshot),
        );
        start(id);
        return { status: 202, body: record };
      },
    }),
  );
  router.get("/exports/:id", (req, res) => {
    validateIdPath(req.params.id);
    res.json(JSON.parse(read(req.workbenchPrincipal, req.params.id).value));
  });
  router.get(
    "/exports/:id/content",
    asyncHandler(async (req, res) => {
      validateIdPath(req.params.id);
      const record = JSON.parse(
        read(req.workbenchPrincipal, req.params.id).value,
      );
      if (record.state !== "ready")
        throw Object.assign(new Error("Archive not ready"), {
          status: 409,
          problem: problem("archive-not-ready", "资料包尚未生成完成。"),
        });
      const file = path.join(directory, `${record.id}.zip`),
        stat = fs.statSync(file);
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="teachbuddy-${record.id}.zip"`,
        "Content-Length": String(stat.size),
      });
      await pipeline(fs.createReadStream(file), res);
    }),
  );
  router.use((error, req, res, next) => {
    if (
      error.problem?.type?.startsWith("/problems/reliability/") &&
      !res.headersSent
    )
      return sendProblem(res, error.status, error.problem);
    next(error);
  });
  router.use(createWorkbenchErrorHandler({ logger }));
  const agentRecoveryGuard = express.Router();
  agentRecoveryGuard.post(
    "/conversations/:conversationId/operations/:operationId/reconcile",
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    guards.originGuard,
    guards.protectionGuard,
    guards.identityGuard,
    asyncHandler(async (req, res, next) => {
      await ready();
      const frozen = db
        .prepare(
          "SELECT 1 FROM reliability_frozen_operations WHERE id=? AND conversationId=? AND accountKey=?",
        )
        .get(
          req.params.operationId,
          req.params.conversationId,
          req.workbenchPrincipal.accountKey,
        );
      if (frozen)
        return sendProblem(res, 409, {
          type: "/problems/reliability/recovery-review-required",
          status: 409,
          title: "工作台已从备份恢复，请基于当前资料重新核对这项操作。",
        });
      next();
    }),
  );
  agentRecoveryGuard.use(createWorkbenchErrorHandler({ logger }));
  return {
    async cancelAccountAndWait(accountKey) {
      const handles = db.prepare('SELECT id FROM reliability_exports WHERE accountKey=?').all(accountKey)
        .map(row => running.get(row.id)).filter(Boolean);
      for (const handle of handles) handle.abort.abort();
      await Promise.all(handles.map(handle => handle.done));
    },
    accountExportIds(accountKey) {
      return db.prepare('SELECT id FROM reliability_exports WHERE accountKey=?').all(accountKey).map(row => row.id);
    },
    removeAccountExports(accountKey, ids) {
      for (const id of ids) {
        validateIdPath(id);
        if (db.prepare('SELECT 1 FROM reliability_exports WHERE id=? AND accountKey<>?').get(id, accountKey))
          throw new Error('Export belongs to another account');
        for (const suffix of ['.zip', '.zip.part']) fs.rmSync(path.join(directory, id + suffix), { force: true });
      }
      if (fs.existsSync(directory)) {
        const fd = fs.openSync(directory, 'r');
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      }
    },
    router,
    agentRecoveryGuard,
    async waitForFileReaders(principal) {
      const ids = db.prepare('SELECT id FROM reliability_exports WHERE accountKey=?').all(principal.accountKey).map(row => row.id);
      await Promise.all(ids.map(id => running.get(id)?.done).filter(Boolean));
    },
    retainedFiles(principal) {
      return db.prepare('SELECT snapshot,value FROM reliability_exports WHERE accountKey=? AND snapshot IS NOT NULL').all(principal.accountKey)
        .filter(row => ['queued', 'running'].includes(JSON.parse(row.value).state))
        .map(row => JSON.parse(row.snapshot));
    },
    initialize() {
      // Packages are derived caches. A removed export row revokes its archive,
      // including packages created before a module was retired.
      if (fs.existsSync(directory)) {
        const retained = new Set(db.prepare('SELECT id FROM reliability_exports').all().map(row => `${row.id}.zip`));
        for (const name of fs.readdirSync(directory))
          if (/^[0-9a-f-]+\.zip$/.test(name) && !retained.has(name)) fs.unlinkSync(path.join(directory, name));
      }
      for (const row of db
        .prepare("SELECT value FROM reliability_exports")
        .all()) {
        const record = JSON.parse(row.value);
        if (["queued", "running"].includes(record.state)) {
          record.state = "interrupted";
          record.completedAt = new Date().toISOString();
          record.problem = problem(
            "temporarily-unavailable",
            "导出被服务重启中断，请重新导出。",
          );
          save(record);
        }
      }
    },
    close() {
      closed = true;
      controller.abort();
      return Promise.all([...running.values()].map(handle => handle.done));
    },
  };
}
