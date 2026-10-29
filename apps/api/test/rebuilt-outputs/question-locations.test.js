import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { application, upload, importFiles, readFixture, json, importsPath } from './helpers.js';

for (const name of ['questions/W.docx', 'materials/w.doc']) test(`题库定位：${name}真实校对拒绝另一原件、错误转换稿和越界段落/run，失败保留原状态`, { timeout: 180000 }, async t => {
  const world = await application(t), { client } = world;
  const file = await upload(client, name.split('/').at(-1), readFixture(name));
  let material = await importFiles(client, [file.id]);
  const db = world.workbench.db;
  const taskRow = db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?');
  const task = JSON.parse(taskRow.get(material.jobId).value);
  const otherFile = await upload(client, '另一份原稿.docx', readFixture('questions/W.docx'));
  const otherMaterial = await importFiles(client, [otherFile.id]);
  const otherTask = JSON.parse(taskRow.get(otherMaterial.jobId).value);
  const draftIndex = material.drafts.findIndex(draft => draft.parts.some(part => part.locations.some(location => location.kind === 'docx')));
  assert.ok(draftIndex >= 0, '真实提取必须产生可校对的结构定位');
  material = await json(client, 'PUT', `${importsPath}/${material.id}`, { baseVersion: material.version, drafts: material.drafts, fragments: material.fragments });
  material = await json(client, 'GET', `${importsPath}/${material.id}`);
  const valid = material.drafts[draftIndex].parts.flatMap(part => part.locations).find(location => location.kind === 'docx');
  const failures = [
    ['另一原件', { ...valid, fileId: otherFile.id }],
    ['越界paragraph', { ...valid, paragraph: task.paragraphs[file.id].length + 1 }],
    ['越界run', { ...valid, runEnd: task.paragraphs[file.id][valid.paragraph - 1] + 1 }],
    ['错误分页转换稿', { kind: 'page', fileId: file.id, renditionFileId: otherTask.renditions[0].renditionFileId, page: 1, box: null }],
  ];
  if (name.endsWith('.doc')) {
    assert.equal(task.nativeWordSources[file.id].format, 'libreoffice-docx-v1', 'DOC必须真实转换并保存来源摘要');
    failures.push(['错误DOC转换来源', valid, { ...task, nativeWordSources: { ...task.nativeWordSources,
      [file.id]: { ...task.nativeWordSources[file.id], fileId: otherFile.id } } }]);
  }
  for (const [label, invalid, tamperedTask] of failures) {
    if (tamperedTask) db.prepare('UPDATE questions_materials_tasks SET value=? WHERE id=?').run(JSON.stringify(tamperedTask), material.jobId);
    const before = db.prepare('SELECT * FROM questions_materials_imports WHERE id=?').get(material.id);
    const taskBefore = taskRow.get(material.jobId);
    const drafts = structuredClone(material.drafts);
    drafts[draftIndex].parts[0].locations = [invalid];
    const key = randomUUID();
    const response = await client.request('PUT', `${importsPath}/${material.id}`, {
      body: { baseVersion: material.version, drafts, fragments: material.fragments }, headers: { 'Idempotency-Key': key },
    });
    assert.equal(response.status, 422, `${label}: HTTP ${response.status}, ${response.json.type ?? '意外接受'}`);
    assert.equal(response.json.type, '/problems/materials/invalid-location', label);
    assert.deepEqual(db.prepare('SELECT * FROM questions_materials_imports WHERE id=?').get(material.id), before, `${label}不能升版或部分保存`);
    assert.deepEqual(taskRow.get(material.jobId), taskBefore, `${label}不能改写提取证据`);
    assert.equal(db.prepare('SELECT 1 FROM workbench_mutation_keys WHERE key=?').get(key), undefined, `${label}失败不能消耗键`);
    if (tamperedTask) db.prepare('UPDATE questions_materials_tasks SET value=? WHERE id=?').run(JSON.stringify(task), material.jobId);
  }
  const reread = await json(client, 'GET', `${importsPath}/${material.id}`);
  assert.deepEqual(reread, material, '全部拒绝后真实HTTP读回保持原校对状态');
  world.complete();
});
