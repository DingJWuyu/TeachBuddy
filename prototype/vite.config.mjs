import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@workspace-styles': resolve(process.cwd(), 'apps/web/src/styles/global.css')
    }
  },
  server: {
    fs: { allow: [process.cwd()] }
  }
});
