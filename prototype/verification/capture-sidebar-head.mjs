// Current CW48-CW51 states. Capture only after checking the state being shown.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';
import { openWorkbench } from './session.mjs';
import { activate } from './pointer-input.mjs';

const paths = evidencePaths('sidebar-head-capture');
const url = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?no-dev-chrome';
const viewports = { PC: {width:1440,height:900}, 平板: {width:768,height:1024}, 手机: {width:390,height:844} };
const browser = await chromium.launch();
const results = [];
const mobile = page => page.viewportSize().width <= 700;
async function sidebar(page) {
  if (mobile(page) && !await page.locator('.tb-sidebar').evaluate(el => el.classList.contains('is-mobile-open'))) await activate(page.locator('.tb-mobile-menu'));
}
async function list(page) { await sidebar(page); await activate(page.locator('.tb-term-button')); }
async function create(page) { await list(page); await activate(page.locator('.tb-semester-create')); }
async function edit(page, index = 0) { await list(page); await activate(page.locator('.tb-semester-edit').nth(index)); }
async function fields(page, name) {
  await page.locator('#tb-semester-name').fill(name);
  await page.locator('#tb-semester-start').fill('2027-03-01');
  await page.locator('#tb-semester-end').fill('2027-07-01');
}
const shown = (page, selector) => () => expect(page.locator(selector)).toBeVisible();
const closed = page => () => expect(page.locator('.tb-dialog')).toHaveCount(0);
async function metrics(page) {
  return page.evaluate(() => Object.fromEntries(['.tb-account-row','.tb-language-menu','.tb-semester-popover','.tb-dialog','.tb-dialog-preview'].map(selector => {
    const node = document.querySelector(selector);
    if (!node) return [selector, null];
    const r = node.getBoundingClientRect(), s = getComputedStyle(node);
    return [selector, { x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,columns:s.gridTemplateColumns }];
  })));
}

const scenarios = {
  async CW48(page, shot) {
    await shot('default', '头部默认', shown(page,'.tb-account-row'));
    if (!mobile(page)) for (const [part,selector] of [['account','.tb-account-row'],['language','.tb-language-row'],['semester','.tb-term-button']]) {
      await page.locator(selector).hover();
      await shot(`hover-${part}`, `${part} 悬停`, shown(page,selector));
    }
    await activate(page.locator('.tb-language-row'));
    await shot('language-menu', '语言菜单与当前项', async () => {
      await expect(page.locator('.tb-language-option')).toHaveCount(20);
      await expect(page.locator('.tb-language-option.is-current')).toContainText('简体中文');
    });
    await page.locator('.tb-language-option').last().scrollIntoViewIfNeeded();
    await shot('language-end', '菜单末尾可访问', shown(page,'.tb-language-option:last-child'));
    await activate(page.locator('.tb-language-option').first());
    await shot('language-selected', '选中 English', async () => {
      await expect(page.locator('.tb-language-menu')).toHaveCount(0);
      await expect(page.locator('.tb-language-row')).toHaveAttribute('aria-label','English');
    });
    await activate(page.locator('.tb-language-row'));
    await page.keyboard.press('Escape');
    await shot('language-cancelled', '取消保持语言并归还焦点', async () => {
      await expect(page.locator('.tb-language-row')).toBeFocused();
      await expect(page.locator('.tb-language-row')).toHaveAttribute('aria-label','English');
    });
    await list(page);
    await shot('semester-popover', '学期列表', shown(page,'.tb-semester-popover'));
    await activate(page.locator('.tb-semester-option').first());
    await shot('semester-selected', '切换春季学期', () => expect(page.locator('.tb-term-name')).toHaveText('2026春季学期'));
    await list(page);
    await page.keyboard.press('Escape');
    await shot('semester-cancelled', '取消保持学期并归还焦点', () => expect(page.locator('.tb-term-button')).toBeFocused());
    await activate(page.locator('.tb-language-row'));
    await page.keyboard.press('Control+k');
    await shot('search-only', '搜索与语言菜单互斥', async () => {
      await expect(page.locator('.tb-search-panel')).toBeVisible();
      await expect(page.locator('.tb-language-menu')).toHaveCount(0);
      if (mobile(page)) await expect(page.locator('.tb-sidebar')).not.toHaveClass(/is-mobile-open/);
    });
    await page.keyboard.press('Escape');
    await sidebar(page);
    await activate(page.locator('.tb-account-row'));
    await shot('settings', '账号设置客户端跳转', () => expect(page).toHaveURL(/\/settings/));
    await sidebar(page);
    await activate(page.locator('.tb-language-row'));
    await page.goBack();
    await shot('back-closed', '后退关闭浮层', async () => {
      await expect(page.locator('.tb-language-menu')).toHaveCount(0);
      await expect(page.locator('.tb-empty-page h1')).toHaveText('首页');
    });
    if (!mobile(page)) {
      await page.locator('.tb-topbar').hover();
      await activate(page.locator('.tb-sidebar-toggle'));
      await shot('rail', '窄轨隐藏头部', () => expect(page.locator('.tb-account-row')).toBeHidden());
    }
  },
  async CW49(page, shot) {
    await create(page);
    await shot('create-dialog', '创建空表单', () => expect(page.locator('#tb-semester-name')).toHaveValue(''));
    await fields(page,'待取消的学期');
    await shot('create-draft', '未提交表单', () => expect(page.locator('#tb-semester-name')).toHaveValue('待取消的学期'));
    await activate(page.locator('.tb-dialog-cancel'));
    await shot('cancelled', '取消并归还焦点', () => expect(page.locator('.tb-term-button')).toBeFocused());
    await create(page);
    await expect(page.locator('#tb-semester-name')).toHaveValue('');
    await activate(page.locator('.tb-dialog-close'));
    await list(page);
    await page.locator('.tb-semester-edit').first().focus();
    await page.keyboard.press('Enter');
    await shot('edit-dialog', '键盘编辑与字段预填', () => expect(page.locator('#tb-semester-name')).toHaveValue('2026春季学期'));
    await page.locator('#tb-semester-name').fill('保留中的修改');
    await activate(page.locator('.tb-dialog-more'));
    await shot('more-menu', '更多菜单', shown(page,'.tb-dialog-more-menu'));
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await shot('more-dismissed', '关闭更多保留输入', async () => {
      await expect(page.locator('#tb-semester-name')).toHaveValue('保留中的修改');
      await expect(page.locator('.tb-dialog-more')).toBeFocused();
    });
    await activate(page.locator('.tb-copy-source'));
    await shot('source-menu', '编辑来源菜单', shown(page,'.tb-copy-source-menu'));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Escape');
    await shot('source-dismissed', '关闭来源保留表单', () => expect(page.locator('.tb-copy-source')).toBeFocused());
    await page.keyboard.press('Escape');
    await expect(page.locator('.tb-dialog')).toHaveCount(0);
    await edit(page);
    await expect(page.locator('#tb-semester-name')).toHaveValue('2026春季学期');
    await activate(page.locator('.tb-dialog-layer'), {position:{x:2,y:2}});
    await expect(page.locator('.tb-dialog')).toHaveCount(0);
  },
  async CW50(page, shot) {
    await create(page);
    for (const [suffix,selector,value] of [['name','#tb-semester-name','2027春季学期'],['start','#tb-semester-start','2027-03-01'],['end','#tb-semester-end','2027-07-01']]) {
      await activate(page.locator('.tb-dialog-submit'));
      await shot(`required-${suffix}`, `必填 ${suffix}`, async () => {
        await expect(page.locator(selector)).toBeFocused();
        expect(await page.locator('.tb-dialog').evaluate(el => el.checkValidity())).toBe(false);
      });
      await page.locator(selector).fill(value);
    }
    await shot('create-filled', '创建字段完整', () => expect(page.locator('#tb-semester-end')).toHaveValue('2027-07-01'));
    await activate(page.locator('.tb-dialog-submit'));
    await shot('created', '创建并切换当前学期', () => expect(page.locator('.tb-term-name')).toHaveText('2027春季学期'));
    await list(page);
    await shot('list-three', '三个学期与当前项', () => expect(page.locator('.tb-semester-option')).toHaveCount(3));
    await activate(page.locator('.tb-semester-edit').last());
    await fields(page,'2027春季修订');
    await activate(page.locator('.tb-dialog-submit'));
    await shot('edited', '保存名称与日期', () => expect(page.locator('.tb-term-name')).toHaveText('2027春季修订'));
    await create(page);
    await fields(page,'复制测试');
    await activate(page.getByRole('button',{name:'从已有学期复制'}));
    await page.locator('.tb-copy-source').scrollIntoViewIfNeeded();
    await shot('copy-empty', '未选择来源', shown(page,'.tb-copy-empty'));
    await activate(page.locator('.tb-copy-source'));
    await shot('copy-sources', '复制来源列表', () => expect(page.locator('.tb-copy-source-option')).toHaveCount(3));
    await activate(page.locator('.tb-copy-source-option').first());
    await activate(page.getByRole('checkbox',{name:'班级',exact:true}));
    await shot('copy-picked', '勾选与零数量禁用', async () => {
      await expect(page.getByRole('checkbox',{name:'班级',exact:true})).toHaveAttribute('aria-checked','true');
      await expect(page.getByRole('checkbox',{name:'课堂主题',exact:true})).toBeDisabled();
    });
    await page.locator('.tb-copy-item').last().scrollIntoViewIfNeeded();
    await shot('copy-list-end', '复制清单末项', shown(page,'.tb-copy-item:last-child'));
    await activate(page.locator('.tb-copy-source'));
    await activate(page.locator('.tb-copy-source-option').nth(1));
    await shot('copy-reset', '换来源清除勾选', () => expect(page.locator('[role="checkbox"][aria-checked="true"]')).toHaveCount(0));
    await activate(page.getByRole('checkbox',{name:'班级',exact:true}));
    await activate(page.getByRole('button',{name:'从头开始'}));
    await shot('copy-to-fresh', '返回从头开始', () => expect(page.locator('.tb-copy-panel')).toHaveCount(0));
    await activate(page.locator('.tb-dialog-submit'));
    await shot('fresh-created', '不报告复制的提交', () => expect(page.locator('[aria-live]')).toHaveText('已创建 复制测试'));
    await create(page);
    await fields(page,'复制后的学期');
    await activate(page.getByRole('button',{name:'从已有学期复制'}));
    await activate(page.locator('.tb-copy-source'));
    await activate(page.locator('.tb-copy-source-option').first());
    await activate(page.getByRole('checkbox',{name:'班级',exact:true}));
    await page.locator('.tb-dialog-submit').scrollIntoViewIfNeeded();
    await shot('copy-submit', '复制内容与提交入口可访问', shown(page,'.tb-dialog-submit'));
    await activate(page.locator('.tb-dialog-submit'));
    await shot('copy-created', '复制提交反馈', () => expect(page.locator('[aria-live]')).toHaveText('已创建 复制后的学期，并复制了所选内容'));
    await openWorkbench(page,url,{dismissCoach:true});
    await sidebar(page);
    await list(page);
    await shot('reset', '刷新恢复样例列表', () => expect(page.locator('.tb-semester-option')).toHaveCount(2));
  },
  async CW51(page, shot) {
    await edit(page);
    await shot('edit-copy-empty', '编辑复制空状态', shown(page,'.tb-copy-empty'));
    const before = await metrics(page);
    await activate(page.locator('.tb-copy-source'));
    await activate(page.locator('.tb-copy-source-option').first());
    await page.waitForTimeout(220);
    if (!mobile(page)) {
      const after = await metrics(page);
      expect(after['.tb-dialog']).toEqual(before['.tb-dialog']);
      expect(after['.tb-dialog-preview']).toEqual(before['.tb-dialog-preview']);
    }
    await shot('edit-copy-selected', '选来源后布局稳定', shown(page,'.tb-copy-list'));
    await activate(page.locator('.tb-dialog-more'));
    await shot('delete-menu', '删除非当前学期', shown(page,'.tb-dialog-more-menu'));
    await activate(page.locator('.tb-dialog-more-item'));
    await expect(page.locator('.tb-term-name')).toHaveText('2026秋季学期');
    await list(page);
    await shot('remaining', '删除后只剩当前学期', () => expect(page.locator('.tb-semester-option')).toHaveCount(1));
    await activate(page.locator('.tb-semester-edit'));
    await activate(page.locator('.tb-dialog-more'));
    await shot('last-disabled', '最后一个学期禁用删除', () => expect(page.locator('.tb-dialog-more-item')).toBeDisabled());
    await page.keyboard.press('Escape');
    await expect(page.locator('.tb-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await openWorkbench(page,url,{dismissCoach:true});
    await edit(page,1);
    await activate(page.locator('.tb-dialog-more'));
    await activate(page.locator('.tb-dialog-more-item'));
    await shot('delete-current', '删除当前后选择剩余学期', () => expect(page.locator('.tb-term-name')).toHaveText('2026春季学期'));
  }
};

try {
  for (const [viewport, dimensions] of Object.entries(viewports)) for (const [id, run] of Object.entries(scenarios)) {
    const context = await browser.newContext({viewport:dimensions,hasTouch:viewport==='手机'});
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const result = {id,viewport,dimensions,input:viewport==='手机'?'touch + keyboard':'mouse + keyboard',states:[],errors:[]};
    page.on('pageerror',e=>result.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
    const shot = async (state,label,check) => {
      await check();
      await page.waitForTimeout(220);
      const file = `${viewport}-${id}-${state}.png`;
      await page.screenshot({path:`${paths.screenshots}/${file}`});
      result.states.push({state,label,file,metrics:await metrics(page)});
    };
    try {
      await openWorkbench(page,url,{dismissCoach:true});
      await sidebar(page);
      await run(page,shot);
      expect(result.errors).toEqual([]);
      result.pass=true;
      console.log(`PASS ${viewport} ${id}: ${result.states.length} states`);
    } catch(error) {
      result.pass=false;
      result.errors.push(error.message);
      console.log(`FAIL ${viewport} ${id}: ${error.message.split('\n')[0]}`);
    } finally {results.push(result);await context.close();}
  }
} finally {await browser.close();}
const pass=results.length===12 && results.every(result=>result.pass);
writeFileSync(`${paths.results}/sidebar-head-capture${pass?'':'-failed'}.json`,JSON.stringify({pass,results},null,2));
if(!pass)process.exitCode=1;
