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
  selected,
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
        throw new Error("所选材料已删除，请重新选择");
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
              {kind === "math"
                ? "加入数学作品"
                : kind === "resource"
                  ? "加入资源"
                  : "加入题目"}
            </h1>
            <p>
              加入到：{lessonTitle} /{" "}
              {targetLabel === "本课材料" ? "备用材料" : targetLabel}
            </p>
          </div>
        </div>
        <button
          className="wb-button"
          disabled={busy || confirming || awaitingConfirmation}
          onClick={onCancel}
        >
          返回课稿
        </button>
        {!!selected.length && onRemoveSelection && (
          <button
            className="wb-button"
            disabled={busy || confirming || awaitingConfirmation}
            onClick={() => onRemoveSelection(selected)}
          >
            清空选择
          </button>
        )}
        {awaitingConfirmation ? (
          <button
            className="wb-button is-primary"
            disabled={busy || confirming}
            onClick={onRetry}
          >
            重试确认取材
          </button>
        ) : (
          <button
            className="wb-button is-primary"
            disabled={busy || confirming || !selection.length}
            onClick={confirm}
          >
            加入 {selection.length} {kind === "question" ? "道题" : "份材料"}
          </button>
        )}
      </header>
      {(error || problem) && <p role="alert">{error || problem.message}</p>}
      <div className="r34-picker-columns">
        <section ref={scroll.ref} onScroll={scroll.onScroll}>
          <input
            className="wb-input"
            type="search"
            aria-label="搜索材料"
            placeholder={
              kind === "question"
                ? "搜索题目"
                : kind === "math"
                  ? "搜索数学作品"
                  : "搜索资源"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!items.length && (
            <p className="wb-empty-note">
              {loading
                ? "正在读取材料…"
                : query
                  ? "没有匹配的材料"
                  : "暂无可选材料"}
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`r34-picker-row${scene.previewId === item.id ? " is-previewed" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`选择 ${item.title}`}
                checked={selection.includes(item.id)}
                disabled={
                  busy ||
                  confirming ||
                  awaitingConfirmation ||
                  existingQuestionIds.includes(item.id)
                }
                onChange={() => onToggle(item.id)}
              />
              <button
                className="wb-text-button"
                aria-pressed={scene.previewId === item.id}
                onClick={() => patchScene({ previewId: item.id })}
              >
                {item.title || "未命名题目"}
              </button>
              <span className="wb-muted">
                {selected.includes(item.id)
                  ? `第 ${selected.indexOf(item.id) + 1} 项`
                  : existingQuestionIds.includes(item.id)
                    ? "已在此环节"
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
                    <summary>答案与解析</summary>
                    <DocumentView value={preview.snapshot.solution} />
                  </details>
                </>
              ) : kind === "math" ? (
                <MathSnapshot snapshot={preview.snapshot} />
              ) : (
                <button
                  className="wb-button"
                  onClick={() =>
                    setPreviewFile(
                      preview.snapshot.supplementPreviewFileId ??
                        preview.snapshot.fileId,
                    )
                  }
                >
                  预览 {preview.snapshot.fileName}
                </button>
              )}
            </>
          ) : (
            <p className="wb-muted">点击标题先查看内容，勾选后加入课稿。</p>
          )}
        </section>
      </div>
      <ModulePresence present={Boolean(previewFile)}>
        {previewFile && (
          <FilePreview
            fileId={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </ModulePresence>
    </div>
  );
}
