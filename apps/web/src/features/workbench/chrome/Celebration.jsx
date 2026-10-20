import { useEffect, useRef } from 'react';
import { tx, useLocale } from '../../../i18n/presentation.js';
/*
 * Tutorial complete: a short fireworks show on a canvas behind a calm card.
 * Rockets climb for about a second and burst; the sparks fall, twinkle and
 * fade over a dark, blurred page. About seven seconds, then the sky goes
 * quiet. Skipped entirely with reduced motion.
 */
const PALETTES = [
  ['#ffd60a', '#ff9f0a', '#fff4c2'],
  ['#0a84ff', '#64d2ff', '#e1f3ff'],
  ['#ff375f', '#ff6482', '#ffd1dc'],
  ['#30d158', '#a6f4c5', '#e8fff0'],
  ['#bf5af2', '#da8fff', '#f3e3ff'],
  ['#ff9f0a', '#ffd60a', '#ff375f'],
];
const pick = (a) => a[(Math.random() * a.length) | 0];

/*
 * Physics run on real time (dt in 60fps frames), so the show looks the same
 * on a slow machine. Rockets climb for about a second and burst into one of
 * five shapes: peony, double ring, willow (a long golden fall), crossette (comets
 * that split again) and, rarely, a heart.
 */
function show(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const G = 0.06;
  const rockets = [];
  const sparks = [];
  // a volley up front, a steady middle, a finale
  const plan = [0, 90, 160, 520, 900, 1250, 1500, 1900, 2300, 2600, 3000, 3350, 3700, 3760, 3820, 3900, 3980, 4100].map((at) => ({ at, done: false }));
  const start = performance.now();
  let last = start;
  let raf = 0;

  const launch = () => {
    const x = w * (0.15 + Math.random() * 0.7);
    const ty = h * (0.12 + Math.random() * 0.32);
    const vy = -Math.sqrt(2 * G * 4 * (h - ty)) ; // reaches ty with the rocket's lighter gravity
    rockets.push({ x, y: h + 6, vx: (Math.random() - 0.5) * 1.6, vy, palette: pick(PALETTES), trail: [], wob: Math.random() * 6 });
  };
  const spark = (x, y, angle, speed, o) => sparks.push({
    x, y, px: x, py: y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 1, decay: 0.010 + Math.random() * 0.008,
    drag: 0.965, grav: 1, size: 1.8, color: '#fff', twinkle: false, split: 0,
    ...o,
  });
  const burst = (x, y, palette) => {
    const r = Math.random();
    const [c1, c2, c3] = palette;
    if (r < 0.32) { // peony with a bright core
      const n = 150;
      for (let i = 0; i < n; i += 1) spark(x, y, Math.random() * Math.PI * 2, Math.pow(Math.random(), 0.45) * 7.4, { color: i % 4 ? c1 : c2, twinkle: Math.random() < 0.35 });
      for (let i = 0; i < 30; i += 1) spark(x, y, Math.random() * Math.PI * 2, Math.random() * 2.2, { color: c3, decay: 0.03, size: 1.4 });
    } else if (r < 0.56) { // double ring, slightly tilted
      const tilt = Math.random() * Math.PI;
      const squash = 0.55 + Math.random() * 0.45;
      [[6.6, c1, 84], [3.8, c2, 56]].forEach(([sp, color, n]) => {
        for (let i = 0; i < n; i += 1) {
          const a = (Math.PI * 2 * i) / n;
          const ex = Math.cos(a) * sp, ey = Math.sin(a) * sp * squash;
          spark(x, y, Math.atan2(ex * Math.sin(tilt) + ey * Math.cos(tilt), ex * Math.cos(tilt) - ey * Math.sin(tilt)), Math.hypot(ex, ey), { color, decay: 0.013, size: 2 });
        }
      });
    } else if (r < 0.76) { // willow: long golden fall
      for (let i = 0; i < 90; i += 1) spark(x, y, Math.random() * Math.PI * 2, 1.8 + Math.random() * 4.8, { color: i % 3 ? '#ffcf6b' : '#fff1c9', drag: 0.975, grav: 0.55, decay: 0.0055 + Math.random() * 0.004, size: 1.5, twinkle: true });
    } else if (r < 0.94) { // crossette: a few comets that split again
      for (let i = 0; i < 10; i += 1) spark(x, y, (Math.PI * 2 * i) / 10 + Math.random() * 0.2, 5.4, { color: c1, decay: 0.022, size: 2.4, split: 1, palette });
    } else { // heart
      for (let i = 0; i < 90; i += 1) {
        const t = (Math.PI * 2 * i) / 90;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        spark(x, y, Math.atan2(hy, hx), Math.hypot(hx, hy) * 0.4, { color: i % 2 ? '#ff375f' : '#ff8fa8', decay: 0.012, size: 2, drag: 0.955, grav: 0.5 });
      }
    }
    sparks.push({ x, y, life: 1, decay: 0.07, flash: true, size: 46, color: c3 });
  };

  const frame = (now) => {
    const dt = Math.min(3, (now - last) / 16.667);
    last = now;
    const t = now - start;
    plan.forEach((p) => { if (!p.done && t >= p.at) { p.done = true; launch(); } });
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.78, dt)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const r = rockets[i];
      r.wob += 0.3 * dt;
      const ox = r.x, oy = r.y;
      r.x += (r.vx + Math.sin(r.wob) * 0.25) * dt; r.y += r.vy * dt; r.vy += G * 4 * dt;
      ctx.strokeStyle = r.palette[2];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(r.x, r.y); ctx.stroke();
      if (Math.random() < 0.6 * dt) sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: (Math.random() - 0.5) * 0.6, vy: Math.random() * 0.8, life: 0.7, decay: 0.05, drag: 0.9, grav: 1, size: 1.1, color: '#ffd9a0' });
      if (r.vy >= -0.5) { burst(r.x, r.y, r.palette); rockets.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.life -= s.decay * dt;
      if (s.life <= 0) {
        if (s.split) for (let k = 0; k < 7; k += 1) spark(s.x, s.y, Math.random() * Math.PI * 2, 1.2 + Math.random() * 1.6, { color: pick(s.palette), decay: 0.024, size: 1.4, twinkle: true });
        sparks.splice(i, 1);
        continue;
      }
      if (s.flash) {
        const rad = s.size * (1.6 - s.life * 0.6);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
        g.addColorStop(0, `rgba(255,255,255,${0.55 * s.life})`);
        g.addColorStop(0.4, `rgba(255,240,210,${0.18 * s.life})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      s.px = s.x; s.py = s.y;
      const d = Math.pow(s.drag, dt);
      s.vx *= d; s.vy = s.vy * d + 0.05 * s.grav * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      let a = Math.min(1, s.life * 1.4);
      if (s.twinkle && s.life < 0.55 && Math.random() < 0.45) a *= 0.15;
      ctx.globalAlpha = a;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * (0.5 + s.life * 0.7);
      ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x + 0.01, s.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (t < 7000 || sparks.length || rockets.length) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

export function Celebration({ onClose }) {
  useLocale();
  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  useEffect(() => {
    buttonRef.current?.focus();
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    let stop = () => {};
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && canvasRef.current) stop = show(canvasRef.current);
    return () => { stop(); document.removeEventListener('keydown', key); };
  }, [onClose]);
  return (
    <div className="tbx-celebrate" role="dialog" aria-modal="true" aria-labelledby="tbx-celebrate-title">
      <div className="tbx-celebrate-scrim" onPointerDown={onClose} />
      <canvas className="tbx-celebrate-sky" ref={canvasRef} aria-hidden="true" />
      <div className="tbx-celebrate-card">
        <span className="tbx-celebrate-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </span>
        <h2 id="tbx-celebrate-title">{tx('一切就绪。')}</h2>
        <p>{tx('TeachBuddy 的每个角落，你都去过了。')}</p>
        <button type="button" className="tbx-celebrate-go" ref={buttonRef} onClick={onClose}>{tx('开始吧')}</button>
      </div>
    </div>
  );
}
