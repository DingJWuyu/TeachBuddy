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

// Deliberately faults only the OS process boundary. Real model execution and
// real systemd cancellation have separate evidence; this checks failed cleanup.
test('an unconfirmed OCR scope blocks another worker until explicit retry stops it', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-cleanup-fault-'));
  const workDirectory = path.join(home, 'instance-one', 'recognition-work');
  const otherWorkDirectory = path.join(home, 'instance-two', 'recognition-work');
  const accountKey = 'account-one';
  const accountDirectory = (root, key) => path.join(root, createHash('sha256').update(key).digest('hex'));
  const pageDirectories = root => fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name);
  for (const name of ['python', 'venv/bin', 'models/PP-DocLayoutV3', 'models/PaddleOCR-VL-1.6', 'models/PP-OCRv5_mobile_det', 'models/PP-OCRv5_mobile_rec'])
    fs.mkdirSync(path.join(home, name), { recursive: true });
  fs.writeFileSync(path.join(home, 'python/python'), 'process boundary fixture');
  fs.symlinkSync('../../python/python', path.join(home, 'venv/bin/python'));
  for (const name of ['manifest.json', 'requirements.freeze.txt']) fs.writeFileSync(path.join(home, name), '{}');
  let launches = 0, stopAttempts = 0, refuseStop = true, controller, successfulOutput = false;
  const stoppedUnits = [];
  const originalReadFile = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...options) => file === '/proc/meminfo'
    ? 'MemAvailable: 16777216 kB\n' : originalReadFile(file, ...options));
  t.mock.method(fs, 'statfsSync', () => ({ bavail: 64 * 1024 ** 2, bsize: 1024 }));
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (file, args, options, callback) => {
    queueMicrotask(() => {
      if (file.endsWith('nvidia-smi')) return callback(null, { stdout: '0, 8192\n', stderr: '' });
      if (args.includes('stop')) {
        stopAttempts++;
        stoppedUnits.push(args.at(-1));
        if (refuseStop) return callback(Object.assign(new Error('stop timeout'), { code: 'ETIMEDOUT' }), '', '');
      }
      callback(null, { stdout: '', stderr: '' });
    });
  };
  t.mock.method(childProcess, 'spawn', (_command, args) => {
    launches++;
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    setImmediate(() => {
      if (successfulOutput) {
        const output = args[args.indexOf('--bind') + 1];
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ width: 1, height: 1,
          assets: [{ name: 'figure.png', file: 'figure.png' }], originalAssets: [] }));
        fs.writeFileSync(path.join(output, 'raw.json'), '{}');
        fs.writeFileSync(path.join(output, 'page.md'), 'text');
        fs.writeFileSync(path.join(output, 'figure.png'), 'original image bytes');
        child.emit('close', 0);
      } else {
        controller.abort(new Error('User cancelled')); child.emit('close', 1);
      }
    });
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
    assert.equal(pageDirectories(ownedDirectory).length, 1, 'failed cleanup preserves its evidence');
    const retained = path.join(ownedDirectory, pageDirectories(ownedDirectory)[0]);
    const owner = JSON.parse(fs.readFileSync(`${retained}.owner.json`, 'utf8'));
    assert.equal(owner.accountKey, accountKey);
    assert.equal(owner.unit, `teachbuddy-ocr-${path.basename(retained).slice(5)}`);
    assert.equal(fs.readFileSync(path.join(retained, 'input/page.png'), 'utf8'), 'input fixture');
    await assert.rejects(run(), { code: 'recognition-cleanup' });
    assert.equal(launches, 1, 'retry cannot start another worker while the old scope is unresolved');
    refuseStop = false;
    await assert.rejects(run(), /User cancelled/);
    assert.equal(launches, 2, 'an explicit retry may resume after the old scope has stopped');
    assert.equal(stopAttempts, 4);

    // Keep actual account-owned input on disk across fresh recognizer instances.
    // Only the systemd boundary is faulted; model execution is not needed here.
    refuseStop = true;
    const otherInstance = createRecognizer({ home, workDirectory: otherWorkDirectory });
    await assert.rejects(run(otherInstance), { code: 'recognition-cleanup' });
    await assert.rejects(run(engine, 'account-two'), { code: 'recognition-cleanup' });
    const legacy = path.join(home, 'work/page-legacy');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'page.png'), 'unowned old input');
    const restarted = createRecognizer({ workDirectory });
    assert.equal(restarted.available, false, 'cleanup remains available when the model is unconfigured');
    await assert.rejects(restarted.cleanupAccount(accountKey), { code: 'recognition-cleanup' });
    assert.equal(fs.existsSync(retained), true, 'unconfirmed stop retains original input');
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
    assert.deepEqual(fs.readdirSync(retained), [], 'interrupted removal has erased the in-directory owner');
    partialRemove.mock.restore();
    const beforeCleanup = stoppedUnits.length;
    await createRecognizer({ workDirectory }).cleanupAccount(accountKey);
    await restarted.cleanupAccount(accountKey);
    assert.equal(fs.existsSync(ownedDirectory), false);
    assert.deepEqual(stoppedUnits.slice(beforeCleanup), [`${owner.unit}.scope`]);
    assert.equal(pageDirectories(accountDirectory(workDirectory, 'account-two')).length, 1, 'other accounts are retained');
    assert.equal(pageDirectories(accountDirectory(otherWorkDirectory, accountKey)).length, 1, 'same account in another instance is retained');
    assert.equal(fs.readFileSync(path.join(legacy, 'page.png'), 'utf8'), 'unowned old input');
    await restarted.cleanupAccount('account-two');
    await otherInstance.cleanupAccount(accountKey);

    fs.mkdirSync(ownedDirectory);
    const beforePage = path.join(ownedDirectory, `page-${randomUUID()}`);
    fs.writeFileSync(`${beforePage}.owner.json`, JSON.stringify({ ...owner, unit: `teachbuddy-ocr-${path.basename(beforePage).slice(5)}` }));
    fs.writeFileSync(path.join(ownedDirectory, `page-${randomUUID()}.owner.json.tmp`), '{');
    await createRecognizer({ workDirectory }).cleanupAccount(accountKey);
    assert.equal(fs.existsSync(ownedDirectory), false, 'restart recovers record-before-page and interrupted record creation');

    const alias = path.join(home, 'instance-link');
    fs.symlinkSync(path.dirname(workDirectory), alias);
    successfulOutput = true;
    const linked = createRecognizer({ home, workDirectory: path.join(alias, 'recognition-work') });
    const result = await run(linked);
    assert.equal(result.assets[0].bytes.toString(), 'original image bytes', 'symbolic-link instance paths retain valid attachments');
    await linked.cleanupAccount(accountKey);
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
  fs.mkdirSync(locked);
  fs.chmodSync(locked, 0o000);
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
