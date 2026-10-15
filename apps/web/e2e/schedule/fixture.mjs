import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { createIntegration } from '../../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from '../../../api/test/fixtures/math-real.mjs';

// The caller owns the mutable clock so browser and API advance together.
export async function createScheduleWorld(clock, email = 'schedule@example.test') {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Use an isolated production build.');
  const world = await createIntegration({
    directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-e2e-')),
    workbenchClock: clock,
  });
  try {
    const { client } = await registerMath(world, email);
    return { world, client };
  } catch (error) {
    await world.close();
    throw error;
  }
}

export async function loginSchedule(page, world, email = 'schedule@example.test') {
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
}

export async function closeScheduleWorld(context, world, errors, info) {
  const failed = info.status !== info.expectedStatus || errors.length > 0;
  try {
    if (failed && world) {
      fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify({
        test: info.title, directory: world.directory, origin: world.origin, pageErrors: errors,
      }, null, 2));
      const page = context.pages()[0];
      if (page && !page.isClosed()) {
        await page.screenshot({ path: info.outputPath('preserved-scene.png'), animations: 'disabled' }).catch(() => {});
        const scene = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))).catch(error => ({ error: error.message }));
        fs.writeFileSync(info.outputPath('local-scene.json'), JSON.stringify(scene, null, 2));
      }
    }
  } finally {
    try {
      await context.close();
    } finally {
      await world?.close();
      if (!failed && world) fs.rmSync(world.directory, { recursive: true, force: true });
    }
  }
  expect(errors).toEqual([]);
}
