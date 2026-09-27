import { defineConfig } from '@playwright/test';
import questions from './questions-ux.config.mjs';

export default defineConfig({
  ...questions,
  testMatch: ['questions-recognition.spec.js', 'questions-tables.spec.js'],
  outputDir: `../../../test-results/questions-recognition/${Date.now()}`,
});
