import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createIntegration } from './auth-integration/harness.js';
import { moduleCatalog } from '@teachbuddy/shared';
import { moduleImplementations } from '../../src/workbench/moduleImplementations.js';
export const workbench = { catalogOverride: moduleCatalog, extraImplementations: moduleImplementations };
export const webDist = path.resolve('apps/web/e2e/fixtures/math-static/dist');
export function startRealMath(options = {}) {
  if (options.directory) fs.mkdirSync(options.directory, { recursive: true });
  return createIntegration({ webDist, workbench, ...options });
}
export async function registerMath(world, email) {
  const client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const pending = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '数学教师', password: 'math-password', termsAccepted: true, rememberMe: true,
    challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
  } });
  if (pending.status !== 201) throw new Error(`Registration failed: ${pending.status}`);
  const active = await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: pending.json.id, rememberMe: true } });
  if (active.status !== 200) throw new Error(`Activation failed: ${active.status}`);
  return { client, session: pending.json };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const world = await startRealMath({ directory: path.resolve(process.env.M41_DATA_DIR || 'test-results/m41/real-manual') });
  // A fixture-only account through the real registration flow; no real email.
  const email = 'math-fixture@example.test';
  const codeResponse = await world.client().request('POST', '/api/auth/registration-codes', { body: { email } });
  if (codeResponse.status === 200) {
    world.clock.advance(31000);
    await registerMath(world, email);
  }
  console.log(`${world.origin}\nreal-auth / fake-mail\n${email} / math-password`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await world.close(); process.exit(0); });
}
