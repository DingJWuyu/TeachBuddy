import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function revision() {
  if (process.env.PRODUCT_REVISION) {
    if (!/^[0-9a-f]{40}$/.test(process.env.PRODUCT_REVISION))
      throw new Error("PRODUCT_REVISION must be a full commit SHA");
    return process.env.PRODUCT_REVISION;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: new URL("../../../../../", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(
      "Set PRODUCT_REVISION to the full source commit before exporting or backing up",
    );
  }
}
export const migrations = [
  {
    moduleId: "reliability",
    migrations: [
      {
        id: "reliability_001_manual_data",
        up(db) {
          db.exec(`CREATE TABLE reliability_context (id INTEGER PRIMARY KEY CHECK(id=1), recoveryId TEXT NOT NULL);
    CREATE TABLE reliability_exports (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL, snapshot TEXT);
    CREATE TABLE reliability_frozen_operations (id TEXT PRIMARY KEY, conversationId TEXT NOT NULL, accountKey TEXT NOT NULL);`);
          db.prepare("INSERT INTO reliability_context VALUES (1,?)").run(
            randomUUID(),
          );
        },
      },
    ],
  },
];
export function context(db) {
  return db
    .prepare("SELECT recoveryId FROM reliability_context WHERE id=1")
    .get();
}
export function syncWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(file, "wx", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
export function syncDir(directory) {
  const fd = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
// Lock the physical database name. Never guess that a lock left by a crashed
// process is safe: the maintenance command provides explicit stale-lock removal.
export function acquireLock(sqlitePath) {
  if (sqlitePath === ":memory:") return () => {};
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const parent = fs.realpathSync(path.dirname(sqlitePath));
  if (
    fs.existsSync(sqlitePath) &&
    (fs.lstatSync(sqlitePath).isSymbolicLink() ||
      fs.statSync(sqlitePath).nlink !== 1)
  )
    throw new Error("Database aliases are not supported for maintenance.");
  const lock = path.join(
    parent,
    path.basename(sqlitePath) + ".maintenance-lock",
  );
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch {
    throw new Error(
      `Data directory is in use or requires stale-lock review: ${lock}`,
    );
  }
  fs.writeFileSync(
    path.join(lock, "owner.json"),
    JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
  );
  let released = false;
  return () => {
    if (!released) {
      fs.rmSync(lock, { recursive: true });
      released = true;
    }
  };
}
export function checkedBlob(directory, row) {
  if (!/^[0-9a-f-]+\.blob$/.test(row.blobName))
    throw new Error("Invalid managed file path");
  const file = path.join(directory, "blobs", row.blobName);
  if (
    !fs.lstatSync(file).isFile() ||
    fs.lstatSync(file).isSymbolicLink() ||
    fs.statSync(file).nlink !== 1
  )
    throw new Error("File aliases are not supported");
  const bytes = fs.readFileSync(file),
    metadata = JSON.parse(row.metadata);
  if (
    bytes.length !== metadata.byteLength ||
    sha256(bytes) !== metadata.sha256 ||
    metadata.sha256 !== row.sha256
  )
    throw new Error("Managed file integrity check failed");
  return bytes;
}
