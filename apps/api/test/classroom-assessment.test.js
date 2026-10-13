import { validateStoredData } from '../src/modules/classroom/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { C, createClassroomWorld, teacher, upload, studentBody } from './classroom-http-fixture.js';
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
  let passed = false;
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
    passed = true;
  } finally {
    await world.close(passed);
  }
});
test('classroom scores require exact hundredths and positive maxima at least 0.01', async () => {
  const world = await createClassroomWorld();
  let passed = false;
  try {
    const a = await teacher(world, 'score-precision@example.test');
    const {
      exam
    } = await seedExam(a);
    const input = {
      name: '小数满分',
      subject: exam.subject,
      occurredOn: exam.occurredOn,
      source: exam.source,
      questions: [{
        label: '1',
        groupLabel: null,
        maxScore: 1,
        tagIds: [],
        locations: []
      }]
    };
    for (const invalid of [1e-12, 0.000000001, 0.010000000001, 0.291]) {
      await a.call('POST', C + '/exams', {
        ...input,
        totalMax: invalid
      }, 422);
      await a.call('POST', C + '/exams', {
        ...input,
        totalMax: 1,
        questions: [{
          ...input.questions[0],
          maxScore: invalid
        }]
      }, 422);
    }
    const classroom = await a.call('POST', C + '/classes', {
      name: '小数班'
    }, 201);
    const student = await a.call('POST', C + '/students', studentBody(classroom.id, '零分学生', '001'), 201);
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['姓名', '总分', '1'], ['零分学生', 0, 0]]), '成绩');
    const spreadsheet = await upload(a.client, 'zero-score.xlsx', XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    }));
    for (const valid of [0.01, 0.29, 1.15]) {
      const stored = await a.call('POST', C + '/exams', {
        ...input,
        totalMax: valid,
        questions: [{
          ...input.questions[0],
          maxScore: valid
        }]
      }, 201);
      assert.equal(stored.totalMax, valid);
      assert.equal(stored.questions[0].maxScore, valid);
      const draft = await a.call('POST', C + '/imports', {
        examId: stored.id,
        classId: classroom.id,
        sourceFileId: spreadsheet.id
      }, 201);
      const mapped = await a.call('PUT', C + '/imports/' + draft.id, {
        baseVersion: draft.version,
        rows: null,
        mapping: {
          sheetIndex: 0,
          headerRow: 1,
          firstDataRow: 2,
          lastDataRow: 2,
          nameColumn: 1,
          studentNumberColumn: null,
          totalColumn: 2,
          attendanceColumn: null,
          questionColumns: [{
            column: 3,
            questionId: stored.questions[0].id
          }],
          ignoredRows: []
        }
      });
      const confirmed = await a.call('POST', C + '/imports/' + draft.id + '/confirmation', {
        baseVersion: mapped.version
      });
      assert.equal(confirmed.result.rows[0].totalScore, 0);
      const statistics = await a.call('GET', C + '/classes/' + classroom.id + '/statistics?examId=' + stored.id);
      assert.equal(statistics.points[0].overall.rate, 0);
      assert.equal(statistics.points[0].overall.scoredCount, 1);
      assert.equal(statistics.points[0].questions[0].rate, 0);
      const individual = await a.call('GET', C + '/students/' + student.id + '/statistics?examId=' + stored.id);
      assert.equal(individual.points[0].overall.rank, 1);
    }
    passed = true;
  } finally {
    await world.close(passed);
  }
});
