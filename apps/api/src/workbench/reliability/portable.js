import { readExportIdentity } from '../../features/auth/lifecycle.js';
import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { escape, portableObject } from "./portable-records.js";
import { snapshot as agentSnapshot } from "../../agent/lifecycle.js";

import { validateArchive } from "./schema.js";
import { sha256, revision, syncDir } from "./storage.js";

const filePath = (row) =>
  `files/${row.id}/${
    JSON.parse(row.metadata)
      .name.replace(/[\\/\x00-\x1f<>:"|?*]/g, "_")
      .replace(/^\.+$/, "_") || "file"
  }`;
const json = (value) => JSON.stringify(value, null, 2);
const readableStyle =
  "<style>body{max-width:960px;margin:32px auto;padding:0 20px;font:15px/1.7 system-ui,sans-serif;color:#242424}a{color:#4f46a5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}h1{font-size:24px}h2{font-size:18px}details{margin:20px 0;border-top:1px solid #ddd;padding-top:12px}li{margin:6px 0}table{border-collapse:collapse;width:100%;margin:16px 0}table th,table td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}</style>";
// One synchronous SQLite snapshot. Runtime entries, auth, mutation journals and
// provider configuration are deliberately absent; teacher text is never redacted.
export function takeSnapshot(db, principal, loader) {
  const account = principal.accountKey;
  const rows = (table) => db.prepare(`SELECT * FROM ${table} WHERE accountKey=?`).all(account);
  // Owner snapshots run inside the export's write transaction and must only read: no default settings, no reminder settlement.
  const fragments = loader.maintenance().map(owner => owner.snapshot(db, principal));
  fragments.push(agentSnapshot(db, principal));
  const objects = fragments.flatMap(fragment => fragment.objects);
  const add = (kind, value, id = value.id ?? kind, version = value.version ?? null) => objects.push(portableObject(kind, value, { id, version, label: { job: '处理记录', file: '附件', preferences: '偏好', layout: '导航布局' }[kind] ?? kind }));
  const values = (table, kind, column = 'value') => rows(table).forEach(row => add(kind, JSON.parse(row[column]), row.id ?? kind));
  const supplemental = Object.assign({}, ...fragments.map(fragment => fragment.supplemental), {
    previews: rows('materials_previews').map(row => JSON.parse(row.value)),
    renditions: rows('materials_renditions').map(row => JSON.parse(row.value)),
    recognitionResults: rows('materials_recognition_results').map(row => JSON.parse(row.value)),
    recognitionRequests: rows('materials_recognition_requests').map(row => ({ jobId: row.jobId, ...JSON.parse(row.value) })),
  });
  values("materials_jobs", "job");
  // Retain every registered file, including replaced originals and previews.
  const files = rows("materials_files");
  files.forEach((row) => add("file", JSON.parse(row.metadata)));

  if (
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE name='reliability_preferences'",
      )
      .get()
  ) {
    const row = db
      .prepare("SELECT * FROM reliability_preferences WHERE accountKey=?")
      .get(account);
    if (row)
      add("preferences", {
        version: row.version,
        values: JSON.parse(row.valuesJson),
        updatedAt: row.updatedAt,
      });
  }
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='workbench_navigation'").get()) {
    const row = db.prepare('SELECT * FROM workbench_navigation WHERE accountKey=?').get(account);
    if (row) add('layout', { id: 'navigation', version: row.version, ...JSON.parse(row.layoutJson), updatedAt: row.updatedAt });
  }
  const owner = readExportIdentity(db, principal);
  if (
    owner &&
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE name='workspaceLayouts'")
      .get()
  ) {
    db.prepare("SELECT * FROM workspaceLayouts WHERE ownerId=?")
      .all(owner.id)
      .forEach(({ ownerId, ...row }) =>
        add("layout", {
          hiddenModuleIds: JSON.parse(row.hiddenModuleIds),
          groups: JSON.parse(row.groups),
          ungroupedModuleIds: JSON.parse(row.ungroupedModuleIds),
        }),
      );
  }
  return {
    objects,
    files,
    supplemental,
    accountLabel: owner?.nickname ?? "个人资料",
    snapshotAt: new Date().toISOString(),
  };
}

export async function writeArchive(snapshot, directory, destination, signal) {
  const zip = new JSZip();
  const inputs = [];
  const manifest = {
    kind: "teachbuddy-personal",
    formatVersion: 1,
    createdAt: snapshot.snapshotAt,
    productRevision: revision(),
    accountLabel: snapshot.accountLabel,
    files: [],
    objects: [],
    relations: [],
    excluded: [
      "authentication",
      "secrets",
      "device-drafts",
      "device-scenes",
      "raw-agent-runtime",
      "export-cache",
    ],
  };
  function put(name, bytes, mediaType, displayName = name) {
    bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    zip.file(name, bytes);
    manifest.files.push({
      path: name,
      bytes: bytes.length,
      sha256: sha256(bytes),
      mediaType,
      displayName,
    });
  }
  const key = (object) => ({
    kind: object.kind,
    id: object.id,
    version: object.version,
  });
  const entries = snapshot.objects.map((object, index) => ({
    ...object,
    dataPath: `data/${index}.json`,
    readablePath: `readable/${index}.html`,
  }));
  const lookup = (kind, id) =>
    entries.find((o) => o.kind === kind && o.id === id);
  put(
    "data/supplemental.json",
    json(snapshot.supplemental),
    "application/json",
  );
  const links = [];
  for (const object of entries) {
    const value = object.value, title = object.title, state = object.state;
    manifest.objects.push({
      key: key(object),
      state,
      dataPath: object.dataPath,
      readablePath: object.readablePath,
    });
    put(
      object.dataPath,
      json({ kind: object.kind, value }),
      "application/json",
    );
    const related = [];
    function relation(kind, id, type, location, adoptedVersion = null, optional = false, label = type) {
      const target = lookup(kind, id);
      if (!target) {
        if (id && !optional) throw new Error("Saved reference target is missing");
        return;
      }
      manifest.relations.push({
        from: key(object),
        to: key(target),
        relation: type,
        adoptedVersion,
        location,
      });
      related.push(`<li><a href="../${target.readablePath}">${escape(target.title)} (${escape(label)})</a></li>`);
    }
    for (const link of object.relations ?? []) relation(link.kind, link.id, link.type, link.location, link.adoptedVersion, link.optional, link.label);
    // Any file reference, including deeply nested source/revision snapshots.
    function walk(v, location = "") {
      if (!v || typeof v !== "object") return;
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === "string" && /fileId$/i.test(k))
          relation("file", x, "origin", `${location}/${k}`, null, object.allowMissingFiles);
        else if (/fileIds$/i.test(k) && Array.isArray(x))
          x.forEach((id, i) =>
            relation("file", id, "origin", `${location}/${k}/${i}`, null, object.allowMissingFiles),
          );
        else if (typeof x === "object") walk(x, `${location}/${k}`);
      }
    }
    walk(value);
    if (object.kind === "file") {
      for (const rendition of snapshot.supplemental.renditions ?? []) {
        if (rendition.renditionFileId !== object.id) continue;
        relation("file", rendition.fileId, "origin", "rendition/fileId");
        rendition.pages.forEach((page, index) => relation("file", page.imageFileId, "origin", `rendition/pages/${index}/imageFileId`));
      }
    }
    const file =
      object.kind === "file"
        ? snapshot.files.find((f) => f.id === object.id)
        : null;
    const attachment = file
      ? `<p><a href="../${escape(filePath(file).split("/").map(encodeURIComponent).join("/"))}" download="${escape(value.name)}">${escape(value.name)} - 下载原文件</a></p>`
      : "";
    const status = state === "deleted" ? "已删除，可在工作台恢复" : "已保存";
    put(
      object.readablePath,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8">${readableStyle}<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><body><a href="../index.html">资料目录</a><h1>${escape(title)}</h1><p>${status}${object.version === null ? "" : ` · 版本 ${object.version}`}</p>${attachment}<ul>${related.join("")}</ul><p>下方保留完整内容、公式源码及已采用的历史快照。当前关联内容可从上方链接查看。</p>${object.html}<details><summary>完整记录与版式数据</summary><pre>${escape(json(value))}</pre></details><a href="../${object.dataPath}">机器可读 JSON</a></body></html>`,
      "text/html",
    );
    links.push(
      `<li><a href="${object.readablePath}">${escape(title)}</a> (${escape(object.label)}${state === "deleted" ? "，已删除" : ""})</li>`,
    );
  }
  for (const row of snapshot.files) {
    const metadata = JSON.parse(row.metadata),
      name = filePath(row);
    if (!/^[0-9a-f-]+\.blob$/.test(row.blobName))
      throw new Error("Invalid managed file path");
    const file = path.join(directory, "blobs", row.blobName);
    const stream = Readable.from(
      (async function* () {
        const stat = fs.lstatSync(file);
        if (
          !stat.isFile() ||
          stat.nlink !== 1 ||
          stat.size !== metadata.byteLength ||
          metadata.sha256 !== row.sha256
        )
          throw new Error("Invalid managed file");
        let length = 0;
        const hash = createHash("sha256");
        for await (const chunk of fs.createReadStream(file, { signal })) {
          length += chunk.length;
          hash.update(chunk);
          yield chunk;
        }
        if (
          length !== metadata.byteLength ||
          hash.digest("hex") !== metadata.sha256
        )
          throw new Error("Managed file integrity check failed");
      })(),
    );
    inputs.push(stream);
    zip.file(name, stream);
    manifest.files.push({
      path: name,
      bytes: metadata.byteLength,
      sha256: metadata.sha256,
      mediaType: metadata.mediaType,
      displayName: metadata.name,
    });
  }
  put(
    "index.html",
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8">${readableStyle}<title>个人资料</title><body><h1>${escape(snapshot.accountLabel)}的资料</h1><p>${escape(snapshot.snapshotAt)}</p><p>原文件可重新上传，正文与公式可复制。此包不用于覆盖账户或恢复原关联；整体还原请使用部署备份。</p><ul>${links.join("")}</ul><p><a href="data/supplemental.json">历史输出与预览元数据</a></p></body></html>`,
    "text/html",
  );
  validateArchive("PortableManifest", manifest);
  zip.file("manifest.json", json(manifest));
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const staging = destination + ".part";
  try {
    await pipeline(
      zip.generateNodeStream({ streamFiles: true, compression: "DEFLATE" }),
      fs.createWriteStream(staging, { flags: "wx", mode: 0o600 }),
      { signal },
    );
    const fd = fs.openSync(staging, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(staging, destination);
    syncDir(path.dirname(destination));
  } catch (error) {
    fs.rmSync(staging, { force: true });
    throw error;
  } finally {
    for (const input of inputs) input.destroy();
  }
}
