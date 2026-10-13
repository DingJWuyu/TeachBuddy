import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, useRef } from "react";
import { ControlledImage, DocumentView } from "../workbench/materials/DocumentView.jsx";
import { get, write, download } from "./materials-api.js";
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';
export default function OriginalPane({
  material,
  draft,
  onLocation,
  onCrop,
  scene,
  onScene,
  onVisibleLocation,
  readOnly = false,
}) {
  const { t } = useTranslation("questions");
  const files = [
    ...(material.input.fileIds ?? []),
    ...material.supplementFileIds,
  ];
  const [preview, setPreview] = useState(null),
    [error, setError] = useState("");
  const [previewFileId, setPreviewFileId] = useState(null);
  const start = useRef(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const nativePane = useRef(null);
  const [originalDocuments, setOriginalDocuments] = useState([]);
  useEffect(() => {
    let live = true;
    if (material.originalDocuments) setOriginalDocuments(material.originalDocuments);
    else get(`/imports/${material.id}`).then(value => {
      if (live) setOriginalDocuments(value.originalDocuments ?? []);
    }).catch(() => {});
    return () => {live = false;};
  }, [material.id, material.version]);
  const sourceParts = [...(draft?.parts ?? []), ...(draft?.noteFragments ?? []).map(fragment => ({ role: 'note', locations: fragment.locations }))];
  const loc = sourceParts
    .flatMap((p) => p.locations)
    .find((x) => x.kind === "page" || x.kind === "docx");
  const fileId = scene.fileId ?? loc?.fileId ?? files[0],
    page = scene.page ?? loc?.page ?? 1;
  const box = scene.selection?.fileId === fileId && scene.selection?.page === page ? scene.selection.box : null;
  const setBox = box => onScene({ selection: { fileId, page, box } });
  const locationRole = scene.locationRole ?? 'body';
  const setLocationRole = locationRole => onScene({ locationRole });
  const pageNode = useRef(null);
  const scrollKey = `${fileId}:${page}`;
  const restoreScroll = () => {
    if (!pageNode.current) return;
    const saved = scene.scrollPositions?.[scrollKey];
    pageNode.current.scrollTop = saved?.top ?? 0;
    pageNode.current.scrollLeft = saved?.left ?? 0;
  };
  useEffect(restoreScroll, [fileId, page, preview?.pages]);
  const focusedIssue = useRef(null);
  function focusIssue() {
    const image = pageNode.current?.querySelector('img');
    if (!box || !image?.complete || !scene.focusIssue || focusedIssue.current === scene.focusIssue) return;
    pageNode.current.scrollTop = Math.max(0, (box.y + box.height / 2) * image.clientHeight - pageNode.current.clientHeight / 2);
    focusedIssue.current = scene.focusIssue;
  }
  useEffect(focusIssue, [scene.focusIssue, preview?.pages]);
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError("");
    let timer;
    async function refresh() {
      try {
        const value = await get(`/api/workbench/files/${fileId}/preview`);
        if (!active) return;
        setPreview(value);
        setPreviewFileId(fileId);
        if (!value.pages.length && value.state !== "failed")
          timer = setTimeout(refresh, 2000);
        if (value.state === "failed")
          setError(t("原稿预览失败，可下载原稿或补充清晰照片"));
      } catch {
        if (active) setError(t("原稿预览暂不可用"));
      }
    }
    if (fileId) refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fileId, material.version, previewAttempt]);
  const current = previewFileId === fileId ? preview?.pages.find((x) => x.page === page) : null;
  const original = originalDocuments.find(item => item.fileId === fileId);
  const paragraph = scene.paragraph ?? loc?.paragraph;
  const legacyWord = preview?.issues.includes("legacy-object-loss");
  const paragraphLabel = legacyWord ? t("转换稿段落") : t("原文段落");
  const paragraphView = Boolean(original?.paragraphs.length && (scene.originalView === "paragraphs" || !current));
  useEffect(() => {
    const visible = fileId
      ? current && !paragraphView && previewFileId === fileId && preview.renditionFileId
        ? { kind: "page", fileId, renditionFileId: preview.renditionFileId, page, box: null }
        : null
      : material.input.kind === "text" && material.input.text.length
        ? { kind: "text", start: 0, end: [...material.input.text].length }
        : null;
    onVisibleLocation?.(visible);
  }, [fileId, page, current, paragraphView, preview, previewFileId, material.input, onVisibleLocation]);
  const restoreParagraph = () => {
    const pane = nativePane.current;
    const node = pane?.querySelector(`[data-paragraph="${Number(paragraph)}"]`);
    if (node) pane.scrollTop += node.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  };
  useEffect(restoreParagraph, [original, paragraph, paragraphView]);
  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const location = () => ({
    kind: "page",
    fileId,
    renditionFileId: preview.renditionFileId,
    page,
    box,
  });
  const positions =
    sourceParts.flatMap((p) =>
      p.locations.map((l) => ({ ...l, role: p.role })),
    ) ?? [];
  const roleName = {
    body: t("题面"),
    solution: t("答案"),
    note: t("教学笔记"),
    figure: t("配图"),
    unassigned: t("未分配"),
  };
  return (
    <section className={`q-original${paragraphView ? " is-word-view" : ""}`} aria-label={t("原始材料")}>
      <header>
        <strong>{t("原始材料")}</strong>
        {fileId && <button onClick={() => download(fileId)}>{t("下载原稿")}</button>}
      </header>
      {material.origin && <p className="q-origin">{t("出处：")}{material.origin}</p>}
      {preview?.issues.includes("legacy-object-loss") && (
        <p role="status">{t("旧版 DOC 转换可能丢失公式或嵌入对象，请下载原稿核对；缺失内容可补充文字或清晰照片。")}</p>
      )}
      {material.input.kind === "text" && (
        <pre>
          {(() => {
            const l =
              positions.find(
                (x) => x.kind === "text" && x.start === scene.textStart,
              ) ?? positions.find((x) => x.kind === "text");
            const chars = [...material.input.text];
            return l ? (
              <>
                {chars.slice(0, l.start).join("")}
                <mark>{chars.slice(l.start, l.end).join("")}</mark>
                {chars.slice(l.end).join("")}
              </>
            ) : (
              material.input.text
            );
          })()}
        </pre>
      )}
      {files.length > 0 && (
        <>
          <div className="q-tools">
            {files.length > 1 && <select
              aria-label={t("原稿文件")}
              value={fileId}
              onChange={(e) => onScene({ fileId: e.target.value, page: 1, paragraph: null })}
            >
              {files.map((id, i) => (
                <option key={id} value={id}> {t("原稿")} {i + 1}
                </option>
              ))}
            </select>}
            {current && Boolean(original?.paragraphs.length) && <select
              aria-label={t("原稿视图")} value={paragraphView ? "paragraphs" : "pages"}
              onChange={e => onScene({originalView: e.target.value})}>
              <option value="pages">{t("分页预览")}</option>
              <option value="paragraphs">{paragraphLabel}</option>
            </select>}
            {!paragraphView && Boolean(preview?.pages.length) && <>{preview.pages.length === 1 ? <span className="q-muted">{t("第 1 页")}</span> : <select
              aria-label={t("原稿页码")}
              value={page}
              onChange={(e) => onScene({ page: Number(e.target.value) })}
            >
              {(preview?.pages ?? []).map((x) => (
                <option key={x.page} value={x.page}> {t("第")} {x.page} {t("页")} </option>
              ))}
            </select>}
            <select
              aria-label={t("原稿缩放")}
              value={scene.zoom ?? 1}
              onChange={(e) => onScene({ zoom: Number(e.target.value) })}
            >
              <option value="1">{t("适合宽度")}</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
            </select></>}
          </div>
          {paragraphView && (
            <p>{paragraphLabel}{paragraph ? t(" · 段落 {{paragraph}}", { paragraph: paragraph }) : ""}{t("，不对应原稿页码。")}</p>
          )}
          {current && !paragraphView ? (
            <div className="q-page-scroll" ref={pageNode} onLoadCapture={() => {restoreScroll(); focusIssue();}}
              onScroll={event => onScene({ scrollPositions: { ...scene.scrollPositions,
                [scrollKey]: { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft } } })}>
              <div
                className="q-page"
                style={{ width: `${(scene.zoom ?? 1) * 100}%` }}
                onPointerDown={(e) => {
                  if (readOnly || !scene.adjusting) return;
                  start.current = point(e);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerUp={(e) => {
                  if (!start.current) return;
                  const a = start.current,
                    b = point(e);
                  start.current = null;
                  const next = {
                    x: Math.min(a.x, b.x),
                    y: Math.min(a.y, b.y),
                    width: Math.abs(a.x - b.x),
                    height: Math.abs(a.y - b.y),
                  };
                  if (next.width > 0.005 && next.height > 0.005) setBox(next);
                }}
              >
                <ControlledImage
                  fileId={current.imageFileId}
                  alt={t("原稿第 {{page}} 页", { page: page })}
                  widthMm={170}
                />
                {box && (
                  <span
                    className="q-box"
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.width * 100}%`,
                      height: `${box.height * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          ) : original?.paragraphs.length ? (
            <div className="q-word-original" ref={nativePane} onLoadCapture={restoreParagraph}>
              {original.paragraphs.map(item => <article key={item.paragraph}
                data-paragraph={item.paragraph} className={item.paragraph === paragraph ? "is-current" : ""}>
                <small>{t("段落")} {item.paragraph}</small>
                <DocumentView value={item.document} />
                {item.uncertain && <p>{t("此段公式请与下载的原稿核对。")}</p>}
              </article>)}
            </div>
          ) : (
            <p>{error || t("原稿已保存，预览尚未就绪")}</p>
          )}
          {!readOnly && current && !paragraphView && <ModuleDisclosure title={t("调整原稿选区")} open={Boolean(scene.adjusting)} onOpenChange={adjusting => onScene({ adjusting })}>
          <p className="q-muted">{t("在原稿上拖选区域，再选择用于定位或裁图。")}</p>
          <div className="q-tools">
            <select
              aria-label={t("定位用途")}
              value={locationRole}
              onChange={(e) => setLocationRole(e.target.value)}
            >
              <option value="body">{t("题面定位")}</option>
              <option value="solution">{t("答案定位")}</option>
            </select>
            <button
              disabled={readOnly || !box || !draft}
              onClick={() => onLocation(location(), locationRole)}
            > {t("保存选区定位")} </button>
            <button
              disabled={readOnly || !box || !draft}
              onClick={() => onCrop(location())}
            > {t("裁图加入题面")} </button>
          </div>
          </ModuleDisclosure>}
          {error && <button
              onClick={async () => {
                try {
                  await write(
                    `/api/workbench/files/${fileId}/preview`,
                    {},
                    crypto.randomUUID(),
                  );
                  setError("");
                  setPreviewAttempt(value => value + 1);
                } catch (e) {
                  setError(e.message);
                }
              }}
            > {t("重新生成预览")} </button>}
        </>
      )}
      {positions.length > 0 && (
        <div className="q-tools q-location-tools">
          {positions.map((l, i) => (
            <button
              key={i}
              onClick={() =>
                l.kind === "page"
                  ? onScene({ fileId: l.fileId, page: l.page, originalView: "pages" })
                  : l.kind === "text"
                    ? onScene({ textStart: l.start })
                    : onScene({ fileId: l.fileId, paragraph: l.paragraph, originalView: "paragraphs" })
              }
            > {t("定位")}{roleName[l.role]}{l.kind === 'page' ? t(" · 第 {{page}} 页", { page: l.page }) : l.kind === 'docx' ? t(" · 段落 {{paragraph}}", { paragraph: l.paragraph }) : ''}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
