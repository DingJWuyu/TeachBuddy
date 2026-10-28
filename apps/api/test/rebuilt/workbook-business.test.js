import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { createWorld, register, ok, problem, classes, write, upload } from './helpers.js';
import { roster } from './classroom-fixture.js';

async function exam(client) {
  return ok(await write(client, 'POST', `${classes}/exams`, { name: '原始表成绩', subject: '数学', occurredOn: '2026-01-05', totalMax: 100, source: [], questions: [] }), 201);
}
function workbook(sheet, bookType) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '成绩');
  return XLSX.write(book, { bookType, type: 'buffer' });
}
async function mappedImport(client, c, examId, file, lastDataRow) {
  const created = ok(await write(client, 'POST', `${classes}/imports`, { examId, classId: c.id, sourceFileId: file.id }), 201);
  const mapping = { sheetIndex: 0, headerRow: 1, firstDataRow: 2, lastDataRow: lastDataRow, nameColumn: 2, studentNumberColumn: 1, totalColumn: 3, attendanceColumn: null, questionColumns: [], ignoredRows: [] };
  return ok(await write(client, 'PUT', `${classes}/imports/${created.id}`, { baseVersion: 1, mapping, rows: null }));
}

test('A-R5 真实XLS：BIFF8原字节经上传/映射/确认保存前导零学号和零分', async t => {
  const world = await createWorld(t), { client } = await register(world), { c, students } = await roster(client);
  const e = await exam(client);
  const raw = workbook(XLSX.utils.aoa_to_sheet([['学号', '姓名', '总分'], [students[0].studentNumber, students[0].name, 0]]), 'xls');
  assert.equal(raw.subarray(0, 8).toString('hex'), 'd0cf11e0a1b11ae1', '实际输入是CFB/BIFF8而非改扩展名的XLSX');
  const file = ok(await upload(client, raw, '原始成绩.xls'), 201);
  const mapped = await mappedImport(client, c, e.id, file, 2);
  assert.equal(mapped.workbook.format, 'xls');
  assert.equal(mapped.rows[0].studentId, students[0].id);
  assert.equal(mapped.rows[0].totalScore, 0);
  const confirmed = ok(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, { baseVersion: mapped.version }));
  const row = confirmed.result.rows.find(r => r.studentId === students[0].id);
  assert.equal(row.studentSnapshot.studentNumber, '001');
  assert.equal(row.totalScore, 0);
  assert.equal(row.status, 'present');
  const disguised = ok(await upload(client, Buffer.from('<html><table><tr><td>001</td><td>100</td></tr></table></html>'), '伪装成绩.xls'), 201);
  problem(await write(client, 'POST', `${classes}/imports`, { examId: e.id, classId: c.id, sourceFileId: disguised.id }), 422, 'classroom-workbook-input', { code: 'unsupported-format' });
  assert.equal(ok(await client.request('GET', `${classes}/imports?examId=${e.id}`)).items.length, 1, '伪装格式不能留下可确认的导入');
});

test('A-R5 公式缓存：使用实际缓存而不执行公式，缺失/错误缓存阻断确认，人工校正后可保存', async t => {
  const world = await createWorld(t), { client } = await register(world), { c, students } = await roster(client);
  const e = await exam(client);
  const sheet = XLSX.utils.aoa_to_sheet([['学号', '姓名', '总分'], ...students.slice(0, 3).map(s => [s.studentNumber, s.name])]);
  sheet.C2 = { t: 'n', f: 'SUM(999,999)', v: 0 };
  sheet.C3 = { t: 'n', f: '1+1' };
  sheet.C4 = { t: 'e', f: '1/0', v: 7 };
  sheet['!ref'] = 'A1:C4';
  const file = ok(await upload(client, workbook(sheet, 'xlsx'), '公式需校对.xlsx'), 201);
  const mapped = await mappedImport(client, c, e.id, file, 4);
  assert.equal(mapped.rows[0].totalScore, 0, '缓存0应保持0，不能执行SUM得到1998');
  assert.equal(mapped.rows[1].totalScore, null);
  assert.equal(mapped.rows[2].totalScore, null);
  assert.deepEqual(mapped.workbook.sheets[0].issues.map(i => [i.code, i.address]), [['formula-missing-cache', 'C3'], ['formula-invalid-cache', 'C4']]);
  assert.deepEqual(mapped.issues.filter(i => i.code === 'score-cell-review-required').map(i => i.sourceRow), [3, 4]);
  problem(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, { baseVersion: mapped.version }), 409, 'classroom-import-review-required');
  assert.deepEqual(ok(await client.request('GET', `${classes}/results?examId=${e.id}`)).items, [], '错误缓存不得变成已确认成绩');
  const corrected = ok(await write(client, 'PUT', `${classes}/imports/${mapped.id}`, { baseVersion: mapped.version, mapping: mapped.mapping,
    rows: mapped.rows.map((row, i) => ({ ...row, totalScore: [0, 2, 3][i] })) }));
  const confirmed = ok(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, { baseVersion: corrected.version }));
  assert.deepEqual(students.slice(0, 3).map(s => confirmed.result.rows.find(r => r.studentId === s.id).totalScore), [0, 2, 3]);
});
