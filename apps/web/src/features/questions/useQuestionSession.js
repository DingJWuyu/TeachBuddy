import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { questionDocuments, supportedDocument } from '@refatos/shared';
import { readLocal, writeLocal, removeLocal } from '../../platform/device/storage.js';
import { useForegroundRefresh } from '../../components/interaction/useForegroundRefresh.js';
import { get, write } from './materials-api.js';
import { empty, sourceText, documentAssets } from './question-documents.js';
import { pendingQuestionUpload, uploadQuestionFile } from './uploadRecovery.js';
import { reviewParagraphs, splitReviewDraft } from './review-drafts.js';

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
// Owns the persistent editing/import session, including original-request confirmation
// and acceptance of server results without discarding later local question input.
export function useQuestionSession({ accountKey, transport, requestedId, onReturnToLibrary, onFocusReviewIssue }) {
  const { t } = useTranslation('questions');
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
    [conflict, setConflict] = useState(null);
  const includeAnswers = scene.includeAnswers ?? false;
  const editing = scene.kind === 'new' || Boolean(scene.editing);
  const archived = scene.state === 'deleted';
  const hasFilters = Boolean(scene.q || scene.starred || scene.typeId || scene.tagIds?.length || scene.searchAnswers);
  const [text, setText] = useState(collection.text ?? ""),
    [title, setTitle] = useState(collection.title ?? ""),
    [origin, setOrigin] = useState(collection.origin ?? ""),
    [chosenFiles, setChosenFiles] = useState([]),
    [pages, setPages] = useState(collection.pages ?? "");
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
    // A business refresh remounts this session with the same route. Keep the
    // persisted editing scene; only a different requested object starts reading.
    if (requestedId && /^[0-9a-f-]{36}$/i.test(requestedId)
      && (scene.kind !== 'question' || scene.id !== requestedId))
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
      onFocusReviewIssue(issue?.id);
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

  async function retryPending() {
    const r = pending.current;
    const result = await mutate(r.path, r.input, r.method);
    const lifecycle = acceptLifecycleResult(r, result);
    const question = acceptRecoveredQuestion(r, result);
    if (!lifecycle) setMessage(question ? t("题目已保存，之后补充的修改仍保留在草稿中。") : t("原请求已确认，请重新打开查看"));
    await refresh();
  }
  async function saveTaxonomy(next) {
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
  }
  async function createCategory() {
    const kind = newCategory.kind;
    const item = { id: crypto.randomUUID(), name: categoryName.trim() };
    const next = await mutate('/taxonomy', { baseVersion: taxonomy.version, types: taxonomy.types, tags: taxonomy.tags, [kind]: [...taxonomy[kind], item] }, 'PUT');
    setTaxonomy(next); newCategory.onAssign(item.id); setNewCategory(null); setMessage(t("分类已创建，保存题目后生效。"));
  }
  async function supplement(files) {
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
  }
  function appendDraft(location) {
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
  }
  async function cropOriginal(location) {
    const file = await mutate("/api/workbench/files/crops", {
      location: location,
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
        { role: "figure", locations: [location] },
      ],
    });
  }
  function splitDraft(splitAt) {
    const pair = splitReviewDraft(draft, splitAt);
    if (!pair) return;
    change({
      ...value,
      drafts: value.drafts.flatMap((d) =>
        d.id === selected ? pair : [d],
      ),
    });
    setMessage(draft.answerStatus === 'absent' ? t("已拆成两题，请分别检查题干。") : t("已拆成两题，原有答案保留在第一题，请分别核对答案。"));
  }
  function mergeDraft(mergeId) {
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
  }
  function resolveConflict(keepLocal) {
    if (!keepLocal) {
      change(conflict); setConflict(null); setMessage(t("已采用服务器版本")); return;
    }
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
  }
  function adoptCopySource() {
    const current = editorRef.current.value;
    change({ ...current, source: { ...current.source, questionVersion: conflict.version,
      snapshot: { title: conflict.title, body: conflict.body, solution: conflict.solution } } });
    setConflict(null);
    setMessage(t("已选用当前原题作为来源，改编内容仍保留，请再次保存。"));
  }
  async function generateAssets(figureFileId = null) {
    const current = editing && readLocal(accountKey, localKey) ? await save() : value;
    const j = await mutate(
      "/items/" + value.id + "/assets",
      {
        baseVersion: current.version,
        mode: figureFileId ? "figure-png" : "question-png",
        figureFileId,
        includeAnswers: figureFileId ? false : includeAnswers,
      },
    );
    setAssets(j);
    writeLocal(
      accountKey,
      "question-asset:" + value.id,
      j.id,
    );
  }
  function locateDraft(location, role) {
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
                        old.fileId === location.fileId &&
                        old.page === location.page
                      ),
                  ),
                },
          )
          .filter((p) => p.locations.length),
        { role, locations: [location] },
      ],
    });
  }
  function resolveReviewIssue(id, resolution) {
    editDraft({ issues: draft.issues.map(issue => issue.id === id ? { ...issue, resolution } : issue) });
  }
  function removeNoteFragment(id) {
    if (scene.kind === 'import') {
      change({ ...value,
        drafts: value.drafts.map(item => item.id === draft.id ? { ...item, noteFragments: item.noteFragments.filter(fragment => fragment.id !== id) } : item),
        fragments: value.fragments.map(fragment => fragment.id === id ? { ...fragment, disposition: 'unassigned' } : fragment),
      });
    } else change({ ...value, noteFragments: value.noteFragments.filter(fragment => fragment.id !== id) });
  }
  function selectDraft(id) {
    setSelected(id);
    patchScene({ draftId: id, original: {}, reviewEditing: false });
  }
  function changeCollection(patch) {
    if ('capture' in patch) setCapture(patch.capture);
    if ('text' in patch) setText(patch.text);
    if ('title' in patch) setTitle(patch.title);
    if ('origin' in patch) setOrigin(patch.origin);
    if ('pages' in patch) setPages(patch.pages);
    if ('files' in patch) setChosenFiles(patch.files);
  }
  function moveCollectionFileUp(index) {
    setChosenFiles(files => { const next = [...files]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; });
  }
  async function discardDraft() {
    removeLocal(accountKey, localKey); setConfirmDiscard(false); await leaveEditor();
  }

  return {
    state: {
      collection, scene, items, imports, taxonomy, listState, loadError,
      confirmDiscard, lifecycleAction, copyCandidate, newCategory, categoryName,
      value, job, selected, message, busy, capture, manage, copies, assets, conflict,
      includeAnswers, editing, archived, hasFilters, text, title, origin, chosenFiles,
      pages, unsupportedQuestion, sourceMissing, draft, locked, splitParagraphCount,
      hasDraft: Boolean(readLocal(accountKey, localKey)),
      hasNewDraft: meaningful(readLocal(accountKey, newDraftKey)),
      hasPending: Boolean(pending.current),
    },
    actions: {
      // Editing and persisted navigation. The renderer never assembles a write request.
      patchScene, open, change, editDraft, startCapture, beginEdit, copyQuestion,
      resumeNewDraft: () => open('new', null, readLocal(accountKey, newDraftKey)?.source?.kind === 'copy'),
      replaceWithCopy: () => startCopy(copyCandidate),
      pickImage, selectDraft, splitDraft, mergeDraft, changeCollection, moveCollectionFileUp,
      locateDraft, resolveReviewIssue, removeNoteFragment,
      resolveConflict, adoptCopySource,
      close: returnToLibrary,
      reload: () => action(refresh),
      save: () => action(save),
      saveQuestion: () => action(saveQuestion),
      leaveEditor: () => action(leaveEditor),
      confirmDraft,
      collect: () => action(collect),
      retryPending: () => action(retryPending),
      openSource: () => action(openSource),
      // Confirmation choices are kept with the operation they confirm.
      requestLifecycle,
      confirmLifecycle: () => action(confirmLifecycle),
      cancelLifecycle: () => { if (!busy) setLifecycleAction(null); },
      requestDiscard: () => setConfirmDiscard(true),
      cancelDiscard: () => setConfirmDiscard(false),
      discardDraft: () => action(discardDraft),
      cancelCopy: () => setCopyCandidate(null),
      showTaxonomy: () => setManage(true),
      saveTaxonomy: next => action(() => saveTaxonomy(next)),
      openCategory: (kind, onAssign) => {
        setCategoryName(''); setMessage(''); setNewCategory({ kind, onAssign });
      },
      closeCategory: () => setNewCategory(null),
      changeCategoryName: name => setCategoryName(name),
      createCategory: () => action(createCategory),
      stopExtraction: () => action(async () => {
        setJob(await mutate('/api/workbench/jobs/' + job.id + '/cancel', {}));
      }),
      retryExtraction: () => action(async () => {
        await save();
        setJob(await mutate('/api/workbench/jobs/' + job.id + '/retry', { unitIds: [] }));
      }),
      supplement: files => action(() => supplement(files)),
      appendDraft: location => action(() => appendDraft(location)),
      cropOriginal: location => action(() => cropOriginal(location)),
      generateAssets: figureFileId => action(() => generateAssets(figureFileId)),
      refreshAssets: () => action(async () => setAssets(await get('/api/workbench/jobs/' + assets.id))),
    },
  };
}
