// Upgrade a database actually created by the immutable T53 product, including
// its successful v1 receipt. No old migration or receipt is rewritten.
// The archived app imports cors, retained only as an API devDependency so a
// clean install can run this fixed-version fixture without changing old code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createTeachingTimeClassesHarness } from './teaching-time-classes-harness.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('TM-C1/C5 fixed T53 SQLite upgrade preserves old links and successful receipt', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t51-math-upgrade-'));
  const db=path.join(dir,'data.sqlite');
  let h, passed=false;
  try {
    // Exact git archive of ff248141ac60668cca958b1212bcc2dfcf799490; see fixture provenance.
    const packed=fs.readFileSync(new URL('./fixtures/legacy-source/t53.tar.gz',import.meta.url));
    assert.equal(createHash('sha256').update(packed).digest('hex'),'225d7fd25f0a4a93e7779c12f996ed4fc857ee8da1dd9abe951a9810a6545705');
    const archive=gunzipSync(packed);
    assert.equal(createHash('sha256').update(archive).digest('hex'),'1ffa6e2d8707c4d82bd20b5c3402315ef7613f3e065e2a5e38630d89b431ac5a');
    execFileSync('tar',['-x','-C',dir],{input:archive});
    fs.mkdirSync(path.join(dir,'node_modules','@refatos'),{recursive:true});
    for(const entry of fs.readdirSync(path.join(root,'node_modules'))) {
      if(entry!=='@refatos') fs.symlinkSync(path.join(root,'node_modules',entry),path.join(dir,'node_modules',entry));
    }
    fs.symlinkSync(path.join(dir,'packages/shared'),path.join(dir,'node_modules/@refatos/shared'),'dir');
    fs.writeFileSync(path.join(dir,'package.json'),' {"type":"module"}');
    const script=`
      import { createTeachingTimeClassesHarness, classSample, questionSample, recordSample } from './apps/api/test/teaching-time-classes-harness.js';
      const h=await createTeachingTimeClassesHarness({databasePath:${JSON.stringify(db)}});
      const api=h.agent(h.createAccount('teacher-a'));
      const c=(await api.post('/api/modules/classes/items',classSample(),{key:h.nextUuid()}).expect(201)).body;
      const l=(await api.post('/api/modules/questions/items',questionSample(),{key:h.nextUuid()}).expect(201)).body;
      const body=recordSample(c.id,{sources:[{kind:'question',id:l.id}]}); const key=h.nextUuid();
      const r=(await api.post('/api/modules/classes/records',body,{key}).expect(201)).body;
      process.stdout.write(JSON.stringify({body,key,r})); h.close();
    `;
    fs.writeFileSync(path.join(dir,'seed.mjs'),script);
    const seed=JSON.parse(execFileSync(process.execPath,[path.join(dir,'seed.mjs')],{cwd:dir,encoding:'utf8'}));
    h=await createTeachingTimeClassesHarness({databasePath:db});
    const api=h.agent(h.createAccount('teacher-a'));
    assert.deepEqual((await api.get(`/api/modules/classes/v2/records/${seed.r.id}`).expect(200)).body,{...seed.r,nextNoteHidden:false,content:{version:2,blocks:[]}});
    const id='60000000-0000-4000-8000-000000000001';
    h.db().prepare('INSERT INTO t51_math_adapter(id,accountKey,title) VALUES(?,?,?)').run(id,'teacher-a','升级作品');
    const upgraded=(await api.put(`/api/modules/classes/v2/records/${seed.r.id}`,{...seed.body,expectedVersion:1,sources:[...seed.body.sources,{kind:'math',id}]},{key:'90000000-0000-4000-8000-000000000001'}).expect(200)).body;
    await h.restart();
    assert.deepEqual((await api.post('/api/modules/classes/records',seed.body,{key:seed.key}).expect(201)).body,seed.r);
    assert.deepEqual((await api.get(`/api/modules/classes/v2/records/${seed.r.id}`).expect(200)).body,upgraded);
    assert.equal(h.countRows('classes_records'),1);
    passed=true;
  } finally {
    await h?.close();
    if(passed) fs.rmSync(dir,{recursive:true,force:true});
    else console.error('Retained failed upgrade fixture:',dir);
  }
});
