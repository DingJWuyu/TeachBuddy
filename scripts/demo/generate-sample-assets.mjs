// Rebuild the authored sample Excel sheets from product data.
// Run from the repository root: node scripts/demo/generate-sample-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
const directory = fileURLToPath(new URL('../../apps/web/src/features/workbench/demo/', import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(directory, 'classroom-data.json'), 'utf8'));
for (const [i, rows] of data.workbooks.entries()) {
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '成绩');
  fs.writeFileSync(path.join(directory, `assets/scores-${i}.xlsx`), XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
}
