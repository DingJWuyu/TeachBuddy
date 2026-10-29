import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mountWorkshopEditor } from './workshop/editor.js';
import VisualFormulaInput from './VisualFormulaInput.jsx';
import FormulaPreview from './FormulaPreview.jsx';
import { WorkIllustration } from './WorkspaceHome.jsx';
import { tx } from '../../i18n/presentation.js';
import { MathWebAssistant } from './web-ai/MathWebAssistant.jsx';
import { Icon } from '../../components/icons.jsx';
import { createPortal, flushSync } from 'react-dom';
import { useAuxiliaryTools, ShellContext, useAuxiliaryAssistant } from '../workbench/shellContext.js';
import { ModuleDisclosure, ModulePresence, useModuleDialogFocus } from '../../components/interaction/ModuleMotion.jsx';
import { useMathConfirm } from './useMathConfirm.jsx';
import { Menu as MathMenu, MenuItem } from '../../components/ui/menu.jsx';
import { useMathDialogKeys } from './useMathDialogKeys.js';
import './workshop.css';

const formulaDefaults = { caption: '', includeCaption: true, color: '#1e293b', fontSize: 32 };
const views = [['plane', '平面'], ['space', '三维'], ['split', '双视图']];
const templates = [
  ['函数', [['抛物线', 'f(x)=x^2'], ['正弦函数', 'f(x)=sin(x)'], ['反比例函数', 'f(x)=1/x']]],
  ['点线圆', [['点', 'A=(1,2)'], ['线段', 's=Segment((0,0),(3,2))'], ['圆', 'c=Circle((0,0),2)'], ['三角形', 'p=Polygon((0,0),(3,0),(1,2))']]],
  ['关联构造', [['中点', 'M=Midpoint(A,B)'], ['垂线', 'g=PerpendicularLine(A,s)'], ['交点', 'P=Intersect(f,g)'], ['导函数', 'g(x)=Derivative(f)']]],
  ['立体图形', [['空间点', 'A=(1,2,3)'], ['球', 's=Sphere((0,0,0),2)'], ['立方体', 'c=Cube((0,0,0),(2,0,0))'], ['圆柱', 'c=Cylinder((0,0,0),(0,0,3),1)']]],
];
function parseDefinition(text, names) {
  const match = text.trim().match(/^([A-Za-z][A-Za-z0-9_]*)(?:\(([xyzt](?:,[xyzt])*)\))?\s*=\s*(.+)$/);
  if (match) return { type: 'define', name: match[1], ...(match[2] ? { arguments: match[2].split(',') } : {}), expression: match[3] };
  let name = 'f'; let i = 1;
  while (names.includes(name)) name = `f${i++}`;
  return { type: 'define', name, arguments: ['x'], expression: text.trim() };
}
function objectId(object) { return object.name ?? object.id; }
function objectExpression(object) {
  const definition = (!object.independent && object.command?.trim()) || object.definition?.trim();
  if (definition) return definition;
  return String(object.value ?? '').replace(/^[^=]+\s*=\s*/, '').trim();
}
function parameters(objects) { return objects.filter(object => object.slider); }

export default function WorkshopWorkspace({ draft, accountKey, takeAssistantRequest, busy, pending, status, message, conflictNotice, flushRef,
  onChangeSource, onChangeInput, onTitle, onHome, onSave, onError, onHistory, onCopy, onArchive, onDownload, client, children }) {
  const { t, i18n } = useTranslation('math');
  const graphHost = useRef(null);
  const moduleHost = useRef(null);
  const editor = useRef(null);
  const current = useRef(null);
  const initialSource = useRef(draft.source);
  const localTimer = useRef(null);
  const stepTimer = useRef(null);
  const commitStepRef = useRef(null);
  const [localStep, setLocalStep] = useState(null);
  const localStepRef = useRef(null); localStepRef.current = localStep;
  const autoTimer = useRef(null);
  const [state, setState] = useState({ source: draft.source, objects: [], selection: null, editRevision: 0, mode: 'edit' });
  const [ready, setReady] = useState(false);
  const shell = useContext(ShellContext);
  const [addingFormula, setAddingFormula] = useState(!!draft.workshopInput?.formula);
  const [formulaInput, setFormulaInput] = useState(draft.workshopInput?.formula ?? '');
  const [expression, setExpression] = useState(draft.workshopInput?.expression ?? '');
  const inputRef = useRef({ formula: draft.workshopInput?.formula ?? '', expression: draft.workshopInput?.expression ?? '' });
  function changeInput(field, value) { inputRef.current = { ...inputRef.current, [field]: value }; if (field === 'formula') setFormulaInput(value); else setExpression(value); onChangeInput(inputRef.current); }
  const changeFormulaInput = value => changeInput('formula', value);
  const changeExpression = value => changeInput('expression', value);
  useEffect(() => { const next = { formula: draft.workshopInput?.formula ?? '', expression: draft.workshopInput?.expression ?? '' }; if (next.formula !== inputRef.current.formula || next.expression !== inputRef.current.expression) { inputRef.current = next; setFormulaInput(next.formula); setExpression(next.expression); setAddingFormula(!!next.formula); } }, [draft.workshopInput]);
  const [tool, setTool] = useState(null);
  const [showExpression, setShowExpression] = useState(!!draft.workshopInput?.expression);
  const expressionField = useRef(null);
  useEffect(() => { if (showExpression) expressionField.current?.focus(); }, [showExpression]);
  const [drawingTool, setDrawingTool] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [download, setDownload] = useState({ format: 'png', selection: 'work', background: 'white', width: 1600 });
  const [presenting, setPresenting] = useState(false);
  const nativePresentation = useRef(false);
  const previewOperation = useRef(null);
  const [confirmation, confirmationDialog] = useMathConfirm();
  const [localFormula, setLocalFormula] = useState(null);
  const localFormulaRef = useRef(null);
  function changeLocalFormula(value) { localFormulaRef.current = value; setLocalFormula(value); }
  current.current = { onChangeSource, onSave, onError, draft, busy, pending, status };
  const source = state.source;
  const graphVisible = !!(source.graph || drawingTool || state.graphMounting);
  const selectedFormula = source.formulas.find(formula => state.selection?.type === 'formula' && formula.id === state.selection.id);
  const selectedObject = state.objects.find(object => state.selection?.type === 'object' && objectId(object) === state.selection.id);
  const selectedStep = source.steps.find(step => state.selection?.type === 'step' && step.id === state.selection.id);
  const openingView = source.steps.find(step => step.id === source.initialStepId)?.view ?? source.view;
  const opaqueGraph = !!source.graph && openingView !== 'plane';
  const frozen = !!draft.deletedAt || state.mode === 'preview';
  const editingBlocked = frozen || state.busy;

  const assistant = useCallback(() => <MathWebAssistant key={accountKey} controller={editor.current} title={draft.title} accountKey={accountKey} takeRequest={takeAssistantRequest}/>, [ready, draft.title, accountKey, takeAssistantRequest]);
  // The global assistant button opens this same task column.
  useAuxiliaryAssistant(assistant);
  const capture = useCallback(async () => {
    if (!editor.current) throw new Error(t('制作空间尚未准备好，请稍后再试。'));
    if (localTimer.current) { clearTimeout(localTimer.current); localTimer.current = null; await commitFormulaRef.current?.(); }
    if (stepTimer.current) { clearTimeout(stepTimer.current); stepTimer.current = null; await commitStepRef.current?.(); }
    const snapshot = await editor.current.capture();
    if (JSON.stringify(snapshot.source) !== JSON.stringify(current.current.draft.source)) current.current.onChangeSource(snapshot.source);
    return snapshot;
  }, [t]);
  const commitFormulaRef = useRef(null);
  useEffect(() => {
    const lifetime = new AbortController();
    let mounted;
    mountWorkshopEditor(graphHost.current, { source: initialSource.current, language: i18n.resolvedLanguage,
      signal: lifetime.signal,
      onChange: next => {
        if (lifetime.signal.aborted) return;
        if (next.graphMounting && !next.source.graph) flushSync(() => setState(next));
        else setState(next);
        if (next.origin === 'selection') { if (next.selection && (!next.activeTool || next.activeTool === 'select')) { setTool(null); shell?.openPanel('math-workshop-tools'); } return; }
        if (next.mode === 'preview') return;
        if (JSON.stringify(next.source) !== JSON.stringify(current.current.draft.source)) current.current.onChangeSource(next.source);
      },
      onRecovery: snapshot => { if (!lifetime.signal.aborted) current.current.onChangeSource(snapshot.source); },
      onError: error => {
        // Reference changes are presented by the caller's confirmation, not as a failure notice.
        if (!lifetime.signal.aborted && error.reason !== 'confirmation-required') current.current.onError(error);
      },
    }).then(value => {
      if (lifetime.signal.aborted) { value.destroy(); return; }
      mounted = value; editor.current = value; setState(value.read()); setReady(true);
    }).catch(error => { if (!lifetime.signal.aborted) current.current.onError(error); });
    return () => { lifetime.abort(); mounted?.destroy(); editor.current = null; clearTimeout(localTimer.current); clearTimeout(stepTimer.current); clearTimeout(autoTimer.current); };
  }, []);
  useEffect(() => { if (!initialSource.current.formulas.length && !initialSource.current.graph) shell?.openPanel('ai'); }, []);
  useEffect(() => { editor.current?.setLanguage(i18n.resolvedLanguage); }, [i18n.resolvedLanguage]);
  useEffect(() => { flushRef.current = ready ? capture : null; return () => { if (flushRef.current === capture) flushRef.current = null; }; }, [ready, capture, flushRef]);
  useLayoutEffect(() => {
    if (!ready) return;
    const preserve = () => {
      try {
        const snapshot = editor.current?.captureNow();
        if (snapshot) { const input = localFormulaRef.current; if (localStepRef.current) snapshot.source.steps = snapshot.source.steps.map(step => step.id === localStepRef.current.id ? { ...step, ...localStepRef.current } : step); if (input?.latex.trim()) snapshot.source.formulas = snapshot.source.formulas.map(formula => formula.id === input.id ? input : formula);
          if (JSON.stringify(snapshot.source) !== JSON.stringify(current.current.draft.source)) current.current.onChangeSource(snapshot.source); }
      } catch (error) { current.current.onError(error); }
    };
    const hide = () => { if (document.visibilityState === 'hidden') preserve(); };
    window.addEventListener('beforeunload', preserve); window.addEventListener('pagehide', preserve); document.addEventListener('visibilitychange', hide);
    return () => { preserve(); window.removeEventListener('beforeunload', preserve); window.removeEventListener('pagehide', preserve); document.removeEventListener('visibilitychange', hide); };
  }, [ready]);
  useEffect(() => {
    clearTimeout(autoTimer.current);
    if (!ready || busy || pending || status !== '未保存' || frozen || !(source.formulas.length || source.graph)) return;
    autoTimer.current = setTimeout(() => { if (!current.current.busy && !current.current.pending) void current.current.onSave(); }, 1400);
    return () => clearTimeout(autoTimer.current);
  }, [ready, busy, pending, status, source, frozen, draft.title]);
  useEffect(() => { changeLocalFormula(null); setLocalStep(null); }, [state.selection?.id]);
  useEffect(() => {
    const keys = event => {
      const dialogOpen = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(node => node.getClientRects().length && !node.closest('[inert]'));
      if (dialogOpen) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault(); return; }
      if (event.key === 'Escape') { if (presenting) void endPreview(); else if (tool) setTool(null); else shell?.closePanel(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void onSave(); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [presenting, tool, onSave]);
  useEffect(() => {
    const fullscreenChanged = () => {
      if (nativePresentation.current && document.fullscreenElement !== moduleHost.current) void endPreview();
    };
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => document.removeEventListener('fullscreenchange', fullscreenChanged);
  }, []);
  async function apply(changes) {
    if (!editor.current || frozen) return;
    try { return await editor.current.apply({ baseEditRevision: editor.current.read().editRevision, changes }); }
    catch (error) {
      if (!error.affectedStepIds?.length) { onError(error); return; }
      if (!await confirmation(t('相关步骤、播放或轨迹会随之调整。是否继续？'))) return;
      try { return await editor.current.apply({ baseEditRevision: editor.current.read().editRevision, changes: { ...changes, confirmReferences: true } }); }
      catch (failure) { onError(failure); }
    }
  }
  async function select(selection) {
    try {
      if (localTimer.current) { clearTimeout(localTimer.current); localTimer.current = null; await commitFormulaRef.current?.(); }
      if (stepTimer.current) { clearTimeout(stepTimer.current); stepTimer.current = null; await commitStepRef.current?.(); }
      editor.current?.select(selection); shell?.openPanel('math-workshop-tools');
    } catch (error) { onError(error); }
  }
  async function moveHistory(direction) {
    try { await capture(); await editor.current[direction](); changeLocalFormula(null); setLocalStep(null); } catch (error) { onError(error); }
  }
  function beginTool(next) { setTool(next); if (next === 'graph') setShowExpression(true); shell?.openPanel('math-workshop-tools'); }
  async function chooseDrawingTool(next) {
    try { flushSync(() => setDrawingTool(next === 'select' ? null : next)); if (next !== 'select') shell?.closePanel(); await editor.current.setTool(next); setTool(null); } catch (error) { setDrawingTool(null); onError(error); }
  }
  async function addFormula() {
    if (!formulaInput.trim()) return;
    const formula = { id: crypto.randomUUID(), ...formulaDefaults, latex: formulaInput.trim() };
    if (await apply({ formulas: [...source.formulas, formula] })) { changeFormulaInput(''); setAddingFormula(false); select({ type: 'formula', id: formula.id }); }
  }
  async function addExpression(event) {
    event?.preventDefault(); if (!expression.trim()) return;
    try { const operation = parseDefinition(expression, state.objects.map(objectId)); if (await apply({ operations: [operation] })) { changeExpression(''); setTool(null); select({ type: 'object', id: operation.name }); requestAnimationFrame(() => expressionField.current?.focus()); } }
    catch (error) { onError(error); }
  }
  async function addStep() {
    const step = { id: crypto.randomUUID(), title: t('步骤 {{number}}', { number: source.steps.length + 1 }), description: '',
      values: Object.fromEntries(parameters(state.objects).map(object => [objectId(object), object.numericValue])),
      visibleObjects: state.objects.filter(object => object.visible !== false).map(objectId), visibleFormulas: source.formulas.map(formula => formula.id), view: source.view };
    if (await apply({ steps: [...source.steps, step], initialStepId: source.initialStepId ?? step.id })) select({ type: 'step', id: step.id });
  }
  async function preview(fullscreen = false) {
    try {
      await capture();
      if (drawingTool) { await editor.current.setTool('select'); setDrawingTool(null); }
      await showPreview({ stepId: source.initialStepId });
      if (fullscreen) {
        setPresenting(true);
        shell?.closePanel();
        if (moduleHost.current?.requestFullscreen) {
          await moduleHost.current.requestFullscreen().catch(() => {});
          nativePresentation.current = document.fullscreenElement === moduleHost.current;
        }
      }
    }
    catch (error) { onError(error); }
  }
  async function showPreview(options) {
    if (previewOperation.current) return previewOperation.current;
    const controller = editor.current;
    const operation = controller.preview(options);
    previewOperation.current = operation;
    setState(controller.read());
    try { return await operation; }
    finally {
      if (previewOperation.current === operation) previewOperation.current = null;
      if (editor.current === controller) setState(controller.read());
    }
  }
  async function endPreview() {
    nativePresentation.current = false;
    try {
      await previewOperation.current;
      await editor.current?.endPreview(); setState(editor.current.read()); setPresenting(false);
      if (document.fullscreenElement === moduleHost.current) await document.exitFullscreen().catch(() => {});
    } catch (error) { onError(error); }
  }
  async function removeFormula(formula) {
    if (localFormula?.id === formula.id) { clearTimeout(localTimer.current); localTimer.current = null; changeLocalFormula(null); }
    const affected = source.steps.filter(step => step.visibleFormulas.includes(formula.id));
    if (affected.length && !await confirmation(t('删除此公式也会从 {{count}} 个步骤中移除它。', { count: affected.length }))) return;
    await apply({ formulas: source.formulas.filter(item => item.id !== formula.id), steps: source.steps.map(step => ({ ...step, visibleFormulas: step.visibleFormulas.filter(id => id !== formula.id) })) });
    editor.current?.select(null);
  }
  function updateFormula(patch) {
    const next = { ...(localFormulaRef.current ?? selectedFormula), ...patch }; changeLocalFormula(next); clearTimeout(localTimer.current);
    const commit = async () => { if (!next.latex.trim()) { onError(new Error(t('公式不能为空。删除公式请使用移除。'))); return; }
      const result = await apply({ formulas: editor.current.read().source.formulas.map(formula => formula.id === next.id ? next : formula) });
      if (result && localFormulaRef.current === next) changeLocalFormula(null); };
    commitFormulaRef.current = commit;
    localTimer.current = setTimeout(() => { localTimer.current = null; void commit(); }, 650);
  }
  function updateStepText(patch) {
    const next = { ...(localStep?.id === selectedStep.id ? localStep : { id: selectedStep.id }), ...patch };
    setLocalStep(next); clearTimeout(stepTimer.current);
    const commit = async () => { const steps = editor.current.read().source.steps; const latest = steps.find(step => step.id === next.id); if (!latest || !(next.title ?? latest.title).trim()) return; const result = await apply({ steps: steps.map(step => step.id === next.id ? { ...step, ...next } : step) }); if (result && localStepRef.current === next) { localStepRef.current = null; setLocalStep(null); } }; commitStepRef.current = commit;
    stepTimer.current = setTimeout(() => { stepTimer.current = null; void commit(); }, 650);
  }
  function updateStep(id, patch) {
    const steps = editor.current.read().source.steps;
    return apply({ steps: steps.map(step => { if (step.id !== id) return step; const next = typeof patch === 'function' ? patch(step) : patch; return { ...step, ...next, ...(next.values ? { values: { ...step.values, ...next.values } } : {}) }; }) });
  }
  async function removeObject(object) {
    const id = objectId(object); const affected = source.steps.filter(step => step.visibleObjects.includes(id));
    if (!await confirmation(t('删除 {{name}}？依赖它的图形和步骤将一起调整。', { name: id }))) return;
    await apply({ operations: [{ type: 'delete', name: id, allowDependents: true }], ...(affected.length ? { steps: source.steps.map(step => ({ ...step, visibleObjects: step.visibleObjects.filter(name => name !== id), values: Object.fromEntries(Object.entries(step.values).filter(([name]) => name !== id)) })) } : {}) });
  }
  const editFormula = localFormula ?? selectedFormula;
  const visibleFormulas = state.mode === 'preview' ? source.formulas.filter(formula => state.visibleFormulaIds?.includes(formula.id)) : source.formulas;
  return <section ref={moduleHost} className={`math-workshop${presenting ? ' is-presenting' : ''}${state.mode === 'preview' ? ' is-preview' : ''}`} aria-label={t('数学作品编辑器')}>
    {children}{confirmationDialog}
    <header className="mw-heading">
      <button className="mw-icon" aria-label={t('返回工坊')} title={t('返回工坊')} onClick={onHome}><Icon name="back" size={18}/></button>
      <div className="mw-title-group"><span className="mw-module-name">{t('数学工坊')}</span><input className="mw-title" aria-label={t('作品名')} value={draft.title} maxLength={200} disabled={editingBlocked} onChange={event => onTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && !event.repeat) { event.preventDefault(); event.currentTarget.blur(); } }}/></div>
      {state.mode === 'preview' && <span className="mw-mode-label">{t('试演中')}</span>}
      {state.mode !== 'preview' && (source.formulas.length > 0 || source.graph || pending || status === '保存失败') && <span className={`mw-save-state${status === '保存失败' || pending ? ' has-error' : ''}`} role="status">{t(pending && !busy ? '保存结果待确认' : status === '未保存' ? '等待保存' : status)}</span>}
      <div className="mw-heading-actions">
        {state.mode === 'preview' ? <button className="mw-button is-primary" disabled={state.busy} onClick={endPreview}>{t('返回编辑')}</button> : <>
          <button className="mw-button is-primary" disabled={!ready || busy || state.busy} onClick={() => preview()}><Icon name="play" size={13}/>{t('试演')}</button>

        </>}
        <button className="mw-button" disabled={busy || state.busy || !draft.id} onClick={() => setDownloadOpen(value => !value)}><Icon name="arrowDown" size={15}/>{t('下载')}</button>
        <MathMenu buttonClassName="mw-icon" menuClassName="mw-work-menu" label={t('更多作品操作')} className="mw-work-actions">{({ close }) => <>
          <MenuItem disabled={busy || state.busy} onClick={() => { close(); onSave(); }}>{t(pending ? '确认结果' : '立即保存')}</MenuItem>
          <MenuItem disabled={!ready || busy || state.busy} onClick={() => { close(); void preview(true); }}>{t('课堂展示')}</MenuItem>
          <MenuItem disabled={!draft.id || busy || state.busy} onClick={() => { close(); onHistory(); }}>{t('历史版本')}</MenuItem>
          <MenuItem disabled={busy || state.busy} onClick={() => { close(); onCopy(); }}>{t('另存作品')}</MenuItem>
          <MenuItem disabled={!draft.id || busy || state.busy} onClick={() => { close(); onArchive(); }}>{t('归档作品')}</MenuItem>
        </>}</MathMenu>
      </div>
    </header>
    {(message || pending && !busy) && <div className="mw-notice" role="alert">{message || t('保存结果待确认')}{pending && <button onClick={onSave} disabled={busy || state.busy}>{t('确认操作结果')}</button>}</div>}{conflictNotice}
    <div className="mw-toolbar">
      <div className="mw-create-tools">
        <button className="mw-button" aria-label={t('添加公式')} disabled={editingBlocked || !ready} onClick={() => { setAddingFormula(true); setTool(null); }}><span className="mw-formula-icon" aria-hidden="true">ƒ</span>{t('公式')}</button>
        <button className="mw-button" aria-label={t('添加图形')} disabled={editingBlocked || !ready} onClick={() => beginTool(tool === 'graph' ? null : 'graph')}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><path d="M3 3v14h14M5 6c3 12 6 12 10 0"/></svg>{t('图形')}</button>
        <button className="mw-button" aria-label={t('添加参数')} disabled={editingBlocked || !ready} onClick={() => beginTool('parameter')}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><path d="M3 6h4m4 0h6M3 14h8m4 0h2"/><circle cx="9" cy="6" r="2"/><circle cx="13" cy="14" r="2"/></svg>{t('参数')}</button>
        <button className="mw-button" aria-label={t('教学步骤')} disabled={editingBlocked || !ready} onClick={addStep}><Icon name="prep" size={18}/>{t('步骤')}</button>
      </div>
      <div className="mw-view-tools">
        <button className="mw-icon" aria-label={t('撤销')} title={t('撤销')} disabled={editingBlocked || !state.canUndo} onClick={() => moveHistory('undo')}><Icon name="undo" size={17}/></button>
        <button className="mw-icon" aria-label={t('重做')} title={t('重做')} disabled={editingBlocked || !state.canRedo} onClick={() => moveHistory('redo')}><Icon name="redo" size={17}/></button>

        <button className="mw-icon mw-panel-toggle" aria-label={t('内容列表')} title={t('内容列表')} onClick={() => { setTool(null); editor.current?.select(null); shell?.openPanel('math-workshop-tools'); }}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 6 7-3 7 3-7 3-7-3Zm0 4 7 3 7-3M3 14l7 3 7-3"/></svg></button>
      </div>
    </div>
    <div className="mw-layout">
      <main className="mw-surface">
        {!source.formulas.length && !graphVisible && !addingFormula && <div className="mw-empty">
          <div className="mw-empty-art" aria-hidden="true">{['formula', 'dynamic', 'space'].map(kind => <span key={kind} className={`is-${kind}`}><WorkIllustration kind={kind}/></span>)}</div>
          <h2>{tx('从一个公式或一张图开始')}</h2><p>{tx('用下面的工具动手做，或在右侧助理里说说你的想法。')}</p>
          <div className="mw-empty-actions">
            <button type="button" disabled={editingBlocked || !ready} onClick={() => { setAddingFormula(true); setTool(null); }}><span className="mw-empty-glyph">ƒ</span><span><strong>{tx('写公式')}</strong><small>{tx('分式、根式、上下标')}</small></span></button>
            <button type="button" disabled={editingBlocked || !ready} onClick={() => beginTool('graph')}><span className="mw-empty-glyph"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M3 3v14h14M5 6c3 12 6 12 10 0"/></svg></span><span><strong>{tx('画图形')}</strong><small>{tx('函数、点线圆、立体')}</small></span></button>
            <button type="button" disabled={editingBlocked || !ready} onClick={() => beginTool('parameter')}><span className="mw-empty-glyph"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h4m4 0h6M3 14h8m4 0h2"/><circle cx="9" cy="6" r="2"/><circle cx="13" cy="14" r="2"/></svg></span><span><strong>{tx('加参数')}</strong><small>{tx('拖动滑杆，让图动起来')}</small></span></button>
          </div>
        </div>}
        {(visibleFormulas.length > 0 || addingFormula) && <div className="mw-formula-band" inert={state.busy || undefined}>
          {visibleFormulas.map(formula => <div key={formula.id} className={`mw-formula-row${selectedFormula?.id === formula.id ? ' is-selected' : ''}`}>
            {selectedFormula?.id === formula.id && !frozen ? <div className="mw-formula-edit"><VisualFormulaInput autoFocus value={(localFormula ?? formula).latex} onChange={latex => updateFormula({ latex })} onConfirm={async () => { await capture(); editor.current?.select(null); }}/></div> : <button className="mw-formula-select" disabled={frozen || state.busy} aria-label={t('编辑公式 {{number}}', { number: source.formulas.indexOf(formula) + 1 })} onClick={() => select({ type: 'formula', id: formula.id })}>
              <FormulaPreview source={{ schemaVersion: 1, kind: 'formula', ...formula, color: formula.color }}/>
            </button>}
            {!frozen && <button className="mw-icon" aria-label={t('移除公式')} onClick={() => removeFormula(formula)}><Icon name="close" size={13}/></button>}
          </div>)}
          {addingFormula && <div className="mw-new-formula"><VisualFormulaInput autoFocus value={formulaInput} onChange={changeFormulaInput} onConfirm={addFormula}/><div className="mw-inline-actions"><button className="mw-button" onClick={() => { setAddingFormula(false); changeFormulaInput(''); }}>{t('取消')}</button><button className="mw-button is-primary" disabled={state.busy || !formulaInput.trim()} onClick={addFormula}>{t('加入作品')}</button></div></div>}
        </div>}
        {drawingTool && <div className="mw-drawing-hint"><span>{t(({ point: '点击画布放置点', segment: '依次点击两个端点', circle: '点击圆心，再点击圆上一点', polygon: '依次点击顶点，最后点击第一个点闭合', midpoint: '选择两个点或一条线段', perpendicular: '选择一个点和一条直线', intersect: '选择两个相交的图形' })[drawingTool])}</span><button className="mw-button" disabled={state.busy} onClick={() => chooseDrawingTool('select')}>{t('完成')}</button><button className="mw-icon" aria-label={t('取消绘图工具')} disabled={state.busy} onClick={() => chooseDrawingTool('select')}><Icon name="close" size={13}/></button></div>}
        {state.graphMounting && <div className="mw-notice" role="status">{t('正在准备画布…')}</div>}
        <div className={`mw-graph-area${graphVisible ? ' has-graph' : ''}`}>{graphVisible && !frozen && <div className="mw-graph-controls"><button className="mw-button" onClick={() => { setShowExpression(value => !value); }}>{t('输入算式')}</button><select aria-label={t('数学视图')} value={source.view} disabled={editingBlocked || !ready} onChange={event => apply({ view: event.target.value })}>{views.map(([view, label]) => <option key={view} value={view}>{t(label)}</option>)}</select></div>}<div className={`mw-graph-host${graphVisible ? ' has-graph' : ''}`} ref={graphHost} inert={draft.deletedAt || undefined}/>{graphVisible && <a className="mw-engine-credit" href="/vendor/math/geogebra/NOTICE.txt" target="_blank" rel="noreferrer">GeoGebra</a>}</div>
        <ModulePresence present={!frozen && showExpression} mode="collapse" className="mw-expression-disclosure"><form className="mw-expression" onSubmit={addExpression}>
          <span aria-hidden="true">ƒ</span><input ref={expressionField} aria-label={t('图形表达式')} placeholder={t('输入算式，如 f(x)=x²')} disabled={state.busy} value={expression} onChange={event => changeExpression(event.target.value)}/>
          <button type="submit" className="mw-icon" aria-label={t('建立图形')} disabled={state.busy || !expression.trim() || !ready}><Icon name="arrowUp" size={16}/></button><button type="button" className="mw-icon" aria-label={t('收起算式')} onClick={() => setShowExpression(false)}><Icon name="close" size={16}/></button>
        </form></ModulePresence>
        {source.steps.length > 0 ? <div className="mw-step-rail"><span>{t('步骤')}</span><nav aria-label={t('教学步骤')}>{source.steps.map((step, index) => <button key={step.id} disabled={state.busy} className={selectedStep?.id === step.id || state.previewStepId === step.id ? 'is-selected' : ''} onClick={() => state.mode === 'preview' ? showPreview({ stepId: step.id }).catch(onError) : select({ type: 'step', id: step.id })}><span>{index + 1}</span>{step.title}</button>)}</nav>{!frozen && <button className="mw-icon" aria-label={t('添加步骤')} disabled={state.busy} onClick={addStep}><Icon name="plus" size={15}/></button>}</div>
          : null}
        {state.mode === 'preview' && <PreviewControls state={state} editor={editor.current} onPreview={showPreview} onError={onError} onState={setState} readOnly={!!draft.deletedAt}/>}
      </main>
      {shell && <WorkshopToolsPortal>        <div className="mw-side-content" inert={editingBlocked || undefined} onKeyDown={event => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.repeat || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('form')) return;
          if (event.target.matches('textarea, input:not([type=checkbox]):not([type=range]):not([type=color])')) { event.preventDefault(); event.target.blur(); }
        }}>
          {tool === 'graph' && <div className="mw-tool-section"><h3>{t('添加图形')}</h3>{!graphVisible && <label>{t('数学视图')}<select aria-label={t('数学视图')} value={source.view} onChange={event => apply({ view: event.target.value })}>{views.map(([view, label]) => <option key={view} value={view}>{t(label)}</option>)}</select></label>}{templates.map(([group, choices]) => <div className="mw-template-group" key={group}><h4>{t(group)}</h4><div>{choices.map(([label, input]) => <button key={label} className="mw-button" onClick={() => { const draw = ({ '点': 'point', '线段': 'segment', '圆': 'circle', '三角形': 'polygon', '中点': 'midpoint', '垂线': 'perpendicular', '交点': 'intersect' })[label]; if (draw) void chooseDrawingTool(draw); else { const operation = parseDefinition(input, []); if (state.objects.some(object => objectId(object) === operation.name)) { let suffix = 2; while (state.objects.some(object => objectId(object) === `${operation.name}${suffix}`)) suffix++; input = input.replace(new RegExp(`^${operation.name}`), `${operation.name}${suffix}`); } changeExpression(input); setShowExpression(true); requestAnimationFrame(() => expressionField.current?.focus()); } }}>{t(label === '三角形' ? '多边形' : label)}</button>)}</div></div>)}</div>}
          {tool === 'parameter' && <ParameterCreator defaultName={(() => { let name = 'a'; let number = 2; while (state.objects.some(object => objectId(object) === name)) name = `a${number++}`; return name; })()} onCreate={operation => apply({ operations: [operation] }).then(result => { if (result) { setTool(null); select({ type: 'object', id: operation.name }); } })}/>}
          {!tool && editFormula && <div className="mw-tool-section"><h3>{t('公式')}</h3>
            <ModuleDisclosure title={t('LaTeX 源码')}><textarea aria-label={t('LaTeX 源码')} value={editFormula.latex} onChange={event => updateFormula({ latex: event.target.value })}/><button className="mw-button" onClick={() => navigator.clipboard.writeText(editFormula.latex).catch(onError)}>{t('复制 LaTeX')}</button></ModuleDisclosure>
            <label>{t('说明')}<textarea value={editFormula.caption} onChange={event => updateFormula({ caption: event.target.value })}/></label>
            <label className="mw-check"><input type="checkbox" checked={editFormula.includeCaption} onChange={event => updateFormula({ includeCaption: event.target.checked })}/>{t('输出时包含说明')}</label>
            <ModuleDisclosure title={t('样式')}><label>{t('颜色')}<input type="color" value={editFormula.color} onChange={event => updateFormula({ color: event.target.value })}/></label><label>{t('字号')}<input type="number" min="12" max="96" value={editFormula.fontSize} onChange={event => updateFormula({ fontSize: Number(event.target.value) })}/></label></ModuleDisclosure>
          </div>}
          {!tool && selectedObject && <ObjectTools object={selectedObject} apply={apply} onDelete={() => removeObject(selectedObject)} frozen={frozen} source={source}/>}
          {!tool && selectedStep && <StepTools step={localStep?.id === selectedStep.id ? { ...selectedStep, ...localStep } : selectedStep} onTextChange={updateStepText} onPatch={patch => updateStep(selectedStep.id, patch)} source={source} objects={state.objects} frozen={frozen} apply={apply}/>}
          {!tool && !editFormula && !selectedObject && !selectedStep && <div className="mw-selection-empty"><Icon name="math" size={24}/><p>{t('选择公式、图形或步骤，调整它的属性。')}</p></div>}
          {state.objects.length > 0 && <div className="mw-object-list"><h3>{t('图形与参数')}</h3>{state.objects.map(object => <button key={objectId(object)} className={selectedObject === object ? 'is-selected' : ''} onClick={() => { setTool(null); select({ type: 'object', id: objectId(object) }); }}><span style={{ color: object.color ?? '#64748b' }}>●</span><strong>{objectId(object)}</strong><span>{objectExpression(object) || t(object.slider ? '参数' : '图形')}</span></button>)}</div>}

        </div>
      </WorkshopToolsPortal>}
    </div>
    <ModulePresence present={downloadOpen}>{downloadOpen && <WorkshopDownloadDialog label={t('下载作品')} onClose={() => setDownloadOpen(false)}><header><h3>{t('下载作品')}</h3><button className="mw-icon" onClick={() => setDownloadOpen(false)} aria-label={t('关闭下载')}><Icon name="close" size={13}/></button></header>
      <div className="mw-download-types">{[['png', '图片'], ['source', '可编辑源'], ['bundle', '课堂演示']].map(([format, label]) => <button className={download.format === format ? 'is-selected' : ''} key={format} onClick={() => setDownload({ ...download, format, selection: 'work' })}>{t(label)}</button>)}</div>
      {['png', 'svg'].includes(download.format) && <><label>{t('内容')}<select value={download.selection} onChange={event => setDownload({ ...download, format: 'png', selection: event.target.value, formulaId: source.formulas[0]?.id })}><option value="work">{t('整份作品')}</option>{source.graph && <option value="graph">{t('数学视图')}</option>}{source.formulas.length > 0 && <option value="formula">{t('公式')}</option>}</select></label>
        {download.selection === 'formula' && <label>{t('公式')}<select value={download.formulaId ?? source.formulas[0]?.id} onChange={event => setDownload({ ...download, formulaId: event.target.value })}>{source.formulas.map((formula, index) => <option value={formula.id} key={formula.id}>{index + 1}. {formula.latex}</option>)}</select></label>}
        <label>{t('尺寸')}<select value={download.width} onChange={event => setDownload({ ...download, width: Number(event.target.value) })}><option value="1200">1200 px</option><option value="1600">1600 px</option><option value="2400">2400 px</option></select></label><label>{t('格式')}<select value={download.format} onChange={event => setDownload({ ...download, format: event.target.value })}><option value="png">PNG</option>{(download.selection === 'formula' || download.selection === 'graph' && openingView === 'plane') && <option value="svg">SVG</option>}</select></label>
        {download.selection !== 'formula' && <label>{t('背景')}<select value={opaqueGraph && download.selection !== 'formula' ? 'white' : download.background} onChange={event => setDownload({ ...download, background: event.target.value })}><option value="white">{t('白色')}</option>{!(opaqueGraph && download.selection !== 'formula') && <option value="transparent">{t('透明')}</option>}</select></label>}
      </>}
      {['png','svg'].includes(download.format) && opaqueGraph && download.selection !== 'formula' && <p>{t('三维图片使用白色背景')}</p>}
      {download.format === 'source' && source.graph && <label className="mw-check"><input type="checkbox" checked={download.selection === 'graph'} onChange={event => setDownload({ ...download, selection: event.target.checked ? 'graph' : 'work' })}/>{t('只取出图形构造（.ggb）')}</label>}
      {download.format === 'bundle' && <p>{t('下载 ZIP 后解压，打开 index.html 进入课堂演示。')}</p>}
      <button name="dialog-confirm" className="mw-button is-primary" disabled={busy || state.busy || status !== '已保存'} onClick={() => onDownload({ ...download, ...(opaqueGraph && download.selection !== 'formula' && download.format === 'png' ? { background: 'white' } : {}), ...(download.format === 'source' && download.selection === 'graph' ? { format: 'ggb' } : {}), ...(['source', 'bundle'].includes(download.format) || download.selection === 'formula' ? { background: 'transparent', width: 1600 } : {}), ...(download.selection === 'formula' ? { formulaId: download.formulaId ?? source.formulas[0]?.id } : { formulaId: undefined }) })}>{t(status !== '已保存' ? '保存后下载' : '下载文件')}</button>
    </WorkshopDownloadDialog>}</ModulePresence>
  </section>;
}
function ParameterCreator({ onCreate, defaultName }) {
  const { t } = useTranslation('math'); const [value, setValue] = useState({ name: defaultName, min: -5, max: 5, step: 0.1, value: 1 });
  return <form className="mw-tool-section" onSubmit={event => { event.preventDefault(); void onCreate({ type: 'slider', ...value }); }}><h3>{t('添加参数')}</h3>{[['name', '参数名'], ['min', '最小值'], ['max', '最大值'], ['step', '步长'], ['value', '初值']].map(([field, label]) => <label key={field}>{t(label)}<input aria-label={t(label)} type={field === 'name' ? 'text' : 'number'} step="any" value={value[field]} onChange={event => setValue({ ...value, [field]: field === 'name' ? event.target.value : Number(event.target.value) })}/></label>)}<button className="mw-button is-primary" type="submit">{t('加入作品')}</button></form>;
}
function ObjectTools({ object, apply, onDelete, frozen, source }) {
  const { t } = useTranslation('math'); const id = objectId(object); const actualDefinition = objectExpression(object); const isPoint = ['point', 'point3d'].includes(object.type); const [definition, setDefinition] = useState(actualDefinition);
  const [parameterValue, setParameterValue] = useState(object.numericValue ?? 0);
  const [name, setName] = useState(id);
  const [range, setRange] = useState(object.slider);
  useEffect(() => { setParameterValue(object.numericValue ?? 0); setName(id); setRange(object.slider); }, [id, object.numericValue, object.slider?.min, object.slider?.max, object.slider?.step]);
  useEffect(() => setDefinition(actualDefinition), [id, actualDefinition]);
  const simpleParameter = Boolean(object.slider && object.independent !== false);
  const definitionForm = <form onSubmit={event => { event.preventDefault(); void apply({ operations: [parseDefinition(`${id}${object.type === 'function' ? '(x)' : ''}=${definition}`, [])] }); }}>
    <label>{t('定义')}<input value={definition} disabled={frozen} onChange={event => setDefinition(event.target.value)}/></label>
    <button className="mw-button" disabled={frozen || definition === actualDefinition}>{t(simpleParameter ? '改为算式' : '应用修改')}</button>
  </form>;
  return <div className="mw-tool-section"><h3>{id}</h3>
    <label>{t('名称')}<input value={name} disabled={frozen} onChange={event => setName(event.target.value)} onBlur={() => { if (name !== id) void apply({ operations: [{ type: 'rename', name: id, newName: name }] }); }}/></label>
    {!simpleParameter && definitionForm}
    {object.slider && <div className="mw-parameter-value">
      <label>{t('取值')}<input type="number" required min={object.slider.min} max={object.slider.max} step={object.slider.step} value={parameterValue} disabled={frozen}
        onChange={event => setParameterValue(event.target.value)} onBlur={event => { if (event.currentTarget.reportValidity() && Number(event.target.value) !== object.numericValue) void apply({ operations: [{ type: 'setValue', name: id, value: Number(event.target.value) }] }); }}/></label>
      <input type="range" aria-label={t('参数 {{name}}', { name: id })} min={object.slider.min} max={object.slider.max} step={object.slider.step} value={parameterValue === '' ? object.numericValue : parameterValue} disabled={frozen}
        onChange={event => setParameterValue(Number(event.target.value))} onPointerUp={() => apply({ operations: [{ type: 'setValue', name: id, value: Number(parameterValue) }] })} onKeyUp={() => apply({ operations: [{ type: 'setValue', name: id, value: Number(parameterValue) }] })}/>
    </div>}
    {simpleParameter && <ModuleDisclosure title={t('改为算式')}><p>{t('改为算式后，不再使用滑杆。')}</p>{definitionForm}</ModuleDisclosure>}
    {object.slider && range && <ModuleDisclosure title={t('参数范围')}><form onSubmit={event => { event.preventDefault(); void apply({ operations: [{ type: 'slider', name: id, min: Number(range.min), max: Number(range.max), step: Number(range.step), value: parameterValue }] }); }}>{[['min','最小值'],['max','最大值'],['step','步长']].map(([field,label]) => <label key={field}>{t(label)}<input type="number" step="any" value={range[field] ?? ''} disabled={frozen} onChange={event => setRange({ ...range, [field]: event.target.value })}/></label>)}<button className="mw-button" disabled={frozen}>{t('应用范围')}</button></form></ModuleDisclosure>}
    <ModuleDisclosure title={t('样式')}><label>{t('颜色')}<input type="color" disabled={frozen} value={object.color ?? '#2563eb'} onChange={event => apply({ operations: [{ type: 'style', name: id, color: event.target.value }] })}/></label>{isPoint ? <label>{t('点大小')}<input type="number" min="1" max="9" disabled={frozen} value={object.pointSize ?? 5} onChange={event => apply({ operations: [{ type: 'style', name: id, pointSize: Number(event.target.value) }] })}/></label> : <><label>{t('线宽')}<input type="number" min="1" max="13" disabled={frozen} value={object.lineThickness ?? 2} onChange={event => apply({ operations: [{ type: 'style', name: id, lineThickness: Number(event.target.value) }] })}/></label><label>{t('线型')}<select disabled={frozen} value={object.lineStyle ?? 0} onChange={event => apply({ operations: [{ type: 'style', name: id, lineStyle: Number(event.target.value) }] })}><option value="0">{t('实线')}</option><option value="1">{t('虚线')}</option><option value="3">{t('点线')}</option></select></label></>}<label className="mw-check"><input type="checkbox" disabled={frozen} checked={object.visible !== false} onChange={event => apply({ operations: [{ type: 'style', name: id, visible: event.target.checked }] })}/>{t('显示图形')}</label><label className="mw-check"><input type="checkbox" disabled={frozen} checked={!!object.labelVisible} onChange={event => apply({ operations: [{ type: 'style', name: id, labelVisible: event.target.checked }] })}/>{t('显示标注')}</label></ModuleDisclosure>{object.slider && <ModuleDisclosure title={t('参数播放')}><label className="mw-check"><input type="checkbox" disabled={frozen} checked={source.animation?.parameter === id} onChange={event => apply({ animation: event.target.checked ? { parameter: id, seconds: 8, mode: 'bounce' } : null })}/>{t('试演时播放此参数')}</label>{source.animation?.parameter === id && <><label>{t('单程秒数')}<input type="number" min="1" max="120" value={source.animation.seconds} disabled={frozen} onChange={event => apply({ animation: { ...source.animation, seconds: Number(event.target.value) } })}/></label><label>{t('播放方式')}<select disabled={frozen} value={source.animation.mode} onChange={event => apply({ animation: { ...source.animation, mode: event.target.value } })}><option value="once">{t('单次')}</option><option value="loop">{t('循环')}</option><option value="bounce">{t('往返')}</option></select></label></>}</ModuleDisclosure>}{object.type === 'point' && <label className="mw-check"><input type="checkbox" checked={source.traceObjects.includes(id)} disabled={frozen} onChange={event => apply({ traceObjects: event.target.checked ? [...source.traceObjects, id] : source.traceObjects.filter(name => name !== id) })}/>{t('试演时显示轨迹')}</label>}<button className="mw-text-button is-danger" disabled={frozen} onClick={onDelete}>{t('删除对象')}</button>
  </div>;
}
function StepTools({ step, onTextChange, onPatch, source, objects, apply, frozen }) {
  const { t } = useTranslation('math');
  const update = onPatch;
  return <div className="mw-tool-section"><h3>{t('教学步骤')}</h3><label>{t('步骤标题')}<input key={`${step.id}-title`} value={step.title} disabled={frozen} onChange={event => onTextChange({ title: event.target.value })}/></label><label>{t('讲解说明')}<textarea key={`${step.id}-description`} value={step.description} disabled={frozen} onChange={event => onTextChange({ description: event.target.value })}/></label>
    <label>{t('展示视图')}<select disabled={frozen} value={step.view} onChange={event => update({ view: event.target.value })}>{views.map(([value, title]) => <option value={value} key={value}>{t(title)}</option>)}</select></label>
    <ModuleDisclosure defaultOpen title={t('显示内容')}>{objects.map(object => <label className="mw-check" key={objectId(object)}><input disabled={frozen} type="checkbox" checked={step.visibleObjects.includes(objectId(object))} onChange={event => update(latest => ({ visibleObjects: event.target.checked ? [...latest.visibleObjects, objectId(object)] : latest.visibleObjects.filter(id => id !== objectId(object)) }))}/>{objectId(object)}</label>)}{source.formulas.map((formula, index) => <label className="mw-check" key={formula.id}><input disabled={frozen} type="checkbox" checked={step.visibleFormulas.includes(formula.id)} onChange={event => update(latest => ({ visibleFormulas: event.target.checked ? [...latest.visibleFormulas, formula.id] : latest.visibleFormulas.filter(id => id !== formula.id) }))}/>{t('公式 {{number}}', { number: index + 1 })}</label>)}</ModuleDisclosure>
    <ModuleDisclosure title={t('参数值')}>{parameters(objects).map(object => <label key={objectId(object)}>{objectId(object)}<input type="number" step={object.slider.step} disabled={frozen} value={step.values[objectId(object)]} onChange={event => update({ values: { [objectId(object)]: Number(event.target.value) } })}/></label>)}</ModuleDisclosure>
    <div className="mw-step-order">{['up', 'down'].map(direction => <button key={direction} className="mw-button" disabled={frozen || (direction === 'up' ? source.steps[0].id === step.id : source.steps.at(-1).id === step.id)} onClick={() => { const steps = [...source.steps]; const index = steps.findIndex(item => item.id === step.id); const next = index + (direction === 'up' ? -1 : 1); [steps[index], steps[next]] = [steps[next], steps[index]]; void apply({ steps }); }}>{t(direction === 'up' ? '前移' : '后移')}</button>)}</div><button className="mw-button" disabled={frozen || source.initialStepId === step.id} onClick={() => apply({ initialStepId: step.id })}>{t(source.initialStepId === step.id ? '开场步骤' : '设为开场')}</button><button className="mw-text-button is-danger" disabled={frozen} onClick={() => { const steps = source.steps.filter(item => item.id !== step.id); apply({ steps, initialStepId: source.initialStepId === step.id ? steps[0]?.id ?? null : source.initialStepId }); }}>{t('删除步骤')}</button>
  </div>;
}
function PreviewControls({ state, editor, onPreview, onError, onState, readOnly }) {
  const { t } = useTranslation('math'); const step = state.source.steps.find(item => item.id === state.previewStepId);
  const [values, setValues] = useState({});
  const signature = parameters(state.objects).map(object => `${objectId(object)}:${object.numericValue}`).join(',');
  useEffect(() => setValues(Object.fromEntries(parameters(state.objects).map(object => [objectId(object), object.numericValue]))), [signature, state.previewStepId]);
  const show = options => onPreview(options).catch(onError);
  return <div className="mw-preview-controls">{step?.description && <p>{step.description}</p>}
    {parameters(state.objects).map(object => <label key={objectId(object)}><span>{objectId(object)} = {values[objectId(object)] ?? object.numericValue}</span><input type="range" disabled={state.busy} aria-label={t('试演参数 {{name}}', { name: objectId(object) })} min={object.slider.min} max={object.slider.max} step={object.slider.step} value={values[objectId(object)] ?? object.numericValue ?? 0}
      onChange={event => setValues({ ...values, [objectId(object)]: Number(event.target.value) })} onPointerUp={() => show({ stepId: state.previewStepId, values })} onKeyUp={() => show({ stepId: state.previewStepId, values })}/></label>)}
    {state.source.animation && <button className="mw-button" disabled={state.busy} onClick={() => show({ stepId: state.previewStepId, play: true })}>{t('播放')}</button>}
    <button className="mw-button" disabled={readOnly || state.busy} onClick={() => editor.apply({ baseEditRevision: state.editRevision, changes: { setAsOpening: true } }).then(() => onState(editor.read())).catch(onError)}>{t('设为开场状态')}</button>
    <button className="mw-button" disabled={state.busy} onClick={() => show({ stepId: state.previewStepId })}>{t('重置')}</button>
  </div>;
}

function WorkshopToolsPortal({ children }) {
  const { t } = useTranslation('math'); const [host, setHost] = useState(null);
  useAuxiliaryTools([{ id: 'math-workshop-tools', label: t('编辑'), render: () => <div className="mw-tool-host" ref={setHost}/> }]);
  return host ? createPortal(children, host) : null;
}

function WorkshopDownloadDialog({ children, onClose, label }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  useMathDialogKeys(ref);
  useEffect(() => { const outside = event => { if (ref.current && !ref.current.contains(event.target)) onClose(); }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside); }, [onClose]);
  return <div ref={ref} className="mw-download" role="dialog" aria-modal="true" aria-label={label}>{children}</div>;
}
