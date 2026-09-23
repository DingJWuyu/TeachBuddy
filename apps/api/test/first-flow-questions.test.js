// B13 data-side integration coverage for the question bank over the frozen
// workbench seam. Cases map to WB-001..004, WB-009, WB-013, WB-014 and
// WB-016 in docs/product/first-flow.feature.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProblem,
  createFirstFlowHarness,
  manualQuestionSample,
  pastedQuestionSample,
  variantCopySample
} from './first-flow-harness.js';

const QUESTIONS = '/api/modules/questions/items';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function withHarness(run) {
  const harness = await createFirstFlowHarness();
  try {
    return await run(harness);
  } finally {
    harness.close();
  }
}

function updatePayload(question, overrides = {}) {
  return {
    baseVersion: question.version,
    title: question.title,
    body: question.body,
    solution: question.solution,
    note: question.note,
    starred: question.starred,
    ...overrides
  };
}

test('WB-001/002: a pasted question keeps its original text and can be found again', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const teacherB = harness.createAccount('teacher-b');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();

    const created = await api.post(QUESTIONS, sample, { key: harness.nextUuid() }).expect(201);
    assert.equal(created.headers['cache-control'], 'no-store');
    assert.match(created.body.id, UUID_PATTERN);
    assert.equal(created.body.version, 1);
    assert.equal(created.body.deletedAt, null);
    assert.deepEqual(created.body.body, sample.body);
    assert.deepEqual(created.body.solution, sample.solution);
    assert.equal(created.body.note, sample.note);
    assert.equal(created.body.starred, true);
    assert.equal(created.body.source.kind, 'paste');
    assert.equal(created.body.source.text, sample.source.text);
    assert.ok(created.body.source.text.includes('\n\n'), 'newlines are preserved verbatim');

    const fetched = await api.get(`${QUESTIONS}/${created.body.id}`).expect(200);
    assert.deepEqual(fetched.body, created.body);

    const byNote = await api.get(QUESTIONS).query({ q: '配方' }).expect(200);
    assert.deepEqual(byNote.body.items.map((item) => item.id), [created.body.id]);
    assert.deepEqual(byNote.body.items[0].body, sample.body);
    assert.equal(byNote.body.items[0].version, 1);
    assert.equal(byNote.body.items[0].starred, true);

    const byMathSource = await api.get(QUESTIONS).query({ q: 'X^2-2X' }).expect(200);
    assert.deepEqual(byMathSource.body.items.map((item) => item.id), [created.body.id]);

    const missing = await api.get(QUESTIONS).query({ q: '不存在的内容' }).expect(200);
    assert.deepEqual(missing.body.items, []);

    const otherAccount = await harness.agent(teacherB).get(QUESTIONS).expect(200);
    assert.deepEqual(otherAccount.body.items, []);
  });
});

test('WB-003/013: editing keeps the same id, bumps the version and replays idempotently', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();

    const created = await api.post(QUESTIONS, sample, { key: harness.nextUuid() }).expect(201);
    const update = updatePayload(created.body, { note: '先配方，再联系顶点。' });
    const key = harness.nextUuid();

    const updated = await api.put(`${QUESTIONS}/${created.body.id}`, update, { key }).expect(200);
    assert.equal(updated.body.id, created.body.id);
    assert.equal(updated.body.version, 2);
    assert.deepEqual(updated.body.source, created.body.source);
    assert.equal(updated.body.note, '先配方，再联系顶点。');
    assert.ok(updated.body.updatedAt >= created.body.updatedAt);

    const replay = await api.put(`${QUESTIONS}/${created.body.id}`, update, { key }).expect(200);
    assert.deepEqual(replay.body, updated.body);

    const list = await api.get(QUESTIONS).expect(200);
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.items[0].version, 2);

    const fetched = await api.get(`${QUESTIONS}/${created.body.id}`).expect(200);
    assert.deepEqual(fetched.body, updated.body);
  });
});

test('WB-004: a copy keeps the original snapshot and both questions evolve independently', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();
    const original = (await api.post(QUESTIONS, sample, { key: harness.nextUuid() }).expect(201)).body;

    const copy = (
      await api.post(`${QUESTIONS}/${original.id}/copies`, variantCopySample(1), {
        key: harness.nextUuid()
      }).expect(201)
    ).body;
    assert.match(copy.id, UUID_PATTERN);
    assert.notEqual(copy.id, original.id);
    assert.equal(copy.version, 1);
    assert.equal(copy.source.kind, 'copy');
    assert.equal(copy.source.questionId, original.id);
    assert.equal(copy.source.questionVersion, 1);
    assert.deepEqual(copy.source.snapshot, {
      title: original.title,
      body: original.body,
      solution: original.solution
    });
    assert.equal(Object.hasOwn(copy.source.snapshot, 'note'), false);
    assert.equal(copy.body.blocks[0].runs[1].latex, 'g(x)=x^2-4x');

    const originalAfterCopy = await api.get(`${QUESTIONS}/${original.id}`).expect(200);
    assert.deepEqual(originalAfterCopy.body, original);

    const derivatives = await api.get(`${QUESTIONS}/${original.id}/copies`).expect(200);
    assert.deepEqual(derivatives.body.items.map((item) => item.id), [copy.id]);

    const editedCopy = (
      await api.put(`${QUESTIONS}/${copy.id}`, updatePayload(copy, { title: '变式二' }), {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(editedCopy.version, 2);

    const originalAfterEdit = await api.get(`${QUESTIONS}/${original.id}`).expect(200);
    assert.equal(originalAfterEdit.body.version, 1);
    assert.deepEqual(originalAfterEdit.body.body, original.body);

    const updateOriginal = updatePayload(original, { note: '原题更新。' });
    await api.put(`${QUESTIONS}/${original.id}`, updateOriginal, { key: harness.nextUuid() }).expect(200);

    const staleCopy = await api
      .post(`${QUESTIONS}/${original.id}/copies`, variantCopySample(1), { key: harness.nextUuid() })
      .expect(409);
    assertProblem(staleCopy, 409, '/problems/workbench/version-conflict');
    assert.equal(staleCopy.body.currentVersion, 2);

    const list = await api.get(QUESTIONS).expect(200);
    assert.equal(list.body.items.length, 2);

    const deletedOriginal = (
      await api.post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 2, deleted: true }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(deletedOriginal.version, 3);
    const derivativesAfterDelete = await api.get(`${QUESTIONS}/${original.id}/copies`).expect(200);
    assert.deepEqual(derivativesAfterDelete.body.items.map((item) => item.id), [copy.id]);
    const copyAfterDelete = await api.get(`${QUESTIONS}/${copy.id}`).expect(200);
    assert.equal(copyAfterDelete.body.source.questionId, original.id);
    assert.deepEqual(copyAfterDelete.body.source.snapshot, {
      title: original.title,
      body: original.body,
      solution: original.solution
    });
  });
});

test('WB-009: question deletion hides the item but keeps tombstones and stable ids', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const original = (
      await api.post(QUESTIONS, manualQuestionSample(), { key: harness.nextUuid() }).expect(201)
    ).body;

    const deleted = (
      await api.post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 1, deleted: true }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(deleted.version, 2);
    assert.notEqual(deleted.deletedAt, null);
    assert.equal(deleted.source.kind, 'manual');

    const deleteAgain = await api
      .post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 2, deleted: true }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(deleteAgain, 409, '/problems/workbench/object-deleted');

    const active = await api.get(QUESTIONS).expect(200);
    assert.deepEqual(active.body.items, []);
    const deletedList = await api.get(QUESTIONS).query({ state: 'deleted' }).expect(200);
    assert.deepEqual(deletedList.body.items.map((item) => item.id), [original.id]);

    const tombstone = await api.get(`${QUESTIONS}/${original.id}`).expect(200);
    assert.equal(tombstone.body.deletedAt, deleted.deletedAt);

    const editDeleted = await api
      .put(`${QUESTIONS}/${original.id}`, updatePayload(tombstone.body, { note: '重写' }), {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(editDeleted, 409, '/problems/workbench/object-deleted');

    const copyDeleted = await api
      .post(`${QUESTIONS}/${original.id}/copies`, variantCopySample(2), { key: harness.nextUuid() })
      .expect(409);
    assertProblem(copyDeleted, 409, '/problems/workbench/object-deleted');

    const staleRestore = await api
      .post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 1, deleted: false }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assert.equal(staleRestore.body.currentVersion, 2);

    const restored = (
      await api.post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 2, deleted: false }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(restored.id, original.id);
    assert.equal(restored.version, 3);
    assert.equal(restored.deletedAt, null);
    assert.deepEqual(restored.body, original.body);

    // Restoring an already-active question is not object-deleted: the object is
    // not deleted, so it is a same-content write that bumps the version.
    const restoreActive = (
      await api.post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 3, deleted: false }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(restoreActive.id, original.id);
    assert.equal(restoreActive.version, 4);
    assert.equal(restoreActive.deletedAt, null);

    const activeAgain = await api.get(QUESTIONS).expect(200);
    assert.deepEqual(activeAgain.body.items.map((item) => item.id), [original.id]);
  });
});

test('WB-014: invalid question payloads are rejected without touching stored data', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();

    const blankBody = {
      ...sample,
      body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '   ' }] }] }
    };
    const blank = await api.post(QUESTIONS, blankBody, { key: harness.nextUuid() }).expect(422);
    assertProblem(blank, 422, '/problems/workbench/invalid-input');
    assert.deepEqual({ field: blank.body.field, reason: blank.body.reason }, { field: '/body', reason: 'empty-content' });

    const blankInlineMath = {
      ...sample,
      body: {
        version: 1,
        blocks: [{ type: 'paragraph', runs: [{ type: 'math', latex: ' \t ' }] }]
      }
    };
    const inlineMath = await api.post(QUESTIONS, blankInlineMath, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: inlineMath.body.field, reason: inlineMath.body.reason },
      { field: '/body', reason: 'empty-content' },
      'whitespace-only inline math is not question content'
    );

    const unknownVersion = { ...sample, body: { ...sample.body, version: 2 } };
    const version = await api.post(QUESTIONS, unknownVersion, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: version.body.field, reason: version.body.reason },
      { field: '/body/version', reason: 'unsupported-content-version' }
    );

    const unknownNode = {
      ...sample,
      body: { version: 1, blocks: [{ type: 'image', src: 'x' }] }
    };
    const node = await api.post(QUESTIONS, unknownNode, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: node.body.field, reason: node.body.reason },
      { field: '/body/blocks/0/type', reason: 'invalid-type' }
    );

    const firstBadBlockWins = {
      ...sample,
      body: {
        version: 1,
        blocks: [
          { type: 'paragraph', runs: [{ type: 'math', latex: 7 }] },
          { type: 'image', src: 'x' }
        ]
      }
    };
    const indexed = await api.post(QUESTIONS, firstBadBlockWins, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: indexed.body.field, reason: indexed.body.reason },
      { field: '/body/blocks/0/runs/0/latex', reason: 'invalid-type' },
      'array elements are reported by ascending index'
    );

    const emptyLatex = {
      ...sample,
      body: {
        version: 1,
        blocks: [{ type: 'paragraph', runs: [{ type: 'math', latex: '' }] }]
      }
    };
    const latex = await api.post(QUESTIONS, emptyLatex, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: latex.body.field, reason: latex.body.reason },
      { field: '/body/blocks/0/runs/0/latex', reason: 'out-of-range' }
    );

    const missingAndUnknown = { ...sample, note: undefined, zzz: 1 };
    delete missingAndUnknown.note;
    const ordered = await api.post(QUESTIONS, missingAndUnknown, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: ordered.body.field, reason: ordered.body.reason },
      { field: '/zzz', reason: 'unknown-field' },
      'root unknown fields are reported before field content'
    );

    const sortedUnknown = await api
      .post(QUESTIONS, { ...sample, zzz: 1, aaa: 2 }, { key: harness.nextUuid() })
      .expect(422);
    assert.deepEqual(
      { field: sortedUnknown.body.field, reason: sortedUnknown.body.reason },
      { field: '/aaa', reason: 'unknown-field' },
      'same-level unknown fields are reported in ascending key order'
    );

    const longTitle = { ...sample, title: 'x'.repeat(201) };
    const title = await api.post(QUESTIONS, longTitle, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: title.body.field, reason: title.body.reason },
      { field: '/title', reason: 'out-of-range' }
    );

    const missingNote = { ...sample };
    delete missingNote.note;
    const requiredNote = await api.post(QUESTIONS, missingNote, { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: requiredNote.body.field, reason: requiredNote.body.reason },
      { field: '/note', reason: 'required' }
    );

    const arrayBody = await api.post(QUESTIONS, [sample], { key: harness.nextUuid() }).expect(422);
    assert.deepEqual(
      { field: arrayBody.body.field, reason: arrayBody.body.reason },
      { field: '', reason: 'invalid-type' }
    );

    const created = (await api.post(QUESTIONS, sample, { key: harness.nextUuid() }).expect(201)).body;
    const forgedSnapshot = await api
      .post(`${QUESTIONS}/${created.id}/copies`, { ...variantCopySample(1), snapshot: { title: 'x' } }, {
        key: harness.nextUuid()
      })
      .expect(422);
    assert.deepEqual(
      { field: forgedSnapshot.body.field, reason: forgedSnapshot.body.reason },
      { field: '/snapshot', reason: 'unknown-field' }
    );

    const list = await api.get(QUESTIONS).expect(200);
    assert.equal(list.body.items.length, 1, 'rejected writes never create objects');

    const mixedInlineMath = (
      await api.post(
        QUESTIONS,
        {
          ...sample,
          body: {
            version: 1,
            blocks: [
              { type: 'paragraph', runs: [{ type: 'math', latex: ' ' }, { type: 'text', text: '求最小值' }] }
            ]
          }
        },
        { key: harness.nextUuid() }
      ).expect(201)
    ).body;
    assert.equal(mixedInlineMath.version, 1, 'a blank inline formula next to real text is still content');

    const emptyTitle = (
      await api.post(QUESTIONS, manualQuestionSample({ title: '' }), { key: harness.nextUuid() }).expect(201)
    ).body;
    assert.equal(emptyTitle.title, '', 'a question title may be empty');
  });
});

test('WB-016: another account cannot reach a question and forged identity is ignored', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const teacherB = harness.createAccount('teacher-b');
    const apiA = harness.agent(teacherA);
    const apiB = harness.agent(teacherB);
    const original = (
      await apiA.post(QUESTIONS, pastedQuestionSample(), { key: harness.nextUuid() }).expect(201)
    ).body;
    const url = `${QUESTIONS}/${original.id}`;

    assertProblem(await apiB.get(url), 404, '/problems/workbench/not-found');
    assertProblem(
      await apiB.put(url, updatePayload(original), { key: harness.nextUuid() }),
      404,
      '/problems/workbench/not-found'
    );
    assertProblem(
      await apiB.post(`${url}/copies`, variantCopySample(1), { key: harness.nextUuid() }),
      404,
      '/problems/workbench/not-found'
    );
    assertProblem(
      await apiB.post(`${url}/deletion`, { baseVersion: 1, deleted: true }, { key: harness.nextUuid() }),
      404,
      '/problems/workbench/not-found'
    );
    assertProblem(await apiB.get(`${url}/copies`), 404, '/problems/workbench/not-found');

    assertProblem(await harness.raw().get(QUESTIONS), 401, '/problems/workbench/unauthenticated');
    const forgedHeader = await harness.raw().get(url).set('X-Account-Key', teacherA.accountKey);
    assertProblem(forgedHeader, 401, '/problems/workbench/unauthenticated');

    const forgedBody = await apiA
      .post(QUESTIONS, { ...pastedQuestionSample(), accountId: teacherA.accountKey }, {
        key: harness.nextUuid()
      })
      .expect(422);
    assert.deepEqual(
      { field: forgedBody.body.field, reason: forgedBody.body.reason },
      { field: '/accountId', reason: 'unknown-field' }
    );

    const listB = await apiB.get(QUESTIONS).expect(200);
    assert.deepEqual(listB.body.items, []);
    const listA = await apiA.get(QUESTIONS).expect(200);
    assert.deepEqual(listA.body.items.map((item) => item.id), [original.id]);
  });
});

test('WB-001: list search covers title, body and note only, and starred filters apply', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);

    const first = (
      await api.post(
        QUESTIONS,
        manualQuestionSample({
          title: '函数单调性',
          note: '课堂追问：为什么区间端点要开',
          starred: true,
          solution: {
            version: 1,
            blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '答案关键词顶点坐标法' }] }]
          },
          source: { kind: 'paste', text: '原始粘贴标记文本' }
        }),
        { key: harness.nextUuid() }
      ).expect(201)
    ).body;
    const second = (
      await api.post(QUESTIONS, manualQuestionSample({ title: '第二题', starred: false }), {
        key: harness.nextUuid()
      }).expect(201)
    ).body;

    const noteHit = await api.get(QUESTIONS).query({ q: '区间端点' }).expect(200);
    assert.deepEqual(noteHit.body.items.map((item) => item.id), [first.id]);
    const titleHit = await api.get(QUESTIONS).query({ q: '函数单调' }).expect(200);
    assert.deepEqual(titleHit.body.items.map((item) => item.id), [first.id]);
    const solutionMiss = await api.get(QUESTIONS).query({ q: '顶点坐标法' }).expect(200);
    assert.deepEqual(solutionMiss.body.items, [], 'answers are not searchable');
    const sourceMiss = await api.get(QUESTIONS).query({ q: '原始粘贴标记' }).expect(200);
    assert.deepEqual(sourceMiss.body.items, [], 'sources are not searchable');

    const starred = await api.get(QUESTIONS).query({ starred: 'true' }).expect(200);
    assert.deepEqual(starred.body.items.map((item) => item.id), [first.id]);
    const unstarred = await api.get(QUESTIONS).query({ starred: 'false' }).expect(200);
    assert.deepEqual(unstarred.body.items.map((item) => item.id), [second.id]);
    const all = await api.get(QUESTIONS).expect(200);
    assert.deepEqual(all.body.items.map((item) => item.id).sort(), [first.id, second.id].sort());

    const latest = (await api.post(QUESTIONS, manualQuestionSample({ title: '最新题' }), {
      key: harness.nextUuid()
    }).expect(201)).body;
    const ordered = await api.get(QUESTIONS).expect(200);
    assert.deepEqual(ordered.body.items.map((item) => item.id), [latest.id, second.id, first.id]);
  });
});

test('C11/WB-013: every question write trigger rejects a stale base version with the current version', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const original = (
      await api.post(QUESTIONS, manualQuestionSample(), { key: harness.nextUuid() }).expect(201)
    ).body;
    const v2 = (
      await api.put(`${QUESTIONS}/${original.id}`, updatePayload(original, { note: '第二版' }), {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(v2.version, 2);

    const staleUpdate = await api
      .put(`${QUESTIONS}/${original.id}`, updatePayload(original, { note: '过期写入' }), {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(staleUpdate, 409, '/problems/workbench/version-conflict');
    assert.equal(staleUpdate.body.currentVersion, 2);

    const staleCopy = await api
      .post(`${QUESTIONS}/${original.id}/copies`, variantCopySample(1), { key: harness.nextUuid() })
      .expect(409);
    assertProblem(staleCopy, 409, '/problems/workbench/version-conflict');
    assert.equal(staleCopy.body.currentVersion, 2);

    const staleDelete = await api
      .post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 1, deleted: true }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(staleDelete, 409, '/problems/workbench/version-conflict');
    assert.equal(staleDelete.body.currentVersion, 2);

    const deleted = (
      await api.post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 2, deleted: true }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(deleted.version, 3);

    const staleRestore = await api
      .post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 1, deleted: false }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(staleRestore, 409, '/problems/workbench/version-conflict');
    assert.equal(staleRestore.body.currentVersion, 3);

    const afterRejections = await api.get(`${QUESTIONS}/${original.id}`).expect(200);
    assert.equal(afterRejections.body.version, 3, 'rejected writes never change the object');
    assert.equal(afterRejections.body.note, '第二版');
    assert.equal(afterRejections.body.deletedAt, deleted.deletedAt);

    const restored = (
      await api.post(`${QUESTIONS}/${original.id}/deletion`, { baseVersion: 3, deleted: false }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(restored.version, 4);
    assert.equal(restored.deletedAt, null);
  });
});
