import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../platform/device/useScene.js';
import { writeLocal, migrateLegacyLocal } from '../../platform/device/storage.js';
import { reselectDeviceFile } from '../../platform/device/deviceRequestStore.js';
import { useForegroundRefresh } from '../../components/interaction/useForegroundRefresh.js';
import { ShellContext } from '../workbench/shellContext.js';
import { createMathClient } from './api.js';
import { uploadDraft } from './uploadDraft.js';
import { useDraftHistory } from './useDraftHistory.js';
import { emptyDynamicSource, emptySource } from './model.js';
import { createWorkshopSource } from '@teachbuddy/shared/math/workshop';

const base = '/api/modules/math/v1/works';
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
// Work identity, revisions, local inputs and pending receipts share one lifetime.
// The editor supplies a complete snapshot through flushRef before a save/leave.
export function useMathWorkSession({ transport, route, confirm, reselectHtml }) {
  const { t } = useTranslation('math');
  const shell = useContext(ShellContext);
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
  const listQuery = useRef({ search, deleted });
  const listRequest = useRef(0);
  listQuery.current = { search, deleted };
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
    if (attempt.requiresReselection) { reselectHtml(); return; }
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
      if (!rememberWorkspace({ draft: draftRef.current, pending: request }))
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
  // Keep the existing device envelope and all operation receipts at one seam.
  function rememberWorkspace(overrides = {}) {
    return writeLocal(account, 'math-workspace', {
      draft, pending, status, selected, search, deleted, format, background, exportWidth, ...overrides,
    });
  }
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
        if (!rememberWorkspace())
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
    const query = listQuery.current;
    const request = ++listRequest.current;
    const current = () => epoch === generation.current && request === listRequest.current
      && query.search === listQuery.current.search && query.deleted === listQuery.current.deleted;
    try {
      const result = await mathRequest(
        `${base}?q=${encodeURIComponent(query.search)}&state=${query.deleted ? "deleted" : "active"}`,
      );
      if (current()) setItems(result.items);
    } catch (e) {
      if (current()) handleError(e);
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
    rememberWorkspace({ draft: next, status: '未保存' });
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
    rememberWorkspace({ draft: draftRef.current, pending: request, status: '保存结果待确认' });
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
    rememberWorkspace({ draft: draftRef.current, pending: request, status: '保存结果待确认' });
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
    rememberWorkspace({ draft: draftRef.current, pending: request });
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
      rememberWorkspace({ draft: next, pending: null, status: currentTarget ? '已保存' : status });
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
      rememberWorkspace({ draft: next, ...liveSave.current });
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
  function expandTool(key, open) {
    patchView(current => ({ groups: { ...current.groups, [key]: open } }));
  }
  function captureSource(session, kind, next, touched) {
    const current = draftRef.current;
    if (editorSessionRef.current !== session || current?.source.kind !== kind) return;
    if (kind === 'workshop') {
      if (JSON.stringify(current.source) !== JSON.stringify(next)) edit({ ...current, source: next }, false);
    } else if (current.source.base64 !== next.base64 || (!current.id && touched && !current.ggbTouched)) {
      edit({ ...current, source: next, ggbTouched: current.ggbTouched || touched }, false);
    }
  }
  function rememberInput(session, workshopInput) {
    const current = draftRef.current;
    if (editorSessionRef.current !== session || current?.source.kind !== 'workshop') return;
    const next = { ...current, workshopInput };
    draftRef.current = next; setDraft(next);
    rememberWorkspace({ draft: next, ...liveSave.current });
  }
  function acknowledgeUnchanged(session, previous, previousStatus) {
    if (editorSessionRef.current === session && previousStatus === '已保存' && draftRef.current === previous && !inFlight.current && !pending) setStatus('已保存');
  }
  function retainLocalVersion() {
    const version = typeof conflict === 'object' ? conflict?.version : conflict;
    edit({ ...draftRef.current, version }, false);
    setConflict(null); setMessage(t('请核对本地修改后保存'));
  }
  function changeExportOptions(options) {
    if ('format' in options) setFormat(options.format);
    if ('background' in options) setBackground(options.background);
    if ('width' in options) setExportWidth(options.width);
  }
  function makeDynamicCopy() {
    if (!canChangeHistory || draft.source.kind !== 'plane') return;
    if (status !== '已保存') { setMessage(t('请先保存平面图形，再制作动态副本。')); return; }
    const suffix = ' · 动态演示';
    const next = { title: `${draft.title.slice(0, 200 - suffix.length)}${suffix}`, originalFileId: null,
      source: { ...emptyDynamicSource(), scene: structuredClone(draft.source.scene) } };
    history.reset(null); edit(next, false);
    if (route?.workId) shell?.navigate('/math');
    setFormat('html'); setSelected(0); setConflict(null);
    patchView({ selectionKind: 'object', exportOpen: false }); showTools('parameters');
    setMessage(t('已保留原图。设置参数，并在图形表达式中使用参数名；保存后建立独立的动态作品。'));
  }
  return {
    work: draft, status, pending, conflict, message, busy, locked, readOnly, home, empty: !hasContent(draft), account, client,
    library: { items, search, deleted, searchWorks: setSearch, showArchived: setDeleted },
    exportOptions: { format, background, width: exportWidth, change: changeExportOptions },
    view: { scene: viewScene, change: patchView, selected, select: setSelected, selectGraphic, showTools, expandTool },
    history: { open: historyOpen, show: () => setHistoryOpen(true), close: () => setHistoryOpen(false),
      canChange: canChangeHistory, canUndo: history.canUndo, canRedo: history.canRedo, move: moveHistory, restore: restoreVersion },
    editor: { session: editorSession, flushRef: ggbFlush, takeAssistantRequest,
      captureSource: (kind, next, touched) => captureSource(editorSession, kind, next, touched),
      rememberInput: input => rememberInput(editorSession, input), dirty: () => setStatus('未保存'),
      acknowledgeUnchanged: (previous, previousStatus) => acknowledgeUnchanged(editorSession, previous, previousStatus) },
    actions: { identify, newWork: newDraft, open, home: goHome, save, exportFile,
      archive: target => deletion(false, target), purge: target => deletion(true, target),
      importHtml, importSource, downloadOriginal, retainLocalVersion,
      rename: title => edit({ ...draftRef.current, title }, false), changeSource: source,
      changeLegacyWork: edit, reportError: handleError, makeDynamicCopy },
    importPending,
  };
}
