import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { pathToFileURL } from 'node:url';
import { createApp } from '../../../api/src/app.js';
import { createMailer, generateSelfSignedCertificate } from '../../../api/test/fixtures/auth-contract/harness.js';

// Local self-verification only: real authentication, loopback HTTPS, fake mail.
export async function startTeachingAuth({ directory, port = 0, now = () => Date.now() }) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const server = https.createServer(generateSelfSignedCertificate(directory));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const origin = `https://127.0.0.1:${server.address().port}`;
  const mailer = createMailer();
  let context;
  try {
    context = createApp({ env: { nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'),
      authCodeSecret: 't53-isolated-fake-mail-only', workbench: { mode: 'none', testPrincipals: [], publicOrigin: origin, webDist: process.env.WORKBENCH_WEB_DIST || path.resolve('apps/web/dist') } },
      now: () => new Date(now()).getTime(), workbenchClock: () => new Date(now()),
      sendCode: async message => {
        await mailer.sendCode(message);
        fs.writeFileSync(path.join(directory, 'fake-mail.json'), JSON.stringify(mailer.messages), { mode: 0o600 });
      }, workbenchLogger: { info() {}, request() {}, error() {} } });
    await context.workbench.initialize();
    server.on('request', context.app);
  } catch (error) { server.close(); await context?.workbench.close(); throw error; }
  return { ...context, origin, directory, mailer,
    async close() { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await context.workbench.close(); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.T53_AUTH_DATA || !process.env.T53_AUTH_PORT) throw new Error('Set T53_AUTH_DATA and T53_AUTH_PORT; existing data is preserved.');
  const world = await startTeachingAuth({ directory: path.resolve(process.env.T53_AUTH_DATA), port: Number(process.env.T53_AUTH_PORT) });
  console.log(JSON.stringify({ origin: world.origin, identity: 'real-auth', mail: 'fake-mail', directory: world.directory }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await world.close(); process.exit(0); });
}
