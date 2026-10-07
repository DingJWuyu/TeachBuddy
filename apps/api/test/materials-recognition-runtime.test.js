import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';

// This existing fault-injection test proves failed-stop handling and ownership,
// not real inference, namespace teardown or GPU release. Those require the
// actual fixed engine and OS integration verification.
test('an unconfirmed resident OCR scope blocks inference and preserves owned evidence until recovery', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-cleanup-fault-'));
  const workDirectory = path.join(home, 'instance-one', 'recognition-work');
  const otherWorkDirectory = path.join(home, 'instance-two', 'recognition-work');
  const accountKey = 'account-one';
  const accountDirectory = (root, key) => path.join(root, createHash('sha256').update(key).digest('hex'));
  const directories = root => fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name);
  for (const name of ['python', 'venv/bin', 'models', 'llama', 'cudart', 'fonts'])
    fs.mkdirSync(path.join(home, name), { recursive: true });
  fs.writeFileSync(path.join(home, 'python/python'), 'process boundary fixture');
  fs.symlinkSync('../../python/python', path.join(home, 'venv/bin/python'));
  for (const name of ['manifest.json', 'requirements.freeze.txt', 'fonts/DejaVuSans.ttf']) fs.writeFileSync(path.join(home, name), '{}');
  let launches = 0, refuseStop = true, controller, successfulOutput = false;
  const scopes = new Map(), stoppedUnits = [];
  const originalReadFile = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...options) => {
    if (file === '/proc/meminfo') return 'MemAvailable: 16777216 kB\n';
    if (String(file).startsWith('/sys/fs/cgroup/test-ocr/')) {
      const unit = String(file).split('/').at(-2);
      return `populated ${scopes.get(unit) ? 1 : 0}\n`;
    }
    return originalReadFile(file, ...options);
  });
  t.mock.method(fs, 'statfsSync', () => ({ bavail: 64 * 1024 ** 2, bsize: 1024 }));
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (file, args, options, callback) => {
    queueMicrotask(() => {
      if (file.endsWith('nvidia-smi')) return callback(null, { stdout: '0, 4096\n', stderr: '' });
      const unit = args.find(arg => arg.endsWith('.scope'));
      if (args.includes('show')) return callback(null, { stdout: scopes.has(unit)
        ? `LoadState=loaded\nActiveState=${scopes.get(unit) ? 'active' : 'inactive'}\nControlGroup=/test-ocr/${unit}\n`
        : 'LoadState=not-found\nActiveState=inactive\nControlGroup=\n', stderr: '' });
      if (args.includes('stop')) stoppedUnits.push(unit);
      if (!refuseStop && (args.includes('stop') || args.includes('kill'))) scopes.set(unit, false);
      callback(null, { stdout: '', stderr: '' });
    });
  };
  t.mock.method(childProcess, 'spawn', (_command, args) => {
    launches++;
    const unit = `${args[args.indexOf('--unit') + 1]}.scope`;
    scopes.set(unit, true);
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
    let closed = false;
    child.stdin.on('finish', () => { if (!closed) { closed = true; queueMicrotask(() => child.emit('close', 0)); } });
    child.stdin.on('data', line => {
      const request = JSON.parse(line.toString());
      if (!successfulOutput) { controller.abort(new Error('User cancelled')); return; }
      const outputRoot = args[args.indexOf('--bind') + 1];
      const output = path.join(outputRoot, request.requestId);
      const bytes = Buffer.from('original image bytes');
      fs.writeFileSync(path.join(output, 'figure.png'), bytes);
      fs.writeFileSync(path.join(output, 'raw.json'), '{}');
      fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...request,
        pageBlocks: [], assets: [{ name: 'figure.png', file: 'figure.png', bbox: [0, 0, 1, 1], role: 'image',
          sha256: createHash('sha256').update(bytes).digest('hex') }], originalAssets: [], derivations: [] }));
      child.stdout.write(JSON.stringify({ event: 'done', requestId: request.requestId }) + '\n');
    });
    setImmediate(() => child.stdout.write('{"event":"ready","revision":"mineru-pro-2605/document-6"}\n'));
    return child;
  });
  syncBuiltinESMExports();
  let passed = false;
  try {
    const { createRecognizer } = await import('../src/workbench/recognition/runtime.js');
    const engine = createRecognizer({ home, workDirectory });
    const run = (selected = engine, owner = accountKey) => {
      controller = new AbortController();
      return selected.run({ accountKey: owner, bytes: Buffer.from('input fixture'), width: 1, height: 1, signal: controller.signal });
    };
    await assert.rejects(run(), { code: 'recognition-cleanup' });
    assert.equal(launches, 1);
    const ownedDirectory = accountDirectory(workDirectory, accountKey);
    const retained = path.join(ownedDirectory, directories(ownedDirectory)[0]);
    const owner = JSON.parse(fs.readFileSync(`${retained}.owner.json`, 'utf8'));
    assert.equal(owner.accountKey, accountKey);
    assert.equal(owner.unit, `teachbuddy-ocr-${owner.generation}`);
    const requestId = directories(path.join(retained, 'input'))[0];
    assert.equal(fs.readFileSync(path.join(retained, 'input', requestId, 'page.png'), 'utf8'), 'input fixture');
    await assert.rejects(run(), { code: 'recognition-cleanup' });
    await assert.rejects(run(engine, 'account-two'), { code: 'recognition-cleanup' });
    assert.equal(launches, 1, 'an unresolved scope prevents both same-account and other-account launches');
    refuseStop = false;
    await assert.rejects(run(), /User cancelled/);
    assert.equal(launches, 2, 'an explicit retry starts a new generation only after stopping the previous one');

    refuseStop = true;
    const otherInstance = createRecognizer({ home, workDirectory: otherWorkDirectory });
    await assert.rejects(run(otherInstance), { code: 'recognition-cleanup' });
    const legacy = path.join(home, 'work/page-legacy');
    fs.mkdirSync(legacy, { recursive: true }); fs.writeFileSync(path.join(legacy, 'page.png'), 'unowned old input');
    const restarted = createRecognizer({ workDirectory });
    assert.equal(restarted.available, false);
    // Reactivate only the first owned scope to fault restart/account cleanup.
    scopes.set(`${owner.unit}.scope`, true);
    await assert.rejects(restarted.cleanupAccount(accountKey), { code: 'recognition-cleanup' });
    assert.equal(fs.existsSync(retained), true);
    refuseStop = false;
    const originalRemove = fs.rmSync;
    const partialRemove = t.mock.method(fs, 'rmSync', (target, options) => {
      if (target === retained) {
        for (const child of fs.readdirSync(target)) originalRemove(path.join(target, child), { recursive: true, force: true });
        throw Object.assign(new Error('interrupted removal'), { code: 'EIO' });
      }
      return originalRemove(target, options);
    });
    await assert.rejects(restarted.cleanupAccount(accountKey), { code: 'recognition-cleanup' });
    assert.deepEqual(fs.readdirSync(retained), []);
    partialRemove.mock.restore();
    await createRecognizer({ workDirectory }).cleanupAccount(accountKey);
    await restarted.cleanupAccount(accountKey);
    assert.equal(fs.existsSync(ownedDirectory), false);
    assert(directories(accountDirectory(otherWorkDirectory, accountKey)).length > 0, 'another instance retains its owner and evidence');
    assert.equal(fs.readFileSync(path.join(legacy, 'page.png'), 'utf8'), 'unowned old input');
    await otherInstance.cleanupAccount(accountKey);

    // Keep compatibility with pre-residency single-page owners and interrupted
    // record-before-directory creation, even without a configured engine.
    fs.mkdirSync(ownedDirectory);
    const oldPage = path.join(ownedDirectory, `page-${randomUUID()}`);
    fs.writeFileSync(`${oldPage}.owner.json`, JSON.stringify({ accountKey, workRoot: path.dirname(ownedDirectory),
      unit: `teachbuddy-ocr-${path.basename(oldPage).slice(5)}` }));
    fs.writeFileSync(path.join(ownedDirectory, `page-${randomUUID()}.owner.json.tmp`), '{');
    await createRecognizer({ workDirectory }).cleanupAccount(accountKey);
    assert.equal(fs.existsSync(ownedDirectory), false);

    const alias = path.join(home, 'instance-link'); fs.symlinkSync(path.dirname(workDirectory), alias);
    successfulOutput = true;
    const linked = createRecognizer({ home, workDirectory: path.join(alias, 'recognition-work') });
    const result = await run(linked);
    const again = await run(linked);
    assert.equal(result.assets[0].bytes.toString(), 'original image bytes');
    assert.deepEqual(again.assets[0].bbox, [0, 0, 1, 1]);
    assert.equal(again.assets[0].role, 'image', 'new asset geometry and roles survive byte loading');
    assert.equal(launches, 4, 'successful pages reuse one generation');
    await linked.cleanupAccount(accountKey);
    await engine.close(); await restarted.close(); await otherInstance.close(); await linked.close();
    assert(stoppedUnits.every(unit => /^teachbuddy-ocr-[0-9a-f-]+\.scope$/.test(unit)), 'cleanup never uses a wildcard scope');
    passed = true;
  } finally {
    childProcess.execFile = originalExecFile;
    t.mock.restoreAll(); syncBuiltinESMExports();
    if (passed) fs.rmSync(home, { recursive: true, force: true });
  }
});

test('account cleanup rejects an inaccessible directory instead of claiming it is absent', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-cleanup-access-'));
  const locked = path.join(directory, 'locked');
  fs.mkdirSync(locked); fs.chmodSync(locked, 0o000);
  let passed = false;
  try {
    const { createRecognizer } = await import('../src/workbench/recognition/runtime.js');
    const engine = createRecognizer({ workDirectory: path.join(locked, 'recognition-work') });
    await assert.rejects(engine.cleanupAccount('account-one'), { code: 'recognition-cleanup' });
    passed = true;
  } finally {
    fs.chmodSync(locked, 0o700);
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
