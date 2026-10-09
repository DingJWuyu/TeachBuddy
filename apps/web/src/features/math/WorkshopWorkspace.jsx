import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mountWorkshopEditor } from './workshop/editor.js';
import VisualFormulaInput from './VisualFormulaInput.jsx';
import FormulaPreview from './FormulaPreview.jsx';
import { MathWebAssistant } from './web-ai/MathWebAssistant.jsx';
import { Icon } from '../workbench/icons.jsx';
import { MathIntegration, MathUsageDetails } from './Integration.jsx';
import { createPortal } from 'react-dom';
import { useAuxiliaryTools, ShellContext, useAuxiliaryAssistant } from '../workbench/shellContext.js';
import { useMathConfirm } from './useMathConfirm.jsx';
import './workshop.css';

const formulaDefaults = { caption: '', includeCaption: true, color: '#1e293b', fontSize: 32 };
const views = [['plane', '平面'], ['space', '三维'], ['split', '并排']];
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

export default function WorkshopWorkspace({ draft, accountKey, busy, pending, status, message, conflictNotice, flushRef,
  onChangeSource, onTitle, onHome, onSave, onError, onHistory, onCopy, onArchive, onDownload, client, children }) {
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
  const [addingFormula, setAddingFormula] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  const [expression, setExpression] = useState('');
  const [tool, setTool] = useState(null);
  const [drawingTool, setDrawingTool] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [download, setDownload] = useState({ format: 'png', selection: 'work', background: 'white', width: 1600 });
  const [presenting, setPresenting] = useState(false);
  const [confirmation, confirmationDialog] = useMathConfirm();
  const [localFormula, setLocalFormula] = useState(null);
  const localFormulaRef = useRef(null); localFormulaRef.current = localFormula;
  current.current = { onChangeSource, onSave, onError, draft, busy, pending, status };
  const source = state.source;
  const selectedFormula = source.formulas.find(formula => state.selection?.type === 'formula' && formula.id === state.selection.id);
  const selectedObject = state.objects.find(object => state.selection?.type === 'object' && objectId(object) === state.selection.id);
  const selectedStep = source.steps.find(step => state.selection?.type === 'step' && step.id === state.selection.id);
  const openingView = source.steps.find(step => step.id === source.initialStepId)?.view ?? source.view;
  const opaqueGraph = !!source.graph && openingView !== 'plane';
  const frozen = !!draft.deletedAt || state.mode === 'preview';

  const assistant = useCallback(() => <MathWebAssistant controller={editor.current} title={draft.title} accountKey={accountKey}/>, [ready, draft.title, accountKey]);
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
        setState(next);
        if (next.origin === 'selection') { if (next.selection && (!next.activeTool || next.activeTool === 'select')) { setTool(null); shell?.openPanel('math-workshop-tools'); } return; }
        if (next.mode === 'preview') return;
        if (JSON.stringify(next.source) !== JSON.stringify(current.current.draft.source)) current.current.onChangeSource(next.source);
      },
      onRecovery: snapshot => { if (!lifetime.signal.aborted) current.current.onChangeSource(snapshot.source); },
      onError: error => { if (!lifetime.signal.aborted) current.current.onError(error); },
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
        if (snapshot) { const input = localFormulaRef.current; if (localStepRef.current) snapshot.source.steps = snapshot.source.steps.map(step => step.id === localStepRef.current.id ? localStepRef.current : step); if (input?.latex.trim()) snapshot.source.formulas = snapshot.source.formulas.map(formula => formula.id === input.id ? input : formula);
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
  useEffect(() => { setLocalFormula(null); setLocalStep(null); }, [state.selection?.id]);
  useLayoutEffect(() => {
    const host = moduleHost.current; const workspace = host?.closest('.wb-workspace'); const main = host?.closest('.wb-main');
    if (!workspace || !main) return;
    const measure = () => { const surface = host.querySelector('.mw-surface'); if (surface) workspace.style.setProperty('--math-tools-offset', `${Math.max(0, surface.getBoundingClientRect().top - main.getBoundingClientRect().top)}px`); };
    const observer = new ResizeObserver(measure); observer.observe(host); observer.observe(host.querySelector('.mw-heading')); observer.observe(host.querySelector('.mw-toolbar')); measure();
    return () => { observer.disconnect(); workspace.style.removeProperty('--math-tools-offset'); };
  }, [message, conflictNotice]);
  useEffect(() => {
    const keys = event => {
      if (event.key === 'Escape') { if (presenting) void endPreview(); else if (tool) setTool(null); else shell?.closePanel(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void onSave(); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [presenting, tool, onSave]);
  async function apply(changes) {
    if (!editor.current || frozen) return;
    try { return await editor.current.apply({ baseEditRevision: editor.current.read().editRevision, changes }); }
    catch (error) { if (error.affectedStepIds?.length && await confirmation(t('这次修改会调整 {{count}} 个步骤的显示内容或参数值，是否继续？', { count: error.affectedStepIds.length }))) { try { return await editor.current.apply({ baseEditRevision: editor.current.read().editRevision, changes: { ...changes, confirmReferences: true } }); } catch (failure) { onError(failure); } } else onError(error); }
  }
  async function select(selection) {
    try {
      if (localTimer.current) { clearTimeout(localTimer.current); localTimer.current = null; await commitFormulaRef.current?.(); }
      if (stepTimer.current) { clearTimeout(stepTimer.current); stepTimer.current = null; await commitStepRef.current?.(); }
      editor.current?.select(selection); shell?.openPanel('math-workshop-tools');
    } catch (error) { onError(error); }
  }
  async function moveHistory(direction) {
    try { await capture(); await editor.current[direction](); setLocalFormula(null); setLocalStep(null); } catch (error) { onError(error); }
  }
  function beginTool(next) { setTool(next); shell?.openPanel('math-workshop-tools'); }
  async function chooseDrawingTool(next) {
    try { setDrawingTool(next === 'select' ? null : next); if (next !== 'select') shell?.closePanel(); await editor.current.setTool(next); setTool(null); } catch (error) { setDrawingTool(null); onError(error); }
  }
  async function addFormula() {
    if (!formulaInput.trim()) return;
    const formula = { id: crypto.randomUUID(), ...formulaDefaults, latex: formulaInput.trim() };
    if (await apply({ formulas: [...source.formulas, formula] })) { setFormulaInput(''); setAddingFormula(false); select({ type: 'formula', id: formula.id }); }
  }
  async function addExpression(event) {
    event?.preventDefault(); if (!expression.trim()) return;
    try { const operation = parseDefinition(expression, state.objects.map(objectId)); if (await apply({ operations: [operation] })) { setExpression(''); setTool(null); select({ type: 'object', id: operation.name }); } }
    catch (error) { onError(error); }
  }
  async function addStep() {
    const step = { id: crypto.randomUUID(), title: t('步骤 {{number}}', { number: source.steps.length + 1 }), description: '',
      values: Object.fromEntries(parameters(state.objects).map(object => [objectId(object), object.numericValue])),
      visibleObjects: state.objects.filter(object => object.visible !== false).map(objectId), visibleFormulas: source.formulas.map(formula => formula.id), view: source.view };
    if (await apply({ steps: [...source.steps, step], initialStepId: source.initialStepId ?? step.id })) select({ type: 'step', id: step.id });
  }
  async function preview(fullscreen = false) {
    try { await capture(); if (drawingTool) { await editor.current.setTool('select'); setDrawingTool(null); } await editor.current.preview({ stepId: source.initialStepId }); setState(editor.current.read()); if (fullscreen) { setPresenting(true); shell?.closePanel(); } }
    catch (error) { onError(error); }
  }
  async function endPreview() { try { await editor.current?.endPreview(); setState(editor.current.read()); setPresenting(false); } catch (error) { onError(error); } }
  async function removeFormula(formula) {
    if (localFormula?.id === formula.id) { clearTimeout(localTimer.current); localTimer.current = null; setLocalFormula(null); }
    const affected = source.steps.filter(step => step.visibleFormulas.includes(formula.id));
    if (affected.length && !await confirmation(t('删除此公式也会从 {{count}} 个步骤中移除它。', { count: affected.length }))) return;
    await apply({ formulas: source.formulas.filter(item => item.id !== formula.id), steps: source.steps.map(step => ({ ...step, visibleFormulas: step.visibleFormulas.filter(id => id !== formula.id) })) });
    editor.current?.select(null);
  }
  function updateFormula(patch) {
    const next = { ...(localFormula ?? selectedFormula), ...patch }; setLocalFormula(next); clearTimeout(localTimer.current);
    const commit = async () => { if (!next.latex.trim()) { onError(new Error(t('公式不能为空。删除公式请使用移除。'))); return; }
      await apply({ formulas: editor.current.read().source.formulas.map(formula => formula.id === next.id ? next : formula) }); };
    commitFormulaRef.current = commit;
    localTimer.current = setTimeout(() => { localTimer.current = null; void commit(); }, 650);
  }
  function updateStepText(patch) {
    const next = { ...(localStep ?? selectedStep), ...patch }; setLocalStep(next); clearTimeout(stepTimer.current);
    const commit = async () => { if (!next.title.trim()) return; await apply({ steps: editor.current.read().source.steps.map(step => step.id === next.id ? next : step) }); }; commitStepRef.current = commit;
    stepTimer.current = setTimeout(() => { stepTimer.current = null; void commit(); }, 650);
  }
  async function removeObject(object) {
    const id = objectId(object); const affected = source.steps.filter(step => step.visibleObjects.includes(id));
    if (!await confirmation(t('删除 {{name}}？依赖它的图形和步骤将一起调整。', { name: id }))) return;
    await apply({ operations: [{ type: 'delete', name: id, allowDependents: true }], ...(affected.length ? { steps: source.steps.map(step => ({ ...step, visibleObjects: step.visibleObjects.filter(name => name !== id), values: Object.fromEntries(Object.entries(step.values).filter(([name]) => name !== id)) })) } : {}) });
  }
  const editFormula = localFormula ?? selectedFormula;
  const visibleFormulas = state.mode === 'preview' ? source.formulas.filter(formula => state.visibleFormulaIds?.includes(formula.id)) : source.formulas;
  return <section ref={moduleHost} className={`math-workshop${presenting ? ' is-presenting' : ''}`} aria-label={t('数学作品编辑器')}>
    {children}{confirmationDialog}
    <header className="mw-heading">
      <button className="mw-icon" aria-label={t('返回工坊')} onClick={onHome}><Icon name="back" size={18}/></button>
      <input className="mw-title" aria-label={t('作品名')} value={draft.title} maxLength={200} disabled={frozen} onChange={event => onTitle(event.target.value)}/>
      {(source.formulas.length > 0 || source.graph || pending || status === '保存失败') && <span className={`mw-save-state${status === '保存失败' || pending ? ' has-error' : ''}`} role="status">{t(pending && !busy ? '保存结果待确认' : status === '未保存' ? '等待保存' : status)}</span>}
      <div className="mw-heading-actions">
        {state.mode === 'preview' ? <button className="mw-button is-primary" onClick={endPreview}>{t('返回编辑')}</button> : <>
          <button className="mw-button" disabled={!ready || busy} onClick={() => preview()}>{t('试演')}</button>

        </>}
        <button className="mw-button" disabled={busy || !draft.id} onClick={() => setDownloadOpen(value => !value)}>{t('下载')}</button>
        <details className="mw-more"><summary aria-label={t('更多作品操作')}>···</summary><div className="mw-menu">
          <button onClick={onSave} disabled={busy}>{t(pending ? '确认操作结果' : '立即保存')}</button>
          <button onClick={() => preview(true)} disabled={!ready || busy}>{t('课堂展示')}</button>
          <button onClick={onHistory} disabled={!draft.id || busy}>{t('历史版本')}</button>
          <button onClick={onCopy} disabled={busy}>{t('另存作品')}</button>
          <button onClick={onArchive} disabled={!draft.id || busy}>{t('归档作品')}</button>
        </div></details>
      </div>
    </header>
    {(message || pending && !busy) && <div className="mw-notice" role="alert">{message || t('保存结果待确认')}{pending && <button onClick={onSave} disabled={busy}>{t('确认操作结果')}</button>}</div>}{conflictNotice}
    <div className="mw-toolbar">
      <div className="mw-create-tools">
        <button className="mw-button" disabled={frozen || !ready} onClick={() => { setAddingFormula(true); setTool(null); }}><span className="mw-formula-icon" aria-hidden="true">ƒ</span>{t('添加公式')}</button>
        <button className="mw-button" disabled={frozen || !ready} onClick={() => beginTool(tool === 'graph' ? null : 'graph')}><Icon name="math" size={18}/>{t('添加图形')}</button>
        <button className="mw-button" disabled={frozen || !ready} onClick={() => beginTool('parameter')}><Icon name="settings" size={18}/>{t('添加参数')}</button>
        <button className="mw-button" disabled={frozen || !ready} onClick={addStep}><Icon name="prep" size={18}/>{t('教学步骤')}</button>
      </div>
      <div className="mw-view-tools">
        <button className="mw-icon" aria-label={t('撤销')} disabled={frozen || !state.canUndo} onClick={() => moveHistory('undo')}>↶</button>
        <button className="mw-icon" aria-label={t('重做')} disabled={frozen || !state.canRedo} onClick={() => moveHistory('redo')}>↷</button>
        <div className="mw-view-switch" aria-label={t('数学视图')}>{views.map(([view, label]) => <button key={view} aria-pressed={source.view === view} disabled={frozen || !ready} onClick={() => apply({ view })}>{t(label)}</button>)}</div>
        <button className="mw-icon mw-panel-toggle" aria-label={t(shell?.isPanelOpen ? '关闭辅助栏' : '打开辅助栏')} onClick={() => shell?.isPanelOpen ? shell.closePanel() : shell?.openPanel('ai')}><Icon name="menu" size={18}/></button>
      </div>
    </div>
    <div className="mw-layout">
      <main className="mw-surface">
        {!source.formulas.length && !source.graph && !drawingTool && !addingFormula && <div className="mw-empty">
          <div className="mw-empty-symbol"><Icon name="math" size={32}/></div><h2>{t('把数学想法变成课堂素材')}</h2>
          <p>{t('直接输入公式或图形，也可以让 AI 帮你起稿。')}</p>
          <button className="mw-button" onClick={() => setAddingFormula(true)} disabled={!ready}>{t('添加公式')}</button>
        </div>}
        {(visibleFormulas.length > 0 || addingFormula) && <div className="mw-formula-band">
          {visibleFormulas.map(formula => <div key={formula.id} className={`mw-formula-row${selectedFormula?.id === formula.id ? ' is-selected' : ''}`}>
            {selectedFormula?.id === formula.id && !frozen ? <div className="mw-formula-edit"><VisualFormulaInput value={(localFormula ?? formula).latex} onChange={latex => updateFormula({ latex })}/></div> : <button className="mw-formula-select" aria-label={t('编辑公式 {{number}}', { number: source.formulas.indexOf(formula) + 1 })} onClick={() => select({ type: 'formula', id: formula.id })}>
              <FormulaPreview source={{ schemaVersion: 1, kind: 'formula', ...formula, color: shell?.appearance.theme === 'dark' && formula.color === '#1e293b' ? '#eef2f6' : formula.color }}/>
            </button>}
            {!frozen && <button className="mw-icon" aria-label={t('移除公式')} onClick={() => removeFormula(formula)}>×</button>}
          </div>)}
          {addingFormula && <div className="mw-new-formula"><VisualFormulaInput value={formulaInput} onChange={setFormulaInput}/><div className="mw-inline-actions"><button className="mw-button" onClick={() => { setAddingFormula(false); setFormulaInput(''); }}>{t('取消')}</button><button className="mw-button is-primary" disabled={!formulaInput.trim()} onClick={addFormula}>{t('加入作品')}</button></div></div>}
        </div>}
        {drawingTool && <div className="mw-drawing-hint"><span>{t(({ point: '点击画布放置点', segment: '依次点击两个端点', circle: '点击圆心，再点击圆上一点', polygon: '依次点击顶点，最后点击第一个点闭合', midpoint: '选择两个点或一条线段', perpendicular: '选择一个点和一条直线', intersect: '选择两个相交的图形' })[drawingTool])}</span><button className="mw-button" onClick={() => chooseDrawingTool('select')}>{t('完成')}</button><button className="mw-icon" aria-label={t('取消绘图工具')} onClick={() => chooseDrawingTool('select')}>×</button></div>}
        <div className={`mw-graph-area${source.graph || drawingTool ? ' has-graph' : ''}`}><div className={`mw-graph-host${source.graph || drawingTool ? ' has-graph' : ''}`} ref={graphHost} inert={draft.deletedAt || undefined}/>{(source.graph || drawingTool) && <a className="mw-engine-credit" href="/vendor/math/geogebra/NOTICE.txt" target="_blank" rel="noreferrer">GeoGebra</a>}</div>
        {!frozen && <form className="mw-expression" onSubmit={addExpression}>
          <span aria-hidden="true">ƒ</span><input aria-label={t('图形表达式')} placeholder={t('输入图形，例如 f(x)=x^2 或 A=(1,2)')} value={expression} onChange={event => setExpression(event.target.value)}/>
          <button type="submit" className="mw-icon" aria-label={t('建立图形')} disabled={!expression.trim() || !ready}>↵</button>
        </form>}
        {source.steps.length > 0 ? <div className="mw-step-rail"><span>{t('步骤')}</span><nav aria-label={t('教学步骤')}>{source.steps.map((step, index) => <button key={step.id} className={selectedStep?.id === step.id || state.previewStepId === step.id ? 'is-selected' : ''} onClick={() => state.mode === 'preview' ? editor.current.preview({ stepId: step.id }).then(() => setState(editor.current.read())).catch(onError) : select({ type: 'step', id: step.id })}><span>{index + 1}</span>{step.title}</button>)}</nav>{!frozen && <button className="mw-icon" aria-label={t('添加步骤')} onClick={addStep}>+</button>}</div>
          : !frozen && <div className="mw-step-empty"><button className="mw-text-button" disabled={!ready} onClick={addStep}>+ {t('添加教学步骤')}</button></div>}
        {state.mode === 'preview' && <PreviewControls state={state} editor={editor.current} onError={onError} onState={setState} readOnly={!!draft.deletedAt}/>}
      </main>
      {shell && <WorkshopToolsPortal>        <div className="mw-side-content" inert={frozen || undefined}>
          {tool === 'graph' && <div className="mw-tool-section"><h3>{t('添加图形')}</h3>{templates.map(([group, choices]) => <div className="mw-template-group" key={group}><h4>{t(group)}</h4><div>{choices.map(([label, input]) => <button key={label} className="mw-button" onClick={() => { const draw = ({ '点': 'point', '线段': 'segment', '圆': 'circle', '三角形': 'polygon', '中点': 'midpoint', '垂线': 'perpendicular', '交点': 'intersect' })[label]; if (draw) void chooseDrawingTool(draw); else { const operation = parseDefinition(input, []); if (state.objects.some(object => objectId(object) === operation.name)) { let suffix = 2; while (state.objects.some(object => objectId(object) === `${operation.name}${suffix}`)) suffix++; input = input.replace(new RegExp(`^${operation.name}`), `${operation.name}${suffix}`); } setExpression(input); graphHost.current?.parentElement.querySelector('.mw-expression input')?.focus(); } }}>{t(label === '三角形' ? '多边形' : label)}</button>)}</div></div>)}</div>}
          {tool === 'parameter' && <ParameterCreator defaultName={(() => { let name = 'a'; let number = 2; while (state.objects.some(object => objectId(object) === name)) name = `a${number++}`; return name; })()} onCreate={operation => apply({ operations: [operation] }).then(result => { if (result) { setTool(null); select({ type: 'object', id: operation.name }); } })}/>}
          {!tool && editFormula && <div className="mw-tool-section"><h3>{t('公式')}</h3>
            <details><summary>{t('LaTeX 源码')}</summary><textarea aria-label={t('LaTeX 源码')} value={editFormula.latex} onChange={event => updateFormula({ latex: event.target.value })}/><button className="mw-button" onClick={() => navigator.clipboard.writeText(editFormula.latex).catch(onError)}>{t('复制 LaTeX')}</button></details>
            <label>{t('说明')}<textarea value={editFormula.caption} onChange={event => updateFormula({ caption: event.target.value })}/></label>
            <label className="mw-check"><input type="checkbox" checked={editFormula.includeCaption} onChange={event => updateFormula({ includeCaption: event.target.checked })}/>{t('输出时包含说明')}</label>
            <details><summary>{t('样式')}</summary><label>{t('颜色')}<input type="color" value={editFormula.color} onChange={event => updateFormula({ color: event.target.value })}/></label><label>{t('字号')}<input type="number" min="12" max="96" value={editFormula.fontSize} onChange={event => updateFormula({ fontSize: Number(event.target.value) })}/></label></details>
          </div>}
          {!tool && selectedObject && <ObjectTools object={selectedObject} apply={apply} onDelete={() => removeObject(selectedObject)} frozen={frozen} source={source}/>}
          {!tool && selectedStep && <StepTools step={localStep ?? selectedStep} onTextChange={updateStepText} source={source} objects={state.objects} frozen={frozen} apply={apply}/>}
          {!tool && !editFormula && !selectedObject && !selectedStep && <div className="mw-selection-empty"><Icon name="math" size={24}/><p>{t('选择公式、图形或步骤，调整它的属性。')}</p></div>}
          {state.objects.length > 0 && <div className="mw-object-list"><h3>{t('图形与参数')}</h3>{state.objects.map(object => <button key={objectId(object)} className={selectedObject === object ? 'is-selected' : ''} onClick={() => { setTool(null); select({ type: 'object', id: objectId(object) }); }}><span style={{ color: object.color ?? '#64748b' }}>●</span><strong>{objectId(object)}</strong><span>{objectExpression(object) || object.type}</span></button>)}</div>}
          {client && <MathIntegration work={draft} saved={status === '已保存'} busy={busy} onError={onError} client={client}/>}
          {client && draft.id && <MathUsageDetails work={draft}/>}
        </div>
      </WorkshopToolsPortal>}
    </div>
    {downloadOpen && <div className="mw-download" role="dialog" aria-label={t('下载作品')}><header><h3>{t('下载作品')}</h3><button className="mw-icon" onClick={() => setDownloadOpen(false)} aria-label={t('关闭下载')}>×</button></header>
      <div className="mw-download-types">{[['png', '图片'], ['source', '可编辑源'], ['bundle', '课堂演示']].map(([format, label]) => <button className={download.format === format ? 'is-selected' : ''} key={format} onClick={() => setDownload({ ...download, format, selection: 'work' })}>{t(label)}</button>)}</div>
      {['png', 'svg'].includes(download.format) && <><label>{t('内容')}<select value={download.selection} onChange={event => setDownload({ ...download, format: 'png', selection: event.target.value, formulaId: source.formulas[0]?.id })}><option value="work">{t('整份作品')}</option>{source.graph && <option value="graph">{t('数学视图')}</option>}{source.formulas.length > 0 && <option value="formula">{t('公式')}</option>}</select></label>
        {download.selection === 'formula' && <label>{t('公式')}<select value={download.formulaId ?? source.formulas[0]?.id} onChange={event => setDownload({ ...download, formulaId: event.target.value })}>{source.formulas.map((formula, index) => <option value={formula.id} key={formula.id}>{index + 1}. {formula.latex}</option>)}</select></label>}
        <label>{t('尺寸')}<select value={download.width} onChange={event => setDownload({ ...download, width: Number(event.target.value) })}><option value="1200">1200 px</option><option value="1600">1600 px</option><option value="2400">2400 px</option></select></label><label>{t('格式')}<select value={download.format} onChange={event => setDownload({ ...download, format: event.target.value })}><option value="png">PNG</option>{(download.selection === 'formula' || download.selection === 'graph' && openingView === 'plane') && <option value="svg">SVG</option>}</select></label>
        {download.selection !== 'formula' && <label>{t('背景')}<select value={opaqueGraph && download.selection !== 'formula' ? 'white' : download.background} onChange={event => setDownload({ ...download, background: event.target.value })}><option value="white">{t('白色')}</option>{!(opaqueGraph && download.selection !== 'formula') && <option value="transparent">{t('透明')}</option>}</select></label>}
      </>}
      {['png','svg'].includes(download.format) && opaqueGraph && download.selection !== 'formula' && <p>{t('三维图片使用白色背景')}</p>}
      {download.format === 'source' && source.graph && <label className="mw-check"><input type="checkbox" checked={download.selection === 'graph'} onChange={event => setDownload({ ...download, selection: event.target.checked ? 'graph' : 'work' })}/>{t('只取出图形构造（.ggb）')}</label>}
      {download.format === 'bundle' && <p>{t('下载 ZIP 后解压，打开 index.html 进入课堂演示。')}</p>}
      <button className="mw-button is-primary" disabled={busy || status !== '已保存'} onClick={() => onDownload({ ...download, ...(opaqueGraph && download.selection !== 'formula' && download.format === 'png' ? { background: 'white' } : {}), ...(download.format === 'source' && download.selection === 'graph' ? { format: 'ggb' } : {}), ...(['source', 'bundle'].includes(download.format) || download.selection === 'formula' ? { background: 'transparent', width: 1600 } : {}), ...(download.selection === 'formula' ? { formulaId: download.formulaId ?? source.formulas[0]?.id } : { formulaId: undefined }) })}>{t(status !== '已保存' ? '保存后下载' : '下载文件')}</button>
    </div>}
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
  return <div className="mw-tool-section"><h3>{id}</h3><label>{t('名称')}<input value={name} disabled={frozen} onChange={event => setName(event.target.value)} onBlur={() => { if (name !== id) void apply({ operations: [{ type: 'rename', name: id, newName: name }] }); }}/></label><form onSubmit={event => { event.preventDefault(); void apply({ operations: [parseDefinition(`${id}${object.type === 'function' ? '(x)' : ''}=${definition}`, [])] }); }}><label>{t('定义')}<input value={definition} disabled={frozen} onChange={event => setDefinition(event.target.value)}/></label><button className="mw-button" disabled={frozen || definition === actualDefinition}>{t('应用修改')}</button></form>
    {object.slider && <label>{t('取值')}<input type="range" aria-label={t('参数 {{name}}', { name: id })} min={object.slider.min} max={object.slider.max} step={object.slider.step} value={parameterValue} disabled={frozen} onChange={event => setParameterValue(Number(event.target.value))} onPointerUp={() => apply({ operations: [{ type: 'setValue', name: id, value: parameterValue }] })} onKeyUp={() => apply({ operations: [{ type: 'setValue', name: id, value: parameterValue }] })}/><output>{parameterValue}</output></label>}
    {object.slider && range && <details><summary>{t('参数范围')}</summary><form onSubmit={event => { event.preventDefault(); void apply({ operations: [{ type: 'slider', name: id, min: Number(range.min), max: Number(range.max), step: Number(range.step), value: parameterValue }] }); }}>{[['min','最小值'],['max','最大值'],['step','步长']].map(([field,label]) => <label key={field}>{t(label)}<input type="number" step="any" value={range[field] ?? ''} disabled={frozen} onChange={event => setRange({ ...range, [field]: event.target.value })}/></label>)}<button className="mw-button" disabled={frozen}>{t('应用范围')}</button></form></details>}
    <details><summary>{t('样式')}</summary><label>{t('颜色')}<input type="color" disabled={frozen} value={object.color ?? '#2563eb'} onChange={event => apply({ operations: [{ type: 'style', name: id, color: event.target.value }] })}/></label>{isPoint ? <label>{t('点大小')}<input type="number" min="1" max="9" disabled={frozen} value={object.pointSize ?? 5} onChange={event => apply({ operations: [{ type: 'style', name: id, pointSize: Number(event.target.value) }] })}/></label> : <><label>{t('线宽')}<input type="number" min="1" max="13" disabled={frozen} value={object.lineThickness ?? 2} onChange={event => apply({ operations: [{ type: 'style', name: id, lineThickness: Number(event.target.value) }] })}/></label><label>{t('线型')}<select disabled={frozen} value={object.lineStyle ?? 0} onChange={event => apply({ operations: [{ type: 'style', name: id, lineStyle: Number(event.target.value) }] })}><option value="0">{t('实线')}</option><option value="1">{t('虚线')}</option><option value="3">{t('点线')}</option></select></label></>}<label className="mw-check"><input type="checkbox" disabled={frozen} checked={object.visible !== false} onChange={event => apply({ operations: [{ type: 'style', name: id, visible: event.target.checked }] })}/>{t('显示图形')}</label><label className="mw-check"><input type="checkbox" disabled={frozen} checked={!!object.labelVisible} onChange={event => apply({ operations: [{ type: 'style', name: id, labelVisible: event.target.checked }] })}/>{t('显示标注')}</label></details>{object.slider && <details><summary>{t('参数播放')}</summary><label className="mw-check"><input type="checkbox" disabled={frozen} checked={source.animation?.parameter === id} onChange={event => apply({ animation: event.target.checked ? { parameter: id, seconds: 8, mode: 'bounce' } : null })}/>{t('试演时播放此参数')}</label>{source.animation?.parameter === id && <><label>{t('单程秒数')}<input type="number" min="1" max="120" value={source.animation.seconds} disabled={frozen} onChange={event => apply({ animation: { ...source.animation, seconds: Number(event.target.value) } })}/></label><label>{t('播放方式')}<select disabled={frozen} value={source.animation.mode} onChange={event => apply({ animation: { ...source.animation, mode: event.target.value } })}><option value="once">{t('单次')}</option><option value="loop">{t('循环')}</option><option value="bounce">{t('往返')}</option></select></label></>}</details>}{object.type === 'point' && <label className="mw-check"><input type="checkbox" checked={source.traceObjects.includes(id)} disabled={frozen} onChange={event => apply({ traceObjects: event.target.checked ? [...source.traceObjects, id] : source.traceObjects.filter(name => name !== id) })}/>{t('试演时显示轨迹')}</label>}<button className="mw-text-button is-danger" disabled={frozen} onClick={onDelete}>{t('删除对象')}</button>
  </div>;
}
function StepTools({ step, onTextChange, source, objects, apply, frozen }) {
  const { t } = useTranslation('math');
  const update = patch => apply({ steps: source.steps.map(item => item.id === step.id ? { ...step, ...patch } : item) });
  return <div className="mw-tool-section"><h3>{t('教学步骤')}</h3><label>{t('步骤标题')}<input key={`${step.id}-title`} value={step.title} disabled={frozen} onChange={event => onTextChange({ title: event.target.value })}/></label><label>{t('讲解说明')}<textarea key={`${step.id}-description`} value={step.description} disabled={frozen} onChange={event => onTextChange({ description: event.target.value })}/></label>
    <label>{t('展示视图')}<select disabled={frozen} value={step.view} onChange={event => update({ view: event.target.value })}>{views.map(([value, title]) => <option value={value} key={value}>{t(title)}</option>)}</select></label>
    <details open><summary>{t('显示内容')}</summary>{objects.map(object => <label className="mw-check" key={objectId(object)}><input disabled={frozen} type="checkbox" checked={step.visibleObjects.includes(objectId(object))} onChange={event => update({ visibleObjects: event.target.checked ? [...step.visibleObjects, objectId(object)] : step.visibleObjects.filter(id => id !== objectId(object)) })}/>{objectId(object)}</label>)}{source.formulas.map((formula, index) => <label className="mw-check" key={formula.id}><input disabled={frozen} type="checkbox" checked={step.visibleFormulas.includes(formula.id)} onChange={event => update({ visibleFormulas: event.target.checked ? [...step.visibleFormulas, formula.id] : step.visibleFormulas.filter(id => id !== formula.id) })}/>{t('公式 {{number}}', { number: index + 1 })}</label>)}</details>
    <details><summary>{t('参数值')}</summary>{parameters(objects).map(object => <label key={objectId(object)}>{objectId(object)}<input type="number" step={object.slider.step} disabled={frozen} value={step.values[objectId(object)]} onChange={event => update({ values: { ...step.values, [objectId(object)]: Number(event.target.value) } })}/></label>)}</details>
    <div className="mw-step-order">{['up', 'down'].map(direction => <button key={direction} className="mw-button" disabled={frozen || (direction === 'up' ? source.steps[0].id === step.id : source.steps.at(-1).id === step.id)} onClick={() => { const steps = [...source.steps]; const index = steps.findIndex(item => item.id === step.id); const next = index + (direction === 'up' ? -1 : 1); [steps[index], steps[next]] = [steps[next], steps[index]]; void apply({ steps }); }}>{t(direction === 'up' ? '前移' : '后移')}</button>)}</div><button className="mw-button" disabled={frozen || source.initialStepId === step.id} onClick={() => apply({ initialStepId: step.id })}>{t(source.initialStepId === step.id ? '开场步骤' : '设为开场')}</button><button className="mw-text-button is-danger" disabled={frozen} onClick={() => { const steps = source.steps.filter(item => item.id !== step.id); apply({ steps, initialStepId: source.initialStepId === step.id ? steps[0]?.id ?? null : source.initialStepId }); }}>{t('删除步骤')}</button>
  </div>;
}
function PreviewControls({ state, editor, onError, onState, readOnly }) {
  const { t } = useTranslation('math'); const step = state.source.steps.find(item => item.id === state.previewStepId);
  const [values, setValues] = useState({});
  const signature = parameters(state.objects).map(object => `${objectId(object)}:${object.numericValue}`).join(',');
  useEffect(() => setValues(Object.fromEntries(parameters(state.objects).map(object => [objectId(object), object.numericValue]))), [signature, state.previewStepId]);
  const show = options => editor.preview(options).then(() => onState(editor.read())).catch(onError);
  return <div className="mw-preview-controls">{step?.description && <p>{step.description}</p>}
    {parameters(state.objects).map(object => <label key={objectId(object)}><span>{objectId(object)} = {values[objectId(object)] ?? object.numericValue}</span><input type="range" aria-label={t('试演参数 {{name}}', { name: objectId(object) })} min={object.slider.min} max={object.slider.max} step={object.slider.step} value={values[objectId(object)] ?? object.numericValue ?? 0}
      onChange={event => setValues({ ...values, [objectId(object)]: Number(event.target.value) })} onPointerUp={() => show({ stepId: state.previewStepId, values })} onKeyUp={() => show({ stepId: state.previewStepId, values })}/></label>)}
    {state.source.animation && <button className="mw-button" onClick={() => show({ stepId: state.previewStepId, play: true })}>{t('播放')}</button>}
    <button className="mw-button" disabled={readOnly} onClick={() => editor.apply({ baseEditRevision: state.editRevision, changes: { setAsOpening: true } }).then(() => onState(editor.read())).catch(onError)}>{t('设为开场状态')}</button>
    <button className="mw-button" onClick={() => show({ stepId: state.previewStepId })}>{t('重置')}</button>
  </div>;
}

function WorkshopToolsPortal({ children }) {
  const { t } = useTranslation('math'); const [host, setHost] = useState(null);
  useAuxiliaryTools([{ id: 'math-workshop-tools', label: t('工具'), render: () => <div className="mw-tool-host" ref={setHost}/> }]);
  return host ? createPortal(children, host) : null;
}
