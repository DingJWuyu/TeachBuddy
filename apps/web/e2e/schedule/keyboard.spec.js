import { setScheduleField, expectScheduleField, openRepeat, scheduleAction } from './controls.mjs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createScheduleWorld, loginSchedule, closeScheduleWorld } from './fixture.mjs';

test.describe('输入确认与持久化', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, errors;

  const content = (title, pending = false) => ({ title, items: [],
    time: pending ? null : { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null,
    calendar: { allDay: false, tags: [], notes: '' } });

  async function call(method, url, body) {
    const response = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(response.status, JSON.stringify(response.json)).toBeLessThan(300);
    return response.json;
  }

  async function open(page, task) {
    await page.goto(`${world.origin}/calendar?entry=${task.id}`);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
  }

  async function create(page, pending) {
    await page.getByRole('button', { name: pending ? '新建待安排任务' : '新建任务', exact: true }).click();
  }

  async function action(page, name) { await scheduleAction(page, name); }

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
    errors = []; page.on('pageerror', error => errors.push(error.message));
    ({ world, client } = await createScheduleWorld(() => new Date('2026-09-25T06:00:00Z'), 'schedule-keyboard@example.test'));
    await loginSchedule(page, world, 'schedule-keyboard@example.test');
    await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  for (const pending of [false, true]) for (const existing of [false, true]) test(`Enter ${pending ? '待安排' : '任务'}${existing ? '编辑' : '新建'}标题保存保留编辑器，重开读回`, async ({ page }) => {
    let task;
    if (existing) { task = await call('POST', E, content('原始标题', pending)); await open(page, task); }
    else await create(page, pending);
    const title = page.locator('#calendar-entry-title');
    await title.fill('回车确认后的标题'); await title.press('Enter');
    await expect(page.locator('.tbx-sheet')).toBeVisible(); await expect(title).not.toBeFocused();
    await expect.poll(async () => (await call('GET', E)).items.map(value => value.title)).toEqual(['回车确认后的标题']);
    const entries = (await call('GET', E)).items;
    expect(entries).toHaveLength(1); expect(entries[0].title).toBe('回车确认后的标题');
    expect(Boolean(entries[0].time)).toBe(!pending);
    await open(page, entries[0]); await page.reload(); await expect(title).toHaveValue('回车确认后的标题');
    await title.fill('第二次标题'); await title.press('Enter');
    await expect.poll(async () => (await call('GET', E)).items.map(value => value.title)).toEqual(['第二次标题']);
    await expect(page.locator('.tbx-sheet')).toBeVisible();
  });

  for (const pending of [false, true]) test(`Enter 未命名${pending ? '待安排' : '任务'}不创建空对象`, async ({ page }) => {
    await create(page, pending); await page.getByRole('textbox', { name: '备注', exact: true }).fill('仅有备注');
    await page.locator('#calendar-entry-title').press('Enter');
    await expect(page.locator('.tbx-sheet')).toBeVisible(); await expect(page.locator('#calendar-entry-title')).not.toBeFocused(); expect((await call('GET', E)).items).toHaveLength(0);
  });

  for (const pending of [false, true]) test(`Enter ${pending ? '待安排' : '任务'}备注确认移出光标，Shift+Enter换行且重开保持`, async ({ page }) => {
    const task = await call('POST', E, content('备注键盘任务', pending)); await open(page, task);
    const notes = page.getByRole('textbox', { name: '备注', exact: true });
    await notes.click(); await notes.pressSequentially('第一行'); await notes.press('Shift+Enter'); await notes.pressSequentially('第二行');
    await expect(notes).toBeFocused(); await notes.press('Enter'); await expect(notes).not.toBeFocused();
    await expect(page.locator('.tbx-sheet')).toBeVisible();
    await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).calendar.notes).toBe('第一行\n第二行');
    await page.reload(); await expect(notes).toHaveValue('第一行\n第二行');
    await notes.fill(''); await notes.press('Enter'); await expect(notes).not.toBeFocused();
    await expect(notes).toHaveValue(''); await expect(notes).toHaveAttribute('placeholder', '备注');
  });

  for (const pending of [false, true]) test(`Enter ${pending ? '待安排' : '任务'}事项逐条添加，空白回车不留空项`, async ({ page }) => {
    const task = await call('POST', E, content('事项键盘任务', pending)); await open(page, task);
    await page.getByRole('textbox', { name: '添加事项', exact: true }).fill('第一件事');
    await page.getByRole('textbox', { name: '添加事项', exact: true }).press('Enter'); await page.getByLabel('事项 1', { exact: true }).press('Enter');
    await expect(page.getByLabel('事项 2', { exact: true })).toBeFocused();
    await page.getByLabel('事项 2', { exact: true }).fill('第二件事'); await page.getByLabel('事项 2', { exact: true }).press('Enter');
    const blank = page.getByLabel('事项 3', { exact: true }); await expect(blank).toBeFocused(); await blank.press('Enter');
    await expect(blank).toHaveCount(0); await page.getByRole('button', { name: '关闭', exact: true }).click();
    expect((await call('GET', `${E}/${task.id}`)).items.map(item => item.text)).toEqual(['第一件事', '第二件事']);
  });

  for (const kind of ['标签', '提醒', '重复', '天数']) test(`Enter ${kind}输入确认有效设置`, async ({ page }) => {
    const task = await call('POST', E, content('弹窗键盘任务')); await open(page, task);
    if (kind === '标签') {
      await page.getByRole('button', { name: '新标签', exact: true }).click();
      const d = page.getByRole('dialog', { name: '创建标签', exact: true });
      await d.getByLabel('标签名称', { exact: true }).fill('回车标签'); await d.getByLabel('标签名称', { exact: true }).press('Enter');
      await expect(d).toHaveCount(0); expect((await call('GET', L)).items.map(label => label.name)).toEqual(['回车标签']);
    }
    if (kind === '提醒') {
      await action(page, '设置提醒'); const d = page.getByRole('dialog', { name: '提醒', exact: true });
      await d.getByLabel('分钟数', { exact: true }).fill('5'); await d.getByLabel('分钟数', { exact: true }).press('Enter');
      await expect(d).toHaveCount(0); await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^提醒/ })).toContainText('5');
    }
    if (kind === '重复') {
      await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();
      await page.getByRole('menuitem', { name: '自定义…', exact: true }).click(); const d = page.getByRole('dialog', { name: '重复', exact: true });
      await d.getByLabel('重复间隔', { exact: true }).fill('2'); await d.getByLabel('重复间隔', { exact: true }).press('Enter');
      await expect(d).toHaveCount(0); await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toContainText('2');
    }
    if (kind === '天数') {
      await page.getByRole('button', { name: '日历视图', exact: true }).click(); await page.getByRole('menuitem', { name: '天数', exact: true }).hover();
      await page.getByRole('menuitem', { name: '其他…', exact: true }).click(); const d = page.getByRole('dialog', { name: '自定义天数', exact: true });
      await d.getByLabel('天数', { exact: true }).fill('3'); await d.getByLabel('天数', { exact: true }).press('Enter');
      await expect(d).toHaveCount(0); await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(3);
    }
    await page.getByRole('button', { name: '关闭', exact: true }).click(); await page.reload();
    const saved = await call('GET', `${E}/${task.id}`);
    if (kind === '标签') expect(saved.calendar.tags).toHaveLength(1);
    if (kind === '提醒') expect(saved.reminder.minutes).toBe(5);
    if (kind === '重复') expect(saved.repeat.interval).toBe(2);
  });

  test('Enter 无效提醒不提交，日期与下拉输入不关闭', async ({ page }) => {
    const task = await call('POST', E, content('原生控件')); await open(page, task);
    await page.locator('.tbx-sheet').getByRole('button', { name: '开始日期', exact: true }).press('Enter'); await expect(page.locator('.tbx-sheet')).toBeVisible();
    await page.locator('.tbx-sheet').getByRole('button', { name: '开始时间', exact: true }).press('Enter'); await expect(page.locator('.tbx-sheet')).toBeVisible();
    await action(page, '设置提醒'); const d = page.getByRole('dialog', { name: '提醒', exact: true });
    await d.getByLabel('分钟数', { exact: true }).fill('-1'); await d.getByLabel('分钟数', { exact: true }).press('Enter');
    await expect(d).toBeVisible(); await expect(d.getByRole('button', { name: '完成', exact: true })).toBeDisabled();
    await d.getByLabel('提醒时机', { exact: true }).press('Enter'); await expect(d).toBeVisible();
    await d.getByRole('button', { name: '取消', exact: true }).click(); expect((await call('GET', `${E}/${task.id}`)).reminder).toBeNull();
  });

  for (const field of ['标题', '事项', '备注', '标签']) test(`Enter ${field}输入法候选确认不执行操作`, async ({ page }) => {
    const task = await call('POST', E, content('输入法确认')); await open(page, task);
    let input;
    if (field === '标题') input = page.locator('#calendar-entry-title');
    if (field === '备注') input = page.getByRole('textbox', { name: '备注', exact: true });
    if (field === '事项') input = page.getByRole('textbox', {name:'添加事项',exact:true});
    if (field === '标签') { await page.getByRole('button', { name: '新标签', exact: true }).click(); input = page.getByLabel('标签名称', { exact: true }); }
    await input.fill('中文候选词'); await input.focus();
    // 模拟输入法键盘属性，真实系统输入法不由浏览器自动化控制。
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true });
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, bubbles: true });
    await expect(input).toBeFocused(); await expect(page.locator('.tbx-sheet')).toBeVisible();
    if (field === '事项') await expect(page.getByLabel('事项 2', { exact: true })).toHaveCount(0);
    if (field === '标签') { await expect(page.getByRole('dialog', { name: '创建标签', exact: true })).toBeVisible(); expect((await call('GET', L)).items).toHaveLength(0); }
  });

  test('普通任务删除按钮键盘二次确认后永久删除', async ({ page }) => {
    const task = await call('POST', E, content('删除确认')); await open(page, task);
    const remove = page.locator('.tbx-sheet').getByRole('button', { name: '删除', exact: true });
    await remove.focus(); await page.keyboard.press('Enter');
    const confirm = page.locator('.tbx-sheet').getByRole('button', { name: '确认删除', exact: true });
    await expect(confirm).toBeFocused(); await page.keyboard.press('Enter');
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    expect((await call('GET', E)).items).toHaveLength(0);
  });

  test('Enter 设置重复响应未返回时编辑标题并确认，保存为独立任务', async ({ page }) => {
    const task = await call('POST', E, content('重复模板')); await open(page, task);
    let release, hit, first = true;
    const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
    await page.route(`**${E}/${task.id}`, async route => {
      if (route.request().method() !== 'PUT' || !first) return route.continue();
      first = false; const response = await route.fetch(); hit(); await gate; await route.fulfill({ response });
    });
    await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();
    await page.getByRole('menuitemradio', { name: '每周', exact: true }).click(); await started;
    await page.locator('#calendar-entry-title').fill('本次独立修改'); await page.locator('#calendar-entry-title').press('Enter'); release();
    await expect(page.locator('.tbx-sheet')).toBeVisible(); await expect(page.locator('#calendar-entry-title')).not.toBeFocused();
    await expect.poll(async () => (await call('GET', E)).items.some(value => value.title === '本次独立修改')).toBe(true);
    const entries = (await call('GET', E)).items;
    expect(entries.find(value => value.id === task.id).title).toBe('重复模板');
    const detached = entries.filter(value => value.title === '本次独立修改'); expect(detached).toHaveLength(1); expect(detached[0].repeat).toBeNull();
    await open(page, detached[0]); await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toContainText('不重复');
  });

  test('Enter 确认后关闭正在保存的任务，等待期间的新输入仍然保存', async ({ page }) => {
    const task = await call('POST', E, content('关闭期间继续输入')); await open(page, task);
    let release, hit, first = true;
    const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
    await page.route(`**${E}/${task.id}`, async route => {
      if (route.request().method() !== 'PUT' || !first) return route.continue();
      first = false; const response = await route.fetch(); hit(); await gate; await route.fulfill({ response });
    });
    await page.locator('#calendar-entry-title').fill('确认时的标题'); await page.locator('#calendar-entry-title').press('Enter'); await started;
    await expect(page.locator('.tbx-sheet')).toBeVisible(); await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('textbox', { name: '备注', exact: true }).fill('等待期间补充的备注'); release();
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    const saved = await call('GET', `${E}/${task.id}`); expect(saved.title).toBe('确认时的标题'); expect(saved.calendar.notes).toBe('等待期间补充的备注');
  });

  test('Enter 新建标签遇到旧请求待确认，原键原体重试后保存当前新标签', async ({ page }) => {
    const task = await call('POST', E, content('两个标签意图')); await open(page, task);
    const requests = []; let first = true;
    await page.route(`**${L}`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
      if (!first) return route.continue(); first = false; await route.fetch(); await route.abort('failed');
    });
    const labelDialog = async () => {
      await page.getByRole('button', { name: '新标签', exact: true }).click();
      return page.getByRole('dialog', { name: '创建标签', exact: true });
    };
    let d = await labelDialog(); await d.getByLabel('标签名称', { exact: true }).fill('上次标签'); await d.getByLabel('标签名称', { exact: true }).press('Enter');
    await expect(d.getByRole('button', { name: '重试确认', exact: true })).toBeVisible(); await d.getByRole('button', { name: '取消', exact: true }).click();
    d = await labelDialog(); await d.getByLabel('标签名称', { exact: true }).fill('当前标签'); await d.getByLabel('标签名称', { exact: true }).press('Enter');
    await expect(d).toHaveCount(0); expect((await call('GET', L)).items.map(value => value.name).sort()).toEqual(['上次标签', '当前标签']);
    expect(requests).toHaveLength(3); expect(requests[1]).toEqual(requests[0]); expect(requests[2].key).not.toBe(requests[0].key);
    await page.getByRole('button', { name: '关闭', exact: true }).click(); expect((await call('GET', `${E}/${task.id}`)).calendar.tags).toHaveLength(1);
  });

  test('Enter 菜单可用键盘进入重复子菜单并选择，方向键不混入其他菜单项', async ({ page }) => {
    const task = await call('POST', E, content('键盘重复选择')); await open(page, task);
    await page.locator('.tbx-sheet').getByRole('button',{name:/^重复/}).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitemradio', { name: '不重复', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitemradio', { name: '每天', exact: true })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toContainText('每天');
    await page.getByRole('button', { name: '关闭', exact: true }).click(); expect((await call('GET', `${E}/${task.id}`)).repeat.frequency).toBe('daily');
  });
});

test.describe('菜单导航与键盘焦点', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, errors;

  const content = (title, pending = false) => ({ title, items: [],
    time: pending ? null : { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null,
    calendar: { allDay: false, tags: [], notes: '' } });

  async function call(method, url, body) {
    const response = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(response.status, JSON.stringify(response.json)).toBeLessThan(300);
    return response.json;
  }

  async function open(page, task) {
    await page.goto(`${world.origin}/calendar?entry=${task.id}`);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
  }

  async function action(page, name) { await scheduleAction(page, name); }

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
    errors = []; page.on('pageerror', error => errors.push(error.message));
    ({ world, client } = await createScheduleWorld(() => new Date('2026-09-25T06:00:00Z'), 'schedule-keyboard@example.test'));
    await loginSchedule(page, world, 'schedule-keyboard@example.test');
    await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  test('标签胶囊Enter反复切换，编辑器保持并真实保存', async ({ page }) => {
    const label=await call('POST',L,{name:'个人',color:'#579bfc'});
    const task=await call('POST',E,content('标签键盘')); await open(page,task);
    const button=page.locator('.tbx-labels').getByRole('button',{name:label.name,exact:true});
    await button.focus(); await button.press('Enter'); await expect(button).toHaveAttribute('aria-pressed','true');
    await button.press('Enter'); await expect(button).toHaveAttribute('aria-pressed','false');
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    expect((await call('GET', E+'/'+task.id)).calendar.tags).toEqual([]);
  });

  test('标签胶囊使用Tab定位，双击打开编辑且取消保留原名', async ({ page }) => {
    const label=await call('POST',L,{name:'个人',color:'#579bfc'}); await call('POST',L,{name:'备课',color:'#ff6b75'});
    const task=await call('POST',E,content('标签定位')); await open(page,task);
    const button=page.locator('.tbx-labels').getByRole('button',{name:label.name,exact:true});
    await button.focus(); await button.press('Tab'); await expect(page.locator('.tbx-labels').getByRole('button',{name:'备课',exact:true})).toBeFocused();
    await button.dblclick(); const dialog=page.getByRole('dialog',{name:'编辑标签',exact:true});
    await dialog.getByLabel('标签名称').fill('尚未保存'); await dialog.getByRole('button',{name:'取消',exact:true}).click();
    expect((await call('GET',L)).items.find(x=>x.id===label.id).name).toBe('个人');
  });

  for(const [name,value,key] of [['entry-date','2026-09-26','date'],['entry-end-date','2026-09-26','endDate'],['entry-start','15:15','startTime'],['entry-end','16:00','endTime']])test(`日期时间 ${name} Enter 确认并移出输入焦点`,async({page})=>{
    const task=await call('POST',E,content('时间确认'));await open(page,task);
    const label={'entry-date':'开始日期','entry-end-date':'结束日期','entry-start':'开始时间','entry-end':'结束时间'}[name];
    if(name==='entry-end-date') { await scheduleAction(page,'全天'); }
    await setScheduleField(page,label,value,{keyboard:true});
    await expect(page.locator('.tbx-popover:not([inert])')).toHaveCount(0);
    await expect(page.locator('.tbx-sheet')).toBeVisible();
    await expect.poll(async()=>{const saved=await call('GET',`${E}/${task.id}`);if(key==='date')return saved.time.date;if(key==='startTime')return saved.time.startTime;if(key==='endDate')return Math.round(saved.time.durationMinutes/1440);return saved.time.durationMinutes;}).toBe(key==='endDate'?2:key==='endTime'?60:value);
  });

  test('重复菜单上下键定位实际选项，Esc返回触发按钮', async ({ page }, info) => {
    const task=await call('POST',E,content('菜单键盘')); await open(page,task);
    const trigger=page.locator('.tbx-sheet').getByRole('button',{name:/^重复/}); await trigger.focus(); await trigger.press('Enter');
    const option=page.getByRole('menuitemradio',{name:'不重复',exact:true}); await expect(option).toBeFocused();
    await option.press('ArrowDown'); await expect(page.getByRole('menuitemradio',{name:'每天',exact:true})).toBeFocused();
    await page.screenshot({path:info.outputPath('repeat-menu-focus.png')}); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  });

  test('提醒左右键在时机和分钟数间移动，Enter 确认当前设置',async({page})=>{
    const task=await call('POST',E,content('提醒键盘'));await open(page,task);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});
    const timing=d.getByRole('combobox',{name:'提醒时机'}),minutes=d.getByRole('spinbutton');await expect(timing).toBeFocused();await timing.press('ArrowRight');await expect(minutes).toBeFocused();
    await minutes.fill('15');await minutes.press('ArrowLeft');await expect(timing).toBeFocused();await timing.press('ArrowUp');await expect(timing).toHaveValue('start-after');await timing.press('Enter');
    await expect(d).toHaveCount(0);await expect.poll(async()=> (await call('GET',`${E}/${task.id}`)).reminder).toEqual({anchor:'start',side:'after',minutes:15});
  });

  test('提醒下拉字段按 Enter 直接确认，不再打开选项列表',async({page})=>{
    const task=await call('POST',E,content('提醒回车'));await open(page,task);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await d.getByRole('combobox',{name:'提醒时机'}).press('Enter');await expect(d).toHaveCount(0);
  });

  test('日周全天卡片不带颜色圆点，月视图仍保留',async({page})=>{
    const c=content('两天全天');c.calendar.allDay=true;c.time.startTime='00:00';c.time.durationMinutes=2880;const task=await call('POST',E,c);
    await page.goto(`${world.origin}/calendar`);const view=page.getByRole('button',{name:'日历视图',exact:true});
    for(const kind of ['日','周']){await view.click();await page.getByRole('menuitemradio',{name:new RegExp('^'+kind)}).click();const event=page.locator('.fc-daygrid-event').filter({hasText:'两天全天'}).first();await expect(event).toBeVisible();await expect(event.locator('.cal-event-content i')).toHaveCount(0);}
    await view.click();await page.getByRole('menuitemradio',{name:/^月/}).click();const event=page.locator('.fc-daygrid-event').filter({hasText:'两天全天'}).first();await expect(event).toBeVisible();await expect(event.locator('.cal-event-content i')).toHaveCount(1);
  });

  test('标签胶囊Space选择与取消保持编辑器，刷新读回最后选择', async ({ page }) => {
    const label=await call('POST',L,{name:'唯一匹配',color:'#579bfc'}); const task=await call('POST',E,content('标签确认')); await open(page,task);
    const option=page.locator('.tbx-labels').getByRole('button',{name:label.name,exact:true}); await option.focus();
    await option.press('Space'); await expect(option).toHaveAttribute('aria-pressed','true');
    await option.press('Space'); await expect(option).toHaveAttribute('aria-pressed','false');
    await option.press('Space'); await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.reload(); expect((await call('GET',E+'/'+task.id)).calendar.tags).toEqual([label.id]);
  });

  for(const ending of [false,true])test(`全天${ending?'结束':'开始'}日期 Enter 保存并失焦`,async({page})=>{
    const c=content('全天日期');c.calendar.allDay=true;c.time.startTime='00:00';c.time.durationMinutes=2880;
    const task=await call('POST',E,c);await open(page,task);
    await setScheduleField(page,ending?'结束日期':'开始日期',ending?'2026-09-27':'2026-09-26',{keyboard:true});
    await expect(page.locator('.tbx-popover:not([inert])')).toHaveCount(0);await expect(page.locator('.tbx-sheet')).toBeVisible();
    await expect.poll(async()=>{const saved=await call('GET',`${E}/${task.id}`);return ending?saved.time.durationMinutes:saved.time.date;}).toBe(ending?4320:'2026-09-26');
  });

  test('重复并排字段左右切换，选择字段上下修改，Enter 确认',async({page})=>{
    const task=await call('POST',E,content('重复方向键'));await open(page,task);await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});const interval=d.getByLabel('重复间隔'),unit=d.getByLabel('重复单位');await expect(interval).toBeFocused();await interval.press('ArrowRight');await expect(unit).toBeFocused();await unit.press('ArrowDown');await expect(unit).toHaveValue('monthly');await unit.press('ArrowLeft');await expect(interval).toBeFocused();await interval.press('Enter');await expect(d).toHaveCount(0);await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toContainText('月');
  });

  test('标签颜色横向用左右键，只有原有勾选没有外圈',async({page})=>{
    const task=await call('POST',E,content('颜色方向键'));await open(page,task);await page.getByRole('button', { name: '新标签', exact: true }).click();const d=page.getByRole('dialog',{name:'创建标签',exact:true});const colors=d.locator('.cal-label-colors button');await colors.first().focus();await page.keyboard.press('ArrowRight');await expect(colors.nth(1)).toBeFocused();expect(await colors.nth(1).evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');await page.keyboard.press('Space');await expect(colors.nth(1)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('ArrowLeft');await expect(colors.first()).toBeFocused();await d.getByRole('button',{name:'取消',exact:true}).click();
  });

  for(const theme of ['light','dark'])for(const width of [390,1675])test(`标签和任务菜单 ${theme} ${width} 键盘焦点完整且无外框`,async({page},info)=>{
    await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:theme==='dark'?'深色':'浅色',exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();await page.setViewportSize({width,height:950});
    await call('POST',L,{name:'视觉标签',color:'#579bfc'});const task=await call('POST',E,content('视觉键盘'));await open(page,task);
    const option=page.locator('.tbx-labels').getByRole('button',{name:'视觉标签',exact:true});await option.focus();await expect(option).toBeFocused();
    const bounds=await option.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath('tag-focus.png')});
    const trigger=page.locator('.tbx-sheet').getByRole('button',{name:/^重复/});await trigger.press('Enter');
    const repeat=page.getByRole('menuitemradio',{name:'不重复',exact:true});await expect(repeat).toBeFocused();
    expect(await repeat.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');await page.screenshot({path:info.outputPath('menu-focus.png')});
  });

  test('彩色任务卡片键盘定位保留原色，以加深代替外框',async({page})=>{
    const label=await call('POST',L,{name:'蓝色任务',color:'#579bfc'});const c=content('彩色键盘卡片');c.calendar.tags=[label.id];const task=await call('POST',E,c);await page.goto(`${world.origin}/calendar`);const event=page.locator('.fc-timegrid-event').filter({hasText:'彩色键盘卡片'}).first();await expect(event).toBeVisible();await event.focus();await expect(event).toBeFocused();expect(await event.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');expect(await event.evaluate(e=>getComputedStyle(e).filter)).toBe('brightness(0.92)');await event.press('Enter');await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
  });
});

test.describe('对话框确认与异步输入', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, errors, now;

  const content = (title, pending = false) => ({ title, items: [],
    time: pending ? null : { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null,
    calendar: { allDay: false, tags: [], notes: '' } });

  async function call(method, url, body) {
    const response = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(response.status, JSON.stringify(response.json)).toBeLessThan(300);
    return response.json;
  }

  async function open(page, task) {
    await page.goto(`${world.origin}/calendar?entry=${task.id}`);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
  }

  async function action(page, name) { await scheduleAction(page, name); }

  test.beforeEach(async ({ page }) => {
    now = '2026-09-25T06:00:00Z';
    await page.clock.setFixedTime(new Date(now));
    errors = []; page.on('pageerror', error => errors.push(error.message));
    ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-dialog-keyboard@example.test'));
    await loginSchedule(page, world, 'schedule-dialog-keyboard@example.test');
    await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  for (const focus of ['default', '取消']) test(`移回待安排 Enter ${focus} 确认操作并刷新读回`, async ({page}) => {
    const task=await call('POST',E,content('移动确认')); await open(page,task);
    await page.getByRole('button',{name:'移回待安排',exact:true}).click();
    const d=page.getByRole('alertdialog', { name: '移回待安排？',exact:true}); await expect(d).toBeVisible();
    if(focus !== 'default') await d.getByRole('button',{name:focus,exact:true}).focus();
    await page.keyboard.press('Enter'); await expect(d).toHaveCount(0);
    await expect(page.locator('.tbx-sheet')).toBeVisible();
    await expect.poll(async()=> (await call('GET',`${E}/${task.id}`)).time).toBeNull();
    await page.reload(); await expect(page.getByRole('button',{name:'放进日历，变成任务',exact:true})).toBeVisible();
  });

  const dialogKinds = ['自定义天数', '重复', '创建标签', '编辑标签', '提醒',
    '移动事项', '采用服务器内容', '移回待安排', '提醒时间已过去'];

  async function prepareDialog(page, kind, pending = false) {
    const value = content('弹窗确认任务', pending);
    if (kind === '移动事项') value.items = [{ id: randomUUID(), text: '要移动的事项', priority: 'normal' }];
    if (kind === '提醒时间已过去') value.reminder = { side: 'before', minutes: 10 };
    const task = await call('POST', E, value);
    await open(page, task);
    let target, label;
    if (kind === '自定义天数') {
      await page.getByRole('button', { name: '日历视图', exact: true }).click();
      await page.getByRole('menuitem', { name: '天数', exact: true }).hover();
      await page.getByRole('menuitem', { name: '其他…', exact: true }).click();
      await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('天数', { exact: true }).fill('3');
    } else if (kind === '重复') {
      await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();
      await page.getByRole('menuitem', { name: '自定义…', exact: true }).click();
      await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('重复间隔').fill('2');
    } else if (kind === '创建标签' || kind === '编辑标签') {
      if (kind === '编辑标签') label = await call('POST', L, { name: '原标签', color: '#579bfc' });
      // Reload so the new label is present in the real picker.
      if (label) await open(page, task);
      if (label) await page.locator('.tbx-labels').getByRole('button',{name:label.name,exact:true}).dblclick();
      else await page.getByRole('button',{name:'新标签',exact:true}).click();
      await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('标签名称').fill('已确认标签');
    } else if (kind === '提醒') {
      await action(page, '设置提醒');
      await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('分钟数').fill('5');
    } else if (kind === '移动事项') {
      target = await call('POST', E, content('移动目标', true));
      await open(page, task);
      await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();
      await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
      await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('移到', { exact: true }).selectOption(target.id);
    } else if (kind === '采用服务器内容') {
      await call('PUT', `${E}/${task.id}`, { ...value, expectedVersion: task.version,
        calendar: { ...value.calendar, notes: '服务器备注' } });
      await page.locator('#calendar-entry-title').fill('未保存的本地标题');
      await page.locator('#calendar-entry-title').press('Enter');
      await page.getByRole('button', { name: '读取最新版本', exact: true }).click();
      await page.getByText('查看服务器内容', { exact: true }).click();
      await page.getByRole('button', { name: '采用服务器内容', exact: true }).click();
    } else if (kind === '移回待安排') await page.getByRole('button', { name: '移回待安排', exact: true }).click();
    else if (kind === '提醒时间已过去') {
      now = '2026-09-25T07:17:00Z'; await page.clock.setFixedTime(new Date(now));
      await setScheduleField(page, '结束时间', '15:25');
      await page.locator('.tbx-sheet').getByRole('button', { name: '结束时间', exact: true }).press('Enter');
    }
    const d = kind === '移回待安排' ? page.getByRole('alertdialog', { name: '移回待安排？', exact: true }) : page.getByRole('dialog', { name: kind, exact: true });
    await expect(d).toBeVisible();
    return { d, task, value, target, label };
  }

  async function verifyOperation(page, kind, scene, saved) {
    const { task, target, value, label } = scene;
    const read = () => call('GET', `${E}/${task.id}`);
    if (kind === '自定义天数') await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(saved ? 3 : 7);
    else if (kind === '重复') await expect.poll(async () => (await read()).repeat?.interval ?? null).toBe(saved ? 2 : null);
    else if (kind === '创建标签' || kind === '编辑标签') {
      await expect.poll(async () => (await call('GET', L)).items.map(x => x.name)).toEqual(saved ? ['已确认标签'] : label ? ['原标签'] : []);
    } else if (kind === '提醒') await expect.poll(async () => (await read()).reminder).toEqual(saved ? { side: 'before', minutes: 5 } : null);
    else if (kind === '移动事项') {
      await expect.poll(async () => (await read()).items.length).toBe(saved ? 0 : 1);
      expect((await call('GET', `${E}/${target.id}`)).items).toEqual(saved ? value.items : []);
    } else if (kind === '移回待安排') await expect.poll(async () => (await read()).time).toEqual(saved ? null : value.time);
    else if (kind === '提醒时间已过去') {
      await expect.poll(async () => (await read()).reminder).toEqual(saved ? null : value.reminder);
      await expect.poll(async () => (await read()).time.durationMinutes).toBe(saved ? 25 : 30);
      await expectScheduleField(page, '结束时间', saved ? '15:25' : '15:30');
    } else if (kind === '采用服务器内容') {
      await expect(page.locator('#calendar-entry-title')).toHaveValue(saved ? task.title : '未保存的本地标题');
      await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveText(saved ? '服务器备注' : '');
      expect((await read()).calendar.notes).toBe('服务器备注');
    }
  }

  for (const kind of dialogKinds) for (const key of ['Enter', 'Escape']) {
    test(`${kind} ${key} ${key === 'Enter' ? '完成操作' : '取消不提交'}`, async ({ page }) => {
      const scene = await prepareDialog(page, kind);
      await page.keyboard.press(key);
      await expect(scene.d).toHaveCount(0);
      await verifyOperation(page, kind, scene, key === 'Enter');
      if (key === 'Enter') {
        await page.reload();
        if (kind !== '提醒时间已过去' && kind !== '采用服务器内容') await verifyOperation(page, kind, scene, true);
      }
    });
  }

  for (const kind of ['重复', '创建标签', '提醒', '移动事项']) {
    test(`${kind} 聚焦取消后 Enter 仍确认，鼠标取消保留原行为`, async ({ page }) => {
      let scene = await prepareDialog(page, kind);
      await scene.d.getByRole('button', { name: '取消', exact: true }).click();
      await expect(scene.d).toHaveCount(0); await verifyOperation(page, kind, scene, false);
      scene = await prepareDialog(page, kind);
      await scene.d.getByRole('button', { name: '取消', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(scene.d).toHaveCount(0); await verifyOperation(page, kind, scene, true);
    });
  }

  for (const [kind, field, invalid, valid] of [
    ['重复', '重复间隔', '0', '2'], ['创建标签', '标签名称', '', '已确认标签'],
    ['提醒', '分钟数', '-1', '5'], ['自定义天数', '天数', '0', '3'],
  ]) test(`${kind} 无效输入时 Enter 不提交也不关闭，修正后确认`, async ({ page }) => {
    const scene = await prepareDialog(page, kind);
    await scene.d.getByLabel(field, { exact: true }).fill(invalid);
    await scene.d.getByRole('button', { name: '关闭', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(scene.d).toBeVisible(); await verifyOperation(page, kind, scene, false);
    await scene.d.getByLabel(field, { exact: true }).fill(valid);
    await scene.d.getByRole('button', { name: '取消', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(scene.d).toHaveCount(0); await verifyOperation(page, kind, scene, true);
  });

  test('编辑标签即使聚焦删除标签，Enter 保存而非误删', async ({ page }) => {
    const scene = await prepareDialog(page, '编辑标签');
    await scene.d.getByRole('button', { name: '删除标签', exact: true }).focus();
    await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
    await verifyOperation(page, '编辑标签', scene, true);
    expect((await call('GET', L)).items[0].id).toBe(scene.label.id);
  });

  test('提醒冲突即使聚焦放弃，Enter 关闭提醒并保存新的时间', async ({ page }) => {
    const scene = await prepareDialog(page, '提醒时间已过去');
    await scene.d.getByRole('button', { name: '放弃本次修改', exact: true }).focus();
    await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
    await verifyOperation(page, '提醒时间已过去', scene, true);
  });

  test('保存等待中聚焦取消再按 Enter 不关闭或重复请求，长按同样不重放', async ({ page }) => {
    const scene = await prepareDialog(page, '创建标签');
    let release, hit, writes = 0;
    const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
    await page.route(`**${L}`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++; const response = await route.fetch(); hit(); await gate; await route.fulfill({ response });
    });
    try {
      await page.keyboard.press('Enter'); await started;
      await scene.d.getByRole('button', { name: '取消', exact: true }).focus();
      await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
      await expect(scene.d).toBeVisible(); expect(writes).toBe(1);
    } finally { release(); }
    await expect(scene.d).toHaveCount(0); await verifyOperation(page, '创建标签', scene, true);
    expect(writes).toBe(1);
  });

  test('输入法与带修饰键 Enter 不确认或误关，普通 Enter 最后完成', async ({ page }) => {
    const scene = await prepareDialog(page, '创建标签');
    const input = scene.d.getByLabel('标签名称');
    // Mechanism probes only: real OS IME is outside this browser automation.
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
    await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true });
    await scene.d.getByRole('button', { name: '关闭', exact: true }).focus();
    for (const key of ['Shift+Enter', 'Alt+Enter', 'Control+Enter', 'Meta+Enter']) {
      await page.keyboard.press(key); await expect(scene.d).toBeVisible();
    }
    expect((await call('GET', L)).items).toEqual([]);
    await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
    await verifyOperation(page, '创建标签', scene, true);
  });

  for (const scope of ['series', 'instance']) test(`移动事项重复目标 ${scope} 未选范围不误关，选定后 Enter 完成`, async ({ page }) => {
    const value = content('移动到重复'); value.items = [{ id: randomUUID(), text: '可重复事项', priority: 'normal' }];
    const source = await call('POST', E, value);
    const targetValue = content('重复目标');
    targetValue.repeat = { frequency: 'weekly', interval: 1, weekdays: [5], monthly: 'date', until: '2026-10-09', count: 0 };
    const target = await call('POST', E, targetValue); await open(page, source);
    await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();
    await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
    const d = page.getByRole('dialog', { name: '移动事项', exact: true });
    await d.getByLabel('移到', { exact: true }).selectOption(target.id);
    await d.getByRole('button', { name: '取消', exact: true }).focus();
    await page.keyboard.press('Enter'); await expect(d).toBeVisible();
    const radio = d.getByRole('radio', { name: scope === 'series' ? '每次重复都需要' : '只在某一次需要', exact: true });
    await radio.focus(); await page.keyboard.press('Space'); await expect(radio).toBeChecked();
    if (scope === 'instance') await expect(d.getByLabel('任务日期')).toHaveValue('2026-09-25');
    await page.keyboard.press('Enter'); await expect(d).toHaveCount(0);
    await expect.poll(async () => (await call('GET', `${E}/${source.id}`)).items).toEqual([]);
    if (scope === 'series') expect((await call('GET', `${E}/${target.id}`)).items).toEqual(value.items);
    else {
      const items = (await call('GET', E)).items;
      expect(items.find(x => x.id !== target.id && x.title === target.title)?.items).toEqual(value.items);
      expect((await call('GET', `${E}/${target.id}`)).items).toEqual([]);
    }
  });

  for (const theme of ['浅色', '深色']) for (const width of [390, 1675]) {
    test(`确认弹窗 ${theme} ${width} 焦点无外框且布局完整`, async ({ page }, info) => {
      await page.getByRole('link', { name: /^账户：/ }).click();
      await page.getByRole('button', { name: theme, exact: true }).click();
      await page.getByRole('link', { name: '日程', exact: true }).click();
      await page.setViewportSize({ width, height: 950 });
      const scene = await prepareDialog(page, '移回待安排');
      const confirm = scene.d.locator('[data-dialog-confirm]'); await expect(confirm).toBeFocused();
      expect(await confirm.evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
      const bounds = await scene.d.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await expect(scene.d.locator('..').locator('..')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: info.outputPath('confirmation-focus.png') });
      await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
      await verifyOperation(page, '移回待安排', scene, true);
    });
  }

  test('刷新后立即清空备注并 Enter 保存，迟到旧读取不恢复原内容', async ({ page }) => {
    const value = content('清空备注竞态'); value.calendar.notes = '已保存的备注';
    const task = await call('POST', E, value); await open(page, task);
    const notes = page.getByRole('textbox', { name: '备注', exact: true });
    await expect(notes).toHaveValue(value.calendar.notes);
    let release, hit, delivered, reads = 0;
    const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve), finished = new Promise(resolve => delivered = resolve);
    await page.route(`**${E}/${task.id}`, async route => {
      if (route.request().method() !== 'GET' || ++reads !== 2) return route.continue(); const response = await route.fetch(); hit(); await gate; await route.fulfill({ response }); delivered();
    });
    try {
      await page.reload(); await started; await expect(notes).toHaveValue(value.calendar.notes);
      await notes.fill(''); await notes.press('Enter');
      await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).calendar.notes.trim()).toBe('');
    } finally { release(); }
    await finished;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(notes).toHaveValue(''); await expect(notes).toHaveAttribute('placeholder', '备注');
    await page.reload(); await expect(notes).toHaveValue(''); await expect(notes).toHaveAttribute('placeholder', '备注');
  });

  for (const field of ['备注', '标题']) test(`刷新读取返回时保留正在编辑${field}的光标，Enter 保存继续输入`, async ({ page }) => {
    const value = content('读取期间编辑'); value.calendar.notes = '原备注';
    const task = await call('POST', E, value); await open(page, task);
    let release, hit, delivered, reads = 0;
    const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve),
      finished = new Promise(resolve => delivered = resolve);
    await page.route(`**${E}/${task.id}`, async route => {
      if (route.request().method() !== 'GET' || ++reads !== 2) return route.continue();
      const response = await route.fetch(); hit(); await gate; await route.fulfill({ response }); delivered();
    });
    const input = field === '备注' ? page.getByRole('textbox', { name: '备注', exact: true }) : page.locator('#calendar-entry-title');
    try {
      await page.reload(); await started; await input.click(); await expect(input).toBeFocused();
    } finally { release(); }
    await finished;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(input).toBeFocused();
    await input.fill('读取后继续输入'); await input.press('Enter');
    await expect.poll(async () => {
      const saved = await call('GET', `${E}/${task.id}`);
      return field === '备注' ? saved.calendar.notes : saved.title;
    }).toBe('读取后继续输入');
    await expect(page.locator('.tbx-sheet')).toBeVisible();
  });
});

test.describe('浮层退出与键盘入口', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
      repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
      const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
      expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
    }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page }) => {
      now = '2026-09-25T06:00:00Z';
      await page.clock.setFixedTime(new Date(now));
      errors = []; page.on('pageerror', e => errors.push(e.message));
      ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-graph@example.test'));
      await loginSchedule(page, world, 'schedule-graph@example.test');
      await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
    });

  test.afterEach(async ({ context }, info) => {
      await closeScheduleWorld(context, world, errors, info);
    });

  async function action(page, name) { await scheduleAction(page, name); }

  const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];

  async function reloadOpen(page,task){await page.reload();await open(page,task.title);}

  async function named(page){const task=await call('POST',E,entry('课堂准备',{items:row()}));await reloadOpen(page,task);return task;}

  async function openDialog(page,kind){
     if(kind==='提醒')await action(page,'设置提醒');
     if(kind==='重复'){await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();}
     if(kind==='标签'){await page.getByRole('button', { name: '新标签', exact: true }).click();}
     if(kind==='待安排')await page.getByRole('button',{name:'移回待安排',exact:true}).click();
     if(kind==='移动'){await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();}
     return kind==='待安排'?page.getByRole('alertdialog',{name:'移回待安排？',exact:true}):page.getByRole('dialog',{name:{提醒:'提醒',重复:'重复',标签:'创建标签',移动:'移动事项'}[kind],exact:true});
    }

  for(const kind of ['提醒','重复','标签','待安排','移动'])for(const exit of (kind==='待安排'?['取消','Escape','背景']:['取消','叉号','Escape','背景']))test(`G1 ${kind}浮层用${exit}退出只取消浮层，父任务保持`,async({page})=>{
     const task=await named(page);const d=await openDialog(page,kind);await expect(d).toBeVisible();
     if(kind==='提醒')await d.getByLabel('分钟数',{exact:true}).fill('35');
     if(kind==='重复')await d.getByLabel('重复间隔',{exact:true}).fill('3');
     if(kind==='标签')await d.getByLabel('标签名称',{exact:true}).fill('取消不应产生的标签');
     if(exit==='取消')await d.getByRole('button',{name:'取消',exact:true}).click();
     if(exit==='叉号')await d.getByRole('button',{name:'关闭',exact:true}).click();
     if(exit==='Escape')await page.keyboard.press('Escape');
     if(exit==='背景')await page.locator('.cal-dialog-backdrop,.tbx-confirm-scrim').last().click({position:{x:8,y:8}});
     await expect(d).toHaveCount(0);await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);expect((await call('GET',L)).items).toHaveLength(0);
    });

  test('K8 未选任务时键盘快捷键切换视图，输入备注时快捷键只输入文字',async({page})=>{
     for(const [key,name]of [['d','日'],['w','周'],['m','月'],['3','3 天']]){await page.locator('.cal-toolbar h1').click();await page.keyboard.press(key);await expect(page.getByRole('button',{name:'日历视图',exact:true})).toContainText(name);}
     const task=await call('POST',E,entry('快捷键任务'));await page.goto(`${world.origin}/calendar?entry=${task.id}`);const notes=page.getByRole('textbox',{name:'备注',exact:true});await notes.click();await notes.pressSequentially('dwm123');await expect(notes).toHaveValue('dwm123');await page.keyboard.press('ControlOrMeta+s');await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('dwm123');
    });

  for(const menu of ['日历视图','重复','事项选项'])test(`K9 键盘打开${menu}后方向键进入菜单而不是停留在触发按钮`,async({page})=>{
     if(menu!=='日历视图')await named(page);const trigger=menu==='重复'?page.locator('.tbx-sheet').getByRole('button',{name:/^重复/}):page.getByRole('button',{name:menu,exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(trigger).toHaveAttribute('aria-expanded','true');await page.keyboard.press('ArrowDown');await expect.poll(async()=>page.evaluate(()=>Boolean(document.activeElement?.closest('[role=menu]')))).toBe(true);await page.keyboard.press('Escape');await expect(trigger).toBeFocused();if(menu!=='日历视图')await expect(page.locator('.tbx-sheet')).toBeVisible();
    });
});
