import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * T51 browser fixture build: the real classes feature page mounted by a minimal
 * test shell. Output goes to the isolated runner directory, never to the
 * product `apps/web/dist`.
 */
export default defineConfig({
  root: here,
  plugins: [react()],
  build: {
    outDir: process.env.T51_WEB_DIST || path.join(here, 'dist'),
    emptyOutDir: true
  }
});
