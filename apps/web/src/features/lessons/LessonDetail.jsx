import { LessonLibraryDialog } from "./LessonLibraryDialog.jsx";
import { LessonSectionContent } from "./LessonSectionContent.jsx";
import { LessonPlacementDialog } from "./LessonPlacementDialog.jsx";
import {
  ModulePresence,
  ModuleDisclosure,
} from "../workbench/ModuleMotion.jsx";
import { useLessonHistory } from "./useLessonHistory.js";
import { useMathReturn } from "./useMathReturn.js";
import { lessonDocuments, supportedDocument } from "@refatos/shared";
import { ExportsPanel } from "./ExportsPanel.jsx";
import { MaterialsPicker } from "./MaterialsPicker.jsx";
import "./materials.css";
import "./lessons.css";
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
import {
  ConfirmDialog,
  MenuItem,
  Popover,
} from "../workbench/ModuleOverlays.jsx";
import { ConflictResolution } from "../workbench/ConflictResolution.jsx";
import { Icon } from "../workbench/icons.jsx";
import { navigate } from "../workbench/routes.js";
import { readLocal, removeLocal, writeLocal } from "../workbench/storage.js";
import { useSaveShortcut } from "../workbench/useSaveShortcut.js";
import {
  createLesson,
  applyLessonContent,
  copyLesson,
  getLesson,
  setLessonDeletion,
  purgeLesson,
  updateLesson,
} from "./api.js";
import {
  addReferences,
  placeReference,
  changeSectionContent,
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

function MaterialMenu({ target, disabled, pickerFlow, mathReturn, name }) {
  return (
    <Popover
      label="加入材料"
      icon={null}
      buttonClassName="wb-button"
      className="wb-material-menu"
    >
      {({ close }) => (
        <>
          <MenuItem
            icon="question"
            name={name}
            disabled={disabled || pickerFlow.entering}
            onClick={() => {
              close();
              pickerFlow.enter(target);
            }}
          >
            加入题目
          </MenuItem>
          <MenuItem
            disabled={disabled || pickerFlow.entering}
            onClick={() => {
              close();
              pickerFlow.enter(target, "resource");
            }}
          >
            加入资源
          </MenuItem>
          <MenuItem
            disabled={disabled || pickerFlow.entering}
            onClick={() => {
              close();
              pickerFlow.enter(target, "math");
            }}
          >
            加入数学作品
          </MenuItem>
          <MenuItem
            disabled={disabled}
            onClick={() => {
              close();
              mathReturn.enter(target);
            }}
          >
            制作数学作品
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

export default function LessonDetail({ id }) {
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(shell.accountKey, "lesson-detail", {
    picker: null,
  });
  const isNew = id === "new";
  const [, patchListScene] = useScene(shell.accountKey, "lessons");

  const savedDocument = useSavableDocument({
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

  const savable = useLessonHistory(savedDocument);

  const mathReturn = useMathReturn({
    shell,
    savable,
    id,
    onEnter: (lessonId) => patchScene({ editingId: lessonId }),
  });

  const deleteSubmit = useIdempotentSubmit({
    accountKey: shell.accountKey,
    name: `pending:lesson-deletion:${id}`,
  });
  const copySubmit = useIdempotentSubmit({
    accountKey: shell.accountKey,
    name: `pending:lesson-copy:${id}`,
  });
  const contentSubmit = useIdempotentSubmit({ accountKey: shell.accountKey, name: `pending:lesson-content:${id}` });
  const [contentSaving, setContentSaving] = useState(false);
  const [copySaving, setCopySaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [localProblem, setLocalProblem] = useState(null);

  const baseline = savable.baseline;
  const deleted = Boolean(baseline?.deletedAt);
  const lifecycleBusy = contentSaving || contentSubmit.isRunning || Boolean(contentSubmit.pending) || deleteSubmit.isRunning || Boolean(deleteSubmit.pending) || copySaving || copySubmit.isRunning || Boolean(copySubmit.pending);
  const editing = !deleted && (isNew || scene.editingId === id);
  const input =
    !editing && baseline
      ? lessonInputFrom(baseline)
      : savable.input || emptyLessonInput();
  const setEditing = (active) => patchScene({ editingId: active ? id : null });
  const unsupported = [baseline, input]
    .filter(Boolean)
    .some((lesson) =>
      lessonDocuments(lesson).some(
        ([, document]) => !supportedDocument(document),
      ),
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
    if (
      usageFocused.current ||
      !baseline ||
      usage?.lessonPath !== `/lessons/${id}`
    )
      return;
    const reference = manuscriptNode.current?.querySelector(
      `[data-reference-id="${usage.referenceId}"]`,
    );
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
          readOnly={unsupported || !editing || lifecycleBusy}
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
      if (
        saveStatus === "dirty" &&
        !savable.checkpoint(baseline.id, { move: true })
      )
        return;
      patchScene({ editingId: baseline.id });
      navigate(`/lessons/${baseline.id}`, { replace: true });
    }
  }, [baseline?.id, isNew, saveStatus]);

  function handleSave(options = {}) {
    if (
      [...document.querySelectorAll('[role="dialog"]')].some(
        (node) => !node.closest("[inert]") && node.getClientRects().length,
      )
    )
      return;
    if (unsupported && !options.retry) return;
    if (!options.retry) {
      const problem = validateLessonInput(savable.input);
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
    editing &&
      !picker &&
      !scene.exportsOpen &&
      !unsupported &&
      !lifecycleBusy &&
      saveStatus !== "identity" &&
      saveStatus !== "deleted",
  );

  const sendCopy = ({ key, payload }) => copyLesson({ key, id, payload });
  function finishCopy(result) {
    if (!result) return;
    patchScene({ editingId: result.id, picker: null, exportsOpen: false, scrollTop: 0 });
    navigate(`/lessons/${result.id}`);
  }
  async function handleCopy() {
    setDialog(null);
    setCopySaving(true);
    try {
      const current = savable.localDraft && !deleted ? await savable.save() : baseline;
      if (!current) return;
      finishCopy(await copySubmit.submit(sendCopy, { baseVersion: current.version }));
    } finally { setCopySaving(false); }
  }
  const copyFeedback = (copySubmit.problem || copySubmit.pending) && (
    <div className="wb-inline-error" role="status">
      <p>{copySubmit.isRunning ? "正在创建副本…" : copySubmit.problem?.message || "副本创建结果未确认"}</p>
      {copySubmit.pending && <button className="wb-button" disabled={copySubmit.isRunning}
        onClick={async () => finishCopy(await copySubmit.retry(sendCopy))}>确认备课副本</button>}
      {!copySubmit.pending && copySubmit.problem?.kind === "conflict" &&
        <button className="wb-button" onClick={() => window.location.reload()}>重新读取备课</button>}
    </div>
  );

  const sendContent = ({ key, payload }) => applyLessonContent({ key, id, payload });
  async function finishContent(result) {
    if (!result) return;
    setDialog(null);
    const current = await savable.adoptServer();
    if (current) setEditing(true);
  }
  async function handleContent(action, details) {
    setDialog(null);
    setContentSaving(true);
    try {
      const current = savable.localDraft ? await savable.save() : baseline;
      if (!current) return;
      await finishContent(await contentSubmit.submit(sendContent, { action, body: { baseVersion: current.version, ...details } }));
    } finally { setContentSaving(false); }
  }
  const contentFeedback = (contentSubmit.problem || contentSubmit.pending) && <div className="wb-inline-error" role="status">
    <p>{contentSubmit.isRunning ? "正在更新课稿…" : contentSubmit.problem?.message || "更新结果未确认"}</p>
    {contentSubmit.pending && <button className="wb-button" disabled={contentSubmit.isRunning}
      onClick={async () => { setContentSaving(true); try { await finishContent(await contentSubmit.retry(sendContent)); } finally { setContentSaving(false); } }}>确认课稿更新</button>}
    {!contentSubmit.pending && contentSubmit.problem?.kind === "conflict" && <button className="wb-button" onClick={() => window.location.reload()}>重新读取备课</button>}
  </div>;

  function sendLifecycle({ key, payload }) {
    if (payload.action === "purge")
      return purgeLesson({ key, id, payload: payload.body });
    return setLessonDeletion({
      key,
      id,
      payload: payload.body ?? payload,
      version: payload.apiVersion ?? 2,
    });
  }

  function finishLifecycle(result, payload) {
    if (!result) return;
    const name = `draft:lesson:${id}`;
    const draft = readLocal(shell.accountKey, name);
    if (result.permanentlyDeleted) removeLocal(shell.accountKey, name);
    else if (
      draft &&
      !draft.pending &&
      draft.baselineVersion === (payload.body ?? payload).baseVersion
    ) {
      // Archiving changes the version, not the manuscript. Keep this tab's
      // unsaved text based on that confirmed version so it can resume later.
      writeLocal(shell.accountKey, name, {
        ...draft,
        baselineVersion: result.version,
      });
    }
    patchScene({
      editingId: null,
      picker: null,
      exportsOpen: false,
      scrollTop: 0,
    });
    patchListScene({ listState: "active", listQuery: "", listScrollTop: 0 });
    navigate("/lessons", { replace: true });
  }

  async function handleDeletion(nextDeleted) {
    if (unsupported || lifecycleBusy || savable.pending || savable.isSaving)
      return;
    const payload = {
      apiVersion: 3,
      body: { baseVersion: baseline.version, deleted: nextDeleted },
    };
    setDialog(null);
    finishLifecycle(await deleteSubmit.submit(sendLifecycle, payload), payload);
  }

  async function handlePurge() {
    const payload = {
      action: "purge",
      body: { baseVersion: baseline.version },
    };
    setDialog(null);
    finishLifecycle(await deleteSubmit.submit(sendLifecycle, payload), payload);
  }

  const lifecycleFeedback = (deleteSubmit.problem || deleteSubmit.pending) && (
    <div
      className="wb-inline-error"
      data-region="lesson-delete-problem"
      role="status"
    >
      <p>
        {deleteSubmit.isRunning
          ? "正在处理备课…"
          : deleteSubmit.problem?.message || "上次操作的结果未确认"}
      </p>
      {deleteSubmit.pending && (
        <button
          type="button"
          className="wb-button"
          disabled={deleteSubmit.isRunning}
          onClick={async () => {
            const payload = deleteSubmit.pending.payload;
            finishLifecycle(await deleteSubmit.retry(sendLifecycle), payload);
          }}
        >
          重试确认
        </button>
      )}
      {!deleteSubmit.pending && deleteSubmit.problem?.kind === "conflict" && (
        <button className="wb-button" onClick={() => window.location.reload()}>
          重新读取备课
        </button>
      )}
    </div>
  );

  if (savable.loadState === "missing") {
    return (
      <div
        className="wb-module wb-page wb-not-found"
        data-region="lesson-missing"
      >
        {lifecycleFeedback}
        {copyFeedback}
      {contentFeedback}
        <p>这份备课已不存在。</p>
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
      <div
        className="wb-module wb-page wb-inline-error"
        data-region="lesson-load-error"
      >
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
      <div
        className="wb-module wb-page wb-empty-note"
        role="status"
        data-region="lesson-loading"
      >
        正在读取备课…
      </div>
    );
  }

  const pickerDialogs = (
    <>
      <ModulePresence present={Boolean(pickerFlow.targetGone && picker)}>
        {pickerFlow.targetGone && picker && (
          <ConfirmDialog
            title="目标环境已变化"
            message={`环节「${targetLabel(input, picker.target)}」在本课已不存在。选题仍保留，可以改选本课材料或取消。`}
            confirmLabel="改选本课材料"
            onCancel={pickerFlow.dismissTargetGone}
            onConfirm={pickerFlow.moveToMaterials}
          />
        )}
      </ModulePresence>
      <ModulePresence present={Boolean(pickerFlow.conflict && picker)}>
        {pickerFlow.conflict && picker && (
          <ConfirmDialog
            title="备课已在别处修改"
            message="取回服务器版本才能继续加入，选题会保留；本地尚未保存的文稿不会被自动丢弃，请先自行处理。"
            confirmLabel="取回服务器版本"
            onCancel={pickerFlow.dismissConflict}
            onConfirm={pickerFlow.takeServerVersion}
          />
        )}
      </ModulePresence>
    </>
  );

  if (picker && !deleted) {
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
          existingQuestionIds={targetReferences
            .filter(
              (reference) =>
                !picker.attemptedReferenceIds?.includes(reference.id),
            )
            .map(
              (reference) =>
                reference.workId ??
                reference.questionId ??
                reference.resourceId,
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

  if (scene.exportsOpen && !deleted)
    return (
      <ExportsPanel
        savable={savable}
        onClose={(field) => {
          patchScene({
            exportsOpen: false,
            ...(field ? { editingId: id } : {}),
          });
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
    { value: "materials", label: "备用材料" },
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
    const referenceIndex = references.findIndex(
      (item) => item.id === reference.id,
    );
    return (
      <ReferenceCard
        readOnly={unsupported || !editing || lifecycleBusy}
        key={reference.id}
        reference={reference}
        position={position}
        onPlacement={position !== "materials" ? () => setDialog({ type: "placement", referenceId: reference.id }) : undefined}
        targets={targets.filter((target) => target.value !== position)}
        canMoveUp={referenceIndex > 0}
        canMoveDown={referenceIndex < references.length - 1}
        onReorder={(offset) =>
          savable.setInput((current) =>
            reorderReference(current, reference.id, offset),
          )
        }
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
        onCopyWork={
          reference.kind === "math"
            ? () => mathReturn.enter(targetFromValue(position), reference)
            : undefined
        }
        onOpenLesson={() =>
          (shell.openMaterialSource ?? navigate)(
            reference.kind === "math"
              ? `/math?workId=${reference.workId}`
              : reference.kind === "resource"
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
      className="wb-module wb-page wb-lesson"
      data-region="lesson-editor"
      data-lesson-id={baseline?.id || id}
      onBlurCapture={savable.history.endGroup}
      onKeyDownCapture={editing && !lifecycleBusy && !picker && !scene.exportsOpen ? savable.history.keydown : undefined}
    >
      {mathReturn.pending && (
        <div className="wb-inline-error" role="status">
          <span>{mathReturn.problem || "作品已保存，正在确认加入备课"}</span>
          <button
            className="wb-button"
            disabled={mathReturn.busy}
            onClick={mathReturn.retry}
          >
            确认带回
          </button>
          <button
            className="wb-button"
            disabled={mathReturn.busy}
            onClick={mathReturn.toMaterials}
          >
            放入本课材料
          </button>
          <button
            className="wb-button"
            disabled={mathReturn.busy}
            onClick={mathReturn.cancel}
          >
            取消带回
          </button>
        </div>
      )}
      <header className="lesson-editor-heading">
        <div className="lesson-breadcrumb">
          <button
            className="wb-text-button"
            onClick={() => {
              patchScene({ editingId: null, exportsOpen: false });
              navigate("/lessons");
            }}
          >
            <Icon name="back" size={16} />
            我的备课
          </button>
          <span>/</span>
          <span>{editing ? "编辑课稿" : "课稿"}</span>
        </div>
        <div className="lesson-heading-row">
          <span className="lesson-page-icon">
            <Icon name="prep" size={23} />
          </span>
          <div className="lesson-title-area">
            {editing ? (
              <input
                className="wb-input lesson-title-input"
                aria-label="课题"
                placeholder="这节课的课题是什么？"
                readOnly={unsupported || lifecycleBusy}
                value={input.title === "未命名备课" ? "" : input.title}
                maxLength={200}
                onChange={(event) =>
                  savable.setInput((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            ) : (
              <h1>{input.title}</h1>
            )}
            <span className="lesson-title-hint">
              {editing
                ? "先写思路，再按需要组织教学环节。"
                : `${input.sections.length} 个教学环节 · ${input.sections.reduce((count, section) => count + section.references.length, input.materials.length)} 份材料`}
            </span>
          </div>
          <div className="wb-lesson-actions">
            {editing ? (
              <>
                <button
                  className="wb-button"
                  disabled={!baseline || saveStatus === "saving"}
                  onClick={() => setEditing(false)}
                >
                  查看课稿
                </button>
                <SaveActions
                  savable={savable}
                  onSave={handleSave}
                  saveLabel="保存备课"
                  disabled={unsupported || lifecycleBusy}
                />
              </>
            ) : (
              !deleted && (
                <button
                  className="wb-button is-primary"
                  onClick={() => setEditing(true)}
                >
                  <Icon name="prep" size={16} />
                  {savable.localDraft ? "继续编辑草稿" : "编辑备课"}
                </button>
              )
            )}
            {!deleted && (
              <button
                className="wb-button"
                disabled={
                  deleted || lifecycleBusy || (!editing && savable.localDraft)
                }
                title={
                  !editing && savable.localDraft
                    ? "请先继续编辑并保存草稿"
                    : undefined
                }
                onClick={() => patchScene({ exportsOpen: true })}
              >
                生成教学资料
              </button>
            )}
            <Popover label="备课操作">
              {({ close }) => (
                <>
                  <MenuItem
                    onClick={() => {
                      close();
                      shell.openPanel("lesson-outline");
                    }}
                  >
                    查看本课大纲
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close();
                      shell.openPanel("lessons-index");
                    }}
                  >
                    切换备课
                  </MenuItem>
                  {baseline && <MenuItem disabled={lifecycleBusy || savable.isSaving || Boolean(savable.pending)}
                    onClick={() => { close(); setDialog("history"); }}>查看已保存版本</MenuItem>}
                  {baseline && (
                    <MenuItem icon="copy" disabled={unsupported || lifecycleBusy || savable.isSaving || Boolean(savable.pending) || saveStatus === "conflict"}
                      onClick={() => { close(); setDialog("copy"); }}>复制备课</MenuItem>
                  )}
                  {baseline && !deleted && (
                    <MenuItem
                      icon="folder"
                      disabled={
                        unsupported ||
                        lifecycleBusy ||
                        savable.isSaving ||
                        Boolean(savable.pending)
                      }
                      onClick={() => {
                        close();
                        setDialog("archive");
                      }}
                    >
                      归档备课
                    </MenuItem>
                  )}
                  {baseline && savable.localDraft && (
                    <MenuItem
                      icon="back"
                      onClick={() => {
                        close();
                        setDialog("discard-draft");
                      }}
                    >
                      放弃草稿
                    </MenuItem>
                  )}
                </>
              )}
            </Popover>
          </div>
        </div>
        {editing && <div className="lesson-edit-status">
          <SaveStatus savable={savable} />
          <div className="lesson-history-actions" aria-label="本次编辑历史">
            <button className="wb-text-button" title="撤销本次未保存的修改 (Ctrl/⌘ Z)" disabled={!savable.history.canUndo || lifecycleBusy || unsupported} onClick={savable.history.undo}>撤销</button>
            <button className="wb-text-button" title="重做 (Ctrl/⌘ Shift Z)" disabled={!savable.history.canRedo || lifecycleBusy || unsupported} onClick={savable.history.redo}>重做</button>
          </div>
        </div>}
      </header>
      {!editing && !deleted && savable.localDraft && (
        <div className="lesson-draft-banner" role="status">
          <span>
            这里显示已保存的课稿。此设备还有未保存的修改，继续编辑后可保存并生成资料。
          </span>
          <button className="wb-button" onClick={() => setEditing(true)}>
            继续编辑草稿
          </button>
        </div>
      )}

      {deleted && (
        <div className="lesson-archive-banner" data-region="lesson-archived">
          <div>
            <strong>这份备课已归档</strong>
            <p>
              课稿和材料都保留，恢复后可以继续编辑。
              {savable.localDraft ? "此设备的未保存草稿也已保留。" : ""}
            </p>
          </div>
          <button
            className="wb-button is-primary"
            disabled={lifecycleBusy || unsupported}
            onClick={() => handleDeletion(false)}
          >
            恢复备课
          </button>
          <button
            className="wb-button is-danger"
            disabled={lifecycleBusy || Boolean(savable.pending)}
            onClick={() => setDialog("purge")}
          >
            彻底删除
          </button>
        </div>
      )}

      {localProblem && (
        <p className="wb-inline-error" data-region="local-problem">
          {localProblem.message}
        </p>
      )}
      {!deleted && saveStatus === "conflict" && (
        <ConflictResolution
          savable={savable}
          onAdopt={async () => {
            const current = await savable.adoptServer();
            if (current) mathReturn.adoptBaseline(current.version);
          }}
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
      {lifecycleFeedback}
      {copyFeedback}
      {contentFeedback}

      <div
        className="wb-lesson-scroll"
        data-region="lesson-scroll"
        ref={attachManuscript}
        onScroll={(event) => {
          manuscriptTop.current = event.currentTarget.scrollTop;
          patchScene({ scrollTop: manuscriptTop.current });
        }}
      >
        <section className="lesson-intro-section">
          <div className="lesson-content-heading">
            <Icon name="prep" size={16} />
            <h2>讲课思路</h2>
          </div>
          {editing ? (
            <DocumentEditor
              label="开头文稿"
              placeholder="这节课准备怎么讲？先写下目标、思路，或者一句提醒…"
              readOnly={unsupported || lifecycleBusy}
              value={input.intro}
              onChange={(intro) =>
                savable.setInput((current) => ({ ...current, intro }))
              }
            />
          ) : input.intro.blocks.length ? (
            <DocumentView value={input.intro} />
          ) : (
            <p className="lesson-quiet-empty">还没有写下讲课思路。</p>
          )}
        </section>
        {(input.sections || []).map((section, index) => (
          <section
            className="wb-section lesson-section"
            key={section.id}
            id={`section-${section.id}`}
            data-section-id={section.id}
          >
            <header className="wb-section-head">
              <span className="lesson-step-number">{index + 1}</span>
              {editing ? (
                <input
                  className="wb-input wb-section-title"
                  aria-label={`环节名称 ${index + 1}`}
                  readOnly={unsupported || lifecycleBusy}
                  value={section.title}
                  maxLength={200}
                  placeholder="例如：例题讲解"
                  onChange={(event) =>
                    savable.setInput((current) =>
                      renameSection(current, section.id, event.target.value),
                    )
                  }
                />
              ) : (
                <h2>{section.title}</h2>
              )}
              {editing && (
                <>
                  <MaterialMenu
                    target={{ type: "section", sectionId: section.id }}
                    disabled={unsupported || lifecycleBusy}
                    pickerFlow={pickerFlow}
                    mathReturn={mathReturn}
                    name="pick-section"
                  />
                  <Popover label={`环节操作 ${section.title}`}>
                    {({ close }) => (
                      <>
                        <MenuItem
                          disabled={unsupported || lifecycleBusy || index === 0}
                          onClick={() => {
                            close();
                            savable.setInput((current) =>
                              moveSection(current, section.id, -1),
                            );
                          }}
                        >
                          上移环节
                        </MenuItem>
                        <MenuItem
                          disabled={
                            unsupported ||
                            lifecycleBusy ||
                            index === input.sections.length - 1
                          }
                          onClick={() => {
                            close();
                            savable.setInput((current) =>
                              moveSection(current, section.id, 1),
                            );
                          }}
                        >
                          下移环节
                        </MenuItem>
                        <MenuItem
                          icon="trash"
                          danger
                          disabled={unsupported || lifecycleBusy}
                          onClick={() => {
                            close();
                            setDialog({
                              type: "delete-section",
                              sectionId: section.id,
                            });
                          }}
                        >
                          删除环节
                        </MenuItem>
                      </>
                    )}
                  </Popover>
                </>
              )}
            </header>
            <LessonSectionContent section={section} editing={editing}
              label={`环节文稿 ${index + 1}`} readOnly={unsupported || lifecycleBusy}
              onChange={(content, edit) => savable.setInput(current => changeSectionContent(current, section.id, content, edit))}
              renderReference={referenceActions} />
            {!editing &&
              !section.references.length &&
              !section.content.blocks.length && (
                <p className="lesson-quiet-empty">这个环节还没有内容。</p>
              )}
          </section>
        ))}
        {editing && (
          <div className="lesson-add-section">
            <button
              type="button"
              className="wb-button"
              name="add-section"
              disabled={unsupported || lifecycleBusy}
              onClick={() => {
                const section = newSection("");
                savable.setInput((current) => ({
                  ...current,
                  sections: [...current.sections, section],
                }));
                requestAnimationFrame(() => {
                  const field = document
                    .getElementById(`section-${section.id}`)
                    ?.querySelector("input");
                  field?.focus();
                  field?.scrollIntoView({ block: "nearest" });
                });
              }}
            >
              <Icon name="plus" size={17} />
              添加教学环节
            </button>
            {baseline && <button className="wb-button" disabled={unsupported || lifecycleBusy || savable.isSaving || Boolean(savable.pending) || saveStatus === "conflict"}
              onClick={() => setDialog("reuse")}><Icon name="copy" size={16} />从其他备课复用环节</button>}
            <span>例如：课堂导入、例题讲解、课堂练习</span>
          </div>
        )}
        {(editing || input.materials.length > 0) && (
          <ModuleDisclosure
            title={`备用材料${input.materials.length ? ` · ${input.materials.length}` : ""}`}
            className="lesson-materials"
            open={Boolean(scene.materialsOpen)}
            onOpenChange={(materialsOpen) => patchScene({ materialsOpen })}
          >
            <div data-region="materials">
              <div className="lesson-materials-head">
                <p>
                  先收集，还没放进教学环节的材料。默认不加入生成的教学资料。
                </p>
                {editing && (
                  <MaterialMenu
                    target={{ type: "materials" }}
                    disabled={unsupported || lifecycleBusy}
                    pickerFlow={pickerFlow}
                    mathReturn={mathReturn}
                    name="pick-materials"
                  />
                )}
              </div>
              {input.materials.length ? (
                <div className="wb-references">
                  {input.materials.map(referenceActions)}
                </div>
              ) : (
                <p className="lesson-quiet-empty">还没有备用材料。</p>
              )}
            </div>
          </ModuleDisclosure>
        )}
        {input.sections.some((section) => section.references.length) && (
          <ModuleDisclosure title="本课材料总览" className="lesson-materials">
            <div className="lesson-material-overview">
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
                    <Icon
                      name={
                        ref.kind === "math"
                          ? "math"
                          : ref.kind === "resource"
                            ? "folder"
                            : "question"
                      }
                      size={16}
                    />
                    <span>{ref.snapshot?.title || "题目"}</span>
                    <small>{section.title}</small>
                    <Icon name="chevron" size={14} />
                  </button>
                )),
              )}
            </div>
          </ModuleDisclosure>
        )}
        {baseline?.id && (
          <ModuleDisclosure
            title="教学反馈"
            className="lesson-feedback"
            open={Boolean(scene.feedbackOpen)}
            onOpenChange={(feedbackOpen) => patchScene({ feedbackOpen })}
          >
            <ModulePresence present={Boolean(scene.feedbackOpen)}>
              {scene.feedbackOpen && (
                <SourceRecordsPanel
                  kind="lesson"
                  id={baseline.id}
                  onOpenRecord={(record) =>
                    shell.openMaterialSource(
                      `/classes/${record.classId}/records/${record.id}`,
                      `/lessons/${id}`,
                    )
                  }
                />
              )}
            </ModulePresence>
          </ModuleDisclosure>
        )}
      </div>

      {pickerDialogs}

      <ModulePresence present={dialog === "history" || dialog === "reuse"}>
        {(dialog === "history" || dialog === "reuse") && <LessonLibraryDialog key={dialog} mode={dialog} lesson={baseline}
          hasDraft={Boolean(savable.localDraft)} onClose={() => setDialog(null)} onApply={details => handleContent(dialog, details)} />}
      </ModulePresence>
      <ModulePresence present={dialog?.type === "placement"}>
        {dialog?.type === "placement" && <LessonPlacementDialog input={input} referenceId={dialog.referenceId}
          onClose={() => setDialog(null)} onPlace={position => {
            savable.setInput(current => placeReference(current, dialog.referenceId, position));
            const referenceId = dialog.referenceId;
            setDialog(null);
            requestAnimationFrame(() => document.querySelector(`[data-reference-id="${referenceId}"] .wb-reference-head button[aria-haspopup="menu"]`)?.focus());
          }} />}
      </ModulePresence>
      <ModulePresence present={dialog === "discard-draft"}>
        {dialog === "discard-draft" && (
          <ConfirmDialog
            title="放弃草稿"
            message="未保存的修改将被移除，备课回到已保存的版本。"
            confirmLabel="放弃草稿"
            onCancel={() => setDialog(null)}
            onConfirm={() => {
              savable.discardDraft();
              setDialog(null);
            }}
          />
        )}
      </ModulePresence>
      <ModulePresence present={dialog === "copy"}>
        {dialog === "copy" && <ConfirmDialog title="创建备课副本？"
          message={savable.localDraft && !deleted
            ? "先保存当前修改，再创建一份独立副本并打开。保留原备课，材料沿用本课已采用的版本。"
            : `创建一份独立副本并打开。保留原备课，材料沿用本课已采用的版本；不复制输出和班级记录。${savable.localDraft ? "仅复制已保存课稿，未保存草稿仍保留在原备课。" : ""}`}
          confirmLabel="创建副本" onCancel={() => setDialog(null)} onConfirm={handleCopy} />}
      </ModulePresence>
      <ModulePresence present={dialog === "archive"}>
        {dialog === "archive" && (
          <ConfirmDialog
            title="归档备课"
            message="归档后返回备课主页。课稿和材料会保留，可在“已归档备课”中恢复；未保存的草稿保留在此设备。"
            confirmLabel="归档备课"
            onCancel={() => setDialog(null)}
            onConfirm={() => handleDeletion(true)}
          />
        )}
      </ModulePresence>
      <ModulePresence present={dialog === "purge"}>
        {dialog === "purge" && (
          <ConfirmDialog
            title="彻底删除备课"
            message={`彻底删除“${baseline.title}”及其课稿、已保存版本、环节、本课材料和输出记录，无法恢复。本设备的这份草稿也会移除。来源题目、资源、数学作品和班级教学记录仍保留。`}
            confirmLabel="彻底删除"
            onCancel={() => setDialog(null)}
            onConfirm={handlePurge}
          />
        )}
      </ModulePresence>

      <ModulePresence present={Boolean(dialog?.type === "delete-section")}>
        {dialog?.type === "delete-section" && (
          <ConfirmDialog
            title="删除环节"
            message="环节里的材料会移入备用材料；也可以连同材料一起从这份备课移除。"
            confirmLabel="移入备用材料并删除"
            secondaryLabel="连同材料一起移除"
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
      </ModulePresence>
    </div>
  );
}
