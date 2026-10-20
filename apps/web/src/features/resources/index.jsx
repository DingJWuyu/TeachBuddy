import { useTranslation } from 'react-i18next';
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useScene } from "../../platform/device/useScene.js";
import { useForegroundRefresh } from "../../components/interaction/useForegroundRefresh.js";
import { createResourcesClient } from "./client.js";
import { useResourceOperations } from "./resourceOperations.js";
import { Preview } from "./Preview.jsx";
import { Library } from "./Library.jsx";
import { ResourceInfo } from "./ResourceInfo.jsx";
import { Icon } from "../../components/icons.jsx";
import { TaxonomyDialog } from "./Taxonomy.jsx";
import { Rail } from "../../components/ui/rail.jsx";
import { Menu as Popover } from "../../components/ui/menu.jsx";
import "./resources.css";
import { ResourceDialog } from "./ResourceDialog.jsx";
import { ModulePresence } from "../../components/interaction/ModuleMotion.jsx";
import { FileHistory } from "./FileHistory.jsx";
import { Organize } from "./Organize.jsx";
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
}) {
  useTranslation("resources");
  const shell = useWorkbenchShell();
  return (
    <ResourceWorkspace
      key={`${shell.accountKey}:${shell.generation}`}
      transport={transport}
      shell={shell}
    />
  );
}
function ResourceWorkspace({
  transport,
  shell,
}) {
  const { t } = useTranslation("resources");
  const controller = useRef(null);
  // Install the current scope before child effects issue file/preview requests.
  useLayoutEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const client = useMemo(
    () =>
      createResourcesClient(
        transport,
        () => controller.current.signal,
        () => {
          controller.current.abort();
          shell.notifyIdentityLost?.();
        },
      ),
    [transport, controller],
  );
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
    recognitionOpen: false,
    tagColors: {},
  });
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [items, setItems] = useState([]),
    [searchInfo, setSearchInfo] = useState(null),
    [allItems, setAllItems] = useState([]),
    [storedTax, setTax] = useState({ version: 1, folders: [], tags: [] }),
    [files, setFiles] = useState({}),
    [fileErrors, setFileErrors] = useState({}),
    [previews, setPreviews] = useState({});
  const tax = { ...storedTax, tags: storedTax.tags.map(tag => ({ ...tag, ...(scene.tagColors?.[tag.id] ? { color: scene.tagColors[tag.id] } : {}) })) };
  const [listLoading, setListLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [organize, setOrganize] = useState(null);
  const listRef = useRef(null), opening = useRef(0), triggerRef = useRef(null),
    replaceInput = useRef(null), supplementInput = useRef(null);
  const refresh = () => setRevision((n) => n + 1);
  const operations = useResourceOperations({
    accountKey: shell.accountKey, client, controller, sceneRef, patchScene,
    currentItem: () => allItems.find(entry => entry.id === sceneRef.current.openId),
    onClose: close, refresh,
    onResult: ({ purpose, value }) => {
      if (purpose === "taxonomy") { setTax(value); return; }
      if (purpose === "organize") {
        const updates = new Map(value.items.map(item => [item.id, item]));
        setAllItems(current => current.map(item => updates.get(item.id) ?? item));
        setItems(current => current.map(item => updates.get(item.id) ?? item).filter(item => Boolean(item.deletedAt) === (sceneRef.current.state === "deleted")));
        return;
      }
      const purged = purpose === "purge";
      setAllItems(current => purged
        ? current.filter(item => item.id !== value.id)
        : current.map(item => item.id === value.id ? value : item));
      setItems(current => purpose === "metadata"
        ? current.map(item => item.id === value.id ? value : item)
        : current.filter(item => item.id !== value.id));
    },
  });
  const { pending, busy, loaded, error, message, conflict,
    confirmation: dialog, write, upload, requestPreview,
    skipPending: skipDuplicate, reportError } = operations;
  // Persist the field on every keystroke; debounce only the HTTP query.
  const [searchQuery, setSearchQuery] = useState(scene.q);
  useEffect(() => {
    if (!scene.q) { setSearchQuery(""); return undefined; }
    if (scene.q === searchQuery) return undefined;
    const timer = setTimeout(() => setSearchQuery(scene.q), 280);
    return () => clearTimeout(timer);
  }, [scene.q]);
  useForegroundRefresh(() => {
    if (!operations.isBusy() && !controller.current.signal.aborted) refresh();
  });
  useEffect(() => {
    let active = true;
    let searchTimer;
    setListLoading(true);
    setSearchInfo(null);
    const query = new URLSearchParams();
    if (searchQuery) query.set("q", searchQuery);
    for (const name of ["folderId", "mediaType", "state"])
      if (scene[name]) query.set(name, scene[name]);
    scene.tagIds.forEach((id) => query.append("tagIds", id));
    const receiveSearch = (list) => {
      if (!active) return;
      setItems(list.items);
      setSearchInfo(list.search ?? null);
      if (list.search?.pending || list.search?.ocr?.pendingPages)
        searchTimer = setTimeout(
          async () => {
            try {
              receiveSearch(await client.request(`${root}/items?${query}`));
            } catch (e) {
              if (active)
                setSearchInfo((current) => ({
                  ...current,
                  pending: 0,
                  ...(current?.ocr
                    ? { ocr: { ...current.ocr, pendingPages: 0 } }
                    : {}),
                  interrupted: true,
                }));
            }
          },
          list.search?.ocr?.pendingPages ? 2000 : 800,
        );
    };
    Promise.all([
      client.request(`${root}/items?${query}`),
      client.request(`${root}/taxonomy`),
      client.request(`${root}/items`),
      client.request(`${root}/items?state=deleted`),
    ])
      .then(async ([list, taxonomy, activeItems, deleted]) => {
        if (!active) return;
        receiveSearch(list);
        setAllItems([...activeItems.items, ...deleted.items]);
        setTax(taxonomy);
        const ids = [
          ...new Set(
            [...activeItems.items, ...deleted.items].map((i) => i.fileId),
          ),
        ];
        const results = await Promise.all(
          ids.map(async (id) => {
            const [file, preview] = await Promise.allSettled([
              client.request(`/api/workbench/files/${id}`),
              client.request(`/api/workbench/files/${id}/preview`),
            ]);
            return [id, file, preview];
          }),
        );
        if (active) {
          setFiles((current) => ({
            ...current,
            ...Object.fromEntries(
              results
                .filter(([, file]) => file.status === "fulfilled")
                .map(([id, file]) => [id, file.value]),
            ),
          }));
          setPreviews(
            Object.fromEntries(
              results
                .filter(([, , preview]) => preview.status === "fulfilled")
                .map(([id, , preview]) => [id, preview.value]),
            ),
          );
          setFileErrors(
            Object.fromEntries(
              results
                .filter(
                  ([, file, preview]) =>
                    file.status === "rejected" || preview.status === "rejected",
                )
                .map(([id]) => [id, t("文件暂时无法读取，请重试")]),
            ),
          );
        }
      })
      .catch((e) => active && reportError(e.message))
      .finally(() => active && setListLoading(false));
    return () => {
      active = false;
      clearTimeout(searchTimer);
    };
  }, [
    client,
    searchQuery,
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
    if (!scene.openId && listRef.current)
      listRef.current.scrollTop = scene.scroll;
  }, [scene.openId, items]);
  async function open(id, event) {
    const request = ++opening.current;
    triggerRef.current = event?.currentTarget;
    const match = searchInfo?.matches[id];
    let resource = allItems.find((entry) => entry.id === id);
    if (match?.recognition) {
      try {
        resource = await client.request(`${root}/items/${id}`);
        const source = resource.supplementPreviewFileId || resource.fileId;
        const [preview, currentFile] = await Promise.all([
          client.request(`/api/workbench/files/${source}/preview`),
          client.request(`/api/workbench/files/${resource.fileId}`),
        ]);
        if (request !== opening.current) return;
        const location = match.recognition.location;
        if (
          source !== location.fileId ||
          preview.renditionFileId !== location.renditionFileId
        )
          throw new Error(t("资料文件已更新，请在最新搜索结果中重新打开。"));
        // Polling can receive a newer file than the detail snapshot. Commit
        // the validated resource and its file before opening that preview.
        setAllItems((items) =>
          items.some((item) => item.id === id)
            ? items.map((item) => (item.id === id ? resource : item))
            : [...items, resource],
        );
        setFiles((files) => ({ ...files, [resource.fileId]: currentFile }));
        setPreviews((previews) => ({ ...previews, [source]: preview }));
        setFileErrors((errors) => {
          const next = { ...errors };
          delete next[resource.fileId];
          return next;
        });
      } catch (error) {
        if (request === opening.current) {
          reportError(error.message);
          refresh();
        }
        return;
      }
    }
    if (match?.page && resource) {
      const fileId = resource.supplementPreviewFileId || resource.fileId;
      patchScene((current) => ({
        pages: { ...current.pages, [fileId]: match.page },
        previewScroll: {
          ...current.previewScroll,
          [`${fileId}:${match.page}`]: { top: 0, left: 0 },
        },
      }));
    }
    patchScene({
      openId: id,
      recognitionOpen: Boolean(match?.recognition),
    });

    operations.clearFeedback();
  }
  function close(removed = false) {
    opening.current++;
    patchScene({ openId: null, recognitionOpen: false });
    refresh();
    requestAnimationFrame(() => {
      if (!removed && triggerRef.current?.isConnected)
        triggerRef.current.focus();
      else
        listRef.current?.closest(".tbx-res")?.querySelector("h1")?.focus();
    });
  }
  function edit(patch) {
    patchScene({
      drafts: { ...sceneRef.current.drafts, [item.id]: { ...draft, ...patch } },
    });
    operations.clearMessage();
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
    if (!(await writeLibrary(`${root}/taxonomy`, input, "taxonomy"))) return;
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
  // Information now occupies the module rail; the shell's auxiliary panel is reserved for the assistant.
  useEffect(() => { shell.registerTools([]); }, [shell.registerTools]);
  async function writeLibrary(path, input, purpose, method) {
    if (purpose !== "taxonomy") return write(path, input, purpose, method);
    const colors = Object.fromEntries(input.tags.filter(tag => tag.color).map(tag => [tag.id, tag.color]));
    const saved = await write(path, { ...input, tags: input.tags.map(({ id, name }) => ({ id, name })) }, purpose, method);
    if (saved) patchScene({ tagColors: colors });
    return saved;
  }
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
    <div className={`res-workspace res-ui wb-module${scene.openId ? " tbx-split" : ""}`}>
      {scene.openId && <Rail label={t("资料信息")} className="res-info-rail">
        <ResourceInfo item={item} file={file} draft={draft} tax={tax} onEdit={edit}
          onSave={() => write(`${root}/items/${item.id}`, draft, "metadata")}
          onManage={(kind) => manageTaxonomy(kind, null, true)} disabled={disabled} dirty={dirty} />
      </Rail>}
      <Library
        scene={scene}
        patchScene={patchScene}
        items={items}
        allItems={allItems}
        tax={tax}
        files={files}
        previews={previews}
        fileErrors={fileErrors}
        client={client}
        busy={disabled}
        loading={listLoading}
        searchInfo={searchInfo}
        onRetrySearch={async () => {
          try {
            await client.request(`${root}/search/retry`, {
              method: "POST",
              input: {},
              key: crypto.randomUUID(),
            });
            reportError("");
            refresh();
          } catch (e) {
            reportError(e.message);
          }
        }}
        listRef={listRef}
        breadcrumbs={breadcrumbs}
        onOpen={open}
        onUpload={upload}
        onWrite={writeLibrary}
        onError={reportError}
        onSearch={setSearchQuery}
        onOrganize={(action) =>
          setOrganize({
            action,
            resources: allItems.filter((item) =>
              scene.selected.includes(item.id),
            ),
          })
        }
      />
      {scene.openId && (
        <section className="res-detail">
          <header className="res-header res-surface">
            <button className="res-back-button" onClick={() => close()}>
              <Icon name="arrowLeft" size={17} />
              <span>{t("返回资源库")}</span>
            </button>
            <div className="res-detail-title">
              <h1>{item?.title ?? t("读取资料…")}</h1>
              <span className="res-muted">
                {item?.deletedAt ? t("已归档资料") : file?.name}
              </span>
            </div>
            <div className="res-header-actions">
              {item?.deletedAt && (
                <button
                  className="res-primary"
                  disabled={disabled}
                  onClick={() => operations.showConfirmation({ kind: "delete", item })}
                > {t("恢复资料")} </button>
              )}
              <button
                aria-label={t("下载原件")}
                disabled={!file}
                onClick={() =>
                  client
                    .download(item.fileId, file.name)
                    .catch((error) => reportError(error.message))
                }
              >
                <Icon name="arrowDown" size={16} />
                <span>{t("下载原件")}</span>
              </button>
              <Popover
                label={t("资料更多操作")}
                className="res-menu"
                buttonClassName="res-icon-button"
              >
                {({ close: closeMenu }) => (
                  <>
                    <button
                      role="menuitem"
                      disabled={!item}
                      onClick={() => {
                        closeMenu();
                        setHistoryOpen(true);
                      }}
                    >
                      <Icon name="file" size={16} /> {t("文件历史版本")} </button>
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
                          <Icon name="upload" size={16} /> {t("更新文件")} </button>
                        <button
                          role="menuitem"
                          disabled={disabled || !item || !!item.deletedAt}
                          onClick={() => {
                            closeMenu();
                            supplementInput.current?.click();
                          }}
                        >
                          <Icon name="file" size={16} /> {t("补充 PDF 预览")} </button>
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
                          > {t("移除补充预览")} </button>
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
                            operations.showConfirmation({ kind: "delete", item });
                          }}
                        >
                          <Icon name="trash" size={16} /> {t("归档资料")} </button>
                      </>
                    )}
                    {item?.deletedAt && (
                      <button
                        role="menuitem"
                        className="res-danger"
                        disabled={disabled}
                        onClick={() => {
                          closeMenu();
                          operations.showConfirmation({ kind: "purge", item });
                        }}
                      >
                        <Icon name="trash" size={16} /> {t("彻底删除")} </button>
                    )}
                  </>
                )}
              </Popover>
            </div>
            <input
              ref={replaceInput}
              hidden
              aria-label={t("更新文件")}
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
              aria-label={t("补充 PDF 预览")}
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
              {fileErrors[item.fileId] && (
                <div className="res-warning" role="alert">
                  {fileErrors[item.fileId]}
                  <button onClick={refresh}>{t("重新读取文件")}</button>
                </div>
              )}
              {item.supplementPreviewFileId && !supplement && (
                <div className="res-notice">
                  <Icon name="info" size={16} /> {t("正在查看本版本补充 PDF，原件保持不变。")} </div>
              )}
              {supplement?.resourceId === item.id && (
                <div className="res-warning">
                  <span> {t("核对补充 PDF：")}{supplement.name} {t("· 已看")}{" "}
                    {supplement.viewed.length} / {supplement.total ?? "…"} {t("页")} </span>
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
                  > {t("采用补充 PDF")} </button>
                  <button onClick={() => patchScene({ supplement: null })}> {t("取消补充")} </button>
                </div>
              )}
              <Preview
                key={previewId}
                client={client}
                fileId={previewId}
                recognitionOpen={scene.recognitionOpen}
                onRecognitionOpen={(open) =>
                  patchScene({ recognitionOpen: open })
                }
                recognitionRevision={revision}
                onRecognitionWrite={(path, input, purpose) =>
                  write(path, input, purpose, "POST")
                }
                recognitionDisabled={disabled}
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
        present={Boolean(message || error || busy || pending)}
      >
        <div
          className={`res-status${error ? " has-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <Icon name={error ? "info" : busy ? "upload" : "check"} size={16} />
          <span role={error && !busy ? "alert" : undefined}>
            {busy
              ? pending?.batchTotal
                ? t("正在收录第 {{value}} / {{batchTotal}} 份，请稍候…", { value: (pending.completed ?? 0) + 1, batchTotal: pending.batchTotal })
                : t("正在保存，请稍候…")
              : error || message}
          </span>
          {pending?.requiresReselection && !busy ? (
            <label className="res-button"> {t("重新选择原文件")} <input
                type="file"
                aria-label={t("重新选择原文件")}
                onChange={async (event) => {
                  const file = event.target.files[0];
                  event.target.value = "";
                  if (!file) return;
                  await operations.reselectOriginal(file);
                }}
              />
            </label>
          ) : (
            pending &&
            !pending.duplicateMatches?.length &&
            !busy && (
              <button onClick={() => operations.retryPending()}>{t("重试确认原请求")}</button>
            )
          )}
          {!pending && !busy && (
            <button
              className="res-icon-button"
              aria-label={t("关闭提示")}
              onClick={operations.clearFeedback}
            >
              <Icon name="close" size={14} />
            </button>
          )}
          {pending?.definiteFailure && !busy && (
            <button onClick={skipDuplicate}>{t("跳过未保存的资料")}</button>
          )}
        </div>
      </ModulePresence>
      <ModulePresence present={Boolean(pending?.duplicateMatches?.length)}>
        {pending?.duplicateMatches?.length > 0 && (
          <ResourceDialog label={t("发现重复资料")} onClose={skipDuplicate}>
            <h2>{t("这份文件已经收录过")}</h2>
            <p>“{pending.input.title}{t("”与以下资料的文件内容相同：")}</p>
            <ul>
              {pending.duplicateMatches.map((match) => (
                <li key={match.id}>
                  {match.title}
                  {match.deletedAt ? t("（已归档）") : ""}
                </li>
              ))}
            </ul>
            <p>{t("可跳过这份资料，或另存一份并分别整理。")}</p>
            <div className="res-actions">
              <button
                className="res-primary"
                disabled={busy}
                onClick={skipDuplicate}
              > {t("跳过这份资料")} </button>
              <button
                disabled={busy}
                onClick={() => operations.keepDuplicate()}
              > {t("仍然另存一份")} </button>
            </div>
          </ResourceDialog>
        )}
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
      <ModulePresence present={historyOpen && !!item}>
        {historyOpen && item && (
          <FileHistory
            client={client}
            item={item}
            disabled={disabled}
            onClose={() => setHistoryOpen(false)}
            onRestore={(entry) => {
              setHistoryOpen(false);
              write(
                `${root}/items/${item.id}/restore-file`,
                { baseVersion: item.version, fileVersion: entry.version },
                "restore-file",
                "POST",
              );
            }}
          />
        )}
      </ModulePresence>
      <ModulePresence present={!!organize}>
        {organize && (
          <Organize
            {...organize}
            tax={tax}
            disabled={disabled}
            onClose={() => setOrganize(null)}
            onSave={(input) => {
              setOrganize(null);
              write(`${root}/items/organize`, input, "organize", "POST");
            }}
          />
        )}
      </ModulePresence>
      <ModulePresence present={!!conflict}>
        {conflict && (
          <ResourceDialog label={t("版本冲突")} onClose={() => operations.dismissConflict()}>
            <h2>{t("内容已在其他地方更新")}</h2>
            <p>
              {conflict.record.purpose === "organize"
                ? t("所选资料中有内容已变化，本次整理全部未生效。请关闭提示后重新选择资料。")
                : t("你的输入仍保留。当前资源：{{value}}，版本 {{detail}}。", { value: item?.title ?? "", detail: item?.version ?? "" })}
            </p>
            <pre>{item?.note}</pre>
            <button
              onClick={() => {
                if (item && conflict.record.purpose === "metadata")
                  edit({ baseVersion: item.version });
                operations.dismissConflict();
                reportError(t("请核对分类和笔记，再次保存"));
              }}
            > {t("保留草稿并对照当前版本")} </button>
            <button onClick={() => operations.dismissConflict()}>{t("稍后处理")}</button>
          </ResourceDialog>
        )}
      </ModulePresence>
      <ModulePresence present={!!dialog}>
        {dialog && (
          <ResourceDialog
            label={
              dialog.kind === "replace"
                ? t("更新文件确认")
                : dialog.kind === "purge"
                  ? t("彻底删除确认")
                  : t("归档恢复确认")
            }
            onClose={() => operations.dismissConfirmation()}
          >
            <h2>
              {dialog.kind === "replace"
                ? t("更新当前文件")
                : dialog.kind === "purge"
                  ? t("彻底删除资料")
                  : dialog.item.deletedAt
                    ? t("恢复资料")
                    : t("归档资料")}
            </h2>
            {dialog.kind === "replace" ? (
              <>
                <p>
                  {file?.name} → {dialog.source.name}
                </p>
                <p>{t("名称、文件夹、标签和备注都会保留。")}</p>
              </>
            ) : (
              <p>
                {dialog.kind === "purge"
                  ? t("“{{title}}”将从资源库永久删除，无法恢复。", { title: dialog.item.title })
                  : dialog.item.deletedAt
                    ? t("恢复后可以继续查看和整理这份资料。")
                    : t("资料会移入“已归档资料”，可以随时恢复。")}
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
                onClick={operations.confirmOperation}
              > {t("确认")} {dialog.kind === "replace"
                  ? t("更新")
                  : dialog.kind === "purge"
                    ? t("彻底删除")
                    : dialog.item.deletedAt
                      ? t("恢复")
                      : t("归档")}
              </button>
              <button onClick={() => operations.dismissConfirmation()}>{t("取消")}</button>
            </div>
          </ResourceDialog>
        )}
      </ModulePresence>
    </div>
  );
}
