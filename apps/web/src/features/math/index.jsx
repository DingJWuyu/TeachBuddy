import { ShellContext } from "../workbench/shellContext.js";
import { MathTools, MathIntegration } from "./Integration.jsx";
import { uploadDraft } from "./uploadDraft.js";
import DynamicPreview from "./DynamicPreview.jsx";
import DynamicTools from "./DynamicTools.jsx";
import HtmlEditor from "./HtmlEditor.jsx";
import { dynamicSource } from "./model.js";
import React, { useEffect, useMemo, useState, useRef, useContext } from "react";
import { renderGraphic } from "../../../../../packages/shared/src/math/graphics.js";
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
import { mathFontStyle } from "../../../../../packages/shared/src/math/formula.js";
import FormulaPreview from "./FormulaPreview.jsx";
import "./math.css";
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
  id: "标识",
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
function Fields({ value, onChange, prefix = "" }) {
  return (
    <div className="math-fields">
      {Object.entries(value)
        .filter(([key]) => !["type", "schemaVersion", "kind"].includes(key))
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
                    <option key={v}>{v}</option>
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
  return <MathSession key={account.accountKey} transport={request} route={route} />;
}
function MathSession({ transport, route }) {
  const shell = useContext(ShellContext);
  const Tools = shell ? MathTools : "aside";
  const [font, setFont] = useState(null);
  const [fontError, setFontError] = useState("");
  const [fontAttempt, setFontAttempt] = useState(0);
  const latexInput = useRef(null);
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
  const importFile = useRef(null);
  const [importPending, setImportPending] = useState(null);
  useEffect(() => {
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
    const attempt = file ? { file, key: crypto.randomUUID() } : importPending;
    if (!attempt) return;
    if (
      file &&
      draft &&
      status !== "已保存" &&
      !window.confirm("导入会替换当前未保存稿，是否继续？")
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
      const saved = JSON.parse(localStorage.getItem(storage));
      if (saved) {
        setDraft(saved.draft);
        setSelected(saved.selected ?? 0);
        setSearch(saved.search ?? "");
        setDeleted(saved.deleted ?? false);
        setPending(saved.pending);
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
        localStorage.setItem(
          storage,
          JSON.stringify({ draft, pending, status, selected, search, deleted }),
        );
      } catch {
        setMessage("设备草稿空间不足，请保存到服务端");
      }
    }
  }, [draft, pending, status, storage, loadedStorage, locked, selected, search, deleted]);
  const routeLoaded = useRef(null);
  useEffect(() => {
    if (!route?.workId || !storage || loadedStorage !== storage || routeLoaded.current === route.workId) return;
    routeLoaded.current = route.workId;
    if (draft?.id !== route.workId) open({id:route.workId});
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
    if (pending?.kind && pending.kind !== "save") {
      setMessage("请先确认当前操作结果");
      return;
    }
    setDraft(next);
    setStatus("未保存");
    setMessage("");
  }
  function source(next) {
    edit({ ...draft, source: next });
  }
  function newDraft(kind) {
    if (pending) {
      setMessage("请先确认上次保存结果");
      return;
    }
    if (
      draft &&
      status !== "已保存" &&
      !window.confirm("新建作品会替换当前未保存稿，是否继续？")
    )
      return;
    edit({
      title: `未命名${names[kind]}`,
      source: kind === "dynamic" ? dynamicSource() : emptySource(kind),
      originalFileId: null,
    });
    setSelected(0);
  }
  async function open(item) {
    if (pending) {
      setMessage("请先确认上次保存结果");
      return;
    }
    if (
      status !== "已保存" &&
      draft &&
      !window.confirm("打开作品会替换当前未保存稿，是否继续？")
    )
      return;
    const epoch = generation.current;
    try {
      const saved = await mathRequest(`${base}/${item.id}`);
      if (epoch !== generation.current) return;
      setDraft(saved);
      setStatus("已保存");
      setSelected(0);
      setMessage("");
    } catch (e) {
      if (epoch === generation.current) handleError(e);
    }
  }
  async function save(copy = false) {
    if (inFlight.current) return;
    if (pending?.kind === "deletion") return deletion();
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
  async function deletion() {
    if (inFlight.current) return;
    if (pending && pending.kind !== "deletion") {
      setMessage("请先确认当前操作结果");
      return;
    }
    if (!pending && status !== "已保存") {
      setMessage("请先保存当前修改，再删除作品");
      return;
    }
    const epoch = generation.current,
      started = draftRef.current;
    const request = pending ?? {
      kind: "deletion",
      path: `${base}/${draft.id}/deletion`,
      method: "POST",
      key: crypto.randomUUID(),
      input: { baseVersion: draft.version, deleted: !draft.deletedAt },
    };
    const operation = Symbol("math-request");
    inFlight.current = operation;
    setBusy(true);
    setPending(request);
    try {
      const saved = await mathRequest(request.path, request);
      if (
        epoch !== generation.current ||
        inFlight.current !== operation ||
        draftRef.current !== started
      )
        return;
      setPending(null);
      setDraft(saved);
      setStatus("已保存");
      setMessage("");
      refresh();
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
  const readOnly =
    draft &&
    (draft.source.schemaVersion !== 1 ||
      !["formula", "plane", "space", "dynamic", "html"].includes(
        draft.source.kind,
      ));
  const preview = useMemo(() => {
    if (
      !draft ||
      ["formula", "dynamic", "html"].includes(draft.source.kind) ||
      readOnly
    )
      return null;
    if (!font) return { loading: true };
    try {
      return {
        url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderGraphic(draft.source).replace(/(<svg[^>]*>)/, `$1${font ? mathFontStyle(font) : ""}`))}`,
      };
    } catch (e) {
      return { error: e.message };
    }
  }, [draft, readOnly, font]);
  const objects =
    ["plane", "dynamic"].includes(draft?.source.kind) && !readOnly
      ? draft.source.scene.elements
      : (draft?.source.points ?? []);
  function replaceObject(next) {
    if (["plane", "dynamic"].includes(draft.source.kind))
      source({
        ...draft.source,
        scene: {
          ...draft.source.scene,
          elements: objects.map((v, i) => (i === selected ? next : v)),
        },
      });
    else
      source({
        ...draft.source,
        points: objects.map((v, i) => (i === selected ? next : v)),
      });
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
    source({
      ...draft.source,
      scene: {
        ...draft.source.scene,
        elements: [...objects, newElement(type, id)],
      },
    });
    setSelected(objects.length);
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
    <main className="math-workbench">
      <section className="math-main">
        <header>
          <strong>数学工坊</strong>
          {shell && <button onClick={() => shell.openPanel("math-tools")}>作品与工具</button>}
          <input
            ref={importFile}
            type="file"
            accept=".html,.htm"
            aria-label="导入 HTML 文件"
            hidden
            onChange={(e) => {
              importHtml(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button
            disabled={busy || Boolean(pending)}
            onClick={() => importFile.current.click()}
          >
            导入 HTML
          </button>
          {importPending && (
            <button disabled={busy} onClick={() => importHtml()}>
              重试原文件上传
            </button>
          )}
          {draft && (
            <>
              <input
                aria-label="作品名称"
                value={draft.title}
                onChange={(e) => edit({ ...draft, title: e.target.value })}
              />
              <span role="status">{status}</span>
              <button disabled={busy || readOnly} onClick={() => save()}>
                {pending
                  ? pending.kind === "deletion"
                    ? "确认删除结果"
                    : pending.kind === "export"
                      ? "确认导出结果"
                      : "确认保存结果"
                  : "保存"}
              </button>
              <button
                disabled={busy || readOnly || Boolean(pending)}
                onClick={() => save(true)}
              >
                另存作品
              </button>
            </>
          )}
        </header>
        {shell && <MathIntegration work={draft} saved={status === "已保存" && !pending} busy={busy} client={client} onError={handleError} />}
        {fontError && (
          <div role="alert" className="math-message">
            {fontError}
            <button onClick={() => setFontAttempt((value) => value + 1)}>
              重试字体
            </button>
          </div>
        )}
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
        <div className="math-canvas">
          {!draft ? (
            <div className="math-empty">
              <h1>制作数学作品</h1>
              {["formula", "plane", "space", "dynamic"].map((kind) => (
                <button key={kind} onClick={() => newDraft(kind)}>
                  新建{names[kind]}
                </button>
              ))}
            </div>
          ) : readOnly ? (
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
          ) : draft.source.kind === "dynamic" ? (
            <DynamicPreview
              source={draft.source}
              font={font}
              onChange={source}
            />
          ) : draft.source.kind === "formula" ? (
            <div className="math-formula">
              <label>
                LaTeX
                <textarea
                  ref={latexInput}
                  aria-label="LaTeX"
                  value={draft.source.latex}
                  onChange={(e) =>
                    source({ ...draft.source, latex: e.target.value })
                  }
                />
              </label>
              <div className="math-insert">
                {[
                  ["分式", "\\frac{}{}"],
                  ["根式", "\\sqrt{}"],
                  ["上下标", "x_{}^{}"],
                  [
                    "分段式",
                    "\\begin{cases}x & x>0\\\\ -x & x\\le0\\end{cases}",
                  ],
                ].map(([name, text]) => (
                  <button
                    key={name}
                    onClick={() =>
                      source({
                        ...draft.source,
                        latex: draft.source.latex + text,
                      })
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
              <label>
                中文说明
                <textarea
                  aria-label="中文说明"
                  value={draft.source.caption}
                  onChange={(e) =>
                    source({ ...draft.source, caption: e.target.value })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.source.includeCaption}
                  onChange={(e) =>
                    source({
                      ...draft.source,
                      includeCaption: e.target.checked,
                    })
                  }
                />
                纳入成果
              </label>
              <label>
                颜色
                <input
                  type="color"
                  value={draft.source.color}
                  onChange={(e) =>
                    source({ ...draft.source, color: e.target.value })
                  }
                />
              </label>
              <label>
                字号
                <input
                  type="number"
                  value={draft.source.fontSize}
                  onChange={(e) =>
                    source({
                      ...draft.source,
                      fontSize: Number(e.target.value),
                    })
                  }
                />
              </label>
              <FormulaPreview
                source={draft.source}
                retry={fontAttempt}
                onLocate={(position) => {
                  latexInput.current.focus();
                  latexInput.current.setSelectionRange(position, position + 1);
                }}
              />
              {draft.render?.state === "invalid" && status === "已保存" && (
                <p role="alert">
                  源码已保存，渲染失败。请修正 LaTeX
                  后保存；本版本仅可下载制作源。
                </p>
              )}
            </div>
          ) : preview?.loading ? (
            <p>{fontError ? "字体恢复后继续预览" : "正在加载本地字体"}</p>
          ) : preview?.error ? (
            <p role="alert">{preview.error}</p>
          ) : (
            <img alt="当前数学图形预览" src={preview?.url} />
          )}
        </div>
        {draft?.id && (
          <footer>
            <select
              aria-label="导出格式"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {draft.source.kind !== "html" && (
                <>
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </>
              )}
              {["dynamic", "html"].includes(draft.source.kind) && (
                <option value="html">隔离演示 HTML</option>
              )}
              <option value="source">
                {draft.source.kind === "html" ? "当前源码 HTML" : "制作源 JSON"}
              </option>
            </select>
            {!["source", "html"].includes(format) && (
              <>
                <select
                  aria-label="导出背景"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                >
                  <option value="transparent">透明</option>
                  {draft.source.kind !== "formula" && (
                    <option value="white">白底</option>
                  )}
                </select>
                <input
                  aria-label="导出宽度"
                  type="number"
                  value={exportWidth}
                  min="200"
                  max="4800"
                  onChange={(e) => setExportWidth(Number(e.target.value))}
                />
              </>
            )}
            <button disabled={busy} onClick={exportFile}>
              下载
            </button>
            <button disabled={busy} onClick={deletion}>
              {draft.deletedAt ? "恢复作品" : "删除作品"}
            </button>
          </footer>
        )}
      </section>
      <Tools>
        <div className="math-new">
          {["formula", "plane", "space", "dynamic"].map((kind) => (
            <button key={kind} onClick={() => newDraft(kind)}>
              新建{names[kind]}
            </button>
          ))}
        </div>
        <details open>
          <summary>我的作品</summary>
          <input
            aria-label="搜索作品"
            placeholder="搜索作品"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={deleted}
              onChange={(e) => setDeleted(e.target.checked)}
            />
            已删除
          </label>
          <nav>
            {items.map((item) => (
              <button key={item.id} onClick={() => open(item)}>
                {item.title}
                <small>v{item.version}</small>
              </button>
            ))}
          </nav>
        </details>
        {draft?.source.kind === "dynamic" && (
          <DynamicTools
            source={draft.source}
            onChange={source}
            Fields={Fields}
          />
        )}
        {draft &&
          !readOnly &&
          !["formula", "html"].includes(draft.source.kind) && (
            <>
              <details open>
                <summary>对象</summary>
                {["plane", "dynamic"].includes(draft.source.kind) ? (
                  <div className="math-add">
                    {[
                      "function",
                      "point",
                      "line",
                      "ellipse",
                      "polyline",
                      "text",
                    ].map((type) => (
                      <button key={type} onClick={() => add(type)}>
                        添加{names[type]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="math-add">
                    <button onClick={() => source(cubeSource())}>
                      正方体起点
                    </button>
                    <button onClick={() => source(pyramidSource())}>
                      棱锥起点
                    </button>
                    <button
                      onClick={() => {
                        source({
                          ...draft.source,
                          points: [
                            ...objects,
                            {
                              id: `P${objects.length}`,
                              x: 0,
                              y: 0,
                              z: 0,
                              label: {
                                text: `P${objects.length}`,
                                dx: 10,
                                dy: -10,
                              },
                              style: defaultStyle(),
                            },
                          ],
                        });
                        setSelected(objects.length);
                      }}
                    >
                      添加空间点
                    </button>
                    <button
                      disabled={objects.length < 2}
                      onClick={() =>
                        source({
                          ...draft.source,
                          edges: [
                            ...draft.source.edges,
                            {
                              id: `E${Date.now()}`,
                              from: objects[0].id,
                              to: objects[1].id,
                              style: defaultStyle(),
                            },
                          ],
                        })
                      }
                    >
                      添加棱
                    </button>
                  </div>
                )}
                <select
                  aria-label="选择对象"
                  value={selected}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {objects.map((o, i) => (
                    <option key={i} value={i}>
                      {o.id} {names[o.type] ?? ""}
                    </option>
                  ))}
                </select>
                {objects[selected] && (
                  <>
                    <Fields
                      value={objects[selected]}
                      onChange={replaceObject}
                    />
                    <button
                      onClick={() => {
                        if (["plane", "dynamic"].includes(draft.source.kind))
                          source({
                            ...draft.source,
                            scene: {
                              ...draft.source.scene,
                              elements: objects.filter(
                                (_, i) => i !== selected,
                              ),
                            },
                          });
                        else
                          source({
                            ...draft.source,
                            points: objects.filter((_, i) => i !== selected),
                          });
                        setSelected(0);
                      }}
                    >
                      移除对象
                    </button>
                  </>
                )}
              </details>
              <details>
                <summary>坐标窗</summary>
                <Fields
                  value={draft.source.scene?.viewport ?? draft.source.viewport}
                  onChange={(view) =>
                    source(
                      ["plane", "dynamic"].includes(draft.source.kind)
                        ? {
                            ...draft.source,
                            scene: { ...draft.source.scene, viewport: view },
                          }
                        : { ...draft.source, viewport: view },
                    )
                  }
                />
              </details>
              {draft.source.kind === "space" && (
                <>
                  <details open>
                    <summary>投影</summary>
                    <Fields
                      value={{
                        azimuth: draft.source.azimuth,
                        elevation: draft.source.elevation,
                      }}
                      onChange={(angles) =>
                        source({ ...draft.source, ...angles })
                      }
                    />
                  </details>
                  <details>
                    <summary>棱</summary>
                    {draft.source.edges.map((edge, i) => (
                      <div key={i}>
                        <Fields
                          value={edge}
                          prefix={`edge-${i}-`}
                          onChange={(next) =>
                            source({
                              ...draft.source,
                              edges: draft.source.edges.map((v, j) =>
                                j === i ? next : v,
                              ),
                            })
                          }
                        />
                        <button
                          onClick={() =>
                            source({
                              ...draft.source,
                              edges: draft.source.edges.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          移除棱
                        </button>
                      </div>
                    ))}
                  </details>
                </>
              )}
            </>
          )}
      </Tools>
    </main>
  );
}
