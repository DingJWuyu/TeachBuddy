import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTestDirectory } from '../support/directories.js';
import path from 'node:path';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import JSZip from 'jszip';
import { application, upload, download, json, finished, filesPath, readFixture } from './helpers.js';

async function requestPreview(client, file) {
  const accepted = await json(client, 'POST', `${filesPath}/${file.id}/preview`, {}, 202);
  return finished(client, accepted.id);
}

test('C-R1 Office 主动关系、宏及实际超限压缩包无法转换，原件仍可取回', { timeout: 180000 }, async t => {
  const world = await application(t);
  const base = readFixture('questions/W.docx');
  for (const kind of ['external', 'macro', 'expanded']) {
    const zip = await JSZip.loadAsync(base);
    if (kind === 'external') {
      const file = 'word/_rels/document.xml.rels';
      zip.file(file, (await zip.file(file).async('string')).replace('</Relationships>', '<Relationship Id="probe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file:///unmounted-teachbuddy-fixture" TargetMode="External"/></Relationships>'));
    } else if (kind === 'macro') zip.file('word/vbaProject.bin', 'inert macro fixture');
    else {
      const zero = Buffer.alloc(1024 * 1024);
      zip.file('word/oversized.bin', Readable.from((async function* () { for (let i = 0; i < 513; i++) yield zero; })()));
    }
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } });
    const file = await upload(world.client, `${kind}.docx`, bytes);
    assert.equal((await requestPreview(world.client, file)).state, 'failed', `${kind} 输入必须在转换前被拒绝`);
    assert.deepEqual(await download(world.client, file.id), bytes, '拒绝转换不应破坏原件');
  }
  world.complete();
});

test('C-R1 实际转换沙箱既读不到自建宿主哨兵，也连接不到自建宿主端口', { timeout: 180000 }, async t => {
  const directory = createTestDirectory('teachbuddy-sandbox-');
  let passed = false;
  t.after(() => { if (passed) fs.rmSync(directory, { recursive: true, force: true }); else t.diagnostic(`保留沙箱现场 ${directory}`); });
  const officeRoot = path.join(directory, 'office');
  fs.mkdirSync(path.join(officeRoot, 'program'), { recursive: true });
  const sentinel = path.join(directory, 'host-sentinel.txt');
  fs.writeFileSync(sentinel, 'owned-host-sentinel');
  let hits = 0;
  const server = createServer((_request, response) => { hits++; response.end('owned local probe'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  fs.writeFileSync(path.join(officeRoot, 'sample.pdf'), readFixture('materials/c22.pdf'));
  const probe = `const fs=require('node:fs'),http=require('node:http');
if(fs.existsSync(${JSON.stringify(sentinel)})) process.exit(21);
const request=http.get('http://127.0.0.1:${server.address().port}',()=>process.exit(22));
request.setTimeout(1000,()=>request.destroy());
request.on('error',()=>fs.copyFileSync('/office/sample.pdf','/output/source.pdf'));`;
  fs.writeFileSync(path.join(officeRoot, 'probe.cjs'), probe);
  fs.writeFileSync(path.join(officeRoot, 'program/soffice'), '#!/bin/sh\nexec /runtime/node /office/probe.cjs\n', { mode: 0o700 });
  const world = await application(t, { workbench: { conversion: { officeRoot } } });
  const file = await upload(world.client, 'owned-sandbox.docx', readFixture('questions/W.docx'));
  const job = await requestPreview(world.client, file);
  assert.equal(job.state, 'succeeded', `沙箱内受控探针应确认宿主文件和网络均不可达，owned server hits=${hits}`);
  const view = await json(world.client, 'GET', `${filesPath}/${file.id}/preview`);
  assert.equal(view.pageCount, 3, '探针仍须完成真实 PDF 页转换');
  assert.equal(hits, 0, '沙箱不能访问宿主的隔离测试服务');
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'owned-host-sentinel');
  world.complete();
  passed = true;
});
