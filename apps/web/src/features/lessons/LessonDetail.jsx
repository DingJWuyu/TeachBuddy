import { useMathReturn } from "./useMathReturn.js";
import { lessonDocuments, supportedDocument } from "@refatos/shared";
import { ExportsPanel } from "./ExportsPanel.jsx";
import { MaterialsPicker } from "./MaterialsPicker.jsx";
import "./materials.css";
/**
 * One lesson: title, intro, sections with references and 本课材料.
 *
 * The whole lesson is one versioned aggregate; every structural action edits the
 * local input and the teacher commits it with a single save. Picking questions
 * saves the current draft first and keeps the target and selection across a
 * refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useWorkbenchShell,
  useAuxiliaryTools,
} from "../workbench/shellContext.js";
import { useScene } from "../workbench/useScene.js";
import { useSavableDocument } from "../workbench/useSavableDocument.js";
import { useIdempotentSubmit } from "../workbench/useIdempotentSubmit.js";
import { SaveActions, SaveStatus } from "../workbench/SaveStatus.jsx";
import { LessonDocumentEditor as DocumentEditor } from "./LessonDocumentEditor.jsx";
import { DocumentView } from "../workbench/materials/index.js";
import { ConfirmDialog, MenuItem, Popover } from "../workbench/overlays.jsx";
import { ConflictResolution } from "../workbench/ConflictResolution.jsx";
import { Icon } from "../workbench/icons.jsx";
import { navigate } from "../workbench/routes.js";
import { useSaveShortcut } from "../workbench/useSaveShortcut.js";
import {
  createLesson,
  getLesson,
  setLessonDeletion,
  updateLesson,
} from "./api.js";
import {
  addReferences,
  adoptReferenceVersion,
  buildCreateLessonPayload,
  buildUpdateLessonPayload,
  deleteSection,
  emptyLessonInput,
  lessonInputFrom,
  moveReference,
  reorderReference,
  targetReferences,
  moveSection,
  newReference,
  newSection,
  removeReference,
  renameSection,
  setReferenceNote,
  targetFromValue,
  targetLabel,
  targetValue,
  validateLessonInput,
} from "./model.js";
import { useLessonPickerFlow } from "./useLessonPickerFlow.js";
import { ReferenceCard } from "./ReferenceCard.jsx";
import { LessonIndex, LessonOutline } from "./LessonPanels.jsx";
import { SourceRecordsPanel } from "../classes/index.jsx";

export default function LessonDetail({ id }) {
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(shell.accountKey, "lesson-detail", {
    picker: null,
  });
  const isNew = id === "new";

  const savable = useSavableDocument({
    accountKey: shell.accountKey,
    generation: shell.generation,
    kind: "lesson",
    draftId: id,
    mode: isNew ? "create" : "update",
    load: isNew ? undefined : () => getLesson(id),
    create: createLesson,
    update: updateLesson,
    buildCreate: buildCreateLessonPayload,
    buildUpdate: buildUpdateLessonPayload,
    inputFromObject: lessonInputFrom,
    prepareDraft: async () => ({ input: emptyLessonInput(), baseline: null }),
  });

  const mathReturn = useMathReturn({ shell, savable, id });

  const deleteSubmit = useIdempotentSubmit({
    accountKey: shell.accountKey,
    name: `pending:lesson-deletion:${id}`,
  });
  const [dialog, setDialog] = useState(null);
  const [localProblem, setLocalProblem] = useState(null);

  const input = savable.input || emptyLessonInput();
  const baseline = savable.baseline;
  const deleted = Boolean(baseline?.deletedAt);
  const unsupported = [baseline, input].filter(Boolean).some((lesson) =>
    lessonDocuments(lesson).some(([, document]) => !supportedDocument(document)),
  );
  const saveStatus = savable.status;

  const pickerFlow = useLessonPickerFlow({
    savable,
    scene,
    patchScene,
    isNew,
    navigate,
  });
  const picker = pickerFlow.picker;

  const manuscriptTop = useRef(scene.scrollTop || 0);
  const manuscriptNode = useRef(null);
  const attachManuscript = useCallback((node) => {
    manuscriptNode.current = node;
    if (node) node.scrollTop = manuscriptTop.current;
  }, []);
  useEffect(() => {
    if (manuscriptNode.current)
      manuscriptNode.current.scrollTop = manuscriptTop.current;
  }, [input.sections.length]);

  const usageFocused = useRef(false);
  useEffect(() => {
    const usage = shell.questionUsage;
    if (usageFocused.current || !baseline || usage?.lessonPath !== `/lessons/${id}`) return;
    const reference = manuscriptNode.current?.querySelector(`[data-reference-id="${usage.referenceId}"]`);
    if (reference) {
      usageFocused.current = true;
      reference.scrollIntoView({ block: "center" });
    }
  }, [baseline, id, shell.questionUsage]);

  useAuxiliaryTools([
    {
      id: "lessons-index",
      label: "我的备课",
      render: () => <LessonIndex currentId={baseline?.id || id} />,
    },
    {
      id: "lesson-outline",
      label: "本课大纲",
      render: () => (
        <LessonOutline
          input={input}
          readOnly={unsupported}
          onFocus={(sectionId) =>
            document
              .getElementById(`section-${sectionId}`)
              ?.scrollIntoView({ block: "start" })
          }
          onMove={(sectionId, offset) =>
            savable.setInput((current) =>
              moveSection(current, sectionId, offset),
            )
          }
        />
      ),
    },
  ]);

  useEffect(() => {
    if (isNew && baseline?.id && ["saved", "dirty"].includes(saveStatus)) {
      // Confirmation may leave newer edits. Move them to the created lesson
      // before leaving /new, so the next save updates that same lesson.
      if (saveStatus === "dirty" && !savable.checkpoint(baseline.id, { move: true })) return;
      navigate(`/lessons/${baseline.id}`, { replace: true });
    }
  }, [baseline?.id, isNew, saveStatus]);

  function handleSave(options = {}) {
    if (unsupported && !options.retry) return;
    if (!options.retry) {
      const problem = validateLessonInput(input);
      if (problem) {
        setLocalProblem(problem);
        return;
      }
    }
    setLocalProblem(null);
    savable.save(options);
  }

  useSaveShortcut(
    () => handleSave(),
    !unsupported && saveStatus !== "identity" && saveStatus !== "deleted",
  );

  async function handleDeletion(nextDeleted) {
    if (unsupported) return;
    const result = await deleteSubmit.submit(
      ({ key, payload }) =>
        setLessonDeletion({ key, id: baseline.id, payload: payload.body ?? payload, version: payload.apiVersion ?? 2 }),
      { apiVersion: 3, body: { baseVersion: baseline.version, deleted: nextDeleted } },
    );
    if (result) {
      setDialog(null);
      await savable.adoptServer();
    }
  }

  if (savable.loadState === "missing") {
    return (
      <div className="wb-page wb-not-found" data-region="lesson-missing">
        <p>未找到内容</p>
        <a
          className="wb-link"
          href="/lessons"
          onClick={(event) => {
            event.preventDefault();
            navigate("/lessons");
          }}
        >
          返回备课列表
        </a>
      </div>
    );
  }

  if (savable.loadState === "error") {
    return (
      <div className="wb-page wb-inline-error" data-region="lesson-load-error">
        <p>{savable.loadError?.message || "读取失败"}</p>
        <button
          type="button"
          className="wb-button"
          onClick={savable.adoptServer}
        >
          重试
        </button>
      </div>
    );
  }

  // Restore the document before mounting panels that initialize per-lesson
  // options and pending requests from its input and saved identity.
  if (savable.loadState === "loading" || !savable.input) {
    return (
      <div className="wb-page wb-empty-note" role="status" data-region="lesson-loading">
        正在读取备课…
      </div>
    );
  }

  const pickerDialogs = (
    <>
      {pickerFlow.targetGone && picker && (
        <ConfirmDialog
          title="目标环境已变化"
          message={`环节「${targetLabel(input, picker.target)}」在本课已不存在。选题仍保留，可以改选本课材料或取消。`}
          confirmLabel="改选本课材料"
          onCancel={pickerFlow.dismissTargetGone}
          onConfirm={pickerFlow.moveToMaterials}
        />
      )}
      {pickerFlow.conflict && picker && (
        <ConfirmDialog
          title="备课已在别处修改"
          message="取回服务器版本才能继续加入，选题会保留；本地尚未保存的文稿不会被自动丢弃，请先自行处理。"
          confirmLabel="取回服务器版本"
          onCancel={pickerFlow.dismissConflict}
          onConfirm={pickerFlow.takeServerVersion}
        />
      )}
    </>
  );

  if (picker) {
    const targetReferences =
      picker.target.type === "materials"
        ? input.materials
        : input.sections.find(
            (section) => section.id === picker.target.sectionId,
          )?.references || [];
    return (
      <>
        {pickerDialogs}
        <MaterialsPicker
          kind={picker.kind}
          lessonTitle={input.title}
          targetLabel={targetLabel(input, picker.target)}
          existingQuestionIds={targetReferences.filter(reference => !picker.attemptedReferenceIds?.includes(reference.id)).map(
            (reference) => reference.workId ?? reference.questionId ?? reference.resourceId,
          )}
          selected={picker.selected}
          busy={pickerFlow.pendingConfirm || saveStatus === "saving"}
          awaitingConfirmation={Boolean(savable.pending)}
          onRetry={pickerFlow.retryConfirm}
          problem={pickerFlow.problem || savable.problem}
          onToggle={(questionId) =>
            pickerFlow.setSelection(
              picker.selected.includes(questionId)
                ? picker.selected.filter((item) => item !== questionId)
                : [...picker.selected, questionId],
            )
          }
          onRemoveSelection={(ids) =>
            pickerFlow.setSelection(
              picker.selected.filter((item) => !ids.includes(item)),
            )
          }
          onConfirm={pickerFlow.confirm}
          onCancel={pickerFlow.cancel}
        />
      </>
    );
  }

  if (scene.exportsOpen)
    return (
      <ExportsPanel
        savable={savable}
        onClose={(field) => {
          patchScene({ exportsOpen: false });
          if (field)
            setTimeout(() => {
              const section = field.match(/^\/sections\/(\d+)/);
              const area = section
                ? document.getElementById(
                    `section-${input.sections[Number(section[1])]?.id}`,
                  )
                : document.querySelector('[data-document-editor="开头文稿"]');
              area?.scrollIntoView({ block: "center" });
              area?.querySelector("textarea")?.focus();
            }, 0);
        }}
      />
    );

  const targets = [
    { value: "materials", label: "本课材料" },
    ...(input.sections || [])
      .map((section) => targetValue({ type: "section", sectionId: section.id }))
      .map((value, index) => ({ value, label: input.sections[index].title })),
  ];

  function positionOf(referenceId) {
    if (
      (input.materials || []).some((reference) => reference.id === referenceId)
    )
      return "materials";
    const section = (input.sections || []).find((item) =>
      item.references.some((reference) => reference.id === referenceId),
    );
    return targetValue(
      section
        ? { type: "section", sectionId: section.id }
        : { type: "materials" },
    );
  }

  function referenceActions(reference) {
    const position = positionOf(reference.id);
    const references = targetReferences(input, targetFromValue(position));
    const referenceIndex = references.findIndex(item => item.id === reference.id);
    return (
      <ReferenceCard
        readOnly={unsupported}
        key={reference.id}
        reference={reference}
        position={position}
        targets={targets.filter((target) => target.value !== position)}
        canMoveUp={referenceIndex > 0}
        canMoveDown={referenceIndex < references.length - 1}
        onReorder={(offset) => savable.setInput(current => reorderReference(current, reference.id, offset))}
        onNoteChange={(note) =>
          savable.setInput((current) =>
            setReferenceNote(current, reference.id, note),
          )
        }
        onRemove={() =>
          savable.setInput((current) => removeReference(current, reference.id))
        }
        onMove={(value) =>
          savable.setInput((current) =>
            moveReference(current, reference.id, targetFromValue(value)),
          )
        }
        onAdopt={(version, snapshot) =>
          savable.setInput((current) =>
            adoptReferenceVersion(current, reference.id, version, snapshot),
          )
        }
        onPlaceAgain={() =>
          savable.setInput((current) =>
            addReferences(current, targetFromValue(position), [
              { ...reference, id: crypto.randomUUID() },
            ]),
          )
        }
        onCopyWork={reference.kind === "math" ? () => mathReturn.enter(targetFromValue(position), reference) : undefined}
        onOpenLesson={() =>
          (shell.openMaterialSource ?? navigate)(
            reference.kind === "math" ? `/math?workId=${reference.workId}` : reference.kind === "resource"
              ? `/resources/${reference.resourceId}`
              : `/questions/${reference.questionId}`,
            `/lessons/${id}`,
          )
        }
      />
    );
  }

  return (
    <div
      className="wb-page wb-lesson"
      data-region="lesson-editor"
      data-lesson-id={baseline?.id || id}
    >
      {mathReturn.pending && <div className="wb-inline-error" role="status">
        <span>{mathReturn.problem || '作品已保存，正在确认加入备课'}</span>
        <button className="wb-button" disabled={mathReturn.busy} onClick={mathReturn.retry}>确认带回</button>
        <button className="wb-button" disabled={mathReturn.busy} onClick={mathReturn.toMaterials}>放入本课材料</button>
        <button className="wb-button" disabled={mathReturn.busy} onClick={mathReturn.cancel}>取消带回</button>
      </div>}
      <header className="wb-object-head wb-lesson-head">
        <input
          className="wb-input wb-object-title-input"
          aria-label="课题"
          readOnly={unsupported}
          value={input.title}
          maxLength={200}
          onChange={(event) =>
            savable.setInput((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
        />
        <div className="wb-lesson-actions">
          <button
            className="wb-button"
            onClick={() => patchScene({ exportsOpen: true })}
          >
            输出
          </button>
          <SaveActions savable={savable} onSave={handleSave} disabled={unsupported} />
          <button
            type="button"
            className="wb-button"
            name="open-lesson-index"
            onClick={() => shell.openPanel("lessons-index")}
          >
            <Icon name="prep" size={15} />
            我的备课
          </button>
          <Popover label="更多操作">
            {({ close }) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    shell.openPanel("lesson-outline");
                  }}
                >
                  本课大纲
                </MenuItem>
                {deleted ? (
                  <MenuItem
                    disabled={unsupported}
                    icon="back"
                    onClick={() => {
                      close();
                      handleDeletion(false);
                    }}
                  >
                    恢复备课
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon="trash"
                    disabled={unsupported}
                    danger
                    onClick={() => {
                      close();
                      setDialog("delete");
                    }}
                  >
                    删除备课
                  </MenuItem>
                )}
                {baseline && savable.localDraft && (
                  <MenuItem
                    icon="back"
                    onClick={() => {
                      close();
                      if (window.confirm("放弃未保存的草稿，回到已保存版本？"))
                        savable.discardDraft();
                    }}
                  >
                    放弃草稿
                  </MenuItem>
                )}
              </>
            )}
          </Popover>
        </div>
        <SaveStatus savable={savable} />
      </header>

      {deleted && (
        <div className="wb-banner" data-region="lesson-deleted">
          这份备课已删除，环节与引用都保留，可以恢复。
        </div>
      )}

      {localProblem && (
        <p className="wb-inline-error" data-region="local-problem">
          {localProblem.message}
        </p>
      )}
      {saveStatus === "conflict" && (
        <ConflictResolution
          savable={savable}
          onAdopt={async () => { const current = await savable.adoptServer(); if (current) mathReturn.adoptBaseline(current.version); }}
          hint="当前备课草稿保留在这里。采用服务器版本会丢弃本地输入，请先对照。"
          renderServer={(server) => (
            <>
              <h4>{server.title}</h4>
              <DocumentView document={server.intro} />
              {(server.sections || []).map((section) => (
                <div key={section.id}>
                  <h5>{section.title}</h5>
                  <DocumentView value={section.content} />
                </div>
              ))}
            </>
          )}
        />
      )}
      {(deleteSubmit.problem || deleteSubmit.pending) && (
        <div className="wb-inline-error" data-region="lesson-delete-problem">
          <p>{deleteSubmit.problem?.message || "上次删除操作的结果未确认"}</p>
          {deleteSubmit.pending && (
            <button
              type="button"
              className="wb-button is-primary"
              name="retry-confirm"
              onClick={() =>
                deleteSubmit.retry(({ key, payload }) =>
                  setLessonDeletion({ key, id: baseline.id, payload: payload.body ?? payload, version: payload.apiVersion ?? 2 }),
                )
              }
            >
              重试确认
            </button>
          )}
        </div>
      )}

      <div
        className="wb-lesson-scroll"
        data-region="lesson-scroll"
        ref={attachManuscript}
        onScroll={(event) => {
          manuscriptTop.current = event.currentTarget.scrollTop;
          patchScene({ scrollTop: manuscriptTop.current });
        }}
      >
        {baseline?.id && <details className="wb-lesson-block" data-region="lesson-teaching-feedback"
          open={Boolean(scene.feedbackOpen)} onToggle={event => {
            if (event.currentTarget.open !== Boolean(scene.feedbackOpen)) patchScene({ feedbackOpen: event.currentTarget.open });
          }}>
          <summary>教学反馈</summary>
          {scene.feedbackOpen && <SourceRecordsPanel kind="lesson" id={baseline.id} onOpenRecord={(record) => shell.openMaterialSource(`/classes/${record.classId}/records/${record.id}`, `/lessons/${id}`)} />}
        </details>}
        <section className="wb-lesson-block">
          <h3>开头文稿</h3>
          <DocumentEditor
            label="开头文稿"
            readOnly={unsupported}
            value={input.intro}
            onChange={(intro) =>
              savable.setInput((current) => ({ ...current, intro }))
            }
          />
        </section>

        {(input.sections || []).map((section, index) => (
          <section
            className="wb-section"
            key={section.id}
            id={`section-${section.id}`}
            data-section-id={section.id}
          >
            <header className="wb-section-head">
              <input
                className="wb-input wb-section-title"
                aria-label={`环节名称 ${index + 1}`}
                readOnly={unsupported}
                value={section.title}
                maxLength={200}
                onChange={(event) =>
                  savable.setInput((current) =>
                    renameSection(current, section.id, event.target.value),
                  )
                }
              />
              <button
                type="button"
                className="wb-icon-button"
                aria-label={`上移环节 ${section.title}`}
                disabled={unsupported || index === 0}
                onClick={() =>
                  savable.setInput((current) =>
                    moveSection(current, section.id, -1),
                  )
                }
              >
                ↑
              </button>
              <button
                type="button"
                className="wb-icon-button"
                aria-label={`下移环节 ${section.title}`}
                disabled={unsupported || index === (input.sections || []).length - 1}
                onClick={() =>
                  savable.setInput((current) =>
                    moveSection(current, section.id, 1),
                  )
                }
              >
                ↓
              </button>
              <button type="button" className="wb-button" disabled={unsupported} onClick={() => mathReturn.enter({type:"section",sectionId:section.id})}>制作数学作品</button>
              <button type="button" className="wb-button" disabled={unsupported || pickerFlow.entering} onClick={() => pickerFlow.enter({ type: "section", sectionId: section.id }, "math")}>从数学工坊取材</button>
              <button
                type="button"
                className="wb-button"
                name="pick-section"
                disabled={unsupported || pickerFlow.entering}
                onClick={() =>
                  pickerFlow.enter({ type: "section", sectionId: section.id })
                }
              >
                从题库取题
              </button>
              <button
                className="wb-button"
                disabled={unsupported}
                onClick={() =>
                  pickerFlow.enter(
                    { type: "section", sectionId: section.id },
                    "resource",
                  )
                }
              >
                从资源库取材
              </button>

              <button
                type="button"
                className="wb-icon-button"
                aria-label={`删除环节 ${section.title}`}
                disabled={unsupported}
                onClick={() =>
                  setDialog({ type: "delete-section", sectionId: section.id })
                }
              >
                <Icon name="trash" size={15} />
              </button>
            </header>
            <DocumentEditor
              label={`环节文稿 ${index + 1}`}
              readOnly={unsupported}
              value={section.content}
              onChange={(content) =>
                savable.setInput((current) => ({
                  ...current,
                  sections: current.sections.map((item) =>
                    item.id === section.id ? { ...item, content } : item,
                  ),
                }))
              }
            />
            {section.references.length > 0 && (
              <div className="wb-references" data-region="section-references">
                {section.references.map(referenceActions)}
              </div>
            )}
          </section>
        ))}

        <button
          type="button"
          className="wb-button wb-inline-action"
          name="add-section"
          disabled={unsupported}
          onClick={() =>
            savable.setInput((current) => ({
              ...current,
              sections: [...current.sections, newSection()],
            }))
          }
        >
          添加环节
        </button>

        <section
          className="wb-lesson-block wb-materials"
          data-region="materials"
        >
          <header className="wb-section-head">
            <h3>本课材料</h3>
            <button type="button" className="wb-button" disabled={unsupported} onClick={() => mathReturn.enter({type:"materials"})}>制作数学作品</button>
            <button type="button" className="wb-button" disabled={unsupported || pickerFlow.entering} onClick={() => pickerFlow.enter({ type: "materials" }, "math")}>从数学工坊取材</button>
            <button
              className="wb-button"
              disabled={unsupported}
              onClick={() =>
                pickerFlow.enter({ type: "materials" }, "resource")
              }
            >
              从资源库取材
            </button>
            <button
              type="button"
              className="wb-button"
              name="pick-materials"
              disabled={unsupported || pickerFlow.entering}
              onClick={() => pickerFlow.enter({ type: "materials" })}
            >
              从题库取题
            </button>
          </header>
          {input.sections.flatMap((section) =>
            section.references.map((ref) => (
              <button
                key={ref.id}
                className="wb-text-button"
                onClick={() =>
                  document
                    .getElementById(`section-${section.id}`)
                    ?.scrollIntoView({ block: "start" })
                }
              >
                {section.title} · {ref.snapshot?.title || "题目"}
              </button>
            )),
          )}
          {(input.materials || []).length === 0 ? (
            <p className="wb-empty-note">还没有未安排环节的材料</p>
          ) : (
            <div className="wb-references">
              {input.materials.map(referenceActions)}
            </div>
          )}
        </section>
      </div>

      {pickerDialogs}

      {dialog === "delete" && (
        <ConfirmDialog
          title="删除备课"
          message="删除后引用与快照保留，可在已删除中恢复；关联的题目不会删除。"
          confirmLabel="删除备课"
          onCancel={() => setDialog(null)}
          onConfirm={() => handleDeletion(true)}
        />
      )}

      {dialog?.type === "delete-section" && (
        <ConfirmDialog
          title="删除环节"
          message="环节里的题目默认移入本课材料；也可以连同题目一起从这份备课移除。"
          confirmLabel="移入本课材料并删除"
          secondaryLabel="连同题目一起移除"
          onSecondary={() => {
            savable.setInput((current) =>
              deleteSection(current, dialog.sectionId, {
                keepReferences: false,
              }),
            );
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            savable.setInput((current) =>
              deleteSection(current, dialog.sectionId, {
                keepReferences: true,
              }),
            );
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
