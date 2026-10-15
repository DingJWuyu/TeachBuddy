import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../../api/src/server.js';

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teachbuddy-e2e-'));
const captureFile = path.resolve(process.cwd(), 'apps/web/e2e/.password-recovery-mail.jsonl');
fs.rmSync(captureFile, { force: true });
// startServer is asynchronous: it loads module implementations and applies
// pending migrations before the socket opens.
const context = await startServer({
  env: {
    nodeEnv: 'test',
    port: 4100,
    sqlitePath: path.join(rootDir, 'data', 'workspace.sqlite')
  },
  mailSender: {
    async send(message) {
      fs.appendFileSync(captureFile, `${JSON.stringify(message)}\n`, 'utf-8');
    }
  }
});

let closing = false;
function cleanup() {
  if (closing) return;
  closing = true;
  context.close().then(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.rmSync(captureFile, { force: true });
    process.exit(0);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
