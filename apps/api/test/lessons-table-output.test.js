import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { http, doc } from './teaching-time-classes-materials-fixture.js';

// Actual authenticated HTTP exports and Office conversion. No browser, OCR or
// screenshot substitute. Optionally consumes a previously UI-saved lesson.
test('table output HTTP: 3x10 editable cells, visible print grid and intact formulas in Word/PDF', async () => {
  const world = await createIntegration({ workbench: { recognition: { home: null } } });
  const evidence = path.resolve(process.env.LESSONS_TABLE_OUTPUT_DIR ?? path.join(world.directory, 'evidence'));
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, 'instance.json'), JSON.stringify({ directory: world.directory }));
  let passed = false;
  try {
    const { client } = await registerMath(world, 'lesson-table-output@example.test'), call = http(client);
    const download = id => new Promise((resolve, reject) => {
      https.get(`${world.origin}/api/workbench/files/${id}/content`, { rejectUnauthorized: false,
        headers: { Cookie: client.jar.header(), 'X-TeachBuddy-Page': client.pageId } }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => response.statusCode === 200 ? resolve(Buffer.concat(chunks)) : reject(new Error(`Download status ${response.statusCode}`)));
      }).on('error', reject);
    });
    const fixture = process.env.LESSONS_TABLE_INPUT && JSON.parse(fs.readFileSync(process.env.LESSONS_TABLE_INPUT));
    const cells = values => values.map(text => ({ blocks: text ? doc(text).blocks : [] }));
    const content = fixture?.sections[0].content ?? { version: 2, blocks: [{ type: 'table', rows: [
      cells(['x', '...', '-3', '-2', '-1', '0', '1', '2', '3', '...']),
      [{ blocks: [{ type: 'paragraph', runs: [{ type: 'math', latex: 'f(x)=x' }] }] }, ...cells(['...', '9', '', '', '', '', '', '', '...'])],
      [{ blocks: [{ type: 'paragraph', runs: [{ type: 'math', latex: 'g(x)=\\frac{1}{x}' }] }] }, ...cells(['...', '', '', '', '', '', '', '', '...'])],
    ] }] };
    const id = randomUUID();
    const lesson = await call('POST', '/api/modules/lessons/v3', { title: '数值表打印核对', intro: doc('请填写表格中的空白单元格。'),
      sections: [{ id, title: '函数值', content, references: [] }], materials: [] }, 201);
    const paths = {};
    for (const format of ['docx', 'pdf']) {
      const accepted = await call('POST', `/api/modules/lessons/v3/${lesson.id}/exports`, {
        baseVersion: lesson.version, kind: 'handout', format, includeAnswers: false, includeTeacherNotes: false,
        sectionIds: [id], materialReferenceIds: [], answerSpaceLines: 0,
      }, 202);
      let job;
      for (let i = 0; i < 600; i++) {
        job = await call('GET', `/api/workbench/jobs/${accepted.jobId}`);
        if (!['queued', 'running'].includes(job.state)) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.equal(job.state, 'succeeded', JSON.stringify(job));
      paths[format] = path.join(evidence, `grid.${format}`); fs.writeFileSync(paths[format], await download(job.outputFileIds[0]));
      // Render both the independently generated PDF and the actual Word preview.
      if (format === 'docx') {
        const principal = { accountKey: world.workbench.db.prepare('SELECT accountKey FROM lesson_items WHERE id=?').get(lesson.id).accountKey };
        const preview = await world.workbench.files.ensurePreview(principal, job.outputFileIds[0]);
        assert.equal(preview.state, 'ready'); assert.equal(preview.pages.length, 1);
        fs.writeFileSync(path.join(evidence, 'word-preview.png'), await download(preview.pages[0].imageFileId));
      } else {
        execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1600', '-png', paths.pdf, path.join(evidence, 'pdf-page')]);
        execFileSync('pdftocairo', ['-svg', paths.pdf, path.join(evidence, 'grid.svg')]);
      }
    }
    const zip = await JSZip.loadAsync(fs.readFileSync(paths.docx));
    const xml = await zip.file('word/document.xml').async('string');
    assert.equal((xml.match(/<w:tr>/g) ?? []).length, 3); assert.equal((xml.match(/<w:tc>/g) ?? []).length, 30);
    assert.equal((xml.match(/<m:oMath>/g) ?? []).length, 2); assert.match(xml, /w:w="5000" w:type="pct"|w:type="pct" w:w="5000"/);
    const styles = new DOMParser().parseFromString(await zip.file('word/styles.xml').async('string'), 'application/xml');
    const tableStyle = Array.from(styles.getElementsByTagName('w:style')).find(style => style.getAttribute('w:styleId') === 'Table');
    assert(tableStyle, 'Ordinary tables require a visible reference grid style');
    for (const edge of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
      const border = tableStyle.getElementsByTagName(`w:${edge}`)[0];
      assert(border, `Missing ${edge} grid`); assert.equal(border.getAttribute('w:val'), 'single');
      assert.equal(border.getAttribute('w:sz'), '4');
    }
    const text = execFileSync('pdftotext', ['-layout', paths.pdf, '-'], { encoding: 'utf8' });
    assert(text.split('\n').some(line => line.includes('-3') && line.includes('-2') && line.includes('-1')));
    assert.match(text, /f\s*\(\s*x\s*\)\s*=\s*x\s+\.\.\./);
    assert.match(execFileSync('pdfinfo', [paths.pdf], { encoding: 'utf8' }), /Pages:\s+1\b/);
    // A 3x10 grid has at least 4 horizontal and 11 vertical strokes. The old
    // borderless output only has the fraction bar; verify actual PDF graphics.
    const svg = new DOMParser().parseFromString(fs.readFileSync(path.join(evidence, 'grid.svg'), 'utf8'), 'image/svg+xml');
    const gridLines = Array.from(svg.getElementsByTagName('path')).filter(p => p.getAttribute('stroke-width') === '0.5');
    assert.equal(gridLines.length, 15, 'Printed table must have 4 horizontal and 11 vertical grid lines');
    assert.deepEqual((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections[0].content, content);
    passed = true;
  } finally {
    await world.close();
    if (passed && process.env.LESSONS_TABLE_OUTPUT_DIR) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
