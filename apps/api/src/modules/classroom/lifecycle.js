import { migrations } from './migrations/index.js';
export const optionalMigrationIds = migrations.map(migration => migration.id);
import { createClassroomRepository, kinds } from './repository.js';
import { validateStoredData } from './stored-data.js';
import { createPreviews } from '../../workbench/files/preview.js';
import { validateSchema } from '../../workbench/content/schema.js';
import { inspectDocuments } from '../../workbench/reliability/inspection.js';
import { portableObject, reference, escape } from '../../workbench/reliability/portable-records.js';
const kindLabels = { 'classroom-class': '班级', 'classroom-student': '学生', 'classroom-record': '自由记录', 'classroom-exam': '考试', 'classroom-result': '班级成绩', 'classroom-import': '成绩导入校对', 'classroom-tag': '考试标签' };
const classroomRelationLabels = {
  "class-student": "班级与学生", "record-subject": "记录对象", "exam-source": "原卷", "exam-tag": "考查标签",
  "result-exam": "考试", "result-class": "班级", "result-student": "学生", "import-file": "成绩表原件",
  "import-exam": "考试", "import-class": "班级", "import-result": "已确认成绩", origin: "来源", "current-link": "关联资料",
};
function readableClassroom(object, lookup) {
  const value = object.value;
  const name = (kind, id) => lookup(`classroom-${kind}`, id)?.value.name ?? id;
  const field = (label, content) => `<p><strong>${escape(label)}：</strong>${escape(content ?? "未填写")}</p>`;
  const table = (headers, rows) => `<table><thead><tr>${headers.map(header => `<th>${escape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
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


export function snapshot(db, principal) {
  const repository = createClassroomRepository(db);
  const objects = Object.entries({ classes: 'class', students: 'student', records: 'record', exams: 'exam', results: 'result', imports: 'import', tags: 'tag' }).flatMap(([collection, kind]) => repository.list(collection, principal.accountKey).map(value => portableObject(`classroom-${kind}`, value, { label: kindLabels[`classroom-${kind}`], title: value.title || (kind === 'record' ? `${value.occurredOn} 自由记录` : '') || value.name || kindLabels[`classroom-${kind}`] })));
  const lookup = (kind, id) => objects.find(object => object.kind === kind && object.id === id);
  for (const object of objects) {
    const value = object.value;
    const relation = (kind, id, type, location) => object.relations.push(reference(kind, id, type, location, null, false, classroomRelationLabels[type] ?? type));
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

    object.html = readableClassroom(object, lookup);
  }
  return { objects };
}
export function validateStorage(db) {
  const readFile = (principal, id) => {
    const row = db.prepare('SELECT metadata FROM materials_files WHERE id=? AND accountKey=?').get(id, principal.accountKey);
    if (!row) throw new Error('Missing or foreign classroom file reference');
    const metadata = JSON.parse(row.metadata);
    validateSchema('File', metadata);
    if (metadata.id !== id) throw new Error('Inconsistent classroom file identity');
    return metadata;
  };
  const previews = createPreviews({ db, files: { read: readFile } });
  validateStoredData(db, { readFile, readRendition: previews.readRendition });
  const schemas = inspectDocuments(db, kinds.flatMap(kind => db.prepare(`SELECT accountKey,value FROM classroom_${kind}`).all()));
  return [...schemas, { name: 'classroom-data', version: '1' }];
}
export function deleteAccountData(db, accountKey) {
  for (const kind of kinds) db.prepare(`DELETE FROM classroom_${kind} WHERE accountKey=?`).run(accountKey);
}
