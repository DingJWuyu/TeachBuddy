import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'math', ...options });
import { addSurface } from './SurfaceTools.jsx';
import { constructionIssue } from '@refatos/shared/math/geometry';
import { useMathConfirm } from "./useMathConfirm.jsx";
import { useScene } from '../../platform/device/useScene.js';
import { useScrollRestore } from '../../components/interaction/useScrollRestore.js';
import { readLocal, writeLocal, migrateLegacyLocal } from '../../platform/device/storage.js';
import { ShellContext } from "../workbench/shellContext.js";
import { MathTools } from "./Integration.jsx";
import { uploadDraft } from "./uploadDraft.js";
import { reselectDeviceFile } from '../../platform/device/deviceRequestStore.js';
import { useForegroundRefresh } from '../../components/interaction/useForegroundRefresh.js';
import DynamicPreview from "./DynamicPreview.jsx";
import GraphTools from "./GraphTools.jsx";
import WorkspaceHome, { WorkIllustration, mathStatusLabel } from "./WorkspaceHome.jsx";
import GraphicPreview from "./GraphicPreview.jsx";
import FormulaEditor from "./FormulaEditor.jsx";
import FormulaPreview from "./FormulaPreview.jsx";
import { Icon } from "../../components/icons.jsx";
import { Popover, MenuItem } from "../../components/interaction/ModuleOverlays.jsx";
import HtmlEditor from "./HtmlEditor.jsx";
import { dynamicSource, emptyDynamicSource } from "./model.js";
import { updateObjects } from "./editing.js";
import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useContext, useCallback } from "react";
import { projectSpace } from "@refatos/shared/math/graphics";
import {
  emptySource,
  newElement,
  cubeSource,
  pyramidSource,
  defaultStyle,
} from "./model.js";
import { createMathClient } from "./api.js";
import { useAuth } from "../auth/index.jsx";
import { loadMathFont } from "./localFont.js";
import "./math.css";
import "./workspace.css";
import { ModulePresence } from '../../components/interaction/ModuleMotion.jsx';
import { WorkspaceToolbar } from './WorkspaceControls.jsx';
import { useDraftHistory } from './useDraftHistory.js';
import GgbWorkspace from './GgbWorkspace.jsx';
import WorkshopWorkspace from './WorkshopWorkspace.jsx';
import { createWorkshopSource } from '@refatos/shared/math/workshop';
import WorkHistory from './WorkHistory.jsx';
const base = "/api/modules/math/v1/works";
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
function hasWorkshopInput(draft) { return draft?.source.kind === 'workshop' && Object.values(draft.workshopInput ?? {}).some(value => typeof value === 'string' && value.trim()); }
function hasContent(draft) {
  if (!draft) return false;
  if (draft.id || draft.source.kind === 'html' || Object.keys(draft.parameterEdits ?? {}).length) return true;
  const kind = draft.source.kind;
  if (kind === 'workshop') return !!(draft.source.formulas.length || draft.source.graph || hasWorkshopInput(draft));
  if (kind === 'geogebra') return (draft.ggbTouched ?? !!draft.source.base64) || draft.title !== '未命名数学作品';
  const empty = kind === 'dynamic' ? emptyDynamicSource() : emptySource(kind);
  return draft.title !== `未命名${({ dynamic: "演示", html: "HTML", formula: "公式", plane: "平面图形", space: "空间图形" })[kind]}` || JSON.stringify(draft.source) !== JSON.stringify(empty);
}
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
export function MathWorkbench({ transport, route } = {}) {
  return transport ? (
    <MathSession transport={transport} route={route} />
  ) : (
    <AuthenticatedMath route={route} />
  );
}
function AuthenticatedMath({ route }) {
  const { request, account } = useAuth();
  return (
    <MathSession key={account.accountKey} transport={request} route={route} />
  );
}
function MathSession({ transport, route }) {
  const { t } = useTranslation('math');
  const shell = useContext(ShellContext);
  const Tools = shell ? MathTools : "aside";
  const [font, setFont] = useState(null);
  const [fontError, setFontError] = useState("");
  const [fontAttempt, setFontAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFontError("");
    loadMathFont().then(
      (value) => {
        if (live) setFont(value);
      },
      () => {
        if (live) setFontError(t("本地字体加载失败，预览暂不可用。"));
      },
    );
    return () => {
      live = false;
    };
  }, [fontAttempt]);
  const controller = useRef(new AbortController());
  const client = useMemo(
    () => createMathClient(transport, () => controller.current.signal),
    [transport],
  );
  const mathRequest = client.json;
  const [account, setAccount] = useState(null),
    [loadedStorage, setLoadedStorage] = useState(null),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false),
    [draft, setDraft] = useState(null),
    [items, setItems] = useState([]),
    [selected, setSelected] = useState(0),
    [status, setStatus] = useState("未保存"),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(null),
    [search, setSearch] = useState(""),
    [deleted, setDeleted] = useState(false),
    [format, setFormat] = useState("png"),
    [background, setBackground] = useState("transparent"),
    [exportWidth, setExportWidth] = useState(1600),
    [conflict, setConflict] = useState(null);
  const [confirm, confirmationDialog] = useMathConfirm();
  const history = useDraftHistory();
  const ggbFlush = useRef(null);
  const assistantRequest = useRef(null);
  const takeAssistantRequest = useCallback(() => { const request = assistantRequest.current; assistantRequest.current = null; return request; }, []);
  const [editorSession, setEditorSession] = useState(0);
  const editorSessionRef = useRef(editorSession);
  editorSessionRef.current = editorSession;
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    const kind = draft?.source?.kind;
    if (kind === 'html' && !['html', 'source'].includes(format)) setFormat('html');
    else if (kind && !['html', 'dynamic'].includes(kind) && format === 'html') setFormat('png');
  }, [draft?.source?.kind, format]);
  const [viewScene, patchView] = useScene(account, 'math-view', { canvasTop: 0, canvasLeft: 0 });
  const home = !draft || viewScene.screen === 'home';
  useEffect(() => { if (home) assistantRequest.current = null; }, [home, account]);
  const canvasScroll = useScrollRestore(home ? viewScene.homeTop ?? 0 : viewScene.canvasTop,
    top => patchView(home ? { homeTop: top } : { canvasTop: top }), `${home}:${draft?.id}:${draft?.source.kind}:${Boolean(font)}`);
  useLayoutEffect(() => { if (canvasScroll.ref.current) canvasScroll.ref.current.scrollTop = home ? viewScene.homeTop ?? 0 : viewScene.canvasTop; }, [home]);
  useEffect(() => { if (canvasScroll.ref.current) canvasScroll.ref.current.scrollLeft = home ? 0 : viewScene.canvasLeft; }, [account, home, draft?.id, font]);
  const importFile = useRef(null);
  const sourceFile = useRef(null);
  const [importPending, setImportPending] = useState(null);
  const previousKind = useRef(null);
  useEffect(() => {
    const kind = draft?.source.kind;
    if (!kind || !previousKind.current || previousKind.current === kind) { previousKind.current = kind; return; }
    previousKind.current = kind;
    if (draft?.source.kind === "html" || draft?.source.kind === "dynamic")
      setFormat("html");
    else setFormat("png");
  }, [draft?.source.kind]);
  useEffect(() => {
    if (!account) return;
    let live = true;
    uploadDraft(account, "get").then(
      (value) => {
        if (live) setImportPending(value ?? null);
      },
      () => {
        if (live) setMessage(t("无法恢复待确认的文件上传，请检查设备存储"));
      },
    );
    return () => {
      live = false;
    };
  }, [account]);
  async function importHtml(file) {
    if (busy || pending || !account) return;
    let attempt;
    try { attempt = importPending && file ? await reselectDeviceFile(importPending, file)
      : file ? { file, key: crypto.randomUUID() } : importPending; }
    catch (error) { setMessage(error.message); return; }
    if (!attempt) return;
    if (attempt.requiresReselection) { importFile.current.click(); return; }
    if (
      file && !importPending &&
      hasContent(draft) &&
      status !== "已保存" &&
      !await confirm(t("导入会替换当前未保存内容，是否继续？"))
    )
      return;
    const epoch = generation.current;
    setBusy(true);
    setImportPending(attempt);
    try {
      await uploadDraft(account, "put", attempt);
      const stored = await client.upload(attempt.file, attempt.key);
      if (epoch !== generation.current) return;
      edit({
        title: attempt.file.name,
        source: { schemaVersion: 1, kind: "html", fileId: stored.id },
        originalFileId: stored.id,
      }, false);
      history.reset(null);
      patchView({ screen: 'editor', exportOpen: false });
      if (shell?.panelMode === 'math-tools') shell.closePanel();
      await uploadDraft(account, "delete");
      if (epoch === generation.current) setImportPending(null);
    } catch (error) {
      if (epoch === generation.current) handleError(error);
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function importSource(file) {
    if (inFlight.current || busy || !account || (pending && pending.kind !== 'import-source')) return;
    const epoch = generation.current;
    const operation = Symbol('import-source');
    inFlight.current = operation;
    setBusy(true); setMessage('');
    let request = pending;
    let submitted = !!pending;
    try {
      if (!request) {
        if (!file) return;
        if (file.size > 1024 * 1024) throw new Error(t("制作源超过 1 MiB，请选择工坊下载的 JSON 文件。"));
        let source;
        try { source = JSON.parse(await file.text()); } catch { throw new Error(t("文件不是有效的制作源 JSON，当前内容已保留。")); }
        if (!source || source.schemaVersion !== 1 || !['workshop', 'formula', 'plane', 'space', 'dynamic'].includes(source.kind))
          throw new Error(t("请选择工坊下载的可编辑源 JSON；HTML 演示请使用 HTML 导入入口。"));
        if (epoch !== generation.current) return;
        if (hasContent(draftRef.current) && status !== "已保存" && !await confirm(t("导入作品会替换当前未保存内容，是否继续？"))) return;
        request = { kind: 'import-source', path: base, method: 'POST', key: crypto.randomUUID(),
          input: { title: file.name.replace(/\.json$/i, '').slice(0, 200) || t("导入作品"), source, originalFileId: null } };
      }
      if (epoch !== generation.current) return;
      if (!writeLocal(account, 'math-workspace', { draft: draftRef.current, pending: request, status, selected, search, deleted, format, background, exportWidth }))
        throw new Error(t("设备存储空间不足，请先整理本地内容，再重试导入。"));
      setPending(request);
      // The existing creation endpoint validates the complete source before it
      // reaches an editor. An invalid import never replaces the current draft.
      submitted = true;
      const saved = await mathRequest(request.path, request);
      if (epoch !== generation.current) return;
      setPending(null); setDraft(saved); draftRef.current = saved;
      history.reset(saved); setSelected(0); setConflict(null); setStatus("已保存"); setDeleted(false);
      setMessage(t("制作源已导入为新作品，可以继续修改。"));
      patchView({ screen: 'editor', toolTab: 'objects', selectionKind: 'object', exportOpen: false, formulaMode: null, formulaBuilder: null });
      if (shell?.panelMode === 'math-tools') shell.closePanel();
      if (!deleted) await refresh();
    } catch (error) {
      if (epoch !== generation.current) return;
      if (!submitted || (error.status && error.status < 500)) setPending(null);
      handleError(error);
    } finally {
      if (inFlight.current === operation) { inFlight.current = null; setBusy(false); }
    }
  }
  async function downloadOriginal(id) {
    const epoch = generation.current;
    try {
      const blob = await client.blob(`/api/workbench/files/${id}/content`);
      if (epoch !== generation.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "original.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (epoch === generation.current) handleError(error);
    }
  }
  const inFlight = useRef(null);
  const liveSave = useRef({ pending, status });
  liveSave.current = { pending, status };
  const generation = useRef(0),
    draftRef = useRef(draft);
  draftRef.current = draft;
  const storage = account ? `teachbuddy.math.${account}` : null;
  async function identify() {
    const epoch = generation.current;
    try {
      const context = await mathRequest("/api/workbench/context");
      if (epoch !== generation.current) return;
      setAccount((old) => {
        if (old && old !== context.accountKey) {
          generation.current++;
          inFlight.current = null;
          setBusy(false);
          setDraft(null);
          history.reset(null);
          setHistoryOpen(false);
          setPending(null);
          setItems([]);
          setStatus("未保存");
          setMessage("");
          setLoadedStorage(null);
        }
        return context.accountKey;
      });
      setLocked(false);
    } catch {
      if (epoch !== generation.current) return;
      setLocked(true);
      generation.current++;
    }
  }
  useEffect(() => {
    const activeController = new AbortController();
    controller.current = activeController;
    identify();
    const onFocus = () => identify();
    window.addEventListener("focus", onFocus);
    return () => {
      generation.current++;
      inFlight.current = null;
      activeController.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  useEffect(() => {
    if (!storage) return;
    try {
      const saved = migrateLegacyLocal(account, "math-workspace", storage);
      if (saved) {
        setDraft(saved.draft);
        history.reset(saved.draft);
        setSelected(saved.selected ?? 0);
        setSearch(saved.search ?? "");
        setDeleted(saved.deleted ?? false);
        setPending(saved.pending);
        setFormat(saved.format ?? (['dynamic', 'html'].includes(saved.draft?.source.kind) ? 'html' : 'png'));
        setBackground(saved.background ?? 'transparent');
        setExportWidth(saved.exportWidth ?? 1600);

        setStatus(
          saved.pending &&
            (!saved.pending.kind || saved.pending.kind === "save")
            ? "保存结果待确认"
            : (saved.status ?? "未保存"),
        );
      }
    } catch {}
    setLoadedStorage(storage);
  }, [storage]);
  useEffect(() => {
    if (storage && loadedStorage === storage && !locked) {
      try {
        if (!writeLocal(account, 'math-workspace', { draft, pending, status, selected, search, deleted, format, background, exportWidth }))
          setMessage(t("本地内容无法保留，请先保存到服务端"));
      } catch {
        setMessage(t("本地内容空间不足，请保存到服务端"));
      }
    }
  }, [draft, pending, status, storage, loadedStorage, locked, selected, search, deleted, format, background, exportWidth]);
  const routeLoaded = useRef(null);
  useEffect(() => {
    if (
      !route?.workId ||
      !storage ||
      loadedStorage !== storage ||
      routeLoaded.current === route.workId
    )
      return;
    routeLoaded.current = route.workId;
    if (draft?.id !== route.workId) open({ id: route.workId });
    else patchView({ screen: 'editor' });
  }, [route?.workId, storage, loadedStorage]);
  async function refresh() {
    const epoch = generation.current;
    try {
      const result = await mathRequest(
        `${base}?q=${encodeURIComponent(search)}&state=${deleted ? "deleted" : "active"}`,
      );
      if (epoch === generation.current) setItems(result.items);
    } catch (e) {
      if (epoch === generation.current) handleError(e);
    }
  }
  useForegroundRefresh(async () => {
    if (!account || locked || inFlight.current) return;
    const started = draftRef.current;
    const epoch = generation.current;
    await refresh();
    if (!started?.id) return;
    const saved = await mathRequest(`${base}/${started.id}`);
    if (epoch !== generation.current || draftRef.current !== started || inFlight.current || liveSave.current.pending) return;
    if (saved.version === started.version) return;
    if (liveSave.current.status === "已保存") {
      if (['geogebra', 'workshop'].includes(saved.source.kind)) setEditorSession(value => value + 1);
      setDraft({ ...saved, ...(started.workshopInput ? { workshopInput: started.workshopInput } : {}) });
    }
    else { setConflict(saved); setMessage(t("服务器内容已变化，本地内容保留，请对照当前版本")); }
  });
  useEffect(() => {
    if (account) refresh();
  }, [search, deleted, account]);
  function handleError(e) {
    if (e.status === 401) {
      setLocked(true);
      generation.current++;
    }
    setMessage(
      e.status === 409
        ? t("版本冲突，本地内容已保留")
        : e.status === 503
          ? t("暂时无法保存或读取，请稍后确认")
          : e.problem?.field
            ? t("请检查 {{field}}", { field: e.problem.field })
            : e.message,
    );
  }
  function edit(next, track = true) {
    if (draftRef.current?.deletedAt && next?.id === draftRef.current.id) return;
    if (pending?.kind && pending.kind !== "save") {
      setMessage(t("请先确认当前操作结果"));
      return;
    }
    if (track && draftRef.current) history.record(draftRef.current, next);
    draftRef.current = next;
    writeLocal(account, 'math-workspace', { draft: next, pending, status: "未保存", selected, search, deleted, format, background, exportWidth });
    setDraft(next);
    setStatus("未保存");
    setMessage("");
  }
  function source(next) {
    edit({ ...draft, source: next });
  }
  async function newDraft(kind = 'workshop', request = null) {
    if (pending) {
      setMessage(t("请先确认上次保存结果"));
      return;
    }
    if (
      hasContent(draft) &&
      (status !== "已保存" || hasWorkshopInput(draft)) &&
      !await confirm(t("新建作品会替换当前未保存内容，是否继续？"))
    )
      return;
    assistantRequest.current = request ? { text: request } : null;
    history.reset(null);
    setEditorSession(value => value + 1);
    edit({
      title: kind === 'workshop' ? t('未命名数学作品') : `未命名${({ dynamic: "演示", html: "HTML", formula: "公式", plane: "平面图形", space: "空间图形", geogebra: "数学作品" })[kind]}`,
      source: kind === "workshop" ? createWorkshopSource() : kind === "geogebra" ? { schemaVersion: 1, kind, appName: "classic", base64: "" } : kind === "dynamic" ? emptyDynamicSource() : emptySource(kind),
      originalFileId: null,
      ...(kind === "geogebra" ? { ggbTouched: false } : {}),
    }, false);
    setSelected(0);
    setConflict(null);
    setFormat(kind === 'dynamic' ? 'html' : 'png');
    patchView({ screen: 'editor', toolTab: 'objects', selectionKind: 'object', exportOpen: false, formulaMode: 'guided', formulaBuilder: null, groups: {}, canvasTop: 0, canvasLeft: 0 });
    if (shell?.panelMode === 'math-tools') shell.closePanel();
  }
  async function open(item) {
    if (item.id === draftRef.current?.id && hasWorkshopInput(draftRef.current)) { patchView({ screen: 'editor' }); return; }
    if (pending) {
      setMessage(t("请先确认上次保存结果"));
      return;
    }
    if (
      (status !== "已保存" || hasWorkshopInput(draft)) &&
      hasContent(draft) &&
      !await confirm(t("打开作品会替换当前未保存内容，是否继续？"))
    )
      return;
    const epoch = generation.current;
    try {
      const saved = await mathRequest(`${base}/${item.id}`);
      if (epoch !== generation.current) return;
      setEditorSession(value => value + 1);
      setDraft(saved);
      draftRef.current = saved;
      history.reset(saved);
      setStatus("已保存");
      setSelected(0);
      setConflict(null);
      setMessage("");
      patchView({ screen: 'editor', toolTab: 'objects', selectionKind: 'object', exportOpen: false, formulaMode: null });
    } catch (e) {
      if (epoch === generation.current) handleError(e);
    }
  }
  async function save(copy = false) {
    if (inFlight.current) return;
    const currentWork = draftRef.current;
    if (!pending && currentWork?.source.kind === 'workshop' && !currentWork.source.formulas.length && !currentWork.source.graph) { if (hasWorkshopInput(currentWork)) setMessage(t('请先将输入加入作品，再保存。')); return; }
    if (!pending && ['geogebra', 'workshop'].includes(draftRef.current?.source.kind)) {
      try { await ggbFlush.current?.(); } catch (error) { handleError(error); return; }
      if (inFlight.current) return;
    }
    if (pending?.kind === 'import-source') return importSource();
    if (!pending && Object.keys(draft.parameterEdits ?? {}).length) {
      setMessage(t("请先应用参数设置，再保存作品"));
      return;
    }
    if (["deletion", "purge"].includes(pending?.kind)) return deletion();
    if (pending?.kind === "export") return exportFile();
    if (
      copy &&
      draft.source.kind === "html" &&
      (!draft.id || status !== "已保存")
    ) {
      setMessage(t("请先保存当前源码，再另存作品"));
      return;
    }
    const epoch = generation.current,
      started = draftRef.current;
    let preparedSource = started.source;
    if (
      !pending &&
      started.source.kind === "html" &&
      started.htmlText !== undefined
    ) {
      const uploadOperation = Symbol("html-upload");
      inFlight.current = uploadOperation;
      setBusy(true);
      try {
        const file = await client.upload(
          new File([started.htmlText], "edited.html", { type: "text/html" }),
          started.htmlUploadKey,
        );
        if (epoch !== generation.current) return;
        preparedSource = { ...started.source, fileId: file.id };
      } catch (error) {
        if (epoch === generation.current) handleError(error);
        return;
      } finally {
        if (inFlight.current === uploadOperation) {
          inFlight.current = null;
          setBusy(false);
        }
      }
    }
    const copyHtml = copy && started.source.kind === "html";
    const request =
      pending ??
      (copyHtml
        ? {
            kind: "save",
            path: `${base}/${started.id}/copy`,
            method: "POST",
            key: crypto.randomUUID(),
            input: { baseVersion: started.version, title: started.title },
          }
        : {
            kind: "save",
            path: started.id && !copy ? `${base}/${started.id}` : base,
            method: started.id && !copy ? "PUT" : "POST",
            key: crypto.randomUUID(),
            input:
              started.id && !copy
                ? {
                    baseVersion: started.version,
                    title: started.title,
                    source: preparedSource,
                  }
                : {
                    title: started.title,
                    source: preparedSource,
                    originalFileId: started.originalFileId,
                  },
          });
    if (started.htmlText !== undefined && !pending)
      request.htmlText = started.htmlText;
    const operation = Symbol("math-request");
    inFlight.current = operation;
    setBusy(true);
    writeLocal(account, 'math-workspace', { draft: draftRef.current, pending: request, status: "保存结果待确认", selected, search, deleted, format, background, exportWidth });
    setPending(request);
    setStatus("保存中");
    setMessage("");
    try {
      const saved = await mathRequest(request.path, request);
      if (epoch !== generation.current || inFlight.current !== operation)
        return;
      setPending(null);
      const unchanged = request.path.endsWith("/copy")
        ? draftRef.current === started
        : started.source.kind === "html" && request.htmlText !== undefined
          ? draftRef.current.htmlText === request.htmlText &&
            draftRef.current.title === request.input.title
          : JSON.stringify({
              title: draftRef.current.title,
              source: draftRef.current.source,
            }) ===
            JSON.stringify({
              title: request.input.title,
              source: request.input.source,
            });
      setDraft((current) =>
        unchanged && current === started
          ? { ...saved, ...(current.workshopInput ? { workshopInput: current.workshopInput } : {}) }
          : { ...current, id: saved.id, version: saved.version },
      );
      setStatus(
        unchanged ? "已保存" : "未保存",
      );
      setConflict(null);
      if (copy) history.reset(saved);
      await refresh();
      return true;
    } catch (e) {
      if (epoch !== generation.current || inFlight.current !== operation)
        return;
      const unknown = !e.status || e.status >= 500;
      setStatus(unknown ? "保存结果待确认" : "保存失败");
      if (!unknown) setPending(null);
      if (e.status === 409 && e.problem.currentVersion)
        setConflict(e.problem.currentVersion);
      handleError(e);
    } finally {
      if (inFlight.current === operation) {
        inFlight.current = null;
        setBusy(false);
      }
    }
  }
  async function exportFile(workshopOptions) {
    if (inFlight.current) return;
    if (pending && pending.kind !== "export") {
      setMessage(t("请先确认当前操作结果"));
      return;
    }
    if (!pending && (!draft?.id || status !== "已保存")) {
      setMessage(t("请先保存当前作品"));
      return;
    }
    const epoch = generation.current;
    const request = pending ?? {
      kind: "export",
      path: `${base}/${draft.id}/exports`,
      method: "POST",
      key: crypto.randomUUID(),
      input: {
        version: draft.version,
        ...(workshopOptions ?? {}),
        format: workshopOptions?.format ?? format,
        background: workshopOptions?.background ?? (["source", "html"].includes(format) || draft.source.kind === "formula" ? "transparent" : background),
        width: workshopOptions?.width ?? (["source", "html"].includes(format) ? 1600 : exportWidth),
      },
    };
    const operation = Symbol("math-request");
    inFlight.current = operation;
    setBusy(true);
    writeLocal(account, 'math-workspace', { draft: draftRef.current, pending: request, status: "保存结果待确认", selected, search, deleted, format, background, exportWidth });
    setPending(request);
    try {
      const result = await mathRequest(request.path, request);
      if (epoch !== generation.current || inFlight.current !== operation)
        return;
      const blob = await client.blob(
        `/api/workbench/files/${result.file.id}/content`,
      );
      if (epoch !== generation.current || inFlight.current !== operation)
        return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = result.file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPending(null);
      setStatus("已保存");
      setMessage("");
    } catch (e) {
      if (epoch !== generation.current || inFlight.current !== operation)
        return;
      if (e.status && e.status < 500 && e.status !== 401) setPending(null);
      handleError(e);
    } finally {
      if (inFlight.current === operation) {
        inFlight.current = null;
        setBusy(false);
      }
    }
  }
  async function deletion(permanent = false, target = draftRef.current) {
    if (inFlight.current) return;
    if (pending && !['deletion', 'purge'].includes(pending.kind)) {
      setMessage(t("请先确认当前操作结果"));
      return;
    }
    if (!pending && (!target?.id || (target.id === draftRef.current?.id && status !== "已保存"))) {
      setMessage(t("请先保存当前修改，再归档作品"));
      return;
    }
    if (!pending && permanent && !await confirm(
      t("彻底删除“{{title}}”？作品及历史版本将无法恢复。已下载文件仍保留。", { title: target.title }),
      { title: t("彻底删除作品"), confirmLabel: t("彻底删除") },
    )) return;
    const epoch = generation.current;
    const request = pending ?? {
      kind: permanent ? 'purge' : 'deletion',
      path: `${base}/${target.id}/${permanent ? 'purge' : 'deletion'}`,
      method: 'POST',
      key: crypto.randomUUID(),
      input: { baseVersion: target.version, ...(permanent ? {} : { deleted: !target.deletedAt }) },
    };
    const operation = Symbol('math-request');
    inFlight.current = operation;
    setBusy(true);
    setMessage('');
    writeLocal(account, 'math-workspace', { draft: draftRef.current, pending: request, status, selected, search, deleted, format, background, exportWidth });
    setPending(request);
    try {
      const saved = await mathRequest(request.path, request);
      if (epoch !== generation.current || inFlight.current !== operation) return;
      const removed = request.kind === 'purge' || request.input.deleted;
      const currentTarget = draftRef.current?.id === saved.id;
      const next = currentTarget ? removed ? null : saved : draftRef.current;
      draftRef.current = next;
      setDraft(next);
      setPending(null);
      setConflict(null);
      if (currentTarget) setStatus("已保存");
      writeLocal(account, 'math-workspace', { draft: next, pending: null, status: currentTarget ? "已保存" : status, selected, search, deleted, format, background, exportWidth });
      if (removed && currentTarget) goHome();
      if (request.kind === 'deletion' && request.input.deleted) setDeleted(false);
      setMessage(request.kind === 'purge' ? t("作品已彻底删除") : request.input.deleted ? t("作品已归档，可在“已归档”中恢复") : t("作品已恢复"));
      refresh();
    } catch (e) {
      if (epoch !== generation.current || inFlight.current !== operation) return;
      if (e.status && e.status < 500 && e.status !== 401) setPending(null);
      handleError(e);
    } finally {
      if (inFlight.current === operation) {
        inFlight.current = null;
        setBusy(false);
      }
    }
  }
  const readOnly =
    draft &&
    (draft.source.schemaVersion !== 1 ||
      !["formula", "plane", "space", "dynamic", "html", "geogebra", "workshop"].includes(
        draft.source.kind,
      ));
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
      setMessage(t("对象标识已存在，请使用不同标识"));
      return;
    }
    const replacement = objects.map((v, i) => i === selected ? next : v);
    const renamed = previous.id !== next.id ? { from: previous.id, to: next.id } : null;
    const references = replacement.map(e => renamed && e.construction ? {
      ...e, construction: { ...e.construction, refs: e.construction.refs.map(id => id === renamed.from ? renamed.to : id) },
    } : e);
    if (draft.source.scene && constructionIssue(references)) {
      setMessage(t("构造引用须有效且不能形成循环")); return;
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
  function showTools(tab) {
    patchView({ toolTab: tab });
    shell?.openPanel('math-tools');
  }
  function selectGraphic(value) {
    const [kind, index] = value.split(':');
    setSelected(Number(index));
    patchView({ selectionKind: kind });
    showTools('objects');
  }
  async function goHome() {
    if (hasWorkshopInput(draftRef.current)) {
      if (!await confirm(t('还有内容未加入作品，是否放弃这些输入并返回？'))) return;
      const next = { ...draftRef.current, workshopInput: { formula: '', expression: '' } };
      draftRef.current = next; setDraft(next);
      writeLocal(account, 'math-workspace', { draft: next, pending: liveSave.current.pending, status: liveSave.current.status, selected, search, deleted, format, background, exportWidth });
    }
    if (['geogebra', 'workshop'].includes(draftRef.current?.source.kind)) {
      try { await ggbFlush.current?.(); } catch (error) { handleError(error); return; }
    }
    if (draftRef.current?.source.kind === 'workshop' && (draftRef.current.source.formulas.length || draftRef.current.source.graph) && liveSave.current.status !== '已保存') { if (!await save()) return; }
    if (!hasContent(draftRef.current) && !pending && !busy) { setDraft(null); draftRef.current = null; }
    patchView({ screen: 'home', exportOpen: false });
    if (route?.workId) shell?.navigate('/math');
    setMessage('');
    if (shell?.panelMode === 'math-tools') shell.closePanel();
    requestAnimationFrame(() => document.getElementById('math-start-heading')?.focus({ preventScroll: true }));
  }
  async function discard() {
    if (pending || busy) { setMessage(t("请先确认当前操作结果")); return; }
    if (!await confirm(t("丢弃本设备的未保存修改？已保存的作品仍会保留。"))) return;
    setDraft(null); draftRef.current = null; setMessage(''); setConflict(null);
  }
  function resume() { patchView({ screen: 'editor' }); }
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
  const canChangeHistory = !home && !busy && !pending && !locked && !readOnly && !draft?.deletedAt;
  function moveHistory(direction) {
    if (!canChangeHistory || (direction === 'undo' ? !history.canUndo : !history.canRedo)) return;
    edit(history.move(direction, draftRef.current), false);
    setSelected(0); patchView({ selectionKind: 'object' });
  }
  useEffect(() => {
    if (!canChangeHistory || ['geogebra', 'workshop'].includes(draft?.source.kind)) return;
    const keydown = event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing || event.defaultPrevented) return;
      if (!event.target.closest?.('.math-workbench, .math-tools-panel') || event.target.closest('input, textarea, select, math-field, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      if ([...document.querySelectorAll('[role="dialog"]')].some(node => !node.closest('[inert]'))) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault(); moveHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [canChangeHistory, history.canUndo, history.canRedo, draft]);
  async function restoreVersion(version) {
    if (!canChangeHistory) return;
    if (status !== "已保存" && !await confirm(t("恢复历史版本会替换当前未保存修改，是否继续？"))) return;
    edit({ ...draftRef.current, title: version.title, source: version.source, htmlText: undefined, htmlUploadKey: undefined, parameterEdits: {} });
    setEditorSession(value => value + 1);
    setHistoryOpen(false); setSelected(0);
    patchView({ formulaMode: null, formulaBuilder: null, selectionKind: 'object' });
    setMessage(t("已恢复版本 {{version}}，保存后生成新版本。", { version: version.version }));
  }
  async function makeDynamicCopy() {
    if (!canChangeHistory || draft.source.kind !== 'plane') return;
    if (status !== "已保存") { setMessage(t("请先保存平面图形，再制作动态副本。")); return; }
    const suffix = ' · 动态演示';
    const next = { title: `${draft.title.slice(0, 200 - suffix.length)}${suffix}`, originalFileId: null,
      source: { ...emptyDynamicSource(), scene: structuredClone(draft.source.scene) } };
    history.reset(null); edit(next, false);
    if (route?.workId) shell?.navigate('/math');
    setFormat('html'); setSelected(0); setConflict(null);
    patchView({ selectionKind: 'object', exportOpen: false }); showTools('parameters');
    setMessage(t("已保留原图。设置参数，并在图形表达式中使用参数名；保存后建立独立的动态作品。"));
  }
  function expandTool(key, open) {
    patchView(current => ({ groups: { ...current.groups, [key]: open } }));
  }
  if (locked)
    return (
      <main className="math-lock">
        <h1>{t("请重新验证身份")}</h1>
        <p>{t("原账户内容已保留")}</p>
        <button onClick={identify}>{t("重新验证")}</button>
      </main>
    );
  const serverVersion = typeof conflict === 'object' ? conflict?.version : conflict;
  const conflictNotice = conflict && draft ? <div className="math-message" role="alert">
    {t('服务器版本')} {serverVersion}{t('，本地版本')} {draft.version}
    <button disabled={busy || !!pending} onClick={() => { edit({ ...draftRef.current, version: serverVersion }, false); setConflict(null); setMessage(t('请核对本地修改后保存')); }}>{t('以服务器版本为基线保留本地内容')}</button>
    <button disabled={busy || !!pending} onClick={() => save(true)}>{t('另存作品')}</button>
    <button disabled={busy || !!pending} onClick={() => open({ id: draftRef.current.id })}>{t('读取服务器作品')}</button>
  </div> : null;
  if (home) return <div className="math-workbench wb-module mw-home-wrapper">{confirmationDialog}
    <input ref={importFile} type="file" accept=".html,.htm,text/html" hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void importHtml(file); }}/>
    <input ref={sourceFile} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void importSource(file); }}/>
    {message && <div className="mw-notice" role="alert">{message}{pending && <button disabled={busy} onClick={() => save()}>{t('确认操作结果')}</button>}</div>}
    <WorkspaceHome accountKey={account} client={client} items={items} search={search} deleted={deleted} busy={busy || !!pending} onSearch={setSearch} onDeleted={setDeleted} onNew={request => newDraft('workshop', typeof request === 'string' ? request : null)} onOpen={open} onImport={() => importFile.current.click()} onImportSource={() => sourceFile.current.click()} onRestore={item => deletion(false, item)} onPurge={item => deletion(true, item)}/>
  </div>;
  if (!home && draft?.source.kind === 'workshop') return <WorkshopWorkspace takeAssistantRequest={takeAssistantRequest} key={editorSession} draft={draft} accountKey={account} busy={busy} pending={pending} status={status} message={message} conflictNotice={conflictNotice} flushRef={ggbFlush} client={shell ? client : null}
    onChangeSource={next => { const current = draftRef.current; if (editorSessionRef.current !== editorSession || current?.source.kind !== 'workshop') return; if (JSON.stringify(current.source) !== JSON.stringify(next)) edit({ ...current, source: next }, false); }}
    onChangeInput={workshopInput => { const current = draftRef.current; if (editorSessionRef.current !== editorSession || current?.source.kind !== 'workshop') return; const next = { ...current, workshopInput }; draftRef.current = next; setDraft(next); writeLocal(account, 'math-workspace', { draft: next, pending: liveSave.current.pending, status: liveSave.current.status, selected, search, deleted, format, background, exportWidth }); }}
    onTitle={title => edit({ ...draftRef.current, title }, false)} onHome={goHome} onSave={() => save()} onError={handleError} onHistory={() => setHistoryOpen(true)} onCopy={() => save(true)} onArchive={() => deletion(false)} onDownload={exportFile}>
    <ModulePresence present={historyOpen}>{historyOpen && <WorkHistory work={draft} client={client} font={font} hasChanges={status !== '已保存'} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion}/>}</ModulePresence>{confirmationDialog}
  </WorkshopWorkspace>;
  if (!home && !readOnly && draft?.source.kind === 'geogebra') return <GgbWorkspace key={editorSession} draft={draft} accountKey={account} busy={busy} pending={pending} status={status} message={message} conflictNotice={conflictNotice} flushRef={ggbFlush}
    onChangeSource={(next, touched) => { const current = draftRef.current; if (editorSessionRef.current !== editorSession || current?.source.kind !== 'geogebra') return; if (current.source.base64 !== next.base64 || (!current.id && touched && !current.ggbTouched)) edit({ ...current, source: next, ggbTouched: current.ggbTouched || touched }, false); }}
    onUnchanged={(previous, previousStatus) => { if (editorSessionRef.current === editorSession && previousStatus === '已保存' && draftRef.current === previous && !inFlight.current && !pending) setStatus('已保存'); }}
    onDirty={() => setStatus('未保存')} onTitle={title => edit({ ...draftRef.current, title }, false)} onHome={goHome} onSave={() => save()} onError={handleError}
    onHistory={() => setHistoryOpen(true)} onRestore={() => deletion(false)}>
    <ModulePresence present={historyOpen}>{historyOpen && <WorkHistory work={draft} client={client} font={font} hasChanges={status !== '已保存'} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion}/>}</ModulePresence>
    {confirmationDialog}
  </GgbWorkspace>;
  return (
    <div className="math-workbench wb-module">
      <ModulePresence present={historyOpen}>{historyOpen && <WorkHistory work={draft} client={client} font={font} hasChanges={status !== "已保存"} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion}/>}</ModulePresence>
      {confirmationDialog}
      <section className="math-main">
        <header className="math-workspace-header">
          <div className="math-workspace-identity"><span className="math-module-icon"><Icon name="math" size={25}/></span><h1 className="math-heading">{t("数学工坊")}</h1></div>
          {!home && <WorkspaceToolbar draft={draft} busy={busy} readOnly={readOnly} pending={pending} empty={!hasContent(draft)}
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
            <button onClick={() => setFontAttempt((value) => value + 1)}>
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
            <button className="math-primary" disabled={busy || (!pending && (!draft.id || status !== "已保存"))} onClick={exportFile}>
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
          {home ? <WorkspaceHome draft={hasContent(draft) ? draft : null} status={status} items={items} search={search} deleted={deleted} busy={busy || !!pending} onRestore={item => deletion(false, item)} onPurge={item => deletion(true, item)}
            onSearch={setSearch} onDeleted={setDeleted} onNew={newDraft} onOpen={item => draft?.id === item.id ? resume() : open(item)} onResume={resume} onDiscard={discard} onImport={() => importFile.current.click()} onImportSource={() => sourceFile.current.click()}/>
          : draft.deletedAt ? <div className="math-archived-preview">
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
