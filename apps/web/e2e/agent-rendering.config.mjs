import { defineConfig } from '@playwright/test';
import auth from './auth-integration.config.mjs';

export default defineConfig({
  ...auth,
  testMatch: 'agent-rendering.spec.js',
  outputDir: '../../../test-results/agent-rendering',
});
