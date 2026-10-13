// Geometry checks for the accepted sidebar layout.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { mkdirSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';

const paths = evidencePaths('verify-visual');
const OUT = `${paths.screenshots}/`;
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';

const REF = {
  topbarHeight: 65,
  sidebarWidth: 256,
  sidebarX: 0,
  sidebarY: 65,
  rowHeight: 36,
  rowX: 12,
  rowPadding: '10px',
  rowRadius: '8px',
  rowGap: 4,
  iconSize: 20,
  labelX: 54,
  labelFont: '14px',
  labelLineHeight: '20px',
  labelWeight: '500',
  groupLabelFont: '10px',
  groupLabelLetterSpacing: '0.5px',
  railWidth: 72,
  railRowWidth: 36,
  railRowX: 16,
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await openWorkbench(p, BASE);
await p.waitForTimeout(500);

// The one-shot first-run guide dims the shell and swallows presses by design, so
// dismiss it before driving the surface under test.
await p.click('.tb-coach-dismiss').catch(() => {});
await p.waitForTimeout(250);

const rows = [];
const check = (name, actual, expected, tol = 0) => {
  const ok = typeof actual === 'number' && typeof expected === 'number'
    ? Math.abs(actual - expected) <= tol
    : String(actual) === String(expected);
  rows.push({ name, actual, expected, ok });
};

const g = await p.evaluate(() => {
  const px = (v) => Math.round(v * 100) / 100;
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }; };
  const cs = (s, props) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const o = {}; props.forEach((k) => { o[k] = c[k]; }); return o; };
  const firstRow = document.querySelector('.tb-module-row');
  const rowBox = firstRow ? firstRow.getBoundingClientRect() : null;
  const label = firstRow ? firstRow.querySelector('span:last-child') : null;
  const labelBox = label ? label.getBoundingClientRect() : null;
  const iconSvg = firstRow ? firstRow.querySelector('svg') : null;
  const iconBox = iconSvg ? iconSvg.getBoundingClientRect() : null;
  const iconSpan = firstRow ? firstRow.querySelector('.tb-module-icon') : null;
  // Measure the label, not its adjacent expand/collapse button.
  const groupLabel = document.querySelector('.tb-group-heading .tb-group-label');
  return {
    topbar: box('.tb-topbar'),
    sidebar: box('.tb-sidebar'),
    row: rowBox && { x: px(rowBox.x), y: px(rowBox.y), w: px(rowBox.width), h: px(rowBox.height) },
    rowStyle: firstRow && (() => { const c = getComputedStyle(firstRow); return { padding: c.padding, radius: c.borderRadius, gap: c.gap, color: c.color, fontSize: c.fontSize, fontWeight: c.fontWeight, lineHeight: c.lineHeight }; })(),
    label: labelBox && { x: px(labelBox.x), h: px(labelBox.height) },
    labelStyle: label && (() => { const c = getComputedStyle(label); return { fontSize: c.fontSize, lineHeight: c.lineHeight, fontWeight: c.fontWeight }; })(),
    icon: iconBox && { w: px(iconBox.width), h: px(iconBox.height) },
    iconSpan: iconSpan && (() => { const r = iconSpan.getBoundingClientRect(); const c = getComputedStyle(iconSpan); return { w: px(r.width), h: px(r.height), bg: c.backgroundColor, radius: c.borderRadius }; })(),
    rowGap: (() => { const list = document.querySelector('.tb-module-list'); return list ? getComputedStyle(list).gap : null; })(),
    groupLabel: groupLabel && (() => { const c = getComputedStyle(groupLabel); const r = groupLabel.getBoundingClientRect(); return { fontSize: c.fontSize, letterSpacing: c.letterSpacing, textTransform: c.textTransform, fontWeight: c.fontWeight, x: px(r.x), h: px(r.height) }; })(),
    sidebarBorderRight: getComputedStyle(document.querySelector('.tb-sidebar')).borderRightWidth,
    accountAvatar: (() => { const a = document.querySelector('.tb-account-row .tb-avatar'); if (!a) return null; const r = a.getBoundingClientRect(); const c = getComputedStyle(a); return { w: px(r.width), h: px(r.height), bg: c.backgroundColor, radius: c.borderRadius }; })(),
    accountRow: (() => { const a = document.querySelector('.tb-account-row'); const r = a.getBoundingClientRect(); const c = getComputedStyle(a); return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height), padding: c.padding, radius: c.borderRadius, bg: c.backgroundColor }; })(),
    termButton: (() => { const a = document.querySelector('.tb-term-button'); const r = a.getBoundingClientRect(); const c = getComputedStyle(a); return { x: px(r.x), w: px(r.width), h: px(r.height), radius: c.borderRadius, border: c.borderTopWidth + ' ' + c.borderTopColor, shadow: c.boxShadow }; })(),
    toggle: (() => { const a = document.querySelector('.tb-sidebar-toggle'); const r = a.getBoundingClientRect(); return { x: px(r.x), w: px(r.width), h: px(r.height) }; })(),
  };
});

check('topbar height', g.topbar.h, REF.topbarHeight);
check('sidebar width', g.sidebar.w, REF.sidebarWidth);
check('sidebar x', g.sidebar.x, REF.sidebarX);
check('sidebar y', g.sidebar.y, REF.sidebarY);
check('sidebar border-right', g.sidebarBorderRight, '0px');
check('row height', g.row.h, REF.rowHeight);
check('row x', g.row.x, REF.rowX);
check('row padding', g.rowStyle.padding, REF.rowPadding);
check('row radius', g.rowStyle.radius, REF.rowRadius);
check('row gap (list)', g.rowGap, `${REF.rowGap}px`);
check('row label x', g.label.x, REF.labelX);
check('row label font', g.labelStyle.fontSize, REF.labelFont);
check('row label line-height', g.labelStyle.lineHeight, REF.labelLineHeight);
check('row label weight', g.labelStyle.fontWeight, REF.labelWeight);
check('icon box', g.icon.w, REF.iconSize);
check('icon badge bg', g.iconSpan.bg, 'rgba(0, 0, 0, 0)');
check('group label font', g.groupLabel.fontSize, REF.groupLabelFont);
check('group label tracking', g.groupLabel.letterSpacing, REF.groupLabelLetterSpacing);
check('group label transform', g.groupLabel.textTransform, 'uppercase');
check('group label x', g.groupLabel.x, REF.rowX);
check('account avatar size', g.accountAvatar.w, 32);
check('account avatar bg', g.accountAvatar.bg, 'rgb(109, 74, 173)');
check('account row x', g.accountRow.x, 16);
check('account row width', g.accountRow.w, 183, 1);
check('account row padding', g.accountRow.padding, '4px');
check('account row radius', g.accountRow.radius, '6px');
check('account row bg (no fill)', g.accountRow.bg, 'rgba(0, 0, 0, 0)');
check('term button x', g.termButton.x, 12);
check('term button width', g.termButton.w, 231, 2);
check('term button height', g.termButton.h, 36);
// The semester combobox follows the reference control: a 6px radius and no border.
check('term button radius', g.termButton.radius, '6px');
check('term button has no border', g.termButton.border.startsWith('0px'), true);
check('toggle x (inside sidebar)', g.toggle.x, 220);
check('toggle size', g.toggle.w, 32);
// The home cards that used to carry the card shadow are gone; the semester
// combobox now carries the reference control's own shadow.
check('term button shadow', g.termButton.shadow, 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px');

console.log('=== EXPANDED @1440x900 ===');
for (const r of rows) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(26)} actual=${r.actual}  expected=${r.expected}`);
}

// collapsed rail. The collapse control is pointer-events:none until the top bar
// is hovered, so hover first and then click through the DOM.
await p.hover('.tb-topbar');
await p.waitForTimeout(250);
await p.evaluate(() => {
  const root = document.querySelector('.tb-prototype');
  if (root.classList.contains('is-sidebar-collapsed')) document.querySelector('.tb-sidebar-toggle').click();
});
await p.waitForTimeout(450);
await p.evaluate(() => document.querySelector('.tb-sidebar-toggle').click());
await p.waitForTimeout(450);
const rail = await p.evaluate(() => {
  const px = (v) => Math.round(v * 100) / 100;
  const aside = document.querySelector('.tb-sidebar');
  const sb = aside.getBoundingClientRect();
  const row = document.querySelector('.tb-module-row');
  const rb = row.getBoundingClientRect();
  const visible = (s) => { const e = document.querySelector(s); if (!e) return 'absent'; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? 'visible' : 'hidden'; };
  const groups = document.querySelectorAll('.tb-group');
  const second = groups[1];
  const cs = second ? getComputedStyle(second) : null;
  return {
    railWidth: px(sb.width),
    row: { x: px(rb.x), w: px(rb.width), h: px(rb.height) },
    rowPadding: getComputedStyle(row).padding,
    groupLabel: visible('.tb-group-toggle'),
    workspaceHeading: visible('.tb-workspace-heading'),
    accountRow: visible('.tb-account-row'),
    languageRow: visible('.tb-language-row'),
    trash: visible('.tb-trash-wrap'),
    footer: visible('.tb-sidebar-footer'),
    groupDivider: cs ? cs.borderTopWidth + ' ' + cs.borderTopColor : null,
    groupDividerTop: cs ? cs.paddingTop : null,
    rowLabel: visible('.tb-module-row > span:last-child'),
    tooltipContent: row.dataset.label,
  };
});
console.log('\n=== COLLAPSED RAIL @1440x900 ===');
check('rail width', rail.railWidth, REF.railWidth);
check('rail row width', rail.row.w, REF.railRowWidth);
// Centre the row inside the 72px rail; allow a 2px rendering tolerance.
check('rail row x', rail.row.x, REF.railRowX, 2);
check('rail row height', rail.row.h, REF.rowHeight);
check('rail row padding', rail.rowPadding, '8px');
check('group headings hidden', rail.groupLabel, 'hidden');
check('workspace heading hidden', rail.workspaceHeading, 'hidden');
check('account row hidden', rail.accountRow, 'hidden');
check('language row hidden', rail.languageRow, 'hidden');
check('trash hidden', rail.trash, 'hidden');
// Settings belong to the top-bar support menu, not a sidebar footer.
check('sidebar footer removed', rail.footer, 'absent');
check('module label hidden', rail.rowLabel, 'hidden');
check('group divider present', rail.groupDivider.startsWith('1px'), true);
check('tooltip text bound', rail.tooltipContent.includes('数学工坊'), true);

const rows2 = rows.slice(-16);
for (const r of rows2) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(26)} actual=${r.actual}  expected=${r.expected}`);
}

console.log('\nconsole errors:', errs.length ? errs.slice(0, 3) : 'none');
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log('horizontal overflow:', overflow);

await p.screenshot({ path: `${OUT}/PC-CW02-rail.png` });
await b.close();
process.exitCode = rows.some((result) => !result.ok) || errs.length || overflow ? 1 : 0;
