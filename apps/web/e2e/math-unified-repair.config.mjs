import { defineConfig } from '@playwright/test';
import config from './math-unified.config.mjs';
export default defineConfig({ ...config, testMatch:'math-unified-repair.spec.js', outputDir:'../../../test-results/math-unified/ui/repair/results' });
