import { useLibraryData } from "./useLibraryData.js";
import { useTranslation } from 'react-i18next';
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
    libraryPanelOpen: false,
    filtersOpen: false,
    recognitionOpen: false,
  });
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [items, setItems] = useState([]),
    [searchInfo, setSearchInfo] = useState(null),
    [allItems, setAllItems] = useState([]),
    [tax, setTax] = useState({ version: 1, folders: [], tags: [] }),
    [files, setFiles] = useState({}),
    [fileErrors, setFileErrors] = useState({}),
    [previews, setPreviews] = useState({});
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(null),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [listLoading, setListLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [dialog, setDialog] = useState(null),
    [conflict, setConflict] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchHit, setSearchHit] = useState(null);
  const [organize, setOrganize] = useState(null);
  const listRef = useRef(null),
    opening = useRef(0),
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
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, busy, pending, error]);
  useForegroundRefresh(() => {
    if (!busyRef.current && !controller.current.signal.aborted) refresh();
  });
  useEffect(() => {
    const signal = controller.current.signal;
    pendingStore(shell.accountKey)
      .then((value) => {
        if (!signal.aborted) {
          setPending(value ?? null);
          pendingRef.current = value ?? null;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!signal.aborted)
          setError(t("无法保存恢复记录，请允许浏览器存储后重试"));
      });
  }, [shell.accountKey]);
  useLibraryData({
    client, scene, revision, t,
    setItems, setSearchInfo, setAllItems, setTax,
    setFiles, setPreviews, setFileErrors, setError, setListLoading,
  });
  const item = allItems.find((i) => i.id === scene.openId),
    file = item && files[item.fileId];
  const draft = item ? (scene.drafts[item.id] ?? metadata(item)) : null;
  useEffect(() => {
    if (!scene.openId && listRef.current)
      listRef.current.scrollTop = scene.scroll;
  }, [scene.openId, items]);
  async function remember(value) {
    await pendingStore(shell.accountKey, value);
    pendingRef.current = value;
    if (!controller.current.signal.aborted) setPending(value);
  }
  async function execute(record) {
    if (busyRef.current) return false;
    if (!["upload", "create", "replace", "restore-file", "metadata", "taxonomy", "supplement", "deletion", "purge", "organize", "recognition", "recognition-cancel"].includes(record.purpose)) {
      setError(t("原请求格式暂不支持，已保留设备资料，请核对后处理"));
      return false;
    }
    if (record.requiresReselection) {
      setError(t("请重新选择原文件核对名称、长度和内容，再确认上传"));
      return false;
    }
    // A retry may commit even after a prior definite rejection. Until this
    // attempt is confirmed, skipping it could orphan a successfully saved item.
    record = { ...record, definiteFailure: false };
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await remember(record);
      for (;;) {
        if (record.duplicateHash) {
          const matches = await Promise.all(
            ["active", "deleted"].map((state) =>
              client.request(
                `${root}/items?state=${state}&sha256=${record.duplicateHash}`,
              ),
            ),
          );
          record = {
            ...record,
            duplicateHash: null,
            duplicateMatches: matches.flatMap((result) => result.items),
          };
          await remember(record);
        }
        if (record.duplicateMatches?.length) break;
        const value = await client.request(record.path, {
          method: record.method,
          input: record.input,
          key: record.key,
        });
        if (record.purpose === "upload") {
          if (!value.id || !value.name)
            throw Object.assign(new Error(t("上传结果未确认")), { unknown: true });
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
            remaining: record.remaining,
            batchTotal: record.batchTotal,
            completed: record.completed,
            duplicateHash:
              meta.kind === "create" && value.duplicateOfFileId
                ? value.sha256
                : null,
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
        if (record.purpose === "organize") {
          if (
            !Array.isArray(value.items) ||
            value.items.length !== record.input.items.length
          )
            throw Object.assign(new Error(t("批量整理结果未确认")), {
              unknown: true,
            });
          const drafts = { ...sceneRef.current.drafts };
          for (const item of value.items) {
            if (!drafts[item.id]) continue;
            drafts[item.id] = {
              ...drafts[item.id],
              baseVersion: item.version,
              ...(record.input.action === "move"
                ? { folderId: item.folderId }
                : {}),
              ...(record.input.action === "add-tags"
                ? {
                    tagIds: [
                      ...new Set([
                        ...drafts[item.id].tagIds,
                        ...record.input.tagIds,
                      ]),
                    ],
                  }
                : {}),
            };
          }
          patchScene({ selected: [], selectionMode: false, drafts });
          await remember(null);
          setMessage(
            t("已{{value}} {{count}} 份资料", { value: { move: t("移动"), "add-tags": t("添加标签："), archive: t("归档"), restore: t("恢复") }[record.input.action], count: value.items.length }),
          );
          refresh();
          break;
        }
        if (record.purpose?.startsWith("recognition")) {
          if (!value.id || value.kind !== "recognition" || !value.state)
            throw Object.assign(new Error(t("识别请求结果未确认")), {
              unknown: true,
            });
          await remember(null);
          setMessage(
            record.purpose === "recognition-cancel"
              ? t("已请求停止识别，已完成页面会保留")
              : t("已受理文字识别"),
          );
          setConflict(null);
          refresh();
          break;
        }
        if (
          record.purpose === "purge"
            ? value.permanentlyDeleted !== true || !value.id
            : !Number.isInteger(value.version)
        )
          throw Object.assign(new Error(t("保存结果未确认")), { unknown: true });
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
          // The next edit must use the acknowledged version even while the
          // background list refresh is still in flight.
          setAllItems(current => current.map(item => item.id === value.id ? value : item));
          setItems(current => current.map(item => item.id === value.id ? value : item));
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
        if (record.purpose === "create" && !(record.batchTotal > 1))
          open(value.id);
        if (["supplement", "replace", "restore-file"].includes(record.purpose))
          patchScene({ supplement: null });
        if (["replace", "restore-file"].includes(record.purpose)) {
          const live = sceneRef.current.drafts[value.id];
          if (live)
            patchScene({
              drafts: {
                ...sceneRef.current.drafts,
                [value.id]: { ...live, baseVersion: value.version },
              },
            });
        }
        const next = nextUpload(record);
        await remember(next);
        setMessage(
          {
            create:
              record.batchTotal > 1
                ? t("已处理 {{value}} / {{batchTotal}} 份资料", { value: (record.completed ?? 0) + 1, batchTotal: record.batchTotal })
                : t("文件已保存"),
            replace: t("文件已更新"),
            "restore-file": t("已恢复历史文件"),
            metadata: t("资料信息已保存"),
            taxonomy: t("整理已保存"),
            supplement: t("已采用补充预览"),
            deletion: value.deletedAt
              ? t("资料已归档，可在已归档资料中恢复")
              : t("资料已恢复"),
            purge: t("资料已彻底删除"),
          }[record.purpose] ?? t("已保存"),
        );
        setConflict(null);
        setDialog(null);
        refresh();
        if (["create", "replace", "restore-file"].includes(record.purpose))
          await requestPreview(value.fileId);
        if (next) {
          record = next;
          continue;
        }
        break;
      }
      return true;
    } catch (e) {
      if (!controller.current.signal.aborted) {
        setError(e.message);
        setDialog(null);
        if (e.status === 409 && !record.purpose?.startsWith("recognition")) {
          setConflict({ record });
          refresh();
        }
        if (!e.unknown && !record.batchTotal) {
          await remember(null);
        } else if (!e.unknown) {
          await remember({ ...record, definiteFailure: true });
        }
      }
      return false;
    } finally {
      busyRef.current = false;
      if (!controller.current.signal.aborted) setBusy(false);
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
      setError(t("原件已保存，预览未确认：{{message}}", { message: e.message }));
    }
  }
  function write(path, input, purpose, method = "PUT") {
    if (pendingRef.current || busyRef.current) return Promise.resolve(false);
    return execute({ key: crypto.randomUUID(), path, method, input, purpose });
  }
  function upload(source, kind = "create") {
    if (!source || pendingRef.current || busyRef.current) return;
    const sources = Array.isArray(source) ? source : [source];
    if (!sources.length) return;
    const invalid = sources.find(
      (file) => file.size > 100 * 1024 * 1024 || file.name.length > 200,
    );
    if (invalid) {
      setError(
        t("“{{name}}”超过限制：每份文件最多 100 MB，文件名最多 200 个字符。请调整后重新选择。", { name: invalid.name }),
      );
      return;
    }
    source = sources[0];
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
      remaining: sources.slice(1),
      batchTotal: sources.length > 1 ? sources.length : undefined,
      completed: 0,
    });
  }
  function nextUpload(record) {
    if (!record.remaining?.length) return null;
    const [input, ...remaining] = record.remaining;
    return {
      key: crypto.randomUUID(),
      method: "POST",
      path: "/api/workbench/files",
      input,
      purpose: "upload",
      meta: {
        kind: "create",
        folderId: record.input.folderId ?? record.meta?.folderId ?? null,
      },
      remaining,
      batchTotal: record.batchTotal,
      completed: (record.completed ?? 0) + 1,
    };
  }
  async function skipDuplicate() {
    const record = pendingRef.current;
    if (
      (!record?.duplicateMatches?.length && !record?.definiteFailure) ||
      busyRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    let next;
    try {
      next = nextUpload(record);
      await remember(next);
      setError("");
      setMessage(
        record.definiteFailure ? t("已跳过未保存的资料") : t("已跳过重复资料"),
      );
    } catch (error) {
      next = null;
      setError(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (next && !controller.current.signal.aborted) await execute(next);
  }
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
          setError(error.message);
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
    setSearchHit(match ? { itemId: id, sourceId: resource?.supplementPreviewFileId || resource?.fileId, query: scene.q, page: match.page, recognition: Boolean(match.recognition) } : null);
    patchScene({
      openId: id,
      recognitionOpen: Boolean(match?.recognition),
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
    setSearchHit(null);
    opening.current++;
    patchScene({ openId: null, recognitionOpen: false });
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
        label: scene.openId ? t("资料信息") : t("文件夹与标签"),
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
            setError("");
            refresh();
          } catch (e) {
            setError(e.message);
          }
        }}
        listRef={listRef}
        breadcrumbs={breadcrumbs}
        onOpen={open}
        onUpload={upload}
        onFolders={shell.openPanel ? toggleTools : null}
        foldersOpen={infoOpen}
        selectedItems={scene.selected.map(id => allItems.find(item => item.id === id)).filter(Boolean)}
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
                  onClick={() => setDialog({ kind: "delete", item })}
                > {t("恢复资料")} </button>
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
                <span>{t("下载原件")}</span>
              </button>
              <button
                aria-expanded={Boolean(infoOpen)}
                aria-label={t("资料信息")}
                title={t("资料信息")}
                className={`res-info-toggle${infoOpen ? " is-selected" : ""}`}
                onClick={toggleTools}
              >
                <Icon name="info" size={17} />
                <span>{t("资料信息")}</span>
                {dirty && <span className="res-unsaved-dot" />}
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
                            setDialog({ kind: "delete", item });
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
                          setDialog({ kind: "purge", item });
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
                onPreviewWrite={refresh}
                fileId={previewId}
                searchHit={searchHit?.itemId === item.id && searchHit.sourceId === previewId ? searchHit : null}
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
            !pending.duplicateMatches?.length &&
            !busy && (
              <button onClick={() => execute(pending)}>{t("重试确认原请求")}</button>
            )
          )}
          {!pending && !busy && (
            <button
              className="res-icon-button"
              aria-label={t("关闭提示")}
              onClick={() => {
                setMessage("");
                setError("");
              }}
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
                onClick={() => execute({ ...pending, duplicateMatches: null })}
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
          <ResourceDialog label={t("版本冲突")} onClose={() => setConflict(null)}>
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
                setConflict(null);
                setError(t("请核对分类和笔记，再次保存"));
              }}
            > {t("保留草稿并对照当前版本")} </button>
            <button onClick={() => setConflict(null)}>{t("稍后处理")}</button>
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
            onClose={() => setDialog(null)}
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
                  ? t("“{{title}}”及其历史版本将永久删除，无法恢复。不再使用的文件将释放空间，其他资料仍使用的文件会保留。", { title: dialog.item.title })
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
              > {t("确认")} {dialog.kind === "replace"
                  ? t("更新")
                  : dialog.kind === "purge"
                    ? t("彻底删除")
                    : dialog.item.deletedAt
                      ? t("恢复")
                      : t("归档")}
              </button>
              <button onClick={() => setDialog(null)}>{t("取消")}</button>
            </div>
          </ResourceDialog>
        )}
      </ModulePresence>
    </div>
  );
}
