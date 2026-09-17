import { expect, test } from '@playwright/test';
import {
  accountFor,
  itemCard,
  loginTeacher,
  moduleButton,
  registerTeacher,
  uploadResource
} from './helpers.js';

const API_BASE = 'http://127.0.0.1:4100/api';

async function apiCall(page, path, { method = 'GET', body } = {}) {
  return page.evaluate(async ({ apiBase, requestPath, requestMethod, requestBody }) => {
    const token = window.localStorage.getItem('refatos-token') || '';
    const response = await fetch(`${apiBase}${requestPath}`, {
      method: requestMethod,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestBody === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody)
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: isJson ? await response.json() : await response.text()
    };
  }, {
    apiBase: API_BASE,
    requestPath: path,
    requestMethod: method,
    requestBody: body
  });
}

test.describe('教师个人工作台最终验收旅程', () => {
  test.setTimeout(60_000);

  test('教师可以通过界面完成五个模块的 CRUD、自动化、模板和导出', async ({ page }, testInfo) => {
    await registerTeacher(page, accountFor('workspace-acceptance', testInfo, 'workspace acceptance password'));

    await moduleButton(page, '资源库').click();
    await uploadResource(page, {
      title: '单摆实验讲义',
      tags: 'science, pendulum',
      moduleLinks: 'lesson-planner, worksheet-designer',
      fileName: 'pendulum-notes.txt',
      contents: 'Pendulum notes for the acceptance journey.'
    });

    const resourceResponse = await apiCall(page, '/modules/resource-vault');
    expect(resourceResponse.status).toBe(200);
    const resource = resourceResponse.body.items[0];
    expect(resource.originalName).toBe('pendulum-notes.txt');

    const resourceCard = itemCard(page, '单摆实验讲义');
    await resourceCard.getByRole('button', { name: '编辑' }).click();
    await page.getByLabel('标题').fill('单摆实验讲义（更新）');
    await page.getByRole('button', { name: '保存资源信息' }).click();
    await expect(page.getByText('单摆实验讲义（更新）', { exact: true })).toBeVisible();

    const fileResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith(`/modules/resource-vault/${resource.id}/file`) && response.status() === 200
    ));
    await itemCard(page, '单摆实验讲义（更新）').getByRole('button', { name: '打开文件' }).click();
    const fileResponse = await fileResponsePromise;
    expect(fileResponse.headers()['content-type']).toContain('text/plain');

    await moduleButton(page, '排课管理').click();
    await page.getByLabel('科目').fill('物理');
    await page.getByLabel('班级').fill('九年级 A 班');
    await page.getByLabel('教室').fill('实验室 1');
    await page.getByLabel('备注').fill('准备摆长测量器材');
    await page.getByRole('button', { name: '保存时段' }).click();
    await expect(page.getByText('物理', { exact: true }).last()).toBeVisible();

    const scheduleCard = itemCard(page, '物理');
    await scheduleCard.getByRole('button', { name: '编辑' }).click();
    await page.getByLabel('科目').fill('物理实验');
    await page.getByRole('button', { name: '更新时段' }).click();
    await expect(itemCard(page, '物理实验')).toBeVisible();

    await moduleButton(page, '提醒中心').click();
    await page.getByLabel('标题').fill('周期备课提醒');
    await page.getByLabel('重复').selectOption('daily');
    await page.getByLabel('间隔').fill('1');
    await page.getByRole('button', { name: '保存提醒' }).click();
    await expect(page.getByText('周期备课提醒', { exact: true })).toBeVisible();

    let reminderCard = itemCard(page, '周期备课提醒');
    await reminderCard.getByRole('button', { name: '编辑' }).click();
    await page.getByLabel('标题').fill('周期备课提醒（更新）');
    await page.getByRole('button', { name: '更新提醒' }).click();
    await expect(page.getByText('周期备课提醒（更新）', { exact: true })).toBeVisible();

    reminderCard = itemCard(page, '周期备课提醒（更新）');
    await reminderCard.getByRole('button', { name: '完成' }).click();
    await expect(page.getByText('周期备课提醒（更新）', { exact: true })).toHaveCount(2);
    expect((await apiCall(page, '/modules/reminder-center')).body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '周期备课提醒（更新）', status: 'done' }),
        expect.objectContaining({ title: '周期备课提醒（更新）', status: 'pending', recurrence: 'daily' })
      ])
    );

    await moduleButton(page, '备课规划').click();
    await page.getByLabel('主题').fill('单摆振动');
    await page.getByLabel('班级').fill('九年级 A 班');
    await page.getByLabel('教学目标').fill('解释单摆周期与摆长的关系。');
    await page.getByLabel('时长').fill('40 分钟');
    await page.getByLabel('教学材料').fill('细绳、摆锤、秒表');
    await page.locator('label.picker-item').filter({ hasText: '单摆实验讲义（更新）' }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '保存课程计划' }).click();
    await expect(page.getByText('单摆振动', { exact: true })).toBeVisible();

    const lessonResponse = await apiCall(page, '/modules/lesson-planner');
    const lesson = lessonResponse.body.items[0];
    expect(lesson.resourceIds).toContain(resource.id);

    await moduleButton(page, '提醒中心').click();
    await expect(page.getByText('复习课程计划：单摆振动', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '设置' }).click();
    const lessonVisibility = page.getByRole('checkbox', { name: '备课规划', exact: true }).first();
    await lessonVisibility.uncheck();
    await expect(lessonVisibility).not.toBeChecked();
    await page.getByRole('button', { name: '工作台首页' }).click();
    await expect(moduleButton(page, '备课规划')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: '备课计划：0' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '规划课程', exact: true })).not.toBeVisible();

    const generatedResponse = await apiCall(page, `/modules/lesson-planner/${lesson.id}/generate-worksheet-draft`, {
      method: 'POST',
      body: {}
    });
    expect(generatedResponse.status).toBe(201);
    expect(generatedResponse.body.generatedFromLessonId).toBe(lesson.id);

    await page.reload();
    await expect(moduleButton(page, '备课规划')).not.toBeVisible();
    await moduleButton(page, '练习单设计').click();
    await expect(page.getByText('单摆振动 - 自动练习单', { exact: true })).toBeVisible();

    await page.getByLabel('标题').fill('电磁练习模板稿');
    await page.getByLabel('班级').fill('八年级 B 班');
    await page.getByLabel('主题').fill('电磁');
    await page.getByLabel('总分').fill('10');
    await page.getByLabel('题目数量').fill('2');
    await page.getByPlaceholder('模板名称').fill('电磁短卷模板');
    await page.getByRole('button', { name: '将当前表单保存为模板' }).click();
    await expect(page.getByText('电磁短卷模板', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '应用' }).click();
    await page.getByRole('button', { name: '保存练习单草稿' }).click();
    await expect(page.getByText('电磁练习模板稿', { exact: true })).toBeVisible();
    const templateCard = page.locator('.mini-card').filter({ hasText: '电磁短卷模板' });
    await templateCard.getByRole('button', { name: '删除' }).click();
    await expect(templateCard).not.toBeVisible();

    const worksheetCard = itemCard(page, '电磁练习模板稿');
    await worksheetCard.getByRole('button', { name: '编辑' }).click();
    await page.getByLabel('标题').fill('电磁练习模板稿（更新）');
    await page.getByRole('button', { name: '更新练习单草稿' }).click();
    await expect(page.getByText('电磁练习模板稿（更新）', { exact: true })).toBeVisible();

    const updatedWorksheet = (await apiCall(page, '/modules/worksheet-designer')).body.items
      .find((item) => item.title === '电磁练习模板稿（更新）');
    expect(updatedWorksheet).toBeTruthy();

    const specResponse = page.waitForResponse((response) => (
      response.url().endsWith(`/modules/worksheet-designer/${updatedWorksheet.id}/export/spec`) && response.status() === 200
    ));
    await itemCard(page, '电磁练习模板稿（更新）').getByRole('button', { name: '导出规格' }).click();
    await specResponse;
    await expect(page.getByRole('heading', { name: 'DOCX/PDF 导出规格' })).toBeVisible();

    for (const format of ['preview', 'docx', 'pdf']) {
      const exportResponse = page.waitForResponse((response) => (
        response.url().endsWith(`/modules/worksheet-designer/${updatedWorksheet.id}/export/${format}`) && response.status() === 200
      ));
      await itemCard(page, '电磁练习模板稿（更新）').getByRole('button', { name: format === 'preview' ? '预览' : format.toUpperCase() }).click();
      const response = await exportResponse;
      expect(response.headers()['content-type']).toBeTruthy();
    }

    await moduleButton(page, '资源库').click();
    await uploadResource(page, {
      title: '待删除资源',
      fileName: 'delete-me.txt',
      contents: 'temporary resource'
    });
    const temporaryResourceCard = itemCard(page, '待删除资源');
    await temporaryResourceCard.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('待删除资源', { exact: true })).not.toBeVisible();

    await moduleButton(page, '提醒中心').click();
    await page.getByLabel('标题').fill('待删除提醒');
    await page.getByRole('button', { name: '保存提醒' }).click();
    const temporaryReminderCard = itemCard(page, '待删除提醒');
    await temporaryReminderCard.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('待删除提醒', { exact: true })).not.toBeVisible();

    await moduleButton(page, '排课管理').click();
    await page.getByLabel('星期').selectOption('Monday');
    await page.getByLabel('科目').fill('待删除课程');
    await page.getByLabel('班级').fill('临时班');
    await page.getByRole('button', { name: '保存时段' }).click();
    const temporaryScheduleCard = itemCard(page, '待删除课程');
    await temporaryScheduleCard.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('待删除课程', { exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: '设置' }).click();
    await page.getByRole('checkbox', { name: '备课规划', exact: true }).first().check();
    await moduleButton(page, '备课规划').click();
    await page.getByLabel('主题').fill('待删除课程计划');
    await page.getByLabel('班级').fill('临时班');
    await page.getByLabel('教学目标').fill('完成删除回归。');
    await page.getByRole('button', { name: '保存课程计划' }).click();
    const temporaryLessonCard = itemCard(page, '待删除课程计划');
    await temporaryLessonCard.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('待删除课程计划', { exact: true })).not.toBeVisible();

    await moduleButton(page, '练习单设计').click();
    const temporaryWorksheetCard = itemCard(page, '电磁练习模板稿（更新）');
    await temporaryWorksheetCard.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('电磁练习模板稿（更新）', { exact: true })).not.toBeVisible();

    await moduleButton(page, '备课规划').click();
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByRole('checkbox', { name: '备课规划', exact: true }).first().check();
    await expect(page.getByRole('checkbox', { name: '备课规划', exact: true }).first()).toBeChecked();
  });

  test('两个教师的数据、文件和工作台布局互相隔离', async ({ page }, testInfo) => {
    const firstAccount = accountFor('workspace-boundary-a', testInfo, 'workspace boundary a password');
    const secondAccount = accountFor('workspace-boundary-b', testInfo, 'workspace boundary b password');
    await registerTeacher(page, { ...firstAccount, name: '边界教师 A' });

    await moduleButton(page, '资源库').click();
    await uploadResource(page, {
      title: '教师 A 的文件',
      fileName: 'teacher-a.txt',
      contents: 'teacher A private file'
    });
    const firstResource = (await apiCall(page, '/modules/resource-vault')).body.items[0];

    await moduleButton(page, '排课管理').click();
    await page.getByLabel('科目').fill('教师 A 课程');
    await page.getByLabel('班级').fill('A 班');
    await page.getByRole('button', { name: '保存时段' }).click();

    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('新分组名称').fill('教师 A 分组');
    await page.getByRole('button', { name: '创建分组' }).click();
    await page.getByLabel('提醒中心').first().uncheck();
    await expect(page.getByRole('region', { name: '模块分组：教师 A 分组' })).toBeVisible();
    await page.getByRole('button', { name: '退出登录' }).click();

    await registerTeacher(page, { ...secondAccount, name: '边界教师 B' });
    await page.getByRole('button', { name: '工作台首页' }).click();
    await expect(page.getByRole('heading', { name: '即将开始的课程：0' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '资源：0' })).toBeVisible();

    await page.getByRole('button', { name: '设置' }).click();
    await expect(page.getByRole('region', { name: '模块分组：教师 A 分组' })).not.toBeVisible();
    await expect(page.getByRole('checkbox', { name: '提醒中心', exact: true }).first()).toBeChecked();

    await moduleButton(page, '资源库').click();
    await expect(page.getByText('教师 A 的文件', { exact: true })).not.toBeVisible();
    await uploadResource(page, {
      title: '教师 B 的文件',
      fileName: 'teacher-b.txt',
      contents: 'teacher B private file'
    });
    const secondResource = (await apiCall(page, '/modules/resource-vault')).body.items[0];
    expect(secondResource.originalName).toBe('teacher-b.txt');

    const crossAccountMetadata = await apiCall(page, `/modules/resource-vault/${firstResource.id}`);
    expect(crossAccountMetadata.status).toBe(404);
    const crossAccountFile = await apiCall(page, `/modules/resource-vault/${firstResource.id}/file`);
    expect(crossAccountFile.status).toBe(404);

    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('新分组名称').fill('教师 B 分组');
    await page.getByRole('button', { name: '创建分组' }).click();
    await page.getByLabel('提醒中心').first().uncheck();
    await page.getByRole('button', { name: '退出登录' }).click();

    await loginTeacher(page, firstAccount);
    await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
    await expect(moduleButton(page, '提醒中心')).not.toBeVisible();
    await page.getByRole('button', { name: '设置' }).click();
    await expect(page.getByRole('region', { name: '模块分组：教师 A 分组' })).toBeVisible();
    await expect(page.getByRole('region', { name: '模块分组：教师 B 分组' })).not.toBeVisible();
    await moduleButton(page, '资源库').click();
    await expect(page.getByText('教师 A 的文件', { exact: true })).toBeVisible();
    await expect(page.getByText('教师 B 的文件', { exact: true })).not.toBeVisible();
  });
});
