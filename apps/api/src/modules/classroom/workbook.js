import * as XLSX from 'xlsx';
import yauzl from 'yauzl';
import { DOMParser } from '@xmldom/xmldom';

const limits = Object.freeze({ bytes: 10 * 1024 * 1024, expanded: 64 * 1024 * 1024,
  entries: 4096, sheets: 20, rows: 2000, columns: 256, cells: 100000 });
const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const cfbMagic = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const inputError = (code, detail) => new WorkbookInputError(code, detail);

export class WorkbookInputError extends Error {
  constructor(code, detail) {
    super(detail);
    this.name = 'WorkbookInputError';
    this.code = code;
    this.detail = detail;
  }
}

// Inspect the archive with the existing ZIP library before SheetJS expands it.
// No workbook XML, formula or BIFF data is parsed by this module.
async function inspectXlsx(bytes) {
  const names = new Set();
  let expanded = 0, actual = 0, contentTypes = null;
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      const fail = (cause) => { zip.close(); reject(cause); };
      zip.on('error', fail);
      zip.on('end', resolve);
      zip.on('entry', entry => {
        if (entry.generalPurposeBitFlag & 1)
          return fail(inputError('encrypted-workbook', '加密工作簿不能读取，请先取消密码保护并另存。'));
        expanded += entry.uncompressedSize;
        if (names.has(entry.fileName)) return fail(inputError('invalid-workbook', '工作簿包含重复的文件成员。'));
        names.add(entry.fileName);
        if (names.size > limits.entries || expanded > limits.expanded)
          return fail(inputError('workbook-too-large', '工作簿解压内容超过读取范围。'));
        if (entry.fileName.endsWith('/')) return zip.readEntry();
        zip.openReadStream(entry, (cause, stream) => {
          if (cause) return fail(cause);
          const chunks = [];
          stream.on('error', fail);
          stream.on('data', chunk => {
            actual += chunk.length;
            if (actual > limits.expanded) {
              stream.destroy();
              return fail(inputError('workbook-too-large', '工作簿解压内容超过读取范围。'));
            }
            if (entry.fileName === '[Content_Types].xml') chunks.push(chunk);
          });
          stream.on('end', () => {
            if (chunks.length) contentTypes = Buffer.concat(chunks).toString('utf8');
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
  if (!contentTypes || !names.has('xl/workbook.xml'))
    throw inputError('unsupported-format', '请选择实际的 .xlsx 或 .xls 成绩工作簿。');
  if (/<!DOCTYPE|<!ENTITY/i.test(contentTypes))
    throw inputError('invalid-workbook', '工作簿格式声明不可读取。');
  const document = new DOMParser().parseFromString(contentTypes, 'application/xml');
  const workbookType = Array.from(document.getElementsByTagNameNS('*', 'Override'))
    .find(node => node.getAttribute('PartName') === '/xl/workbook.xml')?.getAttribute('ContentType');
  if (workbookType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')
    throw inputError('unsupported-format', '当前只读取 .xlsx 与 .xls，不读取宏工作簿或模板。');
}

function position(value) { return { row: value.r + 1, column: value.c + 1 }; }
function boundedRange(ref) {
  if (!/^[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?$/.test(ref ?? ''))
    throw inputError('invalid-workbook', '工作表的单元格范围无效。');
  const value = XLSX.utils.decode_range(ref);
  if (value.s.r > value.e.r || value.s.c > value.e.c)
    throw inputError('invalid-workbook', '工作表的单元格范围无效。');
  if (value.e.r >= limits.rows || value.e.c >= limits.columns)
    throw inputError('workbook-too-large', '每张工作表最多读取 2000 行、256 列，请先缩小成绩表范围。');
  return value;
}

/** Returns raw, addressable cells. Student matching and score mapping belong to the import service. */
export async function readScoreWorkbook(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array))
    throw inputError('invalid-workbook', '工作簿字节无效。');
  const bytes = Buffer.from(input);
  if (bytes.length > limits.bytes)
    throw inputError('workbook-too-large', '成绩工作簿不能超过 10 MiB，请先移除无关工作表或图片。');
  let format, workbook;
  try {
    if (bytes.subarray(0, 4).equals(zipMagic)) {
      format = 'xlsx';
      await inspectXlsx(bytes);
    } else if (bytes.subarray(0, 8).equals(cfbMagic)) {
      format = 'xls';
      const container = XLSX.CFB.read(bytes, { type: 'buffer' });
      if (container.FullPaths.some(name => /\/(?:EncryptionInfo|EncryptedPackage|encryption)$/i.test(name)))
        throw inputError('encrypted-workbook', '加密工作簿不能读取，请先取消密码保护并另存。');
      if (!container.FullPaths.some(name => /\/(?:Workbook|Book)$/.test(name)))
        throw inputError('unsupported-format', '请选择实际的 .xlsx 或 .xls 成绩工作簿。');
    } else throw inputError('unsupported-format', '请选择实际的 .xlsx 或 .xls 成绩工作簿。');
    const overview = XLSX.read(bytes, { type: 'buffer', bookSheets: true });
    if (!overview.SheetNames?.length)
      throw inputError('invalid-workbook', '工作簿没有可读取的工作表。');
    if (overview.SheetNames.length > limits.sheets)
      throw inputError('workbook-too-large', '成绩工作簿最多读取 20 张工作表。');
    workbook = XLSX.read(bytes, { type: 'buffer', cellFormula: true, cellText: true,
      sheetStubs: true, sheetRows: limits.rows + 1, cellDates: false });
  } catch (error) {
    if (error instanceof WorkbookInputError) throw error;
    if (/password|encrypt|FilePass/i.test(error.message))
      throw inputError('encrypted-workbook', '加密工作簿不能读取，请先取消密码保护并另存。');
    throw inputError('invalid-workbook', '工作簿损坏或无法读取，请用 Excel 或 WPS 重新保存后上传。');
  }
  let totalCells = 0;
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet) throw inputError('invalid-workbook', '工作表内容不可读取。');
    const reference = sheet['!fullref'] ?? sheet['!ref'] ?? null;
    const range = reference ? boundedRange(reference) : null;
    const rows = [], issues = [];
    const rowIndex = new Map();
    if (range) for (let row = range.s.r; row <= range.e.r; row++) {
      const value = { rowNumber: row + 1, cells: [] };
      rows.push(value); rowIndex.set(row + 1, value);
    }
    const merges = (sheet['!merges'] ?? []).map(merge => {
      boundedRange(XLSX.utils.encode_range(merge));
      return { start: position(merge.s), end: position(merge.e) };
    });
    for (const [address, original] of Object.entries(sheet)) {
      if (address.startsWith('!')) continue;
      const location = boundedRange(address).s;
      if (!range || location.r < range.s.r || location.r > range.e.r || location.c < range.s.c || location.c > range.e.c)
        throw inputError('invalid-workbook', '单元格位于工作表声明范围之外。');
      if (++totalCells > limits.cells)
        throw inputError('workbook-too-large', '工作簿有效单元格超过 100000 个，请先缩小范围。');
      const formula = typeof original.f === 'string' ? original.f : null;
      const type = ({ n: 'number', s: 'string', b: 'boolean', e: 'error', z: 'blank' })[original.t] ?? 'error';
      const value = type === 'number' && Number.isFinite(original.v) ? original.v
        : type === 'string' && typeof original.v === 'string' ? original.v
        : type === 'boolean' && typeof original.v === 'boolean' ? original.v : null;
      let code = null;
      if (formula && original.v === undefined) code = 'formula-missing-cache';
      else if (formula && (type !== 'number' || value === null)) code = 'formula-invalid-cache';
      else if (type === 'error' || (type !== 'blank' && value === null)) code = 'cell-error';
      if (code) issues.push({ code, sheet: name, row: location.r + 1, column: location.c + 1, address,
        detail: code === 'formula-missing-cache' ? '公式没有缓存结果，请在 Excel/WPS 重新计算并保存，或在校对时填写得分。'
          : code === 'formula-invalid-cache' ? '公式缓存不是有效数值，请校对该单元格。' : '单元格包含错误或不可读取的值。' });
      const display = typeof original.w === 'string' ? original.w : value === null ? '' : String(value);
      rowIndex.get(location.r + 1).cells.push({ address, column: location.c + 1, type, value, display, formula });
    }
    for (const row of rows) row.cells.sort((a, b) => a.column - b.column);
    issues.sort((a, b) => a.row - b.row || a.column - b.column);
    return { name, range: reference, merges, rows, issues };
  });
  return { format, sheets };
}
