// Fixed-port same-origin HTTPS smoke run for evidence.
//
//   node apps/api/test/fixtures/auth-contract/https-smoke.mjs [port] [reportPath]
//
// Starts the auth module on a real TLS server (self-signed localhost cert),
// performs the bootstrap -> register -> remembered activate flow over HTTPS and
// prints/writes the observed Set-Cookie attributes. Honest boundary: this is a
// real HTTPS client, not a browser; browser reopen/retention stays with the
// frontend integration.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { createClient, createWorld, generateSelfSignedCertificate } from './harness.js';

const port = Number(process.argv[2] ?? 0);
const reportPath = process.argv[3] ?? null;
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-contract-https-smoke-'));
const tls = generateSelfSignedCertificate(workDir);

function redactCookie(cookie) {
  return cookie.replace(/^(__Host-teachbuddy_session=)[^;]*/, '$1<redacted>');
}

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error('check failed: ' + name + ' (' + detail + ')');
}

const world = await createWorld({ workDir, tls, port });
try {
  const client = createClient(world.baseUrl, { transport: https });
  const anonymous = await client.request('GET', '/api/auth/session');
  check('anonymous status 200', anonymous.status === 200, 'status=' + anonymous.status);
  check('tls encrypted', anonymous.encrypted === true, 'encrypted=' + anonymous.encrypted);

  const bootstrap = await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  check('bootstrap status 200', bootstrap.status === 200, 'status=' + bootstrap.status);
  const sessionCookie = bootstrap.setCookies[0] ?? '';
  check('cookie name', sessionCookie.startsWith('__Host-teachbuddy_session='), redactCookie(sessionCookie));
  check('cookie HttpOnly', sessionCookie.includes('HttpOnly'), redactCookie(sessionCookie));
  check('cookie Secure', sessionCookie.includes('Secure'), redactCookie(sessionCookie));
  check('cookie Path=/', sessionCookie.includes('Path=/'), redactCookie(sessionCookie));
  check('cookie SameSite=Lax', sessionCookie.includes('SameSite=Lax'), redactCookie(sessionCookie));
  check('cookie no Domain', !/Domain=/i.test(sessionCookie), redactCookie(sessionCookie));
  check('bootstrap cookie has no expiry', !/Max-Age|Expires/i.test(sessionCookie), redactCookie(sessionCookie));

  const confirmed = await client.request('GET', '/api/auth/session');
  check('GET confirms browserReady', confirmed.json?.browserReady === true, JSON.stringify(confirmed.json));

  const email = 'https-smoke@example.com';
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  check('send code 200', sent.status === 200, 'status=' + sent.status);
  const registered = await client.request('POST', '/api/auth/register', {
    body: {
      email,
      nickname: 'HTTPS',
      password: 'secret-9',
      challengeId: sent.json.challengeId,
      verificationCode: world.mailer.lastCode('registration', email),
      termsAccepted: true,
      rememberMe: true
    }
  });
  check('register 201', registered.status === 201, 'status=' + registered.status);
  const activate = await client.request('POST', '/api/auth/session', {
    body: { action: 'activate', sessionId: registered.json.id, rememberMe: true }
  });
  check('remembered activate 200', activate.status === 200, 'status=' + activate.status);
  const rememberedCookie = activate.setCookies[0] ?? '';
  const maxAge = Number(/Max-Age=(\d+)/.exec(rememberedCookie)?.[1] ?? 0);
  check('remembered Max-Age bounded', maxAge > 0 && maxAge <= 604800, 'Max-Age=' + maxAge);
  check('remembered cookie Secure', rememberedCookie.includes('Secure'), redactCookie(rememberedCookie));

  const principal = await world.module.resolvePrincipal({
    headers: { cookie: client.jar.header(), 'x-teachbuddy-page': client.pageId }
  });
  check('resolvePrincipal after HTTPS activate', principal?.accountKey === registered.json.account.accountKey, JSON.stringify(principal));

  const report = {
    entry: 'apps/api/test/fixtures/auth-contract/https-smoke.mjs',
    port,
    base_url: world.baseUrl,
    generated_at_utc: new Date().toISOString(),
    checks
  };
  const serialized = JSON.stringify(report, null, 2);
  if (reportPath) fs.writeFileSync(reportPath, serialized + '\n');
  console.log(serialized);
} finally {
  await world.stop();
  fs.rmSync(workDir, { recursive: true, force: true });
}
