import { Popover, ConfirmDialog } from "../workbench/ModuleOverlays.jsx";
import { ModulePresence, ModuleDisclosure } from "../workbench/ModuleMotion.jsx";
import { pendingQuestionUpload, uploadQuestionFile } from './uploadRecovery.js';
import { reviewParagraphs, splitReviewDraft } from './review-drafts.js';
import React, { useEffect, useRef, useState } from "react";
import { questionDocuments, supportedDocument } from "@refatos/shared";
import { DocumentView } from "../workbench/materials/index.js";
import { readLocal, writeLocal, removeLocal } from "../workbench/storage.js";
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import {
  get,
  write,
  download,
  empty,
  sourceText,
  documentAssets,
} from "./materials-api.js";
import { useScrollRestore } from "../workbench/useScrollRestore.js";
import OriginalPane from "./OriginalPane.jsx";
import ResizeDivider from "./ResizeDivider.jsx";
import { QuestionIcon, QuestionDialog, QuestionDocumentEditor, QuestionWelcome } from './QuestionControls.jsx';
import "./questions-materials.css";
const active = new Set(["queued", "running", "cancelling"]);
const editableFields = (q) => ({
  title: q.title,
  body: q.body,
  solution: q.solution,
  answerStatus: q.answerStatus,
  note: q.note,
  starred: q.starred,
  typeId: q.typeId,
  tagIds: q.tagIds,
});
const stateNames = {
  queued: "原稿已保存，等待整理",
  running: "正在整理",
  partial: "部分内容待处理",
  failed: "整理失败，原稿已保存",
  interrupted: "整理已中断",
  cancelled: "已停止",
  cancelling: "正在停止",
  succeeded: "整理完成，等待校对",
};
export default function MaterialsQuestionsPage({
  accountKey,
  transport,
  onAddToLesson,
  onOpenLesson,
  usageRevision,
  requestedId,
  registerTools,
  onOpenTools,
  onReturnToLibrary,
  onReturnToRecord,
  renderTeachingFeedback,
}) {
  const pageNode = useRef(null);
  const collection = useRef(
    readLocal(accountKey, "questions-collection") ?? {},
  ).current;
  const [scene, setScene] = useState(
    () =>
      readLocal(accountKey, "questions-materials-scene") ?? {
        kind: "list",
        id: null,
        q: "",
        state: "active",
        typeId: "",
        tagIds: [],
        starred: false,
      },
  );
  const [items, setItems] = useState([]),
    [imports, setImports] = useState([]),
    [taxonomy, setTaxonomy] = useState({ version: 1, types: [], tags: [] });
  const [listState, setListState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [sourceAvailability, setSourceAvailability] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState(null);
  const [copyCandidate, setCopyCandidate] = useState(null);
  const [newCategory, setNewCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [value, setValue] = useState(null),
    [job, setJob] = useState(null),
    [selected, setSelected] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [capture, setCapture] = useState(collection.capture ?? null),
    [manage, setManage] = useState(false),
    [copies, setCopies] = useState([]),
    [usages, setUsages] = useState([]),
    [assets, setAssets] = useState(null),
    [source, setSource] = useState(null),
    [conflict, setConflict] = useState(null);
  const includeAnswers = scene.includeAnswers ?? false;
  const editing = scene.kind === 'new' || Boolean(scene.editing);
  const archived = scene.state === 'deleted';
  const hasFilters = Boolean(scene.q || scene.starred || scene.typeId || scene.tagIds?.length || scene.searchAnswers);
  const setIncludeAnswers = includeAnswers => patchScene({ includeAnswers });
  const [text, setText] = useState(collection.text ?? ""),
    [title, setTitle] = useState(collection.title ?? ""),
    [origin, setOrigin] = useState(collection.origin ?? ""),
    [chosenFiles, setChosenFiles] = useState([]),
    [pages, setPages] = useState(collection.pages ?? "");
  const questionScroll = useScrollRestore(
    scene.questionScroll ?? 0,
    (top) => patchScene({ questionScroll: top }),
    value?.id,
  );
  const reviewScroll = useScrollRestore(scene.reviewScroll?.[selected] ?? 0,
    top => patchScene({ reviewScroll: { ...scene.reviewScroll, [selected]: top } }), selected);
  const unsupportedQuestion = value && scene.kind !== "import" && value.body
    ? questionDocuments(value).some(([, document]) => !supportedDocument(document))
    : false;
  const sourcePath = value?.source?.kind === 'import' ? '/imports/' + value.source.importId
    : value?.source?.kind === 'copy' ? '/items/' + value.source.questionId : null;
  const sourceMissing = sourceAvailability?.path === sourcePath && sourceAvailability?.state === 'missing';
  useEffect(() => {
    let live = true;
    setSourceAvailability(null);
    if (sourcePath) get(sourcePath).then(() => {
      if (live) setSourceAvailability({ path: sourcePath, state: 'available' });
    }).catch(error => {
      if (live) setSourceAvailability({ path: sourcePath, state: error.problem?.kind === 'not-found' ? 'missing' : 'unavailable' });
    });
    return () => { live = false; };
  }, [sourcePath]);
  useEffect(() => {
    writeLocal(accountKey, "questions-collection", {
      capture,
      text,
      title,
      origin,
      pages,
      fileNames: chosenFiles.length ? chosenFiles.map(file => file.name) : collection.fileNames ?? [],
    });
  }, [capture, text, title, origin, pages, chosenFiles]);
  const pending = useRef(readLocal(accountKey, "questions-materials-pending")),
    alive = useRef(true);
  useEffect(() => {
    let live = true;
    pendingQuestionUpload(accountKey).then(value => {
      if (live && value) setMessage(`文件“${value.file.name}”上传结果待确认，请重新选择原文件继续。`);
    }).catch(() => { if (live) setMessage('无法读取待确认的文件，请保留设备资料并检查浏览器存储权限。'); });
    return () => { live = false; };
  }, [accountKey]);
  const picker = useRef(null);
  const [splitAt, setSplitAt] = useState(1),
    [mergeId, setMergeId] = useState("");
  useEffect(
    () => {
      alive.current = true;
      return () => { alive.current = false; };
    },
    [],
  );
  const patchScene = (patch) =>
    setScene((s) => {
      const next = { ...s, ...patch };
      writeLocal(accountKey, "questions-materials-scene", next);
      return next;
    });
  useEffect(() => {
    if (requestedId && /^[0-9a-f-]{36}$/i.test(requestedId))
      patchScene({ kind: "question", id: requestedId, editing: false, compare: false });
  }, [requestedId]);
  const localKey = `questions-materials-draft:${scene.kind}:${scene.id ?? "new"}`;
  const editorRef = useRef(null);
  editorRef.current = {value, scene, localKey};
  const refreshSequence = useRef(0);
  const viewRef = useRef({ scene, value, busy });
  viewRef.current = { scene, value, busy };
  useForegroundRefresh(async () => {
    if (viewRef.current.busy || pending.current) return;
    const started = viewRef.current;
    await refresh();
    if (!started.scene.id) return;
    const server = await get(`/${started.scene.kind === 'import' ? 'imports' : 'items'}/${started.scene.id}`);
    const current = viewRef.current;
    if (!alive.current || current.busy || pending.current || current.scene.id !== started.scene.id || current.scene.kind !== started.scene.kind) return;
    const draft = readLocal(accountKey, localKey);
    if (!draft) setValue(server);
    else if (draft.version !== server.version) setConflict(server);
  });
  const change = (next) => {
    setValue(next);
    writeLocal(accountKey, localKey, next);
  };
  async function refresh(filters = editorRef.current.scene) {
    const sequence = ++refreshSequence.current;
    const q = new URLSearchParams({
      q: filters.q ?? "",
      state: filters.state ?? "active",
    });
    if (filters.typeId) q.set("typeId", filters.typeId);
    if (filters.starred) q.set("starred", "true");
    if (filters.searchAnswers) q.set("searchAnswers", "true");
    for (const id of filters.tagIds ?? []) q.append("tagIds", id);
    const [list, mats, tax] = await Promise.all([
      get("/items?" + q),
      get("/imports?state=" + (filters.state ?? "active")),
      get("/taxonomy"),
    ]);
    if (alive.current && sequence === refreshSequence.current) {
      setItems(list.items);
      setImports(mats.items);
      setTaxonomy(tax);
      setListState('ready');
    }
  }
  useEffect(() => {
    let active = true;
    const request = refresh();
    const sequence = refreshSequence.current;
    request.catch((e) => {
      if (!active || !alive.current || sequence !== refreshSequence.current) return;
      setListState('error');
      setMessage(e.message);
    });
    return () => { active = false; };
  }, [
    scene.q,
    scene.state,
    scene.typeId,
    JSON.stringify(scene.tagIds),
    scene.starred,
    scene.searchAnswers,
  ]);
  useEffect(() => {
    let live = true;
    setValue(null);
    setJob(null);
    setSelected(null);
    setSource(null);
    setConflict(null);
    setAssets(null);
    setCopies([]);
    setLoadError('');
    const assetId = readLocal(accountKey, "question-asset:" + scene.id);
    if (assetId)
      get("/api/workbench/jobs/" + assetId)
        .then((j) => live && setAssets(j))
        .catch((e) => live && setMessage(e.message));
    if (scene.kind === "new")
      setValue(
        readLocal(accountKey, localKey) ?? {
          title: "",
          body: empty(),
          solution: empty(),
          answerStatus: "absent",
          note: "",
          starred: false,
          typeId: null,
          tagIds: [],
          source: { kind: "manual" },
        },
      );
    if (scene.id) {
      get(`/${scene.kind === "import" ? "imports" : "items"}/${scene.id}`)
        .then(async (v) => {
          if (!live) return;
          const local = readLocal(accountKey, localKey);
          setValue(local && (scene.kind === 'import' || scene.editing) ? {...local, deletedAt: v.deletedAt} : v);
          if (scene.kind === "import") {
            setSelected(scene.draftId ?? v.drafts[0]?.id);
            const latestJob = await get("/api/workbench/jobs/" + v.jobId);
            const latest = await get("/imports/" + scene.id);
            if (!live) return;
            setValue(readLocal(accountKey, localKey) ?? latest);
            setSelected(scene.draftId ?? latest.drafts[0]?.id);
            setJob(latestJob);
          } else {
            get("/items/" + v.id + "/copies").then(
              (x) => live && setCopies(x.items),
            );

          }
        })
        .catch((e) => { if (live) setLoadError(e.message); });
    }
    return () => {
      live = false;
    };
  }, [scene.id, scene.kind]);
  useEffect(() => {
    let live = true;
    setUsages([]);
    if (scene.kind === "question" && scene.id)
      get("/api/modules/lessons/v2/question-usages/" + scene.id)
        .then((x) => live && setUsages(x.items))
        .catch(() => live && setUsages(null));
    return () => { live = false; };
  }, [scene.kind, scene.id, usageRevision]);
  useEffect(() => {
    const target = readLocal(accountKey, "questions-return-focus");
    if (!target || !value) return;
    const trigger = Array.from(pageNode.current?.querySelectorAll("[data-return-focus]") ?? [])
      .find((node) => node.dataset.returnFocus === target);
    if (trigger) {
      trigger.focus({ preventScroll: true });
      removeLocal(accountKey, "questions-return-focus");
    }
  }, [accountKey, value, usages]);
  useEffect(() => {
    if (!job || !active.has(job.state) || scene.kind !== "import") return;
    let live = true;
    const timer = setInterval(async () => {
      try {
        const next = await get("/api/workbench/jobs/" + job.id);
        if (!live) return;
        const material = await get("/imports/" + scene.id);
        if (live) {
          setValue(material);
          setJob(next);
          setSelected((id) => id ?? material.drafts[0]?.id);
        }
      } catch (e) {
        if (live) setMessage(e.message);
      }
    }, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [job?.id, job?.state, scene.id, scene.kind]);
  useEffect(() => {
    if (!assets || !active.has(assets.state)) return;
    let live = true;
    const timer = setInterval(
      () =>
        get("/api/workbench/jobs/" + assets.id)
          .then((j) => {
            if (live) setAssets(j);
          })
          .catch((e) => {
            if (live) setMessage(e.message);
          }),
      2000,
    );
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [assets?.id, assets?.state]);
  async function action(fn) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      if (e.problem?.kind === "conflict" && scene.id) {
        try {
          setConflict(
            await get(
              `/${scene.kind === "import" ? "imports" : "items"}/${scene.id}`,
            ),
          );
        } catch {
          /* Keep the local document available if the comparison read fails. */
        }
      }
      setMessage(e.problem?.message ?? e.message ?? "操作失败，请重试");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function mutate(path, input, method = "POST") {
    const intended = { path, input, method };
    if (pending.current) {
      const old = pending.current;
      const result = await write(old.path, old.input, old.key, old.method);
      pending.current = null;
      removeLocal(accountKey, "questions-materials-pending");
      if (
        JSON.stringify({ ...old, key: undefined }) ===
        JSON.stringify({ ...intended, key: undefined })
      )
        return result;
      acceptRecoveredQuestion(old, result);
      acceptLifecycleResult(old, result);
      throw Error("上次请求已确认，后续修改仍保留，请继续保存。");
    }
    const request = { ...intended, key: crypto.randomUUID() };
    pending.current = request;
    writeLocal(accountKey, "questions-materials-pending", request);
    try {
      const result = await write(path, input, request.key, method);
      pending.current = null;
      removeLocal(accountKey, "questions-materials-pending");
      return result;
    } catch (e) {
      if (e.problem && !['unconfirmed', 'identity'].includes(e.problem.kind)) {
        pending.current = null;
        removeLocal(accountKey, "questions-materials-pending");
      }
      throw e;
    }
  }
  function acceptRecoveredQuestion(request, saved) {
    const created = request.method === 'POST' && (request.path === '/items' || /^\/items\/[^/]+\/copies$/.test(request.path));
    const updated = request.method === 'PUT' && /^\/items\/[^/]+$/.test(request.path);
    if ((!created && !updated) || !saved?.id) return false;
    const oldKey = created ? 'questions-materials-draft:new:new' : `questions-materials-draft:question:${saved.id}`;
    const nextKey = `questions-materials-draft:question:${saved.id}`;
    const local = readLocal(accountKey, oldKey);
    const changed = local && JSON.stringify(editableFields(local)) !== JSON.stringify(editableFields(request.input));
    const next = changed ? { ...saved, ...editableFields(local) } : saved;
    removeLocal(accountKey, oldKey);
    if (changed) writeLocal(accountKey, nextKey, next);
    const current = editorRef.current.scene;
    if ((created && current.kind === 'new') || (current.kind === 'question' && current.id === saved.id)) {
      setValue(next);
      patchScene({ kind: 'question', id: saved.id, editing: Boolean(changed) });
      setConflict(null);
    }
    return true;
  }
  const open = (kind, id, compare = false) => {
    if (scene.kind === kind && scene.id === id) return;
    setValue(null);
    patchScene({ kind, id, draftId: null, original: {}, compare, editing: kind === 'new', reviewEditing: false, questionScroll: 0 });
    setMessage("");
  };
  async function openSource() {
    const question = value;
    const from = editorRef.current.scene;
    const stillCurrent = () => editorRef.current.scene.kind === from.kind && editorRef.current.scene.id === from.id;
    try {
      await get(sourcePath);
      if (!stillCurrent()) return;
      if (question.source.kind === 'import') {
        open('import', question.source.importId);
        patchScene({ draftId: question.source.draftId });
      } else open('question', question.source.questionId);
    } catch (error) {
      if (!stillCurrent()) return;
      if (error.problem?.kind === 'not-found') setSourceAvailability({ path: sourcePath, state: 'missing' });
      else throw error;
    }
  }
  function returnToLibrary(state = scene.state, clearFilters = false) {
    setValue(null);
    patchScene({ kind: 'list', id: null, state, compare: false, editing: false, reviewEditing: false, draftId: null, selectedIds: [], selecting: false,
      ...(clearFilters ? { q: '', typeId: '', tagIds: [], starred: false, searchAnswers: false } : {}) });
    onReturnToLibrary?.();
    requestAnimationFrame(() => pageNode.current?.querySelector('.q-finder h1')?.focus({ preventScroll: true }));
  }
  function requestLifecycle(mode) {
    setMessage('');
    setLifecycleAction({ mode, kind: scene.kind, item: value });
  }
  function acceptLifecycleResult(request, result) {
    const match = request.path.match(/^\/(items|imports)\/([^/]+)\/(deletion|purge)$/);
    if (!match) return false;
    const [, collection, id, operation] = match;
    const kind = collection === 'items' ? 'question' : 'import';
    const key = `questions-materials-draft:${kind}:${id}`;
    const local = readLocal(accountKey, key);
    if (operation === 'purge') {
      removeLocal(accountKey, key);
      removeLocal(accountKey, 'question-asset:' + id);
    } else if (local?.version === request.input.baseVersion) {
      writeLocal(accountKey, key, { ...local, version: result.version, deletedAt: result.deletedAt });
    }
    setLifecycleAction(null);
    if (editorRef.current.scene.id === id) returnToLibrary();
    setMessage(operation === 'purge' ? '已彻底删除，无法恢复。' : result.deletedAt ? '已归档，可在归档内容中恢复或彻底删除。' : '已恢复，可回到题库查看。');
    return true;
  }
  async function confirmLifecycle() {
    const { mode, kind, item } = lifecycleAction;
    const path = `/${kind === 'import' ? 'imports' : 'items'}/${item.id}/${mode === 'purge' ? 'purge' : 'deletion'}`;
    const input = { baseVersion: item.version, ...(mode === 'purge' ? {} : { deleted: mode === 'archive' }) };
    const result = await mutate(path, input);
    acceptLifecycleResult({ path, input }, result);
    await refresh();
  }
  async function save() {
    const result = await mutate(
      `/${scene.kind === "import" ? "imports" : "items"}/${value.id}`,
      scene.kind === "import"
        ? {
            baseVersion: value.version,
            drafts: value.drafts,
            fragments: value.fragments,
          }
        : { baseVersion: value.version, ...editableFields(value) },
      "PUT",
    );
    setValue(result);
    removeLocal(accountKey, localKey);
    setMessage(scene.kind === "import" ? "校对已保存" : "题目已保存");
    await refresh();
    return result;
  }
  const newDraftKey = 'questions-materials-draft:new:new';
  const meaningful = q => Boolean(q && (q.title?.trim() || sourceText(q.body).trim() || documentAssets(q.body).figures.length || sourceText(q.solution).trim() || documentAssets(q.solution).figures.length || q.note?.trim() || q.source?.kind === 'copy'));
  function startCapture() { setMessage(''); setCapture('选择'); }
  function beginEdit(addAnswer = false) {
    const local = readLocal(accountKey, localKey) ?? value;
    if (addAnswer === true) change({ ...local, answerStatus: 'present', deletedAt: value.deletedAt });
    else setValue({ ...local, deletedAt: value.deletedAt });
    patchScene({ editing: true });
  }
  async function leaveEditor() {
    if (scene.kind === 'new') {
      if (!meaningful(value)) removeLocal(accountKey, localKey);
      open('list', null);
    } else {
      const saved = await get('/items/' + value.id);
      setValue(saved);
      patchScene({ editing: false });
      setMessage('');
    }
  }
  async function saveQuestion() {
    if (scene.kind !== 'new') return save();
    const q = value.source?.kind === 'copy'
      ? await mutate('/items/' + value.source.questionId + '/copies', { baseVersion: value.source.questionVersion, ...editableFields(value) })
      : await mutate('/items', value);
    removeLocal(accountKey, localKey);
    await refresh();
    open('question', q.id);
    setMessage('题目已保存');
    return q;
  }
  function startCopy(question) {
    const next = { ...editableFields(question), note: '', starred: false,
      source: { kind: 'copy', questionId: question.id, questionVersion: question.version,
        snapshot: { title: question.title, body: question.body, solution: question.solution } } };
    writeLocal(accountKey, newDraftKey, next);
    open('new', null, true);
    setValue(next);
    setCopyCandidate(null);
  }
  function copyQuestion() {
    const existing = readLocal(accountKey, newDraftKey);
    if (meaningful(existing)) setCopyCandidate(value);
    else startCopy(value);
  }
  async function confirmDraft() {
    const issue = draft.issues.find(issue => issue.resolution === 'open');
    if (issue || draft.answerStatus === 'unresolved') {
      setMessage(issue ? '请先完成这道题的待检查项，再确认入库。' : '请先核对答案，并选择答案是否完整。');
      const target = issue
        ? [...(pageNode.current?.querySelectorAll('[data-issue-id]') ?? [])].find(node => node.dataset.issueId === issue.id)?.querySelector('select')
        : pageNode.current?.querySelector('[aria-label="答案状态"]');
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
      return;
    }
    await action(async () => {
      const saved = await save();
      const result = await mutate('/imports/' + saved.id + '/commit', { baseVersion: saved.version, draftIds: [selected] });
      setValue(result.import);
      setMessage('这道题已入库，可以继续检查下一题。');
      patchScene({ reviewEditing: false });
      await refresh();
    });
  }
  async function uploadFile(file) {
    return uploadQuestionFile(accountKey, transport, file);
  }
  async function collect() {
    let input;
    if (capture === "文字") input = { kind: "text", text };
    else {
      const stored = [];
      for (const f of chosenFiles) stored.push(await uploadFile(f));
      const numbers = pages.trim() ? pages.split(/[,，\s]+/).map(Number) : [];
      input = {
        kind: "files",
        fileIds: stored.map((x) => x.id),
        pages: numbers.length
          ? stored.map((x) => ({ fileId: x.id, pages: numbers }))
          : [],
      };
    }
    const result = await mutate("/imports", {
      title: title || chosenFiles[0]?.name || "收录文字",
      origin,
      input,
    });
    setCapture(null);
    setText("");
    setTitle("");
    setOrigin("");
    setPages("");
    setChosenFiles([]);
    collection.fileNames = [];
    removeLocal(accountKey, "questions-collection");
    await refresh();
    open("import", result.id);
  }
  const draft = value?.drafts?.find((x) => x.id === selected),
    locked =
      busy || Boolean(value?.deletedAt) || active.has(job?.state) || draft?.disposition === "confirmed";
  const splitParagraphCount = draft ? reviewParagraphs(draft.body).length : 0;
  const editDraft = (patch) =>
    change({
      ...value,
      drafts: value.drafts.map((d) =>
        d.id === selected ? { ...d, ...patch } : d,
      ),
    });
  const classification = (q, onChange) => (
    <div className="q-classify">
      <label>
        题型
        <select
          aria-label="题型"
          value={q.typeId ?? ""}
          onChange={(e) => onChange({ typeId: e.target.value || null })}
        >
          <option value="">未分类</option>
          {taxonomy.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="q-text-button" onClick={() => { setCategoryName(''); setMessage(''); setNewCategory({ kind: 'types', onAssign: id => onChange({ typeId: id }) }); }}><QuestionIcon name="plus" size={14} />新建题型</button>
      <span className="q-classify-label">标签</span>
      {taxonomy.tags.map((t) => (
        <label key={t.id}>
          <input
            type="checkbox"
            checked={q.tagIds.includes(t.id)}
            onChange={(e) =>
              onChange({
                tagIds: e.target.checked
                  ? [...q.tagIds, t.id]
                  : q.tagIds.filter((id) => id !== t.id),
              })
            }
          />
          {t.name}
        </label>
      ))}
      <button type="button" className="q-text-button" onClick={() => { setCategoryName(''); setMessage(''); setNewCategory({ kind: 'tags', onAssign: id => onChange({ tagIds: [...q.tagIds, id] }) }); }}><QuestionIcon name="plus" size={14} />新建标签</button>
    </div>
  );
  async function pickImage() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.onchange = async () => {
        setBusy(true);
        try { resolve(input.files[0] ? await uploadFile(input.files[0]) : null); }
        catch (error) { reject(error); }
        finally { if (alive.current) setBusy(false); }
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  const taxonomyTools = (
    <div className="wb-module q-taxonomy-tools">
      <p className="q-muted">管理所有题目的题型与标签。查找题目请使用列表中的筛选。</p>
      {!manage && <button onClick={() => setManage(true)}>管理题型与标签</button>}
      <ModulePresence present={manage} mode="collapse">{manage && (
        <Taxonomy
          key={taxonomy.version}
          taxonomy={taxonomy}
          disabled={busy}
          onSave={(next) =>
            action(async () => {
              const editing = editorRef.current;
              const before = editing.scene.kind === "question" && editing.value?.id
                ? await get("/items/" + editing.value.id) : null;
              const saved = await mutate(
                "/taxonomy",
                { baseVersion: taxonomy.version, ...next },
                "PUT",
              );
              setTaxonomy(saved);
              const classify = (q) => ({...q,
                typeId: saved.types.some(t => t.id === q.typeId) ? q.typeId : null,
                tagIds: q.tagIds.filter(id => saved.tags.some(t => t.id === id)),
              });
              const current = editorRef.current;
              if (current.scene.kind === editing.scene.kind && current.scene.id === editing.scene.id && current.value) {
                let nextValue = current.value;
                if (before) {
                  const after = await get("/items/" + before.id);
                  const cleaned = classify(before);
                  const changed = cleaned.typeId !== before.typeId || cleaned.tagIds.length !== before.tagIds.length;
                  if (current.value.version === before.version && after.version === before.version + Number(changed))
                    nextValue = {...classify(current.value), version: after.version, updatedAt: after.updatedAt};
                  else setConflict(after);
                } else if (current.scene.kind === "new") nextValue = classify(current.value);
                else if (current.scene.kind === "import") nextValue = {...current.value, drafts: current.value.drafts.map(classify)};
                setValue(nextValue);
                writeLocal(accountKey, current.localKey, nextValue);
              }
              const latestScene = editorRef.current.scene;
              const filters = {
                typeId: saved.types.some((t) => t.id === latestScene.typeId)
                  ? latestScene.typeId
                  : "",
                tagIds: (latestScene.tagIds ?? []).filter((id) =>
                  saved.tags.some((t) => t.id === id),
                ),
              };
              patchScene(filters);
              await refresh({ ...latestScene, ...filters });
            })
          }
        />
      )}</ModulePresence>
    </div>
  );
  const toolsRef = useRef(taxonomyTools);
  toolsRef.current = taxonomyTools;
  useEffect(() => {
    if (!registerTools) return;
    registerTools([
      {
        id: "questions-classification",
        label: "分类与标签",
        render: () => toolsRef.current,
      },
    ]);
    return () => registerTools([]);
  }, [
    registerTools,
    taxonomy,
    manage,
    busy,
    scene.typeId,
    JSON.stringify(scene.tagIds),
    items,
  ]);
  return (
    <div ref={pageNode} className="wb-module q-workspace" data-review={scene.kind === "import"}
      style={{"--q-ratio": scene.compare ? (scene.compareWidth ?? 0.5) : (scene.listWidth ?? 0.32)}}
      data-compare={Boolean(scene.compare && value?.source?.kind === "copy")}>
      {scene.kind !== "import" && <ResizeDivider
        value={scene.compare ? (scene.compareWidth ?? 0.5) : (scene.listWidth ?? 0.32)}
        label={scene.compare ? "调整原题对照宽度" : "调整题目列表宽度"}
        onChange={width => patchScene(scene.compare ? {compareWidth: width} : {listWidth: width})} />}
      <aside className="q-finder" inert={scene.compare && value?.source?.kind === "copy" ? true : undefined} aria-hidden={scene.compare && value?.source?.kind === "copy" ? true : undefined}>
        <header className="q-finder-heading">
          <h1 tabIndex={-1}><span className="q-heading-icon"><QuestionIcon name="book" size={24} /></span>{archived ? '归档内容' : '题库'}<span className="q-list-count">{archived ? items.length + imports.length : items.length}</span></h1>
          <Popover label="题库选项">
            {({ close }) => <div className="q-question-menu">
              <button role="menuitem" onClick={() => { setManage(true); onOpenTools?.(); close(); }}>管理题型与标签</button>
              <button role="menuitem" onClick={() => { returnToLibrary(archived ? 'active' : 'deleted', true); close(); }}>{archived ? '返回题库' : '归档内容'}</button>
              {!archived && <button role="menuitem" onClick={() => { patchScene({ selecting: !scene.selecting, selectedIds: [] }); close(); }}>{scene.selecting ? '退出多选' : '选择多道题目'}</button>}
            </div>}
          </Popover>
        </header>
        {archived ? <button className="q-text-button q-back" onClick={() => returnToLibrary('active', true)}><QuestionIcon name="back" />返回题库</button> : <div className="q-entry-actions">
          <button className="primary" onClick={startCapture}><QuestionIcon name="upload" />从资料收录</button>
          <button onClick={() => open('new', null)}><QuestionIcon name="edit" />手动录题</button>
        </div>}
        {!archived && meaningful(readLocal(accountKey, newDraftKey)) && scene.kind !== 'new' && <button className="q-draft-entry" onClick={() => open('new', null, readLocal(accountKey, newDraftKey)?.source?.kind === 'copy')}><QuestionIcon name="edit" /><span>继续未完成的题目</span><QuestionIcon name="chevron" size={14} /></button>}
        <div className="q-search-row">
          <div className="q-search"><QuestionIcon name="search" size={17} /><input aria-label="搜索题目" placeholder={scene.searchAnswers ? '搜索题目、答案或笔记' : '搜索题干、公式或笔记'} value={scene.q ?? ''} onChange={e => patchScene({ q: e.target.value })} /></div>
          <button className={`q-icon-button${scene.filtersOpen || hasFilters ? ' is-active' : ''}`} aria-label="筛选题目" title="筛选题目" aria-expanded={Boolean(scene.filtersOpen)} onClick={() => patchScene({ filtersOpen: !scene.filtersOpen })}><QuestionIcon name="filter" /></button>
        </div>
        <ModulePresence present={Boolean(scene.filtersOpen)} mode="collapse">
          <div className="q-filters">
            <label>题型<select aria-label="筛选题型" value={scene.typeId ?? ''} onChange={e => patchScene({ typeId: e.target.value })}><option value="">全部题型</option>{taxonomy.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="q-checkbox"><input type="checkbox" checked={scene.starred} onChange={e => patchScene({ starred: e.target.checked })} />只看已标记</label>
            <label className="q-checkbox"><input type="checkbox" checked={Boolean(scene.searchAnswers)} onChange={e => patchScene({ searchAnswers: e.target.checked })} />同时搜索答案与解析</label>
            {taxonomy.tags.length > 0 && <div className="q-filter-tags"><span>标签</span>{taxonomy.tags.map(tag => <label key={tag.id} className="q-checkbox"><input type="checkbox" checked={scene.tagIds?.includes(tag.id) ?? false} onChange={e => patchScene({ tagIds: e.target.checked ? [...(scene.tagIds ?? []), tag.id] : scene.tagIds.filter(id => id !== tag.id) })} />{tag.name}</label>)}</div>}
          </div>
        </ModulePresence>
        {hasFilters && <div className="q-filter-summary"><span>筛选结果 · {items.length} 题</span><button className="q-text-button" onClick={() => patchScene({ q: '', typeId: '', tagIds: [], starred: false, searchAnswers: false })}>清除条件</button></div>}
        {!registerTools && taxonomyTools}
        <div
          className="q-list"
          ref={(el) => {
            if (el && !el.dataset.restored) {
              el.scrollTop = scene.listScroll ?? 0;
              el.dataset.restored = "1";
            }
          }}
          onScroll={(e) =>
            patchScene({ listScroll: e.currentTarget.scrollTop })
          }
        >
          {imports.length > 0 && <details className="q-imports" open>
            <summary>{archived ? '归档材料' : '继续收录'} · {imports.length} 份材料</summary>
            {imports.map((m) => (
              <button
                className={scene.id === m.id ? "selected" : ""}
                key={m.id}
                onClick={() => open("import", m.id)}
              >
                <strong>{m.title}</strong>
                <small>
                  {m.drafts.filter((d) => d.disposition === "confirmed").length}{" "}
                  已入库 ·{" "}
                  {m.drafts.filter((d) => d.disposition === "pending").length}{" "}
                  待校对
                </small>
              </button>
            ))}
          </details>}
          {listState === 'loading' ? <p className="q-list-empty" role="status">正在读取题库…</p> : listState === 'error' ? <div className="q-list-empty"><p>题库暂时无法读取</p><button onClick={() => action(refresh)}>重新加载</button></div> : items.length === 0 && <p className="q-list-empty">{hasFilters ? '没有符合条件的题目，试试调整筛选。' : archived ? '没有归档的题目。' : imports.length ? '材料确认入库后，题目会出现在这里。' : '收录第一道题，开始积累。'}</p>}
          {items.map((q) => (
            <div className="q-list-entry" key={q.id}>
            {onAddToLesson && scene.selecting && !q.deletedAt && <input type="checkbox"
              aria-label={`选择题目：${q.title || "未命名题目"}`}
              checked={(scene.selectedIds ?? []).includes(q.id)}
              onChange={(event) => patchScene({selectedIds: event.target.checked
                ? [...(scene.selectedIds ?? []), q.id]
                : (scene.selectedIds ?? []).filter(id => id !== q.id)})} />}
            <button
              className={scene.id === q.id ? "selected" : ""}
              key={q.id}
              onClick={() => open("question", q.id)}
            >
              <strong>
                {q.starred ? "★ " : ""}
                {q.title || sourceText(q.body).slice(0, 36) || "未命名题目"}
              </strong>
              <div className="q-excerpt"><DocumentView value={{version: q.body.version,
                blocks: q.body.blocks.filter(block => block.type !== "image").slice(0, 1)}} /></div>
              {documentAssets(q.body).figures[0] && <DocumentView value={{version: 2, blocks: [documentAssets(q.body).figures[0]]}} />}
            </button>
            </div>
          ))}
        </div>
        {onAddToLesson && Boolean(scene.selectedIds?.length) && <div className="q-tools">
          <button disabled={busy} onClick={() => action(async () => {
            for (const id of scene.selectedIds) {
              if (readLocal(accountKey, `questions-materials-draft:question:${id}`))
                throw Error("所选题目有未保存修改，请先打开并保存，再加入备课。");
            }
            const selected = await Promise.all(scene.selectedIds.map(id => get("/items/" + id)));
            if (selected.some(q => q.deletedAt)) throw Error("所选题目中有已归档题目，请取消选择后重试。");
            onAddToLesson(selected);
          })}>加入备课（{scene.selectedIds.length} 题）</button>
          <button onClick={() => patchScene({selectedIds: [], selecting: false})}>取消选择</button>
        </div>}
      </aside>
      <ModulePresence present={Boolean(scene.compare && value?.source?.kind === "copy")} className="q-compare-presence">
      {scene.compare && value?.source?.kind === "copy" && <section className="q-copy-source" aria-label="原题对照">
        <header><strong>改编前的原题</strong>
          <button onClick={() => patchScene({compare: false})}>结束对照</button></header>
        <h3>{value.source.snapshot.title || "原题"}</h3>
        <DocumentView value={value.source.snapshot.body} />
        {value.source.snapshot.solution?.blocks?.length > 0 && <details open><summary>答案解析</summary><DocumentView value={value.source.snapshot.solution} /></details>}
        <button onClick={() => open("question", value.source.questionId)}>查看当前原题</button>
      </section>}
      </ModulePresence>
      <main className="q-main">
        <div className="q-message" role="status">
          {message}
          {pending.current && (
            <button
              onClick={() =>
                action(async () => {
                  const r = pending.current;
                  const result = await mutate(r.path, r.input, r.method);
                  const lifecycle = acceptLifecycleResult(r, result);
                  const question = acceptRecoveredQuestion(r, result);
                  if (!lifecycle) setMessage(question ? '题目已保存，之后补充的修改仍保留在草稿中。' : '原请求已确认，请重新打开查看');
                  await refresh();
                })
              }
            >
              确认上次请求
            </button>
          )}
        </div>
        {conflict && (
          <section aria-label="版本冲突对照">
            <p>服务器已有更新。本地修改仍保留，请核对后选择。</p>
            <details>
              <summary>服务器当前内容</summary>
              {(conflict.drafts ?? [conflict]).map((item) => (
                <article key={item.id}>
                  <strong>{item.title || "未命名题目"}</strong>
                  <DocumentView value={item.body} />
                  <DocumentView value={item.solution} />
                </article>
              ))}
            </details>
            <button
              onClick={() => {
                change(conflict);
                setConflict(null);
                setMessage("已采用服务器版本");
              }}
            >
              采用服务器版本
            </button>
            <button
              onClick={() => {
                if (scene.kind === "import") {
                  const local = new Map(value.drafts.map((d) => [d.id, d]));
                  change({
                    ...conflict,
                    drafts: conflict.drafts.map((d) =>
                      d.disposition === "confirmed"
                        ? d
                        : (local.get(d.id) ?? d),
                    ),
                    fragments: conflict.fragments.map(
                      (f) => value.fragments.find((x) => x.id === f.id) ?? f,
                    ),
                  });
                } else change({ ...conflict, ...editableFields(value) });
                setConflict(null);
                setMessage("已保留本地修改，请核对后再次保存");
              }}
            >
              保留本地修改并继续校对
            </button>
          </section>
        )}
        {!value ? (
          scene.kind === 'list' ? archived ? <div className="q-welcome"><span className="q-welcome-icon"><QuestionIcon name="book" size={32} /></span><h2>{items.length || imports.length ? '选择一份归档内容' : '暂无归档内容'}</h2><p>归档的题目和材料可以恢复，也可以彻底删除。</p></div> : <QuestionWelcome hasItems={items.length > 0} onCapture={startCapture} onCreate={() => open('new', null)} /> : <div className="q-empty" role="status">{loadError || '正在打开…'}{loadError && <button onClick={() => returnToLibrary()}>返回题库</button>}</div>
        ) : scene.kind === "import" ? (
          <>
            <header className="q-review-heading">
              <div className="q-review-title"><button className="q-text-button q-back" onClick={() => returnToLibrary()}><QuestionIcon name="back" />{archived ? '返回归档内容' : '返回题库'}</button><h2>{value.title}</h2><span className="q-muted">{value.deletedAt ? '已归档' : job?.state === 'succeeded' && value.drafts.length && value.drafts.every(d => d.disposition !== 'pending') ? '全部检查完成' : stateNames[job?.state]}</span></div>
              <div className="q-review-progress"><span><QuestionIcon name="check" size={15} />原稿已保存</span><span>{value.drafts.filter(d => d.disposition === 'confirmed').length} 题已入库</span><span>{value.drafts.filter(d => d.disposition === 'pending').length} 题待检查</span></div>
              <div className="q-tools">
                {!value.deletedAt && <button
                  disabled={busy || Boolean(value.deletedAt) || active.has(job?.state)}
                  onClick={() => action(save)}
                >
                  保存检查进度
                </button>}
                {active.has(job?.state) ? (
                  <button
                    onClick={() =>
                      action(async () =>
                        setJob(
                          await mutate(
                            "/api/workbench/jobs/" + job.id + "/cancel",
                            {},
                          ),
                        ),
                      )
                    }
                  >
                    停止整理
                  </button>
                ) : !value.deletedAt && ['partial', 'failed', 'interrupted', 'cancelled'].includes(job?.state) && (
                  <button
                    onClick={() =>
                      action(async () => {
                        await save();
                        const next = await mutate(
                          "/api/workbench/jobs/" + job.id + "/retry",
                          { unitIds: [] },
                        );
                        setJob(next);
                      })
                    }
                  >
                    重试未完成部分
                  </button>
                )}
                <Popover label="材料操作">{({ close }) => <div className="q-question-menu" onClick={event => { if (event.target.closest('button:not(:disabled)')) close(); }}>
                <button
                  disabled={busy || Boolean(value.deletedAt) || active.has(job?.state)}
                  onClick={() => picker.current.click()}
                >
                  补充照片
                </button>
                <button
                  disabled={
                    busy || active.has(job?.state) || Boolean(value.deletedAt)
                  }
                  onClick={() =>
                    action(async () => {
                      let location;
                      if (value.input.kind === "text")
                        location = {
                          kind: "text",
                          start: 0,
                          end: [...value.input.text].length,
                        };
                      else {
                        const id = value.input.fileIds[0],
                          preview = await get(
                            "/api/workbench/files/" + id + "/preview",
                          );
                        if (!preview.renditionFileId)
                          throw Error("请先生成原稿预览");
                        location = {
                          kind: "page",
                          fileId: id,
                          renditionFileId: preview.renditionFileId,
                          page: scene.original?.page ?? 1,
                          box: null,
                        };
                      }
                      const d = {
                        id: crypto.randomUUID(),
                        title: "补充题目",
                        body: empty(),
                        solution: empty(),
                        answerStatus: "absent",
                        typeId: null,
                        tagIds: [],
                        parts: [{ role: "body", locations: [location] }],
                        issues: [],
                        disposition: "pending",
                        questionId: null,
                      };
                      change({ ...value, drafts: [...value.drafts, d] });
                      setSelected(d.id);
                      patchScene({ draftId: d.id });
                    })
                  }
                >
                  补充题目草稿
                </button>
                <button
                  disabled={busy || active.has(job?.state)}
                  onClick={() => requestLifecycle(value.deletedAt ? 'restore' : 'archive')}
                >
                  {value.deletedAt ? "恢复材料" : "归档材料"}
                </button>
                {value.deletedAt && <button className="q-danger" disabled={busy || active.has(job?.state)} onClick={() => requestLifecycle('purge')}>彻底删除材料</button>}
                </div>}</Popover>
                <input
                  ref={picker}
                  hidden
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = [...e.target.files];
                    action(async () => {
                      const saved = await save();
                      const uploaded = [];
                      for (const f of files) uploaded.push(await uploadFile(f));
                      const next = await mutate(
                        "/imports/" + value.id + "/supplements",
                        {
                          baseVersion: saved.version,
                          fileIds: uploaded.map((x) => x.id),
                        },
                      );
                      setValue(next);
                      setJob(await get("/api/workbench/jobs/" + next.jobId));
                    });
                  }}
                />
              </div>
            </header>
            {job?.issues.map((i, n) => (
              <p className="q-error" key={n}>
                {i.detail}
              </p>
            ))}
            <div className="q-review-switch q-tools">
              <button onClick={() => patchScene({ reviewTab: "original" })}>
                原稿
              </button>
              <button onClick={() => patchScene({ reviewTab: "result" })}>
                校对结果
              </button>
            </div>
            <div className="q-review" data-tab={scene.reviewTab ?? "result"}
              style={{"--q-ratio": scene.reviewWidth ?? 0.5}}>
              <ResizeDivider value={scene.reviewWidth ?? 0.5} label="调整原稿对照宽度"
                onChange={reviewWidth => patchScene({reviewWidth})} />
              <OriginalPane
                readOnly={locked}
                material={value}
                draft={draft}
                scene={scene.original ?? {}}
                onScene={(p) =>
                  patchScene({ original: { ...scene.original, ...p } })
                }
                onLocation={(l, role) =>
                  editDraft({
                    parts: [
                      ...(draft.parts ?? [])
                        .map((p) =>
                          p.role !== role
                            ? p
                            : {
                                ...p,
                                locations: p.locations.filter(
                                  (old) =>
                                    !(
                                      old.kind === "page" &&
                                      old.fileId === l.fileId &&
                                      old.page === l.page
                                    ),
                                ),
                              },
                        )
                        .filter((p) => p.locations.length),
                      { role, locations: [l] },
                    ],
                  })
                }
                onCrop={(l) =>
                  action(async () => {
                    const file = await mutate("/api/workbench/files/crops", {
                      location: l,
                    });
                    editDraft({
                      body: {
                        version: 2,
                        blocks: [
                          ...draft.body.blocks,
                          {
                            type: "image",
                            fileId: (file.file ?? file).id,
                            alt: "原稿裁图",
                            widthMm: 100,
                          },
                        ],
                      },
                      parts: [
                        ...draft.parts,
                        { role: "figure", locations: [l] },
                      ],
                    });
                  })
                }
              />
              <section {...reviewScroll} className="q-review-result">
                <nav className="q-review-tabs" aria-label="选择待检查题目">
                  {value.drafts.map((d, i) => (
                    <button
                      className={selected === d.id ? "selected" : ""}
                      key={d.id}
                      onClick={() => {
                        setSelected(d.id);
                        patchScene({ draftId: d.id, original: {}, reviewEditing: false });
                      }}
                    >
                      {i + 1}{" "}
                      {d.disposition === "confirmed"
                        ? "已入库"
                        : d.disposition === "ignored"
                          ? "已忽略"
                          : "待检查"}
                    </button>
                  ))}
                </nav>
                {draft ? (
                  <fieldset disabled={locked} className="q-review-fields">
                    <div className="q-review-current"><h3>第 {value.drafts.indexOf(draft) + 1} 题 <span className="q-muted">共 {value.drafts.length} 题</span></h3>{draft.disposition !== 'confirmed' && <button className="q-text-button" onClick={() => patchScene({ reviewEditing: !scene.reviewEditing })}><QuestionIcon name={scene.reviewEditing ? 'check' : 'edit'} size={16} />{scene.reviewEditing ? '完成修改' : '修改题目'}</button>}</div>
                    {scene.reviewEditing ? <>
                      <label className="q-title-field">题目名称<input aria-label="草稿标题" value={draft.title} onChange={e => editDraft({ title: e.target.value })} /></label>
                      <QuestionDocumentEditor value={draft.body} onChange={body => editDraft({ body })} onPickImage={pickImage} readOnly={locked} />
                    </> : <article className="q-reading-body" aria-label="待检查题干"><DocumentView value={draft.body} /></article>}
                    {draft.answerStatus !== 'absent' && (scene.reviewEditing ? <QuestionDocumentEditor label="答案与解析" value={draft.solution} onChange={solution => editDraft({ solution })} onPickImage={pickImage} readOnly={locked} /> : <section className="q-review-answer"><h4>答案与解析</h4><DocumentView value={draft.solution} /></section>)}
                    {draft.answerStatus === 'absent' && !scene.reviewEditing && <p className="q-muted">原稿中未提供答案</p>}
                    {(scene.reviewEditing || draft.answerStatus === 'unresolved') && <label className="q-answer-state">答案是否完整<select aria-label="答案状态" value={draft.answerStatus} onChange={e => editDraft({ answerStatus: e.target.value })}><option value="absent">未提供答案</option><option value="present">已有完整答案</option><option value="unresolved">答案待核对</option></select></label>}
                    {draft.issues.length > 0 && <section className="q-review-checks" aria-label="需要检查的内容"><h4>{draft.issues.some(i => i.resolution === 'open') ? '请对照原稿检查' : '检查已完成'}</h4>
                    {draft.issues.map((issue) => (
                      <label className="q-issue" key={issue.id} data-issue-id={issue.id} data-resolved={issue.resolution !== 'open'}>
                        <span>{({
                          'split-boundary': '题干是否完整，是否混入了其他题目？',
                          'uncertain-formula': '请检查并修正这道题的公式。',
                          'missing-figure': '请补上原稿中的配图。',
                          'unverified-location': '请确认这道题在原稿中的位置。',
                          'incomplete-answer': '答案可能不完整，请对照原稿补充。',
                          'uncertain-text': '这些文字是否与原稿一致？',
                          'truncated-input': '内容可能被截断，请补全题目。',
                        })[issue.code] || issue.detail || '请核对这处内容。'}</span>
                        <select
                          value={issue.resolution}
                          onChange={(e) =>
                            editDraft({
                              issues: draft.issues.map((x) =>
                                x.id === issue.id
                                  ? { ...x, resolution: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="open">待校对</option>
                          <option value="corrected">已修正</option>
                          {![
                            "uncertain-formula",
                            "missing-figure",
                            "unverified-location",
                            "incomplete-answer",
                          ].includes(issue.code) && (
                            <option value="acknowledged">已核对</option>
                          )}
                        </select>
                      </label>
                    ))}</section>}
                    <ModuleDisclosure title="题型与标签">{classification(draft, editDraft)}</ModuleDisclosure>
                    {draft.disposition !== 'confirmed' && <ModuleDisclosure title="调整题目：拆分、合并或忽略" className="q-adjust-question">
                    <p className="q-muted">同一段有两题时，先修改题目，在分界处换行，再拆分。原稿始终保留。</p>
                    <div className="q-tools">
                      <label>
                        在第{" "}
                        <input
                          aria-label="拆分段落"
                          type="number"
                          min="1"
                          max={Math.max(1, splitParagraphCount - 1)}
                          disabled={splitParagraphCount < 2}
                          value={splitAt}
                          onChange={(e) => setSplitAt(Number(e.target.value))}
                        />{" "}
                        段后
                      </label>
                      <button
                        disabled={splitParagraphCount < 2}
                        onClick={() => {
                          const pair = splitReviewDraft(draft, splitAt);
                          if (!pair) return;
                          change({
                            ...value,
                            drafts: value.drafts.flatMap((d) =>
                              d.id === selected ? pair : [d],
                            ),
                          });
                          setMessage(draft.answerStatus === 'absent' ? '已拆成两题，请分别检查题干。' : '已拆成两题，原有答案保留在第一题，请分别核对答案。');
                        }}
                      >
                        拆分
                      </button>
                      <select
                        aria-label="合并目标"
                        value={mergeId}
                        onChange={(e) => setMergeId(e.target.value)}
                      >
                        <option value="">选择后接草稿</option>
                        {value.drafts
                          .filter(
                            (x) =>
                              x.id !== draft.id && x.disposition === "pending",
                          )
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.title}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={!mergeId}
                        onClick={() => {
                          const other = value.drafts.find(
                            (x) => x.id === mergeId,
                          );
                          if (!other) return;
                          change({
                            ...value,
                            drafts: value.drafts
                              .filter((x) => x.id !== mergeId)
                              .map((x) =>
                                x.id === selected
                                  ? {
                                      ...x,
                                      body: {
                                        version: 2,
                                        blocks: [
                                          ...x.body.blocks,
                                          ...other.body.blocks,
                                        ],
                                      },
                                      solution: {
                                        version: 2,
                                        blocks: [
                                          ...x.solution.blocks,
                                          ...other.solution.blocks,
                                        ],
                                      },
                                      answerStatus: [
                                        x.answerStatus,
                                        other.answerStatus,
                                      ].includes("unresolved")
                                        ? "unresolved"
                                        : [
                                              x.answerStatus,
                                              other.answerStatus,
                                            ].includes("present")
                                          ? "present"
                                          : "absent",
                                      parts: [...x.parts, ...other.parts],
                                      issues: [...x.issues, ...other.issues],
                                    }
                                  : x,
                              ),
                          });
                          setMergeId("");
                        }}
                      >
                        合并
                      </button>
                      <button
                        onClick={() =>
                          editDraft({
                            disposition:
                              draft.disposition === "ignored"
                                ? "pending"
                                : "ignored",
                          })
                        }
                      >
                        {draft.disposition === "ignored" ? "恢复草稿" : "忽略"}
                      </button>
                    </div>
                    </ModuleDisclosure>}
                  </fieldset>
                ) : (
                  <p>原稿保留在左侧。处理完成后，题目草稿会出现在这里。</p>
                )}
                {value.fragments.length > 0 && (
                  <details>
                    <summary>未分配片段 · {value.fragments.length}</summary>
                    {value.fragments.map((f) => (
                      <div key={f.id}>
                        <pre>{f.text}</pre>
                        <select
                          aria-label="片段处理"
                          value={f.disposition}
                          onChange={(e) =>
                            change({
                              ...value,
                              fragments: value.fragments.map((x) =>
                                x.id === f.id
                                  ? { ...x, disposition: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="unassigned">待处理</option>
                          <option value="ignored">忽略</option>
                        </select>
                        <button
                          disabled={!draft || locked}
                          onClick={() => {
                            const block = {
                              type: "paragraph",
                              runs: [{ type: "text", text: f.text }],
                            };
                            change({
                              ...value,
                              drafts: value.drafts.map((x) =>
                                x.id === selected
                                  ? {
                                      ...x,
                                      body: {
                                        version: 2,
                                        blocks: [...x.body.blocks, block],
                                      },
                                    }
                                  : x,
                              ),
                              fragments: value.fragments.map((x) =>
                                x.id === f.id
                                  ? { ...x, disposition: "assigned" }
                                  : x,
                              ),
                            });
                          }}
                        >
                          归入题干
                        </button>
                      </div>
                    ))}
                  </details>
                )}
                {draft && <footer className="q-review-footer">
                  {draft.questionId ? <><span className="q-saved-label"><QuestionIcon name="check" />这道题已入库</span><button onClick={() => open('question', draft.questionId)}>查看题目</button>{value.drafts.some(d => d.disposition === 'pending') && <button className="primary" onClick={() => { const next = value.drafts.find(d => d.disposition === 'pending'); setSelected(next.id); patchScene({ draftId: next.id, original: {}, reviewEditing: false }); }}>检查下一题<QuestionIcon name="chevron" size={15} /></button>}</> : <><span className="q-muted">{draft.issues.filter(i => i.resolution === 'open').length ? `还有 ${draft.issues.filter(i => i.resolution === 'open').length} 项需要检查` : draft.disposition === 'ignored' ? '这道题已忽略，可在调整题目中恢复' : '确认后，这道题会加入题库'}</span><button className="primary" disabled={locked || draft.disposition === 'ignored'} onClick={confirmDraft}><QuestionIcon name="check" />确认这道题</button></>}
                </footer>}
              </section>
            </div>
          </>
        ) : (
          <section className="q-question" ref={questionScroll.ref} onScroll={questionScroll.onScroll}>
            {onReturnToRecord && <button onClick={onReturnToRecord}>返回教学记录</button>}
            <header className="q-question-heading">
              {editing ? <>
                <button className="q-text-button q-back" disabled={busy} onClick={() => action(leaveEditor)}><QuestionIcon name="back" />{scene.kind === 'new' ? '返回题库' : '返回题目'}</button>
                <span className="q-save-state">{busy ? '正在保存…' : readLocal(accountKey, localKey) ? '草稿保存在此设备' : scene.kind === 'new' ? '尚未保存' : '已保存'}</span>
                <button className="primary" disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={() => action(async () => { await saveQuestion(); patchScene({ editing: false }); })}><QuestionIcon name="check" />保存题目</button>
              </> : <>
                <div className="q-question-title"><span className="q-eyebrow">{value.deletedAt ? '已归档' : value.source?.kind === 'copy' ? '改编题目' : '我的题目'}</span><h2>{value.title || '未命名题目'}{value.starred && <QuestionIcon name="star" size={18} />}</h2></div>
                <Popover label="更多题目操作">{({ close }) => <div className="q-question-menu"><button role="menuitem" disabled={busy || unsupportedQuestion} onClick={() => { requestLifecycle(value.deletedAt ? 'restore' : 'archive'); close(); }}>{value.deletedAt ? '恢复题目' : '归档题目'}</button>{value.deletedAt && <button className="q-danger" role="menuitem" disabled={busy} onClick={() => { requestLifecycle('purge'); close(); }}>彻底删除题目</button>}</div>}</Popover>
              </>}
            </header>
            {unsupportedQuestion && <p className="q-error" role="status">这道题包含当前无法编辑的内容，已保留原数据，可以继续阅读。</p>}
            {!editing && <div className="q-reader-actions">{value.deletedAt ? <button className="primary" disabled={busy || unsupportedQuestion} onClick={() => requestLifecycle('restore')}>恢复题目</button> : <>
              <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={beginEdit}><QuestionIcon name="edit" />编辑题目</button>
              <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={copyQuestion} title="保留原题，另存一道改编题"><QuestionIcon name="copy" />复制改编</button>
              {onAddToLesson && <button className="primary" disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} data-return-focus="add-to-lesson" onClick={() => onAddToLesson([value])}><QuestionIcon name="plus" />加入备课</button>}
            </>}</div>}
            {!editing && readLocal(accountKey, localKey) && <div className="q-draft-notice"><span>{value.deletedAt ? '未保存的修改仍保存在此设备，恢复题目后可继续编辑。' : '这道题有未保存的修改，当前显示已保存内容。'}</span>{!value.deletedAt && <button onClick={beginEdit}>继续编辑</button>}<button className="q-text-button" onClick={() => setConfirmDiscard(true)}>放弃草稿</button></div>}
            {editing ? <fieldset className="q-edit-fields" disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}>
              <label className="q-title-field">题目名称 <span className="q-muted">选填，方便以后查找</span><input className="q-title-input" aria-label="题目标题" placeholder="例如：二次函数的最值" value={value.title} maxLength={200} onChange={e => change({ ...value, title: e.target.value })} /></label>
              <QuestionDocumentEditor key={scene.kind + (value.id ?? 'new')} value={value.body} onChange={body => change({ ...value, body })} onPickImage={pickImage} autoFocus />
              {value.answerStatus === 'present' || !supportedDocument(value.solution) ? <QuestionDocumentEditor label="答案与解析" value={value.solution} onChange={solution => change({ ...value, solution })} onPickImage={pickImage} /> : <button className="q-add-field" onClick={() => change({ ...value, answerStatus: 'present' })}><QuestionIcon name="plus" />添加答案与解析</button>}
              <ModuleDisclosure title="题型、标签与笔记" open={Boolean(scene.notesOpen)} onOpenChange={notesOpen => patchScene({ notesOpen })} className="q-question-notes">
                {classification(value, patch => change({ ...value, ...patch }))}
                <label className="q-note-field">教学笔记<textarea aria-label="长期笔记" placeholder="记下讲解思路、易错点，方便下次使用。" value={value.note} onChange={e => change({ ...value, note: e.target.value })} /></label>
                <label className="q-checkbox"><input type="checkbox" checked={value.starred} onChange={e => change({ ...value, starred: e.target.checked })} />标记题目，方便以后查找</label>
              </ModuleDisclosure>
              {onAddToLesson && <button className="q-text-button" disabled={busy} data-return-focus="add-to-lesson" onClick={() => action(async () => onAddToLesson([await saveQuestion()]))}>保存并加入备课</button>}
              {readLocal(accountKey, localKey) && <button className="q-text-button q-discard" onClick={() => setConfirmDiscard(true)}>放弃未保存的修改</button>}
            </fieldset> : <>
              <div className="q-question-meta">{taxonomy.types.filter(t => t.id === value.typeId).map(t => <span className="q-type" key={t.id}>{t.name}</span>)}{taxonomy.tags.filter(t => value.tagIds.includes(t.id)).map(t => <span className="q-tag" key={t.id}><QuestionIcon name="tag" size={12} />{t.name}</span>)}</div>
              <article className="q-reading-body" aria-label="题干"><DocumentView value={value.body} /></article>
              {value.answerStatus === 'present' ? <ModuleDisclosure title="答案与解析" open={Boolean(scene.answerOpen)} onOpenChange={answerOpen => patchScene({ answerOpen })} className="q-answer"><DocumentView value={value.solution} /></ModuleDisclosure> : <p className="q-missing-answer">暂未添加答案 <button className="q-text-button" disabled={Boolean(value.deletedAt) || unsupportedQuestion} onClick={() => { beginEdit(true); patchScene({ answerOpen: true }); }}>添加答案</button></p>}
              {value.note && <ModuleDisclosure title="教学笔记" className="q-reader-note"><p>{value.note}</p></ModuleDisclosure>}
            </>}
            {value.source?.kind === "import" && (sourceMissing ? <p className="q-muted">原始材料已彻底删除，题目内容仍保留。</p> :
              <button disabled={busy} onClick={() => action(openSource)}>
                对照原稿
              </button>
            )}
            {value.source?.kind === "copy" && !scene.compare && (
              <>
                <button onClick={() => patchScene({compare: true})}>
                  对照原题
                </button>
                {sourceMissing ? <p className="q-muted">原题已彻底删除，可以继续查看采用时的原题。</p> : <button disabled={busy} onClick={() => action(openSource)}>
                  查看原题
                </button>}
                <details>
                  <summary>采用时的原题</summary>
                  <DocumentView value={value.source.snapshot.body} />
                  <DocumentView value={value.source.snapshot.solution} />
                </details>
              </>
            )}
            {copies.map((q) => (
              <button key={q.id} onClick={() => open("question", q.id)}>
                改编题：{q.title || "未命名"}
              </button>
            ))}
            {value.id && <ModuleDisclosure title="使用位置" open={Boolean(scene.usagesOpen)} onOpenChange={usagesOpen => patchScene({ usagesOpen })}>
              {usages === null ? (
                <p>使用位置尚未接入</p>
              ) : (
                usages.length ? usages.map((u) => (
                  <p key={u.referenceId}>
                    <a className="q-usage-link" data-return-focus={`usage-${u.referenceId}`} href={`/lessons/${u.lessonId}`} onClick={(event) => {
                      if (!onOpenLesson || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onOpenLesson(u.lessonId, u.referenceId, `usage-${u.referenceId}`);
                    }}>
                      {u.lessonTitle ?? u.title} {u.sectionTitle ?? "本课材料"}
                    </a>
                  </p>
                )) : <p className="q-muted">还没有加入备课。</p>
              )}
            </ModuleDisclosure>}
            {value.id && renderTeachingFeedback && (
              <ModuleDisclosure title="教学反馈" open={Boolean(scene.teachingOpen)} onOpenChange={teachingOpen => patchScene({ teachingOpen })}>
                {renderTeachingFeedback(value.id)}
              </ModuleDisclosure>
            )}
            {value.id && (
              <ModuleDisclosure title="复制文字或下载图片" className="q-export">
                <p className="q-muted">把题目放进你自己的课件。图片采用透明背景，可直接插入 PPT。</p>
                <label>
                  <input
                    type="checkbox"
                    checked={includeAnswers}
                    onChange={(e) => setIncludeAnswers(e.target.checked)}
                  />
                  包含答案（单独分片）
                </label>
                <div className="q-tools">
                  <button onClick={() => setSource(sourceText(value.body))}>
                    复制文字与公式源
                  </button>
                  <button
                    disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                    onClick={() =>
                      action(async () => {
                        const current = editing && readLocal(accountKey, localKey) ? await save() : value;
                        const j = await mutate(
                          "/items/" + value.id + "/assets",
                          {
                            baseVersion: current.version,
                            mode: "question-png",
                            figureFileId: null,
                            includeAnswers,
                          },
                        );
                        setAssets(j);
                        writeLocal(
                          accountKey,
                          "question-asset:" + value.id,
                          j.id,
                        );
                      })
                    }
                  >
                    {editing && readLocal(accountKey, localKey) ? '保存并生成题面图片' : '生成题面图片'}
                  </button>
                  {assets && <button
                    disabled={busy}
                    onClick={() =>
                      action(async () =>
                        setAssets(
                          await get("/api/workbench/jobs/" + assets.id),
                        ),
                      )
                    }
                  >
                    刷新生成结果
                  </button>}
                </div>
                <div className="q-tools">
                  {documentAssets(value.body).figures.map((figure, i) => (
                    <button
                      key={i}
                      disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                      onClick={() =>
                        action(async () => {
                          const current = editing && readLocal(accountKey, localKey) ? await save() : value;
                          const job = await mutate(
                            "/items/" + value.id + "/assets",
                            {
                              baseVersion: current.version,
                              mode: "figure-png",
                              figureFileId: figure.fileId,
                              includeAnswers: false,
                            },
                          );
                          setAssets(job);
                          writeLocal(
                            accountKey,
                            "question-asset:" + value.id,
                            job.id,
                          );
                        })
                      }
                    >
                      {editing && readLocal(accountKey, localKey) ? '保存并生成配图' : '生成配图'} {i + 1}
                    </button>
                  ))}
                  {documentAssets(value.body).formulas.map((formula, i) => (
                    <button key={i} onClick={() => setSource(formula)}>
                      公式 {i + 1} 源
                    </button>
                  ))}
                </div>
                {source !== null && (
                  <textarea
                    aria-label="可复制文字公式源"
                    readOnly
                    value={source}
                    onFocus={(e) => e.target.select()}
                  />
                )}{" "}
                {assets && (
                  <p>
                    {assets.state === "succeeded"
                      ? "素材已生成"
                      : active.has(assets.state)
                        ? "正在生成素材"
                        : "生成未完成，可重新生成"}
                  </p>
                )}
                {assets?.outputFileIds.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => download(id, `题面-${i + 1}.png`)}
                  >
                    下载分片 {i + 1}
                  </button>
                ))}
              </ModuleDisclosure>
            )}
          </section>
        )}
      </main>
      <ModulePresence present={Boolean(capture)}>
      {capture && (
        <QuestionDialog title="从资料收录题目" onClose={() => setCapture(null)} className="q-capture-dialog">
          <ol className="q-steps" aria-label="收录步骤"><li className="is-current"><span>1</span>选择材料</li><li><span>2</span>对照检查</li><li><span>3</span>确认入库</li></ol>
          {capture === '选择' ? <>
            <p className="q-capture-intro">题目现在在哪里？选择材料后，原稿会保留，整理出的题目由你确认后入库。</p>
            <div className="q-capture-options">{[
              ['PDF', 'file', '试卷、练习册等 PDF 文件'],
              ['Word', 'file', '已有的 Word 试题文档'],
              ['图片', 'image', '截图或拍照，可选择多张'],
              ['文字', 'text', '复制来的题干、答案或多道题'],
            ].map(([kind, icon, description]) => <button key={kind} onClick={() => setCapture(kind)}><span className="q-capture-icon"><QuestionIcon name={icon} size={24} /></span><strong>{kind === '文字' ? '粘贴文字' : kind === '图片' ? '上传图片' : '上传 ' + kind}</strong><span>{description}</span><QuestionIcon name="chevron" size={16} /></button>)}</div>
          </> : <>
            <button className="q-text-button q-back" onClick={() => setCapture('选择')}><QuestionIcon name="back" />更换材料类型</button>
            {capture === '文字' ? <label className="q-capture-text">粘贴题目与已有答案<textarea aria-label="原始文字" placeholder={'例如：\n1. 计算 1+1。\n答案：2\n\n可以一次粘贴多道题。'} value={text} onChange={e => setText(e.target.value)} /></label> : <>
              <label className="q-file-picker"><QuestionIcon name="upload" size={28} /><strong>选择{capture === '图片' ? '图片' : capture + ' 文件'}</strong><span>{capture === '图片' ? '支持 PNG、JPG、WebP，可一次选择多张' : capture === 'PDF' ? '选择一份 PDF，保留原稿供对照' : '支持 .docx 和 .doc'}</span><input type="file" aria-label="选择原稿" multiple={capture === '图片'} accept={capture === '图片' ? 'image/png,image/jpeg,image/webp' : capture === 'PDF' ? '.pdf' : '.doc,.docx'} onChange={e => setChosenFiles([...e.target.files])} /></label>
              {!chosenFiles.length && collection.fileNames?.length > 0 && <p className="q-muted">继续收录需要重新选择：{collection.fileNames.join('、')}</p>}
              {chosenFiles.length > 0 && <div className="q-chosen-files">{chosenFiles.map((file, i) => <div key={i}><QuestionIcon name="file" /><span>{file.name}</span>{chosenFiles.length > 1 && <button disabled={!i} onClick={() => setChosenFiles(files => { const next = [...files]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; })}>上移</button>}</div>)}</div>}
              <p className="q-muted">{capture === '图片' ? '原图会完整保留，识别结果需对照检查后再入库。' : capture === 'PDF' ? '可整理文字 PDF 和扫描件；公式、配图和复杂排版请对照原稿检查。' : '复杂排版和旧版 Word 的公式可能需要对照原稿修正。'}</p>
            </>}
            <ModuleDisclosure title="材料名称、出处与处理范围" className="q-capture-metadata">
              <label>材料名称 <span className="q-muted">选填</span><input value={title} placeholder="留空时使用文件名" onChange={e => setTitle(e.target.value)} /></label>
              <label>出处 <span className="q-muted">选填</span><input value={origin} placeholder="例如：教材页码、试卷名称" onChange={e => setOrigin(e.target.value)} /></label>
              {['PDF', 'Word'].includes(capture) && <label>仅处理这些页<input aria-label="处理页码" placeholder="留空处理全部，例如 2,3,4" value={pages} onChange={e => setPages(e.target.value)} /></label>}
            </ModuleDisclosure>
            <footer><span className="q-muted">先保存原稿，再整理题目供你检查。</span><button className="primary" disabled={busy || (capture === '文字' ? !text.trim() : !chosenFiles.length)} onClick={() => action(collect)}>{busy ? '正在保存原稿…' : '开始整理'}<QuestionIcon name="chevron" size={16} /></button></footer>
          </>}
          {message && <p className="q-error" role="alert">{message}</p>}
        </QuestionDialog>
      )}
      </ModulePresence>
      <ModulePresence present={confirmDiscard}>{confirmDiscard && <ConfirmDialog title="放弃未保存的修改？" message="此设备上的这份草稿将被删除，已经保存的题目不受影响。" confirmLabel="放弃修改" onCancel={() => setConfirmDiscard(false)} onConfirm={() => action(async () => { removeLocal(accountKey, localKey); setConfirmDiscard(false); await leaveEditor(); })} />}</ModulePresence>
      <ModulePresence present={Boolean(copyCandidate)}>{copyCandidate && <ConfirmDialog title="替换未完成的题目？" message="你还有一份未完成的新题草稿。开始这次改编会替换它，已保存的题目不受影响。" confirmLabel="替换并开始改编" onCancel={() => setCopyCandidate(null)} onConfirm={() => startCopy(copyCandidate)} />}</ModulePresence>
      <ModulePresence present={Boolean(lifecycleAction)}>{lifecycleAction && <QuestionDialog
        title={`${lifecycleAction.mode === 'purge' ? '彻底删除' : lifecycleAction.mode === 'restore' ? '恢复' : '归档'}${lifecycleAction.kind === 'import' ? '材料' : '题目'}？`}
        onClose={() => { if (!busy) setLifecycleAction(null); }} className="q-lifecycle-dialog">
        <p>{lifecycleAction.mode === 'purge'
          ? `“${lifecycleAction.item.title || '未命名题目'}”及其本地草稿将彻底删除，无法恢复。${lifecycleAction.kind === 'import' ? '已入库的题目会保留。' : '已有改编题和备课中的快照会保留。'}`
          : lifecycleAction.mode === 'restore' ? '恢复后，会重新出现在题库中。' : '将移出当前列表，并返回题库。你可以在“题库选项”的“归档内容”中恢复或彻底删除。'}</p>
        {message && <p className="q-error" role="alert">{message}</p>}
        <footer><button disabled={busy} onClick={() => setLifecycleAction(null)}>取消</button><button className={lifecycleAction.mode === 'purge' ? 'q-danger-primary' : 'primary'} disabled={busy} onClick={() => action(confirmLifecycle)}>{busy ? '正在处理…' : lifecycleAction.mode === 'purge' ? '彻底删除' : lifecycleAction.mode === 'restore' ? '确认恢复' : '确认归档'}</button></footer>
      </QuestionDialog>}</ModulePresence>
      <ModulePresence present={Boolean(newCategory)}>{newCategory && <QuestionDialog title={newCategory.kind === 'types' ? '新建题型' : '新建标签'} onClose={() => setNewCategory(null)}>
        <form onSubmit={event => { event.preventDefault(); action(async () => {
          const kind = newCategory.kind;
          const item = { id: crypto.randomUUID(), name: categoryName.trim() };
          const next = await mutate('/taxonomy', { baseVersion: taxonomy.version, types: taxonomy.types, tags: taxonomy.tags, [kind]: [...taxonomy[kind], item] }, 'PUT');
          setTaxonomy(next); newCategory.onAssign(item.id); setNewCategory(null); setMessage('分类已创建，保存题目后生效。');
        }); }}>
          <label>名称<input aria-label="分类名称" value={categoryName} maxLength={80} onChange={event => setCategoryName(event.target.value)} /></label>
          <p className="q-muted">创建后直接选用于当前题目。</p>
          <footer><button type="button" onClick={() => setNewCategory(null)}>取消</button><button className="primary" disabled={busy || !categoryName.trim()}>创建并选用</button></footer>
          {message && <p role="alert">{message}</p>}
        </form>
      </QuestionDialog>}</ModulePresence>
    </div>
  );
}
function Taxonomy({ taxonomy, disabled, onSave }) {
  const [draft, setDraft] = useState({
      types: taxonomy.types,
      tags: taxonomy.tags,
    }),
    [name, setName] = useState(""),
    [kind, setKind] = useState("types"),
    [deleting, setDeleting] = useState(false),
    [pendingDelete, setPendingDelete] = useState(null),
    [error, setError] = useState("");
  return (
    <div className="q-taxonomy">
      <select
        aria-label="分类类别"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="types">题型</option>
        <option value="tags">标签</option>
      </select>
      <input
        aria-label="新分类名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={() => {
          if (name.trim()) {
            setDraft({
              ...draft,
              [kind]: [...draft[kind], { id: crypto.randomUUID(), name }],
            });
            setName("");
          }
        }}
      >
        新增
      </button>
      {["types", "tags"].map((k) =>
        draft[k].map((t) => (
          <div key={t.id}>
            <input
              aria-label="分类名称"
              value={t.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  [k]: draft[k].map((x) =>
                    x.id === t.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <button
              disabled={disabled || deleting}
              onClick={async () => {
                setDeleting(true);
                setError("");
                try {
                const lists = await Promise.all([
                  get("/items"),
                  get("/items?state=deleted"),
                ]);
                const affected = lists
                  .flatMap((x) => x.items)
                  .filter(
                    (q) => q.typeId === t.id || q.tagIds.includes(t.id),
                  ).length;
                setPendingDelete({ kind: k, id: t.id, name: t.name, affected });
                } catch (error) { setError(error.message); }
                finally { setDeleting(false); }
              }}
            >
              删除
            </button>
          </div>
        )),
      )}
      <button disabled={disabled || deleting} onClick={() => onSave(draft)}>保存分类</button>
      {error && <p role="alert">{error}</p>}
      <ModulePresence present={Boolean(pendingDelete)}>{pendingDelete && <ConfirmDialog
        title="删除分类" message={`删除“${pendingDelete.name}”并解除 ${pendingDelete.affected} 道题的关联？题目本身会保留。`}
        confirmLabel="删除分类" onCancel={() => setPendingDelete(null)} onConfirm={() => {
          setDraft(current => ({ ...current, [pendingDelete.kind]: current[pendingDelete.kind].filter(item => item.id !== pendingDelete.id) }));
          setPendingDelete(null);
        }} />}</ModulePresence>
    </div>
  );
}
