/**
 * Shared context for the B12 workbench tests: an isolated SQLite file, the
 * test-principal identity seam, the probe fixture module and its catalog
 * override. Nothing here touches a developer database or a fixed port.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moduleCatalog, workbenchHeaders } from '@refatos/shared';
import { createApp } from '../src/app.js';
import { resolveFixtureSets } from './fixtures/first-flow/catalog.js';
import { TEST_ACCOUNT_KEYS } from './fixtures/first-flow/accounts.js';

export const TEST_ORIGIN = 'https://workbench.test';
export const ACCOUNT_A = TEST_ACCOUNT_KEYS[0];
export const ACCOUNT_B = TEST_ACCOUNT_KEYS[1];
export const FIXTURE_ACCOUNT = ACCOUNT_A;

export function createTempRoot(prefix = 'teacher-workspace-workbench-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export async function createWorkbenchContext(options = {}) {
  const {
    principals = [ACCOUNT_A, ACCOUNT_B],
    fixtures = ['workbench-probe'],
    extraCatalogEntries = [],
    nodeEnv = 'test',
    sqlitePath = null,
    rootDir: providedRootDir = null,
    workbench: workbenchOverrides = {},
    appOptions = {}
  } = options;

  const rootDir = providedRootDir ?? createTempRoot();
  const databasePath = sqlitePath ?? path.join(rootDir, 'data', 'workspace.sqlite');
  const { implementations, entries } = resolveFixtureSets(fixtures);

  const app = createApp({
    env: {
      nodeEnv,
      sqlitePath: databasePath,
      workbench: {
        mode: 'test-principal',
        testPrincipals: principals,
        trustedOrigins: [TEST_ORIGIN],
        catalogOverride: [...moduleCatalog, ...entries, ...extraCatalogEntries],
        extraImplementations: implementations,
        logDir: workbenchOverrides.logDir ?? path.join(rootDir, 'logs'),
        ...workbenchOverrides
      }
    },
    ...appOptions
  });

  await app.workbench.initialize();

  return {
    ...app,
    rootDir,
    ownsRootDir: providedRootDir === null,
    sqlitePath: databasePath,
    cleanup() {
      app.dataStore.close();
      if (providedRootDir === null) fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

export function cookieFor(context, accountKey) {
  return context.workbench.identity.testPrincipalCookie(accountKey).header.split(';')[0];
}

export function workbenchRequestHeaders(context, accountKey = ACCOUNT_A, extra = {}) {
  const headers = {
    Origin: TEST_ORIGIN,
    [workbenchHeaders.browserProtection]: workbenchHeaders.browserProtectionValue,
    Cookie: cookieFor(context, accountKey),
    ...extra
  };
  // An explicitly undefined entry means "send this header absent"; supertest
  // would otherwise serialize it as the string "undefined".
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
}
