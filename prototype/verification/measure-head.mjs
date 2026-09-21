// Measures the reworked sidebar head in the package app and prints it beside the
// values recorded from the reference, so drift is visible at a glance.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const paths = evidencePaths('head-measure');
const OUT = `${paths.screenshots}/`;
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';

// Values measured on the real signed-in reference (see reference/emstudio-sidebar-head.md).
const REFERENCE = {
  accountRow: { w: 183.33, h: 40, x: 16, radius: '6px', padding: '4px', gap: '12px' },
  accountName: { fontSize: '14px', fontWeight: '500', lineHeight: '20px', color: 'rgb(45, 48, 55)' },
  avatar: { w: 32, h: 32, radius: '50%' },
  languageButton: { w: 32, h: 32, radius: '6px' },
  languageFlag: { w: 14, h: 14, ring: '2px' },
  semesterButton: { w: 231.33, h: 36, x: 12, radius: '6px', padding: '0px 10px', gap: '6px' },
  languageMenu: { w: 256, h: 321.33, radius: '12px' },
  languageOption: { h: 49, padding: '12px 16px', gap: '12px' },
  languageFlagIcon: { w: 24, h: 24, radius: '50%' },
  semesterPopover: { w: 280, h: 184, radius: '6px' },
  semesterOption: { h: 56, padding: '8px 10px', radius: '6px' },
  semesterEdit: { w: 28, h: 28, radius: '6px' },
  dialog: { w: 1000, h: 601, radius: '8px', left: 380 }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1675, height: 858 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(String(e)));
await openWorkbench(page, BASE);
await page.click('.tb-coach-dismiss').catch(() => {});
await page.waitForTimeout(400);

const measure = () => page.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      w: +b.width.toFixed(2), h: +b.height.toFixed(2), x: +b.x.toFixed(2), y: +b.y.toFixed(2),
      radius: cs.borderRadius, padding: cs.padding, gap: cs.gap, background: cs.backgroundColor,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, color: cs.color,
      boxShadow: cs.boxShadow.slice(0, 60), opacity: cs.opacity
    };
  };
  const menu = document.querySelector('.tb-language-menu');
  const popover = document.querySelector('.tb-semester-popover');
  const dialog = document.querySelector('.tb-dialog');
  return {
    accountRow: r(document.querySelector('.tb-account-row')),
    accountName: r(document.querySelector('.tb-account-name')),
    avatar: r(document.querySelector('.tb-avatar')),
    languageButton: r(document.querySelector('.tb-language-row')),
    languageFlag: r(document.querySelector('.tb-language-flag')),
    semesterButton: r(document.querySelector('.tb-term-button')),
    languageMenu: r(menu),
    languageOption: r(menu?.querySelector('.tb-language-option')),
    languageOptionCount: menu ? menu.querySelectorAll('.tb-language-option').length : 0,
    languageFlagIcon: r(menu?.querySelector('.tb-language-option-flag')),
    currentCheck: menu ? !!menu.querySelector('.tb-language-option.is-current .tb-language-check') : false,
    semesterPopover: r(popover),
    semesterOption: r(popover?.querySelector('.tb-semester-option')),
    semesterEdit: r(popover?.querySelector('.tb-semester-edit')),
    semesterCreate: r(popover?.querySelector('.tb-semester-create')),
    dialog: r(dialog),
    dialogForm: r(dialog?.querySelector('.tb-dialog-form')),
    dialogPreview: r(dialog?.querySelector('.tb-dialog-preview'))
  };
});

const report = { problems: [], states: {} };

// Default state.
await page.hover('.tb-main');
await page.waitForTimeout(300);
report.states.default = await measure();
await page.screenshot({ path: `${OUT}PC-head-default.png`, clip: { x: 0, y: 65, width: 300, height: 180 } });

// Hover states.
for (const [name, selector] of [['account', '.tb-account-row'], ['language', '.tb-language-row'], ['semester', '.tb-term-button']]) {
  await page.hover(selector);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}PC-head-hover-${name}.png`, clip: { x: 0, y: 65, width: 300, height: 180 } });
}

// Language menu.
await page.click('.tb-language-row');
await page.waitForTimeout(500);
report.states.languageMenu = await measure();
await page.screenshot({ path: `${OUT}PC-language-menu.png`, clip: { x: 0, y: 65, width: 300, height: 420 } });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Semester popover.
await page.click('.tb-term-button');
await page.waitForTimeout(500);
report.states.semesterPopover = await measure();
await page.screenshot({ path: `${OUT}PC-semester-popover.png`, clip: { x: 0, y: 65, width: 320, height: 340 } });

// Create dialog.
await page.click('.tb-semester-create');
await page.waitForTimeout(600);
report.states.dialog = await measure();
await page.screenshot({ path: `${OUT}PC-create-dialog.png` });
await page.click('.tb-mode-card:nth-child(2)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}PC-create-dialog-copy.png` });

report.problems = problems;
report.reference = REFERENCE;
writeFileSync(`${paths.results}/head-measure.json`, JSON.stringify(report, null, 2));

const cmp = (label, got, want) => {
  if (!got) return `  ${label.padEnd(22)} MISSING`;
  const bits = Object.entries(want).map(([k, v]) => `${k}=${got[k]}${String(got[k]) === String(v) ? '' : ` (want ${v})`}`);
  return `  ${label.padEnd(22)} ${bits.join(' ')}`;
};
console.log('default state');
console.log(cmp('accountRow', report.states.default.accountRow, REFERENCE.accountRow));
console.log(cmp('accountName', report.states.default.accountName, REFERENCE.accountName));
console.log(cmp('avatar', report.states.default.avatar, REFERENCE.avatar));
console.log(cmp('languageButton', report.states.default.languageButton, REFERENCE.languageButton));
console.log(cmp('languageFlag', report.states.default.languageFlag, REFERENCE.languageFlag));
console.log(cmp('semesterButton', report.states.default.semesterButton, REFERENCE.semesterButton));
console.log('\nlanguage menu');
console.log(cmp('menu', report.states.languageMenu.languageMenu, REFERENCE.languageMenu));
console.log(cmp('option', report.states.languageMenu.languageOption, REFERENCE.languageOption));
console.log(cmp('option flag', report.states.languageMenu.languageFlagIcon, REFERENCE.languageFlagIcon));
console.log(`  options=${report.states.languageMenu.languageOptionCount} (want 20) currentCheck=${report.states.languageMenu.currentCheck}`);
console.log('\nsemester popover');
console.log(cmp('popover', report.states.semesterPopover.semesterPopover, REFERENCE.semesterPopover));
console.log(cmp('option', report.states.semesterPopover.semesterOption, REFERENCE.semesterOption));
console.log(cmp('edit', report.states.semesterPopover.semesterEdit, REFERENCE.semesterEdit));
console.log('\ndialog');
console.log(cmp('dialog', report.states.dialog.dialog, REFERENCE.dialog));
console.log(cmp('form column', report.states.dialog.dialogForm, { w: 380 }));
console.log(`\nconsole problems: ${problems.length ? problems.join(' | ') : 'none'}`);
console.error(`Screenshots: ${OUT}`);

await browser.close();
