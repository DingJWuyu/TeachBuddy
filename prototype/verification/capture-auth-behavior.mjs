/*
 * Captures the evidence for the added account-entry scenarios.
 *
 * Every scenario runs on each supported viewport in a fresh browser context.
 * Scenarios that are about a second device or another tab open their own extra
 * contexts through the factory passed to them. Output is staged first and only
 * published to the evidence directories when every case passes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { scenarios, deferredScenarios, viewports } from './auth-behavior-scenarios.mjs';
import { evidencePaths } from './evidence-paths.mjs';

const base = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const only = (process.env.SCENARIO_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
const selected = only.length ? scenarios.filter((entry) => only.includes(entry.id)) : scenarios;
const wantedViewports = (process.env.VIEWPORT_NAMES || '').split(',').map((name) => name.trim()).filter(Boolean);
const viewportSet = wantedViewports.length ? viewports.filter((entry) => wantedViewports.includes(entry.name)) : viewports;
if (only.some((id) => !scenarios.some((entry) => entry.id === id))) {
  throw new Error('Unknown or deferred scenario ID; see deferredScenarios.');
}
if (wantedViewports.some((name) => !viewports.some((entry) => entry.name === name))) {
  throw new Error('Unknown viewport name.');
}
const partial = selected.length !== scenarios.length || viewportSet.length !== viewports.length;
const resultName = partial ? 'auth-behavior-partial' : 'auth-behavior';

const { screenshots: out, results: resultsDir } = evidencePaths('auth-behavior');
const stagingParent = path.resolve(process.env.PROTOTYPE_TEMP_DIR || tmpdir());
await fs.mkdir(stagingParent, { recursive: true });
const staging = await fs.mkdtemp(path.join(stagingParent, 'capture-'));
const browser = await chromium.launch();
const rows = [];
const failures = [];

for (const viewport of viewportSet) {
  for (const scenario of selected) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

    const row = {
      id: scenario.id,
      journey: scenario.journey,
      description: scenario.description,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      screenshots: [],
      status: 'passed'
    };

    /* Extra contexts for the branches that need a second device or tab. */
    const newContext = async () => {
      const extra = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const originalNewPage = extra.newPage.bind(extra);
      extra.newPage = async (...args) => {
        const extraPage = await originalNewPage(...args);
        extraPage.on('pageerror', (error) => errors.push(`other context: ${error.message}`));
        extraPage.on('console', (message) => { if (message.type() === 'error') errors.push(`other context: ${message.text()}`); });
        return extraPage;
      };
      return extra;
    };

    try {
      await scenario.run(page, async (state, targetPage = page) => {
        await targetPage.waitForTimeout(220);
        const metrics = await targetPage.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          entry: !!document.querySelector('.ae-card'),
          scroll: document.documentElement.scrollHeight > innerHeight + 1
        }));
        expect(metrics.overflow, 'horizontal overflow').toBe(false);
        /* The entry card never scrolls; the workbench below it may, so the
         * fit rule only applies while the card owns the screen. */
        if (metrics.entry) expect(metrics.scroll, 'card fits the viewport').toBe(false);
        const file = `${scenario.journey}/${viewport.name}-${scenario.id}-${state}.png`;
        await fs.mkdir(path.dirname(path.join(staging, file)), { recursive: true });
        await expect(targetPage.locator('[aria-label="开发环境故障注入"], [aria-label="开发环境界面切换"]')).toHaveCount(0);
        await targetPage.screenshot({ path: path.join(staging, file), animations: 'disabled' });
        row.screenshots.push(file);
      }, { url: base, newContext });

      expect(errors, 'browser errors').toEqual([]);
      expect(row.screenshots.length, 'scenario evidence').toBeGreaterThan(0);
      console.log(`PASS ${viewport.name} ${scenario.id} ${scenario.description}`);
    } catch (error) {
      row.status = 'failed';
      row.error = error.message;
      failures.push(`${viewport.name} ${scenario.id}: ${error.message.split('\n')[0]} @ ${(error.stack || '').split('\n').slice(1, 3).join(' <- ')}`);
      console.log(`FAIL ${viewport.name} ${scenario.id}: ${error.message.split('\n')[0]}`);
    } finally {
      rows.push(row);
      await context.close();
      for (const extra of browser.contexts()) {
        if (extra !== context) await extra.close().catch(() => {});
      }
    }
  }
}

await browser.close();

const report = { suite: 'auth-behavior-scenarios', scenarios: selected.length, viewports: viewportSet.length, partial, deferred: deferredScenarios, results: rows };
if (failures.length) {
  await fs.writeFile(path.join(staging, 'failures.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(failures.join('\n'));
  console.error(`Unpublished evidence retained at ${staging}`);
  process.exitCode = 1;
} else {
  for (const row of rows) {
    for (const file of row.screenshots) {
      await fs.mkdir(path.dirname(path.join(out, file)), { recursive: true });
      await fs.copyFile(path.join(staging, file), path.join(out, file));
      await fs.unlink(path.join(staging, file));
    }
  }
  const keep = new Set(rows.flatMap((row) => row.screenshots));
  const owned = new Set(selected.map((scenario) => scenario.id));
  for (const journey of new Set(selected.map((scenario) => scenario.journey))) {
    const dir = path.join(out, journey);
    await fs.mkdir(dir, { recursive: true });
    for (const file of await fs.readdir(dir)) {
      /* Retire only this suite's own screenshots: evidence that belongs to
       * another scenario set in the same journey is left alone. */
      const match = /^(PC|平板|手机)-(CA\d+)-[a-z-]+\.png$/.exec(file);
      if (match && viewportSet.some((viewport) => viewport.name === match[1]) && owned.has(match[2]) && !keep.has(`${journey}/${file}`)) {
        await fs.unlink(path.join(dir, file));
      }
    }
    await fs.rmdir(path.join(staging, journey)).catch(() => {});
  }
  await fs.writeFile(path.join(resultsDir, `${resultName}.json`), JSON.stringify(report, null, 2) + '\n');
  const lines = ['suite: auth-behavior-scenarios', `url: ${base}`, `scenarios: ${selected.length}`, `viewports: ${viewportSet.length}`, ''];
  for (const row of deferredScenarios) lines.push(`DEFERRED ${row.id} ${row.reason}`);
  for (const row of rows) {
    lines.push(`${row.status.toUpperCase()} ${row.viewport} ${row.id} ${row.description}`);
    for (const file of row.screenshots) lines.push(`  ${file}`);
  }
  await fs.writeFile(path.join(resultsDir, `${resultName}.txt`), lines.join('\n') + '\n');
  await fs.rm(staging, { recursive: true, force: true });
  console.log(`\n${rows.length} case(s) passed across ${viewportSet.length} viewports`);
  console.log(`screenshots: ${out}`);
  console.log(`results: ${resultsDir}`);
}
