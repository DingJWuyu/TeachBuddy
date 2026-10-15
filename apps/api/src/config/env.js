import path from 'node:path';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRootDir = path.resolve(__dirname, '..');
const apiRootDir = path.resolve(srcRootDir, '..');
const repoRootDir = path.resolve(apiRootDir, '..', '..');
const dataDir = path.resolve(srcRootDir, 'data');

function defaultDatabasePath() {
  // Keep existing installations on their database; a brand rename must not create an empty workspace.
  const legacyPath = path.join(dataDir, 'refatos.sqlite');
  return statSync(legacyPath, { throwIfNoEntry: false }) ? legacyPath : path.join(dataDir, 'teachbuddy.sqlite');
}

function listValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Workbench runtime configuration.
 *
 * `mode` is the identity seam: `none` means no real adapter is configured yet,
 * so every business entry resolves to 401; `test-principal` is the isolated
 * test runner mode and is refused when NODE_ENV is production. A catalog
 * override and extra static implementations exist for the isolated runner and its
 * fixtures only; production refuses them too.
 */
export function createWorkbenchEnv(overrides = {}) {
  const source = overrides.workbench ?? {};
  const publicOrigin = source.publicOrigin ?? process.env.WORKBENCH_PUBLIC_ORIGIN ?? '';
  const trustedOriginsInput = source.trustedOrigins
    ?? (publicOrigin ? [publicOrigin] : listValue(process.env.WORKBENCH_TRUSTED_ORIGINS));
  const tls = source.tls
    ?? (process.env.WORKBENCH_TLS_CERT && process.env.WORKBENCH_TLS_KEY
      ? { cert: process.env.WORKBENCH_TLS_CERT, key: process.env.WORKBENCH_TLS_KEY }
      : null);

  return {
    mode: source.mode ?? process.env.WORKBENCH_IDENTITY_MODE ?? 'none',
    testPrincipals: listValue(source.testPrincipals ?? process.env.WORKBENCH_TEST_PRINCIPALS),
    sessionSecret: source.sessionSecret ?? process.env.WORKBENCH_TEST_SESSION_SECRET ?? 'teachbuddy-test-session-secret',
    publicOrigin,
    trustedOrigins: listValue(trustedOriginsInput),
    tls,
    webDist: source.webDist ?? process.env.WORKBENCH_WEB_DIST ?? null,
    logDir: source.logDir ?? process.env.WORKBENCH_LOG_DIR ?? null,
    filesDir: source.filesDir ?? process.env.WORKBENCH_FILES_DIR ?? null,
    jobHandlers: source.jobHandlers ?? null,
    conversion: source.conversion ?? {},
    recognition: { home: process.env.MATERIALS_OCR_HOME ?? null, ...source.recognition },
    extraImplementations: source.extraImplementations ?? null,
    catalogOverride: source.catalogOverride ?? null,
    resolvePrincipal: source.resolvePrincipal ?? null
  };
}

export function createEnv(overrides = {}) {
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const port = Number(overrides.port ?? process.env.PORT ?? 4000);
  const smtpHost = overrides.smtpHost ?? process.env.SMTP_HOST ?? '';
  const smtpPort = Number(overrides.smtpPort ?? process.env.SMTP_PORT ?? 587);
  const smtpUser = overrides.smtpUser ?? process.env.SMTP_USER ?? '';
  const smtpPassword = overrides.smtpPassword ?? process.env.SMTP_PASSWORD ?? '';
  const smtpFrom = overrides.smtpFrom ?? process.env.SMTP_FROM ?? smtpUser;
  const smtpSecureInput = overrides.smtpSecure ?? process.env.SMTP_SECURE ?? false;
  const sqlitePathInput = overrides.sqlitePath ?? process.env.SQLITE_PATH ?? process.env.DATABASE_URL ?? defaultDatabasePath();
  const sqlitePath = path.isAbsolute(sqlitePathInput) ? sqlitePathInput : path.resolve(process.cwd(), sqlitePathInput);

  return {
    agent: overrides.agent ?? { apiKey: process.env.COMMANDCODE_API_KEY ?? '', baseUrl: process.env.COMMANDCODE_BASE_URL ?? 'https://api.commandcode.ai/provider/v1' },
    appName: overrides.appName ?? 'TeachBuddy API',
    nodeEnv,
    port,
    authCodeSecret: overrides.authCodeSecret ?? process.env.AUTH_CODE_SECRET ?? '',
    registrationOpen: ![false, 'false', '0'].includes(overrides.registrationOpen ?? process.env.AUTH_REGISTRATION_OPEN ?? true),
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
    smtpSecure: smtpSecureInput === true || smtpSecureInput === 'true' || smtpSecureInput === '1',
    sqlitePath,
    workbench: createWorkbenchEnv(overrides)
  };
}

export const env = createEnv();
