/*
 * Builds the account-contract harness (the feature module mounted with a
 * workbench-like shell) as a production Vite bundle. The build output lives in
 * the OS temp directory: it is a test artifact, never a repository file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const HARNESS_ROOT = path.join(HERE, 'harness');
export const BUILD_DIR = path.join(os.tmpdir(), 'auth-contract-harness-dist');

export function harnessBuilt() {
  return fs.existsSync(path.join(BUILD_DIR, 'index.html'));
}

export async function buildHarness({ force = false } = {}) {
  if (!force && harnessBuilt()) return BUILD_DIR;
  const { build } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  await build({
    root: HARNESS_ROOT,
    configFile: false,
    plugins: [react()],
    base: '/',
    build: {
      outDir: BUILD_DIR,
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
    },
    logLevel: 'info',
  });
  return BUILD_DIR;
}

if (process.argv[1] && process.argv[1].endsWith('harness-build.mjs')) {
  const dir = await buildHarness({ force: process.argv.includes('--force') });
  process.stdout.write(`harness build: ${dir}\n`);
}
