import fs from 'node:fs';
import { createTestDirectory } from './directories.js';
import path from 'node:path';
import https from 'node:https';
import { createApp } from '../../src/app.js';
import { createClock, createMailer, createClient, generateSelfSignedCertificate } from '../fixtures/auth-contract/harness.js';

// One real application per isolated directory. Callers own the directory so a
// failed test can retain it, or reopen it on the same port to verify persistence.
export async function createIntegration(options = {}) {
  const directory = options.directory ?? createTestDirectory('teachbuddy-test-');
  fs.mkdirSync(directory, { recursive: true });
  const server = https.createServer(generateSelfSignedCertificate(directory));
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  const stopServer = async () => {
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    for (const socket of sockets) socket.destroy();
    await closed;
  };
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const origin = `https://127.0.0.1:${server.address().port}`;
  const mailer = options.mailer ?? createMailer();
  const clock = options.clock ?? createClock();
  let context;
  try {
    context = createApp({
      env: {
        nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'),
        authCodeSecret: 'isolated-test-code-secret', registrationOpen: true,
        agent: options.agent ?? { apiKey: '', baseUrl: 'http://127.0.0.1:1' },
        smtpHost: '', smtpUser: '', smtpPassword: '', smtpFrom: '',
        workbench: {
          mode: 'none', filesDir: path.join(directory, 'files'), logDir: path.join(directory, 'logs'),
          recognition: { home: null }, ...options.workbench,
          publicOrigin: origin,
          webDist: options.webDist ?? process.env.WORKBENCH_WEB_DIST ?? path.resolve('apps/web/dist'),
        },
      },
      sendCode: mailer.sendCode, now: clock.now, workbenchClock: options.workbenchClock,
      workbenchLogger: options.logger ?? { info() {}, request() {}, error() {} },
    });
    await context.workbench.initialize();
    server.on('request', context.app);
  } catch (error) {
    await Promise.allSettled([stopServer(), context?.close(), error.cleanup]);
    throw error;
  }
  let closing;
  return {
    ...context, origin, directory, mailer, clock,
    client: () => createClient(origin, { transport: https }),
    close() {
      closing ??= stopServer().finally(() => context.close());
      return closing;
    },
  };
}
