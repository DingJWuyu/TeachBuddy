// Temporary CDP capture for Issue #22 (top bar reference).
//
// Reuses the hand-rolled client in ref-capture.mjs, because Chrome 152 rejects
// an Origin-carrying WebSocket handshake (see that file's header).
//
// HARD RULE: exactly one connection per run. Every new CDP connection makes
// Chrome raise a fresh debugging-authorization prompt, which the user has
// explicitly asked us not to repeat. So this script walks every surface in one
// session and only then closes the page.
//
// Read-only: it opens surfaces, measures them and presses Escape. It never
// submits feedback and never toggles tutorial completion.

import fs from 'node:fs';
import { Cdp, setViewport } from './ref-capture.mjs';

const OUT = '/tmp/tb-capture';
const SHOTS = `${OUT}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// In-page probes, injected as source strings so they run in the page context.
// ---------------------------------------------------------------------------

const PROBE_TOP_BAR = `(() => {
  const bar = document.querySelector('header') || document.body.firstElementChild;
  const barRect = bar.getBoundingClientRect();
  const describe = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      aria: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      dataState: el.getAttribute('data-state'),
      href: el.getAttribute('href'),
      text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
      rect: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
      style: {
        display: cs.display, pad: cs.padding, gap: cs.gap, radius: cs.borderRadius,
        bg: cs.backgroundColor, color: cs.color, border: cs.border,
        font: cs.fontSize + '/' + cs.lineHeight + ' w' + cs.fontWeight,
        shadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 90),
        transition: cs.transition === 'all 0s ease 0s' ? 'none' : cs.transition.slice(0, 80),
        letterSpacing: cs.letterSpacing, textTransform: cs.textTransform, opacity: cs.opacity,
      },
    };
  };
  const controls = [];
  for (const el of bar.querySelectorAll('button, a, [role="button"], [role="link"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    controls.push(describe(el));
  }
  // Brand: first non-button visual block on the left.
  const brands = [];
  for (const el of bar.querySelectorAll('svg, img, span, div, strong, a')) {
    const r = el.getBoundingClientRect();
    if (r.x > 200 || r.width < 2 || r.height < 2) continue;
    if (el.children.length > 0 && el.tagName !== 'svg') continue;
    brands.push(describe(el));
  }
  return {
    barRect: { x: barRect.x, y: barRect.y, w: barRect.width, h: barRect.height },
    barStyle: (() => { const cs = getComputedStyle(bar); return {
      pos: cs.position, z: cs.zIndex, h: cs.height, pad: cs.padding, bg: cs.backgroundColor,
      borderBottom: cs.borderBottom, display: cs.display, grid: cs.gridTemplateColumns, gap: cs.gap,
      justify: cs.justifyContent, align: cs.alignItems, maxWidth: cs.maxWidth,
    }; })(),
    controls,
    brands,
  };
})()`;

// Anything that looks like a freshly opened overlay.
const PROBE_OVERLAYS = `(() => {
  const seen = new Set();
  const out = [];
  const candidates = document.querySelectorAll(
    '[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [role="alertdialog"],' +
    '[data-radix-popper-content-wrapper], [data-state="open"], [aria-modal="true"]'
  );
  const nodes = [...candidates];
  for (const el of nodes) {
    if (seen.has(el)) continue;
    for (const n of [el, ...el.querySelectorAll('*')]) seen.add(n);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (r.width < 8 || r.height < 8) continue;
    // Inner structure, shallow: enough to see rows and labels.
    const rows = [];
    for (const child of el.querySelectorAll('*')) {
      const ccs = getComputedStyle(child);
      const cr = child.getBoundingClientRect();
      if (cr.width < 8 || cr.height < 8) continue;
      const ownText = [...child.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\s+/g, ' ').trim();
      if (!ownText && child.children.length > 0) continue;
      rows.push({
        tag: child.tagName.toLowerCase(),
        role: child.getAttribute('role'),
        text: ownText.slice(0, 80),
        rect: { x: +cr.x.toFixed(2), y: +cr.y.toFixed(2), w: +cr.width.toFixed(2), h: +cr.height.toFixed(2) },
        font: ccs.fontSize + '/' + ccs.lineHeight + ' w' + ccs.fontWeight,
        color: ccs.color, bg: ccs.backgroundColor, radius: ccs.borderRadius, pad: ccs.padding,
      });
      if (rows.length > 60) break;
    }
    out.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      ariaModal: el.getAttribute('aria-modal'),
      dataState: el.getAttribute('data-state'),
      cls: String(el.className || '').slice(0, 140),
      rect: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
      style: {
        pos: cs.position, z: cs.zIndex, bg: cs.backgroundColor, radius: cs.borderRadius,
        pad: cs.padding, shadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 140),
        border: cs.border, gap: cs.gap, display: cs.display, transform: cs.transform,
        maxWidth: cs.maxWidth, maxHeight: cs.maxHeight, overflow: cs.overflow,
      },
      text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400),
      rows,
    });
  }
  // Backdrop check.
  const dim = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.8 || r.height < innerHeight * 0.8) continue;
    dim.push({ cls: String(el.className || '').slice(0, 100), bg: cs.backgroundColor, backdrop: cs.backdropFilter, z: cs.zIndex, inset: cs.inset });
  }
  return { overlays: out, backdrops: dim };
})()`;

const PROBE_CLEAN = `(() => {
  const open = document.querySelectorAll('[role="dialog"], [role="menu"], [role="tooltip"], [data-state="open"][role]');
  let visible = 0;
  for (const el of open) { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 8 && r.height > 8) visible += 1; }
  return { openOverlays: visible };
})()`;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

const report = { capturedAt: new Date().toISOString(), steps: [] };

async function main() {
  const cdp = await Cdp.attach();
  const { sessionId, targetId } = await cdp.createPage('https://emstudio.pro/dashboard');
  const ev = (expr) => cdp.evaluate(sessionId, expr);

  const shot = async (name) => {
    await cdp.screenshot(sessionId, `${SHOTS}/${name}.png`);
    return name;
  };

  const clickAt = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 }, sessionId);
    await sleep(80);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
    await sleep(40);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
  };

  const hoverAt = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 }, sessionId);
  };

  const escape = async () => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
    await sleep(500);
  };

  await setViewport(cdp, sessionId, 1440, 900, 1);
  await sleep(5000);

  const gate = await ev(`(() => ({ url: location.href, title: document.title,
    loggedIn: !!document.querySelector('a[href*="/settings"]') || document.body.innerText.includes('创建学期'),
    text: document.body.innerText.replace(/\\s+/g,' ').slice(0, 200) }))()`);
  report.gate = gate;
  console.log('gate:', JSON.stringify(gate).slice(0, 400));
  if (!gate.loggedIn) {
    console.error('NOT LOGGED IN - aborting before touching anything');
    await cdp.closeTarget(targetId);
    cdp.close();
    fs.writeFileSync(`${OUT}/capture.json`, JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const top = await ev(PROBE_TOP_BAR);
  report.topbar = top;
  console.log('topbar controls:', top.controls.length);

  // Right-hand utility entries, ordered left to right by centre x.
  const utils = top.controls
    .filter((c) => c.rect.y < 65 && c.rect.x > 1150 && c.rect.w < 60 && c.rect.w > 20)
    .sort((a, b) => a.rect.x - b.rect.x);
  report.utils = utils;
  console.log('utility buttons:', utils.map((u) => `${u.rect.x}..${u.rect.x + u.rect.w} "${u.aria || u.text}"`).join(' | '));

  // Hover each to read its tooltip.
  for (let i = 0; i < utils.length; i += 1) {
    const u = utils[i];
    await hoverAt(u.rect.x + u.rect.w / 2, u.rect.y + u.rect.h / 2);
    await sleep(900);
    const tip = await ev(PROBE_OVERLAYS);
    report.steps.push({ kind: 'hover', index: i, label: u.aria || u.text, tooltip: tip.overlays.filter((o) => o.role === 'tooltip' || o.rect.h < 60).slice(0, 3) });
    await hoverAt(700, 400);
    await sleep(400);
  }

  // Open each utility surface in turn.
  for (let i = 0; i < utils.length; i += 1) {
    const u = utils[i];
    const name = (u.aria || u.text || `util-${i}`).replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 30);
    await clickAt(u.rect.x + u.rect.w / 2, u.rect.y + u.rect.h / 2);
    await sleep(1200);
    const surface = await ev(PROBE_OVERLAYS);
    const file = await shot(`emstudio-topbar-${i}-${name}`);
    report.steps.push({ kind: 'open', index: i, label: u.aria || u.text, url: await ev('location.href'), surface, shot: file });
    console.log(`open[${i}] ${name}: overlays=${surface.overlays.length} backdrops=${surface.backdrops.length} text="${(surface.overlays[0]?.text || '').slice(0, 90)}"`);
    await escape();
    const clean = await ev(PROBE_CLEAN);
    report.steps.push({ kind: 'closed', index: i, clean });
    if (clean.openOverlays > 0) console.log(`  WARNING: ${clean.openOverlays} overlay(s) still open after Escape`);
    await sleep(400);
  }

  // Support menu, for the record.
  const support = top.controls
    .filter((c) => c.rect.y < 65 && c.text && c.rect.x > 600 && c.rect.x < 1150)
    .sort((a, b) => a.rect.x - b.rect.x);
  report.navItems = support;
  console.log('nav items:', support.map((n) => `${n.text}@${n.rect.x} w${n.rect.w}`).join(' | '));
  const supportBtn = support.find((n) => n.text.includes('支持'));
  if (supportBtn) {
    await clickAt(supportBtn.rect.x + supportBtn.rect.w / 2, supportBtn.rect.y + supportBtn.rect.h / 2);
    await sleep(900);
    const menu = await ev(PROBE_OVERLAYS);
    report.supportMenu = menu;
    await shot('emstudio-topbar-support-menu');
    await escape();
  }

  // Narrow forms.
  for (const [label, w, h] of [['tablet-768', 768, 900], ['mobile-500', 500, 844]]) {
    await setViewport(cdp, sessionId, w, h, 1);
    await sleep(1400);
    const bar = await ev(PROBE_TOP_BAR);
    report[`wide_${label}`] = bar;
    await shot(`emstudio-topbar-${label}`);
    console.log(`${label}: controls=${bar.controls.length}`, bar.controls.map((c) => `${c.aria || c.text}@${c.rect.x}`).join(' | ').slice(0, 300));
  }

  await setViewport(cdp, sessionId, 1440, 900, 1);
  await sleep(500);
  await cdp.closeTarget(targetId);
  cdp.close();
  fs.writeFileSync(`${OUT}/capture.json`, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${OUT}/capture.json`);
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  fs.writeFileSync(`${OUT}/capture.json`, JSON.stringify(report, null, 2));
  process.exit(1);
});
