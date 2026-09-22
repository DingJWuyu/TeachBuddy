import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import { exportTree, generateDocx } from '../../../../api/src/modules/lessons/output.js';
import { convertFile } from '../../../../api/src/workbench/files/converter.js';
const fixtures = path.dirname(fileURLToPath(import.meta.url));
const lesson = JSON.parse(fs.readFileSync(path.join(fixtures, 'lesson.json')));
const destination = path.resolve(process.env.PAGINATION_EVIDENCE);
fs.mkdirSync(destination, { recursive: true });
const lines = Number(process.env.PAGINATION_LINES ?? 4);
const options = { kind: process.env.PAGINATION_KIND ?? 'practice', includeAnswers: process.env.PAGINATION_ANSWERS === '1', includeTeacherNotes: process.env.PAGINATION_NOTES === '1', sectionIds: lesson.sections.map(s=>s.id), materialReferenceIds: [], answerSpaceLines: lines };
const blocks = exportTree(lesson, options);
const docx = await generateDocx(blocks, { principal: {}, files: { open: async (_, id) => fs.createReadStream(path.join(fixtures, `${id}.png`)) } });
fs.writeFileSync(path.join(destination, 'output.docx'), docx);
const zip = await JSZip.loadAsync(docx);
const xml = await zip.file('word/document.xml').async('string');
for (let number = 1; number <= 6; number++) assert.ok(xml.includes(`${number}. W-Q${number} 独立材料`));
assert.equal((xml.match(/<w:t xml:space="preserve"> <\/w:t>/g) ?? []).length, options.kind === 'lesson-plan' ? 0 : lines * 6, '所选作答空行完整');
assert.equal((xml.match(/<w:drawing>/g) ?? []).length, 3, '三张真实配图完整');
assert.ok((xml.match(/<m:oMath[ >]/g) ?? []).length >= 17, '正文可编辑公式完整');
for (const marker of ['答案与解析', '根号内非负且分母不为零', '单调递增区间为']) assert.equal(xml.includes(marker), options.includeAnswers, marker);
for (const marker of ['教师注记', 'R35教师块只给教师', 'R35本课注记只给教师']) assert.equal(xml.includes(marker), options.includeTeacherNotes, marker);
assert.ok(!xml.includes('R35备用材料不输出'));

const converted = await convertFile({ bytes: docx, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', directory: path.join(destination, 'conversions') });
fs.writeFileSync(path.join(destination, 'output.pdf'), converted.pdf);
const pdf = path.join(destination, 'output.pdf');
const pdfText = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' }).replace(/\s/g, '');
for (const marker of ['答案与解析', '根号内非负且分母不为零', '单调递增区间为']) assert.equal(pdfText.includes(marker), options.includeAnswers, marker);
for (const marker of ['教师注记', 'R35教师块只给教师', 'R35本课注记只给教师']) assert.equal(pdfText.includes(marker), options.includeTeacherNotes, marker);
const count = Number(execFileSync('pdfinfo',[pdf],{encoding:'utf8'}).match(/Pages:\s+(\d+)/)[1]);
execFileSync('pdftoppm',['-scale-to','1100','-png',pdf,path.join(destination,'page')]);
const blankPages = [];
for (let i=1;i<=count;i++) {
 const { channels } = await sharp(path.join(destination, `page-${String(i).padStart(String(count).length, "0")}.png`)).stats();
 if (channels.every(c=>c.min===255)) blankPages.push(i);
}
const result = { options, pages: count, blankPages };
fs.writeFileSync(path.join(destination,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if (lines === 20 && options.kind === 'practice' && !options.includeAnswers && !options.includeTeacherNotes) {
  // Fixed-point control has eight pages and one blank tail for this large space.
  // This boundary guards against adding pages; it does not close that old issue.
  assert.ok(count <= 8, '较长作答空间不能因连续分页约束增加页数');
  assert.ok(blankPages.length <= 1 && blankPages.every(page => page === count));
} else {
  assert.deepEqual(blankPages, [], '默认及短作答空间无纯空白页');
}
