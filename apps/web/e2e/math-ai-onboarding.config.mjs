import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.', testMatch: 'math-ai-onboarding.spec.js', workers: 1, timeout: 120000,
  expect: { timeout: 12000 },
  outputDir: '../../../test-results/math-ai-onboarding/verification/results',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../../test-results/math-ai-onboarding/verification/playwright.json', import.meta.url)) }]],
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, actionTimeout: 10000 },
  projects: [
    { name: 'chrome', use: { launchOptions: { executablePath: process.env.MATH_AI_CHROME_PATH ?? '/usr/bin/google-chrome-stable' } } },
    { name: 'edge', use: { launchOptions: { executablePath: process.env.MATH_AI_EDGE_PATH ?? '/usr/bin/microsoft-edge-stable' } } },
    { name: 'unsupported-chromium', use: { channel: 'chromium' } },
  ],
});
