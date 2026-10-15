import React, { useContext, useEffect, useLayoutEffect } from 'react';
import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
import { constructionIssue } from '@teachbuddy/shared/math/geometry';
import { projectSpace } from '@teachbuddy/shared/math/graphics';
import { useScrollRestore } from '../../components/interaction/useScrollRestore.js';
import { ModulePresence } from '../../components/interaction/ModuleMotion.jsx';
import { Popover, MenuItem } from '../../components/interaction/ModuleOverlays.jsx';
import { Icon } from '../../components/icons.jsx';
import { ShellContext } from '../workbench/shellContext.js';
import { MathTools } from './Integration.jsx';
import { addSurface } from './SurfaceTools.jsx';
import { updateObjects } from './editing.js';
import { dynamicSource, emptyDynamicSource, emptySource, newElement, cubeSource, pyramidSource, defaultStyle } from './model.js';
import { WorkIllustration, mathStatusLabel } from './WorkspaceHome.jsx';
import DynamicPreview from './DynamicPreview.jsx';
import GraphTools from './GraphTools.jsx';
import GraphicPreview from './GraphicPreview.jsx';
import FormulaEditor from './FormulaEditor.jsx';
import FormulaPreview from './FormulaPreview.jsx';
import HtmlEditor from './HtmlEditor.jsx';
import { WorkspaceToolbar } from './WorkspaceControls.jsx';
import WorkHistory from './WorkHistory.jsx';
const t = (key, options) => i18n.t(key, { ns: 'math', ...options });
const names = {
  get dynamic() { return t("演示"); },
  html: "HTML",
  get name() { return t("参数名"); },
  get initial() { return t("初值"); },
  get step() { return t("步长"); },
  get formula() { return t("公式"); },
  get plane() { return t("平面图形"); },
  get space() { return t("空间图形"); },
  get function() { return t("函数"); },
  get piecewise() { return t("分段函数"); },
  get face() { return t("面"); },
  get section() { return t("截面"); },
  get tickLabels() { return t("刻度与轴名"); },
  get point() { return t("点"); },
  get line() { return t("线段"); },
  get ellipse() { return t("圆 / 椭圆"); },
  get polyline() { return t("多边形"); },
  get text() { return t("文字"); },
  get id() { return t("名称"); },
  x: "x",
  y: "y",
  z: "z",
  get expression() { return t("表达式"); },
  get min() { return t("最小值"); },
  get max() { return t("最大值"); },
  get dx() { return t("水平偏移"); },
  get dy() { return t("垂直偏移"); },
  get stroke() { return t("颜色"); },
  get fill() { return t("填充"); },
  get width() { return t("宽度"); },
  get dash() { return t("线型"); },
  get fontSize() { return t("字号"); },
  get closed() { return t("闭合"); },
  get arrow() { return t("箭头"); },
  get from() { return t("起点"); },
  get to() { return t("终点"); },
  get rx() { return t("水平半径"); },
  get ry() { return t("垂直半径"); },
  get xMin() { return t("x 最小"); },
  get xMax() { return t("x 最大"); },
  get yMin() { return t("y 最小"); },
  get yMax() { return t("y 最大"); },
  get height() { return t("高度"); },
  get axes() { return t("坐标轴"); },
  get grid() { return t("网格"); },
  get at() { return t("坐标"); },
  get center() { return t("中心"); },
  get domain() { return t("定义域"); },
  get label() { return t("标签"); },
  get style() { return t("样式"); },
  get points() { return t("顶点"); },
  get azimuth() { return t("方位角"); },
  get elevation() { return t("仰角"); },
};
function fitSpace(source) {
  const points = source.points.map(p => projectSpace(p, source.azimuth, source.elevation));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return { ...source, viewport: { ...source.viewport, xMin: Math.min(...xs) - 1, xMax: Math.max(...xs) + 1, yMin: Math.min(...ys) - 1, yMax: Math.max(...ys) + 1 } };
}
function Fields({ value, onChange, prefix = "" }) {
  const { t } = useTranslation('math');
  return (
    <div className="math-fields">
      {Object.entries(value)
        .filter(([key]) => !["type", "schemaVersion", "kind"].includes(key))
        .sort(([a], [b]) => Number(a === "style") - Number(b === "style"))
        .map(([key, child]) => {
          const caption = names[key] ?? key,
            id = `${prefix}${key}`;
          if (child && typeof child === "object")
            return (
              <fieldset key={key}>
                <legend>{caption}</legend>
                {Array.isArray(child) ? (
                  <>
                    {" "}
                    {child.map((v, i) => (
                      <div key={i}>
                        <Fields
                          key={i}
                          value={v}
                          prefix={`${id}-${i}-`}
                          onChange={(next) =>
                            onChange({
                              ...value,
                              [key]: child.map((old, j) =>
                                j === i ? next : old,
                              ),
                            })
                          }
                        />
                        <button
                          disabled={child.length <= 2}
                          onClick={() =>
                            onChange({
                              ...value,
                              [key]: child.filter((_, j) => j !== i),
                            })
                          }
                        >
                          {t("移除顶点")} {i + 1}
                        </button>
                      </div>
                    ))}{" "}
                    <button
                      disabled={child.length >= 100}
                      onClick={() =>
                        onChange({
                          ...value,
                          [key]: [...child, { x: "0", y: "0" }],
                        })
                      }
                    >
                      {t("添加顶点")}
                    </button>
                  </>
                ) : (
                  <Fields
                    value={child}
                    prefix={`${id}-`}
                    onChange={(next) => onChange({ ...value, [key]: next })}
                  />
                )}
              </fieldset>
            );
          const update = (v) => onChange({ ...value, [key]: v });
          const options =
            key === "dash"
              ? ["solid", "dashed", "dotted"]
              : key === "arrow"
                ? ["none", "end", "both"]
                : null;
          return (
            <label key={key}>
              {caption}
              {options ? (
                <select
                  aria-label={id}
                  value={child}
                  onChange={(e) => update(e.target.value)}
                >
                  {options.map((v) => (
                    <option key={v} value={v}>
                      {
                        {
                          solid: t("实线"),
                          dashed: t("虚线"),
                          dotted: t("点线"),
                          none: t("无"),
                          end: t("终点"),
                          both: t("两端"),
                        }[v]
                      }
                    </option>
                  ))}
                </select>
              ) : typeof child === "boolean" ? (
                <input
                  aria-label={id}
                  type="checkbox"
                  checked={child}
                  onChange={(e) => update(e.target.checked)}
                />
              ) : (
                <input
                  aria-label={id}
                  type={
                    typeof child === "number"
                      ? "number"
                      : key === "stroke"
                        ? "color"
                        : "text"
                  }
                  step="any"
                  value={child ?? ""}
                  onChange={(e) =>
                    update(
                      typeof child === "number"
                        ? Number(e.target.value)
                        : e.target.value === "" && key === "fill"
                          ? null
                          : e.target.value,
                    )
                  }
                />
              )}
            </label>
          );
        })}
    </div>
  );
}
export default function LegacyWorkspace({ session, font, fontError, fontAttempt, retryFont, confirm, confirmationDialog, conflictNotice, importFile, sourceFile }) {
  const { t } = useTranslation('math');
  const shell = useContext(ShellContext);
  const Tools = shell ? MathTools : 'aside';
  const { work: draft, status, pending, message, busy, readOnly, home, account, client, importPending } = session;
  const { format, background, width: exportWidth, change: changeExport } = session.exportOptions;
  const { scene: viewScene, selected, select: setSelected, change: patchView, selectGraphic, showTools, expandTool } = session.view;
  const { open: historyOpen, canChange: canChangeHistory, move: moveHistory, restore: restoreVersion } = session.history;
  const history = session.history;
  const { changeLegacyWork: edit, changeSource: source, home: goHome, save, exportFile, importHtml, importSource, downloadOriginal, makeDynamicCopy, reportError: handleError } = session.actions;
  const deletion = (permanent = false, target) => permanent ? session.actions.purge(target) : session.actions.archive(target);
  const setHistoryOpen = open => open ? history.show() : history.close();
  const setFormat = format => changeExport({ format });
  const setBackground = background => changeExport({ background });
  const setExportWidth = width => changeExport({ width });
  const canvasScroll = useScrollRestore(home ? viewScene.homeTop ?? 0 : viewScene.canvasTop,
    top => patchView(home ? { homeTop: top } : { canvasTop: top }), `${home}:${draft?.id}:${draft?.source.kind}:${Boolean(font)}`);
  useLayoutEffect(() => { if (canvasScroll.ref.current) canvasScroll.ref.current.scrollTop = home ? viewScene.homeTop ?? 0 : viewScene.canvasTop; }, [home]);
  useEffect(() => { if (canvasScroll.ref.current) canvasScroll.ref.current.scrollLeft = home ? 0 : viewScene.canvasLeft; }, [account, home, draft?.id, font]);
  const objects =
    ["plane", "dynamic"].includes(draft?.source.kind) && !readOnly
      ? draft.source.scene.elements
      : (draft?.source.points ?? []);
  function replaceObject(next) {
    const previous = objects[selected];
    if (previous.id !== next.id && previous.label?.text === previous.id && next.label?.text === previous.id) next = { ...next, label: { ...next.label, text: next.id } };
    if (
      objects.some(
        (object, index) => index !== selected && object.id === next.id,
      )
    ) {
      handleError(new Error(t("对象标识已存在，请使用不同标识")));
      return;
    }
    const replacement = objects.map((v, i) => i === selected ? next : v);
    const renamed = previous.id !== next.id ? { from: previous.id, to: next.id } : null;
    const references = replacement.map(e => renamed && e.construction ? {
      ...e, construction: { ...e.construction, refs: e.construction.refs.map(id => id === renamed.from ? renamed.to : id) },
    } : e);
    if (draft.source.scene && constructionIssue(references)) {
      handleError(new Error(t("构造引用须有效且不能形成循环"))); return;
    }
    source(
      updateObjects(
        draft.source,
        replacement,
        renamed,
      ),
    );
  }

  function add(type) {
    let index = 1;
    const prefix = {
      function: "f",
      piecewise: "f",
      point: "P",
      line: "L",
      ellipse: "E",
      polyline: "G",
      text: "T",
    }[type];
    while (objects.some((object) => object.id === `${prefix}${index}`)) index++;
    const id = `${prefix}${index}`;
    source(updateObjects(draft.source, [...objects, newElement(type, id)]));
    setSelected(objects.length);
  }
  const graphical = !readOnly && ['plane', 'space', 'dynamic'].includes(draft?.source.kind);
  const toolTab = ['objects', 'parameters', 'steps', 'canvas', 'analysis', 'construct'].includes(viewScene.toolTab) ? viewScene.toolTab : 'objects';
  const selection = `${viewScene.selectionKind ?? 'object'}:${selected}`;
  async function useTemplate() {
    const kind = draft.source.kind;
    const empty = kind === 'dynamic' ? emptyDynamicSource() : emptySource(kind);
    if (JSON.stringify(draft.source) !== JSON.stringify(empty) && !await confirm(t("使用示例会替换当前图形及设置，是否继续？"))) return;
    const example = kind === 'dynamic' ? dynamicSource() : kind === 'space' ? fitSpace(cubeSource()) : { ...empty, scene: { ...empty.scene, elements: [{ ...newElement('function', 'f1'), expression: 'x^2' }] } };
    edit({ ...draft, source: example, parameterEdits: {} });
    setSelected(0); patchView({ selectionKind: 'object' });
    if (kind !== 'dynamic') showTools('objects');
    else if (shell?.panelMode === 'math-tools') shell.closePanel();
  }
  function addGraphic(type) {
    if (draft.source.kind !== 'space') { add(type); patchView({ selectionKind: 'object' }); }
    else if (type === 'point') {
      let index = 1;
      while (objects.some(p => p.id === `P${index}`)) index++;
      const id = `P${index}`;
      source({ ...draft.source, points: [...objects, { id, x: 0, y: 0, z: 0, label: { text: id, dx: 10, dy: -10 }, style: defaultStyle() }] });
      setSelected(objects.length); patchView({ selectionKind: 'object' });
    } else if (['face', 'section'].includes(type)) {
      const key = type === 'face' ? 'faces' : 'sections';
      source(addSurface(draft.source, type)); setSelected(draft.source[key]?.length ?? 0); patchView({ selectionKind: type });
    } else {
      source({ ...draft.source, edges: [...draft.source.edges, { id: `E${Date.now()}`, from: objects[0].id, to: objects[1].id, style: defaultStyle() }] });
      setSelected(draft.source.edges.length); patchView({ selectionKind: 'edge' });
    }
    showTools('objects');
  }
  async function removeGraphic() {
    const kind = viewScene.selectionKind;
    let next;
    if (kind === 'edge') next = { ...draft.source, edges: draft.source.edges.filter((_, i) => i !== selected) };
    else if (kind === 'face' || kind === 'section') {
      if (kind === 'face' && draft.source.sections?.length && !await confirm(t("移除此面也会移除依赖完整多面体的截面，是否继续？"))) return;
      const key = kind === 'face' ? 'faces' : 'sections';
      next = { ...draft.source, [key]: draft.source[key].filter((_, i) => i !== selected), ...(kind === 'face' && draft.source.sections ? { sections: [] } : {}) };
    } else {
      next = updateObjects(draft.source, objects.filter((_, i) => i !== selected));
      const dependents = draft.source.scene ? objects.length - next.scene.elements.length - 1 : (draft.source.faces?.length ?? 0) - (next.faces?.length ?? 0) + (draft.source.sections?.length ?? 0) - (next.sections?.length ?? 0);
      if (dependents > 0 && !await confirm(t("移除此对象也会移除 {{count}} 个依赖它的构造、面或截面，是否继续？", { count: dependents }))) return;
    }
    source(next); setSelected(0); patchView({ selectionKind: 'object' });
  }
  return (
    <div className="math-workbench wb-module">
      <ModulePresence present={historyOpen}>{historyOpen && <WorkHistory work={draft} client={client} font={font} hasChanges={status !== "已保存"} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion}/>}</ModulePresence>
      {confirmationDialog}
      <section className="math-main">
        <header className="math-workspace-header">
          <div className="math-workspace-identity"><span className="math-module-icon"><Icon name="math" size={25}/></span><h1 className="math-heading">{t("数学工坊")}</h1></div>
          {!home && <WorkspaceToolbar draft={draft} busy={busy} readOnly={readOnly} pending={pending} empty={session.empty}
            exportOpen={!!viewScene.exportOpen} onHome={goHome} onSave={() => save()} onCopy={() => save(true)}
            onHistory={() => setHistoryOpen(true)} onDynamic={makeDynamicCopy}
            onDelete={() => deletion()} onPurge={() => deletion(true)} onExport={() => patchView({ exportOpen: !viewScene.exportOpen })}/>}
          <input ref={importFile} type="file" accept=".html,.htm" aria-label={t("导入 HTML 文件")} hidden onChange={e => { importHtml(e.target.files[0]); e.target.value = ''; }}/>
          <input ref={sourceFile} type="file" accept=".json,application/json" aria-label={t("导入制作源文件")} hidden onChange={e => { importSource(e.target.files[0]); e.target.value = ''; }}/>
          {importPending && <button disabled={busy} onClick={() => importHtml()}>{importPending.requiresReselection ? t("重选原文件并确认上传") : t("重试原文件上传")}</button>}
        </header>
        {!home && <div className="math-document-bar">
          <button className="math-return" onClick={goHome}><Icon name="back"/><span>{t("返回工坊")}</span></button>
          <input className="math-work-title" aria-label={t("作品名称")} readOnly={!!draft.deletedAt} value={draft.title} onChange={e => edit({ ...draft, title: e.target.value })}/>
          <span className="math-workspace-status" role="status">{draft.deletedAt ? t("已归档") : mathStatusLabel(status)}</span>
          {!draft.deletedAt && <div className="math-undo-actions" aria-label={t("编辑历史")}>
            {['undo', 'redo'].map(direction => <button key={direction} className="math-icon-button" aria-label={direction === 'undo' ? t("撤销") : t("重做")} title={direction === 'undo' ? t("撤销 (Ctrl/Cmd+Z)") : t("重做 (Ctrl/Cmd+Shift+Z)")} disabled={!canChangeHistory || !(direction === 'undo' ? history.canUndo : history.canRedo)} onClick={() => moveHistory(direction)}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={direction === 'redo' ? { transform: 'scaleX(-1)' } : undefined}><path d="M7 4 3 8l4 4M3 8h8a5 5 0 0 1 0 10"/></svg>
            </button>)}
          </div>}
        </div>}
        {fontError && (
          <div role="alert" className="math-message">
            {fontError}
            <button onClick={() => retryFont()}>
              {t("重试字体")}
            </button>
          </div>
        )}
        {pending && home && <div className="math-message" role="status">{t("上次操作结果待确认。")}<button disabled={busy} onClick={() => save()}>{t("确认操作结果")}</button></div>}
        {!home && draft.deletedAt && <div className="math-archive-notice">{t("已归档，恢复后可继续编辑。")}</div>}
        {message && (
          <div role="alert" className="math-message">
            {message}
          </div>
        )}
        {conflictNotice}
        {!home && draft && <ModulePresence present={!!viewScene.exportOpen} mode="collapse">
          <section id="math-export-options" className="math-export-options" aria-label={t("导出作品")}>
            <label>{t("文件格式")}<select
              aria-label={t("导出格式")}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {draft.source.kind !== "html" && (
                <>
                  <option value="png">{t("图片 · PNG")}</option>
                  <option value="svg">{t("矢量图片 · SVG")}</option>
                </>
              )}
              {["dynamic", "html"].includes(draft.source.kind) && (
                <option value="html">{t("离线演示 · HTML")}</option>
              )}
              <option value="source">
                {draft.source.kind === "html" ? t("当前源码 HTML") : t("制作源 JSON")}
              </option>
            </select></label>
            {!["source", "html"].includes(format) && (
              <>
                <label>{t("背景")}<select
                  aria-label={t("导出背景")}
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                >
                  <option value="transparent">{t("透明")}</option>
                  {draft.source.kind !== "formula" && (
                    <option value="white">{t("白底")}</option>
                  )}
                </select></label>
                <label>{t("宽度（像素）")}<input
                  aria-label={t("导出宽度")}
                  type="number"
                  value={exportWidth}
                  min="200"
                  max="4800"
                  onChange={(e) => setExportWidth(Number(e.target.value))}
                /></label>
              </>
            )}
            <button className="math-primary" disabled={busy || (!pending && (!draft.id || status !== "已保存"))} onClick={() => exportFile()}>
              {t("下载作品")}
            </button>
            {(!draft.id || status !== "已保存") && !pending && <span className="math-hint">{t("保存作品后即可下载")}</span>}
          </section>
        </ModulePresence>}
        {!home && !draft.deletedAt && graphical && <div className="math-editing-toolbar" aria-label={t("制作操作")}>
          <Popover label={t("添加图形")} icon={null} align="start" buttonClassName="math-action-button">{({ close }) => <>
            {(draft.source.kind === 'space' ? ['point', 'edge', 'face', 'section'] : ['function', 'piecewise', 'point', 'line', 'ellipse', 'polyline', 'text']).map(type => <MenuItem key={type} disabled={(type === 'edge' && objects.length < 2) || (type === 'face' && objects.length < 3) || (type === 'section' && (draft.source.faces?.length ?? 0) < 4)} onClick={() => { close(); addGraphic(type); }}>{t("添加")}{type === 'edge' ? t("棱") : names[type]}</MenuItem>)}
            {draft.source.scene && <MenuItem onClick={() => { close(); showTools('construct'); }}>{t("关联构造…")}</MenuItem>}
            {draft.source.kind === 'space' && <MenuItem onClick={async () => { close(); if (objects.length && !await confirm(t("使用棱锥会替换当前图形，是否继续？"))) return; source(fitSpace(pyramidSource())); selectGraphic('object:0'); }}>{t("棱锥示例")}</MenuItem>}
          </>}</Popover>
          <button onClick={() => showTools('objects')}>{t("图形与标注")}</button>
          {draft.source.scene && <button onClick={() => showTools('analysis')}>{t("函数分析")}</button>}
          {draft.source.kind === 'dynamic' && <><button onClick={() => showTools('parameters')}>{t("设置滑杆")}</button><button onClick={() => showTools('steps')}>{t("编排步骤")}</button></>}
          <button className="math-icon-button math-canvas-settings" title={t("画布设置")} aria-label={t("画布设置")} onClick={() => showTools('canvas')}>
            <svg className="wb-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M3 5h3m4 0h7M3 10h8m4 0h2M3 15h3m4 0h7"/><circle cx="8" cy="5" r="2"/><circle cx="13" cy="10" r="2"/><circle cx="8" cy="15" r="2"/>
            </svg>
          </button>
        </div>}
        <div className={`math-canvas${home ? ' is-home' : ''}`} ref={canvasScroll.ref} onScroll={event => { canvasScroll.onScroll(event); if (!home) patchView({ canvasLeft: event.currentTarget.scrollLeft }); }}>
          {draft.deletedAt ? <div className="math-archived-preview">
            {draft.source.kind === 'formula' ? <FormulaPreview source={draft.source} retry={fontAttempt}/>
              : ['plane', 'space', 'dynamic'].includes(draft.source.kind) ? <GraphicPreview source={draft.source} font={font}/>
              : <p>{t("HTML 演示已归档，可下载查看或恢复后运行。")}</p>}
          </div> : readOnly ? (
            <div className="math-formula">
              <p>{t("作品格式需要更新，请升级后编辑。")}</p>
              <pre>{JSON.stringify(draft.source, null, 2)}</pre>
            </div>
          ) : draft.source.kind === "html" ? (
            <HtmlEditor
              key={draft.id ?? draft.source.fileId}
              draft={draft}
              client={client}
              onChange={edit}
              onError={handleError}
              onDownload={downloadOriginal}
            />
          ) : graphical && !objects.length ? (
            <div className="math-canvas-start"><WorkIllustration kind={draft.source.kind}/>
              <h2>{draft.source.kind === 'space' ? t("从一个立体图形开始") : draft.source.kind === 'dynamic' ? t("让图形动起来") : t("画出第一个图形")}</h2>
              <p>{draft.source.kind === 'space' ? t("选择示例后，可以改顶点、添加棱和调整观察角度。") : draft.source.kind === 'dynamic' ? t("先试着拖动参数，再调整图形和讲解步骤。") : t("输入函数表达式，或添加点、线段和标注。")}</p>
              <div><button className="math-primary" onClick={useTemplate}>{draft.source.kind === 'space' ? t("正方体示例") : draft.source.kind === 'dynamic' ? t("试试二次函数演示") : t("从 y = x² 开始")}</button>
              <button onClick={() => addGraphic(draft.source.kind === 'space' ? 'point' : 'function')}>{draft.source.kind === 'space' ? t("添加空间点") : t("添加函数")}</button></div>
            </div>
          ) : draft.source.kind === "dynamic" ? (
            <DynamicPreview
              accountKey={account}
              workId={draft.id ?? "new"}
              source={draft.source}
              font={font}
              onChange={source}
              onSelect={id => { const index = objects.findIndex(o => o.id === id); if (index >= 0) selectGraphic(`object:${index}`); }}
              selectedId={viewScene.selectionKind !== 'edge' ? objects[selected]?.id : null}
            />
          ) : draft.source.kind === "formula" ? (
            <FormulaEditor source={draft.source} onChange={source} view={viewScene} onView={patchView} confirm={confirm} retry={fontAttempt}
              savedInvalid={draft.render?.state === 'invalid' && status === "已保存"}/>
          ) : <GraphicPreview source={draft.source} font={font} selection={selection} onSelect={selectGraphic}/>}
        </div>
      </section>
      {!home && !draft.deletedAt && graphical && <Tools {...(shell ? { sceneKey: `${draft?.id ?? 'new'}:${toolTab}` } : {})}>
        <GraphTools active={toolTab} source={draft.source} selection={selection} onSelect={selectGraphic} objects={objects}
          onChange={(next, parameterEdits = draft.parameterEdits) => edit({ ...draft, source: next, parameterEdits })}
          onReplace={replaceObject} onRemove={removeGraphic} Fields={Fields} expanded={viewScene.groups ?? {}} onExpanded={expandTool} onTool={showTools}
          edits={draft.parameterEdits} onEdits={parameterEdits => edit({ ...draft, parameterEdits })} confirm={confirm}/>
      </Tools>}
    </div>
  );
}
