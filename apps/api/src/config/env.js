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
  const demoPassword = overrides.demoPassword ?? process.env.DEMO_PASSWORD ?? 'refatos123';
  const corsOriginsInput = overrides.corsOrigins ?? process.env.CORS_ORIGINS ?? '';
  const sqlitePathInput = overrides.sqlitePath ?? process.env.SQLITE_PATH ?? process.env.DATABASE_URL ?? path.join(dataDir, 'refatos.sqlite');
  const sqlitePath = path.isAbsolute(sqlitePathInput) ? sqlitePathInput : path.resolve(process.cwd(), sqlitePathInput);
  const uploadDirInput = overrides.uploadDir ?? process.env.UPLOAD_DIR ?? path.resolve(apiRootDir, 'uploads');
  const exportDirInput = overrides.exportDir ?? process.env.EXPORT_DIR ?? path.resolve(apiRootDir, 'exports');
  const legacyDataFileInput = overrides.legacyDataFile ?? process.env.LEGACY_STORE_PATH ?? path.join(dataDir, 'store.json');

  return {
    appName: overrides.appName ?? 'RefatOS API',
    nodeEnv,
    port,
    authSecret,
    demoPassword,
    corsOrigins: Array.isArray(corsOriginsInput)
      ? corsOriginsInput.filter(Boolean)
      : String(corsOriginsInput)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    sqlitePath,
    uploadDir: path.isAbsolute(uploadDirInput) ? uploadDirInput : path.resolve(process.cwd(), uploadDirInput),
    exportDir: path.isAbsolute(exportDirInput) ? exportDirInput : path.resolve(process.cwd(), exportDirInput),
    legacyDataFile: path.isAbsolute(legacyDataFileInput) ? legacyDataFileInput : path.resolve(process.cwd(), legacyDataFileInput)
  };
}

export const env = createEnv();
