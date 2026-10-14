import { defineConfig } from '@playwright/test';
import auth from './auth-integration.config.mjs';
import authCompleteness from './auth-completeness.config.mjs';
import math from './math-unified.config.mjs';
import protection from './math-unified-repair.config.mjs';
import calendar from './calendar-capabilities.config.mjs';
import development from './development.config.mjs';
import retirement from './module-retirement.config.mjs';
import catalog from './catalog-navigation.config.mjs';
import resources from './resources-ui.config.mjs';
import questions from './questions-ux.config.mjs';
import recognition from './questions-recognition.config.mjs';

// Reuse each suite's viewport, timezone, assertions and evidence location.
export default defineConfig({
  testDir: '.', workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI), reporter: 'list',
  projects: Object.entries({ auth, authCompleteness, math, protection, calendar, development, retirement, catalog,
    resources: { ...resources, grepInvert: /真实 OCR 运行链/ },
    questions, recognition: { ...recognition, testMatch: 'questions-recognition.spec.js' },
  }).map(
    ([name, { testMatch, timeout, expect, use, outputDir, grepInvert }]) =>
      ({ name, testMatch, timeout, expect, use, outputDir, grepInvert }),
  ),
});
