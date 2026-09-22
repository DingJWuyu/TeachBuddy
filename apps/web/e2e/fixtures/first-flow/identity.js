/**
 * Runner-side identity bootstrap for first-flow browser tests.
 *
 * The isolated runner binds two test principals server-side and writes their
 * cookie values to `<data-dir>/principals.json`. Browser contexts are seeded
 * from that file, so a page cannot choose or forge a principal: there is no
 * query parameter, request header or body field that selects an account.
 *
 * Usage in a spec (B14/B15):
 *   import { bootstrapPrincipal, FIRST_FLOW_ACCOUNTS } from './fixtures/first-flow/identity.js';
 *   await bootstrapPrincipal(context, FIRST_FLOW_ACCOUNTS[0]);
 * Only valid while `FIRST_FLOW_E2E=1` runs the suite against the HTTPS runner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { TEST_ACCOUNT_KEYS } from '../../../../api/test/fixtures/first-flow/accounts.js';

export const FIRST_FLOW_ACCOUNTS = TEST_ACCOUNT_KEYS;
export const FIRST_FLOW_ORIGIN = process.env.FIRST_FLOW_ORIGIN ?? 'https://localhost:47112';

export function firstFlowDataDir(env = process.env) {
  return env.FIRST_FLOW_DATA_DIR
    ? path.resolve(env.FIRST_FLOW_DATA_DIR)
    : path.resolve(process.cwd(), 'test-results', 'first-flow', 'data');
}

export function readTestPrincipals(options = {}) {
  const dataDir = options.dataDir ?? firstFlowDataDir();
  const file = path.join(dataDir, 'principals.json');
  if (!fs.existsSync(file)) {
    throw new Error(
      `No runner identities at ${file}. Start the isolated runner (node scripts/first-flow/start.mjs) `
      + 'or run the suite with FIRST_FLOW_E2E=1.'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * Seed one browser context with a runner-bound test identity. `accountKey`
 * must be one of the accounts the runner bound; anything else fails loudly.
 *
 * Attributes mirror the frozen auth SessionCookie scheme (HttpOnly, Secure,
 * Path=/, SameSite=Lax, no Domain), so a browser test sees the same cookie
 * shape the real adapter must issue.
 */
export async function bootstrapPrincipal(context, accountKey = FIRST_FLOW_ACCOUNTS[0], options = {}) {
  const origin = options.origin ?? FIRST_FLOW_ORIGIN;
  const principals = readTestPrincipals(options);
  const token = principals.accounts?.[accountKey];
  if (!token) {
    throw new Error(
      `Unknown runner identity ${accountKey}. Bound identities: ${Object.keys(principals.accounts ?? {}).join(', ')}`
    );
  }
  // Playwright accepts exactly one of `url`/`path`; the URL form yields a
  // host-only cookie on Path=/, which is what the `__Host-` prefix requires.
  if (!principals.cookieName) {
    throw new Error(`Runner identities at ${firstFlowDataDir(options)} have no cookieName; restart the runner.`);
  }
  await context.addCookies([
    {
      name: principals.cookieName,
      value: token,
      url: origin,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }
  ]);
  return { accountKey, origin, token };
}
