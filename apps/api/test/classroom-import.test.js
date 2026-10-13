import { validateStoredData } from '../src/modules/classroom/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { C, createClassroomWorld, teacher, upload, studentBody } from './classroom-http-fixture.js';
async function setup(a) {
  const cls = await a.call('POST', C + '/classes', {
    name: '一班'
  }, 201);
  const students = [];
  for (const [name, num] of [['同名', '001'], ['同名', '002'], ['乙', '003'], ['丙', '004']]) {
    students.push(await a.call('POST', C + '/students', studentBody(cls.id, name, num), 201));
  }
  const paper = await upload(a.client, 'paper.png', fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url)));
  const exam = await a.call('POST', C + '/exams', {
    name: '第一次正式考试',
    subject: '数学',
    occurredOn: '2026-01-05',
    totalMax: 20,
    source: [{
      fileId: paper.id,
      renditionFileId: null
    }],
    questions: [{
      label: '1',
      groupLabel: null,
      maxScore: 10,
      tagIds: [],
      locations: []
    }, {
      label: '2',
      groupLabel: null,
      maxScore: 10,
      tagIds: [],
      locations: []
    }]
  }, 201);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['姓名', '学号', '总分', '第一题', '第二题', '状态'], ['同名', '001', 18, 10, 10, ''], ['同名', '002', 18, 10, null, ''], ['乙', '003', null, null, null, '缺考']]), '成绩');
  const file = await upload(a.client, 'scores.xlsx', XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx'
  }));
  const importKey = randomUUID();
  const importBody = {
    classId: cls.id,
    examId: exam.id,
    sourceFileId: file.id
  };
  const imp = await a.call('POST', C + '/imports', importBody, 201, importKey);
  const mapping = {
    sheetIndex: 0,
    headerRow: 1,
    firstDataRow: 2,
    lastDataRow: 4,
    nameColumn: 1,
    studentNumberColumn: 2,
    totalColumn: 3,
    attendanceColumn: 6,
    questionColumns: exam.questions.map((q, i) => ({
      column: i + 4,
      questionId: q.id
    })),
    ignoredRows: []
  };
  return {
    cls,
    students,
    exam,
    file,
    imp,
    mapping,
    importKey,
    importBody
  };
}
test('classroom workbook HTTP: mapping generates candidates, confirmation is atomic, mismatch warning and missing scores survive', async () => {
  const world = await createClassroomWorld();
  let passed = false;
  try {
    const a = await teacher(world),
      s = await setup(a);
    await a.call('POST', C + '/imports/' + s.imp.id + '/confirmation', {
      baseVersion: s.imp.version
    }, 409);
    const imp = await a.call('PUT', C + '/imports/' + s.imp.id, {
      baseVersion: s.imp.version,
      mapping: s.mapping,
      rows: null
    });
    assert.equal(imp.rows[0].studentId, s.students[0].id);
    assert.equal(imp.rows[1].scores[s.exam.questions[1].id], null);
    assert.equal(imp.rows[2].status, 'absent');
    assert.ok(imp.issues.some(i => i.code === 'total-mismatch' && i.severity === 'warning'));
    world.workbench.db.exec("CREATE TRIGGER classroom_confirm_failure BEFORE UPDATE ON classroom_imports WHEN NEW.state='confirmed' BEGIN SELECT RAISE(ABORT,'fail'); END");
    const key = randomUUID(),
      body = {
        baseVersion: imp.version
      };
    await a.call('POST', C + '/imports/' + imp.id + '/confirmation', body, 503, key);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) n FROM classroom_results').get().n, 0);
    assert.equal((await a.call('GET', C + '/imports/' + imp.id)).state, 'draft');
    world.workbench.db.exec('DROP TRIGGER classroom_confirm_failure');
    const confirmed = await a.call('POST', C + '/imports/' + imp.id + '/confirmation', body, 200, key);
    assert.deepEqual(await a.call('POST', C + '/imports/' + imp.id + '/confirmation', body, 200, key), confirmed);
    const blob = world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(s.file.id).blobName;
    const filesDirectory = path.join(world.directory, 'files', 'blobs');
    const originalBlob = path.join(filesDirectory, blob);
    fs.renameSync(originalBlob, originalBlob + '.temporarily-unavailable');
    try {
      assert.deepEqual(await a.call('POST', C + '/imports', s.importBody, 201, s.importKey), s.imp);
      assert.deepEqual(await a.call('POST', C + '/imports/' + imp.id + '/confirmation', body, 200, key), confirmed);
    } finally {
      fs.renameSync(originalBlob + '.temporarily-unavailable', originalBlob);
    }
    assert.equal(confirmed.result.rows.length, 4);
    assert.equal(confirmed.result.rows.find(r => r.studentId === s.students[0].id).totalScore, 18);
    assert.equal(confirmed.result.rows.find(r => r.studentId === s.students[3].id).status, 'unrecorded');
    await a.call('POST', C + '/imports/' + imp.id + '/confirmation', {
      baseVersion: confirmed.import.version
    }, 409);
    const stats = await a.call('GET', C + '/classes/' + s.cls.id + '/statistics');
    assert.equal(stats.points[0].overall.mean, 18);
    const e = {
      name: s.exam.name,
      subject: s.exam.subject,
      occurredOn: s.exam.occurredOn,
      totalMax: 20,
      source: s.exam.source,
      questions: [{
        ...s.exam.questions[0],
        maxScore: 5
      }, s.exam.questions[1]],
      baseVersion: s.exam.version
    };
    await a.call('PUT', C + '/exams/' + s.exam.id, e, 422);
    const corrected = await a.call('PUT', C + '/results/' + confirmed.result.id, {
      baseVersion: confirmed.result.version,
      examVersion: s.exam.version,
      rows: confirmed.result.rows.map(({
        studentSnapshot,
        ...r
      }) => r)
    });
    assert.equal(corrected.result.version, 2);
    assert.equal(validateStoredData(world.workbench.db, {
      readFile: world.workbench.files.read,
      readRendition: world.workbench.files.readRendition
    }), true);
    await a.call('PUT', C + '/results/' + confirmed.result.id, {
      baseVersion: confirmed.result.version,
      examVersion: s.exam.version,
      rows: confirmed.result.rows.map(({
        studentSnapshot,
        ...r
      }) => r)
    }, 409);
    const draft = await a.call('POST', C + '/imports', {
      classId: s.cls.id,
      examId: s.exam.id,
      sourceFileId: s.file.id
    }, 201);
    const mapped = await a.call('PUT', C + '/imports/' + draft.id, {
      baseVersion: draft.version,
      mapping: s.mapping,
      rows: null
    });
    await a.call('PUT', C + '/students/' + s.students[0].id, {
      ...studentBody(s.cls.id, '更名', '001'),
      baseVersion: s.students[0].version
    });
    await a.call('POST', C + '/imports/' + draft.id + '/confirmation', {
      baseVersion: mapped.version
    }, 409);
    passed = true;
  } finally {
    await world.close(passed);
  }
});
test('classroom explicit review resolves invalid source cells without bypassing score or identity validation', async () => {
  const world = await createClassroomWorld();
  let passed = false;
  try {
    const a = await teacher(world, 'review-source@example.test');
    const s = await setup(a);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['姓名', '学号', '总分', '第一题', '第二题', '状态'], ['同名', '001', '错误', '-', null, '未知'], ['同名', '002', 10, 0, 10, '']]), '成绩');
    const file = await upload(a.client, 'invalid-cells.xlsx', XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx'
    }));
    const draft = await a.call('POST', C + '/imports', {
      examId: s.exam.id,
      classId: s.cls.id,
      sourceFileId: file.id
    }, 201);
    const mapping = {
      ...s.mapping,
      lastDataRow: 3
    };
    let reviewed = await a.call('PUT', C + '/imports/' + draft.id, {
      baseVersion: draft.version,
      mapping,
      rows: null
    });
    assert.ok(reviewed.issues.some(i => i.severity === 'error'));
    await a.call('POST', C + '/imports/' + draft.id + '/confirmation', {
      baseVersion: reviewed.version
    }, 409);
    const corrected = reviewed.rows.map(row => ({
      ...row,
      status: 'present'
    }));
    await a.call('PUT', C + '/imports/' + draft.id, {
      baseVersion: reviewed.version,
      mapping,
      rows: corrected.map((row, i) => i ? row : {
        ...row,
        totalScore: -1
      })
    }, 422);
    reviewed = await a.call('PUT', C + '/imports/' + draft.id, {
      baseVersion: reviewed.version,
      mapping,
      rows: corrected.map(row => ({
        ...row,
        studentId: s.students[0].id
      }))
    });
    assert.ok(reviewed.issues.some(i => i.code === 'duplicate-student'));
    await a.call('POST', C + '/imports/' + draft.id + '/confirmation', {
      baseVersion: reviewed.version
    }, 409);
    reviewed = await a.call('PUT', C + '/imports/' + draft.id, {
      baseVersion: reviewed.version,
      mapping,
      rows: corrected
    });
    assert.deepEqual(reviewed.reviewedSourceRows, [2, 3]);
    assert.ok(!reviewed.issues.some(i => i.severity === 'error'));
    assert.ok(reviewed.issues.some(i => i.code === 'missing-question-score'));
    const confirmed = await a.call('POST', C + '/imports/' + draft.id + '/confirmation', {
      baseVersion: reviewed.version
    });
    const row = confirmed.result.rows.find(row => row.studentId === s.students[0].id);
    assert.equal(row.totalScore, null);
    assert.equal(row.status, 'present');
    assert.equal(row.scores[s.exam.questions[0].id], null);
    passed = true;
  } finally {
    await world.close(passed);
  }
});
for (const change of ['move', 'delete']) {
  test(`classroom reimport preserves historical rows after student ${change}`, async () => {
    const world = await createClassroomWorld();
    let passed = false;
    try {
      const a = await teacher(world, `history-${change}@example.test`);
      const s = await setup(a);
      const first = await a.call('PUT', C + '/imports/' + s.imp.id, {
        baseVersion: s.imp.version,
        mapping: s.mapping,
        rows: null
      });
      const original = await a.call('POST', C + '/imports/' + first.id + '/confirmation', {
        baseVersion: first.version
      });
      const historical = original.result.rows.find(row => row.studentId === s.students[0].id);
      if (change === 'move') {
        const target = await a.call('POST', C + '/classes', {
          name: '转入班'
        }, 201);
        await a.call('PUT', C + '/students/' + s.students[0].id, {
          ...studentBody(target.id, '改名后', '001'),
          baseVersion: s.students[0].version
        });
      } else {
        await a.call('PUT', C + '/students/' + s.students[0].id + '/deletion', {
          baseVersion: s.students[0].version,
          deleted: true
        });
      }
      const draft = await a.call('POST', C + '/imports', {
        examId: s.exam.id,
        classId: s.cls.id,
        sourceFileId: s.file.id
      }, 201);
      const mapped = await a.call('PUT', C + '/imports/' + draft.id, {
        baseVersion: draft.version,
        mapping: {
          ...s.mapping,
          ignoredRows: [2]
        },
        rows: null
      });
      const edited = await a.call('PUT', C + '/imports/' + draft.id, {
        baseVersion: mapped.version,
        mapping: mapped.mapping,
        rows: mapped.rows.map(row => row.sourceRow === 3 ? {
          ...row,
          totalScore: 5,
          scores: {
            [s.exam.questions[0].id]: 5,
            [s.exam.questions[1].id]: null
          }
        } : row)
      });
      const again = await a.call('POST', C + '/imports/' + draft.id + '/confirmation', {
        baseVersion: edited.version
      });
      assert.deepEqual(again.result.rows.find(row => row.studentId === s.students[0].id), historical);
      assert.equal(again.result.rows.find(row => row.studentId === s.students[1].id).totalScore, 5);
      const individual = await a.call('GET', C + '/students/' + s.students[0].id + '/statistics');
      assert.equal(individual.points.length, 1);
      assert.equal(individual.points[0].overall.totalScore, historical.totalScore);
      assert.equal(individual.points[0].overall.classReference.id, s.cls.id);
      assert.equal(validateStoredData(world.workbench.db, {
        readFile: world.workbench.files.read,
        readRendition: world.workbench.files.readRendition
      }), true);
      passed = true;
    } finally {
      await world.close(passed);
    }
  });
}
test('classroom result correction rejects unknown score keys without changing stored version', async () => {
  const world = await createClassroomWorld();
  let passed = false;
  try {
    const a = await teacher(world, 'unknown-question@example.test');
    const s = await setup(a);
    const mapped = await a.call('PUT', C + '/imports/' + s.imp.id, {
      baseVersion: s.imp.version,
      mapping: s.mapping,
      rows: null
    });
    const confirmed = await a.call('POST', C + '/imports/' + mapped.id + '/confirmation', {
      baseVersion: mapped.version
    });
    const unknown = randomUUID();
    const rows = confirmed.result.rows.map(({
      studentSnapshot,
      ...row
    }) => ({
      ...row,
      scores: {
        ...row.scores,
        [unknown]: 999
      }
    }));
    await a.call('PUT', C + '/results/' + confirmed.result.id, {
      baseVersion: confirmed.result.version,
      examVersion: s.exam.version,
      rows
    }, 422);
    assert.deepEqual(await a.call('GET', C + '/results/' + confirmed.result.id), confirmed.result);
    passed = true;
  } finally {
    await world.close(passed);
  }
});
test('classroom backup rejects foreign import rows including ignored rows and baseline students', async () => {
  const {
    createIntegration
  } = await import('./fixtures/auth-integration/harness.js');
  const {
    backup,
    restore
  } = await import('../src/workbench/reliability/backup.js');
  const {
    default: Database
  } = await import('better-sqlite3');
  const {
    createHash
  } = await import('node:crypto');
  const os = await import('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'classroom-reference-'));
  const directory = path.join(root, 'source');
  fs.mkdirSync(directory);
  const world = await createIntegration({
    directory
  });
  let stopped = false;
  let passed = false;
  try {
    const a = await teacher(world, 'backup-reference-a@example.test');
    const b = await teacher(world, 'backup-reference-b@example.test');
    const s = await setup(a);
    const foreignClass = await b.call('POST', C + '/classes', {
      name: '外账户班'
    }, 201);
    const foreignStudent = await b.call('POST', C + '/students', studentBody(foreignClass.id, '外账户', '001'), 201);
    const mapped = await a.call('PUT', C + '/imports/' + s.imp.id, {
      baseVersion: s.imp.version,
      mapping: s.mapping,
      rows: null
    });
    for (const ignored of [false, true]) {
      await a.call('PUT', C + '/imports/' + mapped.id, {
        baseVersion: mapped.version,
        mapping: mapped.mapping,
        rows: mapped.rows.map((row, index) => index ? row : {
          ...row,
          studentId: foreignStudent.id,
          ignored
        })
      }, 404);
    }
    assert.equal((await a.call('GET', C + '/imports/' + mapped.id)).version, mapped.version);
    const confirmed = await a.call('POST', C + '/imports/' + mapped.id + '/confirmation', {
      baseVersion: mapped.version
    });
    const target = await a.call('POST', C + '/classes', {
      name: '历史换班'
    }, 201);
    await a.call('PUT', C + '/students/' + s.students[0].id, {
      ...studentBody(target.id, '原学生', '001'),
      baseVersion: s.students[0].version
    });
    await a.call('PUT', C + '/students/' + s.students[1].id + '/deletion', {
      baseVersion: s.students[1].version,
      deleted: true
    });
    await world.close();
    stopped = true;
    const database = path.join(directory, 'workspace.sqlite');
    const files = path.join(directory, 'files');
    const validBackup = path.join(root, 'valid-backup');
    await backup({
      database,
      files,
      target: validBackup,
      stopped: true
    });
    const db = new Database(database);
    try {
      for (const [name, corrupt] of [['foreign-row', {
        ...confirmed.import,
        rows: confirmed.import.rows.map((row, index) => index ? row : {
          ...row,
          studentId: foreignStudent.id
        })
      }], ['foreign-ignored-row', {
        ...confirmed.import,
        rows: confirmed.import.rows.map((row, index) => index ? row : {
          ...row,
          studentId: foreignStudent.id,
          ignored: true
        })
      }], ['foreign-baseline', {
        ...confirmed.import,
        baselines: {
          ...confirmed.import.baselines,
          students: confirmed.import.baselines.students.map((student, index) => index ? student : {
            ...student,
            id: foreignStudent.id
          })
        }
      }]]) {
        db.prepare('UPDATE classroom_imports SET value=? WHERE accountKey=? AND id=?').run(JSON.stringify(corrupt), a.session.account.accountKey, confirmed.import.id);
        await assert.rejects(backup({
          database,
          files,
          target: path.join(root, name),
          stopped: true
        }), /classroom/);
      }
      db.prepare('UPDATE classroom_imports SET value=? WHERE accountKey=? AND id=?').run(JSON.stringify(confirmed.import), a.session.account.accountKey, confirmed.import.id);
    } finally {
      db.close();
    }
    const backupDb = new Database(path.join(validBackup, 'workspace.sqlite'));
    try {
      const corrupt = {
        ...confirmed.import,
        rows: confirmed.import.rows.map((row, index) => index ? row : {
          ...row,
          studentId: foreignStudent.id
        })
      };
      backupDb.prepare('UPDATE classroom_imports SET value=? WHERE accountKey=? AND id=?').run(JSON.stringify(corrupt), a.session.account.accountKey, confirmed.import.id);
    } finally {
      backupDb.close();
    }
    const manifestPath = path.join(validBackup, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const bytes = fs.readFileSync(path.join(validBackup, 'workspace.sqlite'));
    manifest.database.bytes = bytes.length;
    manifest.database.sha256 = createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => restore({
      source: validBackup,
      target: path.join(root, 'restored'),
      stopped: true
    }), /classroom/);
    passed = true;
  } finally {
    if (!stopped) {
      await world.close();
    }
    if (passed) {
      fs.rmSync(root, {
        recursive: true,
        force: true
      });
    } else {
      console.error('Classroom backup failure evidence retained at ' + root);
    }
  }
});
