import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useScene } from "../workbench/useScene.js";
import { useForegroundRefresh } from "../workbench/useForegroundRefresh.js";
import { createResourcesClient, pendingStore } from "./client.js";
import { reselectDeviceFile } from "../workbench/deviceRequestStore.js";
import { Preview } from "./Preview.jsx";
import { Library } from "./Library.jsx";
import { ResourceInfo } from "./ResourceInfo.jsx";
import { Icon } from "../workbench/chrome/icons.jsx";
import { Popover } from "../workbench/ModuleOverlays.jsx";
import { Taxonomy, TaxonomyDialog } from "./Taxonomy.jsx";
import "./resources.css";
import { ResourceDialog } from "./ResourceDialog.jsx";
import { ModulePresence } from "../workbench/ModuleMotion.jsx";
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
    libraryPanelOpen: false,
    filtersOpen: false,
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
    [listLoading, setListLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [dialog, setDialog] = useState(null),
    [conflict, setConflict] = useState(null),
    [addToLesson, setAddToLesson] = useState(null),
    [lastLesson, setLastLesson] = useState(null);
  const listRef = useRef(null),
    triggerRef = useRef(null),
    pendingRef = useRef(null),
    busyRef = useRef(false),
    replaceInput = useRef(null),
    supplementInput = useRef(null);
  const refresh = () => setRevision((n) => n + 1);
  useEffect(() => {
    if (!message || busy || pending || error) return;
    const timer = setTimeout(() => {
      setMessage("");
      setLastLesson(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, busy, pending, error]);
  useForegroundRefresh(() => {
    if (!busyRef.current && !controller.signal.aborted) refresh();
  });
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
    setListLoading(true);
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
      .catch((e) => active && setError(e.message))
      .finally(() => active && setListLoading(false));
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
    if (record.requiresReselection) {
      setError("请重新选择原文件核对名称、长度和内容，再确认上传");
      return false;
    }
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
        if (
          record.purpose === "purge"
            ? value.permanentlyDeleted !== true || !value.id
            : !Number.isInteger(value.version)
        )
          throw Object.assign(new Error("保存结果未确认"), { unknown: true });
        if (record.purpose === "purge" || record.purpose === "deletion") {
          const purged = record.purpose === "purge";
          const drafts = { ...sceneRef.current.drafts };
          if (purged) delete drafts[value.id];
          else if (drafts[value.id])
            drafts[value.id] = {
              ...drafts[value.id],
              baseVersion: value.version,
            };
          patchScene({
            drafts,
            selected: sceneRef.current.selected.filter((id) => id !== value.id),
            ...(sceneRef.current.supplement?.resourceId === value.id
              ? { supplement: null }
              : {}),
            ...(!purged && !value.deletedAt ? { state: "active" } : {}),
          });
          setAllItems((current) =>
            purged
              ? current.filter((item) => item.id !== value.id)
              : current.map((item) => (item.id === value.id ? value : item)),
          );
          setItems((current) => current.filter((item) => item.id !== value.id));
          if (purged || value.deletedAt) close(true);
        }
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
        if (record.purpose === "taxonomy") {
          setTax(value);
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
        }
        if (record.purpose === "create") open(value.id);
        if (["supplement", "replace"].includes(record.purpose))
          patchScene({ supplement: null });
        if (record.purpose === "lesson") {
          setAddToLesson(null);
          setLastLesson({ lessonId: value.id, lessonTitle: value.title });
        }
        await remember(null);
        setMessage(
          {
            create: "文件已保存",
            replace: "文件已更新",
            metadata: "资料信息已保存",
            taxonomy: "整理已保存",
            supplement: "已采用补充预览",
            lesson: "已加入备课",
            deletion: value.deletedAt
              ? "资料已归档，可在已归档资料中恢复"
              : "资料已恢复",
            purge: "资料已彻底删除",
          }[record.purpose] ?? "已保存",
        );
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
    patchScene({
      openId: id,
      libraryPanelOpen: Boolean(
        shell.isPanelOpen && shell.panelMode === "resource-taxonomy",
      ),
    });
    if (shell.isPanelOpen && shell.panelMode === "resource-taxonomy")
      shell.closePanel?.();
    setError("");
    setMessage("");
  }
  function close(removed = false) {
    patchScene({ openId: null });
    if (!shell.isPanelOpen || shell.panelMode === "resource-taxonomy") {
      if (scene.libraryPanelOpen) shell.openPanel?.("resource-taxonomy");
      else if (shell.isPanelOpen) shell.closePanel?.();
    }
    refresh();
    requestAnimationFrame(() => {
      if (!removed && triggerRef.current?.isConnected)
        triggerRef.current.focus();
      else
        listRef.current?.closest(".res-library")?.querySelector("h1")?.focus();
    });
  }
  function edit(patch) {
    patchScene({
      drafts: { ...sceneRef.current.drafts, [item.id]: { ...draft, ...patch } },
    });
    setMessage("");
  }
  const disabled = busy || !!pending || !loaded;
  const dirty = Boolean(
    item &&
      draft &&
      ["title", "folderId", "tagIds", "note"].some(
        (key) => JSON.stringify(draft[key]) !== JSON.stringify(item[key]),
      ),
  );
  function manageTaxonomy(kind, entry, attach = false) {
    patchScene({
      taxonomyDraft: {
        edit: { kind, item: entry },
        name: entry?.name ?? "",
        parentId: entry?.parentId ?? "",
        attachTo: attach ? item?.id : null,
      },
    });
  }
  function changeTaxonomy(patch) {
    patchScene((current) => ({
      taxonomyDraft: { ...current.taxonomyDraft, ...patch },
    }));
  }
  async function saveTaxonomy(input, created) {
    const before = scene.taxonomyDraft;
    if (!(await write(`${root}/taxonomy`, input, "taxonomy"))) return;
    if (created && before.attachTo && !before.edit.item) {
      const currentItem = allItems.find(
        (entry) => entry.id === before.attachTo,
      );
      if (currentItem) {
        const current =
          sceneRef.current.drafts[currentItem.id] ?? metadata(currentItem);
        patchScene((state) => ({
          drafts: {
            ...state.drafts,
            [currentItem.id]: {
              ...current,
              ...(before.edit.kind === "folder"
                ? { folderId: created.id }
                : { tagIds: [...new Set([...current.tagIds, created.id])] }),
            },
          },
        }));
      }
    }
    patchScene({ taxonomyDraft: null });
  }
  const infoOpen = shell.isPanelOpen && shell.panelMode === "resource-taxonomy";
  function toggleTools() {
    if (infoOpen) shell.closePanel?.();
    else shell.openPanel?.("resource-taxonomy");
  }
  useEffect(() => {
    shell.registerTools([
      {
        id: "resource-taxonomy",
        label: scene.openId ? "资料信息" : "文件夹与标签",
        render: () =>
          scene.openId ? (
            <ResourceInfo
              item={item}
              file={file}
              draft={draft}
              tax={tax}
              onEdit={edit}
              onSave={() =>
                write(`${root}/items/${item.id}`, draft, "metadata")
              }
              onManage={(kind) => manageTaxonomy(kind, null, true)}
              disabled={disabled}
              dirty={dirty}
              usages={usages}
              usageError={usageError}
              onRefresh={refresh}
              onOpenLesson={onOpenLesson}
            />
          ) : (
            <Taxonomy
              value={tax}
              scene={scene}
              patchScene={patchScene}
              disabled={disabled}
              onManage={manageTaxonomy}
            />
          ),
      },
    ]);
  }, [
    shell.registerTools,
    tax,
    scene,
    disabled,
    allItems,
    files,
    usages,
    usageError,
  ]);
  useEffect(() => () => shell.registerTools([]), [shell.registerTools]);
  const breadcrumbs = [];
  let folder = tax.folders.find((f) => f.id === scene.folderId);
  while (folder) {
    breadcrumbs.unshift(folder);
    folder = tax.folders.find((f) => f.id === folder.parentId);
  }
  const supplement = scene.supplement;
  const previewId =
    supplement && item && supplement.resourceId === item.id
      ? supplement.fileId
      : (item?.supplementPreviewFileId ?? item?.fileId);
  const page = scene.pages[previewId] ?? 1;
  return (
    <div className="res-workspace res-ui wb-module">
      <Library
        scene={scene}
        patchScene={patchScene}
        items={items}
        allItems={allItems}
        tax={tax}
        files={files}
        previews={previews}
        client={client}
        busy={disabled}
        loading={listLoading}
        listRef={listRef}
        breadcrumbs={breadcrumbs}
        onOpen={open}
        onUpload={upload}
        onFolders={shell.openPanel ? toggleTools : null}
        foldersOpen={infoOpen}
        onPickResources={onPickResources}
      />
      {scene.openId && (
        <section className="res-detail">
          <header className="res-header res-surface">
            <button className="res-back-button" onClick={() => close()}>
              <Icon name="arrowLeft" size={17} />
              <span>返回资源库</span>
            </button>
            <div className="res-detail-title">
              <h1>{item?.title ?? "读取资料…"}</h1>
              <span className="res-muted">
                {item?.deletedAt ? "已归档资料" : file?.name}
              </span>
            </div>
            <div className="res-header-actions">
              {item?.deletedAt ? (
                <button
                  className="res-primary"
                  disabled={disabled}
                  onClick={() => setDialog({ kind: "delete", item })}
                >
                  恢复资料
                </button>
              ) : (
                <button
                  disabled={disabled || !item}
                  className="res-primary"
                  onClick={() => setAddToLesson([item])}
                >
                  <Icon name="lessons" size={16} />
                  加入备课
                </button>
              )}
              <button
                disabled={!file}
                onClick={() =>
                  client
                    .download(item.fileId, file.name)
                    .catch((error) => setError(error.message))
                }
              >
                <Icon name="arrowDown" size={16} />
                <span>下载原件</span>
              </button>
              <button
                aria-expanded={Boolean(infoOpen)}
                aria-label="资料信息"
                title="资料信息"
                className={`res-info-toggle${infoOpen ? " is-selected" : ""}`}
                onClick={toggleTools}
              >
                <Icon name="info" size={17} />
                <span>资料信息</span>
                {dirty && <span className="res-unsaved-dot" />}
              </button>
              <Popover
                label="资料更多操作"
                className="res-menu"
                buttonClassName="res-icon-button"
              >
                {({ close: closeMenu }) => (
                  <>
                    {!item?.deletedAt && (
                      <>
                        <button
                          role="menuitem"
                          disabled={disabled || !item || !!item.deletedAt}
                          onClick={() => {
                            closeMenu();
                            replaceInput.current?.click();
                          }}
                        >
                          <Icon name="upload" size={16} />
                          更新文件
                        </button>
                        <button
                          role="menuitem"
                          disabled={disabled || !item || !!item.deletedAt}
                          onClick={() => {
                            closeMenu();
                            supplementInput.current?.click();
                          }}
                        >
                          <Icon name="file" size={16} />
                          补充 PDF 预览
                        </button>
                        {item?.supplementPreviewFileId && (
                          <button
                            role="menuitem"
                            disabled={disabled || !!item.deletedAt}
                            onClick={() => {
                              closeMenu();
                              write(
                                `${root}/items/${item.id}/supplement-preview`,
                                {
                                  baseVersion: item.version,
                                  fileId: item.fileId,
                                  supplementPreviewFileId: null,
                                },
                                "supplement",
                              );
                            }}
                          >
                            移除补充预览
                          </button>
                        )}
                      </>
                    )}
                    {!item?.deletedAt && (
                      <>
                        <div className="res-menu-divider" />
                        <button
                          role="menuitem"
                          className="res-danger"
                          disabled={disabled || !item}
                          onClick={() => {
                            closeMenu();
                            setDialog({ kind: "delete", item });
                          }}
                        >
                          <Icon name="trash" size={16} />
                          归档资料
                        </button>
                      </>
                    )}
                    {item?.deletedAt && (
                      <button
                        role="menuitem"
                        className="res-danger"
                        disabled={disabled}
                        onClick={() => {
                          closeMenu();
                          setDialog({ kind: "purge", item });
                        }}
                      >
                        <Icon name="trash" size={16} />
                        彻底删除
                      </button>
                    )}
                  </>
                )}
              </Popover>
            </div>
            <input
              ref={replaceInput}
              hidden
              aria-label="更新文件"
              type="file"
              disabled={disabled || !!item?.deletedAt}
              onChange={(event) => {
                upload(event.target.files[0], "replace");
                event.target.value = "";
              }}
            />
            <input
              ref={supplementInput}
              hidden
              aria-label="补充 PDF 预览"
              type="file"
              accept="application/pdf,.pdf"
              disabled={disabled || !!item?.deletedAt}
              onChange={(event) => {
                upload(event.target.files[0], "supplement");
                event.target.value = "";
              }}
            />
          </header>
          {item && (
            <div className="res-preview-column res-surface">
              {item.supplementPreviewFileId && !supplement && (
                <div className="res-notice">
                  <Icon name="info" size={16} />
                  正在查看本版本补充 PDF，原件保持不变。
                </div>
              )}
              {supplement?.resourceId === item.id && (
                <div className="res-warning">
                  <span>
                    核对补充 PDF：{supplement.name} · 已看{" "}
                    {supplement.viewed.length} / {supplement.total ?? "…"} 页
                  </span>
                  <button
                    className="res-primary"
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
                scrollPosition={scene.previewScroll?.[`${previewId}:${page}`]}
                onScrollPosition={(position) =>
                  patchScene((current) => ({
                    previewScroll: {
                      ...current.previewScroll,
                      [`${previewId}:${page}`]: position,
                    },
                  }))
                }
                onPage={(page) =>
                  patchScene((current) => ({
                    pages: { ...current.pages, [previewId]: page },
                  }))
                }
                zoom={scene.zoom}
                onZoom={(zoom) => patchScene({ zoom })}
                onSupplement={
                  !item.deletedAt && !supplement && !disabled
                    ? () => supplementInput.current?.click()
                    : null
                }
                onViewed={(page, preview) => {
                  const current = sceneRef.current.supplement;
                  if (
                    current?.fileId === previewId &&
                    preview.state === "ready"
                  )
                    patchScene({
                      supplement: {
                        ...current,
                        total: preview.pageCount,
                        viewed: [...new Set([...current.viewed, page])],
                      },
                    });
                }}
              />
            </div>
          )}
        </section>
      )}
      <ModulePresence
        present={Boolean(message || error || busy || pending || lastLesson)}
      >
        <div
          className={`res-status${error ? " has-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <Icon name={error ? "info" : busy ? "upload" : "check"} size={16} />
          <span role={error && !busy ? "alert" : undefined}>
            {busy ? "正在保存，请稍候…" : error || message}
          </span>
          {lastLesson && (
            <button onClick={() => onOpenLesson?.(lastLesson)}>
              前往备课：{lastLesson.lessonTitle}
            </button>
          )}
          {pending?.requiresReselection && !busy ? (
            <label className="res-button">
              重新选择原文件
              <input
                type="file"
                aria-label="重新选择原文件"
                onChange={async (event) => {
                  const file = event.target.files[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    await execute(await reselectDeviceFile(pending, file));
                  } catch (error) {
                    setError(error.message);
                  }
                }}
              />
            </label>
          ) : (
            pending &&
            !busy && (
              <button onClick={() => execute(pending)}>重试确认原请求</button>
            )
          )}
          {!pending && !busy && (
            <button
              className="res-icon-button"
              aria-label="关闭提示"
              onClick={() => {
                setMessage("");
                setError("");
                setLastLesson(null);
              }}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </ModulePresence>
      <ModulePresence present={!!scene.taxonomyDraft?.edit}>
        {scene.taxonomyDraft?.edit && (
          <TaxonomyDialog
            value={tax}
            draft={scene.taxonomyDraft}
            onChange={changeTaxonomy}
            onSave={saveTaxonomy}
            onClose={() => patchScene({ taxonomyDraft: null })}
            disabled={disabled}
            items={allItems}
          />
        )}
      </ModulePresence>
      <ModulePresence present={!!addToLesson}>
        {addToLesson && (
          <AddToLesson
            client={client}
            resources={addToLesson}
            disabled={disabled}
            onClose={() => setAddToLesson(null)}
            onSave={(id, input) =>
              write(`/api/modules/lessons/v3/${id}`, input, "lesson")
            }
          />
        )}
      </ModulePresence>
      <ModulePresence present={!!conflict}>
        {conflict && (
          <ResourceDialog label="版本冲突" onClose={() => setConflict(null)}>
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
          </ResourceDialog>
        )}
      </ModulePresence>
      <ModulePresence present={!!dialog}>
        {dialog && (
          <ResourceDialog
            label={
              dialog.kind === "replace"
                ? "更新文件确认"
                : dialog.kind === "purge"
                  ? "彻底删除确认"
                  : "归档恢复确认"
            }
            onClose={() => setDialog(null)}
          >
            <h2>
              {dialog.kind === "replace"
                ? "更新当前文件"
                : dialog.kind === "purge"
                  ? "彻底删除资料"
                  : dialog.item.deletedAt
                    ? "恢复资料"
                    : "归档资料"}
            </h2>
            {dialog.kind === "replace" ? (
              <>
                <p>
                  {file?.name} → {dialog.source.name}
                </p>
                <p>名称、文件夹、标签和备注都会保留。</p>
                {usages.length > 0 && (
                  <p>
                    已有 {usages.length}{" "}
                    处备课引用仍保留旧文件，需要时可在备课中采用新版。
                  </p>
                )}
              </>
            ) : (
              <p>
                {dialog.kind === "purge"
                  ? `“${dialog.item.title}”将从资源库永久删除，无法恢复。已有备课引用的文件会保留。`
                  : dialog.item.deletedAt
                    ? "恢复后可以继续查看和整理这份资料。"
                    : "资料会移入“已归档资料”，可以随时恢复。已有备课仍可使用引用的文件。"}
              </p>
            )}
            <div className="res-actions">
              <button
                className={
                  dialog.kind === "purge" ||
                  (dialog.kind === "delete" && !dialog.item.deletedAt)
                    ? "res-danger"
                    : "res-primary"
                }
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
                    : dialog.kind === "purge"
                      ? write(
                          `${root}/items/${dialog.item.id}/purge`,
                          { baseVersion: dialog.item.version },
                          "purge",
                          "POST",
                        )
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
                  : dialog.kind === "purge"
                    ? "彻底删除"
                    : dialog.item.deletedAt
                      ? "恢复"
                      : "归档"}
              </button>
              <button onClick={() => setDialog(null)}>取消</button>
            </div>
          </ResourceDialog>
        )}
      </ModulePresence>
    </div>
  );
}
