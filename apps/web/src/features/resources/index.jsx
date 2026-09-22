import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useScene } from "../workbench/useScene.js";
import { createResourcesClient, pendingStore } from "./client.js";
import { FileImage, Preview } from "./Preview.jsx";
import { Taxonomy } from "./Taxonomy.jsx";
import "./resources.css";
import { AddToLesson } from "./AddToLesson.jsx";
const root = "/api/modules/resources";
const metadata = (item) => ({
  baseVersion: item.version,
  title: item.title,
  folderId: item.folderId,
  tagIds: item.tagIds,
  note: item.note,
});

export default function ResourcesPage({
  transport,
  onOpenLesson,
  onPickResources,
}) {
  const shell = useWorkbenchShell();
  return (
    <ResourceWorkspace
      key={`${shell.accountKey}:${shell.generation}`}
      transport={transport}
      shell={shell}
      onOpenLesson={onOpenLesson}
      onPickResources={onPickResources}
    />
  );
}
function ResourceWorkspace({
  transport,
  shell,
  onOpenLesson,
  onPickResources,
}) {
  const controller = useMemo(() => new AbortController(), []);
  const client = useMemo(
    () =>
      createResourcesClient(transport, controller.signal, () => {
        controller.abort();
        shell.notifyIdentityLost?.();
      }),
    [transport, controller],
  );
  useEffect(() => () => controller.abort(), [controller]);
  const [scene, patchScene] = useScene(shell.accountKey, "resources", {
    q: "",
    folderId: "",
    tagIds: [],
    mediaType: "",
    state: "active",
    view: "grid",
    openId: null,
    selected: [],
    scroll: 0,
    pages: {},
    previewScroll: {},
    zoom: 100,
    drafts: {},
    supplement: null,
  });
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [items, setItems] = useState([]),
    [allItems, setAllItems] = useState([]),
    [tax, setTax] = useState({ version: 1, folders: [], tags: [] }),
    [files, setFiles] = useState({}),
    [previews, setPreviews] = useState({}),
    [usages, setUsages] = useState([]),
    [usageError, setUsageError] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(null),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [revision, setRevision] = useState(0),
    [dialog, setDialog] = useState(null),
    [conflict, setConflict] = useState(null),
    [addToLesson, setAddToLesson] = useState(null),
    [lastLesson, setLastLesson] = useState(null);
  const listRef = useRef(null),
    triggerRef = useRef(null),
    pendingRef = useRef(null),
    busyRef = useRef(false);
  const refresh = () => setRevision((n) => n + 1);
  useEffect(() => {
    pendingStore(shell.accountKey)
      .then((value) => {
        if (!controller.signal.aborted) {
          setPending(value ?? null);
          pendingRef.current = value ?? null;
          setLoaded(true);
        }
      })
      .catch((e) => setError("无法保存恢复记录，请允许浏览器存储后重试"));
  }, [shell.accountKey]);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    for (const name of ["q", "folderId", "mediaType", "state"])
      if (scene[name]) query.set(name, scene[name]);
    scene.tagIds.forEach((id) => query.append("tagIds", id));
    Promise.all([
      client.request(`${root}/items?${query}`),
      client.request(`${root}/taxonomy`),
      client.request(`${root}/items`),
      client.request(`${root}/items?state=deleted`),
    ])
      .then(async ([list, taxonomy, activeItems, deleted]) => {
        if (!active) return;
        setItems(list.items);
        setAllItems([...activeItems.items, ...deleted.items]);
        setTax(taxonomy);
        const ids = [
          ...new Set(
            [...activeItems.items, ...deleted.items].map((i) => i.fileId),
          ),
        ];
        const results = await Promise.all(
          ids.map(async (id) => [
            id,
            await client.request(`/api/workbench/files/${id}`),
            await client.request(`/api/workbench/files/${id}/preview`),
          ]),
        );
        if (active) {
          setFiles(Object.fromEntries(results.map(([id, file]) => [id, file])));
          setPreviews(
            Object.fromEntries(results.map(([id, , preview]) => [id, preview])),
          );
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [
    client,
    scene.q,
    scene.folderId,
    scene.mediaType,
    scene.state,
    JSON.stringify(scene.tagIds),
    revision,
  ]);
  const item = allItems.find((i) => i.id === scene.openId),
    file = item && files[item.fileId];
  const draft = item ? (scene.drafts[item.id] ?? metadata(item)) : null;
  useEffect(() => {
    let active = true;
    setUsages([]);
    setUsageError("");
    if (item)
      client
        .request(`/api/modules/lessons/v2/resource-usages/${item.id}`)
        .then((r) => active && setUsages(r.items))
        .catch((e) => active && setUsageError(e.message));
    return () => {
      active = false;
    };
  }, [client, item?.id, item?.version, revision]);
  useEffect(() => {
    if (!scene.openId && listRef.current)
      listRef.current.scrollTop = scene.scroll;
  }, [scene.openId, items]);
  async function remember(value) {
    await pendingStore(shell.accountKey, value);
    pendingRef.current = value;
    if (!controller.signal.aborted) setPending(value);
  }
  async function execute(record) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await remember(record);
      for (;;) {
        const value = await client.request(record.path, {
          method: record.method,
          input: record.input,
          key: record.key,
        });
        if (record.purpose === "upload") {
          if (!value.id || !value.name)
            throw Object.assign(new Error("上传结果未确认"), { unknown: true });
          const meta = record.meta;
          if (meta.kind === "supplement") {
            patchScene({
              supplement: {
                fileId: value.id,
                originalFileId: meta.originalFileId,
                resourceId: meta.id,
                baseVersion: meta.baseVersion,
                name: value.name,
                viewed: [],
              },
            });
            await remember(null);
            await requestPreview(value.id);
            break;
          }
          record = {
            key: crypto.randomUUID(),
            method: meta.kind === "replace" ? "PUT" : "POST",
            path:
              meta.kind === "replace"
                ? `${root}/items/${meta.id}/file`
                : `${root}/items`,
            input:
              meta.kind === "replace"
                ? { baseVersion: meta.baseVersion, fileId: value.id }
                : {
                    title: value.name,
                    folderId: meta.folderId || null,
                    tagIds: [],
                    note: "",
                    fileId: value.id,
                  },
            purpose: meta.kind === "replace" ? "replace" : "create",
          };
          await remember(record);
          continue;
        }
        if (!Number.isInteger(value.version))
          throw Object.assign(new Error("保存结果未确认"), { unknown: true });
        if (record.purpose === "metadata") {
          const live = sceneRef.current.drafts[value.id];
          if (JSON.stringify(live) === JSON.stringify(record.input)) {
            const drafts = { ...sceneRef.current.drafts };
            delete drafts[value.id];
            patchScene({ drafts });
          } else if (live)
            patchScene({
              drafts: {
                ...sceneRef.current.drafts,
                [value.id]: { ...live, baseVersion: value.version },
              },
            });
        }
        if (record.purpose === "taxonomy")
          patchScene({
            folderId: value.folders.some(
              (f) => f.id === sceneRef.current.folderId,
            )
              ? sceneRef.current.folderId
              : "",
            tagIds: sceneRef.current.tagIds.filter((id) =>
              value.tags.some((t) => t.id === id),
            ),
          });
        if (record.purpose === "create") patchScene({ openId: value.id });
        if (["supplement", "replace"].includes(record.purpose))
          patchScene({ supplement: null });
        if (record.purpose === "lesson") {
          setAddToLesson(null);
          setLastLesson({ lessonId: value.id, lessonTitle: value.title });
        }
        await remember(null);
        setMessage("已保存");
        setConflict(null);
        setDialog(null);
        refresh();
        if (["create", "replace"].includes(record.purpose))
          await requestPreview(value.fileId);
        break;
      }
      return true;
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e.message);
        setDialog(null);
        if (e.unknown) setAddToLesson(null);
        if (e.status === 409) {
          setConflict({ record });
          refresh();
        }
        if (!e.unknown) {
          await remember(null);
        }
      }
      return false;
    } finally {
      busyRef.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function requestPreview(id) {
    try {
      await client.request(`/api/workbench/files/${id}/preview`, {
        method: "POST",
        input: {},
        key: crypto.randomUUID(),
      });
      refresh();
    } catch (e) {
      setError(`原件已保存，预览未确认：${e.message}`);
    }
  }
  function write(path, input, purpose, method = "PUT") {
    if (pendingRef.current || busyRef.current) return Promise.resolve(false);
    return execute({ key: crypto.randomUUID(), path, method, input, purpose });
  }
  function upload(source, kind = "create") {
    if (!source || pendingRef.current || busyRef.current) return;
    const meta = {
      kind,
      folderId: scene.folderId,
      ...(item
        ? {
            id: item.id,
            baseVersion: item.version,
            originalFileId: item.fileId,
          }
        : {}),
    };
    if (kind === "replace") {
      setDialog({ kind: "replace", source, meta });
      return;
    }
    execute({
      key: crypto.randomUUID(),
      method: "POST",
      path: "/api/workbench/files",
      input: source,
      purpose: "upload",
      meta,
    });
  }
  function open(id, event) {
    triggerRef.current = event?.currentTarget;
    patchScene({ openId: id });
    setError("");
    setMessage("");
  }
  function close() {
    patchScene({ openId: null });
    refresh();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  function edit(patch) {
    patchScene({
      drafts: { ...sceneRef.current.drafts, [item.id]: { ...draft, ...patch } },
    });
    setMessage("未保存");
  }
  const disabled = busy || !!pending || !loaded;
  useEffect(() => {
    shell.registerTools([
      {
        id: "resource-taxonomy",
        label: "文件夹与标签",
        render: () => (
          <Taxonomy
            value={tax}
            scene={scene}
            patchScene={patchScene}
            disabled={disabled}
            items={allItems}
            onSave={(input) => write(`${root}/taxonomy`, input, "taxonomy")}
          />
        ),
      },
    ]);
  }, [shell.registerTools, tax, scene, disabled, allItems]);
  useEffect(() => () => shell.registerTools([]), [shell.registerTools]);
  const breadcrumbs = [];
  let folder = tax.folders.find((f) => f.id === scene.folderId);
  while (folder) {
    breadcrumbs.unshift(folder.name);
    folder = tax.folders.find((f) => f.id === folder.parentId);
  }
  const supplement = scene.supplement;
  const previewId =
    supplement && item && supplement.resourceId === item.id
      ? supplement.fileId
      : (item?.supplementPreviewFileId ?? item?.fileId);
  const page = scene.pages[previewId] ?? 1;
  return (
    <div className="res-workspace">
      <div className="res-status" aria-live="polite">
        {message}
        {lastLesson && (
          <button onClick={() => onOpenLesson?.(lastLesson)}>
            前往备课：{lastLesson.lessonTitle}
          </button>
        )}
        {error && <span role="alert">{error}</span>}
        {pending && !busy && (
          <button onClick={() => execute(pending)} disabled={busy}>
            重试确认原请求
          </button>
        )}
      </div>
      <section className="res-library" hidden={!!scene.openId}>
        <header className="res-header">
          <div>
            <h1>资源库</h1>
            <span className="res-muted">
              {breadcrumbs.join(" / ") || "全部资料"} · {items.length} 份
            </span>
          </div>
          <label
            className={`res-button res-primary ${disabled ? "is-disabled" : ""}`}
          >
            上传资料
            <input
              aria-label="上传资料"
              type="file"
              disabled={disabled}
              onChange={(e) => {
                upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        </header>
        <div className="res-filters">
          <input
            aria-label="搜索资料"
            placeholder="搜索名称、文件名或笔记"
            value={scene.q}
            onChange={(e) => patchScene({ q: e.target.value })}
          />
          <select
            aria-label="格式筛选"
            value={scene.mediaType}
            onChange={(e) => patchScene({ mediaType: e.target.value })}
          >
            <option value="">全部格式</option>
            {[
              ["application/pdf", "PDF"],
              ["application/msword", "DOC"],
              [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "DOCX",
              ],
              ["application/vnd.ms-powerpoint", "PPT"],
              [
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "PPTX",
              ],
              ["image/png", "PNG"],
              ["image/jpeg", "JPEG"],
              ["image/webp", "WebP"],
              ["text/html", "HTML"],
            ].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="资料状态"
            value={scene.state}
            onChange={(e) => patchScene({ state: e.target.value })}
          >
            <option value="active">正在使用</option>
            <option value="deleted">已删除</option>
          </select>
          <button
            aria-pressed={scene.view === "grid"}
            onClick={() =>
              patchScene({ view: scene.view === "grid" ? "list" : "grid" })
            }
          >
            {scene.view === "grid" ? "列表视图" : "缩略图视图"}
          </button>
        </div>
        {!!scene.tagIds.length && (
          <div className="res-chips">
            {scene.tagIds.map((id) => (
              <button
                key={id}
                onClick={() =>
                  patchScene({ tagIds: scene.tagIds.filter((t) => t !== id) })
                }
              >
                {tax.tags.find((t) => t.id === id)?.name} ×
              </button>
            ))}
          </div>
        )}
        <div
          className={`res-items res-${scene.view}`}
          ref={listRef}
          onScroll={(e) => patchScene({ scroll: e.currentTarget.scrollTop })}
        >
          {items.map((resource) => (
            <article className="res-card" key={resource.id}>
              <button
                className="res-card-open"
                onClick={(e) => open(resource.id, e)}
              >
                <div className="res-thumb">
                  {previews[resource.fileId]?.pages[0] ? (
                    <FileImage
                      client={client}
                      id={previews[resource.fileId].pages[0].imageFileId}
                      alt={`${resource.title} 缩略图`}
                    />
                  ) : (
                    <span>
                      {files[resource.fileId]?.name
                        .split(".")
                        .pop()
                        ?.toUpperCase() || "文件"}
                    </span>
                  )}
                </div>
                <div className="res-card-text">
                  <strong>{resource.title}</strong>
                  <span>{files[resource.fileId]?.name}</span>
                  <small>
                    {previews[resource.fileId]?.state === "limited"
                      ? "预览需核对"
                      : previews[resource.fileId]?.state === "failed"
                        ? "预览失败"
                        : `版本 ${resource.version}`}
                  </small>
                </div>
              </button>
              {onPickResources && (
                <label>
                  <input
                    type="checkbox"
                    checked={scene.selected.includes(resource.id)}
                    onChange={() =>
                      patchScene({
                        selected: scene.selected.includes(resource.id)
                          ? scene.selected.filter((id) => id !== resource.id)
                          : [...scene.selected, resource.id],
                      })
                    }
                  />
                  选择
                </label>
              )}
            </article>
          ))}
          {!items.length && (
            <p className="res-empty">
              {scene.q || scene.folderId || scene.tagIds.length
                ? "没有匹配的资料"
                : "上传第一份课件或文档"}
            </p>
          )}
        </div>
        {onPickResources && scene.selected.length > 0 && (
          <div className="res-actions">
            <button
              onClick={() =>
                onPickResources(
                  scene.selected
                    .map((id) => allItems.find((i) => i.id === id))
                    .filter(Boolean),
                )
              }
            >
              采用所选 {scene.selected.length} 份资料
            </button>
          </div>
        )}
      </section>
      {scene.openId && (
        <section className="res-detail">
          <header className="res-header">
            <button onClick={close}>返回资源库</button>
            <h1>{item?.title ?? "读取资料…"}</h1>
            <button
              disabled={!file}
              onClick={() =>
                client
                  .download(item.fileId, file.name)
                  .catch((e) => setError(e.message))
              }
            >
              下载原件
            </button>
          </header>
          {item && (
            <>
              <div className="res-detail-body">
                <div className="res-preview-column">
                  {item.supplementPreviewFileId && !supplement && (
                    <div className="res-warning">
                      正在查看本版本补充 PDF，原件保持不变。
                    </div>
                  )}
                  {supplement?.resourceId === item.id && (
                    <div className="res-warning">
                      核对补充 PDF：{supplement.name} · 已看{" "}
                      {supplement.viewed.length} 页
                      <button
                        disabled={
                          disabled ||
                          !supplement.total ||
                          supplement.viewed.length !== supplement.total
                        }
                        onClick={() =>
                          write(
                            `${root}/items/${item.id}/supplement-preview`,
                            {
                              baseVersion: supplement.baseVersion,
                              fileId: supplement.originalFileId,
                              supplementPreviewFileId: supplement.fileId,
                            },
                            "supplement",
                          )
                        }
                      >
                        采用补充 PDF
                      </button>
                      <button onClick={() => patchScene({ supplement: null })}>
                        取消补充
                      </button>
                    </div>
                  )}
                  <Preview
                    key={previewId}
                    client={client}
                    fileId={previewId}
                    page={page}
                    scrollPosition={
                      scene.previewScroll?.[`${previewId}:${page}`]
                    }
                    onScrollPosition={(position) =>
                      patchScene((current) => ({
                        previewScroll: {
                          ...current.previewScroll,
                          [`${previewId}:${page}`]: position,
                        },
                      }))
                    }
                    onPage={(p) =>
                      patchScene({
                        pages: { ...sceneRef.current.pages, [previewId]: p },
                      })
                    }
                    zoom={scene.zoom}
                    onZoom={(zoom) => patchScene({ zoom })}
                    onViewed={(p, preview) => {
                      const current = sceneRef.current.supplement;
                      if (
                        current?.fileId === previewId &&
                        preview.state === "ready"
                      )
                        patchScene({
                          supplement: {
                            ...current,
                            total: preview.pageCount,
                            viewed: [...new Set([...current.viewed, p])],
                          },
                        });
                    }}
                  />
                </div>
                <aside className="res-metadata">
                  <h2>资料信息</h2>
                  <label>
                    名称
                    <input
                      aria-label="资源名称"
                      maxLength={200}
                      value={draft.title}
                      onChange={(e) => edit({ title: e.target.value })}
                      disabled={!!item.deletedAt}
                    />
                  </label>
                  <label>
                    文件夹
                    <select
                      aria-label="资源文件夹"
                      value={draft.folderId ?? ""}
                      onChange={(e) =>
                        edit({ folderId: e.target.value || null })
                      }
                      disabled={!!item.deletedAt}
                    >
                      <option value="">根目录</option>
                      {tax.folders.map((f) => (
                        <option value={f.id} key={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset disabled={!!item.deletedAt}>
                    <legend>标签</legend>
                    {tax.tags.length ? (
                      tax.tags.map((t) => (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            checked={draft.tagIds.includes(t.id)}
                            onChange={() =>
                              edit({
                                tagIds: draft.tagIds.includes(t.id)
                                  ? draft.tagIds.filter((id) => id !== t.id)
                                  : [...draft.tagIds, t.id],
                              })
                            }
                          />
                          {t.name}
                        </label>
                      ))
                    ) : (
                      <span className="res-muted">可在右栏新建标签</span>
                    )}
                  </fieldset>
                  <label>
                    笔记
                    <textarea
                      aria-label="资源笔记"
                      maxLength={20000}
                      value={draft.note}
                      onChange={(e) => edit({ note: e.target.value })}
                      disabled={!!item.deletedAt}
                    />
                  </label>
                  <button
                    className="res-primary"
                    disabled={disabled || !!item.deletedAt}
                    onClick={() =>
                      write(`${root}/items/${item.id}`, draft, "metadata")
                    }
                  >
                    保存资料
                  </button>
                  <div className="res-file-info">
                    <strong>{file?.name}</strong>
                    <span>当前版本 {item.version}</span>
                    <label className="res-button">
                      更新文件
                      <input
                        aria-label="更新文件"
                        type="file"
                        disabled={disabled || !!item.deletedAt}
                        onChange={(e) => {
                          upload(e.target.files[0], "replace");
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="res-button">
                      补充 PDF 预览
                      <input
                        aria-label="补充 PDF 预览"
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={disabled || !!item.deletedAt}
                        onChange={(e) => {
                          upload(e.target.files[0], "supplement");
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {item.supplementPreviewFileId && (
                      <button
                        disabled={disabled || !!item.deletedAt}
                        onClick={() =>
                          write(
                            `${root}/items/${item.id}/supplement-preview`,
                            {
                              baseVersion: item.version,
                              fileId: item.fileId,
                              supplementPreviewFileId: null,
                            },
                            "supplement",
                          )
                        }
                      >
                        移除补充预览
                      </button>
                    )}
                  </div>
                  <button
                    disabled={disabled || !!item.deletedAt}
                    onClick={() => setAddToLesson([item])}
                  >
                    加入备课
                  </button>
                  <h2>使用位置 · {usages.length}</h2>
                  {usageError ? (
                    <p role="alert">
                      使用位置读取失败：{usageError}
                      <button onClick={refresh}>重新读取</button>
                    </p>
                  ) : usages.length ? (
                    usages.map((u) => (
                      <button
                        className="res-usage"
                        key={u.referenceId}
                        onClick={() => onOpenLesson?.(u)}
                      >
                        {u.lessonTitle} / {u.sectionTitle ?? "备用材料"}
                        <small>
                          采用版本 {u.adoptedVersion}
                          {u.adoptedVersion < item.version
                            ? " · 来源有更新"
                            : ""}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="res-muted">尚未用于备课</p>
                  )}
                  <button
                    disabled={disabled}
                    onClick={() => setDialog({ kind: "delete", item })}
                  >
                    {item.deletedAt ? "恢复资料" : "删除资料"}
                  </button>
                </aside>
              </div>
            </>
          )}
        </section>
      )}
      {addToLesson && (
        <AddToLesson
          client={client}
          resources={addToLesson}
          disabled={disabled}
          onClose={() => setAddToLesson(null)}
          onSave={(id, input) =>
            write(`/api/modules/lessons/v2/items/${id}`, input, "lesson")
          }
        />
      )}
      {conflict && (
        <div className="res-overlay">
          <div className="res-dialog" role="dialog" aria-label="版本冲突">
            <h2>内容已在其他地方更新</h2>
            <p>
              你的输入仍保留。当前资源：{item?.title}，版本 {item?.version}。
            </p>
            <pre>{item?.note}</pre>
            <button
              onClick={() => {
                if (item && conflict.record.purpose === "metadata")
                  edit({ baseVersion: item.version });
                setConflict(null);
                setError("请核对分类和笔记，再次保存");
              }}
            >
              保留草稿并对照当前版本
            </button>
            <button onClick={() => setConflict(null)}>稍后处理</button>
          </div>
        </div>
      )}
      {dialog && (
        <div className="res-overlay">
          <div
            className="res-dialog"
            role="dialog"
            aria-label={
              dialog.kind === "replace" ? "更新文件确认" : "删除恢复确认"
            }
          >
            <h2>
              {dialog.kind === "replace"
                ? "更新当前文件"
                : dialog.item.deletedAt
                  ? "恢复资料"
                  : "删除资料"}
            </h2>
            {dialog.kind === "replace" ? (
              <>
                <p>
                  {file?.name} → {dialog.source.name}
                </p>
                <p>
                  {usages.length} 处使用保持采用的旧文件。名称、分类和笔记保留。
                </p>
              </>
            ) : (
              <p>原文件与已有备课引用保留。</p>
            )}
            <div className="res-actions">
              <button
                disabled={disabled}
                onClick={() =>
                  dialog.kind === "replace"
                    ? execute({
                        key: crypto.randomUUID(),
                        method: "POST",
                        path: "/api/workbench/files",
                        input: dialog.source,
                        purpose: "upload",
                        meta: dialog.meta,
                      })
                    : write(
                        `${root}/items/${dialog.item.id}/deletion`,
                        {
                          baseVersion: dialog.item.version,
                          deleted: !dialog.item.deletedAt,
                        },
                        "deletion",
                        "POST",
                      )
                }
              >
                确认
                {dialog.kind === "replace"
                  ? "更新"
                  : dialog.item.deletedAt
                    ? "恢复"
                    : "删除"}
              </button>
              <button onClick={() => setDialog(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
