import {
  snapParameter,
  parameterOnGrid,
} from "@teachbuddy/shared/math/dynamic";

// Return a message key; the UI translates it without coupling editing to the browser.
export function parameterError(source, parameter, index) {
  if (
    !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(parameter.name) ||
    [
      "x",
      "pi",
      "e",
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "atan",
      "sqrt",
      "abs",
      "exp",
      "ln",
      "log10",
    ].includes(parameter.name)
  )
    return "参数名须以英文字母开头，不能使用 x、pi 或函数名。";
  if (
    source.parameters.some((p, i) => i !== index && p.name === parameter.name)
  )
    return "参数名不能重复。";
  if (
    !(parameter.min < parameter.max) ||
    !(parameter.step > 0) ||
    !parameterOnGrid(parameter, parameter.max)
  )
    return "最大值须大于最小值，且范围须能被正数步长整分。";
  if (!parameterOnGrid(parameter, parameter.initial))
    return "初值须在范围内，并落在步长刻度上。";
  if (!parameter.label.trim() || parameter.label.length > 100)
    return "参数标签须为1至100字。";
  if (
    [parameter.min, parameter.max, parameter.initial].some(
      (v) => !Number.isFinite(v) || Math.abs(v) > 1000000,
    ) ||
    parameter.step < 0.000001 ||
    parameter.step > 1000000
  )
    return "参数范围与初值须在正负一百万以内，步长须在百万分之一至一百万之间。";
  return "";
}

// Only expression fields and parameter interpolation are rewritten, never IDs or ordinary prose.
function replaceParameter(elements, oldName, replacement, labelReplacement) {
  const expression = (text) =>
    text.replace(
      /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*/g,
      (token) => (token === oldName ? replacement : token),
    );
  const label = (text) =>
    text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
      name === oldName ? labelReplacement : match,
    );
  const point = (p) => ({ x: expression(p.x), y: expression(p.y) });
  return elements.map((original) => {
    const e = { ...original };
    if (e.expression !== undefined) e.expression = expression(e.expression);
    for (const key of ["at", "from", "to", "center"])
      if (e[key]) e[key] = point(e[key]);
    if (e.points) e.points = e.points.map(point);
    for (const key of ["rx", "ry"]) if (e[key]) e[key] = expression(e[key]);
    if (e.label) e.label = { ...e.label, text: label(e.label.text) };
    if (e.text !== undefined) e.text = label(e.text);
    return e;
  });
}
export function updateParameter(source, index, next) {
  const old = source.parameters[index];
  return {
    ...source,
    parameters: source.parameters.map((p, i) => (i === index ? next : p)),
    scene: {
      ...source.scene,
      elements: replaceParameter(
        source.scene.elements,
        old.name,
        next.name,
        `{${next.name}}`,
      ),
    },
    steps: source.steps.map((step) => ({
      ...step,
      values: step.values.map((v) =>
        v.name === old.name
          ? { name: next.name, value: snapParameter(next, v.value) }
          : v,
      ),
    })),
    ...(source.animation ? { animation: { ...source.animation, parameter: source.animation.parameter === old.name ? next.name : source.animation.parameter } } : {}),
    drags: source.drags.map((d) => ({
      ...d,
      xParameter: d.xParameter === old.name ? next.name : d.xParameter,
      yParameter: d.yParameter === old.name ? next.name : d.yParameter,
    })),
  };
}
export function addParameter(source) {
  let i = 1;
  while (source.parameters.some((p) => p.name === `p${i}`)) i++;
  const parameter = {
    name: `p${i}`,
    label: `参数 p${i}`,
    min: -5,
    max: 5,
    step: 1,
    initial: 0,
  };
  return {
    ...source,
    parameters: [...source.parameters, parameter],
    steps: source.steps.map((s) => ({
      ...s,
      values: [...s.values, { name: parameter.name, value: parameter.initial }],
    })),
  };
}
export function removeParameter(source, index) {
  const p = source.parameters[index];
  if (source.animation?.parameter === p.name) { source = { ...source }; delete source.animation; }
  return {
    ...source,
    parameters: source.parameters.filter((_, i) => i !== index),
    scene: {
      ...source.scene,
      elements: replaceParameter(
        source.scene.elements,
        p.name,
        `(${p.initial})`,
        String(p.initial),
      ),
    },
    steps: source.steps.map((s) => ({
      ...s,
      values: s.values.filter((v) => v.name !== p.name),
    })),
    drags: source.drags
      .map((d) => ({
        ...d,
        xParameter: d.xParameter === p.name ? null : d.xParameter,
        yParameter: d.yParameter === p.name ? null : d.yParameter,
      }))
      .filter((d) => d.xParameter || d.yParameter),
  };
}
export function updateObjects(source, elements, renamed = null) {
  if (source.kind === "space") {
    const ids = new Set(elements.map((e) => e.id));
    const rename = (id) => (renamed && id === renamed.from ? renamed.to : id);
    return {
      ...source,
      points: elements,
      ...(source.faces ? { faces: source.faces.map(f => ({ ...f, vertices: f.vertices.map(rename) })).filter(f => f.vertices.every(id => ids.has(id))) } : {}),
      ...(source.sections && elements.length < source.points.length ? { sections: [] } : {}),
      edges: source.edges
        .map((e) => ({ ...e, from: rename(e.from), to: rename(e.to) }))
        .filter((e) => ids.has(e.from) && ids.has(e.to)),
    };
  }
  const renamedId = id => renamed && id === renamed.from ? renamed.to : id;
  elements = elements.map(e => e.construction ? { ...e, construction: { ...e.construction, refs: e.construction.refs.map(renamedId) } } : e);
  let length;
  do { length = elements.length; const ids = new Set(elements.map(e => e.id)); elements = elements.filter(e => !e.construction || e.construction.refs.every(id => ids.has(id))); } while (elements.length !== length);
  const next = { ...source, scene: { ...source.scene, elements } };
  if (source.kind !== "dynamic") return next;
  const ids = new Set(elements.map((e) => e.id));
  const previous = new Set(source.scene.elements.map((e) => e.id));
  const added = elements
    .filter((e) => !previous.has(e.id) && e.id !== renamed?.to)
    .map((e) => e.id);
  const rename = (id) => (renamed && id === renamed.from ? renamed.to : id);
  if (source.traceIds) next.traceIds = source.traceIds.map(rename).filter(id => ids.has(id));
  next.steps = source.steps.map((s) => ({
    ...s,
    visibleIds: [
      ...s.visibleIds.map(rename).filter((id) => ids.has(id)),
      ...added,
    ],
  }));
  next.drags = source.drags
    .map((d) => ({ ...d, pointId: rename(d.pointId) }))
    .filter((d) => ids.has(d.pointId) && !elements.find(e => e.id === d.pointId)?.construction);
  // Editing a bound coordinate releases only that axis, preserving the other one.
  next.drags = next.drags
    .map((d) => {
      const point = elements.find((e) => e.id === d.pointId);
      return {
        ...d,
        xParameter: point.at.x === d.xParameter ? d.xParameter : null,
        yParameter: point.at.y === d.yParameter ? d.yParameter : null,
      };
    })
    .filter((d) => d.xParameter || d.yParameter);
  return next;
}
export function updateDrag(source, index, next) {
  const drags = source.drags.map((d, i) => (i === index ? next : d));
  const elements = source.scene.elements.map((e) =>
    e.id === next.pointId
      ? {
          ...e,
          at: {
            x: next.xParameter ?? e.at.x,
            y: next.yParameter ?? e.at.y,
          },
        }
      : e,
  );
  return { ...source, drags, scene: { ...source.scene, elements } };
}
