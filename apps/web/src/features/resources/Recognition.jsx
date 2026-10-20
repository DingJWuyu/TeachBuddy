import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/icons.jsx";
import {
  ModuleDisclosure,
  ModulePresence,
} from "../../components/interaction/ModuleMotion.jsx";
import { DocumentView } from "../../components/materials/DocumentView.jsx";

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
  onLocateIssue,
}) {
  const { t } = useTranslation("resources");
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
        if (live) setError(t("识别结果暂时无法读取：{{message}}", { message: error.message }));
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
    result?.issues?.some((issue) => issue.code === "recognition-cleanup")
      ? t('recognition.cleanupPending')
      : t("本页尚未完成识别。重新识别会发起新的尝试，已完成页面会保留。");
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
      <section className="res-recognition" aria-label={t("识别文字")}>
        <header>
          <div>
            <strong>{t("第")} {page} {t("页识别文字")}</strong>
            <p>{t("识别扫描内容后，可搜索和复制。请与原页核对。")}</p>
          </div>
          <button
            type="button"
            className="res-icon-button"
            aria-label={t("关闭识别文字")}
            title={t("关闭识别文字（Esc）")}
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        {error && (
          <div className="res-recognition-error" role="alert">
            <span>{error}</span>
            <button onClick={() => setReload((n) => n + 1)}> {t("重新读取识别结果")} </button>
          </div>
        )}
        {!current && !error && <p role="status">{t("正在读取识别状态…")}</p>}
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
                  {failed ? t("重新识别本页") : t("识别本页文字")}
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
                  > {t("识别剩余")} {summary.pages.length - completed} {t("页")} </button>
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
                  {job.state === "cancelling" ? t("正在停止…") : t("停止识别")}
                </button>
              )}
              {ready && result.text?.trim() && (
                <button
                  className="res-copy-recognition"
                  aria-label={t("复制本页识别文字")}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.text);
                      if (copyScope.current === source)
                        setCopy("识别文字已复制");
                    } catch {
                      if (copyScope.current === source) {
                        setCopy(t("复制未成功，可在下方原文中选择文字后复制。"));
                        setTextOpen(true);
                      }
                    }
                  }}
                >
                  <Icon name="copy" size={16} />
                  <span role="status">
                    {copy === "识别文字已复制" ? t("识别文字已复制") : t("复制本页识别文字")}
                  </span>
                </button>
              )}
            </div>
            <p className="res-recognition-status" role="status">
              {running
                ? t("正在识别，已有 {{completed}} / {{count}} 页结果。", { completed: completed, count: summary.pages.length })
                : failed
                  ? failureMessage
                  : ready
                    ? t("机器识别结果，尚未校对。")
                    : t("本页尚未识别，原文件已保存。")}
              {!summary.available &&
                !running &&
                t(" 文字识别暂不可用，仍可查看和下载原件。")}
            </p>
            {ready && (
              <>
                {result.issues?.length > 0 && (
                  <ul className="res-recognition-review">
                    {result.issues.map((issue, index) => <li key={index}>
                      {issue.code === 'ocr-text-conflict' ? t('这行有不一致的识别结果，请对照原稿核对。')
                        : issue.code === 'ocr-source-gap' ? t('这行有较大留白，请对照原稿核对。')
                          : t('这页有需要核对的公式、表格或版式，请以原页为准。')}
                      {issue.box && <button onClick={() => onLocateIssue(issue.box)}>{t("查看疑点位置")}</button>}
                    </li>)}
                  </ul>
                )}
                {result.document?.blocks?.length > 0 && (
                  <div className="res-recognition-body">
                    <section
                      className="res-recognition-document"
                      aria-label={t("第 {{page}} 页识别正文", { page: page })}
                      tabIndex={0}
                    >
                      <DocumentView value={result.document} />
                    </section>
                    {result.text?.trim() && (
                      <ModuleDisclosure
                        title={t("查看可复制原文")}
                        open={textOpen}
                        onOpenChange={setTextOpen}
                      >
                        <textarea
                          className="res-recognition-text"
                          aria-label={t("第 {{page}} 页识别原文", { page: page })}
                          readOnly
                          value={result.text}
                        />
                      </ModuleDisclosure>
                    )}
                  </div>
                )}
                {!result.text?.trim() && (
                  <p>{t("本页没有识别到文字，仍可查看原图。")}</p>
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
