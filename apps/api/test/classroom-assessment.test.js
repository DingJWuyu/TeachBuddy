import { validateStoredData } from '../src/modules/classroom/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { C, createClassroomWorld, teacher, upload } from './classroom-http-fixture.js';
export async function seedExam(a) {
  const file = await upload(a.client, 'triangle.png', fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url)), 'image/png');
  const tag = await a.call('POST', C + '/tags', {
    name: '函数'
  }, 201);
  const exam = await a.call('POST', C + '/exams', {
    name: '期末',
    subject: '数学',
    occurredOn: '2026-01-05',
    totalMax: 20,
    source: [{
      fileId: file.id,
      renditionFileId: null
    }],
    questions: [{
      label: '1',
      groupLabel: null,
      maxScore: 10,
      tagIds: [tag.id],
      locations: []
    }, {
      label: '2',
      groupLabel: null,
      maxScore: 10,
      tagIds: [],
      locations: []
    }]
  }, 201);
  return {
    exam,
    file,
    tag
  };
}
test('classroom assessment: fixed source locations, tags and deleted exam reads', async () => {
  const world = await createClassroomWorld();
  try {
    const a = await teacher(world),
      b = await teacher(world, 'assessment-b@example.test'),
      {
        exam,
        file,
        tag
      } = await seedExam(a);
    await b.call('POST', C + '/exams', {
      name: '越界',
      subject: '数学',
      occurredOn: '2026-01-05',
      totalMax: 10,
      source: [{
        fileId: file.id,
        renditionFileId: null
      }],
      questions: []
    }, 404);
    const preview = await world.workbench.files.ensurePreview({
      accountKey: a.session.account.accountKey
    }, file.id);
    assert.ok(preview.pages.length);
    const body = {
      name: exam.name,
      subject: exam.subject,
      occurredOn: exam.occurredOn,
      totalMax: exam.totalMax,
      source: [{
        fileId: file.id,
        renditionFileId: preview.renditionFileId
      }],
      questions: exam.questions.map((q, i) => ({
        ...q,
        locations: i ? [] : [{
          fileId: file.id,
          renditionFileId: preview.renditionFileId,
          page: 1,
          box: {
            x: 0,
            y: 0,
            width: .5,
            height: .5
          }
        }]
      })),
      baseVersion: exam.version
    };
    const located = await a.call('PUT', C + '/exams/' + exam.id, body);
    await a.call('PUT', C + '/exams/' + exam.id, {
      ...body,
      baseVersion: located.version,
      questions: body.questions.map((q, i) => ({
        ...q,
        locations: i ? [] : [{
          ...q.locations[0],
          page: 999
        }]
      }))
    }, 422);
    assert.equal((await a.call('GET', C + '/tags/' + tag.id)).name, tag.name);
    const target = await a.call('POST', C + '/tags', {
      name: '函数应用'
    }, 201);
    const merged = await a.call('POST', C + '/tags/' + tag.id + '/merge', {
      baseVersion: tag.version,
      targetId: target.id,
      targetVersion: target.version
    });
    assert.deepEqual(merged.affectedExamIds, [exam.id]);
    const rewritten = await a.call('GET', C + '/exams/' + exam.id);
    assert.equal(rewritten.version, located.version + 1);
    assert.deepEqual(rewritten.questions[0].tagIds, [target.id]);
    await a.call('POST', C + '/tags', {
      name: '  函数应用  '
    }, 409);
    const deleted = await a.call('PUT', C + '/exams/' + exam.id + '/deletion', {
      baseVersion: rewritten.version,
      deleted: true
    });
    assert.equal((await a.call('GET', C + '/exams')).items.length, 0);
    assert.equal((await a.call('GET', C + '/exams/' + exam.id)).id, exam.id);
    assert.equal((await a.call('PUT', C + '/exams/' + exam.id + '/deletion', {
      baseVersion: deleted.version,
      deleted: false
    })).deletedAt, null);
    const finalTag = await a.call('POST', C + '/tags', {
      name: '综合应用'
    }, 201);
    await a.call('POST', C + '/tags/' + target.id + '/merge', {
      baseVersion: target.version,
      targetId: finalTag.id,
      targetVersion: finalTag.version
    });
    const originalAlias = await a.call('GET', C + '/tags/' + tag.id);
    assert.equal(originalAlias.mergedIntoId, finalTag.id);
    assert.equal(originalAlias.version, merged.source.version + 1);
    assert.equal(validateStoredData(world.workbench.db, {
      readFile: world.workbench.files.read,
      readRendition: world.workbench.files.readRendition
    }), true);
  } finally {
    await world.close();
  }
});
