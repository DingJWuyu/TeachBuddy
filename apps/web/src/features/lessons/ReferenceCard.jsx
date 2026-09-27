import {
  ModulePresence,
  useModuleDialogFocus,
} from "../workbench/ModuleMotion.jsx";
import { MathSnapshot } from "./MathSnapshot.jsx";
import { FilePreview } from "./FilePreview.jsx";
/**
 * One reference inside a lesson: the adopted snapshot, this lesson's note, the
 * source state, and the explicit actions the teacher owns (adopt an update,
 * place the same question again, move or remove the reference).
 */

import { useEffect, useRef, useState } from "react";
import { DocumentView } from "../workbench/materials/index.js";
import { Icon } from "../workbench/icons.jsx";
import { excerptFor } from "../workbench/documents.js";
import { readSource } from "./api.js";
import { openLessonFile } from "./files.js";
import { Popover, MenuItem } from "../workbench/ModuleOverlays.jsx";
import { ModuleDisclosure } from "../workbench/ModuleMotion.jsx";

function UpdateCompareDialog({ reference, onAdopt, onClose, readOnly }) {
  const dialogRef = useRef(null);
  useModuleDialogFocus(dialogRef, onClose);
  const [current, setCurrent] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readSource(
      reference.kind ?? "question",
      reference.workId ?? reference.questionId ?? reference.resourceId,
    )
      .then((question) => {
        if (!cancelled) setCurrent({ ...question, ...question.snapshot });
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.problem?.message || "无法读取来源");
      });
    return () => {
      cancelled = true;
    };
  }, [
    reference.workId,
    reference.questionId,
    reference.resourceId,
    reference.kind,
  ]);

  return (
    <div className="wb-module wb-dialog-host" data-overlay="dialog">
      <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
      <div
        ref={dialogRef}
        className="wb-dialog wb-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="对照更新"
      >
        <header className="wb-dialog-head">
          <h2>对照更新</h2>
          <button
            type="button"
            className="wb-icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {error && <p className="wb-inline-error">{error}</p>}
        <div className="wb-compare-grid">
          <section className="wb-compare-side" data-region="reference-old">
            <h3>
              本课采用版本{" "}
              {reference.workVersion ??
                reference.questionVersion ??
                reference.resourceVersion}
            </h3>
            {reference.kind === "math" ? (
              <MathSnapshot snapshot={reference.snapshot} />
            ) : reference.kind === "resource" ? (
              <button
                className="wb-text-button"
                onClick={() =>
                  setPreviewFile(
                    reference.snapshot.supplementPreviewFileId ??
                      reference.snapshot.fileId,
                  )
                }
              >
                预览本课采用文件
              </button>
            ) : (
              <DocumentView value={reference.snapshot?.body} />
            )}
            {reference.kind !== "resource" && reference.snapshot?.solution && (
              <DocumentView value={reference.snapshot.solution} />
            )}
          </section>
          <section className="wb-compare-side" data-region="reference-new">
            <h3>来源当前版本 {current?.version ?? "…"}</h3>
            {current && (
              <>
                {reference.kind === "math" ? (
                  <MathSnapshot snapshot={current.snapshot} />
                ) : reference.kind === "resource" ? (
                  <button
                    className="wb-text-button"
                    onClick={() =>
                      setPreviewFile(
                        current.supplementPreviewFileId ?? current.fileId,
                      )
                    }
                  >
                    预览来源当前文件
                  </button>
                ) : (
                  <DocumentView value={current.body} />
                )}
                {reference.kind !== "resource" && current.solution && (
                  <DocumentView value={current.solution} />
                )}
              </>
            )}
          </section>
        </div>
        <div className="wb-dialog-actions">
          <button
            type="button"
            className="wb-button is-primary"
            name="adopt-update"
            disabled={
              readOnly ||
              !current ||
              current.version ===
                (reference.workVersion ??
                  reference.questionVersion ??
                  reference.resourceVersion)
            }
            onClick={() => onAdopt(current.version, current.snapshot)}
          >
            采用更新
          </button>
          <button type="button" className="wb-button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
      <ModulePresence present={Boolean(previewFile)}>
        {previewFile && (
          <FilePreview
            key={previewFile}
            fileId={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </ModulePresence>
    </div>
  );
}

export function ReferenceCard({
  reference,
  position,
  targets = [],
  onNoteChange,
  onRemove,
  onMove,
  onAdopt,
  onPlaceAgain,
  onOpenLesson,
  onCopyWork,
  onReorder,
  onPlacement,
  canMoveUp = false,
  canMoveDown = false,
  readOnly = false,
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(Boolean(reference.note));
  const [previewFile, setPreviewFile] = useState(null);
  const excerpt =
    excerptFor(reference.snapshot?.title || "", reference.snapshot?.body, 40) ||
    "题目";
  const hasUpdate =
    reference.sourceState === "active" &&
    Number.isInteger(reference.latestVersion) &&
    reference.latestVersion >
      (reference.workVersion ??
        reference.questionVersion ??
        reference.resourceVersion);

  return (
    <article
      className="wb-reference"
      data-reference-id={reference.id}
      data-source-state={reference.sourceState}
    >
      <header className="wb-reference-head">
        <h4>{excerpt}</h4>
        <span className="wb-muted">
          采用版本{" "}
          {reference.workVersion ??
            reference.questionVersion ??
            reference.resourceVersion}
        </span>
        {reference.sourceState === "deleted" && (
          <span className="wb-tag is-deleted" data-region="source-deleted">
            来源已删除
          </span>
        )}
        {hasUpdate && (
          <button
            type="button"
            className="wb-chip is-attention"
            name="view-update"
            onClick={() => setCompareOpen(true)}
          >
            有更新 · 查看
          </button>
        )}
        {!readOnly && (
          <Popover label={`材料操作 ${excerpt}`}>
            {({ close }) => (
              <>
                {onReorder && (
                  <>
                    <MenuItem
                      disabled={!canMoveUp}
                      onClick={() => {
                        close();
                        onReorder(-1);
                      }}
                    >
                      上移材料
                    </MenuItem>
                    <MenuItem
                      disabled={!canMoveDown}
                      onClick={() => {
                        close();
                        onReorder(1);
                      }}
                    >
                      下移材料
                    </MenuItem>
                  </>
                )}
                {onPlacement && <MenuItem onClick={() => { close(); onPlacement(); }}>放到正文之间</MenuItem>}
                {targets.map((target) => (
                  <MenuItem
                    key={target.value}
                    onClick={() => {
                      close();
                      onMove(target.value);
                    }}
                  >
                    移到{target.label}
                  </MenuItem>
                ))}
                <MenuItem
                  icon="copy"
                  onClick={() => {
                    close();
                    onPlaceAgain();
                  }}
                >
                  再放一次
                </MenuItem>
                {onCopyWork && (
                  <MenuItem
                    onClick={() => {
                      close();
                      onCopyWork();
                    }}
                  >
                    另存作品并替换本处
                  </MenuItem>
                )}
                <MenuItem
                  danger
                  icon="trash"
                  onClick={() => {
                    close();
                    onRemove();
                  }}
                >
                  从本课移除
                </MenuItem>
              </>
            )}
          </Popover>
        )}
      </header>
      <div className="wb-reference-body">
        {reference.kind === "math" ? (
          <MathSnapshot snapshot={reference.snapshot} />
        ) : reference.kind === "resource" ? (
          <div className="wb-reference-file-actions">
            <button
              className="wb-text-button"
              onClick={() =>
                setPreviewFile(
                  reference.snapshot.supplementPreviewFileId ??
                    reference.snapshot.fileId,
                )
              }
            >
              {reference.snapshot.fileName} · 预览采用文件
            </button>
            <button
              className="wb-text-button"
              onClick={() =>
                openLessonFile(
                  reference.snapshot.fileId,
                  reference.snapshot.fileName,
                )
              }
            >
              下载原件
            </button>
          </div>
        ) : (
          <DocumentView value={reference.snapshot?.body} />
        )}
      </div>
      {reference.snapshot?.solution &&
        (reference.snapshot.solution.blocks || []).length > 0 && (
          <ModuleDisclosure className="wb-answer" title="答案与解析">
            <DocumentView document={reference.snapshot.solution} />
          </ModuleDisclosure>
        )}
      {readOnly ? (
        reference.note && (
          <div className="lesson-reference-note-read">
            <Icon name="prep" size={14} />
            <span>本课备注：{reference.note}</span>
          </div>
        )
      ) : (
        <>
          {!noteOpen && (
            <button
              className="wb-text-button lesson-note-toggle"
              onClick={() => setNoteOpen(true)}
            >
              <Icon name="plus" size={14} />
              添加本课备注
            </button>
          )}
          <ModulePresence present={noteOpen} mode="collapse">
            <label className="wb-reference-note">
              <span className="lesson-note-label">
                <span>本课备注</span>
                {!reference.note && (
                  <button
                    className="wb-icon-button"
                    type="button"
                    aria-label="收起空备注"
                    onClick={() => setNoteOpen(false)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </span>
              <textarea
                className="wb-input"
                rows={2}
                aria-label={`本课备注 ${excerpt}`}
                placeholder="记下这道题怎么讲，或提醒自己注意什么…"
                value={reference.note || ""}
                onChange={(event) => onNoteChange(event.target.value)}
              />
            </label>
          </ModulePresence>
        </>
      )}
      {onOpenLesson && (
        <button
          type="button"
          className="wb-text-button lesson-source-link"
          onClick={onOpenLesson}
        >
          查看来源
          <Icon name="chevron" size={13} />
        </button>
      )}
      <ModulePresence present={Boolean(previewFile)}>
        {previewFile && (
          <FilePreview
            fileId={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </ModulePresence>
      <ModulePresence present={Boolean(compareOpen)}>
        {compareOpen && (
          <UpdateCompareDialog
            readOnly={readOnly}
            reference={reference}
            onClose={() => setCompareOpen(false)}
            onAdopt={(version, snapshot) => {
              onAdopt(version, snapshot);
              setCompareOpen(false);
            }}
          />
        )}
      </ModulePresence>
    </article>
  );
}
