// Checks the second round of sidebar head feedback, one assertion per reported
// problem, so a regression names the symptom it belongs to.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const paths = evidencePaths('head-round2');
const OUT = `${paths.screenshots}/`;
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch();
const checks = [];
const problems = [];

async function page() {
  const p = await browser.newPage({ viewport: { width: 1675, height: 914 } });
  p.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  p.on('pageerror', (e) => problems.push(String(e)));
  await openWorkbench(p, BASE);
  await p.click('.tb-coach-dismiss').catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

// 1. The account row must route on the client, keeping the in-memory session.
{
  const p = await page();
  await p.click('.tb-account-row');
  await p.waitForTimeout(600);
  const state = await p.evaluate(() => ({
    path: location.pathname,
    shell: !!document.querySelector('.tb-shell'),
    login: !!document.querySelector('.ae-card')
  }));
  record('账号行客户端跳转',
    state.path === '/settings' && state.shell && !state.login,
    `path=${state.path} shell=${state.shell} login=${state.login}`);
  await p.close();
}

// 2. The floating session strip must not be part of the shell.
{
  const p = await page();
  const strip = await p.locator('.ae-session').count();
  record('底部会话条已移除', strip === 0, `count=${strip}`);
  await p.close();
}

// 3. Semester dates always carry year, month and day.
{
  const p = await page();
  await p.click('.tb-term-button');
  await p.waitForTimeout(500);
  const ranges = await p.locator('.tb-semester-range').allTextContents();
  const ok = ranges.length > 0 && ranges.every((t) => /^\d{4}年\d{1,2}月\d{1,2}日 – \d{4}年\d{1,2}月\d{1,2}日$/.test(t.trim()));
  record('日期始终年月日', ok, ranges.map((t) => t.trim()).join(' | '));
  await p.screenshot({ path: `${OUT}PC-semester-popover-dates.png`, clip: { x: 0, y: 65, width: 320, height: 340 } });

  // 4. The list and the create action are separated by a rule.
  const divider = await p.evaluate(() => {
    const row = document.querySelector('.tb-semester-create-row');
    const cs = getComputedStyle(row);
    return { width: cs.borderTopWidth, color: cs.borderTopColor, style: cs.borderTopStyle };
  });
  record('列表与新建之间有分隔线',
    divider.style === 'solid' && parseFloat(divider.width) >= 1,
    `${divider.width} ${divider.style} ${divider.color}`);

  // 5. The edit action opens a real edit dialog.
  await p.hover('.tb-semester-option');
  await p.waitForTimeout(300);
  await p.click('.tb-semester-option .tb-semester-edit');
  await p.waitForTimeout(600);
  const edit = await p.evaluate(() => {
    const d = document.querySelector('.tb-dialog');
    if (!d) return null;
    return {
      title: d.querySelector('.tb-dialog-title')?.textContent.trim(),
      desc: d.querySelector('.tb-dialog-desc')?.textContent.trim(),
      submit: d.querySelector('.tb-dialog-submit')?.textContent.trim(),
      modeCards: d.querySelectorAll('.tb-mode-card').length,
      note: d.querySelector('.tb-copy-note p')?.textContent.trim() ?? null,
      name: d.querySelector('#tb-semester-name')?.value
    };
  });
  record('编辑按钮打开编辑学期',
    edit && edit.title === '编辑学期' && edit.submit === '保存更改' && edit.modeCards === 0 && !!edit.note && !!edit.name,
    edit ? `title=${edit.title} submit=${edit.submit} cards=${edit.modeCards} name=${edit.name} note=${edit.note ? 'yes' : 'no'}` : 'no dialog');
  await p.screenshot({ path: `${OUT}PC-edit-dialog.png` });
  await p.close();
}

// 6. Create dialog: close icon alignment, date inputs, spacing, icon sizing.
{
  const p = await page();
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  await p.click('.tb-semester-create');
  await p.waitForTimeout(600);

  const layout = await p.evaluate(() => {
    const d = document.querySelector('.tb-dialog');
    const close = d.querySelector('.tb-dialog-close');
    const closeIcon = close.querySelector('svg');
    const title = d.querySelector('.tb-dialog-title');
    const cards = d.querySelector('.tb-mode-cards');
    const submit = d.querySelector('.tb-dialog-submit');
    const dates = [...d.querySelectorAll('.tb-field-input[type=date]')];
    const card = d.querySelector('.tb-mode-card');
    const headIcon = d.querySelector('.tb-mode-card-head svg');
    const emptyState = d.querySelector('.tb-copy-empty');
    return {
      closeIconLeft: +closeIcon.getBoundingClientRect().x.toFixed(1),
      titleLeft: +title.getBoundingClientRect().x.toFixed(1),
      dateInputCount: dates.length,
      dateTypes: dates.map((i) => i.type),
      cardsBottom: +cards.getBoundingClientRect().bottom.toFixed(1),
      submitTop: +submit.getBoundingClientRect().top.toFixed(1),
      dialogHeight: +d.getBoundingClientRect().height.toFixed(1),
      cardHeight: +card.getBoundingClientRect().height.toFixed(1),
      iconBox: headIcon ? +headIcon.getBoundingClientRect().width.toFixed(1) : null,
      hasMore: !!d.querySelector('.tb-dialog-more')
    };
  });

  record('叉号与标题左对齐',
    Math.abs(layout.closeIconLeft - layout.titleLeft) <= 0.5,
    `icon=${layout.closeIconLeft} title=${layout.titleLeft}`);
  record('日期使用原生日期输入',
    layout.dateInputCount === 2 && layout.dateTypes.every((t) => t === 'date'),
    `${layout.dateInputCount} inputs, types=${layout.dateTypes.join(',')}`);
  record('起始方式与提交按钮间距收紧',
    Math.abs(layout.submitTop - layout.cardsBottom - 24) <= 2,
    `gap=${(layout.submitTop - layout.cardsBottom).toFixed(1)} (want 24)`);
  record('对话框高度由内容决定', Math.abs(layout.dialogHeight - 601) <= 3, `h=${layout.dialogHeight} (want 601)`);
  record('起始方式卡片高 82', Math.abs(layout.cardHeight - 82) <= 1, `h=${layout.cardHeight}`);
  record('卡片图标为 16px', layout.iconBox === 16, `w=${layout.iconBox}`);
  record('创建模式无更多按钮', layout.hasMore === false, `hasMore=${layout.hasMore}`);

  // 7. The date input rejects impossible values by construction.
  const rejected = await p.evaluate(() => {
    const input = document.querySelector('.tb-field-input[type=date]');
    input.value = '123456';
    return input.value;
  });
  record('乱填日期不成立', rejected === '', `value="${rejected}"`);

  await p.screenshot({ path: `${OUT}PC-create-dialog.png` });
  await p.click('.tb-mode-card:nth-child(2)');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}PC-create-dialog-copy.png` });
  await p.close();
}

// 8. Icon geometry: the sparkles mark in the preview must fill its 24px box.
{
  const p = await page();
  await p.click('.tb-term-button');
  await p.waitForTimeout(400);
  await p.click('.tb-semester-create');
  await p.waitForTimeout(600);
  const marks = await p.evaluate(() => {
    const out = [];
    for (const [label, selector] of [['预览星芒', '.tb-preview-mark svg'], ['编辑铅笔', '.tb-semester-edit svg'], ['学期箭头', '.tb-term-button svg:last-of-type']]) {
      const el = document.querySelector(selector);
      if (!el) { out.push({ label, missing: true }); continue; }
      const r = el.getBoundingClientRect();
      const path = el.querySelector('path, rect, circle');
      const pr = path ? path.getBoundingClientRect() : null;
      out.push({
        label,
        box: +r.width.toFixed(1),
        ink: pr ? +Math.max(pr.width, pr.height).toFixed(1) : null
      });
    }
    return out;
  });
  const sparkles = marks.find((m) => m.label === '预览星芒');
  record('星芒图标填满尺寸框', sparkles && sparkles.ink >= 18, JSON.stringify(marks));
  await p.close();
}

const failed = checks.filter((c) => !c.pass);
writeFileSync(`${paths.results}/head-round2.json`, JSON.stringify({ checks, problems }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (problems.length) console.log(`console problems: ${problems.join(' | ')}`);
console.error(`Screenshots: ${OUT}`);
await browser.close();
if (failed.length) process.exitCode = 1;
