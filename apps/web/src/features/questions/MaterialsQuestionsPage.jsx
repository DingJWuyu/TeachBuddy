import React, { useEffect, useRef, useState } from "react";
import { questionDocuments, supportedDocument } from "@refatos/shared";
import { DocumentEditor, DocumentView } from "../workbench/materials/index.js";
import { readLocal, writeLocal, removeLocal } from "../workbench/storage.js";
import {
  get,
  write,
  upload,
  download,
  empty,
  sourceText,
  documentAssets,
} from "./materials-api.js";
import { useScrollRestore } from "../workbench/useScrollRestore.js";
import OriginalPane from "./OriginalPane.jsx";
import ResizeDivider from "./ResizeDivider.jsx";
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
    [conflict, setConflict] = useState(null),
    [includeAnswers, setIncludeAnswers] = useState(false);
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
  const unsupportedQuestion = value && scene.kind !== "import" && value.body
    ? questionDocuments(value).some(([, document]) => !supportedDocument(document))
    : false;
  useEffect(() => {
    writeLocal(accountKey, "questions-collection", {
      capture,
      text,
      title,
      origin,
      pages,
    });
  }, [capture, text, title, origin, pages]);
  const pending = useRef(readLocal(accountKey, "questions-materials-pending")),
    uploadKeys = useRef(new WeakMap()),
    alive = useRef(true);
  const picker = useRef(null);
  const [splitAt, setSplitAt] = useState(1),
    [mergeId, setMergeId] = useState("");
  useEffect(
    () => () => {
      alive.current = false;
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
      patchScene({ kind: "question", id: requestedId });
  }, [requestedId]);
  const localKey = `questions-materials-draft:${scene.kind}:${scene.id ?? "new"}`;
  const editorRef = useRef(null);
  editorRef.current = {value, scene, localKey};
  const refreshSequence = useRef(0);
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
    }
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, [
    scene.q,
    scene.state,
    scene.typeId,
    JSON.stringify(scene.tagIds),
    scene.starred,
  ]);
  useEffect(() => {
    let live = true;
    setValue(null);
    setJob(null);
    setSelected(null);
    setSource(null);
    setConflict(null);
    setAssets(null);
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
          setValue(local ? {...local, deletedAt: v.deletedAt} : v);
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
        .catch((e) => live && setMessage(e.message));
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
      throw Error("上次请求已确认，请核对当前版本后重新保存。本地修改仍保留。");
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
      if (e.problem && e.problem.kind !== "unconfirmed") {
        pending.current = null;
        removeLocal(accountKey, "questions-materials-pending");
      }
      throw e;
    }
  }
  const open = (kind, id, compare = false) => {
    if (scene.kind === kind && scene.id === id) return;
    setValue(null);
    patchScene({ kind, id, draftId: null, original: {}, compare });
    setMessage("");
  };
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
  async function uploadFile(file) {
    if (!uploadKeys.current.has(file))
      uploadKeys.current.set(file, crypto.randomUUID());
    return upload(transport, file, uploadKeys.current.get(file));
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
    removeLocal(accountKey, "questions-collection");
    await refresh();
    open("import", result.id);
  }
  const draft = value?.drafts?.find((x) => x.id === selected),
    locked =
      busy || Boolean(value?.deletedAt) || active.has(job?.state) || draft?.disposition === "confirmed";
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
    <div className="q-taxonomy-tools">
      <select
        aria-label="筛选题型"
        value={scene.typeId ?? ""}
        onChange={(e) => patchScene({ typeId: e.target.value })}
      >
        <option value="">全部题型</option>
        {taxonomy.types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="q-tools">
        {taxonomy.tags.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={scene.tagIds?.includes(t.id) ?? false}
              onChange={(e) =>
                patchScene({
                  tagIds: e.target.checked
                    ? [...(scene.tagIds ?? []), t.id]
                    : scene.tagIds.filter((x) => x !== t.id),
                })
              }
            />
            {t.name}
          </label>
        ))}
      </div>
      {manage && (
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
      )}
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
    <div ref={pageNode} className="q-workspace" data-review={scene.kind === "import"}
      style={{"--q-ratio": scene.compare ? (scene.compareWidth ?? 0.5) : (scene.listWidth ?? 0.32)}}
      data-compare={Boolean(scene.compare && value?.source?.kind === "copy")}>
      {scene.kind !== "import" && <ResizeDivider
        value={scene.compare ? (scene.compareWidth ?? 0.5) : (scene.listWidth ?? 0.32)}
        label={scene.compare ? "调整原题对照宽度" : "调整题目列表宽度"}
        onChange={width => patchScene(scene.compare ? {compareWidth: width} : {listWidth: width})} />}
      <aside className="q-finder">
        <header>
          <strong>题库</strong>
          <div className="q-tools">
            <button
              onClick={() => {
                setCapture("文字");
                setChosenFiles([]);
              }}
            >
              收录
            </button>
            <button
              onClick={() => open("new", null)}
            >
              自建
            </button>
          </div>
        </header>
        <input
          aria-label="搜索题目"
          placeholder="搜索题干、公式或笔记"
          value={scene.q ?? ""}
          onChange={(e) => patchScene({ q: e.target.value })}
        />
        <div className="q-tools">
          <select
            aria-label="删除状态"
            value={scene.state}
            onChange={(e) => patchScene({ state: e.target.value })}
          >
            <option value="active">全部题目</option>
            <option value="deleted">已删除</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={scene.starred}
              onChange={(e) => patchScene({ starred: e.target.checked })}
            />
            标记
          </label>
          <button
            onClick={() => {
              setManage(onOpenTools ? true : !manage);
              onOpenTools?.();
            }}
          >
            分类管理
          </button>
        </div>
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
          <details open>
            <summary>待整理材料 · {imports.length}</summary>
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
          </details>
          {items.map((q) => (
            <div className="q-list-entry" key={q.id}>
            {onAddToLesson && !q.deletedAt && <input type="checkbox"
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
                {q.title || "未命名题目"}
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
            if (selected.some(q => q.deletedAt)) throw Error("所选题目中有已删除题目，请取消选择后重试。");
            onAddToLesson(selected);
          })}>加入备课（{scene.selectedIds.length} 题）</button>
          <button onClick={() => patchScene({selectedIds: []})}>取消选择</button>
        </div>}
      </aside>
      {scene.compare && value?.source?.kind === "copy" && <section className="q-copy-source" aria-label="原题对照">
        <header><strong>原题 · 采用版本 {value.source.questionVersion}</strong>
          <button onClick={() => patchScene({compare: false})}>结束对照</button></header>
        <h3>{value.source.snapshot.title || "原题"}</h3>
        <DocumentView value={value.source.snapshot.body} />
        <details open><summary>答案解析</summary><DocumentView value={value.source.snapshot.solution} /></details>
        <button onClick={() => open("question", value.source.questionId)}>查看当前原题</button>
      </section>}
      <main className="q-main">
        <div className="q-message" role="status">
          {message}
          {pending.current && (
            <button
              onClick={() =>
                action(async () => {
                  const r = pending.current;
                  await mutate(r.path, r.input, r.method);
                  setMessage("原请求已确认，请重新打开查看");
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
          <p className="q-empty">选择一道题或待整理材料</p>
        ) : scene.kind === "import" ? (
          <>
            <header>
              <button onClick={() => open("list", null)}>返回题库</button>
              <strong>{value.title}</strong>
              <span>
                {stateNames[job?.state]}{" "}
                {job?.progress.total !== null
                  ? `${job?.progress.completed ?? 0}/${job?.progress.total ?? 0}`
                  : ""}
              </span>
              <div className="q-tools">
                <button
                  disabled={busy || active.has(job?.state)}
                  onClick={() => action(save)}
                >
                  保存校对
                </button>
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
                ) : (
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
                <button
                  disabled={busy || active.has(job?.state)}
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
                    })
                  }
                >
                  补充题目草稿
                </button>
                <button
                  onClick={() =>
                    action(async () => {
                      setValue(
                        await mutate("/imports/" + value.id + "/deletion", {
                          baseVersion: value.version,
                          deleted: !value.deletedAt,
                        }),
                      );
                      await refresh();
                    })
                  }
                >
                  {value.deletedAt ? "恢复材料" : "删除材料"}
                </button>
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
              <section className="q-review-result">
                <nav className="q-tools">
                  {value.drafts.map((d, i) => (
                    <button
                      className={selected === d.id ? "selected" : ""}
                      key={d.id}
                      onClick={() => {
                        setSelected(d.id);
                        patchScene({ draftId: d.id, original: {} });
                      }}
                    >
                      {i + 1}{" "}
                      {d.disposition === "confirmed"
                        ? "已入库"
                        : d.disposition === "ignored"
                          ? "已忽略"
                          : "待校对"}
                    </button>
                  ))}
                </nav>
                {draft ? (
                  <fieldset disabled={locked}>
                    <input
                      aria-label="草稿标题"
                      value={draft.title}
                      onChange={(e) => editDraft({ title: e.target.value })}
                    />
                    <DocumentEditor
                      allowTeacherNotes={false}
                      value={draft.body}
                      onChange={(body) => editDraft({ body })}
                      readOnly={locked}
                      onPickImage={pickImage}
                    />
                    <label>
                      答案状态
                      <select
                        aria-label="答案状态"
                        value={draft.answerStatus}
                        onChange={(e) =>
                          editDraft({
                            answerStatus: e.target.value,
                            ...(e.target.value === "absent"
                              ? { solution: empty() }
                              : {}),
                          })
                        }
                      >
                        <option value="absent">未提供答案</option>
                        <option value="present">已有答案</option>
                        <option value="unresolved">答案待核对</option>
                      </select>
                    </label>
                    {draft.answerStatus !== "absent" && (
                      <DocumentEditor
                        allowTeacherNotes={false}
                        value={draft.solution}
                        onChange={(solution) => editDraft({ solution })}
                        onPickImage={pickImage}
                      />
                    )}{" "}
                    {classification(draft, editDraft)}
                    {draft.issues.map((issue) => (
                      <label className="q-issue" key={issue.id}>
                        {
                          {
                            "split-boundary": "题目边界",
                            "uncertain-formula": "公式",
                            "missing-figure": "缺少配图",
                            "unverified-location": "来源位置",
                            "incomplete-answer": "答案不完整",
                            "uncertain-text": "文字",
                            "truncated-input": "内容截断",
                          }[issue.code]
                        }
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
                    ))}
                    <div className="q-tools">
                      <label>
                        在第{" "}
                        <input
                          aria-label="拆分段落"
                          type="number"
                          min="1"
                          max={draft.body.blocks.length - 1}
                          value={splitAt}
                          onChange={(e) => setSplitAt(Number(e.target.value))}
                        />{" "}
                        段后
                      </label>
                      <button
                        disabled={draft.body.blocks.length < 2}
                        onClick={() => {
                          if (
                            splitAt < 1 ||
                            splitAt >= draft.body.blocks.length
                          )
                            return;
                          const copy = {
                            ...structuredClone(draft),
                            id: crypto.randomUUID(),
                            title: draft.title + "（续）",
                            body: {
                              ...draft.body,
                              blocks: draft.body.blocks.slice(splitAt),
                            },
                            solution: empty(),
                            answerStatus: "absent",
                            parts: draft.parts.filter(
                              (p) => p.role !== "solution",
                            ),
                            issues: draft.issues
                              .filter((i) => i.field !== "/solution")
                              .map((i) => ({ ...i, id: crypto.randomUUID() })),
                          };
                          change({
                            ...value,
                            drafts: value.drafts.flatMap((d) =>
                              d.id === selected
                                ? [
                                    {
                                      ...d,
                                      body: {
                                        ...d.body,
                                        blocks: d.body.blocks.slice(0, splitAt),
                                      },
                                    },
                                    copy,
                                  ]
                                : [d],
                            ),
                          });
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
                      <button
                        className="primary"
                        onClick={() =>
                          action(async () => {
                            const saved = await save();
                            const result = await mutate(
                              "/imports/" + saved.id + "/commit",
                              {
                                baseVersion: saved.version,
                                draftIds: [selected],
                              },
                            );
                            setValue(result.import);
                            setMessage("已收录 1 题");
                            await refresh();
                          })
                        }
                      >
                        确认收录
                      </button>
                    </div>
                  </fieldset>
                ) : (
                  <p>原稿保留在左侧。处理完成后，题目草稿会出现在这里。</p>
                )}
                {draft?.questionId && (
                  <button onClick={() => open("question", draft.questionId)}>
                    查看已入库题目
                  </button>
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
              </section>
            </div>
          </>
        ) : (
          <section className="q-question" ref={questionScroll.ref} onScroll={questionScroll.onScroll}>
            {onReturnToRecord && <button onClick={onReturnToRecord}>返回教学记录</button>}
            <header>
              <strong>
                {scene.kind === "new" ? "自建题目" : value.title || "题目"}
              </strong>
              <div className="q-tools">
                <button
                  className="primary"
                  disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                  onClick={() =>
                    action(async () => {
                      if (scene.kind === "new") {
                        const q = await mutate("/items", value);
                        removeLocal(accountKey, localKey);
                        await refresh();
                        open("question", q.id);
                        setMessage("题目已保存");
                      } else await save();
                    })
                  }
                >
                  保存题目
                </button>
                {value.id && (
                  <>
                    <button
                      disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                      onClick={() =>
                        action(async () => {
                          const q = await mutate(
                            "/items/" + value.id + "/copies",
                            {
                              baseVersion: value.version,
                              ...editableFields(value),
                              note: "",
                              starred: false,
                            },
                          );
                          await refresh();
                          open("question", q.id, true);
                        })
                      }
                    >
                      复制改编
                    </button>
                    <button
                      disabled={busy || unsupportedQuestion}
                      onClick={() =>
                        action(async () => {
                          const edited = Boolean(readLocal(accountKey, localKey));
                          const result = await mutate("/items/" + value.id + "/deletion", {
                              baseVersion: value.version,
                              deleted: !value.deletedAt,
                            });
                          if (edited) change({...result, ...editableFields(value)});
                          else setValue(result);
                          await refresh();
                        })
                      }
                    >
                      {value.deletedAt ? "恢复题目" : "删除题目"}
                    </button>
                    {onAddToLesson && (
                      <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} data-return-focus="add-to-lesson"
                        onClick={() => action(async () => onAddToLesson([readLocal(accountKey, localKey) ? await save() : value]))}>
                        {readLocal(accountKey, localKey) ? "保存并加入备课" : "加入备课"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </header>
            {unsupportedQuestion && (
              <p role="status">题目包含暂不支持的文档版本，原数据只读保留。</p>
            )}
            <fieldset disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}>
              <input
                aria-label="题目标题"
                placeholder="题目标题"
                value={value.title}
                onChange={(e) => change({ ...value, title: e.target.value })}
              />
              <DocumentEditor
                allowTeacherNotes={false}
                value={value.body}
                onChange={(body) => change({ ...value, body })}
                onPickImage={pickImage}
              />
              <label>
                答案状态
                <select
                  aria-label="答案状态"
                  value={value.answerStatus}
                  onChange={(e) =>
                    change({
                      ...value,
                      answerStatus: e.target.value,
                      ...(e.target.value === "absent"
                        ? { solution: empty() }
                        : {}),
                    })
                  }
                >
                  <option value="absent">未提供答案</option>
                  <option value="present">已有答案</option>
                </select>
              </label>
              {(value.answerStatus === "present" || !supportedDocument(value.solution)) && (
                <DocumentEditor
                  allowTeacherNotes={false}
                  value={value.solution}
                  onChange={(solution) => change({ ...value, solution })}
                  onPickImage={pickImage}
                />
              )}{" "}
              {classification(value, (patch) => change({ ...value, ...patch }))}
              <label>
                长期笔记
                <textarea
                  value={value.note}
                  onChange={(e) => change({ ...value, note: e.target.value })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={value.starred}
                  onChange={(e) =>
                    change({ ...value, starred: e.target.checked })
                  }
                />
                标记题目
              </label>
            </fieldset>
            {value.source?.kind === "import" && (
              <button onClick={() => {
                open("import", value.source.importId);
                patchScene({draftId: value.source.draftId});
              }}>
                对照原稿
              </button>
            )}
            {value.source?.kind === "copy" && (
              <>
                <button onClick={() => patchScene({compare: !scene.compare})}>
                  {scene.compare ? "结束原题对照" : "对照原题"}
                </button>
                <button
                  onClick={() => open("question", value.source.questionId)}
                >
                  查看原题
                </button>
                {!scene.compare && <details>
                  <summary>采用时的原题</summary>
                  <DocumentView value={value.source.snapshot.body} />
                  <DocumentView value={value.source.snapshot.solution} />
                </details>}
              </>
            )}
            {copies.map((q) => (
              <button key={q.id} onClick={() => open("question", q.id)}>
                改编题：{q.title || "未命名"}
              </button>
            ))}
            <details open={Boolean(scene.usagesOpen)} onToggle={(event) => {
              if (event.currentTarget.open !== Boolean(scene.usagesOpen))
                patchScene({ usagesOpen: event.currentTarget.open });
            }}>
              <summary>使用位置</summary>
              {usages === null ? (
                <p>使用位置尚未接入</p>
              ) : (
                usages.map((u) => (
                  <p key={u.referenceId}>
                    <a className="q-usage-link" data-return-focus={`usage-${u.referenceId}`} href={`/lessons/${u.lessonId}`} onClick={(event) => {
                      if (!onOpenLesson || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onOpenLesson(u.lessonId, u.referenceId, `usage-${u.referenceId}`);
                    }}>
                      {u.lessonTitle ?? u.title} {u.sectionTitle ?? "本课材料"}
                    </a>
                  </p>
                ))
              )}
            </details>
            {value.id && renderTeachingFeedback && (
              <details open={Boolean(scene.teachingOpen)} onToggle={(event) => {
                if (event.currentTarget.open !== Boolean(scene.teachingOpen))
                  patchScene({ teachingOpen: event.currentTarget.open });
              }}>
                <summary>教学反馈</summary>
                {renderTeachingFeedback(value.id)}
              </details>
            )}
            {value.id && (
              <details>
                <summary>用于 PPT</summary>
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
                        const current = readLocal(accountKey, localKey) ? await save() : value;
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
                    生成透明题面 PNG
                  </button>
                  <button
                    disabled={!assets}
                    onClick={() =>
                      action(async () =>
                        setAssets(
                          await get("/api/workbench/jobs/" + assets.id),
                        ),
                      )
                    }
                  >
                    查看生成结果
                  </button>
                </div>
                <div className="q-tools">
                  {documentAssets(value.body).figures.map((figure, i) => (
                    <button
                      key={i}
                      disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                      onClick={() =>
                        action(async () => {
                          const current = readLocal(accountKey, localKey) ? await save() : value;
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
                      生成配图 {i + 1} PNG
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
              </details>
            )}
          </section>
        )}
      </main>
      {capture && (
        <div className="q-modal-backdrop">
          <section className="q-modal" role="dialog" aria-label="收录材料">
            <header>
              <strong>收录材料</strong>
              <button onClick={() => setCapture(null)}>关闭</button>
            </header>
            <nav className="q-tools">
              {["图片", "PDF", "Word", "文字"].map((x) => (
                <button
                  className={capture === x ? "selected" : ""}
                  key={x}
                  onClick={() => {
                    setCapture(x);
                    setChosenFiles([]);
                  }}
                >
                  {x}
                </button>
              ))}
            </nav>
            <label>
              材料名称
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              出处
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </label>
            {capture === "文字" ? (
              <textarea
                aria-label="原始文字"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            ) : (
              <>
                <input
                  type="file"
                  aria-label="选择原稿"
                  multiple={capture === "图片"}
                  accept={
                    capture === "图片"
                      ? "image/png,image/jpeg,image/webp"
                      : capture === "PDF"
                        ? ".pdf"
                        : ".doc,.docx"
                  }
                  onChange={(e) => setChosenFiles([...e.target.files])}
                />
                {chosenFiles.map((f, i) => (
                  <div key={i}>
                    {f.name}
                    <button
                      disabled={!i}
                      onClick={() =>
                        setChosenFiles((a) => {
                          const b = [...a];
                          [b[i - 1], b[i]] = [b[i], b[i - 1]];
                          return b;
                        })
                      }
                    >
                      上移
                    </button>
                  </div>
                ))}
                {capture !== "图片" && (
                  <label>
                    仅处理页码（逗号分隔，留空为全部）
                    <input
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                (capture === "文字" ? !text.trim() : !chosenFiles.length)
              }
              onClick={() => action(collect)}
            >
              {busy ? "正在保存原稿" : "保存原稿并整理"}
            </button>
            {message && <p role="alert">{message}</p>}
          </section>
        </div>
      )}
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
                if (
                  window.confirm(
                    `删除“${t.name}”并解除关联？影响 ${affected} 题（含已删除题）。`,
                  )
                )
                  setDraft({
                    ...draft,
                    [k]: draft[k].filter((x) => x.id !== t.id),
                  });
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
    </div>
  );
}
