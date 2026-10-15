import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { createApp } from '../../../src/app.js';
import { createClock, createMailer, createClient, generateSelfSignedCertificate } from '../auth-contract/harness.js';

async function closeApp(context) {
  if (!context) return;
  if (context.close) return context.close();
  // Archived applications predate the unified close port.
  try { await context.workbench.close(); }
  finally { await context.dataStore.close(); }
}

export async function createIntegration(options = {}) {
  const directory = options.directory ?? fs.mkdtempSync(path.join(os.tmpdir(), 'c26-'));
  const tls = generateSelfSignedCertificate(directory);
  const server = https.createServer(tls);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`;
  const mailer = createMailer();
  const clock = createClock();
  let context;
  try {
    context = (options.appFactory ?? createApp)({
      env: { nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'), authCodeSecret: 'isolated-c26-test-secret', agent: options.agent,
        workbench: { publicOrigin: origin, webDist: path.resolve('apps/web/dist') } },
      sendCode: mailer.sendCode, now: clock.now,
      workbenchLogger: { info() {}, request() {}, error() {} }
    });
    await context.workbench.initialize();
    server.on('request', context.app);
  } catch (error) { server.close(); await closeApp(context); await error.cleanup; throw error; }
  return { ...context, origin, directory, mailer, clock,
    client: () => createClient(origin, { transport: https }),
    disconnect() { server.closeAllConnections(); },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await closeApp(context); }
  };
}
