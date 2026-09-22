/**
 * Production build for the T52 schedule harness entry.
 *
 * The production `apps/web/vite.config.js` is owned by the integration writer
 * and only builds the shell entry; this isolated config builds the schedule
 * fixture page through the same pipeline (including CSS processing) so the
 * browser suite runs against a real build of the current candidate.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '..', '..');

export default defineConfig({
  root: webRoot,
  base: '/',
  plugins: [react()],
  build: {
    outDir: path.resolve(repoRoot, 'test-results', 't52-schedule-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(webRoot, 'e2e', 'teaching-time-schedule.html')
    }
  }
});
