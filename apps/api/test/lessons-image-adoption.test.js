import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { http, doc } from './teaching-time-classes-materials-fixture.js';
import { loadRegionReplay, blankCells } from './fixtures/lessons-region-replay.js';

const base = '/api/modules/lessons/v3';
const writable = lesson => ({ baseVersion: lesson.version, title: lesson.title, intro: lesson.intro,
  sections: lesson.sections.map(({ id, title, content, references }) => ({ id, title, content, references })), materials: [] });
async function complete(call, job) {
  for (let i = 0; i < 300; i++) {
    const result = await call('GET', `/api/workbench/jobs/${job.id}`);
    if (!['queued', 'running', 'cancelling'].includes(result.state)) {
      assert.equal(result.state, 'succeeded', JSON.stringify(result)); return result;
    }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.fail('Job did not complete');
}

test('image adoption HTTP/SQLite: controlled parent and genuine crop replay, provenance guards, copy/history and personal ZIP', async () => {
  const replay = loadRegionReplay();
  const world = await createIntegration({ workbench: { recognition: { home: null, recognizer: replay.recognizer } } });
  let passed = false;
  try {
    const { client, session } = await registerMath(world, 'lesson-image-api@example.test'), call = http(client);
    const accountKey = session.account.accountKey, { parent, preview } = replay.seed(world, accountKey);
    let resource = await call('POST', '/api/modules/resources/items', { title: '受控配图资料', fileId: replay.binding.fileId, folderId: null, tagIds: [], note: '' }, 201);
    let lesson = await call('POST', base, { title: '配图独立校对', intro: doc('保留整课'), sections: [], materials: [] }, 201);
    const url = `${base}/${lesson.id}`, adoptUrl = `${url}/sections/adopt-page`;
    const parentRead = await call('GET', `/api/workbench/files/${replay.binding.fileId}/recognition/pages/7?renditionFileId=${replay.binding.renditionFileId}`);
    assert.deepEqual(parentRead.document, parent.document); assert.equal(replay.replays, 0);
    await complete(call, await call('POST', `/api/workbench/files/${replay.imageId}/preview`, {}, 202));
    const imagePreview = await call('GET', `/api/workbench/files/${replay.imageId}/preview`);
    await complete(call, await call('POST', `/api/workbench/files/${replay.imageId}/recognition`, { renditionFileId: imagePreview.renditionFileId, pages: [1] }, 202));
    const child = await call('GET', `/api/workbench/files/${replay.imageId}/recognition/pages/1?renditionFileId=${imagePreview.renditionFileId}`);
    assert.deepEqual(child.document, replay.child.document); assert.equal(replay.replays, 1);
    assert.equal(blankCells(child.document), 14);
    const content = structuredClone(child.document); content.blocks[0].rows[1][2].blocks = doc('9').blocks;
    assert.equal(blankCells(content), 13);
    const input = { baseVersion: lesson.version, resourceId: resource.id, resourceVersion: resource.version,
      ...replay.binding, resultId: replay.parentResultId, title: '独立数值表', content,
      recognizedImage: { fileId: replay.imageId, renditionFileId: imagePreview.renditionFileId, resultId: child.resultId } };
    await call('POST', adoptUrl, { ...input, baseVersion: 999 }, 409);
    await call('POST', adoptUrl, { ...input, resourceVersion: 999 }, 409);
    await call('POST', adoptUrl, { ...input, page: 8 }, 404);
    await call('POST', adoptUrl, { ...input, recognizedImage: { ...input.recognizedImage, page: 1 } }, 422);
    await call('POST', adoptUrl, { ...input, recognizedImage: { ...input.recognizedImage, fileId: preview.pages[7].imageFileId } }, 422);
    assert(parent.originalAssetFileIds.length > 0);
    await call('POST', adoptUrl, { ...input, recognizedImage: { ...input.recognizedImage, fileId: parent.originalAssetFileIds[0] } }, 422);
    await call('POST', adoptUrl, { ...input, recognizedImage: { ...input.recognizedImage, renditionFileId: replay.binding.renditionFileId } }, 422);
    await call('POST', adoptUrl, { ...input, recognizedImage: { ...input.recognizedImage, resultId: replay.parentResultId } }, 404);
    // Even a visible image is rejected if it is not an asset of this result.
    const updateResult = value => world.workbench.db.prepare('UPDATE materials_recognition_results SET value=? WHERE id=?').run(JSON.stringify(value), value.resultId);
    updateResult({ ...parent, assetFileIds: parent.assetFileIds.filter(id => id !== replay.imageId) });
    await call('POST', adoptUrl, input, 422); updateResult(parent);
    updateResult({ ...child, state: 'failed' }); await call('POST', adoptUrl, input, 404); updateResult(child);
    const second = await registerMath(world, 'lesson-image-other@example.test');
    await http(second.client)('POST', adoptUrl, input, 404);
    const foreignId = randomUUID();
    world.workbench.db.prepare('INSERT INTO materials_recognition_results VALUES (?,?,?,?,?)')
      .run(foreignId, second.session.account.accountKey, child.inputHash, child.revision, JSON.stringify({ ...child, resultId: foreignId }));
    await call('POST', adoptUrl, { ...input, recognizedImage: { ...input.recognizedImage, resultId: foreignId } }, 404);
    world.workbench.db.prepare('DELETE FROM materials_recognition_results WHERE id=?').run(foreignId);
    assert.equal((await call('GET', `${url}/history`)).items.length, 1);
    const key = randomUUID(); lesson = await call('POST', adoptUrl, input, 200, key);
    assert.deepEqual(await call('POST', adoptUrl, input, 200, key), lesson);
    assert.equal(lesson.sections.length, 1);
    const source = lesson.sections[0].pageSource;
    assert.equal(source.page, 7); assert.equal(source.recognizedImage.page, 1);
    assert.equal(source.fileId, replay.binding.fileId); assert.equal(source.recognizedImage.fileId, replay.imageId);
    assert.deepEqual(source.machineDocument, parent.document);
    assert.deepEqual(source.recognizedImage.machineDocument, child.document);
    assert.deepEqual(source.adoptedDocument, content);
    assert.deepEqual(lesson.sections[0].content.blocks[0].rows.map(row => row.length), [10, 10, 10]);
    const changed = writable(lesson); changed.sections[0].content = doc('后续修改'); lesson = await call('PUT', url, changed);
    assert.deepEqual(lesson.sections[0].pageSource, source);
    const copied = await call('POST', `${url}/copy`, { baseVersion: lesson.version }, 201);
    assert.deepEqual(copied.sections[0].pageSource, source);
    const target = await call('POST', base, { title: '环节复用', intro: doc(''), sections: [], materials: [] }, 201);
    const reused = await call('POST', `${base}/${target.id}/sections/copy`, { baseVersion: 1, sourceLessonId: lesson.id, sourceVersion: lesson.version, sectionIds: [lesson.sections[0].id] });
    assert.deepEqual(reused.sections[0].pageSource, source);
    lesson = await call('POST', `${url}/history/restore`, { baseVersion: lesson.version, version: 2 });
    assert.deepEqual(lesson.sections[0].content, content); assert.deepEqual(lesson.sections[0].pageSource, source);
    resource = await call('POST', `/api/modules/resources/items/${resource.id}/deletion`, { baseVersion: resource.version, deleted: true });
    await call('POST', adoptUrl, { ...input, baseVersion: lesson.version, resourceVersion: resource.version }, 409);
    assert.deepEqual((await call('GET', url)).sections[0].pageSource, source);
    await call('POST', `/api/modules/resources/items/${resource.id}/purge`, { baseVersion: resource.version });
    const exported = await call('POST', '/api/reliability/v1/exports', {}, 202);
    let status;
    for (let i = 0; i < 500; i++) {
      status = await call('GET', `/api/reliability/v1/exports/${exported.id}`);
      if (!['queued', 'running'].includes(status.state)) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(status.state, 'ready', JSON.stringify(status));
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(world.directory, 'personal-exports', `${exported.id}.zip`)));
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    const entry = manifest.objects.find(object => object.key.kind === 'lesson' && object.key.id === lesson.id);
    assert.deepEqual(JSON.parse(await zip.file(entry.dataPath).async('string')).value.sections[0].pageSource, source);
    for (const provenance of [source, source.recognizedImage])
      for (const id of new Set([provenance.fileId, provenance.renditionFileId, provenance.imageFileId, provenance.rawFileId, ...provenance.assetFileIds]))
        assert(manifest.files.some(file => file.path.startsWith(`files/${id}/`)), `Missing provenance asset ${id}`);
    world.workbench.db.prepare('DELETE FROM materials_recognition_results').run();
    assert.deepEqual((await call('GET', url)).sections[0].pageSource, source);
    assert.deepEqual((await call('GET', `${url}/history/2`)).sections[0].pageSource, source);
    assert.equal(replay.replays, 1, 'All subsequent reads/adoptions use stored results');
    passed = true;
  } finally { await world.close(); if (passed) fs.rmSync(world.directory, { recursive: true, force: true }); }
});
