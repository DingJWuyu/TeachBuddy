// Geometry and interaction checks for the accepted workbench top bar.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = process.env.PROTOTYPE_EVIDENCE_DIR || fileURLToPath(new URL('../evidence/screenshots/workbench/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
const near = (actual, expected, tol = 0.51) => Math.abs(actual - expected) <= tol;

const REF = {
  height: 65,
  brandX: 18,
  markSize: 28,
  markRadius: '6px',
  wordmarkX: 54,
  wordmarkFont: '18px',
  wordmarkLineHeight: '27px',
  wordmarkWeight: '400',
  wordmarkTracking: '-0.36px',
  navHeight: 32,
  navPadding: '6px 20px',
  navRadius: '9999px',
  navFont: '14px',
  navWeight: '500',
  ink: 'rgb(45, 48, 55)',
  mutedForeground: 'rgb(85, 85, 85)',
  entrySize: 32,
  entryRadius: '6px',
  entryGap: 8,
  rightEdge: 1392,
  badgeSize: 16,
  badgeTop: 14,
  badgeRed: 'rgb(251, 44, 54)',
  badgeAmber: 'rgb(254, 154, 0)',
  popoverTop: 56,
  popoverRadius: '12px',
  popoverPadding: '16px 20px',
  tooltipHeight: 28,
  tooltipTop: 66,
  tooltipPadding: '6px 12px',
  tooltipRadius: '6px',
  tooltipFont: '12px',
  searchWidth: 512,
  searchRadius: '8px',
  searchBg: 'rgb(249, 249, 249)',
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await openWorkbench(p, BASE);
await p.waitForTimeout(600);

/*
 * Headless Chromium only advances the animation timeline when it paints a frame,
 * so anything mid-transition is otherwise measured frozen on its opening frame,
 * which made the geometry below flaky. Finish the animations first. Infinite
 * animations (the celebration fireworks) cannot be finished and are left alone.
 */
const settle = () => p.evaluate(() => {
  document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } });
});
await settle();

// ---------------------------------------------------------------- geometry

const g = await p.evaluate(() => {
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), right: +(r.x + r.width).toFixed(2) }; };
  const cs = (s, props) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const o = {}; props.forEach((k) => { o[k] = c[k]; }); return o; };
  const badges = [...document.querySelectorAll('.tb-badge')].map((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); const btn = e.closest('.tb-entry').getBoundingClientRect(); return { text: e.textContent, w: r.width, h: r.height, y: +r.y.toFixed(2), right: +(r.x + r.width).toFixed(2), btnRight: +(btn.x + btn.width).toFixed(2), bg: c.backgroundColor, fs: c.fontSize }; });
  const entries = [...document.querySelectorAll('.tb-entry')].map((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { label: e.getAttribute('aria-label'), x: +r.x.toFixed(2), right: +(r.x + r.width).toFixed(2), w: r.width, h: r.height, radius: c.borderRadius }; });
  const nav = [...document.querySelectorAll('.tb-global-nav .tb-nav-item')].map((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { text: e.textContent.trim(), h: r.height, pad: c.padding, radius: c.borderRadius, font: c.fontSize, weight: c.fontWeight, bg: c.backgroundColor, color: c.color }; });
  const acts = getComputedStyle(document.querySelector('.tb-top-actions'));
  return {
    topbar: box('.tb-topbar'),
    topbarPad: getComputedStyle(document.querySelector('.tb-topbar')).padding,
    brand: box('.tb-brand'),
    mark: { ...box('.tb-brand-mark'), ...cs('.tb-brand-mark', ['borderRadius']) },
    wordmark: { ...box('.tb-brand-wordmark'), ...cs('.tb-brand-wordmark', ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing']) },
    nav,
    navGap: getComputedStyle(document.querySelector('.tb-global-nav')).gap,
    entries,
    entryGap: acts.gap,
    entryColor: getComputedStyle(document.querySelector('.tb-entry')).color,
    badges,
    burger: (() => { const e = document.querySelector('.tb-mobile-menu'); const c = getComputedStyle(e); return { display: c.display, w: e.getBoundingClientRect().width }; })(),
  };
});

ok('top bar is 65px tall', near(g.topbar.h, REF.height), String(g.topbar.h));
ok('top bar insets are 18px left / 48px right', g.topbarPad === '0px 48px 0px 18px', g.topbarPad);
ok('brand starts at x=18', near(g.brand.x, REF.brandX), String(g.brand.x));
ok('brand mark is 28px at 6px radius', near(g.mark.w, REF.markSize) && g.mark.borderRadius === REF.markRadius, `${g.mark.w} ${g.mark.borderRadius}`);
ok('wordmark starts at x=54', near(g.wordmark.x, REF.wordmarkX), String(g.wordmark.x));
ok('wordmark is 18px/27px at weight 400', g.wordmark.fontSize === REF.wordmarkFont && g.wordmark.lineHeight === REF.wordmarkLineHeight && g.wordmark.fontWeight === REF.wordmarkWeight, JSON.stringify(g.wordmark));
ok('wordmark tracking is -0.36px', g.wordmark.letterSpacing === REF.wordmarkTracking, g.wordmark.letterSpacing);

const home = g.nav[0];
const calendar = g.nav[1];
ok('nav item is 32px, 6px 20px, fully rounded', near(home.h, REF.navHeight) && home.pad === REF.navPadding && home.radius === REF.navRadius, JSON.stringify(home));
ok('nav item type is 14px at weight 500', home.font === REF.navFont && home.weight === REF.navWeight, `${home.font} ${home.weight}`);
ok('selected nav uses the ink pill', home.bg === REF.ink && home.color === 'rgb(255, 255, 255)', `${home.bg} ${home.color}`);
ok('unselected nav uses the muted-foreground token', calendar.color === REF.mutedForeground, calendar.color);
ok('nav gap is 4px', g.navGap === '4px', g.navGap);

ok('right group carries five entries', g.entries.length === 5, g.entries.map((e) => e.label).join(' | '));
ok('entries are 32px at 6px radius', g.entries.every((e) => near(e.w, REF.entrySize) && e.radius === REF.entryRadius), JSON.stringify(g.entries.map((e) => [e.w, e.radius])));
ok('entry gap is 8px', g.entryGap === '8px', g.entryGap);
ok('right group ends 48px from the viewport edge', near(g.entries[4].right, REF.rightEdge), String(g.entries[4].right));
ok('entry icons use the muted-foreground token', g.entryColor === REF.mutedForeground, g.entryColor);
ok('notification bell carries the red badge', g.badges[0]?.text === '!' && g.badges[0].bg === REF.badgeRed, JSON.stringify(g.badges[0]));
ok('tutorial entry carries the amber count', g.badges[1]?.bg === REF.badgeAmber, JSON.stringify(g.badges[1]));
ok('badges are 16px pinned to the button corner', g.badges.every((x) => near(x.w, REF.badgeSize) && near(x.y, REF.badgeTop) && near(x.right, x.btnRight + 1)), JSON.stringify(g.badges.map((x) => [x.w, x.y, x.right, x.btnRight])));
ok('no hamburger in the desktop top bar', g.burger.display === 'none' && g.burger.w === 0, JSON.stringify(g.burger));

const centring = await p.evaluate(() => [...document.querySelectorAll('.tb-entry')].map((e) => {
  const b = e.getBoundingClientRect();
  const s = e.querySelector('svg').getBoundingClientRect();
  return { surface: e.dataset.surface, pad: getComputedStyle(e).padding, dx: +((s.x + s.width / 2) - (b.x + b.width / 2)).toFixed(2), dy: +((s.y + s.height / 2) - (b.y + b.height / 2)).toFixed(2) };
}));
ok('icon buttons reset the UA padding', centring.every((c) => c.pad === '0px'), centring.map((c) => c.pad).join(' '));
ok('every entry icon is centred in its box', centring.every((c) => Math.abs(c.dx) < 0.5 && Math.abs(c.dy) < 0.5), JSON.stringify(centring.map((c) => [c.surface, c.dx, c.dy])));

// The first-run guide must dim everything except the entry it points at.
const spot = await p.evaluate(() => {
  const scrim = document.querySelector('.tb-coach-scrim');
  const wrap = document.querySelector('.tb-entry-wrap.is-coached');
  if (!scrim || !wrap) return null;
  const s = scrim.getBoundingClientRect();
  const btn = document.querySelector('[data-surface="tutorial"]').getBoundingClientRect();
  const cs = getComputedStyle(scrim);
  return {
    rect: [+s.x.toFixed(1), +s.y.toFixed(1), +s.width.toFixed(1), +s.height.toFixed(1)],
    bg: cs.backgroundColor,
    scrimZ: +cs.zIndex,
    wrapZ: +getComputedStyle(wrap).zIndex,
    litCentre: document.elementFromPoint(btn.x + btn.width / 2, btn.y + btn.height / 2)?.closest('[data-surface="tutorial"]') !== null,
    dimElsewhere: document.elementFromPoint(700, 500)?.classList.contains('tb-coach-scrim') === true,
  };
});
ok('first run dims the whole viewport', spot && spot.rect[2] >= 1440 && spot.rect[3] >= 900 && spot.bg === 'rgba(0, 0, 0, 0.5)', JSON.stringify(spot?.rect) + ' ' + spot?.bg);
ok('the tutorial entry stays lit above the scrim', spot && spot.wrapZ > spot.scrimZ && spot.litCentre, `wrap ${spot?.wrapZ} scrim ${spot?.scrimZ} lit=${spot?.litCentre}`);
ok('the scrim swallows presses everywhere else', spot?.dimElsewhere === true, String(spot?.dimElsewhere));

await p.click('.tb-coach-dismiss');
await p.waitForTimeout(300);
ok('dismissing the guide removes the scrim', (await p.evaluate(() => document.querySelectorAll('.tb-coach-scrim').length)) === 0, 'scrim still present');

// --------------------------------------------------------------- tooltips

await p.hover('[data-surface="search"]');
await p.waitForTimeout(700);
const tip = await p.evaluate(() => {
  const e = document.querySelector('[data-surface="search"] + .tb-tooltip');
  if (!e) return null;
  const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
  const btn = document.querySelector('[data-surface="search"]').getBoundingClientRect();
  return { text: e.textContent, h: +r.height.toFixed(2), y: +r.y.toFixed(2), pad: c.padding, radius: c.borderRadius, bg: c.backgroundColor, color: c.color, font: c.fontSize, opacity: c.opacity, centre: +(r.x + r.width / 2).toFixed(2), btnCentre: +(btn.x + btn.width / 2).toFixed(2) };
});
ok('search tooltip reads "搜索 (Ctrl+K)"', tip?.text === '搜索 (Ctrl+K)', tip?.text);
ok('tooltip is 28px at y=66 with the rail geometry', tip && near(tip.h, REF.tooltipHeight) && near(tip.y, REF.tooltipTop) && tip.pad === REF.tooltipPadding && tip.radius === REF.tooltipRadius && tip.font === REF.tooltipFont, JSON.stringify(tip));
ok('tooltip uses the dark ink surface', tip?.bg === REF.ink && tip?.color === 'rgb(249, 249, 249)', `${tip?.bg} ${tip?.color}`);
ok('tooltip is centred on its trigger', tip && near(tip.centre, tip.btnCentre), `${tip?.centre} vs ${tip?.btnCentre}`);
await p.mouse.move(700, 400);
await p.waitForTimeout(200);

// ------------------------------------------------------------ support menu

await p.hover('[data-surface="support"]');
await p.waitForTimeout(400);
const menu = await p.evaluate(() => {
  const m = document.querySelector('.tb-support-menu');
  if (!m) return null;
  const items = [...m.querySelectorAll('button')].map((b) => {
    const br = b.getBoundingClientRect();
    const icon = b.querySelector('svg');
    const label = b.querySelector('span');
    return {
      label: label?.textContent,
      hasIcon: !!icon,
      iconDx: icon ? +(icon.getBoundingClientRect().x - br.x).toFixed(2) : null,
      labelDx: label ? +(label.getBoundingClientRect().x - br.x).toFixed(2) : null,
    };
  });
  return { w: +m.getBoundingClientRect().width.toFixed(2), rows: items.length, items };
});
ok('support menu opens on hover alone', !!menu, menu ? 'open' : 'not open');
ok('support menu keeps the 167px reference width', menu && near(menu.w, 167, 1), String(menu?.w));
ok('every support row carries an icon', menu?.rows === 3 && menu.items.every((i) => i.hasIcon), JSON.stringify(menu?.items.map((i) => [i.label, i.hasIcon])));
ok('support rows place a 16px icon then the label', menu && menu.items.every((i) => near(i.iconDx, 12) && near(i.labelDx, 38)), JSON.stringify(menu?.items.map((i) => [i.iconDx, i.labelDx])));
const chevron = await p.evaluate(() => getComputedStyle(document.querySelector('.tb-support-wrap .tb-nav-item > svg')).transform);
ok('the chevron flips while the menu is showing', chevron.startsWith('matrix(-1'), chevron);

/*
 * The panel hangs 8px below its trigger. Walking the pointer down through that
 * gap must keep the menu open. Drive the actual path rather than jumping
 * straight onto the item.
 */
const supportBox = await p.locator('[data-surface="support"]').boundingBox();
const centreX = supportBox.x + supportBox.width / 2;
await p.mouse.move(centreX, supportBox.y + supportBox.height + 4);
await p.waitForTimeout(200);
const inGap = await p.evaluate(() => !!document.querySelector('.tb-support-menu'));
await p.mouse.move(centreX, supportBox.y + supportBox.height + 22);
await p.waitForTimeout(200);
const inPanel = await p.evaluate(() => {
  const m = document.querySelector('.tb-support-menu');
  return m ? [...m.querySelectorAll('button')].map((b) => b.textContent.trim()) : null;
});
ok('the menu survives the pointer crossing the gap below its trigger', inGap && inPanel !== null, `gap=${inGap} panel=${inPanel !== null}`);

await p.click('.tb-support-menu button:first-child');
await p.waitForTimeout(300);
const afterItem = await p.evaluate(() => ({ open: !!document.querySelector('.tb-support-menu'), said: document.querySelector('.tb-announcer')?.textContent }));
ok('a support item can actually be reached and clicked', afterItem.open === false && afterItem.said === '设置', JSON.stringify(afterItem));

await p.mouse.move(700, 400);
await p.waitForTimeout(400);
ok('support menu closes when the pointer leaves', (await p.evaluate(() => document.querySelectorAll('.tb-support-menu').length)) === 0, 'still open');
const chevronRest = await p.evaluate(() => getComputedStyle(document.querySelector('.tb-support-wrap .tb-nav-item > svg')).transform);
ok('the chevron returns to pointing down', chevronRest === 'none', chevronRest);

// -------------------------------------------------------- surface geometry

const surfaces = [
  ['notifications', { width: 320, radius: REF.popoverRadius }],
  ['feedback', { width: 540, radius: REF.popoverRadius }],
  ['tutorial', { width: 320, radius: REF.popoverRadius }],
  ['privacy', { width: null, radius: '16px' }],
];
for (const [surface, want] of surfaces) {
  await p.click(`[data-surface="${surface}"]`);
  await p.waitForTimeout(280);
  const info = await p.evaluate((sel) => {
    const trigger = document.querySelector(sel);
    const wrap = trigger.closest('.tb-entry-wrap');
    const panel = wrap.querySelector('.tb-popover');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const c = getComputedStyle(panel);
    const t = trigger.getBoundingClientRect();
    return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), right: +(r.x + r.width).toFixed(2), triggerRight: +(t.x + t.width).toFixed(2), radius: c.borderRadius, pad: c.padding, shadow: c.boxShadow };
  }, `[data-surface="${surface}"]`);
  ok(`${surface} panel opens at y=56 flush with its trigger`, info && near(info.y, REF.popoverTop) && near(info.right, info.triggerRight), info ? `y=${info.y} right=${info.right} trigger=${info.triggerRight}` : 'no panel');
  ok(`${surface} panel radius is ${want.radius}`, info?.radius === want.radius, info?.radius);
  ok(`${surface} panel padding is 16px 20px`, info?.pad === REF.popoverPadding, info?.pad);
  if (want.width) ok(`${surface} panel is ${want.width}px wide`, info && near(info.w, want.width, 1), String(info?.w));
  const tooltipsWhileOpen = await p.evaluate((sel) => document.querySelector(sel).closest('.tb-entry-wrap').querySelectorAll('.tb-tooltip').length, `[data-surface="${surface}"]`);
  ok(`${surface} hides its tooltip while open`, tooltipsWhileOpen === 0, String(tooltipsWhileOpen));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
}

// -------------------------------------------------------- feedback colours

await p.click('[data-surface="feedback"]');
await p.waitForTimeout(300);
const chipColors = [];
for (let i = 0; i < 4; i += 1) {
  await p.click(`.tb-feedback-types .tb-chip:nth-child(${i + 1})`);
  await p.waitForTimeout(160);
  chipColors.push(await p.evaluate((n) => {
    const chips = [...document.querySelectorAll('.tb-feedback-types .tb-chip')];
    return {
      label: chips[n].textContent,
      color: getComputedStyle(chips[n]).color,
      bg: getComputedStyle(chips[n]).backgroundColor,
      others: chips.filter((_, j) => j !== n).map((x) => getComputedStyle(x).color),
    };
  }, i));
}
ok('each feedback type selects in its own colour', new Set(chipColors.map((c) => c.color)).size === 4, JSON.stringify(chipColors.map((c) => [c.label, c.color])));
ok('unselected feedback chips stay grey', chipColors.every((c) => c.others.every((o) => o === REF.mutedForeground)), JSON.stringify(chipColors.map((c) => c.others)));
await p.keyboard.press('Escape');
await p.waitForTimeout(250);

// ---------------------------------------------------------- search surface

await p.click('[data-surface="search"]');
await p.waitForTimeout(350);
const search = await p.evaluate(() => {
  const panel = document.querySelector('.tb-search-panel');
  const r = panel.getBoundingClientRect();
  const c = getComputedStyle(panel);
  const backdrop = getComputedStyle(document.querySelector('.tb-search-backdrop'));
  const input = document.querySelector('.tb-search-input');
  const rowH = document.querySelector('.tb-search-item')?.getBoundingClientRect().height;
  const groupH = document.querySelector('.tb-search-group-label')?.getBoundingClientRect().height;
  const inputH = document.querySelector('.tb-search-input-row').getBoundingClientRect().height;
  return {
    x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), radius: c.borderRadius, bg: c.backgroundColor,
    backdrop: backdrop.backgroundColor,
    centredX: Math.abs((r.x + r.width / 2) - innerWidth / 2) < 1,
    centredY: Math.abs((r.y + r.height / 2) - innerHeight / 2) < 1,
    focused: document.activeElement === input,
    role: panel.getAttribute('role'), modal: panel.getAttribute('aria-modal'),
    inputH, rowH, groupH,
    shadow: c.boxShadow,
  };
});
ok('search panel is a viewport-centred modal', search.centredX && search.centredY, JSON.stringify({ x: search.x, y: search.y }));
ok('search panel is 512px at 8px radius', near(search.w, REF.searchWidth) && search.radius === REF.searchRadius, `${search.w} ${search.radius}`);
ok('search panel uses the page colour and no shadow', search.bg === REF.searchBg && search.shadow === 'none', `${search.bg} ${search.shadow}`);
ok('search scrim is 50% black', search.backdrop === 'rgba(0, 0, 0, 0.5)', search.backdrop);
ok('search is a labelled modal dialog', search.role === 'dialog' && search.modal === 'true', `${search.role} ${search.modal}`);
ok('search focuses its input on open', search.focused, String(search.focused));
ok('search row grammar is 48 / 28 / 36', near(search.inputH, 48) && near(search.groupH, 28) && near(search.rowH, 36), `${search.inputH} ${search.groupH} ${search.rowH}`);
await p.fill('.tb-search-input', 'zzzzz');
await p.waitForTimeout(250);
ok('search shows an empty state when nothing matches', await p.isVisible('.tb-search-empty'), 'empty state visible');
await p.keyboard.press('Escape');
await p.waitForTimeout(250);

// --------------------------------------------------------- interaction rules

await p.click('[data-surface="notifications"]');
await p.waitForTimeout(250);
await p.click('[data-surface="feedback"]');
await p.waitForTimeout(250);
const alone = await p.evaluate(() => document.querySelectorAll('.tb-popover, .tb-search-panel').length);
ok('surfaces are mutually exclusive', alone === 1, `${alone} open`);

await p.keyboard.press('Escape');
await p.waitForTimeout(250);
const closed = await p.evaluate(() => ({
  open: document.querySelectorAll('.tb-popover, .tb-search-panel').length,
  focused: document.activeElement?.getAttribute('data-surface'),
}));
ok('Escape closes the surface', closed.open === 0, String(closed.open));
ok('Escape returns focus to the trigger', closed.focused === 'feedback', String(closed.focused));

await p.keyboard.press('Control+k');
await p.waitForTimeout(300);
ok('Ctrl+K opens search', await p.isVisible('.tb-search-panel'), 'search panel visible');
await p.keyboard.press('Escape');
await p.waitForTimeout(250);

await p.click('[data-surface="tutorial"]');
await p.waitForTimeout(250);
await p.mouse.click(400, 600);
await p.waitForTimeout(250);
ok('a pointer press outside the top bar closes the surface', (await p.evaluate(() => document.querySelectorAll('.tb-popover').length)) === 0, 'closed');

// Pressing the top-bar background also closes an open popover.
await p.click('[data-surface="notifications"]');
await p.waitForTimeout(250);
const openBefore = await p.evaluate(() => document.querySelectorAll('.tb-popover').length);
await p.mouse.click(300, 32);
await p.waitForTimeout(300);
const openAfter = await p.evaluate(() => document.querySelectorAll('.tb-popover').length);
ok('pressing the top bar beside a popover closes it', openBefore === 1 && openAfter === 0, `${openBefore} -> ${openAfter}`);

await p.click('[data-surface="notifications"]');
await p.waitForSelector('.tb-popover-notifications h2');
await p.waitForTimeout(200);
await p.click('.tb-popover-notifications h2');
await p.waitForTimeout(250);
ok('pressing inside the popover keeps it open', (await p.evaluate(() => document.querySelectorAll('.tb-popover').length)) === 1, 'closed');
await p.keyboard.press('Escape');
await p.waitForTimeout(200);

// ------------------------------------------------------------- coach mark

await openWorkbench(p, BASE);
await p.waitForTimeout(600);

const entrance = await p.evaluate(() => {
  const rules = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } });
  const names = rules.filter((r) => r.type === CSSRule.KEYFRAMES_RULE).map((r) => r.name);
  const delay = (sel) => getComputedStyle(document.querySelector(sel)).animationDelay;
  return {
    hasKeyframes: ['tb-coach-dim', 'tb-coach-light', 'tb-coach-rise'].every((n) => names.includes(n)),
    dim: delay('.tb-coach-scrim'),
    light: delay('[data-surface="tutorial"]'),
    rise: delay('.tb-coach'),
  };
});
ok('the guide has staged entrance keyframes', entrance.hasKeyframes, JSON.stringify(entrance));
ok('entrance runs dim, then light, then text', parseFloat(entrance.dim) < parseFloat(entrance.light) && parseFloat(entrance.light) < parseFloat(entrance.rise), `${entrance.dim} < ${entrance.light} < ${entrance.rise}`);

await settle();
const coach = await p.evaluate(() => {
  const el = document.querySelector('.tb-coach');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const btn = document.querySelector('[data-surface="tutorial"]').getBoundingClientRect();
  return { text: el.querySelector('p').textContent, w: +r.width.toFixed(2), withinViewport: r.x >= 0 && r.x + r.width <= innerWidth, pointsAtTutorial: Math.abs((r.x + r.width) - (btn.x + btn.width)) < 20 };
});
ok('first run shows the coach mark', !!coach, coach ? 'present' : 'absent');
ok('coach mark carries the one-time sentence', coach?.text.includes('点击对应项'), coach?.text);
ok('coach mark points at the tutorial entry and stays on screen', coach?.withinViewport && coach?.pointsAtTutorial, JSON.stringify(coach));

await p.mouse.click(700, 500);
await p.waitForTimeout(350);
ok('pressing the dimmed area dismisses the guide', (await p.evaluate(() => document.querySelectorAll('.tb-coach, .tb-coach-scrim').length)) === 0, 'still up');

await openWorkbench(p, BASE);
await p.waitForTimeout(600);
await settle();

// tutorial completion drives the badge
const before = await p.evaluate(() => document.querySelector('.tb-badge.is-amber').textContent);
await p.click('.tb-coach-dismiss');
await p.waitForTimeout(200);
await p.click('[data-surface="tutorial"]');
await p.waitForTimeout(250);
await p.click('.tb-popover-tutorial .tb-row');
await p.waitForTimeout(250);
const after = await p.evaluate(() => ({ badge: document.querySelector('.tb-badge.is-amber')?.textContent, progress: document.querySelector('.tb-progress-label').textContent, done: document.querySelectorAll('.tb-popover-tutorial .tb-row.is-done').length }));
ok('completing a tutorial decrements the amber badge', before === '9' && after.badge === '8', `${before} -> ${after.badge}`);
ok('completing a tutorial updates the progress line', after.progress === '已完成 1 / 9' && after.done === 1, JSON.stringify(after));

const bar = await p.evaluate(() => {
  const track = document.querySelector('.tb-progress-track');
  const fill = document.querySelector('.tb-progress-fill');
  const label = document.querySelector('.tb-progress-label');
  const t = track.getBoundingClientRect();
  const f = fill.getBoundingClientRect();
  const l = label.getBoundingClientRect();
  return {
    trackH: +t.height.toFixed(2), radius: getComputedStyle(track).borderRadius, fillBg: getComputedStyle(fill).backgroundColor,
    ratio: +(f.width / t.width).toFixed(3), gap: +(l.x - (t.x + t.width)).toFixed(2), role: track.getAttribute('role'),
  };
});
ok('tutorial shows a 6px pill progress track', near(bar.trackH, 6) && bar.radius === '9999px', `${bar.trackH} ${bar.radius}`);
ok('progress fill uses the badge amber', bar.fillBg === REF.badgeAmber, bar.fillBg);
ok('progress fill tracks the completed count', near(bar.ratio, 1 / 9, 0.01), String(bar.ratio));
ok('progress sits 13px from its label', near(bar.gap, 13), String(bar.gap));
ok('progress track is a progressbar', bar.role === 'progressbar', String(bar.role));

for (let i = 2; i <= 9; i += 1) {
  await p.click(`.tb-popover-tutorial .tb-row:nth-child(${i})`);
  await p.waitForTimeout(120);
}
await p.waitForTimeout(400);
const finished = await p.evaluate(() => {
  const t = document.querySelector('.tb-progress-track');
  const f = document.querySelector('.tb-progress-fill');
  return {
    ratio: +(f.getBoundingClientRect().width / t.getBoundingClientRect().width).toFixed(3),
    label: document.querySelector('.tb-progress-label').textContent,
    badgeGone: document.querySelector('.tb-badge.is-amber') === null,
    celebrating: !!document.querySelector('.tb-celebration'),
    text: document.querySelector('.tb-celebration-card h2')?.textContent,
    sub: document.querySelector('.tb-celebration-card p')?.textContent,
    particles: document.querySelectorAll('.tb-firework-particle').length,
  };
});
ok('finishing every tutorial fills the track', finished.ratio > 0.99 && finished.label === '已完成 9 / 9', `${finished.ratio} ${finished.label}`);
ok('the amber badge disappears once nothing is left', finished.badgeGone, String(finished.badgeGone));
ok('finishing every tutorial celebrates', finished.celebrating && finished.text?.includes('恭喜') && finished.sub?.includes('尽情享受'), JSON.stringify({ t: finished.text, s: finished.sub }));
ok('the celebration animates fireworks', finished.particles >= 60, String(finished.particles));
const particleRule = await p.evaluate(() => {
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) if (rule.selectorText === '.tb-firework-particle') return rule.style.opacity;
    } catch { /* ignore inaccessible sheets */ }
  }
  return null;
});
ok('a delayed burst never stacks its particles', particleRule === '0', String(particleRule));

await p.click('.tb-celebration-card .tb-button-primary');
await p.waitForTimeout(300);
ok('the celebration can be dismissed', (await p.evaluate(() => document.querySelectorAll('.tb-celebration').length)) === 0, 'still up');

await p.keyboard.press('Escape');
await p.waitForTimeout(200);

// ------------------------------------------------------------ narrow forms

for (const [w, h, want] of [[768, 900, { inset: 32, barH: 65, entryW: 32, radius: '6px', brand: true }], [390, 844, { inset: 16, barH: 56, entryW: 36, radius: '8px', brand: false }]]) {
  await p.setViewportSize({ width: w, height: h });
  await p.waitForTimeout(400);
  const narrow = await p.evaluate(() => {
    const bar = document.querySelector('.tb-topbar').getBoundingClientRect();
    const c = getComputedStyle(document.querySelector('.tb-topbar'));
    const entries = [...document.querySelectorAll('.tb-entry')];
    const last = entries[entries.length - 1].getBoundingClientRect();
    const first = entries[0].getBoundingClientRect();
    const cs = getComputedStyle(entries[0]);
    const burger = document.querySelector('.tb-mobile-menu');
    const bs = getComputedStyle(burger);
    const br = burger.getBoundingClientRect();
    return {
      barH: +bar.height.toFixed(2), pad: c.padding,
      count: entries.length, w: first.width, radius: cs.borderRadius, rightInset: +(innerWidth - last.x - last.width).toFixed(2),
      brandVisible: getComputedStyle(document.querySelector('.tb-brand')).display !== 'none',
      burger: { display: bs.display, x: +br.x.toFixed(2), w: br.width, h: br.height, radius: bs.borderRadius },
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  ok(`@${w} bar is ${want.barH}px with a ${want.inset}px right inset`, near(narrow.barH, want.barH) && near(narrow.rightInset, want.inset), `${narrow.barH} ${narrow.rightInset}`);
  ok(`@${w} entries are ${want.entryW}px at ${want.radius}`, near(narrow.w, want.entryW) && narrow.radius === want.radius, `${narrow.w} ${narrow.radius}`);
  ok(`@${w} brand ${want.brand ? 'stays visible' : 'gives way to the hamburger'}`, narrow.brandVisible === want.brand && (want.brand ? narrow.burger.display === 'none' : near(narrow.burger.x, 16) && near(narrow.burger.w, 36) && narrow.burger.radius === '8px'), JSON.stringify(narrow.burger));
  ok(`@${w} keeps all five entries and no overflow`, narrow.count === 5 && !narrow.overflow, `${narrow.count} overflow=${narrow.overflow}`);
}

// The ticket also asks where the three nav entries go once the top bar drops them.
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(400);
await p.click('.tb-mobile-menu');
await p.waitForTimeout(500);
const drawerNav = await p.evaluate(() => {
  const nav = document.querySelector('.tb-mobile-nav');
  if (!nav) return null;
  const rows = [...nav.querySelectorAll('.tb-module-row')];
  const first = rows[0].getBoundingClientRect();
  const current = nav.querySelector('.tb-module-row.is-active');
  const c = current ? getComputedStyle(current) : null;
  // The drawer lays its rows out full-bleed, so the reference width to match is a
  // module row in the same drawer rather than the 232px desktop row width.
  const moduleRow = document.querySelector('.tb-module-list .tb-module-row')?.getBoundingClientRect();
  return {
    labels: rows.map((r) => r.textContent.trim()),
    rowH: +first.height.toFixed(2),
    rowW: +first.width.toFixed(2),
    moduleRowW: moduleRow ? +moduleRow.width.toFixed(2) : null,
    currentLabel: current?.textContent.trim(),
    currentBg: c?.backgroundColor,
    currentColor: c?.color,
  };
});
ok('narrow drawer carries 首页 / 日历 / 支持', drawerNav?.labels.join(',') === '首页,日历,支持', drawerNav?.labels.join(','));
ok('drawer nav rows reuse the sidebar row geometry', drawerNav && near(drawerNav.rowH, 36) && near(drawerNav.rowW, drawerNav.moduleRowW), JSON.stringify(drawerNav));
ok('drawer nav marks the current destination', drawerNav?.currentLabel === '首页' && drawerNav?.currentColor === 'rgb(255, 255, 255)' && drawerNav?.currentBg === 'rgb(46, 49, 55)', JSON.stringify(drawerNav));

await p.click('.tb-mobile-nav .tb-module-row[aria-expanded]');
await p.waitForTimeout(300);
const supportItems = await p.evaluate(() => [...document.querySelectorAll('.tb-mobile-support-item')].map((e) => e.lastElementChild.textContent.trim()));
ok('drawer support row expands the same three items as the menu', supportItems.join(',') === '设置,帮助,更新日志', supportItems.join(','));

ok('no console errors', errs.length === 0, errs.join(' | '));

console.log('=== TOP BAR ===');
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

await p.setViewportSize({ width: 1440, height: 900 });
await openWorkbench(p, BASE);
await p.waitForTimeout(600);
await settle();
await p.screenshot({ path: `${OUT}/PC-CW12-coach.png` });
await p.click('.tb-coach-dismiss');
await p.waitForTimeout(250);
await p.screenshot({ path: `${OUT}/PC-CW01-expanded.png` });
await p.hover('[data-surface="support"]');
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/PC-CW06-support.png` });
await p.mouse.move(700, 400);
await p.waitForTimeout(300);
await p.click('[data-surface="notifications"]');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/PC-CW08-notifications.png` });
await p.keyboard.press('Escape');
await p.click('[data-surface="feedback"]');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/PC-CW09-feedback.png` });
await p.keyboard.press('Escape');
await p.click('[data-surface="tutorial"]');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/PC-CW10-tutorial.png` });
await p.keyboard.press('Escape');
await p.click('[data-surface="privacy"]');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/PC-CW11-privacy.png` });
await p.keyboard.press('Escape');
await p.click('[data-surface="search"]');
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/PC-CW07-search.png` });
await p.keyboard.press('Escape');
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(400);
await p.click('.tb-mobile-menu');
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/手机-CW14-drawer.png` });
await p.keyboard.press('Escape');
await p.setViewportSize({ width: 1440, height: 900 });
await p.waitForTimeout(400);
await openWorkbench(p, BASE);
await p.waitForTimeout(600);
await settle();
await p.click('.tb-coach-dismiss');
await p.waitForTimeout(200);
await p.click('[data-surface="tutorial"]');
await p.waitForTimeout(300);
for (let i = 1; i <= 9; i += 1) {
  await p.click(`.tb-popover-tutorial .tb-row:nth-child(${i})`);
  await p.waitForTimeout(120);
}
// Wait past the last burst's delay so the screenshot shows the full effect.
await p.waitForTimeout(2400);
await p.screenshot({ path: `${OUT}/PC-CW13-celebration.png` });
await b.close();
process.exit(failed === 0 ? 0 : 1);
