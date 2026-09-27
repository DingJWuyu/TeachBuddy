import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";
import { useScene } from "../workbench/useScene.js";
import { useEffect, useRef, useState } from "react";
import {
  workbenchGet,
  workbenchPost,
  workbenchBlob,
} from "../workbench/apiClient.js";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useIdempotentSubmit } from "../workbench/useIdempotentSubmit.js";
export function FilePreview({ fileId, onClose, title = "成品预览", onSelectPage }) {
  const dialogRef = useRef(null);
  useModuleDialogFocus(dialogRef, onClose);
  const { accountKey } = useWorkbenchShell();
  const [scene, patchScene] = useScene(accountKey, `lesson-preview-${fileId}`, {
    page: 0,
    zoom: 100,
    scrollTop: 0,
  });
  const { page, zoom } = scene;
  const scrollRef = useRef(null);
  const request = useIdempotentSubmit({
    accountKey,
    name: `pending:lesson-preview:${fileId}`,
  });
  const [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [url, setUrl] = useState(null),
    [revision, setRevision] = useState(0);
  const send = async ({ key, payload }) =>
    (await workbenchPost(payload.path, payload.body, key)).body;
  useEffect(() => {
    let live = true,
      timer;
    async function load() {
      try {
        const value = (
          await workbenchGet(`/api/workbench/files/${fileId}/preview`)
        ).body;
        if (!live) return;
        setPreview(value);
        if (value.pages.length && page >= value.pages.length) patchScene({ page: 0 });
        if (value.state === "pending") {
          if (!value.jobId) {
            const job = await request.submit(send, {
              path: `/api/workbench/files/${fileId}/preview`,
              body: {},
            });
            if (!job) return;
          } else {
            const job = (
              await workbenchGet(`/api/workbench/jobs/${value.jobId}`)
            ).body;
            if (["interrupted", "cancelled", "failed"].includes(job.state)) {
              setError("预览已中断或失败，可重新生成。");
              return;
            }
          }
          if (live) timer = setTimeout(load, 2000);
        } else if (value.state === "failed")
          setError("预览未完成，原文件仍保留，可重试。");
        else if (value.state === "limited")
          setError("预览需核对：" + value.issues.join("、"));
      } catch (e) {
        if (live) setError(e.message);
      }
    }
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fileId, revision]);
  useEffect(() => {
    const id = preview?.pages?.[page]?.imageFileId;
    if (!id) { setUrl(null); return; }
    let live = true,
      objectUrl;
    const abort = new AbortController();
    setUrl(null);
    workbenchBlob(`/api/workbench/files/${id}/content`, {
      signal: abort.signal,
    })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (live) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview?.pages?.[page]?.imageFileId, revision]);
  async function retry() {
    setError("");
    if (request.pending) await request.retry(send);
    else if (preview?.jobId && preview.state !== "ready")
      await request.submit(send, {
        path: `/api/workbench/jobs/${preview.jobId}/retry`,
        body: { unitIds: [] },
      });
    setRevision((n) => n + 1);
  }
  return (
    <div className="wb-module wb-dialog-host">
      <div className="wb-dialog-scrim" role="presentation" onClick={onClose} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="wb-dialog r34-preview"
      >
        <header className="wb-section-head">
          {(preview?.pages.length ?? 0) > 1 && <button
            className="wb-button"
            disabled={!page}
            onClick={() => patchScene({ page: page - 1, scrollTop: 0 })}
          >
            上一页
          </button>}
          <span>
            {preview?.pages.length
              ? `${page + 1} / ${preview.pages.length}`
              : "正在准备预览"}
          </span>
          {(preview?.pages.length ?? 0) > 1 && <button
            className="wb-button"
            disabled={page >= (preview?.pages.length ?? 0) - 1}
            onClick={() => patchScene({ page: page + 1, scrollTop: 0 })}
          >
            下一页
          </button>}
          <label>
            缩放
            <select
              className="wb-input"
              aria-label="预览缩放"
              value={zoom}
              onChange={(e) => patchScene({ zoom: Number(e.target.value) })}
            >
              {[75, 100, 125, 150].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
          <button className="wb-button" onClick={onClose}>
            关闭预览
          </button>
          {onSelectPage && <button className="wb-button is-primary"
            disabled={!url || !preview?.renditionFileId || !preview.pages[page] || request.isRunning || Boolean(request.pending)}
            onClick={() => onSelectPage({ fileId, renditionFileId: preview.renditionFileId,
              page: preview.pages[page].page, imageFileId: preview.pages[page].imageFileId })}>
            提取这一页
          </button>}
        </header>
        {(error || request.problem || request.pending) && (
          <p role="alert">
            {error || request.problem?.message || "上次预览请求尚未确认"}
            <button
              className="wb-button"
              disabled={request.isRunning}
              onClick={retry}
            >
              {request.pending ? "重试确认预览" : "重试预览"}
            </button>
          </p>
        )}
        <div
          className="r34-preview-scroll"
          ref={scrollRef}
          onScroll={(e) => patchScene({ scrollTop: e.currentTarget.scrollTop })}
        >
          {url && (
            <img
              style={{ width: `${zoom}%`, maxWidth: "none" }}
              onLoad={() => {
                if (scrollRef.current)
                  scrollRef.current.scrollTop = scene.scrollTop;
              }}
              src={url}
              alt={`${title}第 ${preview?.pages[page]?.page ?? page + 1} 页`}
            />
          )}
        </div>
      </section>
    </div>
  );
}
