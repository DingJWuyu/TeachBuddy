import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRootDir = path.resolve(__dirname, '..');
const dataDir = path.resolve(apiRootDir, 'data');

export function createEnv(overrides = {}) {
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const port = Number(overrides.port ?? process.env.PORT ?? 4000);
  const authSecret = overrides.authSecret ?? process.env.AUTH_SECRET ?? 'refatos-dev-secret';
  const smtpHost = overrides.smtpHost ?? process.env.SMTP_HOST ?? '';
  const smtpPort = Number(overrides.smtpPort ?? process.env.SMTP_PORT ?? 587);
  const smtpUser = overrides.smtpUser ?? process.env.SMTP_USER ?? '';
  const smtpPassword = overrides.smtpPassword ?? process.env.SMTP_PASSWORD ?? '';
  const smtpFrom = overrides.smtpFrom ?? process.env.SMTP_FROM ?? smtpUser;
  const smtpSecureInput = overrides.smtpSecure ?? process.env.SMTP_SECURE ?? false;
  const corsOriginsInput = overrides.corsOrigins ?? process.env.CORS_ORIGINS ?? '';
  const sqlitePathInput = overrides.sqlitePath ?? process.env.SQLITE_PATH ?? process.env.DATABASE_URL ?? path.join(dataDir, 'refatos.sqlite');
  const sqlitePath = path.isAbsolute(sqlitePathInput) ? sqlitePathInput : path.resolve(process.cwd(), sqlitePathInput);
  const uploadDirInput = overrides.uploadDir ?? process.env.UPLOAD_DIR ?? path.resolve(apiRootDir, 'uploads');
  const exportDirInput = overrides.exportDir ?? process.env.EXPORT_DIR ?? path.resolve(apiRootDir, 'exports');

  return {
    appName: overrides.appName ?? 'RefatOS API',
    nodeEnv,
    port,
    authSecret,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
    smtpSecure: smtpSecureInput === true || smtpSecureInput === 'true' || smtpSecureInput === '1',
    corsOrigins: Array.isArray(corsOriginsInput)
      ? corsOriginsInput.filter(Boolean)
      : String(corsOriginsInput)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    sqlitePath,
    uploadDir: path.isAbsolute(uploadDirInput) ? uploadDirInput : path.resolve(process.cwd(), uploadDirInput),
    exportDir: path.isAbsolute(exportDirInput) ? exportDirInput : path.resolve(process.cwd(), exportDirInput)
  };
}

export const env = createEnv();
