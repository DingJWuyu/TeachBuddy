// Capture defined shell scenarios after asserting their visible states.
// Each case has a fresh context. Outputs are staged for inspection, never published automatically.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { openWorkbench, openWithLayout, dismissCoach } from './session.mjs';

const base = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';
const out = process.env.PROTOTYPE_EVIDENCE_DIR || await fs.mkdtemp(path.join(process.env.PROTOTYPE_TEMP_DIR || tmpdir(), 'workbench-'));
const resultsDir = process.env.PROTOTYPE_RESULTS_DIR || out;
await fs.mkdir(out, { recursive: true });
await fs.mkdir(resultsDir, { recursive: true });
const viewports = [
  { name: 'PC', width: 1440, height: 900 },
  { name: '平板', width: 768, height: 1024 },
  { name: '手机', width: 390, height: 844 }
];
const mobile = (page) => page.viewportSize().width <= 700;
async function sidebar(page) {
  if (mobile(page) && !(await page.locator('.tb-sidebar').evaluate((node) => node.classList.contains('is-mobile-open')))) {
    await page.locator('.tb-mobile-menu').click();
  }
}
async function panel(page, name) {
  await page.locator(`[data-surface="${name}"]`).click();
  await expect(page.locator(name === 'search' ? '.tb-search-panel' : `.tb-popover-${name}`)).toBeVisible();
}
async function rail(page) {
  await page.locator('.tb-topbar').hover();
  await page.locator('.tb-sidebar-toggle').click();
  await expect(page.locator('.tb-sidebar')).toHaveClass(/is-rail-collapsed/);
  await page.waitForTimeout(250);
}
async function hide(page, id) {
  await sidebar(page);
  const row = page.locator(`[data-drop-module="${id}"]`);
  await row.focus();
  await row.press('Delete');
  await expect(row).toHaveCount(0);
}
// Synthetic HTML drag events expose intermediate states. They do not prove touch support.
async function dragStart(page, source) {
  await page.locator(source).first().scrollIntoViewIfNeeded();
  await page.locator(source).first().evaluate((node) => {
    const b = node.getBoundingClientRect();
    window.__captureDrag = { node, transfer: new DataTransfer() };
    node.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true,
      dataTransfer: window.__captureDrag.transfer, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 }));
  });
  await expect(page.locator('.tb-drag-chip')).toBeVisible();
}
async function dragOver(page, target) {
  await page.locator(target).scrollIntoViewIfNeeded();
  await page.locator(target).evaluate((node) => {
    const b = node.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, dataTransfer: window.__captureDrag.transfer,
      clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 };
    window.__captureDrag.target = node;
    window.__captureDrag.opts = opts;
    node.dispatchEvent(new DragEvent('dragenter', opts));
    node.dispatchEvent(new DragEvent('dragover', opts));
  });
  await page.waitForTimeout(250);
}
async function dragEnd(page, drop = false) {
  await page.evaluate((commit) => {
    const { node, target, transfer, opts } = window.__captureDrag;
    if (commit) target.dispatchEvent(new DragEvent('drop', opts));
    node.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    delete window.__captureDrag;
  }, drop);
  await expect(page.locator('.tb-drag-chip')).toHaveCount(0);
}
async function emptyGroup(page) {
  for (const id of ['classes', 'timetable', 'planner']) await hide(page, id);
  await expect(page.locator('[data-drop-group="classes-group"] [data-drop-module]')).toHaveCount(0);
}
async function fillEmptyGroup(page, shot) {
  await emptyGroup(page);
  await shot('empty');
  await dragStart(page, '[data-drop-module="students"]');
  await dragOver(page, '[data-drop-group="classes-group"] .tb-group-heading');
  await expect(page.locator('[data-drop-group="classes-group"]')).toHaveClass(/is-empty-drop-target/);
  await shot('drop-target');
  await dragEnd(page, true);
  await expect(page.locator('[data-drop-group="classes-group"] [data-drop-module="students"]')).toBeVisible();
  await shot('filled');
}
async function support(page) {
  if (mobile(page)) {
    await sidebar(page);
    const trigger = page.locator('.tb-mobile-nav button');
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    await expect(page.locator('.tb-mobile-support-item')).toHaveCount(3);
  } else {
    await page.locator('[data-surface="support"]').hover();
    await expect(page.locator('.tb-support-menu')).toBeVisible();
  }
}
async function calendar(page) {
  if (mobile(page)) {
    await sidebar(page);
    await page.locator('.tb-mobile-nav a[href^="/calendar"]').click();
  } else await page.locator('.tb-global-nav a[href^="/calendar"]').click();
  await expect(page.locator('.tb-empty-page h1')).toHaveText('日历');
}
const cases = [];
function scenario(id, journey, description, run, applies = () => true) {
  cases.push({ id, journey, description, run, applies });
}
const wide = (v) => v.width > 700;
const narrow = (v) => v.width <= 700;
scenario('CW01', 'shell', '登录后关闭引导，查看默认外壳', async (p, shot) => {
  await expect(p.locator('.tb-dashboard-grid')).toBeVisible(); await shot('default');
});
scenario('CW02', 'shell', '悬停顶栏，收起侧栏，再展开', async (p, shot) => {
  await rail(p); await shot('rail');
  await p.locator('.tb-sidebar-toggle').click();
  await expect(p.locator('.tb-sidebar')).not.toHaveClass(/is-rail-collapsed/); await shot('expanded');
}, wide);
scenario('CW03', 'shell', '悬停侧栏收起键', async (p, shot) => {
  await p.locator('.tb-topbar').hover(); await p.locator('.tb-sidebar-toggle').hover(); await shot('hover');
}, wide);
scenario('CW04', 'shell', '收起侧栏，悬停及聚焦第二个模块，名称完整可见', async (p, shot) => {
  await rail(p); const row = p.locator('[data-drop-module]').nth(1); await row.hover();
  await expect(p.locator('.tb-rail-tooltip')).toHaveText('课程表'); await shot('hover');
  await p.mouse.move(500, 400); await row.focus();
  await expect(p.locator('.tb-rail-tooltip')).toBeVisible(); await shot('focus');
}, wide);
scenario('CW05', 'navigation', '悬停顶栏日历入口', async (p, shot) => {
  await p.locator('.tb-global-nav a[href^="/calendar"]').hover(); await shot('hover');
}, wide);
scenario('CW06', 'navigation', '打开支持菜单或手机抽屉中的支持条目', async (p, shot) => { await support(p); await shot('open'); });
scenario('CW07', 'navigation', '打开搜索，保留空查询', async (p, shot) => {
  await panel(p, 'search'); await expect(p.locator('.tb-search-input')).toBeFocused(); await shot('open');
});
for (const [id, name, desc] of [['CW08','notifications','初始通知列表'],['CW09','feedback','空反馈表单'],['CW10','tutorial','未完成教程列表'],['CW11','privacy','隐私面板']]) {
  scenario(id, 'topbar', desc, async (p, shot) => { await panel(p, name); await shot('open'); });
}
scenario('CW12', 'topbar', '新标签页首次引导，关闭后不重放', async (p, shot) => {
  await expect(p.locator('.tb-coach')).toBeVisible(); await shot('coach');
  await dismissCoach(p); await expect(p.locator('.tb-coach')).toHaveCount(0); await shot('dismissed');
  await openWorkbench(p, p.url()); await expect(p.locator('.tb-coach')).toHaveCount(0);
});
scenario('CW13', 'topbar', '完成所有教程，关闭庆祝，再撤销一项', async (p, shot) => {
  await panel(p, 'tutorial');
  for (const row of await p.locator('.tb-popover-tutorial .tb-row').all()) await row.click();
  await expect(p.locator('.tb-celebration-card')).toBeVisible(); await shot('celebration');
  await p.locator('.tb-celebration-card button').click();
  await panel(p, 'tutorial');
  await p.locator('.tb-popover-tutorial .tb-row').first().click();
  await expect(p.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow','8'); await shot('undone');
});
scenario('CW14', 'shell', '手机打开抽屉，Escape 关闭', async (p, shot) => {
  await sidebar(p); await expect(p.locator('.tb-sidebar')).toHaveClass(/is-mobile-open/); await shot('drawer');
  await p.keyboard.press('Escape'); await expect(p.locator('.tb-sidebar')).not.toHaveClass(/is-mobile-open/); await shot('closed');
}, narrow);
scenario('CW15', 'sidebar', 'Delete 隐藏模块，打开垃圾桶，恢复到未分组', async (p, shot) => {
  await hide(p,'planner'); await p.locator('[data-trash-toggle]').click();
  await expect(p.locator('.tb-hidden-panel')).toContainText('规划器'); await shot('hidden');
  await p.locator('.tb-hidden-panel button').filter({hasText:'规划器'}).click();
  await expect(p.locator('[data-drop-group="ungrouped"] [data-drop-module="planner"]')).toBeVisible(); await shot('restored');
});
scenario('CW16', 'sidebar', '新建分组空值、填写、取消、重新打开并提交', async (p, shot) => {
  await sidebar(p); await p.locator('[data-new-group-toggle]').click();
  await expect(p.locator('.tb-new-group-form')).toBeVisible(); await shot('empty');
  await p.locator('.tb-new-group-form input').fill('复习安排'); await shot('filled');
  await p.keyboard.press('Escape'); await expect(p.locator('.tb-new-group-form')).toHaveCount(0);
  await p.locator('[data-new-group-toggle]').click(); await p.locator('.tb-new-group-form input').fill('复习安排');
  await p.locator('.tb-new-group-form input').press('Enter');
  await expect(p.locator('.tb-group-heading').filter({hasText:'复习安排'})).toBeVisible(); await shot('created');
});
scenario('CW17', 'sidebar', '模块拖到另一分组首行，插入线与落点一致', async (p, shot) => {
  await sidebar(p); await dragStart(p,'[data-drop-module="classes"]');
  await dragOver(p,'[data-drop-module="lessons"]');
  await expect(p.locator('.is-drop-target')).not.toHaveCount(0); await shot('target');
  await dragEnd(p,true); await expect(p.locator('[data-drop-group="planning-group"] [data-drop-module="classes"]')).toBeVisible(); await shot('dropped');
});
scenario('CW18', 'topbar', '初始通知未读数与三条消息一致', async (p, shot) => {
  await panel(p,'notifications'); await expect(p.locator('.tb-notification')).toHaveCount(3);
  await expect(p.locator('[data-surface="notifications"]')).toHaveAttribute('aria-label','通知，2 条未读'); await shot('initial');
});
scenario('CW19', 'navigation', '日历、后退首页、前进日历', async (p, shot) => {
  await calendar(p); await shot('calendar'); await p.goBack();
  await expect(p.locator('.tb-dashboard-grid')).toBeVisible(); await shot('back');
  await p.goForward(); await expect(p.locator('.tb-empty-page h1')).toHaveText('日历'); await shot('forward');
});
scenario('CW20', 'navigation', '从模块行进入我的班级页', async (p, shot) => {
  await sidebar(p); await p.locator('[data-drop-module="classes"]').click();
  await expect(p.locator('.tb-empty-page h1')).toHaveText('我的班级'); await shot('module');
});
scenario('CW21', 'topbar', '标已读、撤销、全部已读', async (p, shot) => {
  await panel(p,'notifications'); const row=p.locator('.tb-notification').first();
  await row.click(); await expect(row).toHaveClass(/is-read/); await shot('read');
  await row.click(); await expect(row).not.toHaveClass(/is-read/); await shot('unread');
  await p.getByRole('button',{name:'全部已读',exact:true}).click();
  await expect(p.locator('.tb-notification.is-read')).toHaveCount(3); await shot('all-read');
});
scenario('CW22', 'topbar', '已读通知拖入删除区，取消，然后再次拖入删除', async (p, shot) => {
  await panel(p,'notifications'); await dragStart(p,'.tb-notification.is-read');
  await dragOver(p,'.tb-notification-trash'); await expect(p.locator('.tb-popover-notifications')).toHaveClass(/is-over-trash/); await shot('target');
  await dragEnd(p); await expect(p.locator('.tb-notification')).toHaveCount(3); await shot('cancelled');
  await dragStart(p,'.tb-notification.is-read'); await dragOver(p,'.tb-notification-trash'); await dragEnd(p,true);
  await expect(p.locator('.tb-notification')).toHaveCount(2); await shot('deleted');
});
scenario('CW23', 'sidebar', '模块拖拽图居中，取消后清理', async (p, shot) => {
  await sidebar(p); await dragStart(p,'[data-drop-module="planner"]'); await shot('chip');
  await dragEnd(p); await shot('cancelled');
});
scenario('CW24', 'sidebar', '分组拖拽图使用文件夹，取消后清理', async (p, shot) => {
  await sidebar(p); await dragStart(p,'[data-drop-group="classes-group"] .tb-group-heading'); await shot('chip');
  await dragEnd(p); await shot('cancelled');
});
scenario('CW25', 'sidebar', '模块拖入垃圾桶，取消保持，重新拖入隐藏', async (p, shot) => {
  await sidebar(p); await dragStart(p,'[data-drop-module="planner"]'); await dragOver(p,'.tb-trash-target');
  await expect(p.locator('.tb-trash-target')).toHaveClass(/is-drop-target/); await shot('target');
  await dragEnd(p); await expect(p.locator('[data-drop-module="planner"]')).toBeVisible(); await shot('cancelled');
  await dragStart(p,'[data-drop-module="planner"]'); await dragOver(p,'.tb-trash-target'); await dragEnd(p,true);
  await expect(p.locator('[data-drop-module="planner"]')).toHaveCount(0); await shot('hidden');
});
scenario('CW26', 'sidebar', '隐藏三项，垃圾桶逐项恢复至空', async (p, shot) => {
  for(const id of ['classes','timetable','planner']) await hide(p,id);
  await p.locator('[data-trash-toggle]').click(); await expect(p.locator('.tb-hidden-panel button')).toHaveCount(3); await shot('items');
  for(let i=0;i<3;i++) await p.locator('.tb-hidden-panel button').first().click();
  await expect(p.locator('.tb-hidden-panel button')).toHaveCount(0); await shot('empty');
});
scenario('CW27', 'sidebar', '空分组在落下前高亮，落下后包含新模块', fillEmptyGroup);
scenario('CW28', 'topbar', '填写并发送反馈，关闭致谢，重新打开为空', async (p, shot) => {
  await panel(p,'feedback'); await p.locator('.tb-feedback-body').fill('请保留我的工作台分组。');
  await expect(p.locator('.tb-feedback-foot button')).toBeEnabled(); await shot('filled');
  await p.locator('.tb-feedback-foot button').click(); await expect(p.locator('.tb-feedback-sent')).toBeVisible(); await shot('sent');
  await p.locator('.tb-feedback-dismiss').click(); await panel(p,'feedback');
  await expect(p.locator('.tb-feedback-body')).toHaveValue(''); await shot('reset');
});
scenario('CW29', 'topbar', '全部标已读，再逐项删除到空列表', async (p, shot) => {
  await panel(p,'notifications'); await p.getByRole('button',{name:'全部已读',exact:true}).click();
  for(let i=0;i<3;i++){await dragStart(p,'.tb-notification.is-read');await dragOver(p,'.tb-notification-trash');await dragEnd(p,true);}
  await expect(p.locator('.tb-notification')).toHaveCount(0); await shot('empty');
});
scenario('CW30', 'sidebar', '删除分组后成员进入垃圾桶，恢复成员不重建分组', async (p, shot) => {
  await sidebar(p); await dragStart(p,'[data-drop-group="assessment-group"] .tb-group-heading');
  await dragOver(p,'.tb-trash-target'); await shot('target'); await dragEnd(p,true);
  await expect(p.locator('[data-drop-group="assessment-group"]')).toHaveCount(0);
  await p.locator('[data-trash-toggle]').click(); await expect(p.locator('.tb-hidden-panel button')).toHaveCount(3); await shot('deleted');
  await p.locator('.tb-hidden-panel button').filter({hasText:'成绩'}).click();
  await expect(p.locator('[data-drop-group="ungrouped"] [data-drop-module="grades"]')).toBeVisible(); await shot('restored');
});
scenario('CW31', 'sidebar', '模块落入空分组后刷新仍保留', async (p, shot) => {
  await fillEmptyGroup(p, async()=>{}); await shot('filled'); await openWorkbench(p,p.url()); await sidebar(p);
  await expect(p.locator('[data-drop-group="classes-group"] [data-drop-module="students"]')).toBeVisible(); await shot('reloaded');
});
scenario('CW32', 'sidebar', '正在浏览的模块被隐藏时回首页', async (p, shot) => {
  await sidebar(p); await p.locator('[data-drop-module="lessons"]').click(); await expect(p.locator('.tb-empty-page h1')).toHaveText('课程'); await shot('page');
  await hide(p,'lessons'); await expect(p.locator('.tb-dashboard-grid')).toBeVisible(); await shot('home');
});
scenario('CW33', 'sidebar', '折叠与展开分组，内容退出和恢复键盘可达', async (p, shot) => {
  await sidebar(p); const group=p.locator('[data-drop-group="classes-group"]'); await shot('expanded');
  await group.locator('.tb-group-toggle').click(); await expect(group.locator('.tb-module-clip')).toHaveAttribute('inert',''); await shot('collapsed');
  await group.locator('.tb-group-toggle').click(); await expect(group.locator('.tb-module-clip')).not.toHaveAttribute('inert',''); await shot('reopened');
});
scenario('CW34', 'sidebar', '隐藏布局在刷新与日历深链保留', async (p, shot) => {
  await hide(p,'planner'); await shot('changed'); await openWorkbench(p,p.url()); await sidebar(p);
  await expect(p.locator('[data-drop-module="planner"]')).toHaveCount(0); await shot('reloaded');
  await openWorkbench(p,new URL('/calendar'+new URL(base).search,base).href); await expect(p.locator('.tb-empty-page h1')).toHaveText('日历');
  await sidebar(p); await expect(p.locator('[data-drop-module="planner"]')).toHaveCount(0); await shot('deep-link');
});
scenario('CW35', 'navigation', '搜索无匹配、改为有效查询、键盘进入结果', async (p, shot) => {
  await panel(p,'search'); await p.locator('.tb-search-input').fill('不存在的内容');
  await expect(p.locator('.tb-search-empty')).toBeVisible(); await shot('empty');
  await p.locator('.tb-search-input').fill('学生'); await expect(p.locator('.tb-search-item').first()).toBeVisible(); await shot('results');
  await p.locator('.tb-search-input').press('Enter'); await expect(p.locator('.tb-empty-page h1')).toHaveText('学生'); await shot('destination');
});
scenario('CW36', 'navigation', '未知地址保留路径并显示不存在页面', async (p, shot) => {
  await openWorkbench(p,new URL('/not-a-page'+new URL(base).search,base).href); await expect(p.locator('.tb-empty-page h1')).toHaveText('页面不存在'); await shot('unknown');
  await openWorkbench(p,new URL('/modules/not-a-module'+new URL(base).search,base).href); await expect(p.locator('.tb-empty-page h1')).toHaveText('页面不存在'); await shot('unknown-module');
});

scenario('CW40', 'sidebar', '损坏或残缺的持久化布局整份回落默认', async (p, shot) => {
  await openWithLayout(p, base, key => localStorage.setItem(key, '{broken'));
  await expect(p.locator('[data-drop-module]')).toHaveCount(9); await sidebar(p); await shot('invalid-json');
  await openWithLayout(p, base, key => localStorage.setItem(key, JSON.stringify({version:1,layout:{groups:[{id:'ungrouped',name:'未分组',moduleIds:[]}],hiddenModuleIds:[]}})));
  await expect(p.locator('[data-drop-module]')).toHaveCount(9); await sidebar(p); await shot('missing-modules');
  await p.evaluate(()=>{const key='teachbuddy-prototype-layout';const value=JSON.parse(localStorage.getItem(key));value.layout.groups[0].moduleIds.push('classes');localStorage.setItem(key,JSON.stringify(value));});
  await openWorkbench(p,p.url());await expect(p.locator('[data-drop-module]')).toHaveCount(9);await sidebar(p);await shot('duplicate-module');
});
scenario('CW37', 'topbar', '反馈空白禁用、四种分类、取消清空', async (p, shot) => {
  await panel(p,'feedback'); await p.locator('.tb-feedback-body').fill('   '); await expect(p.locator('.tb-feedback-foot button')).toBeDisabled(); await shot('blank');
  for(const type of ['建议','错误报告','问题','赞扬']) {
    const chip=p.getByRole('button',{name:type,exact:true});await chip.click();await expect(chip).toHaveAttribute('aria-pressed','true');await shot(`type-${['建议','错误报告','问题','赞扬'].indexOf(type)}`);
  }
  await p.keyboard.press('Escape'); await expect(p.locator('[data-surface="feedback"]')).toBeFocused(); await shot('cancelled');
});
scenario('CW38', 'shell', '面板互斥、Escape 焦点恢复、外部点击关闭', async (p, shot) => {
  await panel(p,'notifications'); await panel(p,'feedback'); await expect(p.locator('.tb-popover-notifications')).toHaveCount(0); await shot('switched');
  await p.keyboard.press('Escape'); await expect(p.locator('[data-surface="feedback"]')).toBeFocused(); await shot('focus');
  await panel(p,'privacy'); await p.locator('.tb-main').click({position:{x:10,y:10}}); await expect(p.locator('.tb-popover-privacy')).toHaveCount(0); await shot('outside');
});
scenario('CW39', 'shell', '减少动态效果时面板与折叠直接到终态', async (p, shot) => {
  await p.emulateMedia({reducedMotion:'reduce'}); await panel(p,'notifications');
  expect(await p.locator('.tb-popover').evaluate(n=>getComputedStyle(n).animationName)).toBe('none'); await shot('panel');
  await p.keyboard.press('Escape'); await sidebar(p); await p.locator('.tb-group-toggle').first().click();
  expect(await p.locator('.tb-module-collapse').first().evaluate(n=>getComputedStyle(n).transitionDuration)).toBe('0s'); await shot('collapsed');
});

scenario('CW41', 'sidebar', '分组菜单、空名称拒绝、取消、重命名与移到未分组', async (p, shot) => {
  await sidebar(p);
  const group=p.locator('[data-drop-group="classes-group"]');
  const menu=async()=>{await group.locator('.tb-group-heading').click({button:'right'});await expect(p.locator('.tb-context-menu')).toBeVisible();};
  await menu();await shot('menu');await p.keyboard.press('Escape');
  await expect(p.locator('.tb-context-menu')).toHaveCount(0);
  if(mobile(p)) await expect(p.locator('.tb-sidebar')).toHaveClass(/is-mobile-open/);
  await menu();
  await p.getByRole('menuitem',{name:'重命名分组',exact:true}).click();
  const input=group.locator('input');await input.fill('   ');await input.press('Enter');
  await expect(input).toBeVisible();await shot('blank');
  await input.fill('取消的名字');await input.press('Escape');
  await expect(input).toHaveCount(0);await expect(group.locator('.tb-group-label')).toHaveText('班级');
  if(mobile(p)) await expect(p.locator('.tb-sidebar')).toHaveClass(/is-mobile-open/);
  await shot('cancelled');
  await menu();await p.getByRole('menuitem',{name:'重命名分组',exact:true}).click();
  await group.locator('input').fill('  教学安排  ');await group.locator('input').press('Enter');
  await expect(group.locator('.tb-group-label')).toHaveText('教学安排');await shot('renamed');
  await menu();await p.getByRole('menuitem',{name:'移到未分组',exact:true}).click();
  await expect(group).toHaveCount(0);await expect(p.locator('[data-drop-group="ungrouped"] [data-drop-module]')).toHaveCount(3);await shot('ungrouped');
});
scenario('CW42', 'sidebar', '键盘调整模块顺序与分组，边界保持原位', async (p, shot) => {
  await sidebar(p);
  const row=p.locator('[data-drop-module="classes"]');
  await row.focus();await row.press('Alt+ArrowUp');
  await expect(p.locator('[data-drop-group="classes-group"] [data-drop-module]').first()).toHaveAttribute('data-drop-module','classes');await shot('boundary');
  await row.press('Alt+ArrowDown');
  await expect(p.locator('[data-drop-group="classes-group"] [data-drop-module]').nth(1)).toHaveAttribute('data-drop-module','classes');await shot('reordered');
  await row.press('Alt+ArrowRight');
  await expect(p.locator('[data-drop-group="planning-group"] [data-drop-module="classes"]')).toBeVisible();await shot('next-group');
  await row.focus();await row.press('Alt+ArrowLeft');
  await expect(p.locator('[data-drop-group="classes-group"] [data-drop-module="classes"]')).toBeVisible();await shot('returned');
});
scenario('CW43', 'sidebar', '垃圾桶模块拖出时取消保持，再拖入指定分组恢复', async (p, shot) => {
  await hide(p,'planner');await p.locator('[data-trash-toggle]').click();
  const source='.tb-hidden-panel button';
  await dragStart(p,source);await dragOver(p,'[data-drop-module="lessons"]');await shot('target');
  await dragEnd(p);await expect(p.locator(source)).toHaveCount(1);await shot('cancelled');
  await dragStart(p,source);await dragOver(p,'[data-drop-module="lessons"]');await dragEnd(p,true);
  await expect(p.locator('[data-drop-group="planning-group"] [data-drop-module="planner"]')).toBeVisible();
  await expect(p.locator(source)).toHaveCount(0);await shot('restored');
});
scenario('CW44', 'navigation', '支持菜单三个目的地均可到达，导航关闭菜单', async (p, shot) => {
  for(const [route,title] of [['settings','设置'],['help','帮助'],['changelog','更新日志']]) {
    await support(p);
    const link=p.locator(mobile(p)?'.tb-mobile-support-item':'.tb-support-menu [role="menuitem"]').filter({hasText:title});
    await expect(link).toHaveAttribute('href',new RegExp('^/'+route));await link.click();
    await expect(p.locator('.tb-empty-page h1')).toHaveText(title);
    await expect(p.locator('.tb-support-menu')).toHaveCount(0);await shot(route);
  }
});
scenario('CW45', 'sidebar', '分组拖动取消保持，再调整分组顺序', async (p, shot) => {
  await sidebar(p);
  const source='[data-drop-group="assessment-group"] .tb-group-heading';
  const target='[data-drop-group="classes-group"] .tb-group-heading';
  await dragStart(p,source);await dragOver(p,target);await shot('target');await dragEnd(p);
  await expect(p.locator('[data-drop-group]').first()).toHaveAttribute('data-drop-group','classes-group');await shot('cancelled');
  await dragStart(p,source);await dragOver(p,target);await dragEnd(p,true);
  await expect(p.locator('[data-drop-group]').first()).toHaveAttribute('data-drop-group','assessment-group');await shot('reordered');
});
scenario('CW46', 'navigation', '搜索快捷键打开与关闭、方向键循环及无匹配 Enter 保持', async (p, shot) => {
  await p.keyboard.press('Control+k');await expect(p.locator('.tb-search-input')).toBeFocused();await shot('open');
  await p.locator('.tb-search-input').press('ArrowUp');
  await expect(p.locator('.tb-search-item').last()).toHaveClass(/is-active/);await shot('last');
  await p.locator('.tb-search-input').press('ArrowDown');
  await expect(p.locator('.tb-search-item').first()).toHaveClass(/is-active/);await shot('first');
  await p.locator('.tb-search-input').fill('不存在的内容');
  await p.locator('.tb-search-input').press('Enter');await expect(p.locator('.tb-search-panel')).toBeVisible();await shot('empty');
  await p.keyboard.press('Control+k');await expect(p.locator('.tb-search-panel')).toHaveCount(0);await shot('closed');
});

const arg=process.argv.find(a=>a.startsWith('--only='));
const only=arg?.slice(7).split(',');
if(only?.some(id=>!cases.some(c=>c.id===id))) throw new Error('Unknown scenario ID in --only');
const browser=await chromium.launch();
const rows=[];
try {
  for(const viewport of viewports) for(const c of cases.filter(c=>!only||only.includes(c.id))) {
    const row={id:c.id,journey:c.journey,description:c.description,viewport:viewport.name,width:viewport.width,height:viewport.height,screenshots:[],status:'passed'};
    if(!c.applies(viewport)){rows.push({...row,status:'not-applicable',reason:viewport.width<=700?'手机使用抽屉，无桌面窄轨或顶栏导航悬停入口':'宽屏使用常驻侧栏，无手机抽屉'});continue;}
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
    const p=await context.newPage();p.setDefaultTimeout(5000);
    const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    try {
      await openWorkbench(p,base,{dismissCoach:c.id!=='CW12'});await p.evaluate(()=>document.fonts.ready);
      if (mobile(p)) await expect(p.locator('.tb-sidebar-toggle')).toBeHidden();
      await c.run(p,async(state)=>{
        await p.waitForTimeout(280);
        expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow').toBe(true);
        for (const surface of await p.locator('.tb-popover, .tb-search-panel, .tb-rail-tooltip').all()) {
          const rect=await surface.boundingBox();
          if(rect) {
            expect(rect.x,'surface left edge').toBeGreaterThanOrEqual(0);
            expect(rect.x+rect.width,'surface right edge').toBeLessThanOrEqual(viewport.width+1);
          }
        }
        const file=`${c.journey}/${viewport.name}-${c.id}-${state}.png`;
        await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});
        await p.screenshot({path:path.join(out,file),animations:'disabled'});row.screenshots.push(file);
      });
      expect(errors).toEqual([]);expect(row.screenshots.length).toBeGreaterThan(0);
      console.log(`PASS ${viewport.name} ${c.id}`);
    } catch(e){row.status='failed';row.error=e.message;console.log(`FAIL ${viewport.name} ${c.id}: ${e.message.split('\n')[0]}`);}
    finally {rows.push(row);await context.close();}
  }
} finally {await browser.close();}
const report={suite:'workbench-scenarios',scope:only||'all',input:'浏览器鼠标、键盘与合成 HTML 拖放；非真机触控',results:rows};
await fs.writeFile(path.join(resultsDir,`workbench${only?'-partial':''}.json`),JSON.stringify(report,null,2)+'\n');
const failed=rows.filter(r=>r.status==='failed');
console.log(`${rows.filter(r=>r.status==='passed').length} passed, ${failed.length} failed, ${rows.filter(r=>r.status==='not-applicable').length} layout-inapplicable. Evidence: ${out}`);
if(failed.length)process.exitCode=1;
