import XLSX from 'xlsx';
import { ok, classes, write, upload } from './helpers.js';

export const student = (classId, name, studentNumber) => ({ classId, name, studentNumber, birthday: null, interests: '', description: '' });
export const updateStudent = s => Object.fromEntries(['classId', 'name', 'studentNumber', 'birthday', 'interests', 'description'].map(k => [k, s[k]]));
export async function roster(client) {
  const c = ok(await write(client, 'POST', `${classes}/classes`, { name: '高一一班' }), 201);
  const students = [];
  for (const [i, name] of ['甲', '乙', '丙', '丁', '戊', '己'].entries()) students.push(ok(await write(client, 'POST', `${classes}/students`, student(c.id, name, `00${i+1}`)), 201));
  return { c, students };
}
export async function assessment(client, c, students) {
  const tag = ok(await write(client, 'POST', `${classes}/tags`, { name: ' 函数 ' }), 201);
  const exam = ok(await write(client, 'POST', `${classes}/exams`, { name: '第一次测验', subject: '数学', occurredOn: '2026-01-05', totalMax: 100, source: [], questions: [{ label: '1', groupLabel: null, maxScore: 100, tagIds: [tag.id], locations: [] }] }), 201);
  const q = exam.questions[0].id;
  const table = [['学号', '姓名', '总分', '题1', '缺考'], ...students.slice(0, 5).map((s, i) => [s.studentNumber, s.name, [100, 100, 0, '', ''][i], [100, 80, 0, 50, ''][i], i === 4 ? '缺考' : ''])];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(table), '成绩');
  const file = ok(await upload(client, XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }), '测验.xlsx'), 201);
  const draft = ok(await write(client, 'POST', `${classes}/imports`, { examId: exam.id, classId: c.id, sourceFileId: file.id }), 201);
  const mapping = { sheetIndex: 0, headerRow: 1, firstDataRow: 2, lastDataRow: 6, nameColumn: 2, studentNumberColumn: 1, totalColumn: 3, attendanceColumn: 5, questionColumns: [{ column: 4, questionId: q }], ignoredRows: [] };
  const mapped = ok(await write(client, 'PUT', `${classes}/imports/${draft.id}`, { baseVersion: 1, mapping, rows: null }));
  return { exam, tag, q, file, mapped, mapping };
}
