import {
  parseExpression,
  finiteCoordinate,
  MathSourceError,
} from "./expression.js";
export const escapeXml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const number = (n) => Number(n.toFixed(5));
export function projectSpace(point, azimuth, elevation) {
  const a = (azimuth * Math.PI) / 180,
    e = (elevation * Math.PI) / 180;
  return [
    point.x * Math.cos(a) - point.y * Math.sin(a),
    point.z * Math.cos(e) -
      (point.x * Math.sin(a) + point.y * Math.cos(a)) * Math.sin(e),
  ];
}
// Adaptive midpoint subdivision in output coordinates. Unresolved steep cells
// terminate a subpath instead of drawing a spurious chord across a pole.
export function sampleCurve(evaluate, min, max, map, height) {
  const paths = [];
  let current = [],
    budget = 50000;
  const flush = () => {
    if (current.length > 1) paths.push(current);
    current = [];
  };
  const point = (x) => {
    const y = evaluate({ x });
    return Number.isFinite(y) ? map([x, y]) : null;
  };
  function cell(a, b, pa, pb, depth) {
    if (--budget < 0) {
      flush();
      return;
    }
    const mid = (a + b) / 2,
      pm = point(mid);
    // Entirely undefined sample cells cannot contribute a segment. Keep the
    // subdivision budget for boundaries and valid portions of the domain.
    if (!pa && !pb && !pm) {
      flush();
      return;
    }
    const finite = pa && pb && pm;
    const error = finite ? Math.abs(pm[1] - (pa[1] + pb[1]) / 2) : Infinity;
    const steep = finite && Math.abs(pa[1] - pb[1]) > height / 2;
    if ((!finite || error > 0.35 || steep) && depth < 14) {
      cell(a, mid, pa, pm, depth + 1);
      cell(mid, b, pm, pb, depth + 1);
      return;
    }
    if (!finite || error > 2 || steep) {
      flush();
      return;
    }
    if (Math.max(Math.abs(pa[1]), Math.abs(pb[1])) > height * 8) {
      flush();
      return;
    }
    if (!current.length) current.push(pa);
    current.push(pb);
  }
  for (let i = 0; i < 64; i++) {
    const a = min + ((max - min) * i) / 64,
      b = min + ((max - min) * (i + 1)) / 64;
    cell(a, b, point(a), point(b), 0);
  }
  flush();
  return paths;
}
export function viewportTransform(viewport) {
  const w = viewport.width,
    h = viewport.height,
    pad = 34;
  const scale = Math.min(
    (w - 2 * pad) / (viewport.xMax - viewport.xMin),
    (h - 2 * pad) / (viewport.yMax - viewport.yMin),
  );
  const map = ([x, y]) => [
    w / 2 + (x - (viewport.xMin + viewport.xMax) / 2) * scale,
    h / 2 - (y - (viewport.yMin + viewport.yMax) / 2) * scale,
  ];
  return {
    scale,
    map,
    unmap: ([x, y]) => [
      (x - w / 2) / scale + (viewport.xMin + viewport.xMax) / 2,
      (h / 2 - y) / scale + (viewport.yMin + viewport.yMax) / 2,
    ],
  };
}
export function renderGraphic(
  source,
  { width, background = "transparent", parameters = {}, interactive = false } = {},
) {
  const viewport = source.scene?.viewport ?? source.viewport;
  const w = viewport.width,
    h = viewport.height;
  const { scale, map } = viewportTransform(viewport);
  const xy = (p) => map([finiteCoordinate(p.x), finiteCoordinate(p.y)]);
  const elements = [],
    labels = [];
  const style = (s) =>
    `stroke="${escapeXml(s.stroke)}" fill="${escapeXml(s.fill ?? "none")}" stroke-width="${escapeXml(s.width)}"${s.dash === "solid" ? "" : ` stroke-dasharray="${s.dash === "dashed" ? "8 5" : "2 4"}"`} stroke-linejoin="round" stroke-linecap="round"`;
  const selection = (kind, index, name) => interactive ? ` data-selection="${kind}:${index}" role="button" tabindex="0" aria-label="选择 ${escapeXml(name)}"` : '';
  const label = (p, text, s, offset = { dx: 0, dy: 0 }, attributes = '') => {
    if (!text) return;
    // Each character fits in one em; wrapping also bounds arbitrarily long CJK labels.
    const columns = Math.max(1, Math.floor((w - 16) / s.fontSize));
    const chars = Array.from(text),
      lines = [];
    for (let i = 0; i < chars.length; i += columns)
      lines.push(chars.slice(i, i + columns).join(""));
    if (lines.length * s.fontSize * 1.25 > h - 16)
      throw new MathSourceError(
        "invalid-geometry",
        "文字超出画布，请缩小字号或精简标注",
      );
    const maxWidth =
      Math.max(...lines.map((l) => Array.from(l).length)) * s.fontSize;
    const x = Math.max(8, Math.min(w - maxWidth - 8, p[0] + offset.dx));
    const y = Math.max(
      s.fontSize + 8,
      Math.min(
        h - 8 - (lines.length - 1) * s.fontSize * 1.25,
        p[1] + offset.dy,
      ),
    );
    labels.push(
      `<g${attributes}><text x="${number(x)}" y="${number(y)}" fill="${escapeXml(s.stroke)}" font-size="${escapeXml(s.fontSize)}" font-family="sans-serif">${lines.map((line, i) => `<tspan x="${number(x)}" dy="${i ? s.fontSize * 1.25 : 0}">${escapeXml(line)}</tspan>`).join("")}</text></g>`,
    );
  };
  const line = (a, b, s, arrow = "none") => {
    elements.push(
      `<path d="M${a.map(number).join(" ")} L${b.map(number).join(" ")}" ${style({ ...s, fill: null })}/>`,
    );
    const head = (from, to) => {
      const angle = Math.atan2(to[1] - from[1], to[0] - from[0]),
        size = 8 + s.width;
      const q = [-0.48, 0.48].map((d) => [
        to[0] - size * Math.cos(angle + d),
        to[1] - size * Math.sin(angle + d),
      ]);
      elements.push(
        `<path d="M${q[0].map(number).join(" ")} L${to.map(number).join(" ")} L${q[1].map(number).join(" ")}" ${style({ ...s, fill: null, dash: "solid" })}/>`,
      );
    };
    if (arrow !== "none") head(a, b);
    if (arrow === "both") head(b, a);
  };
  if (background === "white")
    elements.push(`<rect width="${escapeXml(w)}" height="${escapeXml(h)}" fill="#ffffff"/>`);
  if (viewport.grid) {
    const step =
      10 **
      Math.floor(
        Math.log10(
          Math.max(
            viewport.xMax - viewport.xMin,
            viewport.yMax - viewport.yMin,
          ) / 10,
        ),
      );
    // Count with small integer indices: adding step to a large coordinate
    // may round back to that coordinate and never make progress.
    const gridStyle = {
      stroke: "#e5e7eb",
      fill: null,
      width: 0.5,
      dash: "solid",
    };
    for (let i = 0; i <= 100; i++) {
      const x = Math.ceil(viewport.xMin / step) * step + i * step;
      if (x > viewport.xMax) break;
      line(map([x, viewport.yMin]), map([x, viewport.yMax]), gridStyle);
    }
    for (let i = 0; i <= 100; i++) {
      const y = Math.ceil(viewport.yMin / step) * step + i * step;
      if (y > viewport.yMax) break;
      line(map([viewport.xMin, y]), map([viewport.xMax, y]), gridStyle);
    }
  }
  if (viewport.axes) {
    const s = { stroke: "#94a3b8", fill: null, width: 1, dash: "solid" };
    line(map([viewport.xMin, 0]), map([viewport.xMax, 0]), s, "end");
    line(map([0, viewport.yMin]), map([0, viewport.yMax]), s, "end");
  }
  if (source.kind === "space") {
    const points = new Map(
      source.points.map((p) => [
        p.id,
        map(projectSpace(p, source.azimuth, source.elevation)),
      ]),
    );
    for (const [index, edge] of source.edges.entries()) {
      elements.push(`<g${selection('edge', index, `${edge.from} → ${edge.to}`)}>`);
      line(points.get(edge.from), points.get(edge.to), edge.style);
      elements.push('</g>');
    }
    for (const [index, p] of source.points.entries()) {
      const attributes = selection('object', index, p.id);
      if (interactive) {
        const [x, y] = points.get(p.id);
        elements.push(`<g${attributes}><circle cx="${number(x)}" cy="${number(y)}" r="3" ${style({ ...p.style, fill: p.style.stroke })}/></g>`);
      }
      label(points.get(p.id), p.label.text, p.style, p.label, attributes);
    }
  } else
    for (const [index, e] of source.scene.elements.entries()) {
      const attributes = selection('object', index, e.id);
      elements.push(`<g data-object="${escapeXml(e.id)}"${attributes}>`);
      switch (e.type) {
        case "point": {
          const p = xy(e.at);
          elements.push(
            `<circle cx="${number(p[0])}" cy="${number(p[1])}" r="3" ${style({ ...e.style, fill: e.style.fill ?? e.style.stroke })}/>`,
          );
          label(p, e.label.text, e.style, e.label, attributes);
          break;
        }
        case "line":
          line(xy(e.from), xy(e.to), e.style, e.arrow);
          break;
        case "polyline":
          elements.push(
            `<${e.closed ? "polygon" : "polyline"} points="${e.points.map((p) => xy(p).map(number).join(",")).join(" ")}" ${style(e.style)}/>`,
          );
          break;
        case "ellipse": {
          const p = xy(e.center),
            rx = finiteCoordinate(e.rx),
            ry = finiteCoordinate(e.ry);
          if (rx <= 0 || ry <= 0)
            throw new MathSourceError("invalid-geometry", "半径必须大于零");
          elements.push(
            `<ellipse cx="${number(p[0])}" cy="${number(p[1])}" rx="${number(rx * scale)}" ry="${number(ry * scale)}" ${style(e.style)}/>`,
          );
          break;
        }
        case "text":
          label(xy(e.at), e.text, e.style, undefined, attributes);
          break;
        case "function": {
          const min = Math.max(e.domain.min, viewport.xMin),
            max = Math.min(e.domain.max, viewport.xMax);
          const evaluate = parseExpression(e.expression, [
            "x",
            ...Object.keys(parameters),
          ]);
          const paths =
            min < max
              ? sampleCurve(
                  (values) => evaluate({ ...parameters, ...values }),
                  min,
                  max,
                  map,
                  h,
                )
              : [];
          if (!paths.length)
            throw new MathSourceError(
              "invalid-expression",
              "当前窗口内函数无有效值",
            );
          for (const points of paths)
            elements.push(
              `<path d="${points.map((p, i) => `${i ? "L" : "M"}${p.map(number).join(" ")}`).join(" ")}" ${style({ ...e.style, fill: null })}/>`,
            );
          const visible = paths.flat().filter((p) => p[1] >= 0 && p[1] <= h);
          if (visible.length)
            label(visible.at(-1), e.label.text, e.style, e.label, attributes);
          break;
        }
      }
      elements.push("</g>");
    }
  const outputWidth = width ?? w,
    outputHeight = Math.round((outputWidth * h) / w);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeXml(outputWidth)}" height="${outputHeight}" viewBox="0 0 ${escapeXml(w)} ${escapeXml(h)}"><defs><clipPath id="plot"><rect width="${escapeXml(w)}" height="${escapeXml(h)}"/></clipPath></defs><g clip-path="url(#plot)">${elements.join("")}</g>${labels.join("")}</svg>`;
}
