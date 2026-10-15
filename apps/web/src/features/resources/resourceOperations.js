import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingStore } from "./pendingRequests.js";
import { reselectDeviceFile } from "../../platform/device/deviceRequestStore.js";

const root = "/api/modules/resources";

// Own the complete persisted operation, including the upload-to-resource handoff.
// The workspace receives acknowledged resource results, never intermediate writes.
export function useResourceOperations({
  accountKey, client, controller, sceneRef, patchScene, currentItem,
  onResult, onOpen, onClose, refresh,
}) {
  const { t } = useTranslation("resources");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const pendingRef = useRef(null);
  const busyRef = useRef(false);
  useEffect(() => {
    const signal = controller.current.signal;
    pendingStore(accountKey).then(value => {
      if (signal.aborted) return;
      pendingRef.current = value ?? null;
      setPending(value ?? null);
      setLoaded(true);
    }).catch(() => {
      if (!signal.aborted) setError(t("无法保存恢复记录，请允许浏览器存储后重试"));
    });
  }, [accountKey]);
  useEffect(() => {
    if (!message || busy || pending || error) return;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message, busy, pending, error]);
  async function remember(value) {
    await pendingStore(accountKey, value);
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
          onResult({ purpose: record.purpose, value });
          if (purged || value.deletedAt) onClose(true);
        }
        if (record.purpose === "metadata") {
          // The next edit must use the acknowledged version even while the
          // background list refresh is still in flight.
          onResult({ purpose: record.purpose, value });
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
          onResult({ purpose: "taxonomy", value });
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
          onOpen(value.id);
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
        setConfirmation(null);
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
        setConfirmation(null);
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
    const item = currentItem();
    const meta = {
      kind,
      folderId: sceneRef.current.folderId,
      ...(item
        ? {
            id: item.id,
            baseVersion: item.version,
            originalFileId: item.fileId,
          }
        : {}),
    };
    if (kind === "replace") {
      setConfirmation({ kind: "replace", source, meta });
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
  async function reselectOriginal(file) {
    if (!file || !pendingRef.current || busyRef.current) return;
    try {
      await execute(await reselectDeviceFile(pendingRef.current, file));
    } catch (error) {
      setError(error.message);
    }
  }
  function retryPending() {
    if (pendingRef.current) return execute(pendingRef.current);
  }
  function keepDuplicate() {
    if (pendingRef.current?.duplicateMatches?.length)
      return execute({ ...pendingRef.current, duplicateMatches: null });
  }
  function confirmOperation() {
    if (!confirmation) return;
    if (confirmation.kind === "replace")
      return execute({
        key: crypto.randomUUID(), method: "POST",
        path: "/api/workbench/files", input: confirmation.source,
        purpose: "upload", meta: confirmation.meta,
      });
    const item = confirmation.item;
    if (confirmation.kind === "purge")
      return write(`${root}/items/${item.id}/purge`,
        { baseVersion: item.version }, "purge", "POST");
    return write(`${root}/items/${item.id}/deletion`,
      { baseVersion: item.version, deleted: !item.deletedAt }, "deletion", "POST");
  }
  return {
    pending, busy, loaded, error, message, conflict, confirmation,
    write, upload, requestPreview, reselectOriginal, retryPending,
    skipPending: skipDuplicate, keepDuplicate, confirmOperation,
    isBusy: () => busyRef.current,
    reportError: setError,
    clearMessage: () => setMessage(""),
    clearFeedback: () => { setMessage(""); setError(""); },
    showConfirmation: setConfirmation,
    dismissConfirmation: () => setConfirmation(null),
    dismissConflict: () => setConflict(null),
  };
}
