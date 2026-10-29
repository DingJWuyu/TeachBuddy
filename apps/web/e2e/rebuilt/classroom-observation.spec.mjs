import { test, expect, register, navigate } from './fixture.mjs';
import { roster, assessment } from '../../../api/test/rebuilt/classroom-fixture.js';
import { classes, ok, write } from '../../../api/test/rebuilt/helpers.js';

async function prepare(page, world) {
  await register(page, world);
  const request = page.waitForRequest(r => r.url().endsWith(`${classes}/classes`));
  await navigate(page, '/classroom');
  const client = world.client();
  client.pageId = (await request).headers()['x-teachbuddy-page'];
  for (const cookie of await page.context().cookies()) client.jar.set(cookie.name, cookie.value);
  const { c, students } = await roster(client);
  const data = await assessment(client, c, students);
  const result = ok(await write(client, 'POST', `${classes}/imports/${data.mapped.id}/confirmation`, { baseVersion: data.mapped.version })).result;
  await page.reload();
  await expect(page.getByRole('heading', { name: c.name, exact: true })).toBeVisible();
  async function reimport(total) {
    const draft = ok(await write(client, 'POST', `${classes}/imports`, { examId: data.exam.id, classId: c.id, sourceFileId: data.file.id }), 201);
    const mapped = ok(await write(client, 'PUT', `${classes}/imports/${draft.id}`, { baseVersion: draft.version, mapping: data.mapping, rows: null }));
    const rows = mapped.rows.map((row, i) => ({ sourceRow: row.sourceRow, studentId: row.studentId, status: row.status,
      totalScore: i === 0 ? total : row.totalScore, scores: i === 0 ? { [data.q]: total } : row.scores, ignored: row.ignored }));
    const reviewed = ok(await write(client, 'PUT', `${classes}/imports/${draft.id}`, { baseVersion: mapped.version, mapping: data.mapping, rows }));
    return ok(await write(client, 'POST', `${classes}/imports/${draft.id}/confirmation`, { baseVersion: reviewed.version })).result;
  }
  return { c, students, result, reimport };
}

test('班级统计响应期间重新导入，分布钻取与排名保持同一版本，刷新读新版', async ({ page, world }, info) => {
  const { c, reimport } = await prepare(page, world);
  let observed;
  await page.route(`**${classes}/classes/${c.id}/statistics*`, async route => {
    const response = await route.fetch();
    observed = await response.json();
    const updated = await reimport(10);
    expect(updated.version).toBe(observed.points[0].resultVersion + 1);
    await route.fulfill({ response });
  }, { times: 1 });
  await page.getByRole('tab', { name: '成绩', exact: true }).click();
  await page.locator('.cr-hist-bar').nth(9).click();
  const chip = page.locator('.cr-chip-student').filter({ hasText: '甲' });
  await expect(chip.locator('b'), '旧版高分档中的甲必须仍是100分').toHaveText('100');
  const row = page.locator('.cr-ranking li').filter({ hasText: '甲' });
  await expect(row.locator('.cr-ranking-score b')).toHaveText('100');
  await expect(row.locator('.cr-rank')).toHaveText('1');
  await page.locator('.cr-bin-students').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('class-observation-old.png'), animations: 'disabled' });
  expect(observed.dataVersions.results).toEqual([{ id: observed.points[0].resultId, version: observed.points[0].resultVersion }]);
  await info.attach('old-observation', { body: JSON.stringify(observed), contentType: 'application/json' });
  await page.reload();
  await expect(row.locator('.cr-ranking-score b')).toHaveText('10');
  await expect(row.locator('.cr-rank')).toHaveText('2');
  await page.locator('.cr-hist-bar').nth(1).click();
  await expect(chip.locator('b')).toHaveText('10');
  await page.locator('.cr-bin-students').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('class-observation-new.png'), animations: 'disabled' });
});

test('学生统计响应期间重新导入，本人分数与各题班级参照保持同一版本', async ({ page, world }, info) => {
  const { students, reimport } = await prepare(page, world);
  await page.getByRole('tab', { name: '学生', exact: true }).click();
  await page.locator('.cr-card').filter({ hasText: '甲' }).click();
  let observed;
  await page.route(`**${classes}/students/${students[0].id}/statistics*`, async route => {
    const response = await route.fetch();
    observed = await response.json();
    await reimport(10);
    await route.fulfill({ response });
  }, { times: 1 });
  await page.getByRole('tab', { name: '成绩', exact: true }).click();
  await expect(page.locator('.cr-exam-row-score b')).toHaveText('100');
  await expect(page.locator('.cr-rate-mark'), '旧版本班级题目得分率应为57.5%').toHaveAttribute('style', /0\.575/);
  await page.locator('.cr-rate-mark').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('student-observation-old.png'), animations: 'disabled' });
  expect(observed.dataVersions.results).toEqual([{ id: observed.points[0].resultId, version: observed.points[0].resultVersion }]);
  await info.attach('student-observation', { body: JSON.stringify(observed), contentType: 'application/json' });
  await page.reload();
  await page.getByRole('tab', { name: '成绩', exact: true }).click();
  await expect(page.locator('.cr-exam-row-score b')).toHaveText('10');
  await expect(page.locator('.cr-rate-mark')).toHaveAttribute('style', /0\.35/);
});
