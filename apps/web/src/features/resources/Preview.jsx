import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/icons.jsx";
import { PdfText } from "./PdfText.jsx";
import { PageFind } from "./PageFind.jsx";
import { Recognition } from "./Recognition.jsx";
export function FileImage({ client, id, alt, ...props }) {
  const { t } = useTranslation("resources");
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
    <span className="res-muted">{error || t("载入页面…")}</span>
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
  onSupplement,
  recognitionOpen = false,
  onRecognitionOpen,
  recognitionRevision,
  onRecognitionWrite,
  recognitionDisabled,
}) {
  const { t } = useTranslation("resources");
  const [preview, setPreview] = useState(null),
    [job, setJob] = useState(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const requestKey = useRef(null);
  const [textResult, setText] = useState({ state: "loading", text: "" });
  const [copyMessage, setCopyMessage] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const findButton = useRef(null);
  const recognitionButton = useRef(null);
  const [loadedImage, setLoadedImage] = useState(null);
  const [issueBox, setIssueBox] = useState(null);
  const issueMark = useRef(null);
  useEffect(() => { setIssueBox(null); }, [fileId, page]);
  useEffect(() => { issueMark.current?.scrollIntoView({block: 'center', inline: 'nearest'}); }, [issueBox]);
  function closeFind() {
    setFindOpen(false);
    findButton.current?.focus();
  }
  function closeRecognition() {
    onRecognitionOpen?.(false);
    recognitionButton.current?.focus();
  }
  useEffect(() => {
    setText({ state: "loading", text: "" });
    setCopyMessage("");
  }, [fileId, page]);
  useEffect(() => {
    if (copyMessage !== "本页文字已复制") return;
    const timer = setTimeout(() => setCopyMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [copyMessage]);
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
          result = await client.request(
            `/api/workbench/files/${fileId}/preview`,
          );
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
  const text =
    textResult.client === client &&
    textResult.renditionId === preview?.renditionFileId &&
    (textResult.page === null || textResult.page === current?.page)
      ? textResult
      : { state: "loading", text: "" };
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
  const preparing = ["queued", "running", "cancelling"].includes(job?.state);
  const unsupported = preview?.issues.includes("unsupported-format");
  const failed =
    !preparing &&
    (preview?.state === "failed" ||
      ["failed", "cancelled", "interrupted"].includes(job?.state));
  return (
    <section
      className="res-preview"
      aria-label={t("文件预览")}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          (findOpen || recognitionOpen) &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (findOpen) closeFind();
          else closeRecognition();
        }
      }}
    >
      <div className="res-preview-toolbar">
        {preview?.pageCount > 1 ? (
          <>
            <button
              className="res-icon-button"
              aria-label={t("上一页")}
              title={t("上一页")}
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={!current || page <= 1}
            >
              <Icon name="arrowLeft" size={16} />
            </button>
            <form
              className="res-page-jump"
              onSubmit={(event) => {
                event.preventDefault();
                const number = Number(
                  new FormData(event.currentTarget).get("page"),
                );
                if (
                  Number.isInteger(number) &&
                  number >= 1 &&
                  number <= preview.pageCount
                )
                  onPage(number);
              }}
            >
              <label> {t("第")}{" "}
                <input
                  key={current?.page}
                  aria-label={t("跳转页码")}
                  name="page"
                  type="number"
                  min="1"
                  max={preview.pageCount}
                  defaultValue={current?.page ?? 1}
                  required
                />{" "}
                / {preview.pageCount} {t("页")} </label>
              <button type="submit">{t("跳转")}</button>
            </form>
            <button
              className="res-icon-button"
              aria-label={t("下一页")}
              title={t("下一页")}
              onClick={() => onPage(Math.min(preview.pageCount, page + 1))}
              disabled={!current || page >= preview.pageCount}
            >
              <Icon name="arrowRight" size={16} />
            </button>
          </>
        ) : (
          <span className="res-muted">{current ? t("共 1 页") : t("文件预览")}</span>
        )}
        <label> {t("缩放")}{" "}
          <select
            aria-label={t("缩放")}
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
        {(findOpen || (current && text.state !== "unsupported")) && (
          <button
            type="button"
            ref={findButton}
            aria-expanded={findOpen}
            onClick={() => {
              if (findOpen) closeFind();
              else {
                onRecognitionOpen?.(false);
                setFindOpen(true);
              }
            }}
          >
            <Icon name="search" size={16} /> {t("查找本页")} </button>
        )}
        {current && preview?.renditionFileId && onRecognitionWrite && (
          <button
            type="button"
            ref={recognitionButton}
            aria-expanded={recognitionOpen}
            onClick={() => {
              if (recognitionOpen) closeRecognition();
              else {
                setFindOpen(false);
                onRecognitionOpen?.(true);
              }
            }}
          >
            <Icon name="file" size={16} /> {t("识别文字")} </button>
        )}
        {text.state === "ready" && (
          <button
            className="res-copy-text"
            aria-label={t("复制本页文字")}
            title={t("也可在页面上拖选文字后复制")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text.text);
                setCopyMessage("本页文字已复制");
              } catch {
                setCopyMessage(
                  t("无法访问剪贴板，请选中文字后按 Ctrl+C 或 ⌘C 复制"),
                );
              }
            }}
          >
            <span role="status">
              {copyMessage === "本页文字已复制" ? t("本页文字已复制") : t("复制本页文字")}
            </span>
          </button>
        )}
      </div>
      {current && preview?.renditionFileId && onRecognitionWrite && (
        <Recognition
          open={recognitionOpen}
          client={client}
          fileId={fileId}
          renditionFileId={preview.renditionFileId}
          page={current.page}
          revision={recognitionRevision}
          onWrite={onRecognitionWrite}
          disabled={recognitionDisabled}
          onClose={closeRecognition}
          onLocateIssue={box => setIssueBox({...box})}
        />
      )}
      <PageFind
        open={findOpen}
        source={`${preview?.renditionFileId}:${current?.page}`}
        text={text}
        imageReady={loadedImage === current?.imageFileId}
        scrollRef={scrollRef}
        onClose={closeFind}
      />
      {((copyMessage && copyMessage !== "本页文字已复制") ||
        (text.state === "empty" && !recognitionOpen) ||
        text.state === "failed") && (
        <div className="res-text-status" role="status">
          {copyMessage ||
            (text.state === "empty"
              ? t("本页没有可提取文字，可能是扫描页或图片。")
              : t("文字暂时无法读取，仍可查看页面或下载原件。"))}
          {text.state === "failed" && (
            <button onClick={text.retry}>{t("重新读取文字")}</button>
          )}
        </div>
      )}
      {preview?.state === "limited" && (
        <div className="res-warning">
          <Icon name="info" size={16} />
          <span> {t("预览需核对：")} {preview.issues.includes("legacy-object-loss")
              ? t("旧 DOC 公式或对象可能缺失，请与原件对照，可补充 PDF。")
              : t("部分内容或字体需核对。")}
          </span>
          {onSupplement && (
            <button onClick={onSupplement}>{t("补充 PDF 预览")}</button>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="res-warning">
          {error}
          <button onClick={() => setReload((n) => n + 1)}>{t("重新读取预览")}</button>
        </div>
      )}
      {!preview?.pages.length && (
        <div className="res-empty">
          <span className="res-empty-icon">
            <Icon name="file" size={30} />
          </span>
          <h2>
            {unsupported
              ? t("此格式暂不支持在线预览")
              : failed
                ? t("暂时无法预览")
                : t("正在准备预览")}
          </h2>
          <p> {t("原文件已保存，可以随时下载。")} {unsupported
              ? t("请下载后用对应软件打开，或补充 PDF 预览。")
              : failed
                ? t("转换未完成，请确认原文件能正常打开，或补充 PDF 预览。")
                : t("预览完成后会自动显示。")}
          </p>
          {preview && !preparing && !unsupported && (
            <button
              onClick={generate}
              disabled={
                job && ["queued", "running", "cancelling"].includes(job.state)
              }
            >
              {preview?.state === "failed" ||
              ["failed", "cancelled", "interrupted"].includes(job?.state)
                ? t("重试预览")
                : t("生成预览")}
            </button>
          )}
          {failed && onSupplement && (
            <button onClick={onSupplement}>{t("补充 PDF 预览")}</button>
          )}
        </div>
      )}
      <div
        className="res-page-scroll"
        hidden={!current}
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
              alt={t("第 {{page}} 页", { page: current.page })}
              onLoad={() => {
                const element = scrollRef.current;
                element.scrollTop = scrollPosition?.top ?? 0;
                element.scrollLeft = scrollPosition?.left ?? 0;
                loadedPage.current = current.imageFileId;
                setLoadedImage(current.imageFileId);
                onViewed?.(current.page, preview);
              }}
            />
            {preview.renditionFileId && (
              <PdfText
                key={preview.renditionFileId}
                client={client}
                renditionId={preview.renditionFileId}
                page={current.page}
                onText={setText}
              />
            )}
            {issueBox && <span ref={issueMark} className="res-issue-box" aria-label={t("原稿疑点位置")}
              style={{left: `${issueBox.x * 100}%`, top: `${issueBox.y * 100}%`,
                width: `${issueBox.width * 100}%`, height: `${issueBox.height * 100}%`}} />}
          </div>
        )}
      </div>
    </section>
  );
}
