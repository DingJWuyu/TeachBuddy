import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'../..',testMatch:'math-integration*.spec.js',workers:1,timeout:120000,expect:{timeout:15000},outputDir:'../../../../../test-results/m43/browser',use:{ignoreHTTPSErrors:true,viewport:{width:1440,height:900},trace:'retain-on-failure'}});
