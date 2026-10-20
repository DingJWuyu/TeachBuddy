// Rebuild the authored sample Excel sheets and exam PDFs from product data.
// Run from the repository root: node scripts/demo/generate-sample-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import katex from 'katex';
import { chromium } from 'playwright';
import { sampleQuestions } from '../../apps/web/src/features/workbench/demo/question-data.js';
const directory = fileURLToPath(new URL('../../apps/web/src/features/workbench/demo/', import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(directory, 'classroom-data.json'), 'utf8'));
for (const [i, rows] of data.workbooks.entries()) {
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '成绩');
  fs.writeFileSync(path.join(directory, `assets/scores-${i}.xlsx`), XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
}
const escape = text => text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const inline = text => text.split(/(\$[^$]+\$)/).map(part => part.startsWith('$') ? katex.renderToString(part.slice(1, -1), { throwOnError: false }) : escape(part)).join('');
const css = fs.readFileSync('node_modules/katex/dist/katex.min.css', 'utf8').replace(/url\(fonts\/([^)]+)\)/g, (_all, name) => `url(data:font/woff2;base64,${fs.readFileSync('node_modules/katex/dist/fonts/' + name).toString('base64')})`);
const chineseFonts = fs.readFileSync('node_modules/@fontsource/noto-sans-sc/400.css', 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, (_all, name) => `url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/noto-sans-sc/files/' + name).toString('base64')})`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [examIndex, exam] of data.exams.entries()) {
    const html = exam.questions.map((unit, i) => `<section><h2>${unit.group} · ${unit.label}（${unit.fullScore} 分）</h2><p>${inline(sampleQuestions[i % sampleQuestions.length][1])}</p><div class="space"></div></section>`).join('');
    await page.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>${chineseFonts}${css}body{font-family:'Noto Sans SC',sans-serif;font-size:12px;line-height:1.8;color:#111}h1{font-size:22px;text-align:center}h2{font-size:14px;font-weight:500;margin:0}section{break-inside:avoid;margin:20px 0}.space{height:55px}header{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #777}</style><h1>${exam.name}</h1><p style="text-align:center">数学 · 满分 ${exam.fullScore} 分</p><header><span>班级：____________</span><span>姓名：____________</span><span>学号：____________</span></header>${html}</html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(directory, `assets/exam-${examIndex}.pdf`), format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' }, printBackground: true });
  }
} finally { await browser.close(); }
