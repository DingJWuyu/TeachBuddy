import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../../api/src/server.js';

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-workspace-e2e-'));
const context = startServer({
  env: {
    nodeEnv: 'test',
    port: 4100,
    authSecret: 'teacher-workspace-e2e-secret',
    corsOrigins: ['http://127.0.0.1:5183'],
    sqlitePath: path.join(rootDir, 'data', 'workspace.sqlite'),
    uploadDir: path.join(rootDir, 'uploads'),
    exportDir: path.join(rootDir, 'exports')
  }
});

let closing = false;
function cleanup() {
  if (closing) return;
  closing = true;
  context.server.close(() => {
    context.dataStore.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
    process.exit(0);
  });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
