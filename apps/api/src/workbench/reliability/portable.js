import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { documentText } from "../content/document.js";

import { validateArchive } from "./schema.js";
import { sha256, revision, syncDir } from "./storage.js";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const filePath = (row) =>
  `files/${row.id}/${
    JSON.parse(row.metadata)
      .name.replace(/[\\/\x00-\x1f<>:"|?*]/g, "_")
      .replace(/^\.+$/, "_") || "file"
  }`;
const json = (value) => JSON.stringify(value, null, 2);
const kindLabels = {
  "classroom-class": "班级",
  "classroom-student": "学生",
  "classroom-record": "自由记录",
  "classroom-exam": "考试",
  "classroom-result": "班级成绩",
  "classroom-import": "成绩导入校对",
  "classroom-tag": "考试标签",
  question: "题目",
  "question-taxonomy": "题目分类",
  import: "收录",
  resource: "资源",
  "resource-taxonomy": "资源分类",
  "resource-file-revision": "资源文件历史版本",
  math: "数学作品",
  "math-revision": "数学历史版本",
  entry: "日程",
  notification: "通知",
  conversation: "对话",
  preferences: "偏好",
  layout: "导航布局",
  "schedule-settings": "日程设置",
  file: "附件",
  job: "处理记录",
};
const readableStyle =
  "<style>body{max-width:960px;margin:32px auto;padding:0 20px;font:15px/1.7 system-ui,sans-serif;color:#242424}a{color:#4f46a5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}h1{font-size:24px}h2{font-size:18px}details{margin:20px 0;border-top:1px solid #ddd;padding-top:12px}li{margin:6px 0}.classroom-table{border-collapse:collapse;width:100%;margin:16px 0}.classroom-table th,.classroom-table td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}</style>";
const labels = {
  body: "题干",
  solution: "答案解析",
  intro: "引言",
  note: "备注",
  noteFragments: "教学笔记摘录",
  caption: "说明",
  source: "来源与源码",
  snapshot: "已采用的历史快照",
  sections: "环节",
  materials: "本课材料",
  references: "关联资料",
  messages: "对话",
  draft: "已保存输入",
  content: "内容",
  text: "正文",
  latex: "LaTeX",
  expression: "表达式",
  steps: "步骤",
  items: "条目",
  origin: "来源",
};
function readableContent(value) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value.blocks))
    return `<pre>${escape(documentText(value))}</pre>`;
  if (Array.isArray(value)) return value.map(readableContent).join("");
  return Object.entries(value)
    .map(([key, item]) => {
      if (typeof item === "string" && labels[key] && item)
        return `<h3>${labels[key]}</h3><pre>${escape(item)}</pre>`;
      if (typeof item === "object" && item) {
        const text = readableContent(item);
        return text
          ? `${labels[key] ? `<h2>${labels[key]}</h2>` : ""}${text}`
          : "";
      }
      return "";
    })
    .join("");
}

const classroomRelationLabels = {
  "class-student": "班级与学生", "record-subject": "记录对象", "exam-source": "原卷", "exam-tag": "考查标签",
  "result-exam": "考试", "result-class": "班级", "result-student": "学生", "import-file": "成绩表原件",
  "import-exam": "考试", "import-class": "班级", "import-result": "已确认成绩", origin: "来源", "current-link": "关联资料",
};
function readableClassroom(object, lookup) {
  const value = object.value;
  const name = (kind, id) => lookup(`classroom-${kind}`, id)?.value.name ?? id;
  const field = (label, content) => `<p><strong>${escape(label)}：</strong>${escape(content ?? "未填写")}</p>`;
  const table = (headers, rows) => `<table class="classroom-table"><thead><tr>${headers.map(header => `<th>${escape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const score = value => value === null || value === undefined ? "缺分" : String(value);
  if (object.kind === "classroom-class")
    return field("班级", value.name) + field("学期", value.term) + field("座位尺寸", `${value.seating.rows} 行 × ${value.seating.columns} 列`) +
      table(["行", "列", "学生"], value.seating.seats.map(seat => [seat.row, seat.column, name("student", seat.studentId)]));
  if (object.kind === "classroom-student")
    return field("姓名", value.name) + field("班级", name("class", value.classId)) + field("学号", value.studentNumber) +
      field("生日", value.birthday) + field("兴趣", value.interests) + `<h3>自写描述</h3><pre>${escape(value.description)}</pre>`;
  if (object.kind === "classroom-record")
    return field(value.scope === "class" ? "班级" : "学生", name(value.scope, value.subjectId)) + field("日期", value.occurredOn) + `<h3>自由记录</h3><pre>${escape(value.text)}</pre>`;
  if (object.kind === "classroom-exam")
    return field("考试", value.name) + field("学科", value.subject) + field("日期", value.occurredOn) + field("满分", value.totalMax) +
      table(["题号", "大题", "满分", "标签", "原卷定位"], value.questions.map(question => [
        question.label, question.groupLabel ?? "", question.maxScore, question.tagIds.map(id => name("tag", id)).join("、"),
        question.locations.length ? question.locations.map(location => `第 ${location.page} 页${location.box ? "，局部范围" : "，整页"}`).join("；") : "未定位",
      ]));
  if (object.kind === "classroom-result" || object.kind === "classroom-import") {
    const exam = lookup("classroom-exam", value.examId)?.value;
    const questions = exam?.questions ?? [];
    const status = { present: "参考", absent: "缺考", unrecorded: "未录入" };
    return field("考试", exam?.name ?? value.examId) + field("班级", name("class", value.classId)) +
      (object.kind === "classroom-import" ? field("校对状态", value.state === "confirmed" ? "已确认" : "草稿") : "") +
      table(["学生", "学号", "状态", "总分", ...questions.map(question => `${question.label}（满分 ${question.maxScore}）`)], value.rows.map(row => {
        const student = row.studentSnapshot ?? lookup("classroom-student", row.studentId)?.value;
        return [student?.name ?? (row.studentId ? row.studentId : "未匹配学生"), student?.studentNumber ?? "", row.ignored ? "已忽略" : status[row.status],
          row.totalScore === null ? "未录入" : score(row.totalScore), ...questions.map(question => score(row.scores[question.id]))];
      }));
  }
  if (object.kind === "classroom-tag")
    return field("标签", value.name) + (value.mergedIntoId ? field("已合并至", name("tag", value.mergedIntoId)) : "");
  return "";
}

// One synchronous SQLite snapshot. Runtime entries, auth, mutation journals and
// provider configuration are deliberately absent; teacher text is never redacted.
export function takeSnapshot(db, principal, loader) {
  const account = principal.accountKey;
  const questions = loader.get("questions").port.readForExport(principal);
  const resources = loader.get("resources").port.readForExport(principal);
  const math = loader.get("math").port.readForExport(principal);
  const schedule = loader.get("schedule").port.readForExport(principal);
  const classroom = loader.get("classroom").port.readForExport(principal);
  const rows = (table) =>
    db.prepare(`SELECT * FROM ${table} WHERE accountKey=?`).all(account);
  const objects = [];
  const add = (
    kind,
    value,
    id = value.id ?? kind,
    version = value.version ?? null,
  ) => objects.push({ kind, id, version, value });
  const values = (table, kind, column = "value") =>
    rows(table).forEach((row) =>
      add(kind, JSON.parse(row[column]), row.id ?? kind),
    );
  for (const [collection, kind] of Object.entries({ classes: "class", students: "student", records: "record", exams: "exam", results: "result", imports: "import", tags: "tag" }))
    classroom[collection].forEach(value => add(`classroom-${kind}`, value));
  questions.questions.forEach(value => add("question", value));
  add("question-taxonomy", questions.taxonomy);
  questions.imports.forEach(value => add("import", value));
  resources.resources.forEach(value => add("resource", value));
  if (resources.taxonomy) add("resource-taxonomy", resources.taxonomy);
  resources.fileRevisions.forEach(({ resourceId, revision }) =>
    add("resource-file-revision", revision, resourceId, revision.version));
  math.works.forEach(value => add("math", value));
  math.revisions.forEach(({ workId, revision }) =>
    add("math-revision", revision, workId, revision.version));
  const supplemental = {
    mathExports: math.exports,
    previews: rows("materials_previews").map((row) => JSON.parse(row.value)),
    renditions: rows("materials_renditions").map((row) =>
      JSON.parse(row.value),
    ),
    recognitionResults: rows('materials_recognition_results').map(row => JSON.parse(row.value)),
    recognitionRequests: rows('materials_recognition_requests').map(row => ({ jobId: row.jobId, ...JSON.parse(row.value) })),
    questionRecognitionEvidence: questions.recognitionEvidence,
  };
  schedule.entries.forEach(value => add("entry", value, value.entry.id, value.entry.version));
  schedule.notifications.forEach(value => add("notification", value));
  if (schedule.settings) add("schedule-settings", schedule.settings);
  rows("agent_conversations").forEach((row) =>
    add("conversation", JSON.parse(row.document).snapshot, row.id),
  );
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
  const owner = db
    .prepare("SELECT id,nickname FROM auth_accounts WHERE accountKey=?")
    .get(account);
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
    const value = object.value,
      current = value.entry ?? value;
    const title =
      current.title ||
      (object.kind === "classroom-record" ? `${current.occurredOn} 自由记录` : "") ||
      current.name ||
      value.conversation?.title ||
      current.note ||
      kindLabels[object.kind] ||
      object.kind;
    const state = current.deletedAt ? "deleted" : "active";
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
    function relation(kind, id, type, location, adoptedVersion = null, adoptedSnapshot = null) {
      const target = lookup(kind, id);
      if (!target) {
        if (
          id &&
          !adoptedSnapshot &&
          type !== "conversation-reference" &&
          object.kind !== "conversation"
        )
          throw new Error("Saved reference target is missing");
        return;
      }
      manifest.relations.push({
        from: key(object),
        to: key(target),
        relation: type,
        adoptedVersion,
        location,
      });
      const display = target.value.title || target.value.name || (target.kind.startsWith("classroom-") ? kindLabels[target.kind] : kind);
      const relationLabel = object.kind.startsWith("classroom-") ? classroomRelationLabels[type] ?? type : type;
      related.push(`<li><a href="../${target.readablePath}">${escape(display)} (${escape(relationLabel)})</a></li>`);
    }
    if (object.kind === "question" && value.source?.kind === "copy")
      relation(
        "question",
        value.source.questionId,
        "copy-source",
        "source",
        value.source.questionVersion ?? null,
        value.source.snapshot,
      );
    // Adopted question content is independent of an import that was permanently deleted.
    if (object.kind === "question" && value.source?.kind === "import" && lookup("import", value.source.importId))
      relation("import", value.source.importId, "origin", "source/importId");
    if (object.kind === "classroom-student")
      relation("classroom-class", value.classId, "class-student", "classId");
    if (object.kind === "classroom-class")
      value.seating.seats.forEach((seat, index) => relation("classroom-student", seat.studentId, "class-student", `seating/seats/${index}/studentId`));
    if (object.kind === "classroom-record")
      relation(`classroom-${value.scope}`, value.subjectId, "record-subject", "subjectId");
    if (object.kind === "classroom-exam") {
      value.source.forEach((part, index) => relation("file", part.fileId, "exam-source", `source/${index}/fileId`));
      value.questions.forEach((question, index) => question.tagIds.forEach((id, tagIndex) =>
        relation("classroom-tag", id, "exam-tag", `questions/${index}/tagIds/${tagIndex}`)));
    }
    if (object.kind === "classroom-result") {
      relation("classroom-exam", value.examId, "result-exam", "examId");
      relation("classroom-class", value.classId, "result-class", "classId");
      value.rows.forEach((row, index) => relation("classroom-student", row.studentId, "result-student", `rows/${index}/studentId`));
      if (value.provenance.importId) relation("classroom-import", value.provenance.importId, "origin", "provenance/importId");
    }
    if (object.kind === "classroom-import") {
      relation("file", value.sourceFileId, "import-file", "sourceFileId");
      relation("classroom-exam", value.examId, "import-exam", "examId");
      relation("classroom-class", value.classId, "import-class", "classId");
      if (value.confirmedResultId) relation("classroom-result", value.confirmedResultId, "import-result", "confirmedResultId");
    }
    if (object.kind === "classroom-tag" && value.mergedIntoId)
      relation("classroom-tag", value.mergedIntoId, "current-link", "mergedIntoId");
    // Any file reference, including deeply nested source/revision snapshots.
    function walk(v, location = "") {
      if (!v || typeof v !== "object") return;
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === "string" && /fileId$/i.test(k))
          relation("file", x, "origin", `${location}/${k}`);
        else if (/fileIds$/i.test(k) && Array.isArray(x))
          x.forEach((id, i) =>
            relation("file", id, "origin", `${location}/${k}/${i}`),
          );
        else if (
          object.kind === "conversation" &&
          k === "references" &&
          Array.isArray(x)
        )
          x.forEach((ref, i) => {
            const input = ref.input ?? ref;
            relation(
              input.kind,
              input.id,
              "conversation-reference",
              `${location}/${k}/${i}`,
              input.version ?? null,
            );
            walk(ref, `${location}/${k}/${i}`);
          });
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
    if (object.kind === "math-revision")
      relation("math", object.id, "current-link", "work");
    if (object.kind === "resource-file-revision")
      relation("resource", object.id, "current-link", "resource");
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
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8">${readableStyle}<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><body><a href="../index.html">资料目录</a><h1>${escape(title)}</h1><p>${status}${object.version === null ? "" : ` · 版本 ${object.version}`}</p>${attachment}<ul>${related.join("")}</ul><p>下方保留完整内容、公式源码及已采用的历史快照。当前关联内容可从上方链接查看。</p>${object.kind.startsWith("classroom-") ? readableClassroom(object, lookup) : readableContent(value)}<details><summary>完整记录与版式数据</summary><pre>${escape(json(value))}</pre></details><a href="../${object.dataPath}">机器可读 JSON</a></body></html>`,
      "text/html",
    );
    links.push(
      `<li><a href="${object.readablePath}">${escape(title)}</a> (${escape(kindLabels[object.kind] || object.kind)}${state === "deleted" ? "，已删除" : ""})</li>`,
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
