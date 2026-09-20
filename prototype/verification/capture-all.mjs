// Run the current auth scenario matrix. Each case starts in a fresh browser context.
// PROTOTYPE_URL selects the runtime; PROTOTYPE_EVIDENCE_DIR is the screenshot root.
// PROTOTYPE_RESULTS_DIR is the result directory. Output is published only after all cases pass.
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { scenarios, viewports } from './auth-scenarios.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?no-dev-chrome';
const out = path.resolve(process.env.PROTOTYPE_EVIDENCE_DIR || path.join(here, '../evidence/screenshots'));
const resultsDir = path.resolve(process.env.PROTOTYPE_RESULTS_DIR || path.join(here, '../evidence/verification'));
const stagingParent = path.resolve(process.env.PROTOTYPE_TEMP_DIR || tmpdir());
await fs.mkdir(stagingParent, { recursive: true });
const staging = await fs.mkdtemp(path.join(stagingParent, 'capture-'));
const browser = await chromium.launch();
const results = [];
const failures = [];

try {
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      const row = { id: scenario.id, journey: scenario.journey, description: scenario.description,
        viewport: viewport.name, width: viewport.width, height: viewport.height, screenshots: [], status: 'passed' };
      try {
        await page.goto(base, { waitUntil: 'networkidle' });
        await expect(page.locator('.ae-card h1')).toHaveText('登录');
        await page.evaluate(() => document.fonts.ready);
        await scenario.run(page, async (state) => {
          await page.waitForTimeout(220);
          const metrics = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            entry: !!document.querySelector('.ae-card'),
            scroll: document.documentElement.scrollHeight > innerHeight + 1
          }));
          expect(metrics.overflow, 'horizontal overflow').toBe(false);
          expect(metrics.entry && metrics.scroll, 'auth card vertical overflow').toBe(false);
          const file = `${scenario.journey}/${viewport.name}-${scenario.id}-${state}.png`;
          await fs.mkdir(path.dirname(path.join(staging, file)), { recursive: true });
          await page.screenshot({ path: path.join(staging, file), animations: 'disabled' });
          row.screenshots.push(file);
        });
        expect(errors, 'browser errors').toEqual([]);
        expect(row.screenshots.length, 'scenario evidence').toBeGreaterThan(0);
        console.log(`PASS ${viewport.name} ${scenario.id} ${scenario.description}`);
      } catch (error) {
        row.status = 'failed';
        row.error = error.message;
        failures.push(`${viewport.name} ${scenario.id}: ${error.message}`);
        console.log(`FAIL ${viewport.name} ${scenario.id}: ${error.message.split('\n')[0]}`);
      } finally {
        results.push(row);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const report = { suite: 'auth-scenarios', scenarios: scenarios.length, results };
if (failures.length) {
  await fs.writeFile(path.join(staging, 'failures.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(failures.join('\n'));
  console.error(`Unpublished evidence retained at ${staging}`);
  process.exitCode = 1;
} else {
  for (const row of results) {
    for (const file of row.screenshots) {
      await fs.mkdir(path.dirname(path.join(out, file)), { recursive: true });
      await fs.copyFile(path.join(staging, file), path.join(out, file));
      await fs.unlink(path.join(staging, file));
    }
  }
  // Retire only files owned by this suite; unrelated evidence is left alone.
  const keep = new Set(results.flatMap((row) => row.screenshots));
  for (const journey of new Set(scenarios.map((scenario) => scenario.journey))) {
    for (const file of await fs.readdir(path.join(out, journey))) {
      if (/^(PC|平板|手机)-CA\d+-[a-z-]+\.png$/.test(file) && !keep.has(`${journey}/${file}`)) {
        await fs.unlink(path.join(out, journey, file));
      }
    }
    await fs.rmdir(path.join(staging, journey));
  }
  await fs.rmdir(staging);
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.writeFile(path.join(resultsDir, 'auth.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${results.length}/${results.length} scenarios passed; ${keep.size} current screenshots.`);
}
