import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { C, teacher, call, upload } from './classroom-http-fixture.js';
import { paperImage, paperFigure, paperDocx } from './fixtures/classroom/paper.mjs';

async function download(client, route, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const url = new URL(route, client.baseUrl);
    const request = https.get(url, { rejectUnauthorized: false,
      headers: { Cookie: client.jar.header(), 'X-TeachBuddy-Page': client.pageId } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try {
          assert.equal(response.statusCode, expectedStatus, route);
          assert.equal(response.headers['cache-control'], 'no-store');
          resolve(Buffer.concat(chunks));
        } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
  });
}

async function preview(a, file) {
  const accepted = await a.call('POST', `/api/workbench/files/${file.id}/preview`, {}, 202);
  const deadline = Date.now() + 120000;
  let job;
  while (Date.now() < deadline) {
    job = await a.call('GET', `/api/workbench/jobs/${accepted.id}`);
    if (!['queued', 'running', 'cancelling'].includes(job.state)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(job?.state, 'succeeded', JSON.stringify(job));
  assert.equal((await a.call('POST', `/api/workbench/files/${file.id}/preview`, {}, 202)).id, accepted.id);
  const value = await a.call('GET', `/api/workbench/files/${file.id}/preview`);
  assert.equal(value.state, 'ready');
  assert.ok(value.pageCount >= 1);
  assert.equal(value.pages.length, value.pageCount);
  return value;
}

test('real authenticated DOCX, PDF and image papers retain fixed classroom locations across restart and reject unrelated sources', { timeout: 180000 }, async () => {
  const root = path.resolve('test-results/classroom-backend');
  fs.mkdirSync(root, { recursive: true });
  const evidence = fs.mkdtempSync(path.join(root, 'paper-'));
  const directory = path.join(evidence, 'data');
  fs.mkdirSync(directory);
  const options = { directory, workbench: { conversion: { officeRoot: process.env.MATERIALS_OFFICE_ROOT } } };
  let world = await createIntegration(options), passed = false;
  try {
    const a = await teacher(world, 'paper-a@example.test');
    const b = await teacher(world, 'paper-b@example.test');
    const imageBytes = await paperImage();
    const image = await upload(a.client, 'exam-original.png', imageBytes, 'image/png');
    const figure = await upload(a.client, 'triangle-figure.png', await paperFigure(), 'image/png');
    const docxBytes = await paperDocx({ files: world.workbench.files,
      principal: { accountKey: a.session.account.accountKey }, figureFileId: figure.id });
    const zip = await JSZip.loadAsync(docxBytes);
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /班级考试原卷/);
    assert.match(xml, /<m:oMath/);
    assert.match(xml, /<w:drawing>/);
    const docx = await upload(a.client, 'exam-original.docx', docxBytes);
    const docxPreview = await preview(a, docx);
    const pdfBytes = await download(a.client, `/api/workbench/files/${docxPreview.renditionFileId}/content`);
    assert.ok(pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-')));
    const pdfPath = path.join(evidence, 'exam-original.pdf');
    fs.writeFileSync(pdfPath, pdfBytes);
    const pdfText = execFileSync('/usr/bin/pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8' });
    assert.match(pdfText, /班级考试原卷/);
    assert.match(pdfText, /直角三角形 ABC/);
    const pdf = await upload(a.client, 'exam-original.pdf', pdfBytes, 'application/pdf');
    const pdfPreview = await preview(a, pdf);
    const imagePreview = await preview(a, image);
    fs.writeFileSync(path.join(evidence, 'exam-original.docx'), docxBytes);
    fs.writeFileSync(path.join(evidence, 'exam-original.png'), imageBytes);
    const papers = [
      { name: 'docx', file: docx, preview: docxPreview },
      { name: 'pdf', file: pdf, preview: pdfPreview },
      { name: 'image', file: image, preview: imagePreview },
    ];
    const saved = [];
    for (const paper of papers) {
      const source = { fileId: paper.file.id, renditionFileId: paper.preview.renditionFileId };
      const firstPage = await download(a.client, `/api/workbench/files/${paper.preview.pages[0].imageFileId}/content`);
      fs.writeFileSync(path.join(evidence, `${paper.name}-page-1.png`), firstPage);
      const dimensions = await sharp(firstPage).metadata();
      assert.ok(dimensions.width > 500 && dimensions.height > 500);
      const body = { name: `同份原卷 ${paper.name}`, subject: '数学', occurredOn: '2026-01-05', totalMax: 10,
        source: [source], questions: [
          { label: '1', groupLabel: null, maxScore: 4, tagIds: [], locations: [{ ...source, page: 1, box: null }] },
          { label: '2', groupLabel: null, maxScore: 6, tagIds: [], locations: [{ ...source, page: 1,
            box: paper.name === 'image' ? { x: .05, y: .25, width: .9, height: .55 } : { x: .07, y: .16, width: .65, height: .3 } }] },
        ] };
      const key = randomUUID();
      const exam = await a.call('POST', C + '/exams', body, 201, key);
      assert.deepEqual(await a.call('POST', C + '/exams', body, 201, key), exam);
      assert.deepEqual((await a.call('GET', C + '/exams/' + exam.id)).source, [source]);
      await b.call('GET', C + '/exams/' + exam.id, undefined, 404);
      await b.call('GET', `/api/workbench/files/${paper.file.id}/preview`, undefined, 404);
      await download(b.client, `/api/workbench/files/${source.renditionFileId}/content`, 404);
      await b.call('POST', C + '/exams', body, 404);
      for (const [patch, field] of [
        [{ source: [{ ...source, renditionFileId: paper.name === 'image' ? docxPreview.renditionFileId : imagePreview.renditionFileId }] }, '/renditionFileId'],
        [{ questions: body.questions.map((question, index) => index ? question : { ...question, locations: [{ ...source, page: paper.preview.pageCount + 1, box: null }] }) }, '/questions/0/locations/0/page'],
        [{ questions: body.questions.map((question, index) => index ? question : { ...question, locations: [{ fileId: paper.name === 'image' ? pdf.id : image.id, renditionFileId: imagePreview.renditionFileId, page: 1, box: null }] }) }, '/questions/0/locations/0/fileId'],
        [{ questions: body.questions.map((question, index) => index ? question : { ...question, locations: [{ ...source, page: 1, box: { x: .9, y: 0, width: .2, height: .3 } }] }) }, '/questions/0/locations/0/box'],
      ]) {
        const problem = await a.call('PUT', C + '/exams/' + exam.id, { ...body, baseVersion: exam.version, ...patch }, 422);
        assert.equal(problem.field, field);
        assert.deepEqual(await a.call('GET', C + '/exams/' + exam.id), exam);
      }
      const location = exam.questions[1].locations[0];
      const crop = await a.call('POST', '/api/workbench/files/crops', { location: { kind: 'page', ...location } }, 201);
      const cropped = await download(a.client, `/api/workbench/files/${crop.id}/content`);
      assert.ok((await sharp(cropped).metadata()).width > 100);
      fs.writeFileSync(path.join(evidence, `${paper.name}-question-2.png`), cropped);
      saved.push({ ...paper, exam });
    }
    await world.close();
    world = await createIntegration(options);
    const client = world.client();
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const login = await client.request('POST', '/api/auth/login', { body: { email: 'paper-a@example.test', password: 'password-classroom', rememberMe: true } });
    assert.equal(login.status, 200, login.text);
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: login.json.id, rememberMe: true } })).status, 200);
    const read = call(client);
    for (const paper of saved) {
      assert.deepEqual(await read('GET', C + '/exams/' + paper.exam.id), paper.exam);
      assert.deepEqual(await read('GET', `/api/workbench/files/${paper.file.id}/preview`), paper.preview);
      const bytes = await download(client, `/api/workbench/files/${paper.preview.renditionFileId}/content`);
      assert.deepEqual(bytes, paper.name === 'image' ? imageBytes : pdfBytes);
      assert.deepEqual(await download(client, `/api/workbench/files/${paper.file.id}/content`),
        paper.name === 'docx' ? docxBytes : paper.name === 'pdf' ? pdfBytes : imageBytes);
      assert.deepEqual(await download(client, `/api/workbench/files/${paper.preview.pages[0].imageFileId}/content`),
        fs.readFileSync(path.join(evidence, `${paper.name}-page-1.png`)));
    }
    fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify({ identity: 'real-auth', mail: 'fake-mail',
      officeRoot: process.env.MATERIALS_OFFICE_ROOT ?? null, pandocPath: process.env.MATERIALS_PANDOC_PATH ?? '/usr/bin/pandoc',
      papers: saved, restart: 'fixed sources, questions and renditions retained',
      accountIsolation: 'other real account receives 404', sourceRelations: 'wrong rendition, outside source, bad page and box rejected without mutation' }, null, 2) + '\n');
    passed = true;
    console.log('Classroom paper evidence:', evidence);
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error('Retained failed classroom paper evidence:', evidence);
  }
});
