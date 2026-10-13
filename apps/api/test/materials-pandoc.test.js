import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import JSZip from 'jszip';
import sharp from 'sharp';
import { generateDocx } from '../src/workbench/files/pandoc.js';
import { validateFormulas } from '../src/workbench/files/formula.js';
import { convertFile } from '../src/workbench/files/converter.js';
const paragraph = text => ({ type: 'paragraph', runs: [{ type: 'text', text }] });

test('shared Pandoc conversion preserves editable formulas, tables and figures through DOCX and LibreOffice PDF', { timeout: 120000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'materials-pandoc-'));
  const figure = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#397bdc' } }).png().toBuffer();
  const files = {
    temporaryDirectory: () => fs.mkdtempSync(path.join(directory, 'input-')),
    open: () => Readable.from(figure),
  };
  validateFormulas([{ latex: '\\frac{x^2+1}{2}', field: '/formula' }]);
  const bytes = await generateDocx([
    { type: 'heading', level: 1, runs: [{ type: 'text', text: '公共文档转换' }] },
    paragraph('原始文本保留'),
    { type: 'math', latex: '\\frac{x^2+1}{2}' },
    { type: 'table', rows: [[{ blocks: [paragraph('第一列')] }, { blocks: [paragraph('第二列')] }]] },
    { type: 'image', fileId: 'fixture-image', widthMm: 60, alt: '保留插图' },
  ], { files, principal: { accountKey: 'conversion-test' } });
  const zip = await JSZip.loadAsync(bytes), xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /公共文档转换/); assert.match(xml, /原始文本保留/);
  assert.match(xml, /<m:oMath/); assert.match(xml, /<w:tbl>/); assert.match(xml, /<w:drawing>/);
  assert(Object.keys(zip.files).some(name => name.startsWith('word/media/')));
  const result = await convertFile({ bytes, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', directory });
  assert(result.pages.length > 0); assert(result.pdf?.subarray(0, 5).equals(Buffer.from('%PDF-')));
  const pdf = path.join(directory, 'document.pdf'); fs.writeFileSync(pdf, result.pdf);
  const text = execFileSync('/usr/bin/pdftotext', [pdf, '-'], { encoding: 'utf8' });
  assert.match(text, /公共文档转换/); assert.match(text, /第一列/); assert.match(text, /第二列/);
  const image = await sharp(result.pages[0].bytes).metadata(); assert(image.width > 100); assert(image.height > 100);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('shared Word formula validation rejects unsupported source with its field', () => {
  assert.throws(() => validateFormulas([{ latex: '\\input{secret}', field: '/body/0' }]), error =>
    error.problem?.type === '/problems/materials/unsupported-formula' && error.problem.field === '/body/0');
});
