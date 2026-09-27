import { useEffect, useRef, useState } from "react";
import { Icon } from "../workbench/chrome/icons.jsx";
import {
  ModuleDisclosure,
  ModulePresence,
} from "../workbench/ModuleMotion.jsx";
import { DocumentView } from "../workbench/materials/DocumentView.jsx";

const active = (state) => ["queued", "running", "cancelling"].includes(state);

export function Recognition({
  open,
  client,
  fileId,
  renditionFileId,
  page,
  revision,
  onWrite,
  disabled,
  onClose,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [copy, setCopy] = useState("");
  const [textOpen, setTextOpen] = useState(false);
  const source = `${fileId}/${renditionFileId}/${page}`;
  const copyScope = useRef(null);
  copyScope.current = source;
  const current =
    data?.source === source && data.client === client ? data : null;
  const base = `/api/workbench/files/${fileId}/recognition`;
  useEffect(() => {
    if (!open) return;
    let live = true,
      timer;
    setData(null);
    setError("");
    setCopy("");
    setTextOpen(false);
    async function read() {
      try {
        const query = `?renditionFileId=${renditionFileId}`;
        const summary = await client.request(`${base}${query}`);
        const [result, job] = await Promise.all([
          client.request(`${base}/pages/${page}${query}`),
          summary.jobId
            ? client.request(`/api/workbench/jobs/${summary.jobId}`)
            : null,
        ]);
        if (!live) return;
        setData({ source, client, summary, result, job });
        setError("");
        if (active(job?.state) || summary.pages.some((p) => active(p.state)))
          timer = setTimeout(read, 2000);
      } catch (error) {
        if (live) setError(`识别结果暂时无法读取：${error.message}`);
      }
    }
    void read();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, client, base, renditionFileId, page, source, revision, reload]);
  useEffect(() => {
    if (copy !== "识别文字已复制") return;
    const timer = setTimeout(() => setCopy(""), 3000);
    return () => clearTimeout(timer);
  }, [copy]);

  const summary = current?.summary;
  const result = current?.result;
  const job = current?.job;
  const running =
    active(job?.state) || summary?.pages.some((p) => active(p.state));
  const ready = result?.state === "ready";
  const completed =
    summary?.pages.filter((p) => p.state === "ready").length ?? 0;
  const failed = ["failed", "interrupted"].includes(result?.state);
  const failureMessage =
    result?.issues?.find((issue) => issue.code === "recognition-cleanup")
      ?.detail ||
    "本页尚未完成识别。重新识别会发起新的尝试，已完成页面会保留。";
  const mutable = !disabled && !error && !running && summary?.available;
  async function write(path, input, purpose) {
    if (await onWrite(path, input, purpose)) setReload((n) => n + 1);
  }
  function recognize(pages) {
    // The user chose a fixed page scope. A new request can resume it even
    // when the previous Job belongs to an older engine revision.
    return write(base, { renditionFileId, pages }, "recognition");
  }
  return (
    <ModulePresence
      present={open}
      mode="collapse"
      className="res-recognition-presence"
    >
      <section className="res-recognition" aria-label="识别文字">
        <header>
          <div>
            <strong>第 {page} 页识别文字</strong>
            <p>识别扫描内容后，可搜索和复制。请与原页核对。</p>
          </div>
          <button
            type="button"
            className="res-icon-button"
            aria-label="关闭识别文字"
            title="关闭识别文字（Esc）"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        {error && (
          <div className="res-recognition-error" role="alert">
            <span>{error}</span>
            <button onClick={() => setReload((n) => n + 1)}>
              重新读取识别结果
            </button>
          </div>
        )}
        {!current && !error && <p role="status">正在读取识别状态…</p>}
        {current && (
          <>
            <div className="res-recognition-actions">
              {!ready && !running && (
                <button
                  className="res-button"
                  disabled={!mutable}
                  onClick={() => recognize([page])}
                >
                  <Icon name="search" size={16} />
                  {failed ? "重新识别本页" : "识别本页文字"}
                </button>
              )}
              {!running &&
                summary.pages.length > 1 &&
                completed < summary.pages.length && (
                  <button
                    disabled={!mutable}
                    onClick={() =>
                      recognize(
                        summary.pages
                          .filter((p) => p.state !== "ready")
                          .map((p) => p.page),
                      )
                    }
                  >
                    识别剩余 {summary.pages.length - completed} 页
                  </button>
                )}
              {running && job && (
                <button
                  disabled={disabled || job.state === "cancelling"}
                  onClick={() =>
                    write(
                      `/api/workbench/jobs/${job.id}/cancel`,
                      {},
                      "recognition-cancel",
                    )
                  }
                >
                  {job.state === "cancelling" ? "正在停止…" : "停止识别"}
                </button>
              )}
              {ready && result.text?.trim() && (
                <button
                  className="res-copy-recognition"
                  aria-label="复制本页识别文字"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.text);
                      if (copyScope.current === source)
                        setCopy("识别文字已复制");
                    } catch {
                      if (copyScope.current === source) {
                        setCopy("复制未成功，可在下方原文中选择文字后复制。");
                        setTextOpen(true);
                      }
                    }
                  }}
                >
                  <Icon name="copy" size={16} />
                  <span role="status">
                    {copy === "识别文字已复制" ? copy : "复制本页识别文字"}
                  </span>
                </button>
              )}
            </div>
            <p className="res-recognition-status" role="status">
              {running
                ? `正在识别，已有 ${completed} / ${summary.pages.length} 页结果。`
                : failed
                  ? failureMessage
                  : ready
                    ? "机器识别结果，尚未校对。"
                    : "本页尚未识别，原文件已保存。"}
              {!summary.available &&
                !running &&
                " 文字识别暂不可用，仍可查看和下载原件。"}
            </p>
            {ready && (
              <>
                {result.issues?.length > 0 && (
                  <p className="res-recognition-review">
                    这页有需要核对的公式、表格或版式，请以原页为准。
                  </p>
                )}
                {result.document?.blocks?.length > 0 && (
                  <div className="res-recognition-body">
                    <section
                      className="res-recognition-document"
                      aria-label={`第 ${page} 页识别正文`}
                      tabIndex={0}
                    >
                      <DocumentView value={result.document} />
                    </section>
                    {result.text?.trim() && (
                      <ModuleDisclosure
                        title="查看可复制原文"
                        open={textOpen}
                        onOpenChange={setTextOpen}
                      >
                        <textarea
                          className="res-recognition-text"
                          aria-label={`第 ${page} 页识别原文`}
                          readOnly
                          value={result.text}
                        />
                      </ModuleDisclosure>
                    )}
                  </div>
                )}
                {!result.text?.trim() && (
                  <p>本页没有识别到文字，仍可查看原图。</p>
                )}
              </>
            )}
            {copy && copy !== "识别文字已复制" && <p role="alert">{copy}</p>}
          </>
        )}
      </section>
    </ModulePresence>
  );
}
