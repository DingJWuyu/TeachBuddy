import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readScoreWorkbook, WorkbookInputError } from '../src/modules/classroom/workbook.js';
import { writeScoreSamples } from './fixtures/classroom/workbooks.mjs';

const cell = (sheet, row, column) => sheet.rows.find(item => item.rowNumber === row)?.cells.find(item => item.column === column);
const encoded = sheet => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '成绩');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
};
const rejectsCode = code => error => error instanceof WorkbookInputError && error.code === code;

test('constructed actual XLSX and BIFF8 files retain coordinates, merged headers, duplicate names, zero and blank', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classroom-workbooks-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeScoreSamples(directory);
  for (const format of ['xlsx', 'xls']) {
    const result = await readScoreWorkbook(fs.readFileSync(path.join(directory, `scores.${format}`)));
    assert.equal(result.format, format);
    assert.deepEqual(result.sheets.map(item => item.name), ['一班', '二班']);
    const sheet = result.sheets[0];
    assert.deepEqual(sheet.merges[0], { start: { row: 1, column: 1 }, end: { row: 1, column: 8 } });
    assert.equal(sheet.range, 'A1:H10');
    assert.deepEqual(cell(sheet, 4, 1), { address: 'A4', column: 1, type: 'string', value: '001', display: '001', formula: null });
    assert.equal(cell(sheet, 4, 2).value, '张明');
    assert.equal(cell(sheet, 5, 2).value, '张明');
    assert.equal(cell(sheet, 4, 4).value, 0);
    assert.equal(cell(sheet, 5, 5)?.value ?? null, null);
    assert.equal(cell(sheet, 6, 3).value, '缺考');
    assert.equal(cell(sheet, 8, 2).value, '   ');
    assert.equal(cell(sheet, 3, 6).value, '3(1)');
    assert.equal(cell(sheet, 3, 7).value, '3');
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  }
});

test('cached formulas are preserved without execution; missing and error caches are addressed issues', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['姓名', '总分'], ['甲', 0], ['乙'], ['丙']]);
  sheet.B2 = { t: 'n', f: 'SUM(999,999)', v: 0 };
  sheet.B3 = { t: 'n', f: '1+1' };
  sheet.B4 = { t: 'e', f: '1/0', v: 7 };
  sheet['!ref'] = 'A1:B4';
  const result = (await readScoreWorkbook(encoded(sheet))).sheets[0];
  assert.equal(cell(result, 2, 2).value, 0);
  assert.equal(cell(result, 2, 2).formula, 'SUM(999,999)');
  assert.equal(cell(result, 3, 2).value, null);
  assert.deepEqual(result.issues.map(issue => [issue.code, issue.address, issue.row, issue.column]), [
    ['formula-missing-cache', 'B3', 3, 2], ['formula-invalid-cache', 'B4', 4, 2],
  ]);
});

test('non-workbook ZIP, legacy Word container, encryption, macro format and damaged files are rejected', async () => {
  await assert.rejects(readScoreWorkbook(Buffer.from('姓名,总分\n甲,5')), rejectsCode('unsupported-format'));
  const zip = new JSZip(); zip.file('word/document.xml', '<document/>');
  await assert.rejects(readScoreWorkbook(await zip.generateAsync({ type: 'nodebuffer' })), rejectsCode('unsupported-format'));
  const legacyWord = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(legacyWord, '/WordDocument', Buffer.from('not a workbook'));
  await assert.rejects(readScoreWorkbook(XLSX.CFB.write(legacyWord, { type: 'buffer' })), rejectsCode('unsupported-format'));
  const encrypted = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(encrypted, '/EncryptedPackage', Buffer.from('encrypted'));
  await assert.rejects(readScoreWorkbook(XLSX.CFB.write(encrypted, { type: 'buffer' })), rejectsCode('encrypted-workbook'));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['姓名'], ['甲']]));
  await assert.rejects(readScoreWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsm' })), rejectsCode('unsupported-format'));
  await assert.rejects(readScoreWorkbook(Buffer.from([0x50, 0x4b, 3, 4, 0])), rejectsCode('invalid-workbook'));
});

test('excessive byte length, sheets, row and column extents and archive expansion fail explicitly', async () => {
  await assert.rejects(readScoreWorkbook(Buffer.alloc(10 * 1024 * 1024 + 1)), rejectsCode('workbook-too-large'));
  const book = XLSX.utils.book_new();
  for (let index = 0; index < 21; index++) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['姓名']]), `班${index}`);
  await assert.rejects(readScoreWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })), rejectsCode('workbook-too-large'));
  for (const address of ['A2001', 'IW1']) {
    const sheet = { A1: { t: 's', v: '姓名' }, [address]: { t: 'n', v: 1 }, '!ref': `A1:${address}` };
    await assert.rejects(readScoreWorkbook(encoded(sheet)), rejectsCode('workbook-too-large'));
  }
  const zip = new JSZip(); zip.file('large.xml', Buffer.alloc(64 * 1024 * 1024 + 1));
  await assert.rejects(readScoreWorkbook(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })), rejectsCode('workbook-too-large'));
});

test('aggregate cells across several individually valid sheets are bounded', async () => {
  const book = XLSX.utils.book_new();
  const rows = Array.from({ length: 501 }, () => Array.from({ length: 100 }, () => 1));
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '一班');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '二班');
  await assert.rejects(readScoreWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true })), rejectsCode('workbook-too-large'));
});
