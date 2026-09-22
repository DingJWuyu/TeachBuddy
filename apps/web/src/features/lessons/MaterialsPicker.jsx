import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useScene } from "../workbench/useScene.js";
import { useScrollRestore } from "../workbench/useScrollRestore.js";
import { useEffect, useState } from "react";
import { listSources, readSource } from "./api.js";
import { DocumentView } from "../workbench/materials/index.js";
export function MaterialsPicker({
  kind = "question",
  lessonTitle,
  targetLabel,
  selected,
  onToggle,
  onConfirm,
  onCancel,
  busy,
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
    [error, setError] = useState("");
  const scroll = useScrollRestore(
    scene.scrollTop,
    (top) => patchScene({ scrollTop: top }),
    items.length,
  );
  useEffect(() => {
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
    listSources(kind, query)
      .then((rows) => {
        if (live) setItems(rows);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [kind, query]);
  async function confirm() {
    try {
      const sources = await Promise.all(
        selected.map((id) => readSource(kind, id)),
      );
      if (sources.some((s) => s.deletedAt))
        throw new Error("所选材料已删除，请重新选择");
      onConfirm(sources);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="wb-page wb-picker">
      <header className="wb-picker-head">
        <h2>
          {kind === "resource" ? "取资源" : "取题"} · {lessonTitle} /{" "}
          {targetLabel}
        </h2>
        <button className="wb-button" onClick={onCancel}>
          取消
        </button>
        <button
          className="wb-button is-primary"
          disabled={busy || !selected.length}
          onClick={confirm}
        >
          采用所选 {selected.length} 项
        </button>
      </header>
      {(error || problem) && <p role="alert">{error || problem.message}</p>}
      <div className="r34-picker-columns">
        <section ref={scroll.ref} onScroll={scroll.onScroll}>
          <input
            className="wb-input"
            type="search"
            aria-label="搜索材料"
            placeholder="搜索材料"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {items.map((item) => (
            <div key={item.id} className="r34-picker-row">
              <input
                type="checkbox"
                aria-label={`选择 ${item.title}`}
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <button
                className="wb-text-button"
                onClick={() => patchScene({ previewId: item.id })}
              >
                {item.title || "未命名题目"}
              </button>
              <span className="wb-muted">
                {selected.includes(item.id)
                  ? `第 ${selected.indexOf(item.id) + 1} 项`
                  : existingQuestionIds.includes(item.id)
                    ? "已在此处采用"
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
              ) : (
                <p>{preview.snapshot.fileName}</p>
              )}
            </>
          ) : (
            <p className="wb-muted">选择材料查看内容</p>
          )}
        </section>
      </div>
    </div>
  );
}
