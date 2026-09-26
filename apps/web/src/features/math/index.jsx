import { useMathConfirm } from "./useMathConfirm.jsx";
import { useScene } from '../workbench/useScene.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { readLocal, writeLocal, migrateLegacyLocal } from '../workbench/storage.js';
import { ShellContext } from "../workbench/shellContext.js";
import { MathTools, MathIntegration, MathUsageDetails } from "./Integration.jsx";
import { uploadDraft } from "./uploadDraft.js";
import { reselectDeviceFile } from '../workbench/deviceRequestStore.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import DynamicPreview from "./DynamicPreview.jsx";
import GraphTools from "./GraphTools.jsx";
import WorkspaceHome, { WorkIllustration } from "./WorkspaceHome.jsx";
import GraphicPreview from "./GraphicPreview.jsx";
import FormulaEditor from "./FormulaEditor.jsx";
import FormulaPreview from "./FormulaPreview.jsx";
import { Icon } from "../workbench/icons.jsx";
import { Popover, MenuItem } from "../workbench/ModuleOverlays.jsx";
import HtmlEditor from "./HtmlEditor.jsx";
import { dynamicSource, emptyDynamicSource } from "./model.js";
import { updateObjects } from "./editing.js";
import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useContext } from "react";
import { projectSpace } from "../../../../../packages/shared/src/math/graphics.js";
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
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { WorkspaceToolbar } from './WorkspaceControls.jsx';
const base = "/api/modules/math/v1/works";
const names = {
  dynamic: "演示",
  html: "HTML",
  name: "参数名",
  initial: "初值",
  step: "步长",
  formula: "公式",
  plane: "平面图形",
  space: "空间图形",
  function: "函数",
  point: "点",
  line: "线段",
  ellipse: "圆 / 椭圆",
  polyline: "多边形",
  text: "文字",
  id: "名称",
  x: "x",
  y: "y",
  z: "z",
  expression: "表达式",
  min: "最小值",
  max: "最大值",
  text: "文字",
  dx: "水平偏移",
  dy: "垂直偏移",
  stroke: "颜色",
  fill: "填充",
  width: "宽度",
  dash: "线型",
  fontSize: "字号",
  closed: "闭合",
  arrow: "箭头",
  from: "起点",
  to: "终点",
  rx: "水平半径",
  ry: "垂直半径",
  xMin: "x 最小",
  xMax: "x 最大",
  yMin: "y 最小",
  yMax: "y 最大",
  height: "高度",
  axes: "坐标轴",
  grid: "网格",
  at: "坐标",
  center: "中心",
  domain: "定义域",
  label: "标签",
  style: "样式",
  points: "顶点",
  azimuth: "方位角",
  elevation: "仰角",
};
function hasContent(draft) {
  if (!draft) return false;
  if (draft.id || draft.source.kind === 'html' || Object.keys(draft.parameterEdits ?? {}).length) return true;
  const kind = draft.source.kind;
  const empty = kind === 'dynamic' ? emptyDynamicSource() : emptySource(kind);
  return draft.title !== `未命名${names[kind]}` || JSON.stringify(draft.source) !== JSON.stringify(empty);
}
function fitSpace(source) {
  const points = source.points.map(p => projectSpace(p, source.azimuth, source.elevation));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return { ...source, viewport: { ...source.viewport, xMin: Math.min(...xs) - 1, xMax: Math.max(...xs) + 1, yMin: Math.min(...ys) - 1, yMax: Math.max(...ys) + 1 } };
}
function Fields({ value, onChange, prefix = "" }) {
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
                          移除顶点 {i + 1}
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
                      添加顶点
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
                          solid: "实线",
                          dashed: "虚线",
                          dotted: "点线",
                          none: "无",
                          end: "终点",
                          both: "两端",
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
        if (live) setFontError("本地字体加载失败，预览暂不可用。");
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
  useEffect(() => {
    const kind = draft?.source?.kind;
    if (kind === 'html' && !['html', 'source'].includes(format)) setFormat('html');
    else if (kind && !['html', 'dynamic'].includes(kind) && format === 'html') setFormat('png');
  }, [draft?.source?.kind, format]);
  const [viewScene, patchView] = useScene(account, 'math-view', { canvasTop: 0, canvasLeft: 0 });
  const home = !draft || viewScene.screen === 'home';
  const canvasScroll = useScrollRestore(home ? viewScene.homeTop ?? 0 : viewScene.canvasTop,
    top => patchView(home ? { homeTop: top } : { canvasTop: top }), `${home}:${draft?.id}:${draft?.source.kind}:${Boolean(font)}`);
  useLayoutEffect(() => { if (canvasScroll.ref.current) canvasScroll.ref.current.scrollTop = home ? viewScene.homeTop ?? 0 : viewScene.canvasTop; }, [home]);
  useEffect(() => { if (canvasScroll.ref.current) canvasScroll.ref.current.scrollLeft = home ? 0 : viewScene.canvasLeft; }, [account, home, draft?.id, font]);
  const importFile = useRef(null);
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
        if (live) setMessage("无法恢复待确认的文件上传，请检查设备存储");
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
      !await confirm("导入会替换当前未保存稿，是否继续？")
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
      });
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
          setMessage('设备草稿无法保留，请先保存到服务端');
      } catch {
        setMessage("设备草稿空间不足，请保存到服务端");
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
    if (liveSave.current.status === '已保存') setDraft(saved);
    else { setConflict(saved); setMessage('服务器内容已变化，本地稿保留，请对照当前版本'); }
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
        ? "版本冲突，本地稿已保留"
        : e.status === 503
          ? "暂时无法保存或读取，请稍后确认"
          : e.problem?.field
            ? `请检查 ${e.problem.field}`
            : e.message,
    );
  }
  function edit(next) {
    if (draftRef.current?.deletedAt && next?.id === draftRef.current.id) return;
    if (pending?.kind && pending.kind !== "save") {
      setMessage("请先确认当前操作结果");
      return;
    }
    draftRef.current = next;
    writeLocal(account, 'math-workspace', { draft: next, pending, status: '未保存', selected, search, deleted, format, background, exportWidth });
    setDraft(next);
    setStatus("未保存");
    setMessage("");
  }
  function source(next) {
    edit({ ...draft, source: next });
  }
  async function newDraft(kind) {
    if (pending) {
      setMessage("请先确认上次保存结果");
      return;
    }
    if (
      hasContent(draft) &&
      status !== "已保存" &&
      !await confirm("新建作品会替换当前未保存稿，是否继续？")
    )
      return;
    edit({
      title: `未命名${names[kind]}`,
      source: kind === "dynamic" ? emptyDynamicSource() : emptySource(kind),
      originalFileId: null,
    });
    setSelected(0);
    setConflict(null);
    setFormat(kind === 'dynamic' ? 'html' : 'png');
    patchView({ screen: 'editor', toolTab: 'objects', selectionKind: 'object', exportOpen: false, formulaMode: 'guided', formulaBuilder: null, groups: {}, canvasTop: 0, canvasLeft: 0 });
    if (shell?.panelMode === 'math-tools') shell.closePanel();
  }
  async function open(item) {
    if (pending) {
      setMessage("请先确认上次保存结果");
      return;
    }
    if (
      status !== "已保存" &&
      hasContent(draft) &&
      !await confirm("打开作品会替换当前未保存稿，是否继续？")
    )
      return;
    const epoch = generation.current;
    try {
      const saved = await mathRequest(`${base}/${item.id}`);
      if (epoch !== generation.current) return;
      setDraft(saved);
      setStatus("已保存");
      setSelected(0);
      setConflict(null);
      setMessage("");
      patchView({ screen: 'editor', toolTab: 'objects', selectionKind: 'object', exportOpen: false, formulaMode: null, usageOpen: false });
    } catch (e) {
      if (epoch === generation.current) handleError(e);
    }
  }
  async function save(copy = false) {
    if (inFlight.current) return;
    if (!pending && Object.keys(draft.parameterEdits ?? {}).length) {
      setMessage("请先应用参数设置，再保存作品");
      return;
    }
    if (["deletion", "purge"].includes(pending?.kind)) return deletion();
    if (pending?.kind === "export") return exportFile();
    if (
      copy &&
      draft.source.kind === "html" &&
      (!draft.id || status !== "已保存")
    ) {
      setMessage("请先保存当前源码，再另存作品");
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
    writeLocal(account, 'math-workspace', { draft: draftRef.current, pending: request, status: '保存结果待确认', selected, search, deleted, format, background, exportWidth });
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
          ? saved
          : { ...current, id: saved.id, version: saved.version },
      );
      setStatus(
        unchanged && draftRef.current === started ? "已保存" : "未保存",
      );
      setConflict(null);
      await refresh();
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
  async function exportFile() {
    if (inFlight.current) return;
    if (pending && pending.kind !== "export") {
      setMessage("请先确认当前操作结果");
      return;
    }
    if (!pending && (!draft?.id || status !== "已保存")) {
      setMessage("请先保存当前作品");
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
        format,
        background:
          ["source", "html"].includes(format) || draft.source.kind === "formula"
            ? "transparent"
            : background,
        width: ["source", "html"].includes(format) ? 1600 : exportWidth,
      },
    };
    const operation = Symbol("math-request");
    inFlight.current = operation;
    setBusy(true);
    writeLocal(account, 'math-workspace', { draft: draftRef.current, pending: request, status: '保存结果待确认', selected, search, deleted, format, background, exportWidth });
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
      setMessage('请先确认当前操作结果');
      return;
    }
    if (!pending && (!target?.id || (target.id === draftRef.current?.id && status !== '已保存'))) {
      setMessage('请先保存当前修改，再归档作品');
      return;
    }
    if (!pending && permanent && !await confirm(
      `彻底删除“${target.title}”？作品及历史版本将无法恢复。已有备课中采用的内容和已下载文件仍保留。`,
      { title: '彻底删除作品', confirmLabel: '彻底删除' },
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
      if (currentTarget) setStatus('已保存');
      writeLocal(account, 'math-workspace', { draft: next, pending: null, status: currentTarget ? '已保存' : status, selected, search, deleted, format, background, exportWidth });
      if (removed && currentTarget) goHome();
      if (request.kind === 'deletion' && request.input.deleted) setDeleted(false);
      setMessage(request.kind === 'purge' ? '作品已彻底删除' : request.input.deleted ? '作品已归档，可在“已归档”中恢复' : '作品已恢复');
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
      !["formula", "plane", "space", "dynamic", "html"].includes(
        draft.source.kind,
      ));
  const objects =
    ["plane", "dynamic"].includes(draft?.source.kind) && !readOnly
      ? draft.source.scene.elements
      : (draft?.source.points ?? []);
  function replaceObject(next) {
    const previous = objects[selected];
    if (
      objects.some(
        (object, index) => index !== selected && object.id === next.id,
      )
    ) {
      setMessage("对象标识已存在，请使用不同标识");
      return;
    }
    source(
      updateObjects(
        draft.source,
        objects.map((v, i) => (i === selected ? next : v)),
        previous.id !== next.id ? { from: previous.id, to: next.id } : null,
      ),
    );
  }

  function add(type) {
    let index = 1;
    const prefix = {
      function: "f",
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
  const toolTab = ['objects', 'parameters', 'steps', 'canvas'].includes(viewScene.toolTab) ? viewScene.toolTab : 'objects';
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
  function goHome() {
    if (!hasContent(draft) && !pending && !busy) { setDraft(null); draftRef.current = null; }
    patchView({ screen: 'home', exportOpen: false, usageOpen: false });
    if (route?.workId) shell?.navigate('/math');
    setMessage('');
    if (shell?.panelMode === 'math-tools') shell.closePanel();
    requestAnimationFrame(() => document.getElementById('math-start-heading')?.focus({ preventScroll: true }));
  }
  async function discard() {
    if (pending || busy) { setMessage('请先确认当前操作结果'); return; }
    if (!await confirm('丢弃本设备的未保存修改？已保存的作品仍会保留。')) return;
    setDraft(null); draftRef.current = null; setMessage(''); setConflict(null);
  }
  function resume() { patchView({ screen: 'editor' }); }
  async function useTemplate() {
    const kind = draft.source.kind;
    const empty = kind === 'dynamic' ? emptyDynamicSource() : emptySource(kind);
    if (JSON.stringify(draft.source) !== JSON.stringify(empty) && !await confirm('使用示例会替换当前图形及设置，是否继续？')) return;
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
    } else {
      source({ ...draft.source, edges: [...draft.source.edges, { id: `E${Date.now()}`, from: objects[0].id, to: objects[1].id, style: defaultStyle() }] });
      setSelected(draft.source.edges.length); patchView({ selectionKind: 'edge' });
    }
    showTools('objects');
  }
  function removeGraphic() {
    if (viewScene.selectionKind === 'edge') source({ ...draft.source, edges: draft.source.edges.filter((_, i) => i !== selected) });
    else source(updateObjects(draft.source, objects.filter((_, i) => i !== selected)));
    setSelected(0); patchView({ selectionKind: 'object' });
  }
  function expandTool(key, open) {
    patchView(current => ({ groups: { ...current.groups, [key]: open } }));
  }
  if (locked)
    return (
      <main className="math-lock">
        <h1>请重新验证身份</h1>
        <p>原账户草稿已保留</p>
        <button onClick={identify}>重新验证</button>
      </main>
    );
  return (
    <div className="math-workbench wb-module">
      {confirmationDialog}
      <section className="math-main">
        <header className="math-workspace-header">
          <div className="math-workspace-identity"><span className="math-module-icon"><Icon name="math" size={25}/></span><h1 className="math-heading">数学工坊</h1></div>
          {!home && <WorkspaceToolbar draft={draft} busy={busy} readOnly={readOnly} pending={pending} empty={!hasContent(draft)}
            exportOpen={!!viewScene.exportOpen} onHome={goHome} onSave={() => save()} onCopy={() => save(true)}
            onDelete={() => deletion()} onPurge={() => deletion(true)} onExport={() => patchView({ exportOpen: !viewScene.exportOpen })} onUsage={() => patchView({ usageOpen: !viewScene.usageOpen })}/>}
          <input ref={importFile} type="file" accept=".html,.htm" aria-label="导入 HTML 文件" hidden onChange={e => { importHtml(e.target.files[0]); e.target.value = ''; }}/>
          {importPending && <button disabled={busy} onClick={() => importHtml()}>{importPending.requiresReselection ? '重选原文件并确认上传' : '重试原文件上传'}</button>}
        </header>
        {!home && <div className="math-document-bar">
          <button className="math-return" onClick={goHome}><Icon name="back"/><span>返回工坊</span></button>
          <input aria-label="作品名称" readOnly={!!draft.deletedAt} value={draft.title} onChange={e => edit({ ...draft, title: e.target.value })}/>
          <span className="math-workspace-status" role="status">{draft.deletedAt ? '已归档' : status}</span>
        </div>}
        {shell && (
          <MathIntegration
            work={home ? null : draft}
            saved={status === "已保存" && !pending}
            busy={busy}
            client={client}
            onError={handleError}
          />
        )}
        {fontError && (
          <div role="alert" className="math-message">
            {fontError}
            <button onClick={() => setFontAttempt((value) => value + 1)}>
              重试字体
            </button>
          </div>
        )}
        {pending && home && <div className="math-message" role="status">上次操作结果待确认。<button disabled={busy} onClick={() => save()}>确认操作结果</button></div>}
        {!home && draft.deletedAt && <div className="math-archive-notice">已归档，恢复后可继续编辑。</div>}
        {message && (
          <div role="alert" className="math-message">
            {message}
          </div>
        )}
        {conflict && (
          <div className="math-message">
            服务器版本 {conflict}，本地版本 {draft.version}
            <button
              onClick={() => {
                setDraft({ ...draft, version: conflict });
                setConflict(null);
                setMessage("请核对本地修改后保存");
              }}
            >
              以服务器版本为基线保留本地稿
            </button>
          </div>
        )}
        {!home && draft && <ModulePresence present={!!viewScene.exportOpen} mode="collapse">
          <section id="math-export-options" className="math-export-options" aria-label="导出作品">
            <label>文件格式<select
              aria-label="导出格式"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {draft.source.kind !== "html" && (
                <>
                  <option value="png">图片 · PNG</option>
                  <option value="svg">矢量图片 · SVG</option>
                </>
              )}
              {["dynamic", "html"].includes(draft.source.kind) && (
                <option value="html">离线演示 · HTML</option>
              )}
              <option value="source">
                {draft.source.kind === "html" ? "当前源码 HTML" : "制作源 JSON"}
              </option>
            </select></label>
            {!["source", "html"].includes(format) && (
              <>
                <label>背景<select
                  aria-label="导出背景"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                >
                  <option value="transparent">透明</option>
                  {draft.source.kind !== "formula" && (
                    <option value="white">白底</option>
                  )}
                </select></label>
                <label>宽度（像素）<input
                  aria-label="导出宽度"
                  type="number"
                  value={exportWidth}
                  min="200"
                  max="4800"
                  onChange={(e) => setExportWidth(Number(e.target.value))}
                /></label>
              </>
            )}
            <button className="math-primary" disabled={busy || (!pending && (!draft.id || status !== "已保存"))} onClick={exportFile}>
              下载作品
            </button>
            {(!draft.id || status !== '已保存') && !pending && <span className="math-hint">保存作品后即可下载</span>}
          </section>
        </ModulePresence>}
        {!home && !draft.deletedAt && graphical && <div className="math-editing-toolbar" aria-label="制作操作">
          <Popover label="添加图形" icon={null} align="start" buttonClassName="math-action-button">{({ close }) => <>
            {(draft.source.kind === 'space' ? ['point', 'edge'] : ['function', 'point', 'line', 'ellipse', 'polyline', 'text']).map(type => <MenuItem key={type} disabled={type === 'edge' && objects.length < 2} onClick={() => { close(); addGraphic(type); }}>添加{type === 'edge' ? '棱' : names[type]}</MenuItem>)}
            {draft.source.kind === 'space' && <MenuItem onClick={async () => { close(); if (objects.length && !await confirm('使用棱锥会替换当前图形，是否继续？')) return; source(fitSpace(pyramidSource())); selectGraphic('object:0'); }}>棱锥示例</MenuItem>}
          </>}</Popover>
          <button onClick={() => showTools('objects')}>图形与标注</button>
          {draft.source.kind === 'dynamic' && <><button onClick={() => showTools('parameters')}>设置滑杆</button><button onClick={() => showTools('steps')}>编排步骤</button></>}
          <button className="math-icon-button math-canvas-settings" title="画布设置" aria-label="画布设置" onClick={() => showTools('canvas')}>
            <svg className="wb-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M3 5h3m4 0h7M3 10h8m4 0h2M3 15h3m4 0h7"/><circle cx="8" cy="5" r="2"/><circle cx="13" cy="10" r="2"/><circle cx="8" cy="15" r="2"/>
            </svg>
          </button>
        </div>}
        {!home && shell && draft?.id && <ModulePresence present={!!viewScene.usageOpen} mode="collapse"><MathUsageDetails work={draft}/></ModulePresence>}
        <div className={`math-canvas${home ? ' is-home' : ''}`} ref={canvasScroll.ref} onScroll={event => { canvasScroll.onScroll(event); if (!home) patchView({ canvasLeft: event.currentTarget.scrollLeft }); }}>
          {home ? <WorkspaceHome draft={hasContent(draft) ? draft : null} status={status} items={items} search={search} deleted={deleted} busy={busy || !!pending} onRestore={item => deletion(false, item)} onPurge={item => deletion(true, item)}
            onSearch={setSearch} onDeleted={setDeleted} onNew={newDraft} onOpen={item => draft?.id === item.id ? resume() : open(item)} onResume={resume} onDiscard={discard} onImport={() => importFile.current.click()}/>
          : draft.deletedAt ? <div className="math-archived-preview">
            {draft.source.kind === 'formula' ? <FormulaPreview source={draft.source} retry={fontAttempt}/>
              : ['plane', 'space', 'dynamic'].includes(draft.source.kind) ? <GraphicPreview source={draft.source} font={font}/>
              : <p>HTML 演示已归档，可下载查看或恢复后运行。</p>}
          </div> : readOnly ? (
            <div className="math-formula">
              <p>作品格式需要更新，请升级后编辑。</p>
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
              <h2>{draft.source.kind === 'space' ? '从一个立体图形开始' : draft.source.kind === 'dynamic' ? '让图形动起来' : '画出第一个图形'}</h2>
              <p>{draft.source.kind === 'space' ? '选择示例后，可以改顶点、添加棱和调整观察角度。' : draft.source.kind === 'dynamic' ? '先试着拖动参数，再调整图形和讲解步骤。' : '输入函数表达式，或添加点、线段和标注。'}</p>
              <div><button className="math-primary" onClick={useTemplate}>{draft.source.kind === 'space' ? '正方体示例' : draft.source.kind === 'dynamic' ? '试试二次函数演示' : '从 y = x² 开始'}</button>
              <button onClick={() => addGraphic(draft.source.kind === 'space' ? 'point' : 'function')}>{draft.source.kind === 'space' ? '添加空间点' : '添加函数'}</button></div>
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
              savedInvalid={draft.render?.state === 'invalid' && status === '已保存'}/>
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
