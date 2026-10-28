import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { once } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';

// Exercise the actual resident runtime with real local processes. Only GPU
// capacity and systemd/cgroup observations are controlled; no model is loaded.
export async function localRecognizer(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'teachbuddy-ocr-process-'));
  const home = path.join(directory, 'engine');
  for (const name of ['python', 'venv/bin', 'models', 'llama', 'cudart', 'fonts']) fs.mkdirSync(path.join(home, name), { recursive: true });
  fs.writeFileSync(path.join(home, 'python/python'), 'local protocol fixture');
  fs.symlinkSync('../../python/python', path.join(home, 'venv/bin/python'));
  for (const name of ['manifest.json', 'requirements.freeze.txt', 'fonts/DejaVuSans.ttf']) fs.writeFileSync(path.join(home, name), '{}');
  const modeFile = path.join(directory, 'mode');
  const marker = path.join(directory, 'request.json');
  fs.writeFileSync(modeFile, 'success');
  const worker = path.join(directory, 'worker.cjs');
  fs.writeFileSync(worker, `const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const [input,output,modeFile,marker,attempt]=process.argv.slice(2);
console.log(JSON.stringify({event:'ready',revision:'mineru-pro-2605/document-6'}));
readline.createInterface({input:process.stdin}).on('line',line=>{
 const r=JSON.parse(line),dir=path.join(output,r.requestId),mode=fs.readFileSync(modeFile,'utf8');
 fs.copyFileSync(path.join(input,r.requestId,'page.png'),path.join(dir,'asset.png'));
 fs.writeFileSync(path.join(dir,'raw.json'),JSON.stringify({attempt:Number(attempt),mode,source:'local protocol worker'}));
 fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({...r,pageBlocks:[{type:'text',bbox:[.1,.1,.9,.3],content:[{type:'text',content:'1. 已知函数，求其零点。'}]}],assets:[{name:'original-page.png',file:'asset.png'}],originalAssets:[],derivations:[]}));
 fs.writeFileSync(marker,JSON.stringify({requestId:r.requestId,output:dir,attempt:Number(attempt)}));
 if(mode==='success')console.log(JSON.stringify({event:'done',requestId:r.requestId}));
});`);
  const originalSpawn = childProcess.spawn, originalExec = childProcess.execFile;
  const originalRead = fs.readFileSync, originalStatfs = fs.statfsSync, originalTimer = globalThis.setTimeout;
  const scopes = new Map(), deadlines = [];
  let refuseStop = false, launches = 0, passed = false;
  const running = keeper => keeper.exitCode === null && keeper.signalCode === null;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (file === '/proc/meminfo') return 'MemAvailable: 16777216 kB\n';
    if (String(file).startsWith('/sys/fs/cgroup/teachbuddy-local-test/')) {
      const scope = String(file).split('/').at(-2);
      return `populated ${scopes.has(scope) && running(scopes.get(scope)) ? 1 : 0}\n`;
    }
    return originalRead(file, ...args);
  });
  t.mock.method(fs, 'statfsSync', (file, ...args) => String(file).startsWith(directory) ? { bavail: 64 * 1024 ** 2, bsize: 1024 } : originalStatfs(file, ...args));
  childProcess.execFile = (file, args, options, callback) => {
    if (file !== '/usr/bin/nvidia-smi' && file !== '/usr/bin/systemctl') return originalExec(file, args, options, callback);
    queueMicrotask(async () => {
      try {
        if (file === '/usr/bin/nvidia-smi') return callback(null, { stdout: '0, 4096\n', stderr: '' });
        const unit = args.find(arg => arg.endsWith('.scope'));
        assert.match(unit, /^teachbuddy-ocr-[0-9a-f-]+\.scope$/, '只能控制本实例具名 scope');
        const keeper = scopes.get(unit);
        if (args.includes('show')) return callback(null, { stdout: keeper
          ? `LoadState=loaded\nActiveState=${running(keeper) ? 'active' : 'inactive'}\nControlGroup=/teachbuddy-local-test/${unit}\n`
          : 'LoadState=not-found\nActiveState=inactive\nControlGroup=\n', stderr: '' });
        if (!refuseStop && keeper && running(keeper)) { keeper.kill('SIGKILL'); await once(keeper, 'exit'); }
        callback(null, { stdout: '', stderr: '' });
      } catch (error) { callback(error); }
    });
  };
  t.mock.method(childProcess, 'spawn', (command, args, options) => {
    if (command !== '/usr/bin/systemd-run') return originalSpawn(command, args, options);
    const bind = args.indexOf('--bind');
    const input = args[bind - 2];
    const unit = `${args[args.indexOf('--unit') + 1]}.scope`;
    const keeper = originalSpawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' });
    scopes.set(unit, keeper);
    return originalSpawn(process.execPath, [worker, input, args[bind + 1], modeFile, marker, String(++launches)], options);
  });
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    if (delay !== 300000) return originalTimer(callback, delay, ...args);
    const handle = originalTimer(() => {}, delay);
    deadlines.push(() => callback(...args));
    return handle;
  });
  syncBuiltinESMExports();
  // Bind the controlled system calls in a fresh module; application.js may
  // already have loaded the default runtime before this fixture was installed.
  const { createRecognizer } = await import(`../../src/workbench/recognition/runtime.js?local-process=${path.basename(directory)}`);
  const recognizer = createRecognizer({ home, workDirectory: path.join(directory, 'work') });
  t.after(async () => {
    refuseStop = false;
    try { await recognizer.close(); }
    finally {
      for (const keeper of scopes.values()) if (running(keeper)) { keeper.kill('SIGKILL'); await once(keeper, 'exit'); }
      childProcess.execFile = originalExec; t.mock.restoreAll(); syncBuiltinESMExports();
      if (passed) fs.rmSync(directory, { recursive: true, force: true }); else t.diagnostic(`保留本地识别进程现场 ${directory}`);
    }
  });
  return { recognizer, directory, get launches() { return launches; },
    mode(value) { fs.writeFileSync(modeFile, value); },
    refuseStop(value) { refuseStop = value; },
    timeout() { deadlines.at(-1)(); },
    async requestAfter(previous = 0) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (fs.existsSync(marker)) { const request = JSON.parse(originalRead(marker, 'utf8')); if (request.attempt > previous) return request; }
        await new Promise(resolve => originalTimer(resolve, 20));
      }
      assert.fail('本地 worker 未收到实际页请求');
    },
    complete() { passed = true; },
  };
}
