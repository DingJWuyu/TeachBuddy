import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { pct, longDate } from './util.js';

/*
 * Charts drawn in SVG, sized to their container. One y axis (score rate,
 * 0–100%), thin lines, 8px markers with a surface ring, recessive grid, a
 * crosshair and tooltip on hover, and a legend whenever there are two series.
 */

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
function smooth(pts) {
  if (pts.length < 3) return path(pts);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * points: [{ key, title, date, values: { [seriesKey]: rate|null }, band: [lo, hi] | null, note }]
 * series: [{ key, label, tone: 'green'|'grey'|'blue', dashed }]
 */
export function TrendChart({ points, series, selected, onSelect, height = 220, bandLabel, label }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 40, r: 18, t: 16, b: 34 };
  const w = Math.max(width, 280);
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const n = points.length;
  const x = (i) => pad.l + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (rate) => pad.t + innerH * (1 - rate);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const active = hover ?? points.findIndex((p) => p.key === selected);
  const move = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };
  const band = points.map((p, i) => p.band && [x(i), y(p.band[1]), y(p.band[0])]).filter(Boolean);
  const tip = hover != null ? points[hover] : null;
  return (
    <figure className="cr-chart" aria-label={label}>
      {series.length > 1 && (
        <figcaption className="cr-legend">
          {series.map((s) => <span key={s.key} className={cx('cr-legend-item', `is-${s.tone}`, s.dashed && 'is-dashed')}><i />{s.label}</span>)}
          {bandLabel && <span className="cr-legend-item is-band"><i />{bandLabel}</span>}
        </figcaption>
      )}
      <div className="cr-chart-plot" ref={ref} style={{ height }}>
        {width > 0 && (
          <svg width={w} height={height} role="img" onPointerMove={move} onPointerLeave={() => setHover(null)} onClick={() => hover != null && onSelect?.(points[hover].key)}>
            {ticks.map((t) => (
              <g key={t} className="cr-grid">
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}%</text>
              </g>
            ))}
            {points.map((p, i) => (
              <text key={p.key} className={cx('cr-axis-label', i === active && 'is-on')} x={x(i)} y={height - 10} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}>{p.title}</text>
            ))}
            {band.length > 1 && (
              <path className="cr-band" d={`${path(band.map((b) => [b[0], b[1]]))} L${band.slice().reverse().map((b) => `${b[0].toFixed(1)},${b[2].toFixed(1)}`).join(' L')} Z`} />
            )}
            {active >= 0 && <line className="cr-crosshair" x1={x(active)} x2={x(active)} y1={pad.t} y2={pad.t + innerH} />}
            {series.map((s) => {
              const pts = points.map((p, i) => (p.values[s.key] == null ? null : [x(i), y(p.values[s.key])])).filter(Boolean);
              return (
                <g key={s.key} className={cx('cr-series', `is-${s.tone}`, s.dashed && 'is-dashed')}>
                  {pts.length > 1 && <path className="cr-line" d={smooth(pts)} pathLength={s.dashed ? undefined : 1} />}
                  {points.map((p, i) => p.values[s.key] != null && (
                    <circle key={p.key} className={cx('cr-dot', i === active && 'is-on')} cx={x(i)} cy={y(p.values[s.key])} r={i === active ? 5.5 : 4} style={{ '--i': i }} />
                  ))}
                </g>
              );
            })}
          </svg>
        )}
        {tip && (
          <div className="cr-tip" style={{ left: Math.min(Math.max(x(hover), 90), w - 90), top: 4 }}>
            <strong>{tip.name || tip.title}</strong>
            <small>{longDate(tip.date)}</small>
            {series.map((s) => <span key={s.key} className={cx('cr-tip-row', `is-${s.tone}`)}><i />{s.label}<b>{pct(tip.values[s.key])}</b></span>)}
            {tip.band && bandLabel && <span className="cr-tip-row is-band"><i />{bandLabel}<b>{pct(tip.band[0])} – {pct(tip.band[1])}</b></span>}
            {tip.note && <em>{tip.note}</em>}
          </div>
        )}
      </div>
    </figure>
  );
}

/* Ten bins of score rate. Missing and absent students never enter a bin. */
export function Histogram({ bins, selected, onSelect, label }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="cr-hist" role="list" aria-label={label}>
      {bins.map((b) => (
        <button
          key={b.bin}
          type="button"
          role="listitem"
          className={cx('cr-hist-bar', selected === b.bin && 'is-on', !b.count && 'is-zero')}
          style={{ '--h': b.count / max, '--i': b.bin }}
          disabled={!b.count}
          onClick={() => onSelect?.(selected === b.bin ? null : b.bin)}
          aria-label={tx('{{from}}–{{to}} 区间 {{n}} 人', { from: b.bin * 10 + '%', to: (b.bin === 9 ? 100 : b.bin * 10 + 10) + '%', n: b.count })}
        >
          <span className="cr-hist-count">{b.count || ''}</span>
          <span className="cr-hist-fill" />
          <span className="cr-hist-label">{b.bin * 10}</span>
        </button>
      ))}
    </div>
  );
}

/* Horizontal rate bars: label, bar, value, and how many were actually known. */
export function RateBars({ rows, onSelect, selected, compareKey }) {
  return (
    <ul className="cr-rates">
      {rows.map((r, i) => (
        <li key={r.id} style={{ '--i': i }}>
          <button type="button" className={cx('cr-rate', selected === r.id && 'is-on')} disabled={!onSelect} onClick={() => onSelect?.(r.id)}>
            <span className="cr-rate-label" title={r.label}>{r.label}</span>
            <span className="cr-rate-track">
              {r.rate != null && <span className={cx('cr-rate-fill', r.rate < 0.6 && 'is-low')} style={{ '--w': r.rate }} />}
              {compareKey && r[compareKey] != null && <span className="cr-rate-mark" style={{ '--w': r[compareKey] }} />}
            </span>
            <span className="cr-rate-value">{r.rate == null ? tx(r.state === 'not-assessed' ? '未考到' : '缺分') : pct(r.rate)}</span>
            {r.meta && <small className="cr-rate-meta">{r.meta}</small>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={cx('cr-stat', tone && `is-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
