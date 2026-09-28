import { useTranslation } from 'react-i18next';

import { ModulePresence } from "../workbench/ModuleMotion.jsx";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useScene } from "../workbench/useScene.js";
import { useScrollRestore } from "../workbench/useScrollRestore.js";
import { useEffect, useState } from "react";
import { listSources, readSource } from "./api.js";
import { DocumentView } from "../workbench/materials/index.js";
import { MathSnapshot } from "./MathSnapshot.jsx";
import { FilePreview } from "./FilePreview.jsx";
import { Icon } from "../workbench/icons.jsx";
export function MaterialsPicker({
  kind = "question",
  lessonTitle,
  targetLabel,
  selected = [],
  onPickPage,
  onToggle,
  onRemoveSelection,
  onConfirm,
  onCancel,
  busy,
  awaitingConfirmation = false,
  onRetry,
  problem,
  existingQuestionIds = [],
}) {
  const { t } = useTranslation('lessons');
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(
    shell.accountKey,
    `lesson-picker-${kind}`,
    { query: "", previewId: null, scrollTop: 0 },
  );
  const query = scene.query;
  const setQuery = (query) => patchScene({ query });
  const [items, setItems] = useState([]),
    [preview, setPreview] = useState(null),
    [previewFile, setPreviewFile] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const selection = selected.filter((id) => !existingQuestionIds.includes(id));
  const scroll = useScrollRestore(
    scene.scrollTop,
    (top) => patchScene({ scrollTop: top }),
    items.length,
  );
  useEffect(() => {
    setPreview(null);
    if (!scene.previewId) return;
    let live = true;
    readSource(kind, scene.previewId)
      .then((value) => {
        if (live) setPreview(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [kind, scene.previewId]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    listSources(kind, query)
      .then((rows) => {
        if (live) {
          setItems(rows);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [kind, query]);
  async function confirm() {
    if (confirming || busy || awaitingConfirmation) return;
    setConfirming(true);
    setError("");
    try {
      const sources = await Promise.all(
        selection.map((id) => readSource(kind, id)),
      );
      if (sources.some((s) => s.deletedAt))
        throw new Error(t("所选材料已删除，请重新选择"));
      onConfirm(sources);
    } catch (e) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  }
  return (
    <div className="wb-module wb-page wb-picker lesson-picker">
      <header className="wb-picker-head">
        <div className="lesson-picker-title">
          <span className="lesson-page-icon">
            <Icon
              name={
                kind === "question"
                  ? "question"
                  : kind === "math"
                    ? "math"
                    : "folder"
              }
              size={23}
            />
          </span>
          <div>
            <h1>
              {onPickPage ? t("从资料提取正文") : kind === "math"
                ? t("加入数学作品")
                : kind === "resource"
                  ? t("加入资源")
                  : t("加入题目")}
            </h1>
            <p>
              {t("加入到：")}{lessonTitle} /{" "}
              {targetLabel === t("本课材料") ? t("备用材料") : targetLabel}
            </p>
          </div>
        </div>
        <button
          className="wb-button"
          disabled={busy || confirming || awaitingConfirmation}
          onClick={onCancel}
        >
          {t("返回课稿")}
        </button>
        {!!selected.length && onRemoveSelection && (
          <button
            className="wb-button"
            disabled={busy || confirming || awaitingConfirmation}
            onClick={() => onRemoveSelection(selected)}
          >
            {t("清空选择")}
          </button>
        )}
        {!onPickPage && (awaitingConfirmation ? (
          <button
            className="wb-button is-primary"
            disabled={busy || confirming}
            onClick={onRetry}
          >
            {t("重试确认取材")}
          </button>
        ) : (
          <button
            className="wb-button is-primary"
            disabled={busy || confirming || !selection.length}
            onClick={confirm}
          >
            {t("加入")} {selection.length} {kind === "question" ? t("道题") : t("份材料")}
          </button>
        ))}
      </header>
      {(error || problem) && <p role="alert">{error || problem.message}</p>}
      <div className="r34-picker-columns">
        <section ref={scroll.ref} onScroll={scroll.onScroll}>
          <input
            className="wb-input"
            type="search"
            aria-label={t("搜索材料")}
            placeholder={
              kind === "question"
                ? t("搜索题目")
                : kind === "math"
                  ? t("搜索数学作品")
                  : t("搜索资源")
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!items.length && (
            <p className="wb-empty-note">
              {loading
                ? t("正在读取材料…")
                : query
                  ? t("没有匹配的材料")
                  : t("暂无可选材料")}
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`r34-picker-row${scene.previewId === item.id ? " is-previewed" : ""}`}
            >
              {!onPickPage && <input
                type="checkbox"
                aria-label={t("选择 {{title}}", { title: item.title })}
                checked={selection.includes(item.id)}
                disabled={
                  busy ||
                  confirming ||
                  awaitingConfirmation ||
                  existingQuestionIds.includes(item.id)
                }
                onChange={() => onToggle(item.id)}
              />}
              <button
                className="wb-text-button"
                aria-pressed={scene.previewId === item.id}
                onClick={() => patchScene({ previewId: item.id })}
              >
                {item.title || t("未命名题目")}
              </button>
              <span className="wb-muted">
                {selected.includes(item.id)
                  ? t("第 {{number}} 项", { number: selected.indexOf(item.id) + 1 })
                  : existingQuestionIds.includes(item.id)
                    ? t("已在此环节")
                    : ""}
              </span>
            </div>
          ))}
        </section>
        <section>
          {preview ? (
            <>
              <h3>{preview.snapshot.title}</h3>
              {kind === "question" ? (
                <>
                  <DocumentView value={preview.snapshot.body} />
                  <details>
                    <summary>{t("答案与解析")}</summary>
                    <DocumentView value={preview.snapshot.solution} />
                  </details>
                </>
              ) : kind === "math" ? (
                <MathSnapshot snapshot={preview.snapshot} />
              ) : (
                <button
                  className="wb-button"
                  onClick={() =>
                    setPreviewFile({
                      fileId: preview.snapshot.supplementPreviewFileId ?? preview.snapshot.fileId,
                      source: preview,
                    })
                  }
                >
                  {onPickPage ? t("预览并选择一页") : t("预览 {{fileName}}", { fileName: preview.snapshot.fileName })}
                </button>
              )}
            </>
          ) : (
            <p className="wb-muted">{onPickPage ? t("选择资料，再从预览中选一页，识别并校对后加入课稿。") : t("点击标题先查看内容，勾选后加入课稿。")}</p>
          )}
        </section>
      </div>
      <ModulePresence present={Boolean(previewFile)}>
        {previewFile && (
          <FilePreview
            fileId={previewFile.fileId}
            title={onPickPage ? t("选择要提取的资料页") : undefined}
            onSelectPage={onPickPage ? page => onPickPage(previewFile.source, page) : undefined}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </ModulePresence>
    </div>
  );
}
