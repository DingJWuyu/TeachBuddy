import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// Deliberately faults only the OS process boundary. Real model execution and
// real systemd cancellation have separate evidence; this checks failed cleanup.
test('an unconfirmed OCR scope blocks another worker until explicit retry stops it', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-cleanup-fault-'));
  for (const name of ['python', 'venv/bin', 'models/PP-DocLayoutV3', 'models/PaddleOCR-VL-1.6'])
    fs.mkdirSync(path.join(home, name), { recursive: true });
  fs.writeFileSync(path.join(home, 'python/python'), 'process boundary fixture');
  fs.symlinkSync('../../python/python', path.join(home, 'venv/bin/python'));
  for (const name of ['manifest.json', 'requirements.freeze.txt']) fs.writeFileSync(path.join(home, name), '{}');
  let launches = 0, stopAttempts = 0, refuseStop = true, controller;
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
        if (refuseStop) return callback(Object.assign(new Error('stop timeout'), { code: 'ETIMEDOUT' }), '', '');
      }
      callback(null, { stdout: '', stderr: '' });
    });
  };
  t.mock.method(childProcess, 'spawn', () => {
    launches++;
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    setImmediate(() => { controller.abort(new Error('User cancelled')); child.emit('close', 1); });
    return child;
  });
  syncBuiltinESMExports();
  let passed = false;
  try {
    const { createRecognizer } = await import('../src/workbench/recognition/runtime.js');
    const engine = createRecognizer({ home });
    const run = () => {
      controller = new AbortController();
      return engine.run({ bytes: Buffer.from('input fixture'), width: 1, height: 1, signal: controller.signal });
    };
    await assert.rejects(run(), { code: 'recognition-cleanup' });
    assert.equal(launches, 1);
    assert.equal(fs.readdirSync(path.join(home, 'work')).length, 1, 'failed cleanup preserves its evidence');
    await assert.rejects(run(), { code: 'recognition-cleanup' });
    assert.equal(launches, 1, 'retry cannot start another worker while the old scope is unresolved');
    refuseStop = false;
    await assert.rejects(run(), /User cancelled/);
    assert.equal(launches, 2, 'an explicit retry may resume after the old scope has stopped');
    assert.equal(stopAttempts, 4);
    passed = true;
  } finally {
    childProcess.execFile = originalExecFile;
    t.mock.restoreAll(); syncBuiltinESMExports();
    if (passed) fs.rmSync(home, { recursive: true, force: true });
  }
});
