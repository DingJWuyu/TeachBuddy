import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeachingTimeClassesHarness, classSample, questionSample, lessonSample, recordSample } from './teaching-time-classes-harness.js';

for (const kind of ['question', 'lesson']) {
  test(`TM-C6 HTTP: ${kind} 404 must not become a tombstone`, async () => {
    const h = await createTeachingTimeClassesHarness();
    try {
      const api = h.agent(h.createAccount('teacher-a'));
      const c = (await api.post('/api/modules/classes/items', classSample(), { key: h.nextUuid() }).expect(201)).body;
      const source = (await api.post(`/api/modules/${kind}s/items`, kind === 'question' ? questionSample() : lessonSample(), { key: h.nextUuid() }).expect(201)).body;
      const r = (await api.post('/api/modules/classes/records', recordSample(c.id, { sources: [{kind, id: source.id}] }), {key: h.nextUuid()}).expect(201)).body;
      h.db().prepare(`DELETE FROM ${kind}_items WHERE id = ?`).run(source.id);
      const result = await api.get(`/api/modules/classes/records/${r.id}`);
      assert.equal(result.status, 404, JSON.stringify(result.body));
    } finally { h.close(); }
  });
}

const V1 = '/api/modules/classes/records';
const V2 = '/api/modules/classes/v2/records';
const REVERSE = '/api/modules/classes/v2/source-records';
const WORK = '60000000-0000-4000-8000-000000000001';
async function fixture(run) {
  const h = await createTeachingTimeClassesHarness();
  try {
    const api = h.agent(h.createAccount('teacher-a'));
    const c = (await api.post('/api/modules/classes/items', classSample(), {key:h.nextUuid()}).expect(201)).body;
    h.db().prepare('INSERT INTO t51_math_adapter(id,accountKey,title) VALUES(?,?,?)').run(WORK,'teacher-a','函数图象');
    const input = recordSample(c.id, {sources:[{kind:'math',id:WORK}]});
    const write = (url, body, status = 200, key = h.nextUuid()) => api.post(url, body, {key}).expect(status);
    await run({h,api,c,input,write});
  } finally {h.close();}
}

test('TM-C1/C2: v2 current titles, tombstones, retained links, remove/relink and restart', async () => fixture(async ({h,api,input,write}) => {
  const r = (await write(V2,input,201)).body;
  assert.equal(r.sources[0].labelAtLink,'函数图象');
  h.db().prepare('UPDATE t51_math_adapter SET title=?,version=2,deletedAt=?').run('新标题','2026-09-22T00:00:00Z');
  const deleted = (await api.get(`${V2}/${r.id}`).expect(200)).body;
  assert.deepEqual({...deleted,sources:r.sources},r);
  assert.deepEqual(deleted.sources[0],{kind:'math',id:WORK,labelAtLink:'函数图象',currentLabel:'新标题',deleted:true});
  await write(V2,input,409);
  await api.put(`${V2}/${r.id}`,{...input,note:'保留删除来源',expectedVersion:1},{key:h.nextUuid()}).expect(200);
  await write(`${V2}/${r.id}/deletion`,{expectedVersion:2,deleted:true});
  await write(`${V2}/${r.id}/deletion`,{expectedVersion:3,deleted:false});
  await api.put(`${V2}/${r.id}`,{...input,sources:[],expectedVersion:4},{key:h.nextUuid()}).expect(200);
  await api.put(`${V2}/${r.id}`,{...input,expectedVersion:5},{key:h.nextUuid()}).expect(409);
  h.db().prepare('UPDATE t51_math_adapter SET deletedAt=NULL').run();
  const linked = (await api.put(`${V2}/${r.id}`,{...input,expectedVersion:5},{key:h.nextUuid()}).expect(200)).body;
  assert.equal(linked.sources[0].labelAtLink,'新标题');
  await h.restart();
  assert.deepEqual((await api.get(`${V2}/${r.id}`).expect(200)).body,linked);
}));

test('TM-C4/C5: shared records, legacy loss guards and original successful receipt after restart', async () => fixture(async ({h,api,c,input,write}) => {
  const legacyBody = {...input,sources:[]}; const oldKey = h.nextUuid();
  const old = (await write(V1,legacyBody,201,oldKey)).body;
  assert.deepEqual((await api.get(`${V2}/${old.id}`).expect(200)).body,{...old,nextNoteHidden:false,content:{version:2,blocks:[]}});
  const mixed = (await api.put(`${V2}/${old.id}`,{...input,expectedVersion:1},{key:h.nextUuid()}).expect(200)).body;
  assert.equal(mixed.version,2);
  for (const url of [`${V1}/${old.id}`,`${V1}?classId=${c.id}`]) {
    const res = await api.get(url).expect(422);
    assert.equal(res.body.reason,'unsupported-content-version');
  }
  for (const version of [1,2]) {
    await api.put(`${V1}/${old.id}`,{...legacyBody,expectedVersion:version},{key:h.nextUuid()}).expect(version===1?409:422);
    await write(`${V1}/${old.id}/deletion`,{expectedVersion:version,deleted:true},version===1?409:422);
  }
  await h.restart();
  assert.deepEqual((await write(V1,legacyBody,201,oldKey)).body,old);
  await write(V2,legacyBody,409,oldKey);
  assert.deepEqual((await api.get(`${V2}/${old.id}`).expect(200)).body,mixed);
  await api.put(`${V2}/${old.id}`,{...legacyBody,expectedVersion:2},{key:h.nextUuid()}).expect(200);
  await api.get(`${V1}/${old.id}`).expect(200);
}));

test('TM-C3/C6: complete reverse feedback, ownership and rollback of mutations/receipts', async () => fixture(async ({h,api,c,input,write}) => {
  const q = (await write('/api/modules/questions/items',questionSample(),201)).body;
  input.sources.unshift({kind:'question',id:q.id});
  const one = (await write(V2,input,201)).body;
  h.advance(60000);
  const c2 = (await write('/api/modules/classes/items',classSample({name:'二班'}),201)).body;
  const two = (await write(V2,{...input,classId:c2.id},201)).body;
  assert.deepEqual((await api.get(`${REVERSE}/math/${WORK}`).expect(200)).body.items.map(r=>r.id),[two.id,one.id]);
  assert.equal((await api.get(`${REVERSE}/question/${q.id}`).expect(200)).body.items[0].sources.length,2);
  await api.get(`/api/modules/classes/source-records/question/${q.id}`).expect(422);
  await h.agent(h.createAccount('teacher-b')).get(`${REVERSE}/math/${WORK}`).expect(404);
  for (const fault of [404,503]) {
    h.db().prepare('UPDATE t51_math_adapter SET fault=?').run(fault);
    const rows=h.countRows('classes_records'), receipts=h.countRows('workbench_mutation_keys');
    const key=h.nextUuid();
    await write(V2,input,fault,key);
    const degraded = (await api.get(`${V2}/${one.id}`).expect(200)).body;
    assert.equal(degraded.sources[1].unavailable, fault === 404 ? 'missing' : 'temporary');
    assert.equal(degraded.sources[1].deleted, null);
    assert.ok((await api.get(`${V2}?classId=${c.id}`).expect(200)).body.items.some(row => row.id === one.id));
    assert.ok((await api.get(`${REVERSE}/question/${q.id}`).expect(200)).body.items.some(row => row.id === one.id));
    await api.get(`${REVERSE}/math/${WORK}`).expect(fault);
    assert.equal(h.countRows('workbench_mutation_keys'),receipts);
    const updated = (await api.put(`${V2}/${one.id}`,{...input,note:'正文仍可写入',expectedVersion:degraded.version},{key:h.nextUuid()}).expect(200)).body;
    await write(`${V2}/${one.id}/deletion`,{expectedVersion:updated.version,deleted:true});
    await write(`${V2}/${one.id}/deletion`,{expectedVersion:updated.version+1,deleted:false});
    assert.equal(h.countRows('classes_records'),rows);
    assert.equal(h.countRows('workbench_mutation_keys'),receipts+3);
    assert.equal(h.query('SELECT version FROM classes_records WHERE id=?',one.id)[0].version,degraded.version+3);
    h.db().prepare('UPDATE t51_math_adapter SET fault=NULL').run();
    await write(V2,input,201,key);
  }
  await write('/api/modules/classes/items/'+c2.id+'/deletion',{expectedVersion:1,deleted:true});
  assert.ok((await api.get(`${REVERSE}/math/${WORK}`).expect(200)).body.items.every(r=>r.classId!==c2.id));
}));

test('TM-C6 strict sources, empty titles, invalid render and v2 replay', async () => fixture(async ({h,api,input,write}) => {
  for (const extra of ['workVersion','accountId','attrs','labelAtLink']) {
    const res = await write(V2,{...input,sources:[{...input.sources[0],[extra]:1}]},422);
    assert.equal(res.body.field,`/sources/0/${extra}`);
  }
  for (const sources of [null,[{kind:'work',id:WORK}],[{kind:'math'}],[{kind:'math',id:'bad'}]]) await write(V2,{...input,sources},422);
  const duplicate = await write(V2,{...input,sources:[...input.sources,...input.sources]},422);
  assert.equal(duplicate.body.reason,'duplicate-id'); assert.equal(duplicate.body.field,'/sources/1/id');
  const oldMath = await write(V1,input,422);
  assert.equal(oldMath.body.reason,'invalid-reference');
  await api.get(`/api/modules/classes/source-records/math/${WORK}`).expect(422);
  await write(V2,{...input,note:''},422);
  h.db().prepare("UPDATE t51_math_adapter SET title='',render='invalid'").run();
  const key=h.nextUuid(), r=(await write(V2,input,201,key)).body;
  assert.equal(r.sources[0].labelAtLink,''); assert.equal(r.sources[0].currentLabel,'');
  h.db().prepare('UPDATE t51_math_adapter SET fault=503').run();
  await h.restart();
  assert.deepEqual((await write(V2,input,201,key)).body,r);
}));

test('TM-C7 schedule RecordReference remains readable when math projection fails', async () => fixture(async ({h,api,input,write}) => {
  const r=(await write(V2,input,201)).body;
  const entry=(await write('/api/modules/schedule/entries',{
    title:'摘要不解析作品',items:[],time:{date:'2026-09-21',startTime:'15:00',durationMinutes:90,timeZone:'Asia/Shanghai'},repeat:null,reminder:null,
    course:{classId:input.classId,lessonId:null,recordIds:[r.id]}
  },201)).body;
  h.db().prepare('UPDATE t51_math_adapter SET fault=503').run();
  const summary=await api.get(`/api/modules/schedule/entries/${entry.id}`).expect(200);
  assert.equal(summary.body.courseState.records[0].id,r.id);
  assert.equal((await api.get(`${V2}/${r.id}`).expect(200)).body.sources[0].unavailable,'temporary');
}));

test('TM-C6 restoration succeeds with unavailable source, preserves text, and replays the original receipt', async () => fixture(async ({h,api,input,write}) => {
  const r=(await write(V2,input,201)).body;
  const deleted=(await write(`${V2}/${r.id}/deletion`,{expectedVersion:1,deleted:true})).body;
  const receipts=h.countRows('workbench_mutation_keys');
  h.db().prepare('UPDATE t51_math_adapter SET fault=503').run();
  const key=h.nextUuid();
  const restored = (await write(`${V2}/${r.id}/deletion`,{expectedVersion:2,deleted:false},200,key)).body;
  assert.equal(restored.sources[0].unavailable,'temporary');
  assert.equal(restored.note,r.note);
  assert.equal(h.countRows('workbench_mutation_keys'),receipts+1);
  const stored=h.query('SELECT version,deletedAt FROM classes_records WHERE id=?',r.id)[0];
  assert.deepEqual(stored,{version:3,deletedAt:null});
  h.db().prepare('UPDATE t51_math_adapter SET fault=NULL').run();
  assert.deepEqual((await write(`${V2}/${r.id}/deletion`,{expectedVersion:2,deleted:false},200,key)).body,restored);
}));
