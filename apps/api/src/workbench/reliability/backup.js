import { accountKeys, detachedAccountTables, optionalMigrationIds as authOptionalMigrations } from '../../features/auth/lifecycle.js';
import { moduleImplementations } from '../moduleImplementations.js';
import { validateStorage as validateAgentStorage, prepareRestoredAgent } from '../../agent/lifecycle.js';
import { inspectDocuments, assertRelation } from './inspection.js';
import { validateRetiredStorage } from './legacy-storage.js';
import { classRetirementMigrations, classRetirementMigrationId, retiredClassMigrationIds } from '../retire-classes.js';
import retiredClassSchema from './retired-classes-schema.json' with { type: 'json' };
import { retirementMigrations, retirementMigrationId, retiredLessonMigrationIds } from '../retire-lessons.js';
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { validateArchive } from "./schema.js";
import { randomUUID } from "node:crypto";
import { prepareRestoredAuth, assertNoPendingAccountDeletion } from "../../features/auth/recovery.js";
import { migrations as auth } from "../../features/auth/migrations/index.js";
import { migrations as agent } from "../../agent/store.js";
import { navigationMigrations } from "../navigation.js";
import { preferenceMigrations } from "../preferences.js";
import { fileMigrations } from "../files/migrations.js";
import { jobMigrations } from "../jobs/migrations.js";
import { recognitionMigrations } from '../recognition/migrations.js';
import { createMutations } from "../mutations.js";
import { createMigrationRunner } from "../migrations.js";
import {
  acquireLock,
  checkedBlob,
  sha256,
  revision,
  syncWrite,
  syncDir,
  migrations,
  context,
} from "./storage.js";

const owners = await Promise.all(Object.entries(moduleImplementations).map(async ([moduleId, implementation]) => ({
  moduleId, migrations: (await implementation.migrations()).migrations,
  maintenance: await implementation.maintenance(),
})));
const supported = [
  ...owners.map(({ moduleId, migrations }) => ({ moduleId, migrations })),
  ...Object.entries({
    auth,
    agent,
  }).map(([moduleId, migrations]) => ({ moduleId, migrations })),
  ...fileMigrations,
  ...jobMigrations,
  ...recognitionMigrations,
  ...migrations,
  ...preferenceMigrations,
  ...navigationMigrations,
  ...retirementMigrations,
  ...classRetirementMigrations,
];
const ledger = (db) =>
  db.prepare("SELECT id,moduleId FROM workbench_migrations ORDER BY id").all();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function checkStructure(db, actual) {
  // Derive required columns from the existing migration owners, not a second
  // handwritten schema. Only apply migrations recorded in this source backup.
  const reference = new Database(":memory:");
  try {
    createMigrationRunner({ db: reference });
    createMutations({ db: reference });
    const ids = new Set(actual.map((row) => row.id));
    const classIds = actual.filter(row => row.moduleId === 'classes').map(row => row.id);
    if (classIds.length) {
      const prefix = retiredClassMigrationIds.slice(0, classIds.length);
      if (!equal([...prefix].sort(), [...classIds].sort())) throw new Error('Unsupported retired classes migration set');
      for (const [name, schema] of Object.entries(retiredClassSchema)) {
        if (name === 'classes_removed_objects' && !ids.has(retiredClassMigrationIds[1])) continue;
        const expected = schema.filter(column =>
          (column.name !== 'nextNoteHidden' || ids.has(retiredClassMigrationIds[2])) &&
          (column.name !== 'content' || ids.has(retiredClassMigrationIds[3])));
        if (!equal(expected, db.pragma(`table_info(${name})`))) throw new Error(`Unsupported retired table structure: ${name}`);
      }
    }
    for (const group of supported)
      for (const migration of group.migrations)
        if (ids.has(migration.id)) migration.up(reference);
    for (const { name } of reference
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()) {
      const expected = reference.pragma(`table_info(${name})`),
        columns = db.pragma(`table_info(${name})`);
      if (!equal(expected, columns))
        throw new Error(`Unsupported table structure: ${name}`);
    }
  } finally {
    reference.close();
  }
}
function storedOwners(db) {
  const present = new Set(ledger(db).map(row => row.moduleId));
  return owners.filter(owner => present.has(owner.moduleId));
}
function contentSchemas(db, { allowOlder = false } = {}) {
  const schemas = [...validateAgentStorage(db), ...validateRetiredStorage(db, { allowOlder })];
  for (const owner of storedOwners(db)) schemas.push(...owner.maintenance.validateStorage(db));
  const records = [];
  for (const table of ['materials_recognition_results', 'materials_recognition_requests'])
    if (db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)) records.push(...db.prepare(`SELECT accountKey,value FROM ${table}`).all());
  schemas.push(...inspectDocuments(db, records));
  return [...new Map(schemas.map(schema => [schema.name, schema.version]))].map(([name, version]) => ({ name, version })).sort((a, b) => a.name.localeCompare(b.name));
}
function supportedFor(db) {
  const present = new Set(ledger(db).map(row => row.moduleId));
  const business = new Set(owners.map(owner => owner.moduleId));
  return supported.filter(group => !business.has(group.moduleId) || present.has(group.moduleId));
}

function checkDatabase(db, { allowOlder = false } = {}) {
  if (
    db.pragma("integrity_check", { simple: true }) !== "ok" ||
    db.pragma("foreign_key_check").length
  )
    throw new Error("Database integrity check failed");
  const expected = supportedFor(db)
    .flatMap((s) =>
      s.migrations.map((m) => ({ id: m.id, moduleId: s.moduleId })),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const actual = ledger(db);
  if (actual.some(row => row.id === retirementMigrationId) && (
    actual.some(row => row.moduleId === 'lessons') ||
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name GLOB 'lesson_*'").get()
  )) throw new Error('Retired module storage remains in a current database');
  if (actual.some(row => row.id === classRetirementMigrationId) && (
    actual.some(row => row.moduleId === 'classes') ||
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name GLOB 'classes_*'").get()
  )) throw new Error('Retired classes storage remains in a current database');
  const optional = new Set(
    [...migrations, ...navigationMigrations].flatMap((s) => s.migrations.map((m) => m.id)).concat(authOptionalMigrations, retirementMigrationId, classRetirementMigrationId, owners.flatMap(owner => owner.maintenance.optionalMigrationIds ?? [])),
  );
  if (
    actual.some((a) => !expected.some((e) => equal(e, a)) && !(allowOlder && ((a.moduleId === 'lessons' && retiredLessonMigrationIds.includes(a.id)) || (a.moduleId === 'classes' && retiredClassMigrationIds.includes(a.id))))) ||
    expected.some(
      (e) =>
        !actual.some((a) => equal(e, a)) && !(allowOlder && optional.has(e.id)),
    )
  )
    throw new Error(
      "Unsupported migration set; use the matching product version",
    );
  checkStructure(db, actual);
  contentSchemas(db, { allowOlder });
  const accounts = new Set(accountKeys(db));
  const detached = detachedAccountTables(db);
  for (const { name } of db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()) {
    if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name))
      throw new Error("Unsupported table name");
    if (db.pragma(`table_info(${name})`).some((c) => c.name === "accountKey")) {
      for (const r of db
        .prepare(`SELECT DISTINCT accountKey FROM ${name}`)
        .all())
        if (!accounts.has(r.accountKey) && !(r.accountKey === null && detached.has(name)))
          throw new Error(`Unowned rows in ${name}`);
    }
  }
  const links = [
    ["materials_previews", "fileId", "materials_files"],
    ["materials_renditions", "fileId", "materials_files"],
  ];
  for (const [child, key, parent] of links) {
    assertRelation(db, child, key, parent);
  }

  if (db.prepare("SELECT name FROM sqlite_master WHERE name='materials_recognition_requests'").get()) {
    for (const [column, parent] of [['jobId', 'materials_jobs'], ['fileId', 'materials_files'], ['renditionFileId', 'materials_files']])
      if (db.prepare(`SELECT 1 FROM materials_recognition_requests c LEFT JOIN ${parent} p ON c.${column}=p.id WHERE p.id IS NULL OR c.accountKey <> p.accountKey LIMIT 1`).get())
        throw new Error('Broken recognition source or job relation');
  }

}
function requireStopped(stopped) {
  if (stopped !== true)
    throw new Error(
      "Stop the API, child processes and automatic restart first; pass --stopped to acknowledge.",
    );
}
function targetPath(target) {
  const absolute = path.resolve(target);
  fs.mkdirSync(path.dirname(absolute), { recursive: true, mode: 0o700 });
  if (fs.existsSync(absolute)) throw new Error("Destination must not exist");
  return path.join(
    fs.realpathSync(path.dirname(absolute)),
    path.basename(absolute),
  );
}
function separate(a, b) {
  if (a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep))
    throw new Error("Source and destination must be physically separate");
}
function entry(name, bytes, mediaType = "application/octet-stream") {
  return {
    path: name,
    bytes: bytes.length,
    sha256: sha256(bytes),
    mediaType,
    displayName: path.basename(name),
  };
}
function checkedFile(root, item) {
  if (
    !item ||
    typeof item.path !== "string" ||
    item.path.includes("\\") ||
    item.path.includes("\0") ||
    path.isAbsolute(item.path) ||
    item.path.split("/").some((s) => !s || s === "." || s === "..")
  )
    throw new Error("Invalid backup path");
  const file = path.join(root, item.path);
  let current = root;
  for (const part of item.path.split("/")) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error("Backup links are forbidden");
  }
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.nlink !== 1)
    throw new Error("Backup aliases are forbidden");
  const bytes = fs.readFileSync(file);
  if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256)
    throw new Error(`Backup checksum mismatch: ${item.path}`);
  return bytes;
}
function manifestAt(source) {
  if (fs.lstatSync(source).isSymbolicLink())
    throw new Error("Backup directory alias is forbidden");
  const manifestPath = path.join(source, "manifest.json");
  if (
    !fs.lstatSync(manifestPath).isFile() ||
    fs.statSync(manifestPath).nlink !== 1
  )
    throw new Error("Invalid manifest file");
  const manifest = validateArchive(
    "DeploymentManifest",
    JSON.parse(fs.readFileSync(manifestPath, "utf8")),
  );
  if (
    manifest.kind !== "teachbuddy-deployment" ||
    manifest.formatVersion !== 1 ||
    manifest.database?.path !== "workspace.sqlite" ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.migrationIds)
  )
    throw new Error(
      "A supported deployment backup is required, not a personal export",
    );
  const names = [manifest.database, ...manifest.files].map((e) => e.path);
  if (
    new Set(names).size !== names.length ||
    manifest.files.some((f) => !/^files\/blobs\/[0-9a-f-]+\.blob$/.test(f.path))
  )
    throw new Error("Invalid backup file list");
  return manifest;
}
export async function backup({ database, files, target, stopped }) {
  requireStopped(stopped);
  if (
    fs.lstatSync(database).isSymbolicLink() ||
    fs.lstatSync(files).isSymbolicLink()
  )
    throw new Error("Source aliases are forbidden");
  database = fs.realpathSync(database);
  files = fs.realpathSync(files);
  target = targetPath(target);
  separate(target, path.dirname(database));
  separate(target, files);
  const release = acquireLock(database);
  let releaseFiles = () => {};
  let db;
  const staging = target + ".pending-" + randomUUID();
  try {
    releaseFiles = acquireLock(path.join(files, ".managed-files"));
    db = new Database(database, { fileMustExist: true, readonly: true });
    db.pragma("synchronous = FULL");
    checkDatabase(db, { allowOlder: true });
    assertNoPendingAccountDeletion(db);
    fs.mkdirSync(staging, { mode: 0o700 });
    // SQLite backup includes committed WAL content; never copy the main file alone.
    await db.backup(path.join(staging, "workspace.sqlite"));
    const entries = [];
    for (const row of db
      .prepare("SELECT * FROM materials_files ORDER BY id")
      .all()) {
      const bytes = checkedBlob(files, row),
        name = `files/blobs/${row.blobName}`;
      syncWrite(path.join(staging, name), bytes);
      entries.push(entry(name, bytes));
    }
    const bytes = fs.readFileSync(path.join(staging, "workspace.sqlite"));
    const manifest = {
      kind: "teachbuddy-deployment",
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      productRevision: revision(),
      backupId: randomUUID(),
      database: entry("workspace.sqlite", bytes, "application/vnd.sqlite3"),
      files: entries,
      migrationIds: ledger(db).map((r) => r.id),
      schemas: contentSchemas(db, { allowOlder: true }),
    };
    validateArchive("DeploymentManifest", manifest);
    syncWrite(
      path.join(staging, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    const snapshotFd = fs.openSync(path.join(staging, "workspace.sqlite"), "r");
    try {
      fs.fsyncSync(snapshotFd);
    } finally {
      fs.closeSync(snapshotFd);
    }
    for (const folder of ["files/blobs", "files"])
      if (fs.existsSync(path.join(staging, folder)))
        syncDir(path.join(staging, folder));
    syncDir(staging);
    fs.renameSync(staging, target);
    syncDir(path.dirname(target));
    return {
      state: "backed-up",
      backupId: manifest.backupId,
      target,
      createdAt: manifest.createdAt,
      files: entries.length,
    };
  } finally {
    db?.close();
    releaseFiles();
    release();
  }
}
export function restore({ source, target, stopped }) {
  requireStopped(stopped);
  if (fs.lstatSync(source).isSymbolicLink())
    throw new Error("Backup directory alias is forbidden");
  source = fs.realpathSync(source);
  target = targetPath(target);
  separate(source, target);
  const manifest = manifestAt(source);
  const bytes = checkedFile(source, manifest.database);
  fs.mkdirSync(target, { mode: 0o700 });
  syncWrite(
    path.join(target, "recovery-pending.json"),
    JSON.stringify({ state: "pending", backupId: manifest.backupId }),
  );
  syncWrite(path.join(target, "workspace.sqlite"), bytes);
  for (const item of manifest.files)
    syncWrite(path.join(target, item.path), checkedFile(source, item));
  fs.mkdirSync(path.join(target, "files", "blobs"), {
    recursive: true,
    mode: 0o700,
  });
  const database = path.join(target, "workspace.sqlite"),
    release = acquireLock(database);
  let db;
  try {
    db = new Database(database, { fileMustExist: true });
    db.pragma("synchronous = FULL");
    checkDatabase(db, { allowOlder: true });
    if (!equal(contentSchemas(db, { allowOlder: true }), manifest.schemas))
      throw new Error("Manifest content schema mismatch");
    if (
      !equal(
        ledger(db).map((r) => r.id),
        manifest.migrationIds,
      )
    )
      throw new Error("Manifest migration mismatch");
    createMigrationRunner({ db }).run(supportedFor(db), {
      knownModuleIds: supported.map((s) => s.moduleId),
    });
    checkDatabase(db);
    const rows = db.prepare("SELECT * FROM materials_files ORDER BY id").all();
    if (
      !equal(
        rows.map((r) => `files/blobs/${r.blobName}`).sort(),
        manifest.files.map((f) => f.path).sort(),
      )
    )
      throw new Error("Incomplete managed files");
    for (const row of rows) checkedBlob(path.join(target, "files"), row);
    prepareRestoredAgent(db);
    const first = prepareRestoredAuth({ db });
    if (
      first.contractRevision !== "auth-recovery/2" ||
      first.outcome !== "cleared" ||
      Object.values(first.remaining).some((n) => n !== 0)
    )
      throw new Error("Authentication preparation failed");
    db.close();
    db = new Database(database, { fileMustExist: true });
    db.pragma("synchronous = FULL");
    const second = prepareRestoredAuth({ db });
    if (
      Object.values(second.removed).some((n) => n !== 0) ||
      Object.values(second.remaining).some((n) => n !== 0)
    )
      throw new Error("Authentication cleanup did not persist");
    db.prepare("UPDATE reliability_context SET recoveryId=? WHERE id=1").run(
      randomUUID(),
    );
    for (const row of db
      .prepare("SELECT id,value FROM reliability_exports")
      .all()) {
      const record = JSON.parse(row.value);
      if (
        record.state === "ready" ||
        record.state === "running" ||
        record.state === "queued"
      ) {
        record.state = "interrupted";
        record.downloadPath = null;
        record.completedAt = new Date().toISOString();
        record.problem = {
          type: "/problems/reliability/temporarily-unavailable",
          status: 503,
          title: "请重新导出个人资料",
          detail: "工作台已恢复，旧的导出缓存不随部署备份保存。",
        };
        db.prepare("UPDATE reliability_exports SET value=? WHERE id=?").run(
          JSON.stringify(record),
          row.id,
        );
      }
    }
    checkDatabase(db);
    const receipt = {
      state: "prepared",
      target,
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      productRevision: revision(),
      recoveryId: context(db).recoveryId,
      auth: { first, second },
      preparedAt: new Date().toISOString(),
      files: rows.length,
    };
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    db = null;
    receipt.databaseSha256 = sha256(fs.readFileSync(database));
    syncWrite(
      path.join(target, "recovery-prepared.json"),
      JSON.stringify(receipt, null, 2),
    );
    syncDir(path.join(target, "files", "blobs"));
    syncDir(path.join(target, "files"));
    syncDir(target);
    return receipt;
  } finally {
    db?.close();
    release();
  }
}
export function activate({ target, stopped }) {
  requireStopped(stopped);
  target = fs.realpathSync(target);
  const receipt = JSON.parse(
    fs.readFileSync(path.join(target, "recovery-prepared.json"), "utf8"),
  );
  if (
    receipt.state !== "prepared" ||
    receipt.target !== target ||
    !fs.existsSync(path.join(target, "recovery-pending.json"))
  )
    throw new Error("Prepared recovery target required");
  const database = path.join(target, "workspace.sqlite"),
    release = acquireLock(database);
  let db;
  try {
    if (sha256(fs.readFileSync(database)) !== receipt.databaseSha256)
      throw new Error("Prepared database changed");
    db = new Database(database, { fileMustExist: true });
    checkDatabase(db);
    if (context(db).recoveryId !== receipt.recoveryId)
      throw new Error("Recovery target mismatch");
    for (const row of db.prepare("SELECT * FROM materials_files").all())
      checkedBlob(path.join(target, "files"), row);
    db.close();
    db = null;
    syncWrite(
      path.join(target, "recovery-activated.json"),
      JSON.stringify(
        {
          ...receipt,
          state: "activated",
          activatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    fs.unlinkSync(path.join(target, "recovery-pending.json"));
    syncDir(target);
    return {
      state: "activated",
      database,
      files: path.join(target, "files"),
      recoveryId: receipt.recoveryId,
      backupCreatedAt: receipt.backupCreatedAt,
    };
  } finally {
    db?.close();
    release();
  }
}

export function unlock({ database, files, stopped }) {
  requireStopped(stopped);
  const paths = [
    database,
    ...(files ? [path.join(files, ".managed-files")] : []),
  ];
  for (const candidate of paths) {
    const lock = path.resolve(candidate) + ".maintenance-lock";
    if (!fs.existsSync(lock)) continue;
    const owner = JSON.parse(
      fs.readFileSync(path.join(lock, "owner.json"), "utf8"),
    );
    if (!Number.isSafeInteger(owner.pid) || owner.pid < 1)
      throw new Error("Invalid lock owner; manual inspection required");
    try {
      process.kill(owner.pid, 0);
      throw new Error(`Lock owner ${owner.pid} is still running`);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    fs.rmSync(lock, { recursive: true });
  }
  return { state: "unlocked" };
}
