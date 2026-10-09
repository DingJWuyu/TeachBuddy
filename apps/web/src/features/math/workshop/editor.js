import { mountWorkshopGraph } from '../geogebra/workshop-runtime.js';
import { validateOperations } from '../geogebra/operations.js';
import { workshopToolMode } from '../../../../../../packages/shared/src/math/workshop-runtime.js';
import { GeoGebraError } from '../geogebra/controller.js';
import { createWorkshopSource, cloneWorkshopSource, validateWorkshopSourceShape, validateWorkshopReferences, reconcileWorkshopReferences } from '../../../../../../packages/shared/src/math/workshop.js';

const copy = cloneWorkshopSource;
const fields = ['formulas', 'graph', 'view', 'steps', 'initialStepId', 'animation', 'traceObjects'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const aborted = () => new DOMException('修改已取消。', 'AbortError');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** One history and edit revision for formulas, GGB and teaching steps. */
export async function mountWorkshopEditor(container, { source = createWorkshopSource(), language = 'zh-CN', onChange, onError, onRecovery, signal } = {}) {
  validateWorkshopSourceShape(source);
  let current = copy(source), editRevision = 0, graph = null, graphEpoch = 0, graphFingerprint = '', selection = null;
  let disposed = false, busy = false, beforeBatch = null, beforeBatchObjects = [], beforeBatchViews = null, mode = 'edit', previewStepId = null;
  let visibleFormulaIds = current.formulas.map(formula => formula.id);
  let previewSelection = null, activeTool = 'select', previewTool = 'select';
  let timer, manualGroup = false, previewView = current.view, playbackFrame, playbackToken = 0;
  const lifetime = new AbortController(), undoStack = [], redoStack = [];
  const externalAbort = () => destroy();
  function canvasKeydown(event) {
    if (event.target.closest?.('input, textarea, [contenteditable=true]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); event.stopPropagation();
      if (!busy && mode === 'edit') history(event.shiftKey ? redoStack : undoStack, event.shiftKey ? undoStack : redoStack, event.shiftKey ? 'redo' : 'undo').catch(error => onError?.(error));
    }
    // Deletion must pass through apply so step/dependency consequences can be confirmed.
    if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); }
  }
  container.addEventListener('keydown', canvasKeydown, true);
  signal?.addEventListener('abort', externalAbort, { once: true });
  if (signal?.aborted) lifetime.abort();
  function assertLive() { if (disposed || lifetime.signal.aborted) throw new GeoGebraError('disposed', '编辑器已关闭。'); }
  function assertIdle() { assertLive(); if (busy) throw new GeoGebraError('busy', '正在修改作品，请稍后再试。'); }
  function stopPlayback() { playbackToken++; cancelAnimationFrame(playbackFrame); graph?.stopAnimation(); }
  function notify(origin) {
    if (disposed) return;
    try { onChange?.({ ...read(), origin }); } catch (error) { onError?.(error); }
  }
  function closeManualGroup() { clearTimeout(timer); manualGroup = false; }
  function remember(before) {
    undoStack.push(copy(before)); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0;
  }
  function syncManual() {
    if (!graph || busy || mode !== 'edit' || disposed) return false;
    const next = graph.fingerprint();
    if (next === graphFingerprint) return false;
    const before = copy(current);
    const nextSource = { ...copy(current), graph: { base64: graph.captureNow() } };
    validateWorkshopReferences(nextSource, graph.objects());
    if (!manualGroup) { remember(before); manualGroup = true; }
    current = nextSource; graphFingerprint = next; editRevision++;
    clearTimeout(timer); timer = setTimeout(() => { manualGroup = false; notify('manual'); }, 180);
    return true;
  }
  function graphChanged() {
    if (busy || disposed) return;
    if (mode === 'preview') { notify('preview'); return; }
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { syncManual(); manualGroup = false; notify('manual'); } catch (error) { onError?.(error); }
    }, 120);
  }
  async function cancellable(pending, operationSignal) {
    if (!operationSignal) return pending;
    let cancel;
    try { return await Promise.race([pending, new Promise((_, reject) => { cancel = () => reject(aborted()); operationSignal.addEventListener('abort', cancel, { once: true }); if (operationSignal.aborted) cancel(); })]); }
    finally { operationSignal.removeEventListener('abort', cancel); }
  }
  async function mountGraph(base64, view, operationSignal) {
    const epoch = ++graphEpoch;
    const mountSignal = operationSignal ? AbortSignal.any([lifetime.signal, operationSignal]) : lifetime.signal;
    const instance = await mountWorkshopGraph(container, { base64, view, language, signal: mountSignal,
      onChange: graphChanged,
      onSelect: name => { if (!busy) { selection = name ? { type: 'object', id: name } : null; notify('selection'); } },
      onLayout: () => { if (graph && !busy) graphFingerprint = graph.fingerprint(); },
    });
    if (disposed || epoch !== graphEpoch || mountSignal.aborted) { instance.destroy(); throw aborted(); }
    graph = instance; graphFingerprint = graph.fingerprint();
    return instance;
  }
  function objects() { return busy ? copy(beforeBatchObjects) : graph ? graph.objects() : []; }
  function read() {
    assertLive(); syncManual();
    const stable = busy && beforeBatch ? beforeBatch : { editRevision, source: current };
    return { editRevision: stable.editRevision, source: copy(stable.source), objects: objects(), views: busy ? copy(beforeBatchViews) : graph?.views() || null, selection: copy(selection),
      mode, activeTool, previewStepId, visibleFormulaIds: [...visibleFormulaIds], view: mode === 'preview' ? previewView : current.view,
      canUndo: !busy && mode === 'edit' && undoStack.length > 0, canRedo: !busy && mode === 'edit' && redoStack.length > 0, busy };
  }
  function captureNow() {
    assertLive();
    if (busy && beforeBatch) return copy(beforeBatch);
    syncManual();
    return { editRevision, source: copy(current) };
  }
  async function capture() { return captureNow(); }
  async function restoreSource(next, operationSignal) {
    if (next.graph) {
      if (graph) await cancellable(graph.load(next.graph.base64, next.view), operationSignal);
      else await cancellable(mountGraph(next.graph.base64, next.view, operationSignal), operationSignal);
      graphFingerprint = graph.fingerprint(); graph.setTool(activeTool);
      validateWorkshopReferences(next, graph.objects());
    } else { graph?.destroy(); graph = null; graphFingerprint = ''; container.replaceChildren(); validateWorkshopReferences(next, []); }
  }
  async function recover(before, failure) {
    // Lazy commands can complete after abort/timeout. They must never touch the
    // recovered instance. Remount even if GGB claims its own undo is complete.
    graphEpoch++; graph?.destroy(); graph = null; graphFingerprint = '';
    current = copy(before.source); editRevision = before.editRevision;
    if (disposed) return;
    onRecovery?.(copy(before), failure);
    try { await restoreSource(current); graph?.select(selection?.type === 'object' ? selection.id : null); }
    catch (error) {
      graph?.destroy(); graph = null;
      throw new GeoGebraError('rollback', '内容已保留，但画布恢复未完成，请重新打开作品。', { cause: failure, rollbackError: error, recoverySource: copy(current) });
    }
  }
  async function execute(operations, operationSignal) {
    for (let i = 0; i < operations.length; i++) {
      if (operationSignal?.aborted || lifetime.signal.aborted) throw aborted();
      let timeout, cancel;
      const signals = [operationSignal, lifetime.signal].filter(Boolean);
      try {
        await Promise.race([
          graph.execute(operations[i]),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new GeoGebraError('command-timeout', '数学构造未完成，请重试。')), 30000); }),
          new Promise((_, reject) => { cancel = () => reject(aborted()); signals.forEach(value => value.addEventListener('abort', cancel, { once: true })); if (signals.some(value => value.aborted)) cancel(); }),
        ]);
        if (signals.some(value => value.aborted)) throw aborted();
      } catch (error) { error.operationIndex = i; throw error; }
      finally { clearTimeout(timeout); signals.forEach(value => value.removeEventListener('abort', cancel)); }
    }
  }
  function openingSource() {
    const next = copy(current);
    if (graph) next.graph = { base64: graph.captureNow() };
    next.view = previewView;
    if (previewStepId) {
      next.initialStepId = previewStepId;
      const step = next.steps.find(value => value.id === previewStepId);
      step.values = graph ? Object.fromEntries(graph.objects().filter(value => value.slider).map(value => [value.name, value.numericValue])) : {};
      step.visibleObjects = graph ? graph.objects().filter(value => value.visible).map(value => value.name) : [];
      step.visibleFormulas = [...visibleFormulaIds]; step.view = previewView;
    }
    return next;
  }
  async function apply({ baseEditRevision, changes }, operationSignal) {
    assertIdle();
    if (operationSignal?.aborted) throw aborted();
    syncManual();
    if (!Number.isInteger(baseEditRevision) || baseEditRevision !== editRevision) throw new GeoGebraError('conflict', '作品已有新的修改，请依据当前内容继续。', { editRevision });
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(key => ![...fields, 'operations', 'confirmReferences', 'setAsOpening'].includes(key))) throw new GeoGebraError('operation', '修改内容格式不正确。');
    for (const field of ['confirmReferences', 'setAsOpening']) if (own(changes, field) && typeof changes[field] !== 'boolean') throw new GeoGebraError('operation', '修改确认需要布尔值。');
    if (changes.setAsOpening && mode !== 'preview') throw new GeoGebraError('preview', '请进入试演后设为开场。');
    if (mode === 'preview' && !changes.setAsOpening) throw new GeoGebraError('preview', '请退出试演后再编辑作品。');
    const operations = own(changes, 'operations') ? changes.operations : [];
    if (!Array.isArray(operations)) throw new GeoGebraError('operation', '图形操作需要数组。');
    const before = captureNow(), selectionBefore = copy(selection); closeManualGroup(); stopPlayback();
    let next = changes.setAsOpening ? openingSource() : copy(current);
    for (const field of fields) if (own(changes, field)) next[field] = copy(changes[field]);
    if (!Array.isArray(next.formulas) || !Array.isArray(next.steps) || next.steps.some(step => !step || !Array.isArray(step.visibleFormulas))) validateWorkshopSourceShape(next);
    // A newly created step uses the first step as opening unless explicitly set.
    if (!next.steps.length) next.initialStepId = null;
    else if (!next.steps.some(step => step.id === next.initialStepId) && !own(changes, 'initialStepId')) next.initialStepId = next.steps[0].id;
    const formulaIds = new Set(next.formulas.map(formula => formula.id));
    next.steps.forEach(step => { step.visibleFormulas = step.visibleFormulas.filter(id => formulaIds.has(id)); });
    validateWorkshopSourceShape(next);
    const existing = graph ? graph.objects() : [];
    if (operations.length) validateOperations(operations, existing.map(object => object.name));
    beforeBatch = before; beforeBatchObjects = existing; beforeBatchViews = graph?.views() || null; busy = true;
    const wasPreview = mode === 'preview'; mode = 'edit'; previewStepId = null;
    const previousInert = container.inert; container.inert = true;
    notify('busy');
    let failure, mutedGraph;
    try {
      if (wasPreview && !changes.setAsOpening) await restoreSource(before.source);
      if (own(changes, 'graph') || changes.setAsOpening) await restoreSource(next, operationSignal);
      if (operations.length && !graph) await cancellable(mountGraph('', next.view, operationSignal), operationSignal);
      mutedGraph = graph; mutedGraph?.mute(true); mutedGraph?.setRepainting(false);
      await execute(operations, operationSignal);
      if (operationSignal?.aborted || lifetime.signal.aborted) throw aborted();
      if (graph) {
        graph.setView(next.view);
        if (graph.fingerprint() !== graphFingerprint || (!next.graph && graph.objects().length)) next.graph = { base64: graph.captureNow() };
        const renames = {};
        for (const operation of operations.filter(op => op.type === 'rename')) {
          for (const [name, value] of Object.entries(renames)) if (value === operation.name) renames[name] = operation.newName;
          renames[operation.name] = operation.newName;
        }
        if (selection?.type === 'object' && own(renames, selection.id)) selection = { type: 'object', id: renames[selection.id] };
        next = reconcileWorkshopReferences(next, graph.objects(), { renames, confirm: changes.confirmReferences === true || operations.some(op => op.type === 'delete' && op.allowDependents === true) });
      } else validateWorkshopReferences(next, []);
      if (!same(before.source, next)) { remember(before.source); current = next; editRevision++; }
      if (graph) graphFingerprint = graph.fingerprint();
      visibleFormulaIds = current.formulas.map(formula => formula.id);
      if (selection?.type === 'object' && !graph?.objects().some(object => object.name === selection.id)) selection = null;
      if (selection?.type === 'formula' && !current.formulas.some(formula => formula.id === selection.id)) selection = null;
      if (selection?.type === 'step' && !current.steps.some(step => step.id === selection.id)) selection = null;
      graph?.select(selection?.type === 'object' ? selection.id : null);
    } catch (error) {
      failure = error; selection = selectionBefore;
      try { await recover(before, error); } catch (rollbackError) { failure = rollbackError; }
    } finally {
      if (graph) { graph.setRepainting(true); if (graph === mutedGraph) graph.mute(false); graphFingerprint = graph.fingerprint(); }
      busy = false; beforeBatch = null; beforeBatchObjects = []; container.inert = previousInert;
      if (!disposed) notify(failure ? 'rollback' : 'apply');
    }
    if (failure) { if (failure.name !== 'AbortError') onError?.(failure); throw failure; }
    return read();
  }
  async function history(from, to, origin) {
    assertIdle(); if (mode !== 'edit') throw new GeoGebraError('preview', '请退出试演后再撤销。');
    syncManual(); closeManualGroup(); if (!from.length) return read();
    const before = captureNow(), target = copy(from.at(-1));
    beforeBatch = before; beforeBatchObjects = objects(); beforeBatchViews = graph?.views() || null; busy = true;
    const previousInert = container.inert; container.inert = true;
    let failure;
    try { await restoreSource(target); from.pop(); to.push(before.source); current = target; if (!current.graph) activeTool = 'select'; editRevision++; visibleFormulaIds = current.formulas.map(formula => formula.id);
      if (selection?.type === 'object' && !graph?.objects().some(object => object.name === selection.id)) selection = null;
      if (selection?.type === 'formula' && !current.formulas.some(formula => formula.id === selection.id)) selection = null;
      if (selection?.type === 'step' && !current.steps.some(step => step.id === selection.id)) selection = null;
      graph?.select(selection?.type === 'object' ? selection.id : null); }
    catch (error) { failure = error; await recover(before, error); }
    finally { busy = false; beforeBatch = null; beforeBatchObjects = []; container.inert = previousInert; notify(failure ? 'rollback' : origin); }
    if (failure) throw failure; return read();
  }
  async function preview({ stepId = current.initialStepId, values = {}, view, play = false } = {}) {
    assertIdle(); syncManual(); closeManualGroup(); stopPlayback();
    if (mode === 'edit') { previewSelection = copy(selection); previewTool = activeTool; }
    activeTool = 'select';
    const step = stepId == null ? null : current.steps.find(value => value.id === stepId);
    if (stepId != null && !step) throw new GeoGebraError('preview', '教学步骤不存在。');
    const before = captureNow(); beforeBatch = before; beforeBatchObjects = objects(); beforeBatchViews = graph?.views() || null; busy = true;
    const previousInert = container.inert; container.inert = true;
    try {
      await restoreSource(current);
      mode = 'preview'; previewStepId = step?.id || null; previewView = view || step?.view || current.view;
      if (!['plane', 'space', 'split'].includes(previewView)) throw new GeoGebraError('preview', '试演视图不正确。');
      visibleFormulaIds = step ? [...step.visibleFormulas] : current.formulas.map(formula => formula.id);
      if (graph) {
        graph.mute(true);
        try {
          const parameters = graph.objects().filter(object => object.slider);
          const allValues = { ...(step?.values || Object.fromEntries(parameters.map(object => [object.name, object.numericValue]))), ...values };
          if (Object.keys(values).some(name => !parameters.some(object => object.name === name))) throw new GeoGebraError('preview', '试演取值引用了不存在的滑杆。');
          for (const [name, value] of Object.entries(allValues)) await graph.execute({ type: 'setValue', name, value });
          if (step) for (const object of graph.objects()) await graph.execute({ type: 'style', name: object.name, visible: step.visibleObjects.includes(object.name) });
          graph.setView(previewView); graph.setTraces(current.traceObjects);
        } finally { graph.mute(false); }
      } else if (Object.keys(values).length) throw new GeoGebraError('preview', '当前作品没有图形参数。');
    } catch (error) { mode = 'edit'; previewStepId = null; visibleFormulaIds = current.formulas.map(formula => formula.id); await recover(before, error); throw error; }
    finally { busy = false; beforeBatch = null; beforeBatchObjects = []; container.inert = previousInert; notify('preview'); }
    if (play && current.animation && graph) startPlayback();
    return read();
  }
  function startPlayback() {
    const animation = current.animation, object = graph.objects().find(value => value.name === animation.parameter), token = ++playbackToken;
    const low = Number(object.slider.min), high = Number(object.slider.max), start = performance.now();
    function tick(now) {
      if (disposed || mode !== 'preview' || token !== playbackToken || busy) return;
      let progress = Math.max(0, (now - start) / (animation.seconds * 1000));
      if (animation.mode === 'once') progress = Math.min(1, progress);
      else if (animation.mode === 'loop') progress %= 1;
      else { progress %= 2; if (progress > 1) progress = 2 - progress; }
      const runtime = graph; runtime.mute(true);
      Promise.resolve(runtime.execute({ type: 'setValue', name: object.name, value: low + (high - low) * progress })).finally(() => runtime.mute(false)).then(() => {
        if (token !== playbackToken || disposed) return;
        notify('preview');
        if (animation.mode !== 'once' || progress < 1) playbackFrame = requestAnimationFrame(tick);
      }).catch(error => { if (!disposed && token === playbackToken) { stopPlayback(); onError?.(error); } });
    }
    playbackFrame = requestAnimationFrame(tick);
  }
  async function endPreview() {
    assertIdle(); if (mode === 'edit') return read(); stopPlayback();
    beforeBatch = captureNow(); beforeBatchObjects = objects(); beforeBatchViews = graph?.views() || null; busy = true;
    try { await restoreSource(current); }
    catch (error) { await recover(beforeBatch, error); throw error; }
    finally {
      mode = 'edit'; previewStepId = null; visibleFormulaIds = current.formulas.map(formula => formula.id); selection = copy(previewSelection); activeTool = graph ? previewTool : 'select'; graph?.setTool(activeTool); graph?.select(selection?.type === 'object' ? selection.id : null);
      busy = false; beforeBatch = null; beforeBatchObjects = []; notify('end-preview');
    }
    return read();
  }
  function select(value) {
    assertIdle();
    if (value !== null) {
      if (!value || !['object', 'formula', 'step'].includes(value.type) || typeof value.id !== 'string') throw new GeoGebraError('selection', '选择内容格式不正确。');
      const exists = value.type === 'object' ? graph?.objects().some(object => object.name === value.id) : current[value.type === 'formula' ? 'formulas' : 'steps'].some(item => item.id === value.id);
      if (!exists) throw new GeoGebraError('selection', '所选内容已不存在。');
    }
    graph?.select(value?.type === 'object' ? value.id : null); selection = copy(value); notify('selection'); return read();
  }
  async function setTool(tool, operationSignal) {
    assertIdle(); workshopToolMode(tool); const nextTool = tool === 'move' ? 'select' : tool;
    if (mode === 'preview' && nextTool !== 'select') throw new GeoGebraError('preview', '请退出试演后再添加图形。');
    syncManual(); closeManualGroup();
    if (!graph && nextTool !== 'select') {
      const before = captureNow(); beforeBatch = before; beforeBatchObjects = []; beforeBatchViews = null; busy = true; notify('busy');
      try { await cancellable(mountGraph('', current.view, operationSignal), operationSignal); }
      catch (error) { await recover(before, error); throw error; }
      finally { busy = false; beforeBatch = null; beforeBatchObjects = []; }
    }
    activeTool = nextTool; graph?.setTool(activeTool); if (graph) graphFingerprint = graph.fingerprint();
    notify('tool'); return read();
  }
  async function exportGraph(options = {}) {
    assertIdle(); syncManual(); if (!graph || !current.graph) throw new GeoGebraError('export', '当前作品没有图形。');
    stopPlayback();
    const targetView = options.view || (read().view === 'space' ? 'space' : 'plane');
    beforeBatch = captureNow(); beforeBatchObjects = objects(); beforeBatchViews = graph.views(); busy = true;
    const previousInert = container.inert; container.inert = true; notify('export');
    try { return await graph.exportImage({ ...options, view: targetView }); }
    finally {
      if (graph) graphFingerprint = graph.fingerprint();
      busy = false; beforeBatch = null; beforeBatchObjects = []; container.inert = previousInert; notify('export');
    }
  }
  function destroy() {
    if (disposed) return;
    try { captureNow(); } catch { /* beforeBatch/current remain the complete recovery source */ }
    disposed = true; graphEpoch++; clearTimeout(timer); stopPlayback(); lifetime.abort(); graph?.destroy(); graph = null; signal?.removeEventListener('abort', externalAbort); container.removeEventListener('keydown', canvasKeydown, true);
  }
  try { assertLive(); if (current.graph) { busy = true; await mountGraph(current.graph.base64, current.view); validateWorkshopReferences(current, graph.objects()); busy = false; } else validateWorkshopReferences(current, []); }
  catch (error) { destroy(); throw error; }
  return { read, capture, captureNow, apply, undo: () => history(undoStack, redoStack, 'undo'), redo: () => history(redoStack, undoStack, 'redo'), preview, endPreview, select, setTool, exportGraph,
    setLanguage: value => { assertLive(); language = value; graph?.setLanguage(value); }, destroy };
}
