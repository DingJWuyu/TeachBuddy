import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { createApp } from '../../../src/app.js';
import { createClock, createMailer, createClient, generateSelfSignedCertificate } from '../auth-contract/harness.js';

export async function createIntegration(options = {}) {
  const directory = options.directory ?? fs.mkdtempSync(path.join(os.tmpdir(), 'a11-'));
  const tls = generateSelfSignedCertificate(directory);
  const server = https.createServer(tls);
  await new Promise(resolve => server.listen(options.port ?? 0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`;
  const mailer = createMailer();
  const clock = createClock();
  let context;
  try {
    context = createApp({
      env: { nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'), authCodeSecret: 'isolated-a11-test-secret',
        workbench: { ...options.workbench, publicOrigin: origin, webDist: options.webDist ?? path.resolve('apps/web/dist') } },
      sendCode: mailer.sendCode, now: clock.now, workbenchClock: options.workbenchClock,
      workbenchLogger: { info() {}, request() {}, error() {} }
    });
    await context.workbench.initialize();
    server.on('request', context.app);
  } catch (error) { server.close(); throw error; }
  return { ...context, origin, directory, mailer, clock,
    client: () => createClient(origin, { transport: https }),
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); context.workbench.close(); }
  };
}
