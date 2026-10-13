import { useTranslation } from 'react-i18next';
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
import { FragmentReview } from './FragmentReview.jsx';
import { NoteFragments } from './NoteFragments.jsx';
import { ImportList, isCompletedImport } from './ImportList.jsx';
import OriginalPane from "./OriginalPane.jsx";
import ResizeDivider from "./ResizeDivider.jsx";
import { QuestionIcon, QuestionDialog, QuestionDocumentEditor, QuestionWelcome } from './QuestionControls.jsx';
import "./questions-materials.css";
const active = new Set(["queued", "running", "cancelling"]);
const hasCollectionInput = value => Boolean(value && (value.text || value.title || value.origin || value.pages || value.fileNames?.length));
const editableFields = (q) => ({
  title: q.title,
  body: q.body,
  solution: q.solution,
  answerStatus: q.answerStatus,
  note: q.note,
  ...(q.noteFragments !== undefined ? { noteFragments: q.noteFragments } : {}),
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
  requestedId,
  registerTools,
  onOpenTools,
  onReturnToLibrary,
  onReturnToRecord,
  renderTeachingFeedback,
}) {
  const { t } = useTranslation("questions");
  const pageNode = useRef(null);
  const visibleOriginal = useRef(null);
  const sourceField = useRef(null);
  const sourceCopyAttempt = useRef(0);
  const [sourceCopyStatus, setSourceCopyStatus] = useState("");
  const [collection] = useState(() => {
    const stored = readLocal(accountKey, "questions-collection");
    if (stored && !hasCollectionInput(stored)) {
      removeLocal(accountKey, "questions-collection");
      return {};
    }
    return stored ?? {};
  });
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
  const listNode = useRef(null);
  const initialListTop = useRef(scene.listScroll ?? 0);
  const listRestored = useRef(false);
  useEffect(() => {
    const node = listNode.current;
    if (!node || listState !== 'ready' || listRestored.current) return;
    const finder = node.parentElement;
    const observer = new ResizeObserver(restore);
    const images = new MutationObserver(restore);
    function disconnect() {
      observer.disconnect();
      images.disconnect();
      finder.removeEventListener('transitionend', restore);
    }
    function restore() {
      if (listRestored.current) { disconnect(); return; }
      if (!node.getClientRects().length) return;
      node.scrollTop = initialListTop.current;
      const filters = finder.querySelector('.q-filters')?.closest('.wb-module-presence');
      const opening = editorRef.current.scene.filtersOpen && filters?.dataset.state !== 'open';
      const moving = filters?.getAnimations().some(animation => animation.playState === 'running');
      if (!node.querySelector('[data-image-state="loading"]') && !opening && !moving) {
        listRestored.current = true;
        disconnect();
        patchScene({ listScroll: node.scrollTop });
      }
    }
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    images.observe(finder, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-image-state', 'data-state'] });
    finder.addEventListener('transitionend', restore);
    restore();
    return disconnect;
  }, [listState, items, imports]);
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
    const next = {
      capture,
      text,
      title,
      origin,
      pages,
      fileNames: chosenFiles.length ? chosenFiles.map(file => file.name) : collection.fileNames ?? [],
    };
    if (hasCollectionInput(next))
      writeLocal(accountKey, "questions-collection", next);
    else removeLocal(accountKey, "questions-collection");
  }, [capture, text, title, origin, pages, chosenFiles]);
  const pending = useRef(readLocal(accountKey, "questions-materials-pending")),
    alive = useRef(true);
  useEffect(() => {
    let live = true;
    pendingQuestionUpload(accountKey).then(value => {
      if (live && value) setMessage(t("文件“{{name}}”上传结果待确认，请重新选择原文件继续。", { name: value.file.name }));
    }).catch(() => { if (live) setMessage(t("无法读取待确认的文件，请保留设备资料并检查浏览器存储权限。")); });
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
    sourceCopyAttempt.current += 1;
    setSourceCopyStatus("");
    setConflict(null);
    setAssets(null);
    setCopies([]);
    setLoadError('');
    const assetId = readLocal(accountKey, "question-asset:" + scene.id);
    if (assetId)
      get("/api/workbench/jobs/" + assetId)
        .then((j) => live && setAssets(j))
        .catch((e) => live && setMessage(e.message));
    if (scene.kind === "new") {
      const local = readLocal(accountKey, localKey) ?? {
        title: "",
        body: empty(),
        solution: empty(),
        answerStatus: "absent",
        note: "",
        starred: false,
        typeId: null,
        tagIds: [],
        source: { kind: "manual" },
      };
      setValue(local);
      if (local.source?.kind === 'copy') get('/items/' + local.source.questionId).then(current => {
        if (live && current.version !== local.source.questionVersion) setConflict(current);
      }).catch(error => { if (live) setMessage(error.message); });
    }
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
      const current = editorRef.current;
      const copySource = current.scene.kind === 'new' && current.value?.source?.kind === 'copy' ? current.value.source : null;
      const conflictId = current.scene.id ?? copySource?.questionId;
      if (e.problem?.kind === "conflict" && conflictId) {
        try {
          const server = await get(`/${current.scene.kind === "import" ? "imports" : "items"}/${conflictId}`);
          if (alive.current && editorRef.current.scene.kind === current.scene.kind && editorRef.current.scene.id === current.scene.id)
            setConflict(server);
        } catch {
          /* Keep the local document available if the comparison read fails. */
        }
      }
      setMessage(e.problem?.message ?? e.message ?? t("操作失败，请重试"));
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
      throw Error(t("上次请求已确认，后续修改仍保留，请继续保存。"));
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
    patchScene({ kind: 'list', id: null, state, compare: false, editing: false, reviewEditing: false, draftId: null,
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
    setMessage(operation === 'purge' ? t("已彻底删除，无法恢复。") : result.deletedAt ? t("已归档，可在归档内容中恢复或彻底删除。") : t("已恢复，可回到题库查看。"));
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
    const path = `/${scene.kind === "import" ? "imports" : "items"}/${value.id}`;
    const input = scene.kind === "import"
        ? {
            baseVersion: value.version,
            drafts: value.drafts,
            fragments: value.fragments,
          }
        : { baseVersion: value.version, ...editableFields(value) };
    const result = await mutate(path, input, "PUT");
    if (scene.kind === 'import') {
      setValue(result);
      removeLocal(accountKey, localKey);
      setMessage(t("校对已保存"));
    } else {
      acceptRecoveredQuestion({ path, input, method: 'PUT' }, result);
      setMessage(readLocal(accountKey, localKey) ? t("题目已保存，之后补充的修改仍保留在草稿中。") : t("题目已保存"));
    }
    await refresh();
    return result;
  }
  const newDraftKey = 'questions-materials-draft:new:new';
  const meaningful = q => Boolean(q && (q.title?.trim() || sourceText(q.body).trim() || documentAssets(q.body).figures.length || sourceText(q.solution).trim() || documentAssets(q.solution).figures.length || q.note?.trim() || q.noteFragments?.length || q.source?.kind === 'copy'));
  function startCapture() { setMessage(''); setCapture("选择"); }
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
    const path = value.source?.kind === 'copy' ? '/items/' + value.source.questionId + '/copies' : '/items';
    const input = value.source?.kind === 'copy' ? { baseVersion: value.source.questionVersion, ...editableFields(value) } : value;
    const q = await mutate(path, input);
    acceptRecoveredQuestion({ path, input, method: 'POST' }, q);
    patchScene({ compare: false });
    await refresh();
    setMessage(readLocal(accountKey, `questions-materials-draft:question:${q.id}`) ? t("题目已保存，之后补充的修改仍保留在草稿中。") : t("题目已保存"));
    return q;
  }
  function startCopy(question) {
    const next = { ...editableFields(question), note: '', noteFragments: undefined, starred: false,
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
      setMessage(issue ? t("请先完成这道题的待检查项，再确认入库。") : t("请先核对答案，并选择答案是否完整。"));
      const target = issue
        ? [...(pageNode.current?.querySelectorAll('[data-issue-id]') ?? [])].find(node => node.dataset.issueId === issue.id)?.querySelector('select')
        : pageNode.current?.querySelector('[data-question-answer-status]');
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
      return;
    }
    await action(async () => {
      const saved = await save();
      const result = await mutate('/imports/' + saved.id + '/commit', { baseVersion: saved.version, draftIds: [selected] });
      setValue(result.import);
      setMessage(t("这道题已入库，可以继续检查下一题。"));
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
      <label> {t("题型")} <select
          aria-label={t("题型")}
          value={q.typeId ?? ""}
          onChange={(e) => onChange({ typeId: e.target.value || null })}
        >
          <option value="">{t("未分类")}</option>
          {taxonomy.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="q-text-button" onClick={() => { setCategoryName(''); setMessage(''); setNewCategory({ kind: 'types', onAssign: id => onChange({ typeId: id }) }); }}><QuestionIcon name="plus" size={14} />{t("新建题型")}</button>
      <span className="q-classify-label">{t("标签")}</span>
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
      <button type="button" className="q-text-button" onClick={() => { setCategoryName(''); setMessage(''); setNewCategory({ kind: 'tags', onAssign: id => onChange({ tagIds: [...q.tagIds, id] }) }); }}><QuestionIcon name="plus" size={14} />{t("新建标签")}</button>
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
      <p className="q-muted">{t("管理所有题目的题型与标签。查找题目请使用列表中的筛选。")}</p>
      {!manage && <button onClick={() => setManage(true)}>{t("管理题型与标签")}</button>}
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
              const after = before ? await get("/items/" + before.id) : null;
              const current = editorRef.current;
              if (current.scene.kind === editing.scene.kind && current.scene.id === editing.scene.id && current.value) {
                const local = readLocal(accountKey, current.localKey);
                let nextValue = current.value;
                let nextLocal = local;
                if (before) {
                  const cleaned = classify(before);
                  const changed = cleaned.typeId !== before.typeId || cleaned.tagIds.length !== before.tagIds.length;
                  if (local) {
                    if (local.version === before.version && after.version === before.version + Number(changed))
                      nextLocal = {...classify(local), version: after.version, updatedAt: after.updatedAt};
                    else setConflict(after);
                  }
                  nextValue = current.scene.editing && nextLocal ? nextLocal : after;
                } else if (current.scene.kind === "new") {
                  nextValue = classify(current.value);
                  if (local) nextLocal = nextValue;
                } else if (current.scene.kind === "import") {
                  nextValue = {...current.value, drafts: current.value.drafts.map(classify)};
                  if (local) nextLocal = nextValue;
                }
                setValue(nextValue);
                if (nextLocal) writeLocal(accountKey, current.localKey, nextLocal);
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
        label: t("分类与标签"),
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
        label={scene.compare ? t("调整原题对照宽度") : t("调整题目列表宽度")}
        onChange={width => patchScene(scene.compare ? {compareWidth: width} : {listWidth: width})} />}
      <aside className="q-finder" inert={scene.compare && value?.source?.kind === "copy" ? true : undefined} aria-hidden={scene.compare && value?.source?.kind === "copy" ? true : undefined}>
        <header className="q-finder-heading">
          <h1 tabIndex={-1}><span className="q-heading-icon"><QuestionIcon name="book" size={24} /></span>{archived ? t("归档内容") : t("题库")}<span className="q-list-count">{archived ? items.length + imports.length : items.length}</span></h1>
          <Popover label={t("题库选项")}>
            {({ close }) => <div className="q-question-menu">
              <button role="menuitem" onClick={() => { setManage(true); onOpenTools?.(); close(); }}>{t("管理题型与标签")}</button>
              <button role="menuitem" onClick={() => { returnToLibrary(archived ? 'active' : 'deleted', true); close(); }}>{archived ? t("返回题库") : t("归档内容")}</button>
            </div>}
          </Popover>
        </header>
        {archived ? <button className="q-text-button q-back" onClick={() => returnToLibrary('active', true)}><QuestionIcon name="back" />{t("返回题库")}</button> : <div className="q-entry-actions">
          <button className="primary" onClick={startCapture}><QuestionIcon name="upload" />{t("从资料收录")}</button>
          <button onClick={() => open('new', null)}><QuestionIcon name="edit" />{t("手动录题")}</button>
        </div>}
        {!archived && meaningful(readLocal(accountKey, newDraftKey)) && scene.kind !== 'new' && <button className="q-draft-entry" onClick={() => open('new', null, readLocal(accountKey, newDraftKey)?.source?.kind === 'copy')}><QuestionIcon name="edit" /><span>{t("继续未完成的题目")}</span><QuestionIcon name="chevron" size={14} /></button>}
        <div className="q-search-row">
          <div className="q-search"><QuestionIcon name="search" size={17} /><input aria-label={t("搜索题目")} placeholder={scene.searchAnswers ? t("搜索题目、答案或笔记") : t("搜索题干、公式或笔记")} value={scene.q ?? ''} onChange={e => patchScene({ q: e.target.value })} /></div>
          <button className={`q-icon-button${scene.filtersOpen || hasFilters ? ' is-active' : ''}`} aria-label={t("筛选题目")} title={t("筛选题目")} aria-expanded={Boolean(scene.filtersOpen)} onClick={() => patchScene({ filtersOpen: !scene.filtersOpen })}><QuestionIcon name="filter" /></button>
        </div>
        <ModulePresence present={Boolean(scene.filtersOpen)} mode="collapse">
          <div className="q-filters">
            <label>{t("题型")}<select aria-label={t("筛选题型")} value={scene.typeId ?? ''} onChange={e => patchScene({ typeId: e.target.value })}><option value="">{t("全部题型")}</option>{taxonomy.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="q-checkbox"><input type="checkbox" checked={scene.starred} onChange={e => patchScene({ starred: e.target.checked })} />{t("只看已标记")}</label>
            <label className="q-checkbox"><input type="checkbox" checked={Boolean(scene.searchAnswers)} onChange={e => patchScene({ searchAnswers: e.target.checked })} />{t("同时搜索答案与解析")}</label>
            {taxonomy.tags.length > 0 && <div className="q-filter-tags"><span>{t("标签")}</span>{taxonomy.tags.map(tag => <label key={tag.id} className="q-checkbox"><input type="checkbox" checked={scene.tagIds?.includes(tag.id) ?? false} onChange={e => patchScene({ tagIds: e.target.checked ? [...(scene.tagIds ?? []), tag.id] : scene.tagIds.filter(id => id !== tag.id) })} />{tag.name}</label>)}</div>}
          </div>
        </ModulePresence>
        {hasFilters && <div className="q-filter-summary"><span>{t("筛选结果 ·")} {items.length} {t("题")}</span><button className="q-text-button" onClick={() => patchScene({ q: '', typeId: '', tagIds: [], starred: false, searchAnswers: false })}>{t("清除条件")}</button></div>}
        {!registerTools && taxonomyTools}
        <div
          className="q-list"
          ref={listNode}
          onWheel={() => { listRestored.current = true; }}
          onPointerDown={() => { listRestored.current = true; }}
          onKeyDown={() => { listRestored.current = true; }}
          onScroll={event => {
            if (listRestored.current) patchScene({ listScroll: event.currentTarget.scrollTop });
          }}
        >
          <ImportList imports={imports} archived={archived} selectedId={scene.id} onOpen={id => open("import", id)} />
          {listState === 'loading' ? <p className="q-list-empty" role="status">{t("正在读取题库…")}</p> : listState === 'error' ? <div className="q-list-empty"><p>{t("题库暂时无法读取")}</p><button onClick={() => action(refresh)}>{t("重新加载")}</button></div> : items.length === 0 && <p className="q-list-empty">{hasFilters ? t("没有符合条件的题目，试试调整筛选。") : archived ? t("没有归档的题目。") : imports.length ? t("材料确认入库后，题目会出现在这里。") : t("收录第一道题，开始积累。")}</p>}
          {items.map((q) => (
            <div className="q-list-entry" key={q.id}>
            <button
              className={scene.id === q.id ? "selected" : ""}
              key={q.id}
              onClick={() => open("question", q.id)}
            >
              <strong>
                {q.starred ? "★ " : ""}
                {q.title || sourceText(q.body).slice(0, 36) || t("未命名题目")}
              </strong>
              <div className="q-excerpt"><DocumentView value={{version: q.body.version,
                blocks: q.body.blocks.filter(block => block.type !== "image").slice(0, 1)}} /></div>
              {documentAssets(q.body).figures[0] && <DocumentView value={{version: 2, blocks: [documentAssets(q.body).figures[0]]}} />}
            </button>
            </div>
          ))}
        </div>
      </aside>
      <ModulePresence present={Boolean(scene.compare && value?.source?.kind === "copy")} className="q-compare-presence">
      {scene.compare && value?.source?.kind === "copy" && <section className="q-copy-source" aria-label={t("原题对照")}>
        <header><strong>{t("改编前的原题")}</strong>
          <button onClick={() => patchScene({compare: false})}>{t("结束对照")}</button></header>
        <h3>{value.source.snapshot.title || t("原题")}</h3>
        <DocumentView value={value.source.snapshot.body} />
        {value.source.snapshot.solution?.blocks?.length > 0 && <details open><summary>{t("答案解析")}</summary><DocumentView value={value.source.snapshot.solution} /></details>}
        <button onClick={() => open("question", value.source.questionId)}>{t("查看当前原题")}</button>
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
                  if (!lifecycle) setMessage(question ? t("题目已保存，之后补充的修改仍保留在草稿中。") : t("原请求已确认，请重新打开查看"));
                  await refresh();
                })
              }
            > {t("确认上次请求")} </button>
          )}
        </div>
        {conflict && !(scene.kind === 'new' && value?.source?.kind === 'copy') && (
          <section aria-label={t("版本冲突对照")}>
            <p>{t("服务器已有更新。本地修改仍保留，请核对后选择。")}</p>
            <details>
              <summary>{t("服务器当前内容")}</summary>
              {(conflict.drafts ?? [conflict]).map((item) => (
                <article key={item.id}>
                  <strong>{item.title || t("未命名题目")}</strong>
                  <DocumentView value={item.body} />
                  <DocumentView value={item.solution} />
                </article>
              ))}
            </details>
            <button
              onClick={() => {
                change(conflict);
                setConflict(null);
                setMessage(t("已采用服务器版本"));
              }}
            > {t("采用服务器版本")} </button>
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
                setMessage(t("已保留本地修改，请核对后再次保存"));
              }}
            > {t("保留本地修改并继续校对")} </button>
          </section>
        )}
        {!value ? (
          scene.kind === 'list' ? archived ? <div className="q-welcome"><span className="q-welcome-icon"><QuestionIcon name="book" size={32} /></span><h2>{items.length || imports.length ? t("选择一份归档内容") : t("暂无归档内容")}</h2><p>{t("归档的题目和材料可以恢复，也可以彻底删除。")}</p></div> : <QuestionWelcome hasItems={items.length > 0} onCapture={startCapture} onCreate={() => open('new', null)} /> : <div className="q-empty" role="status">{loadError || t("正在打开…")}{loadError && <button onClick={() => returnToLibrary()}>{t("返回题库")}</button>}</div>
        ) : scene.kind === "import" ? (
          <>
            <header className="q-review-heading">
              <div className="q-review-title"><button className="q-text-button q-back" onClick={() => returnToLibrary()}><QuestionIcon name="back" />{archived ? t("返回归档内容") : t("返回题库")}</button><h2>{value.title}</h2><span className="q-muted">{value.deletedAt ? t("已归档") : isCompletedImport({ ...value, jobState: job?.state }) ? t("全部检查完成") : (stateNames[job?.state] ? t(stateNames[job.state]) : "")}</span></div>
              <div className="q-review-progress"><span><QuestionIcon name="check" size={15} />{t("原稿已保存")}</span><span>{value.drafts.filter(d => d.disposition === 'confirmed').length} {t("题已入库")}</span><span>{value.drafts.filter(d => d.disposition === 'pending').length} {t("题待检查")}</span></div>
              <div className="q-tools">
                {!value.deletedAt && <button
                  disabled={busy || Boolean(value.deletedAt) || active.has(job?.state)}
                  onClick={() => action(save)}
                > {t("保存检查进度")} </button>}
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
                  > {t("停止整理")} </button>
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
                  > {t("重试未完成部分")} </button>
                )}
                <Popover label={t("材料操作")}>{({ close }) => <div className="q-question-menu" onClick={event => { if (event.target.closest('button:not(:disabled)')) close(); }}>
                <button
                  disabled={busy || Boolean(value.deletedAt) || active.has(job?.state)}
                  onClick={() => picker.current.click()}
                > {t("补充照片")} </button>
                <button
                  disabled={
                    busy || active.has(job?.state) || Boolean(value.deletedAt)
                  }
                  onClick={() =>
                    action(async () => {
                      const location = visibleOriginal.current;
                      if (!location) throw Error(t("请先选择可定位的原稿页或段落"));
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
                > {t("补充题目草稿")} </button>
                <button
                  disabled={busy || active.has(job?.state)}
                  onClick={() => requestLifecycle(value.deletedAt ? 'restore' : 'archive')}
                >
                  {value.deletedAt ? t("恢复材料") : t("归档材料")}
                </button>
                {value.deletedAt && <button className="q-danger" disabled={busy || active.has(job?.state)} onClick={() => requestLifecycle('purge')}>{t("彻底删除材料")}</button>}
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
              <button onClick={() => patchScene({ reviewTab: "original" })}> {t("原稿")} </button>
              <button onClick={() => patchScene({ reviewTab: "result" })}> {t("校对结果")} </button>
            </div>
            <div className="q-review" data-tab={scene.reviewTab ?? "result"}
              style={{"--q-ratio": scene.reviewWidth ?? 0.5}}>
              <ResizeDivider value={scene.reviewWidth ?? 0.5} label={t("调整原稿对照宽度")}
                onChange={reviewWidth => patchScene({reviewWidth})} />
              <OriginalPane
                onVisibleLocation={location => { visibleOriginal.current = location; }}
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
                            alt: t("原稿裁图"),
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
                <nav className="q-review-tabs" aria-label={t("选择待检查题目")}>
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
                        ? t("已入库")
                        : d.disposition === "ignored"
                          ? t("已忽略")
                          : t("待检查")}
                    </button>
                  ))}
                </nav>
                {draft ? (
                  <fieldset disabled={locked} className="q-review-fields">
                    <div className="q-review-current"><h3>{t("第 {{number}} 题", { number: value.drafts.indexOf(draft) + 1 })} <span className="q-muted">{t("共 {{count}} 题", { count: value.drafts.length })}</span></h3>{draft.disposition !== 'confirmed' && <button className="q-text-button" onClick={() => patchScene({ reviewEditing: !scene.reviewEditing })}><QuestionIcon name={scene.reviewEditing ? 'check' : 'edit'} size={16} />{scene.reviewEditing ? t("完成修改") : t("修改题目")}</button>}</div>
                    {scene.reviewEditing ? <>
                      <label className="q-title-field">{t("题目名称")}<input aria-label={t("草稿标题")} value={draft.title} onChange={e => editDraft({ title: e.target.value })} /></label>
                      <QuestionDocumentEditor resetKey={value.version} key={draft.id + "-body"} value={draft.body} onChange={body => editDraft({ body })} onPickImage={pickImage} readOnly={locked} />
                    </> : <article className="q-reading-body" aria-label={t("待检查题干")}><DocumentView value={draft.body} /></article>}
                    {draft.answerStatus !== 'absent' && (scene.reviewEditing ? <QuestionDocumentEditor resetKey={value.version} key={draft.id + "-solution"} label={t("答案与解析")} value={draft.solution} onChange={solution => editDraft({ solution })} onPickImage={pickImage} readOnly={locked} /> : <section className="q-review-answer"><h4>{t("答案与解析")}</h4><DocumentView value={draft.solution} /></section>)}
                    {draft.answerStatus === 'absent' && !scene.reviewEditing && <p className="q-muted">{t("原稿中未提供答案")}</p>}
                    {(scene.reviewEditing || draft.answerStatus === 'unresolved') && <label className="q-answer-state">{t("答案是否完整")}<select data-question-answer-status aria-label={t("答案状态")} value={draft.answerStatus} onChange={e => editDraft({ answerStatus: e.target.value })}><option value="absent">{t("未提供答案")}</option><option value="present">{t("已有完整答案")}</option><option value="unresolved">{t("答案待核对")}</option></select></label>}
                    {draft.issues.length > 0 && <section className="q-review-checks" aria-label={t("需要检查的内容")}><h4>{draft.issues.some(i => i.resolution === 'open') ? t("请对照原稿检查") : t("检查已完成")}</h4>
                    {draft.issues.map((issue) => (
                      <div className="q-issue" key={issue.id} data-issue-id={issue.id} data-resolved={issue.resolution !== 'open'}>
                        <span id={`issue-${issue.id}`}>{issue.detail && t(issue.detail, { defaultValue: issue.detail }) || ({
                          'split-boundary': new Set(issue.locations.filter(l => l.kind === 'page').map(l => l.page)).size > 1
                            ? t("这道题包含跨页内容，请对照原稿检查归属。归属不对时可在“调整题目”中拆分或忽略，原始片段仍保留。")
                            : t("题干是否完整，是否混入了其他题目？"),
                          'uncertain-formula': t("请检查并修正这道题的公式。"),
                          'missing-figure': t("请补上原稿中的配图。"),
                          'unverified-location': t("请确认这道题在原稿中的位置。"),
                          'incomplete-answer': t("答案可能不完整，请对照原稿补充。"),
                          'uncertain-text': t("这些文字是否与原稿一致？"),
                          'truncated-input': t("内容可能被截断，请补全题目。"),
                        })[issue.code] || issue.detail || t("请核对这处内容。")}
                        {issue.locations.find(location => location.kind === 'page' && location.box) &&
                          <button className="q-text-button q-issue-location" onClick={() => {
                            const location = issue.locations.find(location => location.kind === 'page' && location.box);
                            patchScene({ original: { ...scene.original, fileId: location.fileId, page: location.page,
                              originalView: 'pages', selection: location, focusIssue: Date.now() } });
                          }}>{t("查看疑点位置")}</button>}
                        </span>
                        <select
                          aria-labelledby={`issue-${issue.id}`}
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
                          <option value="open">{t("待校对")}</option>
                          <option value="corrected">{t("已修正")}</option>
                          {![
                            "uncertain-formula",
                            "missing-figure",
                            "unverified-location",
                            "incomplete-answer",
                          ].includes(issue.code) && (
                            <option value="acknowledged">{t("已核对")}</option>
                          )}
                        </select>
                      </div>
                    ))}</section>}
                    {Boolean(draft.noteFragments?.length) && <ModuleDisclosure title={t("教学笔记")}>
                      <NoteFragments resetKey={value.version} fragments={draft.noteFragments} editing={Boolean(scene.reviewEditing)} onPickImage={pickImage}
                        onChange={noteFragments => editDraft({ noteFragments })} onRemove={id => change({ ...value,
                          drafts: value.drafts.map(item => item.id === draft.id ? { ...item, noteFragments: item.noteFragments.filter(fragment => fragment.id !== id) } : item),
                          fragments: value.fragments.map(fragment => fragment.id === id ? { ...fragment, disposition: 'unassigned' } : fragment) })} />
                    </ModuleDisclosure>}
                    <ModuleDisclosure title={t("题型与标签")}>{classification(draft, editDraft)}</ModuleDisclosure>
                    {draft.disposition !== 'confirmed' && <ModuleDisclosure title={t("调整题目：拆分、合并或忽略")} className="q-adjust-question">
                    <p className="q-muted">{t("同一段有两题时，先修改题目，在分界处换行，再拆分。原稿始终保留。")}</p>
                    <div className="q-tools">
                      <label> {t("在第")}{" "}
                        <input
                          aria-label={t("拆分段落")}
                          type="number"
                          min="1"
                          max={Math.max(1, splitParagraphCount - 1)}
                          disabled={splitParagraphCount < 2}
                          value={splitAt}
                          onChange={(e) => setSplitAt(Number(e.target.value))}
                        />{" "} {t("段后")} </label>
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
                          setMessage(draft.answerStatus === 'absent' ? t("已拆成两题，请分别检查题干。") : t("已拆成两题，原有答案保留在第一题，请分别核对答案。"));
                        }}
                      > {t("拆分")} </button>
                      <select
                        aria-label={t("合并目标")}
                        value={mergeId}
                        onChange={(e) => setMergeId(e.target.value)}
                      >
                        <option value="">{t("选择后接草稿")}</option>
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
                                      noteFragments: [...new Map([...(x.noteFragments ?? []), ...(other.noteFragments ?? [])].map(fragment => [fragment.id, fragment])).values()],
                                      parts: [...x.parts, ...other.parts],
                                      issues: [...x.issues, ...other.issues],
                                    }
                                  : x,
                              ),
                          });
                          setMergeId("");
                        }}
                      > {t("合并")} </button>
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
                        {draft.disposition === "ignored" ? t("恢复草稿") : t("忽略")}
                      </button>
                    </div>
                    </ModuleDisclosure>}
                  </fieldset>
                ) : (
                  <p>{t("原稿保留在左侧。处理完成后，题目草稿会出现在这里。")}</p>
                )}
                <FragmentReview material={value} draft={draft} locked={locked} onChange={change} />
                {draft && <footer className="q-review-footer">
                  {draft.questionId ? <><span className="q-saved-label"><QuestionIcon name="check" />{t("这道题已入库")}</span><button onClick={() => open('question', draft.questionId)}>{t("查看题目")}</button>{value.drafts.some(d => d.disposition === 'pending') && <button className="primary" onClick={() => { const next = value.drafts.find(d => d.disposition === 'pending'); setSelected(next.id); patchScene({ draftId: next.id, original: {}, reviewEditing: false }); }}>{t("检查下一题")}<QuestionIcon name="chevron" size={15} /></button>}</> : <><span className="q-muted">{draft.issues.filter(i => i.resolution === 'open').length ? t("还有 {{count}} 项需要检查", { count: draft.issues.filter(i => i.resolution === 'open').length }) : draft.disposition === 'ignored' ? t("这道题已忽略，可在调整题目中恢复") : t("确认后，这道题会加入题库")}</span><button className="primary" disabled={locked || draft.disposition === 'ignored'} onClick={confirmDraft}><QuestionIcon name="check" />{t("确认这道题")}</button></>}
                </footer>}
              </section>
            </div>
          </>
        ) : (
          <section className="q-question" ref={questionScroll.ref} onScroll={questionScroll.onScroll}>
            {onReturnToRecord && <button onClick={onReturnToRecord}>{t("返回教学记录")}</button>}
            <header className="q-question-heading">
              {editing ? <>
                <button className="q-text-button q-back" disabled={busy} onClick={() => action(leaveEditor)}><QuestionIcon name="back" />{scene.kind === 'new' ? t("返回题库") : t("返回题目")}</button>
                <span className="q-save-state">{busy ? t("正在保存…") : readLocal(accountKey, localKey) ? t("草稿保存在此设备") : scene.kind === 'new' ? t("尚未保存") : t("已保存")}</span>
                <button className="primary" disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={() => action(saveQuestion)}><QuestionIcon name="check" />{t("保存题目")}</button>
              </> : <>
                <div className="q-question-title"><span className="q-eyebrow">{value.deletedAt ? t("已归档") : value.source?.kind === 'copy' ? t("改编题目") : t("我的题目")}</span><h2>{value.title || t("未命名题目")}{value.starred && <QuestionIcon name="star" size={18} />}</h2></div>
                <Popover label={t("更多题目操作")}>{({ close }) => <div className="q-question-menu"><button role="menuitem" disabled={busy || unsupportedQuestion} onClick={() => { requestLifecycle(value.deletedAt ? 'restore' : 'archive'); close(); }}>{value.deletedAt ? t("恢复题目") : t("归档题目")}</button>{value.deletedAt && <button className="q-danger" role="menuitem" disabled={busy} onClick={() => { requestLifecycle('purge'); close(); }}>{t("彻底删除题目")}</button>}</div>}</Popover>
              </>}
            </header>
            {conflict && scene.kind === 'new' && value?.source?.kind === 'copy' && (
              <section aria-label={t("版本冲突对照")}>
                <p>{t("原题已更新。请核对当前原题，再选择是否将它作为改编来源。题干、答案、分类和笔记都会保留；选择后仍需保存题目。")}</p>
                <details open>
                  <summary>{t("当前原题")}</summary>
                  <strong>{conflict.title || t("未命名题目")}</strong>
                  <DocumentView value={conflict.body} />
                  <DocumentView value={conflict.solution} />
                </details>
                <button disabled={busy || Boolean(conflict.deletedAt)} onClick={() => {
                  const current = editorRef.current.value;
                  change({ ...current, source: { ...current.source, questionVersion: conflict.version,
                    snapshot: { title: conflict.title, body: conflict.body, solution: conflict.solution } } });
                  setConflict(null);
                  setMessage(t("已选用当前原题作为来源，改编内容仍保留，请再次保存。"));
                }}>{t("以当前原题作为来源，保留改编内容")}</button>
              </section>
            )}
            {unsupportedQuestion && <p className="q-error" role="status">{t("这道题包含当前无法编辑的内容，已保留原数据，可以继续阅读。")}</p>}
            {!editing && <div className="q-reader-actions">{value.deletedAt ? <button className="primary" disabled={busy || unsupportedQuestion} onClick={() => requestLifecycle('restore')}>{t("恢复题目")}</button> : <>
              <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={beginEdit}><QuestionIcon name="edit" />{t("编辑题目")}</button>
              <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={copyQuestion} title={t("保留原题，另存一道改编题")}><QuestionIcon name="copy" />{t("复制改编")}</button>
            </>}</div>}
            {!editing && readLocal(accountKey, localKey) && <div className="q-draft-notice"><span>{value.deletedAt ? t("未保存的修改仍保存在此设备，恢复题目后可继续编辑。") : t("这道题有未保存的修改，当前显示已保存内容。")}</span>{!value.deletedAt && <button onClick={beginEdit}>{t("继续编辑")}</button>}<button className="q-text-button" onClick={() => setConfirmDiscard(true)}>{t("放弃草稿")}</button></div>}
            {editing ? <fieldset className="q-edit-fields" disabled={Boolean(value.deletedAt) || unsupportedQuestion}>
              <label className="q-title-field">{t("题目名称")} <span className="q-muted">{t("选填，方便以后查找")}</span><input className="q-title-input" aria-label={t("题目标题")} placeholder={t("例如：二次函数的最值")} value={value.title} maxLength={200} onChange={e => change({ ...value, title: e.target.value })} /></label>
              <QuestionDocumentEditor resetKey={value.version} key={scene.kind + (value.id ?? 'new')} value={value.body} onChange={body => change({ ...value, body })} onPickImage={pickImage} autoFocus />
              {value.answerStatus === 'present' || !supportedDocument(value.solution) ? <QuestionDocumentEditor resetKey={value.version} key={scene.kind + (value.id ?? "new") + "-solution"} label={t("答案与解析")} value={value.solution} onChange={solution => change({ ...value, solution })} onPickImage={pickImage} /> : <button className="q-add-field" onClick={() => change({ ...value, answerStatus: 'present' })}><QuestionIcon name="plus" />{t("添加答案与解析")}</button>}
              <ModuleDisclosure title={t("题型、标签与笔记")} open={Boolean(scene.notesOpen)} onOpenChange={notesOpen => patchScene({ notesOpen })} className="q-question-notes">
                {classification(value, patch => change({ ...value, ...patch }))}
                <label className="q-note-field">{t("教学笔记")}<textarea aria-label={t("长期笔记")} placeholder={t("记下讲解思路、易错点，方便下次使用。")} value={value.note} onChange={e => change({ ...value, note: e.target.value })} /></label>
                <NoteFragments resetKey={value.version} fragments={value.noteFragments} editing onPickImage={pickImage}
                  onChange={noteFragments => change({ ...value, noteFragments })}
                  onRemove={id => change({ ...value, noteFragments: value.noteFragments.filter(fragment => fragment.id !== id) })} />
                <label className="q-checkbox"><input type="checkbox" checked={value.starred} onChange={e => change({ ...value, starred: e.target.checked })} />{t("标记题目，方便以后查找")}</label>
              </ModuleDisclosure>
              {readLocal(accountKey, localKey) && <button className="q-text-button q-discard" onClick={() => setConfirmDiscard(true)}>{t("放弃未保存的修改")}</button>}
            </fieldset> : <>
              <div className="q-question-meta">{taxonomy.types.filter(t => t.id === value.typeId).map(t => <span className="q-type" key={t.id}>{t.name}</span>)}{taxonomy.tags.filter(t => value.tagIds.includes(t.id)).map(t => <span className="q-tag" key={t.id}><QuestionIcon name="tag" size={12} />{t.name}</span>)}</div>
              <article className="q-reading-body" aria-label={t("题干")}><DocumentView value={value.body} /></article>
              {value.answerStatus === 'present' ? <ModuleDisclosure title={t("答案与解析")} open={Boolean(scene.answerOpen)} onOpenChange={answerOpen => patchScene({ answerOpen })} className="q-answer"><DocumentView value={value.solution} /></ModuleDisclosure> : <p className="q-missing-answer">{t("暂未添加答案")} <button className="q-text-button" disabled={Boolean(value.deletedAt) || unsupportedQuestion} onClick={() => { beginEdit(true); patchScene({ answerOpen: true }); }}>{t("添加答案")}</button></p>}
              {(value.note || value.noteFragments?.length > 0) && <ModuleDisclosure title={t("教学笔记")} className="q-reader-note">{value.note && <p>{value.note}</p>}<NoteFragments fragments={value.noteFragments} /></ModuleDisclosure>}
            </>}
            {value.source?.kind === "import" && (sourceMissing ? <p className="q-muted">{t("原始材料已彻底删除，题目内容仍保留。")}</p> :
              <button disabled={busy} onClick={() => action(openSource)}> {t("对照原稿")} </button>
            )}
            {value.source?.kind === "copy" && !scene.compare && (
              <>
                <button onClick={() => patchScene({compare: true})}> {t("对照原题")} </button>
                {sourceMissing ? <p className="q-muted">{t("原题已彻底删除，可以继续查看采用时的原题。")}</p> : <button disabled={busy} onClick={() => action(openSource)}> {t("查看原题")} </button>}
                <details>
                  <summary>{t("采用时的原题")}</summary>
                  <DocumentView value={value.source.snapshot.body} />
                  <DocumentView value={value.source.snapshot.solution} />
                </details>
              </>
            )}
            {copies.map((q) => (
              <button key={q.id} onClick={() => open("question", q.id)}> {t("改编题：")}{q.title || t("未命名")}
              </button>
            ))}
            {value.id && renderTeachingFeedback && (
              <ModuleDisclosure title={t("教学反馈")} open={Boolean(scene.teachingOpen)} onOpenChange={teachingOpen => patchScene({ teachingOpen })}>
                {renderTeachingFeedback(value.id)}
              </ModuleDisclosure>
            )}
            {value.id && (
              <ModuleDisclosure title={t("复制文字或下载图片")} className="q-export">
                <p className="q-muted">{t("把题目放进你自己的课件。图片采用透明背景，可直接插入 PPT。")}</p>
                <label>
                  <input
                    type="checkbox"
                    checked={includeAnswers}
                    onChange={(e) => setIncludeAnswers(e.target.checked)}
                  /> {t("包含答案（单独分片）")} </label>
                <div className="q-tools">
                  <button disabled={sourceCopyStatus === "copying"} onClick={async () => {
                    const text = sourceText(value.body);
                    const attempt = ++sourceCopyAttempt.current;
                    setSource(text);
                    setSourceCopyStatus("copying");
                    try {
                      await navigator.clipboard.writeText(text);
                      if (attempt === sourceCopyAttempt.current) setSourceCopyStatus("copied");
                    } catch {
                      if (attempt === sourceCopyAttempt.current) {
                        setSourceCopyStatus("failed");
                        requestAnimationFrame(() => {
                          if (attempt !== sourceCopyAttempt.current) return;
                          sourceField.current?.focus();
                          sourceField.current?.select();
                        });
                      }
                    }
                  }}> {t("复制文字与公式源")} </button>
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
                    {editing && readLocal(accountKey, localKey) ? t("保存并生成题面图片") : t("生成题面图片")}
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
                  > {t("刷新生成结果")} </button>}
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
                      {editing && readLocal(accountKey, localKey) ? t("保存并生成配图") : t("生成配图")} {i + 1}
                    </button>
                  ))}
                  {documentAssets(value.body).formulas.map((formula, i) => (
                    <button key={i} onClick={() => { sourceCopyAttempt.current += 1; setSourceCopyStatus(""); setSource(formula); }}> {t("公式")} {i + 1} {t("源")} </button>
                  ))}
                </div>
                {sourceCopyStatus && <p role="status" className={sourceCopyStatus === "failed" ? "q-error" : "q-muted"}>{sourceCopyStatus === "copied" ? t("文字与公式源已复制") : sourceCopyStatus === "failed" ? t("未能自动复制，请复制下方已选文字") : t("正在复制…")}</p>}
                {source !== null && (
                  <textarea
                    ref={sourceField}
                    aria-label={t("可复制文字公式源")}
                    readOnly
                    value={source}
                    onFocus={(e) => e.target.select()}
                  />
                )}{" "}
                {assets && (
                  <p>
                    {assets.state === "succeeded"
                      ? t("素材已生成")
                      : active.has(assets.state)
                        ? t("正在生成素材")
                        : t("生成未完成，可重新生成")}
                  </p>
                )}
                {assets?.outputFileIds.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => download(id, `题面-${i + 1}.png`)}
                  > {t("下载分片")} {i + 1}
                  </button>
                ))}
              </ModuleDisclosure>
            )}
          </section>
        )}
      </main>
      <ModulePresence present={Boolean(capture)}>
      {capture && (
        <QuestionDialog title={t("从资料收录题目")} onClose={() => setCapture(null)} className="q-capture-dialog">
          <ol className="q-steps" aria-label={t("收录步骤")}><li className="is-current"><span>1</span>{t("选择材料")}</li><li><span>2</span>{t("对照检查")}</li><li><span>3</span>{t("确认入库")}</li></ol>
          {capture === '选择' ? <>
            <p className="q-capture-intro">{t("题目现在在哪里？选择材料后，原稿会保留，整理出的题目由你确认后入库。")}</p>
            <div className="q-capture-options">{[
              ['PDF', 'file', t("试卷、练习册等 PDF 文件")],
              ['Word', 'file', t("已有的 Word 试题文档")],
              ["图片", 'image', t("截图或拍照，可选择多张")],
              ["文字", 'text', t("复制来的题干、答案或多道题")],
            ].map(([kind, icon, description]) => <button key={kind} onClick={() => setCapture(kind)}><span className="q-capture-icon"><QuestionIcon name={icon} size={24} /></span><strong>{kind === '文字' ? t("粘贴文字") : kind === '图片' ? t("上传图片") : t("上传 ") + kind}</strong><span>{description}</span><QuestionIcon name="chevron" size={16} /></button>)}</div>
          </> : <>
            <button className="q-text-button q-back" onClick={() => setCapture("选择")}><QuestionIcon name="back" />{t("更换材料类型")}</button>
            {capture === '文字' ? <label className="q-capture-text">{t("粘贴题目与已有答案")}<textarea aria-label={t("原始文字")} placeholder={t("例如：\n1. 计算 1+1。\n答案：2\n\n可以一次粘贴多道题。")} value={text} onChange={e => setText(e.target.value)} /></label> : <>
              <label className="q-file-picker"><QuestionIcon name="upload" size={28} /><strong>{t("选择")}{capture === '图片' ? t("图片") : capture + t(" 文件")}</strong><span>{capture === '图片' ? t("支持 PNG、JPG、WebP，可一次选择多张") : capture === 'PDF' ? t("选择一份 PDF，保留原稿供对照") : t("支持 .docx 和 .doc")}</span><input type="file" aria-label={t("选择原稿")} multiple={capture === '图片'} accept={capture === '图片' ? 'image/png,image/jpeg,image/webp' : capture === 'PDF' ? '.pdf' : '.doc,.docx'} onChange={e => setChosenFiles([...e.target.files])} /></label>
              {!chosenFiles.length && collection.fileNames?.length > 0 && <p className="q-muted">{t("继续收录需要重新选择：")}{collection.fileNames.join('、')}</p>}
              {chosenFiles.length > 0 && <div className="q-chosen-files">{chosenFiles.map((file, i) => <div key={i}><QuestionIcon name="file" /><span>{file.name}</span>{chosenFiles.length > 1 && <button disabled={!i} onClick={() => setChosenFiles(files => { const next = [...files]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; })}>{t("上移")}</button>}</div>)}</div>}
              <p className="q-muted">{capture === '图片' ? t("原图会完整保留，识别结果需对照检查后再入库。") : capture === 'PDF' ? t("可整理文字 PDF 和扫描件；公式、配图和复杂排版请对照原稿检查。") : t("复杂排版和旧版 Word 的公式可能需要对照原稿修正。")}</p>
            </>}
            <ModuleDisclosure title={t("材料名称、出处与处理范围")} className="q-capture-metadata">
              <label>{t("材料名称")} <span className="q-muted">{t("选填")}</span><input value={title} placeholder={t("留空时使用文件名")} onChange={e => setTitle(e.target.value)} /></label>
              <label>{t("出处")} <span className="q-muted">{t("选填")}</span><input value={origin} placeholder={t("例如：教材页码、试卷名称")} onChange={e => setOrigin(e.target.value)} /></label>
              {['PDF', 'Word'].includes(capture) && <label>{t("仅处理这些页")}<input aria-label={t("处理页码")} placeholder={t("留空处理全部，例如 2,3,4")} value={pages} onChange={e => setPages(e.target.value)} /></label>}
            </ModuleDisclosure>
            <footer><span className="q-muted">{t("先保存原稿，再整理题目供你检查。")}</span><button className="primary" disabled={busy || (capture === '文字' ? !text.trim() : !chosenFiles.length)} onClick={() => action(collect)}>{busy ? t("正在保存原稿…") : t("开始整理")}<QuestionIcon name="chevron" size={16} /></button></footer>
          </>}
          {message && <p className="q-error" role="alert">{message}</p>}
        </QuestionDialog>
      )}
      </ModulePresence>
      <ModulePresence present={confirmDiscard}>{confirmDiscard && <ConfirmDialog title={t("放弃未保存的修改？")} message={t("此设备上的这份草稿将被删除，已经保存的题目不受影响。")} confirmLabel={t("放弃修改")} onCancel={() => setConfirmDiscard(false)} onConfirm={() => action(async () => { removeLocal(accountKey, localKey); setConfirmDiscard(false); await leaveEditor(); })} />}</ModulePresence>
      <ModulePresence present={Boolean(copyCandidate)}>{copyCandidate && <ConfirmDialog title={t("替换未完成的题目？")} message={t("你还有一份未完成的新题草稿。开始这次改编会替换它，已保存的题目不受影响。")} confirmLabel={t("替换并开始改编")} onCancel={() => setCopyCandidate(null)} onConfirm={() => startCopy(copyCandidate)} />}</ModulePresence>
      <ModulePresence present={Boolean(lifecycleAction)}>{lifecycleAction && <QuestionDialog
        title={`${lifecycleAction.mode === 'purge' ? t("彻底删除") : lifecycleAction.mode === 'restore' ? t("恢复") : t("归档")}${lifecycleAction.kind === 'import' ? t("材料") : t("题目")}？`}
        onClose={() => { if (!busy) setLifecycleAction(null); }} className="q-lifecycle-dialog">
        <p>{lifecycleAction.mode === 'purge'
          ? t("“{{value}}”及其本地草稿将彻底删除，无法恢复。{{detail}}", { value: lifecycleAction.item.title || t("未命名题目"), detail: lifecycleAction.kind === 'import' ? t("已入库的题目会保留。") : t("已有改编题会保留。") })
          : lifecycleAction.mode === 'restore' ? t("恢复后，会重新出现在题库中。") : t("将移出当前列表，并返回题库。你可以在“题库选项”的“归档内容”中恢复或彻底删除。")}</p>
        {message && <p className="q-error" role="alert">{message}</p>}
        <footer><button disabled={busy} onClick={() => setLifecycleAction(null)}>{t("取消")}</button><button className={lifecycleAction.mode === 'purge' ? 'q-danger-primary' : 'primary'} disabled={busy} onClick={() => action(confirmLifecycle)}>{busy ? t("正在处理…") : lifecycleAction.mode === 'purge' ? t("彻底删除") : lifecycleAction.mode === 'restore' ? t("确认恢复") : t("确认归档")}</button></footer>
      </QuestionDialog>}</ModulePresence>
      <ModulePresence present={Boolean(newCategory)}>{newCategory && <QuestionDialog title={newCategory.kind === 'types' ? t("新建题型") : t("新建标签")} onClose={() => setNewCategory(null)}>
        <form onSubmit={event => { event.preventDefault(); action(async () => {
          const kind = newCategory.kind;
          const item = { id: crypto.randomUUID(), name: categoryName.trim() };
          const next = await mutate('/taxonomy', { baseVersion: taxonomy.version, types: taxonomy.types, tags: taxonomy.tags, [kind]: [...taxonomy[kind], item] }, 'PUT');
          setTaxonomy(next); newCategory.onAssign(item.id); setNewCategory(null); setMessage(t("分类已创建，保存题目后生效。"));
        }); }}>
          <label>{t("名称")}<input aria-label={t("分类名称")} value={categoryName} maxLength={80} onChange={event => setCategoryName(event.target.value)} /></label>
          <p className="q-muted">{t("创建后直接选用于当前题目。")}</p>
          <footer><button type="button" onClick={() => setNewCategory(null)}>{t("取消")}</button><button className="primary" disabled={busy || !categoryName.trim()}>{t("创建并选用")}</button></footer>
          {message && <p role="alert">{message}</p>}
        </form>
      </QuestionDialog>}</ModulePresence>
    </div>
  );
}
function Taxonomy({ taxonomy, disabled, onSave }) {
  const { t } = useTranslation("questions");
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
      <div className="q-taxonomy-add">
        <select
          aria-label={t("分类类别")}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="types">{t("题型")}</option>
          <option value="tags">{t("标签")}</option>
        </select>
        <input
          aria-label={t("新分类名称")}
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
        > {t("新增")} </button>
      </div>
      {["types", "tags"].map((k) => (
        <fieldset key={k} className="q-taxonomy-group">
          <legend>{t(k === "types" ? "题型" : "标签")}</legend>
          {draft[k].length === 0 && <p className="q-muted">{t(k === "types" ? "暂无题型" : "暂无标签")}</p>}
          {draft[k].map((category) => (
            <div key={category.id} className="q-taxonomy-row">
              <input
                aria-label={t(k === "types" ? "题型名称" : "标签名称")}
                value={category.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [k]: draft[k].map((x) =>
                      x.id === category.id ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                aria-label={t(k === "types" ? "删除题型“{{name}}”" : "删除标签“{{name}}”", { name: category.name })}
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
                        (q) => q.typeId === category.id || q.tagIds.includes(category.id),
                      ).length;
                    setPendingDelete({ kind: k, id: category.id, name: category.name, affected });
                  } catch (error) { setError(error.message); }
                  finally { setDeleting(false); }
                }}
              > {t("删除")} </button>
            </div>
          ))}
        </fieldset>
      ))}
      <button disabled={disabled || deleting} onClick={() => onSave(draft)}>{t("保存分类")}</button>
      {error && <p role="alert">{error}</p>}
      <ModulePresence present={Boolean(pendingDelete)}>{pendingDelete && <ConfirmDialog
        title={t(pendingDelete.kind === "types" ? "删除题型" : "删除标签")}
        message={t(pendingDelete.kind === "types" ? "删除题型“{{name}}”并解除 {{affected}} 道题的关联？题目本身会保留。" : "删除标签“{{name}}”并解除 {{affected}} 道题的关联？题目本身会保留。", { name: pendingDelete.name, affected: pendingDelete.affected })}
        confirmLabel={t(pendingDelete.kind === "types" ? "删除题型" : "删除标签")} onCancel={() => setPendingDelete(null)} onConfirm={() => {
          setDraft(current => ({ ...current, [pendingDelete.kind]: current[pendingDelete.kind].filter(item => item.id !== pendingDelete.id) }));
          setPendingDelete(null);
        }} />}</ModulePresence>
    </div>
  );
}
