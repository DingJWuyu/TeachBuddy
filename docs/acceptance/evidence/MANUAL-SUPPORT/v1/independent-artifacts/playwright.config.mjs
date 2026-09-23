import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'*.spec.mjs',workers:1,timeout:90000,expect:{timeout:10000},reporter:'list',outputDir:'../../../../../../.tmp-ms/independent-results',use:{launchOptions:{executablePath:'/opt/google/chrome/chrome'},ignoreHTTPSErrors:true,viewport:{width:1440,height:900},trace:'retain-on-failure'}});
