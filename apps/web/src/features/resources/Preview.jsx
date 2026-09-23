import React, { useEffect, useRef, useState } from "react";
export function FileImage({ client, id, alt, ...props }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      url;
    setUrl("");
    setError("");
    if (id)
      client
        .request(`/api/workbench/files/${id}/content`, { blob: true })
        .then((blob) => {
          url = URL.createObjectURL(blob);
          if (active) setUrl(url);
          else URL.revokeObjectURL(url);
        })
        .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, id]);
  return url ? (
    <img src={url} alt={alt} {...props} />
  ) : (
    <span className="res-muted">{error || "载入页面…"}</span>
  );
}
export function Preview({
  client,
  fileId,
  page = 1,
  onPage,
  onViewed,
  zoom = 100,
  onZoom,
  scrollPosition,
  onScrollPosition,
}) {
  const [preview, setPreview] = useState(null),
    [job, setJob] = useState(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const requestKey = useRef(null);
  const scrollRef = useRef(null);
  const loadedPage = useRef(null);
  useEffect(() => {
    let active = true,
      timer;
    setPreview(null);
    setJob(null);
    setError("");
    async function load() {
      try {
        let result = await client.request(
          `/api/workbench/files/${fileId}/preview`,
        );
        if (!active) return;
        const currentJob = result.jobId
          ? await client.request(`/api/workbench/jobs/${result.jobId}`)
          : null;
        // The job can finish between the two reads. Read its committed rendition
        // once more before stopping, rather than displaying the older snapshot.
        if (["succeeded", "partial"].includes(currentJob?.state))
          result = await client.request(`/api/workbench/files/${fileId}/preview`);
        if (!active) return;
        setPreview(result);
        setJob(currentJob);
        // Retrying keeps the previous rendition/state until conversion finishes.
        // Follow the new job even when the previous preview is failed or limited.
        if (
          ["queued", "running", "cancelling"].includes(currentJob?.state) ||
          (result.state === "pending" && !currentJob)
        )
          timer = setTimeout(load, 2000);
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, fileId, reload]);
  const current =
    preview?.pages.find((p) => p.page === page) ?? preview?.pages[0];
  async function generate() {
    try {
      setError("");
      requestKey.current ??= crypto.randomUUID();
      if (
        job &&
        ["failed", "partial", "cancelled", "interrupted"].includes(job.state)
      )
        await client.request(`/api/workbench/jobs/${preview.jobId}/retry`, {
          method: "POST",
          input: { unitIds: [] },
          key: requestKey.current,
        });
      else
        await client.request(`/api/workbench/files/${fileId}/preview`, {
          method: "POST",
          input: {},
          key: requestKey.current,
        });
      requestKey.current = null;
      setReload((n) => n + 1);
    } catch (e) {
      if (!e.unknown) requestKey.current = null;
      setError(e.message);
    }
  }
  return (
    <section className="res-preview" aria-label="文件预览">
      <div className="res-preview-toolbar">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={!current || page <= 1}
        >
          上一页
        </button>
        <span>
          {current?.page ?? 0} / {preview?.pageCount ?? "…"}
        </span>
        <button
          onClick={() => onPage(Math.min(preview?.pageCount ?? 1, page + 1))}
          disabled={!current || page >= preview.pageCount}
        >
          下一页
        </button>
        <label>
          缩放{" "}
          <select
            aria-label="缩放"
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
          >
            {[75, 100, 125, 150, 200].map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview?.state === "limited" && (
        <div className="res-warning">
          预览需核对：
          {preview.issues.includes("legacy-object-loss")
            ? "旧 DOC 公式或对象可能缺失，请与原件对照，可补充 PDF。"
            : "部分内容或字体需核对。"}
        </div>
      )}
      {error && (
        <div role="alert" className="res-warning">
          {error}
        </div>
      )}
      {!preview?.pages.length && (
        <div className="res-empty">
          {preview?.state === "failed" ||
          ["failed", "cancelled", "interrupted"].includes(job?.state)
            ? "预览失败，原文件仍可下载。"
            : "预览正在准备"}
          <button
            onClick={generate}
            disabled={
              job && ["queued", "running", "cancelling"].includes(job.state)
            }
          >
            {preview?.state === "failed" ||
            ["failed", "cancelled", "interrupted"].includes(job?.state)
              ? "重试预览"
              : "生成预览"}
          </button>
        </div>
      )}
      <div
        className="res-page-scroll"
        ref={scrollRef}
        onScroll={(e) => {
          if (loadedPage.current === current?.imageFileId)
            onScrollPosition?.({
              top: e.currentTarget.scrollTop,
              left: e.currentTarget.scrollLeft,
            });
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && page < (preview?.pageCount ?? 1)) {
            e.preventDefault();
            onPage(page + 1);
          }
          if (e.key === "ArrowLeft" && page > 1) {
            e.preventDefault();
            onPage(page - 1);
          }
        }}
      >
        {current && (
          <div className="res-page-paper" style={{ width: `${zoom}%` }}>
            <FileImage
              key={current.imageFileId}
              client={client}
              id={current.imageFileId}
              alt={`第 ${current.page} 页`}
              onLoad={() => {
                const element = scrollRef.current;
                element.scrollTop = scrollPosition?.top ?? 0;
                element.scrollLeft = scrollPosition?.left ?? 0;
                loadedPage.current = current.imageFileId;
                onViewed?.(current.page, preview);
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
