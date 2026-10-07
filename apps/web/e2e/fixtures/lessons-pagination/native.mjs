import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import sharp from 'sharp';
import { DOMParser } from '@xmldom/xmldom';
import { createIntegration } from '../../../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from '../math-static/real.mjs';

const fixtures = path.dirname(fileURLToPath(import.meta.url));
export function inspectPagination(target) {
  const pages = execFileSync('pdftotext', ['-layout', target, '-'], { encoding: 'utf8' }).split('\f').slice(0, -1);
  const pageFor = marker => pages.findIndex(page => page.replace(/\s/g, '').includes(marker)) + 1;
  const imagePages = execFileSync('pdfimages', ['-list', target], { encoding: 'utf8' }).split('\n')
    .map(line => line.trim().split(/\s+/)).filter(parts => parts[2] === 'image').map(parts => Number(parts[0]));
  return { pages: pages.length, q1: pageFor('固定六题Q1'), q1LastOption: pageFor('D(−∞'),
    q6: pageFor('固定六题Q6'), q6LastPart: pageFor('2求体积。'), imagePages };
}
export function assertPagination(layout) {
  assert.equal(layout.q1LastOption, layout.q1, 'Q1 题干与全部选项须同页');
  assert.equal(layout.imagePages.length, 3, '真实三张配图完整');
  assert.equal(layout.q6LastPart, layout.q6, 'Q6 题干与小问须同页');
  assert.equal(layout.imagePages[2], layout.q6, 'Q6 必需配图须和题干、小问同页');
}

export async function runNativePagination({ destination, kind = 'handout', lines = 10,
  includeAnswers = false, includeTeacherNotes = false, longQuestion = false, check = true } = {}) {
  fs.mkdirSync(destination, { recursive: true });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pagination-native-'));
  const world = await createIntegration({ directory, workbench: { recognition: { home: null } } });
  const { client } = await registerMath(world, 'pagination@example.test');
  async function call(method, url, body) {
    const r = await client.request(method, url, { body, headers: { 'Idempotency-Key': randomUUID() } });
    assert.ok(r.status >= 200 && r.status < 300, `${method} ${url}: ${r.status} ${r.text}`);
    return r.json;
  }
  async function wait(id) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const job = await call('GET', `/api/workbench/jobs/${id}`);
      if (!['queued', 'running', 'cancelling'].includes(job.state)) {
        assert.equal(job.state, 'succeeded', JSON.stringify(job)); return job;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail(`Output timed out: ${id}`);
  }
  const download = url => new Promise((resolve, reject) => {
    https.get(world.origin + url, { rejectUnauthorized: false,
      headers: { Cookie: client.jar.header(), 'X-TeachBuddy-Page': client.pageId } }, r => {
      const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => {
        if (r.statusCode !== 200) reject(new Error(`Download ${r.statusCode}: ${url}`));
        else resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
  let result, completed = false;
  try {
    const source = JSON.parse(fs.readFileSync(path.join(fixtures, 'native-lesson.json')));
    const imageMap = new Map();
    for (const name of fs.readdirSync(fixtures).filter(n => n.endsWith('.png'))) {
      const boundary = `pagination-${randomUUID()}`;
      const rawBody = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),
        fs.readFileSync(path.join(fixtures, name)), Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const r = await client.request('POST', '/api/workbench/files', { rawBody,
        contentType: `multipart/form-data; boundary=${boundary}`, headers: { 'Idempotency-Key': randomUUID() } });
      assert.equal(r.status, 201, r.text); imageMap.set(name.slice(0, -4), r.json.id);
    }
    const remap = value => {
      if (!value || typeof value !== 'object') return;
      if (value.type === 'image') value.fileId = imageMap.get(value.fileId);
      Object.values(value).forEach(remap);
    };
    const references = [];
    for (const original of source.sections[0].references) {
      const snapshot = structuredClone(original.snapshot); remap(snapshot);
      if (longQuestion && references.length === 5) snapshot.body.blocks.unshift(...Array.from({ length: 65 }, (_, i) => ({
        type: 'paragraph', runs: [{ type: 'text', text: `长题段落 ${i + 1}：保留完整可编辑题面，合法长题必须自然分页。` }],
      })));
      if (longQuestion === 'narrative' && references.length === 5) snapshot.body.blocks = snapshot.body.blocks.flatMap(block =>
        block.type === 'list' ? block.items.flatMap(item => item.blocks.map((paragraph, i) => i === 0
          ? { ...paragraph, runs: [{ type: 'text', text: item.label + ' ' }, ...paragraph.runs] } : paragraph)) : [block]);
      const question = await call('POST', '/api/modules/questions/v2/items', { ...snapshot,
        source: { kind: 'manual' }, note: 'PRIVATE-NOTE', starred: false, typeId: null, tagIds: [] });
      references.push({ id: randomUUID(), kind: 'question', questionId: question.id, questionVersion: question.version, note: original.note });
    }
    const sectionId = randomUUID();
    const lesson = await call('POST', '/api/modules/lessons/v3', { title: source.title, intro: source.intro,
      sections: [{ id: sectionId, title: source.sections[0].title, content: source.sections[0].content, references }], materials: [] });
    fs.writeFileSync(path.join(destination, 'lesson.json'), JSON.stringify(lesson, null, 2));
    const options = { baseVersion: lesson.version, kind, includeAnswers, includeTeacherNotes,
      sectionIds: [sectionId], materialReferenceIds: [], answerSpaceLines: lines };
    const records = [];
    let writingSpaceFlows = false;
    for (const format of ['docx', 'pdf']) {
      const record = await call('POST', `/api/modules/lessons/v3/${lesson.id}/exports`, { ...options, format });
      const job = await wait(record.jobId);
      const bytes = await download(`/api/workbench/files/${job.outputFileIds[0]}/content`);
      const target = path.join(destination, `output.${format}`); fs.writeFileSync(target, bytes);
      if (format === 'docx') {
        const zip = await JSZip.loadAsync(bytes), xml = await zip.file('word/document.xml').async('string');
        assert.match(xml, /<m:f>/); assert.match(xml, /<m:rad>/); assert.match(xml, /<w:drawing>/);
        assert.equal((xml.match(/<w:drawing>/g) ?? []).length, 3);
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        const blankLines = Array.from(document.getElementsByTagName('w:p')).filter(p => p.textContent === ' ');
        assert.equal(blankLines.length, kind === 'lesson-plan' ? 0 : lines * 6);
        const attachedBlankLines = blankLines.filter(p => Array.from(p.getElementsByTagName('w:pStyle'))
          .some(style => style.getAttribute('w:val') === 'KeepNext'));
        writingSpaceFlows = attachedBlankLines.length === (kind === 'lesson-plan' ? 0 : Math.max(0, Math.min(lines, 4) - 1) * 6) &&
          !Array.from(document.getElementsByTagName('w:br')).some(b => b.getAttribute('w:type') === 'page');
        const previewJob = await call('POST', `/api/workbench/files/${job.outputFileIds[0]}/preview`, {}); await wait(previewJob.id);
        const preview = await call('GET', `/api/workbench/files/${job.outputFileIds[0]}/preview`);
        fs.writeFileSync(path.join(destination, 'output-office.pdf'), await download(`/api/workbench/files/${preview.renditionFileId}/content`));
      }
      records.push({ format, fileId: job.outputFileIds[0], jobId: job.id });
    }
    const layouts = {};
    for (const name of ['output', 'output-office']) {
      const target = path.join(destination, `${name}.pdf`);
      execFileSync('pdftoppm', ['-scale-to', '1400', '-png', target, path.join(destination, name)]);
      layouts[name] = inspectPagination(target);
      layouts[name].blankPages = [];
      for (const image of fs.readdirSync(destination).filter(file => new RegExp(`^${name}-\\d+\\.png$`).test(file))) {
        const stats = await sharp(path.join(destination, image)).stats();
        if (!stats.channels.some(channel => channel.min < 250)) layouts[name].blankPages.push(Number(image.match(/-(\d+)\.png$/)[1]));
      }
      if (layouts[name].blankPages.length) {
        assert.ok(longQuestion && lines === 20 && writingSpaceFlows, '空白页仅可来自明确请求的长作答区');
        assert.deepEqual(layouts[name].blankPages, [layouts[name].pages], '自然延续的作答空白仅在末页');
        assert.ok(layouts[name].blankPages[0] > layouts[name].imagePages[2], '题面和配图没有丢到空白页');
      }
      const content = execFileSync('pdftotext', [target, '-'], { encoding: 'utf8' }).replace(/\s/g, '');
      for (const marker of ['答案与解析', '根号内非负且分母不为零']) assert.equal(content.includes(marker), includeAnswers, marker);
      assert.equal(content.includes('C22教师注记-勿发学生'), includeTeacherNotes);
      assert.ok(!content.includes('PRIVATE-NOTE'));
      if (longQuestion) {
        for (let i = 1; i <= 65; i++) assert.ok(content.includes(`长题段落${i}：`), `长题段落 ${i} 完整`);
        assert.ok(content.includes('2求体积。'));
      }
    }
    result = { directory, options, longQuestion, writingSpaceFlows, records, layouts };
    fs.writeFileSync(path.join(destination, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (check && !longQuestion) Object.values(layouts).forEach(assertPagination);
    if (check && longQuestion) for (const layout of Object.values(layouts)) {
      assert.ok(layout.q6LastPart > layout.q6, '超过一页的题目可自然分页');
      if (longQuestion !== 'narrative') assert.equal(layout.imagePages[2], layout.q6LastPart, '长题尾部小问与必需图仍相邻同页');
    }
    completed = true;
    return result;
  } finally {
    await world.close();
    if (completed) fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runNativePagination({ destination: path.resolve(process.env.PAGINATION_EVIDENCE), kind: process.env.PAGINATION_KIND ?? 'handout',
    lines: Number(process.env.PAGINATION_LINES ?? 10), includeAnswers: process.env.PAGINATION_ANSWERS === '1',
    includeTeacherNotes: process.env.PAGINATION_NOTES === '1',
    longQuestion: process.env.PAGINATION_LONG === 'narrative' ? 'narrative' : process.env.PAGINATION_LONG === '1' });
}
