// Verifies that creating, editing and copying a semester actually change the
// prototype's state, and that the form still enforces its required fields.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const paths = evidencePaths('semester-actions');
const OUT = `${paths.screenshots}/`;
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch();
const checks = [];
const problems = [];

const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

async function fresh() {
  const p = await browser.newPage({ viewport: { width: 1675, height: 914 } });
  p.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  p.on('pageerror', (e) => problems.push(String(e)));
  await openWorkbench(p, BASE);
  await p.click('.tb-coach-dismiss').catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

// 1. Creating a semester adds it, switches to it, and announces it.
{
  const p = await fresh();
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  await p.click('.tb-semester-create');
  await p.waitForTimeout(500);

  // Empty submit must be blocked by the form's own required rules.
  await p.click('.tb-dialog-submit');
  await p.waitForTimeout(300);
  const blocked = await p.evaluate(() => ({
    open: !!document.querySelector('.tb-dialog'),
    valid: document.querySelector('.tb-dialog')?.checkValidity()
  }));
  record('空表单被校验拦住', blocked.open === true && blocked.valid === false,
    `dialogOpen=${blocked.open} formValid=${blocked.valid}`);

  await p.fill('#tb-semester-name', '2027春季学期');
  await p.fill('#tb-semester-start', '2027-03-01');
  await p.fill('#tb-semester-end', '2027-07-10');
  await p.screenshot({ path: `${OUT}PC-create-filled.png` });
  await p.click('.tb-dialog-submit');
  await p.waitForTimeout(600);

  const after = await p.evaluate(() => ({
    dialogOpen: !!document.querySelector('.tb-dialog'),
    active: document.querySelector('.tb-term-name')?.textContent.trim(),
    announcement: document.querySelector('.tb-announcer')?.textContent.trim()
  }));
  record('创建后对话框关闭', after.dialogOpen === false, `open=${after.dialogOpen}`);
  record('创建后切为新学期', after.active === '2027春季学期', `active=${after.active}`);
  record('创建后被播报', (after.announcement ?? '').includes('2027春季学期'), `announce=${after.announcement}`);

  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  const listed = await p.locator('.tb-semester-name').allTextContents();
  const ranges = await p.locator('.tb-semester-range').allTextContents();
  record('新学期出现在列表中', listed.length === 3 && listed.includes('2027春季学期'), listed.join(' | '));
  record('新学期日期完整', ranges.some((t) => t.includes('2027年3月1日') && t.includes('2027年7月10日')), ranges.join(' | '));
  await p.screenshot({ path: `${OUT}PC-semester-list-three.png`, clip: { x: 0, y: 65, width: 320, height: 400 } });
  await p.close();
}

// 2. Editing a semester updates it in place.
{
  const p = await fresh();
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  await p.click('.tb-semester-option:first-child .tb-semester-edit');
  await p.waitForTimeout(500);
  await p.fill('#tb-semester-name', '2026春季学期（已改名）');
  await p.click('.tb-dialog-submit');
  await p.waitForTimeout(600);

  const after = await p.evaluate(() => ({
    dialogOpen: !!document.querySelector('.tb-dialog'),
    announcement: document.querySelector('.tb-announcer')?.textContent.trim()
  }));
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  const listed = await p.locator('.tb-semester-name').allTextContents();
  record('编辑就地生效', listed.includes('2026春季学期（已改名）') && listed.length === 2, listed.join(' | '));
  record('编辑后对话框关闭并被播报',
    after.dialogOpen === false && (after.announcement ?? '').includes('已保存'),
    `announce=${after.announcement}`);
  await p.close();
}

// 3. Copy source selection drives the copy list.
{
  const p = await fresh();
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  await p.click('.tb-semester-create');
  await p.waitForTimeout(500);
  await p.click('.tb-mode-card:nth-child(2)');
  await p.waitForTimeout(400);

  const beforePick = await p.evaluate(() => ({
    empty: !!document.querySelector('.tb-copy-empty'),
    items: document.querySelectorAll('.tb-copy-item').length
  }));
  record('未选来源时是空状态', beforePick.empty && beforePick.items === 0,
    `empty=${beforePick.empty} items=${beforePick.items}`);

  await p.click('.tb-copy-source');
  await p.waitForTimeout(400);
  const options = await p.locator('.tb-copy-source-option').allTextContents();
  record('来源可选', options.length === 2, options.join(' | '));
  await p.screenshot({ path: `${OUT}PC-copy-source-menu.png` });

  await p.click('.tb-copy-source-option:first-child');
  await p.waitForTimeout(500);
  const afterPick = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.tb-copy-item')];
    return {
      label: document.querySelector('.tb-copy-source span')?.textContent.trim(),
      count: items.length,
      names: items.map((i) => i.querySelector('.tb-copy-item-name')?.textContent.trim()),
      pills: items.map((i) => i.querySelector('.tb-copy-item-count')?.textContent.trim()),
      disabled: items.map((i) => !!i.querySelector('.tb-checkbox')?.disabled),
      note: document.querySelector('.tb-copy-note p')?.textContent.trim()
    };
  });
  record('选来源后列出复制内容', afterPick.count === 6 && afterPick.label === '2026春季学期',
    `label=${afterPick.label} count=${afterPick.count}`);
  record('数量胶囊与名称齐全',
    afterPick.pills[0] === '2 个班级' && afterPick.names[0] === '班级',
    `${afterPick.names?.[0]} / ${afterPick.pills?.[0]}`);
  record('零数量行禁用', afterPick.disabled.filter(Boolean).length === 1,
    `disabled=${JSON.stringify(afterPick.disabled)}`);
  record('选来源后提示改为复制说明', (afterPick.note ?? '').includes('共享而非复制'), afterPick.note?.slice(0, 40));

  await p.click('.tb-copy-item .tb-checkbox');
  await p.waitForTimeout(300);
  const toggled = await p.evaluate(() => {
    const box = document.querySelector('.tb-copy-item .tb-checkbox');
    return { checked: box.getAttribute('aria-checked'), classes: box.className };
  });
  record('复制项可勾选', toggled.checked === 'true' && toggled.classes.includes('is-checked'),
    `aria-checked=${toggled.checked}`);
  await p.screenshot({ path: `${OUT}PC-copy-content-picked.png` });

  // Finish the create so the copied selection is exercised end to end.
  await p.fill('#tb-semester-name', '2027秋季学期');
  await p.fill('#tb-semester-start', '2027-09-01');
  await p.fill('#tb-semester-end', '2028-01-15');
  await p.click('.tb-dialog-submit');
  await p.waitForTimeout(600);
  const announced = await p.evaluate(() => document.querySelector('.tb-announcer')?.textContent.trim());
  record('带复制创建被播报', (announced ?? '').includes('复制了所选内容'), `announce=${announced}`);
  await p.close();
}

// 4. The amber note stays for an edit with no source chosen.
{
  const p = await fresh();
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  await p.click('.tb-semester-option:first-child .tb-semester-edit');
  await p.waitForTimeout(500);
  const tone = await p.evaluate(() => {
    const note = document.querySelector('.tb-copy-note');
    return { classes: note?.className, text: note?.querySelector('p')?.textContent.trim() };
  });
  record('编辑态未选来源时是琥珀提示',
    (tone.classes ?? '').includes('is-warn') && (tone.text ?? '').includes('现有数据不会被移除'),
    `${tone.classes}`);
  await p.close();
}

const failed = checks.filter((c) => !c.pass);
writeFileSync(`${paths.results}/semester-actions.json`, JSON.stringify({ checks, problems }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (problems.length) console.log(`console problems: ${problems.join(' | ')}`);
console.error(`Screenshots: ${OUT}`);
await browser.close();
if (failed.length) process.exitCode = 1;
