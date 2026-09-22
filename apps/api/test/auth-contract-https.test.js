// Same-origin HTTPS verification: real TLS server, real HTTPS client, fixed
// cookie attributes. Browser-level retention/restart stays with the frontend
// integration; this covers the server side of the Secure __Host- cookie.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { chromium } from 'playwright';
import { assertOk, createClient, createWorld, generateSelfSignedCertificate } from './fixtures/auth-contract/harness.js';

describe('同源 HTTPS 与 Cookie 固定属性', () => {
  let world;
  before(async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-contract-tls-'));
    const tls = generateSelfSignedCertificate(workDir);
    world = await createWorld({ workDir, tls });
  });
  after(async () => {
    await world.stop();
  });

  it('HTTPS 建立容器与 remembered Cookie，属性固定且无跨源头', async () => {
    assert.ok(world.baseUrl.startsWith('https://'));
    const client = createClient(world.baseUrl, { transport: https });

    const anonymous = await client.request('GET', '/api/auth/session');
    assertOk(anonymous);
    assert.equal(anonymous.encrypted, true);
    assert.equal(anonymous.headers['access-control-allow-origin'], undefined);

    const bootstrap = await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    assertOk(bootstrap);
    assert.equal(bootstrap.encrypted, true);
    const bootstrapCookie = bootstrap.setCookies[0];
    assert.match(bootstrapCookie, /^__Host-teachbuddy_session=[A-Za-z0-9_-]+;/);
    for (const attribute of ['HttpOnly', 'Secure', 'Path=/', 'SameSite=Lax']) {
      assert.ok(bootstrapCookie.includes(attribute), 'missing ' + attribute + ' in ' + bootstrapCookie);
    }
    assert.equal(/Domain=/i.test(bootstrapCookie), false);
    assert.equal(/Max-Age|Expires/i.test(bootstrapCookie), false);

    const confirmed = await client.request('GET', '/api/auth/session');
    assertOk(confirmed);
    assert.equal(confirmed.json.browserReady, true);

    // Mixed http origin against the https public origin is rejected before business.
    const mixedOrigin = await client.request('POST', '/api/auth/registration-codes', {
      body: { email: 'https-mixed@example.com' },
      origin: world.baseUrl.replace('https://', 'http://')
    });
    assert.equal(mixedOrigin.status, 403);
    assert.equal(mixedOrigin.json.type, '/problems/auth/request-not-allowed');

    const email = 'https@example.com';
    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    assertOk(sent);
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
    assertOk(registered, 201);

    const activate = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: registered.json.id, rememberMe: true }
    });
    assertOk(activate);
    assert.equal(activate.encrypted, true);
    const rememberedCookie = activate.setCookies[0];
    const maxAge = Number(/Max-Age=(\d+)/.exec(rememberedCookie)[1]);
    assert.ok(maxAge > 0 && maxAge <= 604800);
    assert.ok(rememberedCookie.includes('Secure'));
    assert.equal(/Domain=/i.test(rememberedCookie), false);
  });

  it('真实浏览器在同源 HTTPS 下固定 Cookie 属性且 HttpOnly 不可见', async (t) => {
    let browser;
    try {
      browser = await chromium.launch();
    } catch (error) {
      t.skip('playwright chromium unavailable: ' + error.message);
      return;
    }

    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto(world.baseUrl + '/__auth-test-page');
      // The real client transport adds its in-memory page context to every
      // auth request; the browser harness does the same.
      const writeHeaders = {
        'Content-Type': 'application/json',
        'X-TeachBuddy-Request': '1',
        'X-TeachBuddy-Page': 'abcdef0123456789abcdef0123456789'
      };

      const browserFetch = (requestPath, options) =>
        page.evaluate(
          async ({ requestPath, options }) => {
            const response = await fetch(requestPath, options);
            let body = null;
            try {
              body = await response.json();
            } catch {
              body = null;
            }
            return { status: response.status, body };
          },
          { requestPath, options }
        );

      const bootstrap = await browserFetch('/api/auth/session', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ action: 'bootstrap' })
      });
      assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap.body));

      const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === '__Host-teachbuddy_session');
      assert.ok(sessionCookie, 'browser stored the session cookie over HTTPS');
      assert.equal(sessionCookie.httpOnly, true);
      assert.equal(sessionCookie.secure, true);
      assert.equal(sessionCookie.path, '/');
      assert.equal(sessionCookie.sameSite, 'Lax');
      assert.equal(sessionCookie.expires, -1, 'bootstrap cookie is a session cookie');
      assert.equal(sessionCookie.domain, '127.0.0.1');
      const visibleToScript = await page.evaluate(() => document.cookie);
      assert.equal(visibleToScript.includes('__Host-teachbuddy_session'), false, 'HttpOnly hides the cookie');

      const email = 'browser-https@example.com';
      const sent = await browserFetch('/api/auth/registration-codes', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ email })
      });
      assert.equal(sent.status, 200, JSON.stringify(sent.body));

      const registered = await browserFetch('/api/auth/register', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({
          email,
          nickname: 'Browser',
          password: 'secret-9',
          challengeId: sent.body.challengeId,
          verificationCode: world.mailer.lastCode('registration', email),
          termsAccepted: true,
          rememberMe: true
        })
      });
      assert.equal(registered.status, 201, JSON.stringify(registered.body));

      const activate = await browserFetch('/api/auth/session', {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ action: 'activate', sessionId: registered.body.id, rememberMe: true })
      });
      assert.equal(activate.status, 200, JSON.stringify(activate.body));

      const remembered = (await context.cookies()).find((cookie) => cookie.name === '__Host-teachbuddy_session');
      const nowSeconds = Math.floor(Date.now() / 1000);
      assert.ok(remembered.expires > nowSeconds, 'remembered cookie has an absolute expiry');
      // Max-Age is relative to the browser clock; allow its second rounding.
      assert.ok(remembered.expires <= nowSeconds + 604800 + 2, 'remembered cookie never exceeds 7 days');
      assert.equal(remembered.httpOnly, true);
      assert.equal(remembered.secure, true);

      const status = await browserFetch('/api/auth/session', {
        method: 'GET',
        headers: { 'X-TeachBuddy-Page': writeHeaders['X-TeachBuddy-Page'] }
      });
      assert.equal(status.status, 200, JSON.stringify(status.body));
      assert.equal(status.body.browserReady, true);
      assert.equal(status.body.session.state, 'active');
      assert.equal(status.body.session.persistence, 'remembered');
      await context.close();
    } finally {
      await browser.close();
    }
  });
});
