import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: ['business-mvp.spec.js'], workers: 1, timeout: 120000, expect: {timeout:15000}, outputDir:'../../../test-results/business-mvp', reporter:[['list']], use:{ignoreHTTPSErrors:true,viewport:{width:1440,height:900},trace:'retain-on-failure'}});
