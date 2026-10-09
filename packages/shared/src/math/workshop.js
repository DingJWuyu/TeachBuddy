const views = new Set(['plane', 'space', 'split']);
const label = /^[A-Za-z][A-Za-z0-9_]*$/;
const id = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
export const cloneWorkshopSource = source => structuredClone(source);
export class WorkshopSourceError extends Error {
  constructor(field, message, details = {}) {
    super(message); this.name = 'WorkshopSourceError'; this.code = 'invalid-workshop'; this.field = field; this.reason = details.reason || 'invalid-value'; Object.assign(this, details);
  }
}
function fail(field, message, details = {}) {
  const pointer = '/' + field.replace(/\[(\d+)\]/g, '.$1').split('.').join('/');
  throw new WorkshopSourceError(pointer, message, details);
}
function record(value, fields, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, '需要对象。');
  if (Object.keys(value).some(key => !fields.includes(key)) || fields.some(key => !own(value, key))) fail(field, '字段不完整或包含未知字段。', { reason: 'invalid-fields' });
}
function text(value, max, field, nonempty = false) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail(field, `需要${nonempty ? '非空' : ''}文本，最多 ${max} 字符。`);
}
function names(value, field, pattern = label) {
  if (!Array.isArray(value) || value.length > 300 || value.some(name => typeof name !== 'string' || !pattern.test(name)) || new Set(value).size !== value.length) fail(field, '名称集合格式不正确或包含重复值。', { reason: 'invalid-names' });
}
export function createWorkshopSource() {
  return { schemaVersion: 1, kind: 'workshop', formulas: [], graph: null, view: 'plane', steps: [], initialStepId: null, animation: null, traceObjects: [] };
}
/** Throws WorkshopSourceError with stable field/reason; returns the original source. */
export function validateWorkshopSourceShape(source) {
  record(source, ['schemaVersion', 'kind', 'formulas', 'graph', 'view', 'steps', 'initialStepId', 'animation', 'traceObjects'], 'source');
  if (source.schemaVersion !== 1 || source.kind !== 'workshop') fail('source.kind', '不是受支持的统一数学作品。');
  if (!views.has(source.view)) fail('source.view', '视图需要 plane、space 或 split。');
  if (!Array.isArray(source.formulas) || source.formulas.length > 100) fail('source.formulas', '最多支持 100 条公式。');
  const formulaIds = new Set();
  source.formulas.forEach((formula, i) => {
    const field = `source.formulas[${i}]`;
    record(formula, ['id', 'latex', 'caption', 'includeCaption', 'color', 'fontSize'], field);
    if (typeof formula.id !== 'string' || !id.test(formula.id) || formulaIds.has(formula.id)) fail(`${field}.id`, '公式 ID 无效或重复。', { reason: formulaIds.has(formula.id) ? 'duplicate-id' : 'invalid-id' });
    formulaIds.add(formula.id); text(formula.latex, 10000, `${field}.latex`, true); text(formula.caption, 2000, `${field}.caption`);
    if (typeof formula.includeCaption !== 'boolean') fail(`${field}.includeCaption`, '需要布尔值。');
    if (typeof formula.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(formula.color)) fail(`${field}.color`, '需要 #RRGGBB 颜色。');
    if (!Number.isFinite(formula.fontSize) || formula.fontSize < 8 || formula.fontSize > 96) fail(`${field}.fontSize`, '字号需要 8 至 96。', { reason: 'invalid-range' });
  });
  if (source.graph !== null) {
    record(source.graph, ['base64'], 'source.graph');
    if (typeof source.graph.base64 !== 'string' || !source.graph.base64 || source.graph.base64.length > 1048576 || !/^[A-Za-z0-9+/]+={0,2}$/.test(source.graph.base64)) fail('source.graph.base64', '需要完整 GGB 文件，最多 1 MiB。');
  }
  if (!Array.isArray(source.steps) || source.steps.length > 100) fail('source.steps', '最多支持 100 个教学步骤。');
  const stepIds = new Set();
  source.steps.forEach((step, i) => {
    const field = `source.steps[${i}]`;
    record(step, ['id', 'title', 'description', 'values', 'visibleObjects', 'visibleFormulas', 'view'], field);
    if (typeof step.id !== 'string' || !id.test(step.id) || stepIds.has(step.id)) fail(`${field}.id`, '步骤 ID 无效或重复。', { reason: stepIds.has(step.id) ? 'duplicate-id' : 'invalid-id' });
    stepIds.add(step.id); text(step.title, 200, `${field}.title`, true); text(step.description, 2000, `${field}.description`);
    if (!views.has(step.view)) fail(`${field}.view`, '视图需要 plane、space 或 split。');
    if (!step.values || typeof step.values !== 'object' || Array.isArray(step.values) || Object.keys(step.values).length > 300 || Object.entries(step.values).some(([key, value]) => !label.test(key) || !Number.isFinite(value))) fail(`${field}.values`, '参数取值格式不正确。');
    names(step.visibleObjects, `${field}.visibleObjects`); names(step.visibleFormulas, `${field}.visibleFormulas`, id);
    if (step.visibleFormulas.some(name => !formulaIds.has(name))) fail(`${field}.visibleFormulas`, '引用了不存在的公式。', { reason: 'invalid-reference' });
  });
  if (source.steps.length ? !stepIds.has(source.initialStepId) : source.initialStepId !== null) fail('source.initialStepId', '初始步骤必须指向当前步骤，无步骤时应为空。', { reason: 'invalid-reference' });
  if (source.animation !== null) {
    record(source.animation, ['parameter', 'seconds', 'mode'], 'source.animation');
    if (!label.test(source.animation.parameter) || typeof source.animation.parameter !== 'string') fail('source.animation.parameter', '参数名称不正确。');
    if (!Number.isFinite(source.animation.seconds) || source.animation.seconds < 0.1 || source.animation.seconds > 3600) fail('source.animation.seconds', '播放时长需要 0.1 至 3600 秒。', { reason: 'invalid-range' });
    if (!['once', 'loop', 'bounce'].includes(source.animation.mode)) fail('source.animation.mode', '播放模式不正确。');
  }
  names(source.traceObjects, 'source.traceObjects');
  if (source.traceObjects.length > 10) fail('source.traceObjects', '最多支持 10 个轨迹点。', { reason: 'invalid-range' });
  return source;
}
/** objects: [{name,type,numericValue,slider:null|{min,max,step}}], derived from GGB. */
export function validateWorkshopReferences(source, objects) {
  validateWorkshopSourceShape(source);
  const byName = new Map(objects.map(object => [object.name, object]));
  const parameters = objects.filter(object => object.slider);
  if (!source.graph && objects.length) fail('source.graph', '无图形源时不应存在构造对象。');
  source.steps.forEach((step, i) => {
    const field = `source.steps[${i}]`;
    if (Object.keys(step.values).length !== parameters.length || parameters.some(object => !own(step.values, object.name))) fail(`${field}.values`, '每个滑杆必须恰好保存一个取值。', { reason: 'invalid-reference' });
    for (const object of parameters) {
      const low = Number(object.slider.min), high = Number(object.slider.max), value = step.values[object.name];
      if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high || value < low || value > high) fail(`${field}.values.${object.name}`, '步骤参数超出当前范围。', { reason: 'invalid-range' });
    }
    if (step.visibleObjects.some(name => !byName.has(name))) fail(`${field}.visibleObjects`, '引用了不存在的图形对象。', { reason: 'invalid-reference' });
  });
  if (source.animation && !parameters.some(object => object.name === source.animation.parameter)) fail('source.animation.parameter', '播放对象必须是当前滑杆。', { reason: 'invalid-reference' });
  if (source.traceObjects.some(name => !byName.has(name))) fail('source.traceObjects', '轨迹引用了不存在的对象。', { reason: 'invalid-reference' });
  if (source.traceObjects.some(name => byName.get(name)?.type !== 'point')) fail('source.traceObjects', '轨迹只支持点对象。', { reason: 'invalid-type' });
  return source;
}
export function visibleWorkshopFormulas(source, stepId = source.initialStepId) {
  const step = source.steps.find(candidate => candidate.id === stepId);
  return step ? source.formulas.filter(formula => step.visibleFormulas.includes(formula.id)) : source.formulas;
}
/** Repairs references after a confirmed delete/range change, and fills new sliders. */
export function reconcileWorkshopReferences(source, objects, { renames = {}, confirm = false } = {}) {
  const next = cloneWorkshopSource(source);
  const byName = new Map(objects.map(object => [object.name, object]));
  const parameters = objects.filter(object => object.slider);
  const renamed = name => own(renames, name) ? renames[name] : name;
  const affected = [];
  next.steps.forEach(step => {
    const previous = Object.fromEntries(Object.entries(step.values).map(([name, value]) => [renamed(name), value]));
    const values = {};
    for (const object of parameters) {
      const raw = own(previous, object.name) ? previous[object.name] : object.numericValue;
      const value = Math.min(Number(object.slider.max), Math.max(Number(object.slider.min), raw));
      values[object.name] = value;
      if (own(previous, object.name) && value !== raw) affected.push(step.id);
    }
    if (Object.keys(previous).some(name => !parameters.some(object => object.name === name))) affected.push(step.id);
    step.values = values;
    const visible = step.visibleObjects.map(renamed).filter(name => byName.has(name));
    if (visible.length !== step.visibleObjects.length) affected.push(step.id);
    step.visibleObjects = visible;
    step.visibleFormulas = step.visibleFormulas.filter(formulaId => next.formulas.some(formula => formula.id === formulaId));
  });
  const traceObjects = next.traceObjects.map(renamed).filter(name => byName.has(name));
  if (traceObjects.length !== next.traceObjects.length) affected.push('trace');
  next.traceObjects = traceObjects;
  if (next.animation) {
    next.animation.parameter = renamed(next.animation.parameter);
    if (!parameters.some(object => object.name === next.animation.parameter)) { affected.push('animation'); next.animation = null; }
  }
  if (affected.length && !confirm) fail('source.steps', '此操作会改变教学步骤、播放或轨迹，请先确认影响。', { reason: 'confirmation-required', affectedStepIds: [...new Set(affected)] });
  if (!next.steps.length) next.initialStepId = null;
  validateWorkshopReferences(next, objects);
  return next;
}
