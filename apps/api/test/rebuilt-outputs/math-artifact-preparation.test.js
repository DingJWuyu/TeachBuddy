import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { application, json, download, worksPath } from './helpers.js';
import { createTestDirectory } from '../support/directories.js';

const samples = JSON.parse(fs.readFileSync(new URL('../fixtures/contracts/math-samples.json', import.meta.url)));
const formulaSource = () => structuredClone(samples.find(entry => entry.id === 'create-formula').value.source);
const graphSource = () => JSON.parse(fs.readFileSync(new URL('../fixtures/math-workshop/saved-plane-view-source.json', import.meta.url)));
const formulaWorkshop = () => {
  const { schemaVersion, kind, ...formula } = formulaSource();
  return { schemaVersion, kind: 'workshop', formulas: [{ id: 'quadratic', ...formula }], graph: null,
    view: 'plane', steps: [], initialStepId: null, animation: null, traceObjects: [] };
};
const write = (client, method, url, body, key) => client.request(method, url, {
  body, headers: { 'Idempotency-Key': key },
});
const problem = (response, status, type) => {
  assert.equal(response.status, status, JSON.stringify(response.json));
  assert.equal(response.json.type.split('/').at(-1), type);
};

// Pause only this test process's real Chromium. HTTP and SQLite remain live so
// another teacher request can commit while the original render is in progress.
async function pauseRenderer(t) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const children = fs.readFileSync(`/proc/self/task/${process.pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean);
    for (const child of children) {
      let command;
      try { command = fs.readFileSync(`/proc/${child}/cmdline`, 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (!command.includes('--remote-debugging-pipe')) continue;
      const pid = Number(child);
      process.kill(pid, 'SIGSTOP');
      let resumed = false;
      const resume = () => {
        if (resumed) return;
        resumed = true;
        try { process.kill(pid, 'SIGCONT'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      };
      t.after(resume);
      return resume;
    }
    await delay(10);
  }
  assert.fail('真实图形成果准备应启动本测试拥有的 Chromium');
}

test('数学成果准备期间另一请求升版，完成渲染后仍拒绝旧版本且不提交成功键', { timeout: 180000 }, async t => {
  const world = await application(t);
  const work = await json(world.client, 'POST', worksPath, {
    title: '初始纯公式', source: formulaWorkshop(), originalFileId: null,
  }, 201);
  const url = `${worksPath}/${work.id}`;
  const key = randomUUID();
  const input = { baseVersion: work.version, title: '准备中的图形', source: graphSource() };
  const pending = write(world.client, 'PUT', url, input, key);
  // A failed setup may close the socket before the assertion reaches pending.
  void pending.catch(() => {});
  const resume = await pauseRenderer(t);
  let archived;
  try {
    archived = await json(world.client, 'POST', `${url}/deletion`, { baseVersion: work.version, deleted: true });
    assert.equal(archived.version, work.version + 1, '制作期间 HTTP 写入不得被渲染事务阻塞');
  } finally { resume(); }
  const conflict = await pending;
  problem(conflict, 409, 'version-conflict');
  assert.equal(conflict.json.currentVersion, archived.version);
  assert.deepEqual(await json(world.client, 'GET', url), archived, '过时成果不能覆盖已提交的源、资产或归档状态');
  const versions = await json(world.client, 'GET', `${url}/versions`);
  assert.deepEqual(versions.items.map(item => item.version), [2, 1], '失败准备不得追加 revision');
  assert.equal(world.workbench.db.prepare('SELECT COUNT(*) AS n FROM workbench_mutation_keys WHERE key=?').get(key).n, 0, '版本冲突不得留下成功回执');
  assert.equal((await sharp(await download(world.client, work.render.posterFileId)).metadata()).format, 'png', '初始可信海报仍可下载');
  world.complete();
});

test('数学运行时不可用保留原作品，恢复同候选运行时后原键可继续真实制作', { timeout: 180000 }, async t => {
  const directory = createTestDirectory('math-preparation-failure-');
  const webDist = path.join(directory, 'web');
  const world = await application(t, { directory, webDist });
  const createKey = randomUUID();
  const input = { title: '等待图形', source: formulaWorkshop(), originalFileId: null };
  const work = await json(world.client, 'POST', worksPath, input, 201, createKey);
  const url = `${worksPath}/${work.id}`;
  const updateKey = randomUUID();
  const update = { baseVersion: work.version, title: '已加入图形', source: graphSource() };
  problem(await write(world.client, 'PUT', url, update, updateKey), 503, 'render-unavailable');
  assert.deepEqual(await json(world.client, 'GET', url), work, '基础渲染故障不得存成 invalid 或覆盖旧资产');
  assert.equal((await json(world.client, 'GET', `${url}/versions`)).items.length, 1);
  const runtime = path.resolve(process.env.WORKBENCH_WEB_DIST ?? 'apps/web/dist', 'vendor/math/geogebra');
  assert.ok(fs.existsSync(path.join(runtime, 'loader.js')), '测试需要同候选源码构建的真实运行时');
  fs.mkdirSync(path.join(webDist, 'vendor/math'), { recursive: true });
  fs.symlinkSync(runtime, path.join(webDist, 'vendor/math/geogebra'), 'dir');
  const repaired = await json(world.client, 'PUT', url, update, 200, updateKey);
  assert.equal(repaired.version, work.version + 1, '准备失败不消耗原键或版本');
  assert.equal(repaired.render.state, 'ready');
  assert.equal((await sharp(await download(world.client, repaired.render.graphPosterFileId)).metadata()).format, 'png');
  assert.deepEqual(await json(world.client, 'POST', worksPath, input, 201, createKey), work, '旧成功创建回执不得按当前源重建作品');
  world.complete();
});

test('成果已准备但最终事务失败时原键重试复用文件，删除后仍重放旧保存与导出回执', { timeout: 180000 }, async t => {
  const world = await application(t);
  const db = world.workbench.db;
  const createKey = randomUUID();
  const input = { title: '稳定成果键', source: formulaSource(), originalFileId: null };
  db.exec(`CREATE TRIGGER reject_math_receipt BEFORE INSERT ON workbench_mutation_keys
    WHEN NEW.path = '${worksPath}' BEGIN SELECT RAISE(ABORT, 'math receipt unavailable'); END`);
  problem(await write(world.client, 'POST', worksPath, input, createKey), 503, 'temporarily-unavailable');
  assert.equal((await json(world.client, 'GET', worksPath)).items.length, 0, '最终回执失败必须回滚作品和历史');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM math_revisions').get().n, 0);
  const preparedFiles = db.prepare('SELECT id FROM materials_files').all();
  assert.equal(preparedFiles.length, 1, '真实海报已持久化，失败不能伪装成未开始准备');
  db.exec('DROP TRIGGER reject_math_receipt');
  const work = await json(world.client, 'POST', worksPath, input, 201, createKey);
  assert.equal(work.render.posterFileId, preparedFiles[0].id, '原请求指纹、存储名称和字节键必须复用准备好的海报');
  const url = `${worksPath}/${work.id}`;
  const updateKey = randomUUID();
  const update = { baseVersion: work.version, title: '后来版本', source: { ...work.source, caption: '后来版本独有说明' } };
  const updated = await json(world.client, 'PUT', url, update, 200, updateKey);
  const exportKey = randomUUID();
  const exportInput = { version: work.version, format: 'svg', background: 'transparent', width: 800 };
  db.exec(`CREATE TRIGGER reject_math_export BEFORE INSERT ON math_exports BEGIN SELECT RAISE(ABORT, 'math export unavailable'); END`);
  problem(await write(world.client, 'POST', `${url}/exports`, exportInput, exportKey), 503, 'temporarily-unavailable');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM math_exports').get().n, 0);
  const exportFiles = db.prepare('SELECT id FROM materials_files').all();
  db.exec('DROP TRIGGER reject_math_export');
  const artifact = await json(world.client, 'POST', `${url}/exports`, exportInput, 201, exportKey);
  assert.ok(exportFiles.some(file => file.id === artifact.file.id), '导出重试也应复用已准备的不可变字节');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM materials_files').get().n, exportFiles.length);
  const bytes = await download(world.client, artifact.file.id);
  assert.match(bytes.toString(), /<svg/);
  assert.match(bytes.toString(), /判别式/, '历史图片制作须使用指定 revision 的源');
  assert.doesNotMatch(bytes.toString(), /后来版本独有说明/, '当前源不得混入历史成果');
  const archived = await json(world.client, 'POST', `${url}/deletion`, { baseVersion: updated.version, deleted: true });
  await json(world.client, 'POST', `${url}/purge`, { baseVersion: archived.version });
  assert.deepEqual(await json(world.client, 'POST', worksPath, { originalFileId: null, source: input.source, title: input.title }, 201, createKey), work, '永久删除后按原键及规范指纹返回原保存回执');
  assert.deepEqual(await json(world.client, 'PUT', url, update, 200, updateKey), updated, '旧更新回执也不得重新生成或写回版本');
  assert.deepEqual(await json(world.client, 'POST', `${url}/exports`, exportInput, 201, exportKey), artifact, '导出原键确认必须先于 revision 查找和成果制作');
  assert.deepEqual(await download(world.client, artifact.file.id), bytes, '删除作品不删除已生成的共享文件');
  assert.equal((await json(world.client, 'GET', worksPath)).items.length, 0, '确认旧回执不得重新创建作品');
  world.complete();
});
