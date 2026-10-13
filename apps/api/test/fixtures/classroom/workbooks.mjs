import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

// Authored data only. No teacher's spreadsheet or private student data is required.
export function scoreWorkbook(format = 'xlsx') {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['构造成绩表'],
    ['学生信息', null, null, '计分单元', null, null, '整题汇总', '总分'],
    ['学号', '姓名', '状态', '1', '2', '3(1)', '3', '总分'],
    ['001', '张明', '参加', 0, 4, 2, 2, 6],
    ['002', '张明', '参加', 3, null, 1, 1, 4],
    ['003', '李华', '缺考', null, null, null, null, null],
    [null, '张明', '参加', 1, 2, 2, 2, 5],
    [null, '   ', null, null, null, null, null, null],
    ['004', '赵敏', '参加', 1, 2, 2, 2, 5],
    ['005', '钱冬', '参加', 1, 2, 2, 2, null],
  ]);
  sheet['!merges'] = ['A1:H1', 'A2:C2', 'D2:F2'].map(XLSX.utils.decode_range);
  if (format === 'xlsx') {
    sheet.H9 = { t: 'n', f: 'SUM(D9:F9)', v: 5 };
    sheet.H10 = { t: 'n', f: 'SUM(D10:F10)' };
  }
  XLSX.utils.book_append_sheet(book, sheet, '一班');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['学号', '姓名', '总分'], ['101', '王阳', 5],
  ]), '二班');
  return XLSX.write(book, { type: 'buffer', bookType: format === 'xls' ? 'biff8' : 'xlsx' });
}

export function writeScoreSamples(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const format of ['xlsx', 'xls'])
    fs.writeFileSync(path.join(directory, `scores.${format}`), scoreWorkbook(format));
}
