// B13 data-side integration coverage for lesson preparation: aggregate
// versions, section/reference identity, server snapshots, usages, deletion and
// restore. Cases map to WB-005..009, WB-013, WB-014 and WB-016.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProblem,
  createFirstFlowHarness,
  lessonSample,
  pastedQuestionSample,
  sectionInput
} from './first-flow-harness.js';

const QUESTIONS = '/api/modules/questions/items';
const LESSONS = '/api/modules/lessons/items';
const USAGES = '/api/modules/lessons/question-usages';

async function withHarness(run) {
  const harness = await createFirstFlowHarness();
  try {
    return await run(harness);
  } finally {
    await harness.close();
  }
}

function referenceInput(reference) {
  return {
    id: reference.id,
    questionId: reference.questionId,
    questionVersion: reference.questionVersion,
    note: reference.note
  };
}

function lessonUpdate(lesson, overrides = {}) {
  const sections = overrides.sections ?? lesson.sections;
  const materials = overrides.materials ?? lesson.materials;
  return {
    baseVersion: overrides.baseVersion ?? lesson.version,
    title: overrides.title ?? lesson.title,
    intro: overrides.intro ?? lesson.intro,
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      references: section.references.map(referenceInput)
    })),
    materials: materials.map(referenceInput)
  };
}

async function createQuestion(api, harness, overrides = {}) {
  const response = await api.post(QUESTIONS, pastedQuestionSample(overrides), {
    key: harness.nextUuid()
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function createLesson(api, harness, sectionId, overrides = {}) {
  const response = await api.post(
    LESSONS,
    lessonSample({ sections: [sectionInput(sectionId)], ...overrides }),
    { key: harness.nextUuid() }
  );
  assert.equal(response.status, 201);
  return response.body;
}

test('WB-005: a lesson keeps stable section ids, order and server snapshots', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness);
    const sectionId = harness.nextUuid();
    const lesson = await createLesson(api, harness, sectionId);

    assert.equal(lesson.version, 1);
    assert.equal(lesson.deletedAt, null);
    assert.equal(lesson.sections.length, 1);
    assert.equal(lesson.sections[0].id, sectionId);
    assert.deepEqual(lesson.materials, []);

    const referenceId = harness.nextUuid();
    const note = '先讨论配方，再提问顶点位置。';
    const withReference = lessonUpdate(lesson, {
      sections: [
        {
          ...lesson.sections[0],
          references: [{ id: referenceId, questionId: question.id, questionVersion: 1, note }]
        }
      ]
    });
    const updated = (await api.put(`${LESSONS}/${lesson.id}`, withReference, {
      key: harness.nextUuid()
    }).expect(200)).body;

    assert.equal(updated.version, 2);
    assert.equal(updated.sections[0].id, sectionId);
    const reference = updated.sections[0].references[0];
    assert.equal(reference.id, referenceId);
    assert.equal(reference.questionId, question.id);
    assert.equal(reference.questionVersion, 1);
    assert.equal(reference.note, note);
    assert.deepEqual(reference.snapshot, {
      title: question.title,
      body: question.body,
      solution: question.solution
    });
    assert.equal(Object.hasOwn(reference.snapshot, 'note'), false);
    assert.equal(reference.sourceState, 'active');
    assert.equal(reference.latestVersion, 1);

    const fetched = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.deepEqual(fetched.body, updated);

    const usages = await api.get(`${USAGES}/${question.id}`).expect(200);
    assert.deepEqual(usages.body.items, [
      {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionId,
        sectionTitle: '例题讨论',
        referenceId,
        questionVersion: 1
      }
    ]);

    const rough = await createLesson(api, harness, harness.nextUuid());
    const emptySections = (
      await api.put(`${LESSONS}/${rough.id}`, lessonUpdate(rough, { sections: [] }), {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.deepEqual(emptySections.sections, []);
    assert.equal(emptySections.version, 2);
  });
});

test('WB-007: moving a reference keeps its id, snapshot and note', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness);
    const sectionId = harness.nextUuid();
    const lesson = await createLesson(api, harness, sectionId);
    const referenceId = harness.nextUuid();
    const note = '本课备注保持。';
    const referenced = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lesson, {
        sections: [
          {
            ...lesson.sections[0],
            references: [{ id: referenceId, questionId: question.id, questionVersion: 1, note }]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    const snapshot = referenced.sections[0].references[0].snapshot;

    const movedToMaterials = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(referenced, {
        sections: [],
        materials: [{ id: referenceId, questionId: question.id, questionVersion: 1, note }]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;

    assert.equal(movedToMaterials.version, 3);
    assert.deepEqual(movedToMaterials.sections, []);
    assert.equal(movedToMaterials.materials.length, 1);
    assert.equal(movedToMaterials.materials[0].id, referenceId);
    assert.deepEqual(movedToMaterials.materials[0].snapshot, snapshot);
    assert.equal(movedToMaterials.materials[0].note, note);

    const materialUsages = await api.get(`${USAGES}/${question.id}`).expect(200);
    assert.deepEqual(materialUsages.body.items, [
      {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionId: null,
        sectionTitle: null,
        referenceId,
        questionVersion: 1
      }
    ]);

    const newSectionId = harness.nextUuid();
    const backToSection = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(movedToMaterials, {
        sections: [
          {
            id: newSectionId,
            title: '再讨论',
            content: { version: 1, blocks: [] },
            references: [{ id: referenceId, questionId: question.id, questionVersion: 1, note }]
          }
        ],
        materials: []
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;

    assert.equal(backToSection.version, 4);
    assert.equal(backToSection.sections[0].id, newSectionId);
    assert.equal(backToSection.sections[0].references[0].id, referenceId);
    assert.deepEqual(backToSection.sections[0].references[0].snapshot, snapshot);
    assert.equal(backToSection.sections[0].references[0].note, note);

    const secondReferenceId = harness.nextUuid();
    const explicitSecondReference = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(backToSection, {
        sections: [
          {
            ...backToSection.sections[0],
            references: [
              { id: referenceId, questionId: question.id, questionVersion: 1, note },
              { id: secondReferenceId, questionId: question.id, questionVersion: 1, note: '再放一次' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.deepEqual(
      explicitSecondReference.sections[0].references.map((reference) => reference.id),
      [referenceId, secondReferenceId],
      'placing the same question again creates an independent reference'
    );

    const cleared = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(explicitSecondReference, { sections: [], materials: [] }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.deepEqual(cleared.sections, []);
    assert.deepEqual(cleared.materials, []);
    assert.equal(cleared.version, 6);
    const usagesAfterClear = await api.get(`${USAGES}/${question.id}`).expect(200);
    assert.deepEqual(usagesAfterClear.body.items, [], 'omitted references are removed, not moved');
  });
});

test('WB-006/013: stale reference versions reject the whole lesson atomically', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness);
    const sectionId = harness.nextUuid();
    const lesson = await createLesson(api, harness, sectionId);
    const lessonV2 = (await api.put(`${LESSONS}/${lesson.id}`, lessonUpdate(lesson), {
      key: harness.nextUuid()
    }).expect(200)).body;
    assert.equal(lessonV2.version, 2);

    const questionV2 = (await api.put(
      `${QUESTIONS}/${question.id}`,
      {
        baseVersion: 1,
        title: question.title,
        body: question.body,
        solution: question.solution,
        note: '题库笔记更新',
        starred: true
      },
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(questionV2.version, 2);

    const newReferenceId = harness.nextUuid();
    const stale = await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lessonV2, {
        sections: [
          {
            ...lessonV2.sections[0],
            references: [
              { id: newReferenceId, questionId: question.id, questionVersion: 1, note: '过期的采用版本' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(409);
    assertProblem(stale, 409, '/problems/workbench/reference-version-conflict');
    assert.equal(stale.body.questionId, question.id);
    assert.equal(stale.body.currentVersion, 2);

    const unchanged = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(unchanged.body.version, 2);
    assert.deepEqual(unchanged.body.sections[0].references, [], 'batch add is all-or-nothing');

    const adopted = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lessonV2, {
        sections: [
          {
            ...lessonV2.sections[0],
            references: [
              { id: newReferenceId, questionId: question.id, questionVersion: 2, note: '采用版本 2' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(adopted.version, 3);
    assert.equal(adopted.sections[0].references[0].questionVersion, 2);
    assert.deepEqual(adopted.sections[0].references[0].snapshot, {
      title: questionV2.title,
      body: questionV2.body,
      solution: questionV2.solution
    });
    assert.equal(adopted.sections[0].references[0].latestVersion, 2);
  });
});

test('WB-008: a question update never silently changes prepared content', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness);

    const lessonOne = await createLesson(api, harness, harness.nextUuid());
    const referenceId = harness.nextUuid();
    const note = '本课备注不变。';
    const prepared = (await api.put(
      `${LESSONS}/${lessonOne.id}`,
      lessonUpdate(lessonOne, {
        sections: [
          {
            ...lessonOne.sections[0],
            references: [{ id: referenceId, questionId: question.id, questionVersion: 1, note }]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;

    const lessonTwo = await createLesson(api, harness, harness.nextUuid());
    const secondReferenceId = harness.nextUuid();
    await api.put(
      `${LESSONS}/${lessonTwo.id}`,
      lessonUpdate(lessonTwo, {
        sections: [
          {
            ...lessonTwo.sections[0],
            references: [
              { id: secondReferenceId, questionId: question.id, questionVersion: 1, note: '第二份备课' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200);

    const questionV2 = (await api.put(
      `${QUESTIONS}/${question.id}`,
      {
        baseVersion: 1,
        title: question.title,
        body: {
          version: 1,
          blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '题面已更新。' }] }]
        },
        solution: question.solution,
        note: question.note,
        starred: question.starred
      },
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(questionV2.version, 2);

    const stillOld = await api.get(`${LESSONS}/${lessonOne.id}`).expect(200);
    assert.equal(stillOld.body.version, 2, 'derived update state does not bump the lesson version');
    assert.equal(stillOld.body.sections[0].references[0].snapshot.body.blocks[0].runs[0].text, question.body.blocks[0].runs[0].text);
    assert.equal(stillOld.body.sections[0].references[0].sourceState, 'active');
    assert.equal(stillOld.body.sections[0].references[0].latestVersion, 2);

    const adopted = (await api.put(
      `${LESSONS}/${lessonOne.id}`,
      lessonUpdate(stillOld.body, {
        sections: [
          {
            ...stillOld.body.sections[0],
            references: [{ id: referenceId, questionId: question.id, questionVersion: 2, note }]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(adopted.version, 3);
    assert.equal(adopted.sections[0].references[0].note, note);
    assert.deepEqual(adopted.sections[0].references[0].snapshot, {
      title: questionV2.title,
      body: questionV2.body,
      solution: questionV2.solution
    });

    const otherLesson = await api.get(`${LESSONS}/${lessonTwo.id}`).expect(200);
    assert.equal(otherLesson.body.sections[0].references[0].questionVersion, 1);
    assert.equal(otherLesson.body.sections[0].references[0].latestVersion, 2);
    assert.equal(otherLesson.body.sections[0].references[0].snapshot.body.blocks[0].runs[0].text, question.body.blocks[0].runs[0].text);
  });
});

test('WB-009: question deletion keeps prepared snapshots and blocks new references', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness);
    const lesson = await createLesson(api, harness, harness.nextUuid());
    const referenceId = harness.nextUuid();
    const note = '已备内容备注';
    const prepared = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lesson, {
        sections: [
          {
            ...lesson.sections[0],
            references: [{ id: referenceId, questionId: question.id, questionVersion: 1, note }]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    const snapshot = prepared.sections[0].references[0].snapshot;

    await api.post(`${QUESTIONS}/${question.id}/deletion`, { baseVersion: 1, deleted: true }, {
      key: harness.nextUuid()
    }).expect(200);

    const readable = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(readable.body.version, 2);
    assert.deepEqual(readable.body.sections[0].references[0].snapshot, snapshot);
    assert.equal(readable.body.sections[0].references[0].sourceState, 'deleted');
    assert.equal(readable.body.sections[0].references[0].latestVersion, 2);

    const savedAgain = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(readable.body, { title: '删除源题后仍可保存' }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(savedAgain.version, 3);
    assert.equal(savedAgain.sections[0].references[0].id, referenceId);
    assert.equal(savedAgain.sections[0].references[0].snapshot.body.blocks[0].runs[1].latex, 'f(x)=x^2-2x');

    const newReference = await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(savedAgain, {
        sections: [
          {
            ...savedAgain.sections[0],
            references: [
              { id: referenceId, questionId: question.id, questionVersion: 1, note },
              { id: harness.nextUuid(), questionId: question.id, questionVersion: 2, note: '新引用' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(409);
    assertProblem(newReference, 409, '/problems/workbench/object-deleted');

    const stillIntact = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(stillIntact.body.version, 3);
    assert.equal(stillIntact.body.sections[0].references.length, 1);

    const restored = (await api.post(
      `${QUESTIONS}/${question.id}/deletion`,
      { baseVersion: 2, deleted: false },
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(restored.version, 3);

    const afterRestore = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.deepEqual(afterRestore.body.sections[0].references[0].snapshot, snapshot);
    assert.equal(afterRestore.body.sections[0].references[0].sourceState, 'active');
    assert.equal(afterRestore.body.sections[0].references[0].latestVersion, 3);

    const adoptRestored = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(afterRestore.body, {
        sections: [
          {
            ...afterRestore.body.sections[0],
            references: [{ id: referenceId, questionId: question.id, questionVersion: 3, note }]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(adoptRestored.sections[0].references[0].questionVersion, 3);
    assert.equal(adoptRestored.sections[0].references[0].latestVersion, 3);
  });
});

test('WB-009: lesson deletion and restore keep sections, references and questions', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness);
    const lesson = await createLesson(api, harness, harness.nextUuid());
    const referenceId = harness.nextUuid();
    const prepared = (await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lesson, {
        materials: [{ id: referenceId, questionId: question.id, questionVersion: 1, note: '材料备注' }]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;

    const deleted = (await api.post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 2, deleted: true }, {
      key: harness.nextUuid()
    }).expect(200)).body;
    assert.equal(deleted.version, 3);
    assert.notEqual(deleted.deletedAt, null);

    const active = await api.get(LESSONS).expect(200);
    assert.deepEqual(active.body.items, []);
    const deletedList = await api.get(LESSONS).query({ state: 'deleted' }).expect(200);
    assert.deepEqual(deletedList.body.items.map((item) => item.id), [lesson.id]);
    const tombstone = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(tombstone.body.deletedAt, deleted.deletedAt);

    const usagesWhileDeleted = await api.get(`${USAGES}/${question.id}`).expect(200);
    assert.deepEqual(usagesWhileDeleted.body.items, []);

    const editDeleted = await api.put(`${LESSONS}/${lesson.id}`, lessonUpdate(tombstone.body), {
      key: harness.nextUuid()
    }).expect(409);
    assertProblem(editDeleted, 409, '/problems/workbench/object-deleted');

    const restored = (await api.post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 3, deleted: false }, {
      key: harness.nextUuid()
    }).expect(200)).body;
    assert.equal(restored.id, lesson.id);
    assert.equal(restored.version, 4);
    assert.equal(restored.deletedAt, null);
    assert.deepEqual(restored.materials, prepared.materials);

    const usagesRestored = await api.get(`${USAGES}/${question.id}`).expect(200);
    assert.equal(usagesRestored.body.items.length, 1);
    assert.equal(usagesRestored.body.items[0].lessonId, lesson.id);

    const questionUnchanged = await api.get(`${QUESTIONS}/${question.id}`).expect(200);
    assert.deepEqual(questionUnchanged.body, question);

    // Restoring an already-active lesson bumps the version instead of reporting
    // object-deleted; deleting an already-deleted lesson stays object-deleted.
    const restoreActive = (
      await api.post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 4, deleted: false }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(restoreActive.version, 5);
    assert.equal(restoreActive.deletedAt, null);
    assert.deepEqual(restoreActive.materials, prepared.materials);

    const deletedAgain = (
      await api.post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 5, deleted: true }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(deletedAgain.version, 6);
    assert.notEqual(deletedAgain.deletedAt, null);

    const repeatDelete = await api
      .post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 6, deleted: true }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(repeatDelete, 409, '/problems/workbench/object-deleted');
  });
});

test('WB-014/016: lesson reference identity and ownership are enforced', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const teacherB = harness.createAccount('teacher-b');
    const apiA = harness.agent(teacherA);
    const apiB = harness.agent(teacherB);
    const question = await createQuestion(apiA, harness);
    const otherQuestion = await createQuestion(apiA, harness, { title: '另一题' });
    const lesson = await createLesson(apiA, harness, harness.nextUuid());
    const referenceId = harness.nextUuid();
    const prepared = (await apiA.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lesson, {
        sections: [
          {
            ...lesson.sections[0],
            references: [{ id: referenceId, questionId: question.id, questionVersion: 1, note: '引用' }]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200)).body;

    const repointed = await apiA.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(prepared, {
        sections: [
          {
            ...prepared.sections[0],
            references: [
              { id: referenceId, questionId: otherQuestion.id, questionVersion: 1, note: '改指' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(422);
    assertProblem(repointed, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: repointed.body.field, reason: repointed.body.reason },
      { field: '/sections/0/references/0/questionId', reason: 'invalid-reference' }
    );

    const unchanged = await apiA.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(unchanged.body.sections[0].references[0].questionId, question.id);

    const duplicateSections = await apiA.put(
      `${LESSONS}/${lesson.id}`,
      {
        ...lessonUpdate(unchanged.body),
        sections: [
          { ...lessonUpdate(unchanged.body).sections[0] },
          { ...lessonUpdate(unchanged.body).sections[0] }
        ]
      },
      { key: harness.nextUuid() }
    ).expect(422);
    assert.deepEqual(
      { field: duplicateSections.body.field, reason: duplicateSections.body.reason },
      { field: '/sections/1/id', reason: 'duplicate-id' }
    );

    const duplicateReferences = await apiA.put(
      `${LESSONS}/${lesson.id}`,
      {
        ...lessonUpdate(unchanged.body),
        materials: [
          { id: referenceId, questionId: question.id, questionVersion: 1, note: '重复引用' }
        ]
      },
      { key: harness.nextUuid() }
    ).expect(422);
    assert.deepEqual(
      { field: duplicateReferences.body.field, reason: duplicateReferences.body.reason },
      { field: '/materials/0/id', reason: 'duplicate-id' }
    );

    const blankTitle = await apiA.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(unchanged.body, { title: '   ' }),
      { key: harness.nextUuid() }
    ).expect(422);
    assert.deepEqual(
      { field: blankTitle.body.field, reason: blankTitle.body.reason },
      { field: '/title', reason: 'out-of-range' }
    );

    const blankSectionTitle = await apiA.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(unchanged.body, {
        sections: [{ ...unchanged.body.sections[0], title: ' ' }]
      }),
      { key: harness.nextUuid() }
    ).expect(422);
    assert.deepEqual(
      { field: blankSectionTitle.body.field, reason: blankSectionTitle.body.reason },
      { field: '/sections/0/title', reason: 'out-of-range' }
    );

    assertProblem(await apiB.get(`${LESSONS}/${lesson.id}`), 404, '/problems/workbench/not-found');
    assertProblem(await apiB.get(`${USAGES}/${question.id}`), 404, '/problems/workbench/not-found');

    const crossReference = await apiB
      .post(
        LESSONS,
        {
          title: '借用',
          intro: { version: 1, blocks: [] },
          sections: [
            {
              id: harness.nextUuid(),
              title: '借用',
              content: { version: 1, blocks: [] },
              references: [
                { id: harness.nextUuid(), questionId: question.id, questionVersion: 1, note: '' }
              ]
            }
          ],
          materials: []
        },
        { key: harness.nextUuid() }
      )
      .expect(404);
    assertProblem(crossReference, 404, '/problems/workbench/not-found');

    const ownUsages = await apiA.get(`${USAGES}/${otherQuestion.id}`).expect(200);
    assert.deepEqual(ownUsages.body.items, []);
  });
});

test('WB-005: lesson search covers title and body text but not snapshots or notes', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = await createQuestion(api, harness, { title: '快照中的题目名字' });
    const lesson = await createLesson(api, harness, harness.nextUuid(), {
      title: '函数复习课',
      intro: {
        version: 1,
        blocks: [
          { type: 'paragraph', runs: [{ type: 'text', text: '开场引入' }, { type: 'math', latex: 'y=kx+b' }] }
        ]
      }
    });
    const referenceId = harness.nextUuid();
    await api.put(
      `${LESSONS}/${lesson.id}`,
      lessonUpdate(lesson, {
        sections: [
          {
            ...lesson.sections[0],
            content: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '环节正文内容词' }] }] },
            references: [
              { id: referenceId, questionId: question.id, questionVersion: 1, note: '本课备注密钥' }
            ]
          }
        ]
      }),
      { key: harness.nextUuid() }
    ).expect(200);

    const byTitle = await api.get(LESSONS).query({ q: '函数复习' }).expect(200);
    assert.deepEqual(byTitle.body.items.map((item) => item.id), [lesson.id]);
    const byFormula = await api.get(LESSONS).query({ q: 'Y=KX+B' }).expect(200);
    assert.deepEqual(byFormula.body.items.map((item) => item.id), [lesson.id]);
    const bySectionText = await api.get(LESSONS).query({ q: '环节正文内容词' }).expect(200);
    assert.deepEqual(bySectionText.body.items.map((item) => item.id), [lesson.id]);
    const snapshotMiss = await api.get(LESSONS).query({ q: '快照中的题目名字' }).expect(200);
    assert.deepEqual(snapshotMiss.body.items, [], 'snapshots are not searchable');
    const noteMiss = await api.get(LESSONS).query({ q: '本课备注密钥' }).expect(200);
    assert.deepEqual(noteMiss.body.items, [], 'lesson notes are not searchable');
  });
});

test('WB-005: section order is server-side and reordering keeps stable ids', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const firstId = harness.nextUuid();
    const secondId = harness.nextUuid();
    const thirdId = harness.nextUuid();

    const lesson = (
      await api.post(
        LESSONS,
        lessonSample({
          sections: [
            sectionInput(firstId, { title: '第一环节' }),
            sectionInput(secondId, { title: '第二环节' }),
            sectionInput(thirdId, { title: '第三环节' })
          ]
        }),
        { key: harness.nextUuid() }
      ).expect(201)
    ).body;
    assert.deepEqual(
      lesson.sections.map((section) => section.id),
      [firstId, secondId, thirdId]
    );

    const reordered = (
      await api.put(
        `${LESSONS}/${lesson.id}`,
        lessonUpdate(lesson, { sections: [lesson.sections[2], lesson.sections[0], lesson.sections[1]] }),
        { key: harness.nextUuid() }
      ).expect(200)
    ).body;
    assert.equal(reordered.version, 2);
    assert.deepEqual(
      reordered.sections.map((section) => section.id),
      [thirdId, firstId, secondId]
    );
    assert.deepEqual(
      reordered.sections.map((section) => section.title),
      ['第三环节', '第一环节', '第二环节']
    );
    assert.deepEqual(
      harness
        .query('SELECT sectionId FROM lesson_sections WHERE lessonId = ? ORDER BY position', lesson.id)
        .map((row) => row.sectionId),
      [thirdId, firstId, secondId],
      'the stored position column carries the submitted order'
    );

    await harness.restart();
    const reread = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(reread.body.version, 2);
    assert.deepEqual(
      reread.body.sections.map((section) => section.id),
      [thirdId, firstId, secondId]
    );
  });
});

test('C11/WB-013: stale lesson base versions conflict on update, delete and restore', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const lesson = await createLesson(api, harness, harness.nextUuid());

    const v2 = (
      await api.put(`${LESSONS}/${lesson.id}`, lessonUpdate(lesson, { title: '第二版' }), {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(v2.version, 2);

    const staleUpdate = await api
      .put(`${LESSONS}/${lesson.id}`, lessonUpdate(lesson, { title: '过期写入' }), {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(staleUpdate, 409, '/problems/workbench/version-conflict');
    assert.equal(staleUpdate.body.currentVersion, 2);

    const staleDelete = await api
      .post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 1, deleted: true }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(staleDelete, 409, '/problems/workbench/version-conflict');
    assert.equal(staleDelete.body.currentVersion, 2);

    const deleted = (
      await api.post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 2, deleted: true }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(deleted.version, 3);

    const staleRestore = await api
      .post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 1, deleted: false }, {
        key: harness.nextUuid()
      })
      .expect(409);
    assertProblem(staleRestore, 409, '/problems/workbench/version-conflict');
    assert.equal(staleRestore.body.currentVersion, 3);

    const afterRejections = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(afterRejections.body.version, 3, 'rejected writes never change the lesson');
    assert.equal(afterRejections.body.title, '第二版');
    assert.equal(afterRejections.body.deletedAt, deleted.deletedAt);

    const restored = (
      await api.post(`${LESSONS}/${lesson.id}/deletion`, { baseVersion: 3, deleted: false }, {
        key: harness.nextUuid()
      }).expect(200)
    ).body;
    assert.equal(restored.version, 4);
    assert.equal(restored.deletedAt, null);
  });
});
