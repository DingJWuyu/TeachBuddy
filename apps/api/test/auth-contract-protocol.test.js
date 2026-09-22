// CC-PROTOCOL / CC-INPUT shape tests: request guard, media type, closed JSON
// bodies, page context and forged identity. All over real HTTP.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_2,
  assertOk,
  assertProblem,
  count,
  createWorld
} from './fixtures/auth-contract/harness.js';
import { REQUEST_SCHEMAS } from '../src/features/auth/validation.js';

const TYPE_WRONG_VALUE = { string: 123, boolean: 'yes', 'string|null': 5 };

function bodyWithTypes(schema, overrides = {}) {
  const body = {};
  for (const [key, type] of Object.entries(schema.properties)) {
    body[key] = type === 'boolean' ? true : type === 'string|null' ? null : 'placeholder';
  }
  return { ...body, ...overrides };
}

const POST_OPERATIONS = [
  { path: '/api/auth/login', schema: REQUEST_SCHEMAS.login },
  { path: '/api/auth/registration-codes', schema: REQUEST_SCHEMAS.emailCode },
  { path: '/api/auth/register', schema: REQUEST_SCHEMAS.register },
  { path: '/api/auth/password-reset-codes', schema: REQUEST_SCHEMAS.emailCode },
  { path: '/api/auth/password-reset', schema: REQUEST_SCHEMAS.passwordReset },
  { path: '/api/auth/session', schema: null },
  { path: '/api/auth/logout', schema: REQUEST_SCHEMAS.logout }
];

describe('CC-PROTOCOL 来源、媒体类型与请求形状', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('P01 缺保护头、错误/null 来源统一403且无副作用，Origin缺失时才回退Referer', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const snapshot = {
      accounts: count(world, 'auth_accounts'),
      challenges: count(world, 'auth_challenges'),
      sessions: count(world, 'auth_sessions')
    };
    const body = { email: 'p01@example.com' };

    assertProblem(await client.request('POST', '/api/auth/registration-codes', { body, protect: false }), {
      status: 403,
      type: 'request-not-allowed'
    });
    assertProblem(
      await client.request('POST', '/api/auth/registration-codes', {
        body,
        protect: false,
        headers: { 'X-TeachBuddy-Request': '0' }
      }),
      { status: 403, type: 'request-not-allowed' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/registration-codes', { body, origin: 'https://evil.example' }),
      { status: 403, type: 'request-not-allowed' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/registration-codes', { body, headers: { Origin: 'null' } }),
      { status: 403, type: 'request-not-allowed' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/registration-codes', { body, origin: null }),
      { status: 403, type: 'request-not-allowed' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/registration-codes', {
        body,
        origin: null,
        headers: { Referer: 'https://evil.example/login' }
      }),
      { status: 403, type: 'request-not-allowed' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/registration-codes', { body, headers: { Origin: 'not a url' } }),
      { status: 403, type: 'request-not-allowed' }
    );

    assert.equal(count(world, 'auth_accounts'), snapshot.accounts);
    assert.equal(count(world, 'auth_challenges'), snapshot.challenges);
    assert.equal(count(world, 'auth_sessions'), snapshot.sessions);

    const viaReferer = await client.request('POST', '/api/auth/registration-codes', {
      body,
      origin: null,
      headers: { Referer: world.baseUrl + '/login?next=%2F' }
    });
    assertOk(viaReferer);
    assert.equal(viaReferer.json.email, 'p01@example.com');
  });

  it('P02 媒体类型先于JSON解析，破损/空body为400', async () => {
    const client = world.client();
    const path = '/api/auth/registration-codes';

    assertProblem(await client.request('POST', path, { rawBody: '{"email":"a@b.co"}', contentType: 'text/plain' }), {
      status: 415,
      type: 'unsupported-media-type'
    });
    assertProblem(await client.request('POST', path, { rawBody: '{"email":"a@b.co"}', contentType: null }), {
      status: 415,
      type: 'unsupported-media-type'
    });
    assertProblem(
      await client.request('POST', path, { rawBody: '{"email":"a@b.co"}', contentType: 'application/json; charset=iso-8859-1' }),
      { status: 415, type: 'unsupported-media-type' }
    );
    assertProblem(await client.request('POST', path, { rawBody: '{ bad json', contentType: 'application/json' }), {
      status: 400,
      type: 'malformed-json'
    });
    assertProblem(await client.request('POST', path, { rawBody: '', contentType: 'application/json' }), {
      status: 400,
      type: 'malformed-json'
    });

    const accepted = await client.request('POST', path, {
      rawBody: '{"email":"p02@example.com"}',
      contentType: 'application/json; charset=UTF-8'
    });
    assertOk(accepted);
  });

  it('P03 根值、未知字段、必填与类型按协议顺序对每个操作适用', async () => {
    const client = world.client();
    for (const operation of POST_OPERATIONS) {
      const { path, schema } = operation;
      assertProblem(await client.request('POST', path, { body: null }), {
        status: 422,
        type: 'invalid-request-body'
      });
      assertProblem(await client.request('POST', path, { body: [] }), {
        status: 422,
        type: 'invalid-request-body'
      });
      assertProblem(await client.request('POST', path, { body: 'text' }), {
        status: 422,
        type: 'invalid-request-body'
      });

      if (schema) {
        assertProblem(await client.request('POST', path, { body: { confirmPassword: 'x' } }), {
          status: 422,
          type: 'unknown-field'
        });
        assertProblem(await client.request('POST', path, { body: {} }), {
          status: 422,
          type: 'required-field',
          field: schema.required[0]
        });
        for (const [key, type] of Object.entries(schema.properties)) {
          const body = bodyWithTypes(schema, { [key]: TYPE_WRONG_VALUE[type] });
          assertProblem(await client.request('POST', path, { body }), {
            status: 422,
            type: 'invalid-field-type',
            field: key
          });
        }
        const withExtra = bodyWithTypes(schema, { confirmPassword: 'x' });
        assertProblem(await client.request('POST', path, { body: withExtra }), {
          status: 422,
          type: 'unknown-field'
        });
      }
    }
  });

  it('P03 命令根对象先拒绝联合外属性，再判 action，再按分支拒绝', async () => {
    const client = world.client();
    const path = '/api/auth/session';
    const cases = [
      [{ foo: 1 }, 422, 'unknown-field', undefined],
      [{ action: 5 }, 422, 'invalid-field-type', 'action'],
      [{ action: 'bogus' }, 422, 'invalid-field-value', 'action'],
      [{}, 422, 'required-field', 'action'],
      [{ action: 'bootstrap', sessionId: 'chl_x' }, 422, 'unknown-field', undefined],
      [{ action: 'bootstrap', extra: 1 }, 422, 'unknown-field', undefined],
      [{ action: 'activate' }, 422, 'required-field', 'sessionId'],
      [{ action: 'activate', sessionId: 'chl_x' }, 422, 'required-field', 'rememberMe'],
      [{ action: 'activate', sessionId: 5, rememberMe: true }, 422, 'invalid-field-type', 'sessionId'],
      [{ action: 'activate', sessionId: 'chl_x', rememberMe: 'yes' }, 422, 'invalid-field-type', 'rememberMe'],
      [{ action: 'activate', sessionId: 'bad id', rememberMe: true }, 422, 'invalid-field-value', 'sessionId'],
      [{ action: 'activate', sessionId: 'chl_x\n', rememberMe: true }, 422, 'invalid-field-value', 'sessionId'],
      [{ action: 'restore', sessionId: 'chl_x', rememberMe: false }, 422, 'unknown-field', undefined],
      [{ action: 'restore', sessionId: '' }, 422, 'invalid-field-value', 'sessionId'],
      [{ action: 'restore' }, 422, 'required-field', 'sessionId']
    ];
    for (const [body, status, type, field] of cases) {
      assertProblem(await client.request('POST', path, { body }), { status, type, field });
    }
  });

  it('P05 全部响应no-store、204无body、无跨源允许头、GET不改变状态', async () => {
    const client = world.client();
    const anonymous = await client.request('GET', '/api/auth/session');
    assertOk(anonymous);
    assert.equal(anonymous.headers['access-control-allow-origin'], undefined);

    const bootstrap = await world.bootstrap(client);
    assert.equal(bootstrap.headers['access-control-allow-origin'], undefined);
    assert.equal(bootstrap.headers['cache-control'], 'no-store');

    const failure = await client.request('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: 'wrong-pass', rememberMe: false }
    });
    assertProblem(failure, { status: 401, type: 'credentials-rejected' });
    assert.equal(failure.headers['access-control-allow-origin'], undefined);

    const logout = await client.request('POST', '/api/auth/logout', { body: { sessionId: null } });
    assert.equal(logout.status, 204);
    assert.equal(logout.text, '');
    assert.equal(logout.headers['cache-control'], 'no-store');
    assert.equal(logout.headers['content-type'], undefined);

    const before = {
      sessions: count(world, 'auth_sessions'),
      bindings: count(world, 'auth_page_bindings'),
      containers: count(world, 'auth_containers')
    };
    await client.request('GET', '/api/auth/session');
    await client.request('GET', '/api/auth/session', { page: PAGE_2 });
    assert.equal(count(world, 'auth_sessions'), before.sessions);
    assert.equal(count(world, 'auth_page_bindings'), before.bindings);
    assert.equal(count(world, 'auth_containers'), before.containers);
  });

  it('P06 页面头缺失/非法为409，伪造身份不能授权', async () => {
    const client = world.client();
    await world.bootstrap(client);

    for (const page of [null, '', '0'.repeat(31), '0'.repeat(33), 'ABCDEF0123456789ABCDEF0123456789', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz']) {
      assertProblem(await client.request('GET', '/api/auth/session', { page }), {
        status: 409,
        type: 'browser-context-required'
      });
      assertProblem(await client.request('POST', '/api/auth/login', {
        page,
        body: { email: 'p06@example.com', password: 'password-1', rememberMe: false }
      }), { status: 409, type: 'browser-context-required' });
      assertProblem(await client.request('POST', '/api/auth/registration-codes', {
        page,
        body: { email: 'p06@example.com' }
      }), { status: 409, type: 'browser-context-required' });
    }

    // A valid page header without a cookie is still anonymous, never authorized.
    const anonymous = await client.request('GET', '/api/auth/session', { cookie: 'none' });
    assertOk(anonymous);
    assert.equal(anonymous.json.browserReady, false);
    assert.equal(anonymous.json.session, null);

    const activateWithoutCookie = await client.request('POST', '/api/auth/session', {
      cookie: 'none',
      body: { action: 'activate', sessionId: 'chl_does_not_matter', rememberMe: true }
    });
    assertProblem(activateWithoutCookie, { status: 409, type: 'browser-context-required' });

    const forgedPrincipal = await world.module.resolvePrincipal({
      headers: {
        'x-teachbuddy-page': '0123456789abcdef0123456789abcdef',
        authorization: 'Bearer forged',
        'x-teachbuddy-account-key': 'usr_forged'
      }
    });
    assert.equal(forgedPrincipal, null);

    // A valid cookie with an unbound page cannot authorize either.
    const account = await world.createAccount({ email: 'p06-bound@example.com' });
    const bound = await world.module.resolvePrincipal({
      headers: { cookie: account.client.jar.header(), 'x-teachbuddy-page': account.client.pageId }
    });
    assert.equal(bound.accountKey, account.accountKey);
    const unbound = await world.module.resolvePrincipal({
      headers: {
        cookie: account.client.jar.header(),
        'x-teachbuddy-page': PAGE_2,
        'x-teachbuddy-account-key': 'usr_forged'
      }
    });
    assert.equal(unbound, null);

    // Forged sessionId inside a valid browser context cannot activate.
    assertProblem(await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: 'ses_forged_but_well_formed', rememberMe: true }
    }), { status: 401, type: 'session-invalid' });
  });
});
