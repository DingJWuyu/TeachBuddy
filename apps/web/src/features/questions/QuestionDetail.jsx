import { useTranslation } from 'react-i18next';
import { ModulePresence } from "../workbench/ModuleMotion.jsx";
/**
 * One question route: reading, editing, paste/adaptation comparison and the
 * local draft that survives a refresh.
 *
 * Draft ids are routes too: `new-manual`, `new-paste` and `copy-<questionId>`,
 * so a draft can be reopened from the module entry exactly like a saved object.
 */

import { useEffect, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { useSavableDocument } from '../workbench/useSavableDocument.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { ConfirmDialog, MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { SaveStatus } from '../workbench/SaveStatus.jsx';
import { ConflictResolution } from '../workbench/ConflictResolution.jsx';
import { navigate } from '../workbench/routes.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import {
  buildCopyPayload,
  buildCreatePayload,
  buildUpdatePayload,
  emptyQuestionInput,
  pastedQuestionInput,
  questionInputFrom
} from './model.js';
import {
  copyQuestion,
  createQuestion,
  getQuestion,
  listDerivatives,
  setQuestionDeletion,
  updateQuestion
} from './api.js';
import { QuestionEditor, QuestionServerVersion } from './QuestionEditor.jsx';
import { QuestionReader } from './QuestionReader.jsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PasteSourcePane({ draft, sourceText, disabled, onTextChange, onOrganize }) {
  const { t } = useTranslation("questions");
  return (
    <section className="wb-compare-side" data-region="compare-source">
      <header className="wb-compare-head">
        <h3>{t("原始粘贴文字")}</h3>
        <button
          type="button"
          className="wb-button"
          name="organize-paste"
          disabled={disabled || !sourceText.trim()}
          onClick={onOrganize}
        > {t("按原稿整理题面")} </button>
      </header>
      <textarea
        className="wb-input wb-raw-text-input"
        aria-label={t("原始粘贴文字")}
        rows={16}
        value={sourceText}
        disabled={disabled}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <p className="wb-muted">{t("原稿逐字保留，不会自动拆题。")}</p>
      {draft}
    </section>
  );
}

export default function QuestionDetail({ id, onChanged }) {
  const { t } = useTranslation("questions");
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(shell.accountKey, 'question-detail', {
    editMode: false,
    compareSide: 'target',
    readerScroll: {}
  });
  const readerScroll = useScrollRestore(
    scene.readerScroll?.[id] || 0,
    (top) => patchScene((current) => ({ readerScroll: { ...current.readerScroll, [id]: top } }))
  );
  const isNewManual = id === 'new-manual';
  const isNewPaste = id === 'new-paste';
  const isCopy = id.startsWith('copy-');
  const sourceId = isCopy ? id.slice('copy-'.length) : null;
  const isObject = UUID.test(id || '');
  const mode = isNewManual || isNewPaste ? 'create' : isCopy ? 'copy' : 'update';

  const savable = useSavableDocument({
    accountKey: shell.accountKey,
    generation: shell.generation,
    kind: 'question',
    draftId: id,
    mode,
    load: mode === 'update' ? () => getQuestion(id) : undefined,
    create: mode === 'copy'
      ? ({ key, payload }) => copyQuestion({ key, id: sourceId, payload })
      : createQuestion,
    update: updateQuestion,
    buildCreate: mode === 'copy' ? buildCopyPayload : buildCreatePayload,
    buildUpdate: buildUpdatePayload,
    inputFromObject: (question) => questionInputFrom(question, { forCopy: mode === 'copy' }),
    prepareDraft: async () => {
      if (mode === 'copy') {
        // The comparison starts from the original question's adopted version; the
        // first save sends that version as baseVersion.
        const source = await getQuestion(sourceId);
        return { input: questionInputFrom(source, { forCopy: true }), baseline: source };
      }
      return {
        input: isNewPaste ? pastedQuestionInput('') : emptyQuestionInput({ kind: 'manual' }),
        baseline: null
      };
    }
  });

  const deleteSubmit = useIdempotentSubmit({ accountKey: shell.accountKey, name: `pending:question-deletion:${id}` });
  const [dialog, setDialog] = useState(null);
  const [derivatives, setDerivatives] = useState([]);
  const [currentSource, setCurrentSource] = useState(null);
  const [localProblem, setLocalProblem] = useState(null);

  const baseline = savable.baseline;
  const input = savable.input;
  const saveStatus = savable.status;
  const question = baseline;
  const editing = Boolean(scene.editMode) || mode !== 'update';

  useEffect(() => {
    if (mode !== 'update') return undefined;
    let cancelled = false;
    listDerivatives(id)
      .then((rows) => { if (!cancelled) setDerivatives(rows); })
      .catch(() => { if (!cancelled) setDerivatives([]); });
    return () => { cancelled = true; };
  }, [id, mode, saveStatus, deleteSubmit.result]);

  useEffect(() => {
    if (!question || question.source?.kind !== 'copy' || !question.source.questionId) return undefined;
    let cancelled = false;
    getQuestion(question.source.questionId)
      .then((source) => { if (!cancelled) setCurrentSource(source); })
      .catch(() => { if (!cancelled) setCurrentSource(null); });
    return () => { cancelled = true; };
  }, [question?.id, question?.source?.kind, question?.source?.questionId, saveStatus]);

  // A confirmed first save turns a draft route into a real object route.
  useEffect(() => {
    if (mode !== 'update' && saveStatus === 'saved' && baseline?.id) {
      patchScene({ editMode: false });
      onChanged?.();
      navigate(`/questions/${baseline.id}`, { replace: true });
    }
  }, [baseline?.id, mode, onChanged, patchScene, saveStatus]);

  function handleSave(options = {}) {
    setLocalProblem(null);
    savable.save(options);
  }

  async function handleDeletion(nextDeleted) {
    const result = await deleteSubmit.submit(
      ({ key, payload }) => setQuestionDeletion({ key, id: baseline.id, payload }),
      { baseVersion: baseline.version, deleted: nextDeleted }
    );
    if (result) {
      setDialog(null);
      await savable.adoptServer();
      onChanged?.();
    }
  }

  if (savable.loadState === 'error') {
    return (
      <div className="wb-module wb-page wb-inline-error" data-region="question-load-error">
        <p>{savable.loadError?.message || t("读取失败")}</p>
        <button type="button" className="wb-button" onClick={savable.adoptServer}>{t("重试")}</button>
      </div>
    );
  }

  if (saveStatus === 'missing') {
    return (
      <div className="wb-module wb-page wb-not-found" data-region="question-missing">
        <p>{t("未找到内容")}</p>
        <a className="wb-link" href="/questions" onClick={(event) => { event.preventDefault(); navigate('/questions'); }}> {t("返回题库")} </a>
      </div>
    );
  }

  if (!input) {
    return <div className="wb-module wb-page"><p className="wb-muted">{t("正在加载…")}</p></div>;
  }

  const draftBanner = savable.localDraft && !editing && baseline ? (
    <div className="wb-banner wb-draft-banner" data-region="draft-banner">
      <span>{t("有未保存的草稿留在本设备。")}</span>
      <button type="button" className="wb-button" name="continue-draft" onClick={() => patchScene({ editMode: true })}> {t("继续编辑")} </button>
      <button
        type="button"
        className="wb-button"
        name="discard-draft"
        onClick={() => {
          setDialog('discard-draft');
        }}
      > {t("放弃草稿")} </button>
    </div>
  ) : null;


  const requestedCompare = mode === 'copy'
    ? 'copy-new'
    : (isNewPaste || input.source?.kind === 'paste')
      ? 'paste'
      : baseline?.source?.kind === 'copy' ? 'copy-edit' : 'single';
  // Until the original question is loaded there is nothing to compare against.
  const compareKind = requestedCompare === 'copy-new' && !baseline ? 'single' : requestedCompare;

  const compareSide = scene.compareSide || 'target';
  const compareToggle = shell.narrow && compareKind !== 'single' ? (
    <div className="wb-compare-toggle" role="group" aria-label={t("对照区域")}>
      <button
        type="button"
        className={`wb-chip${compareSide === 'source' ? ' is-active' : ''}`}
        aria-pressed={compareSide === 'source'}
        name="compare-source-tab"
        onClick={() => patchScene({ compareSide: 'source' })}
      > {t("原题")} </button>
      <button
        type="button"
        className={`wb-chip${compareSide === 'target' ? ' is-active' : ''}`}
        aria-pressed={compareSide === 'target'}
        name="compare-target-tab"
        onClick={() => patchScene({ compareSide: 'target' })}
      > {t("改编题")} </button>
    </div>
  ) : null;

  const editor = (
    <QuestionEditor
      savable={savable}
      saveLabel={baseline ? t("保存") : t("创建题目")}
      footer={(
        <div className="wb-editor-extra">
          {editing && baseline && (
            <button
              type="button"
              className="wb-text-button"
              name="leave-edit"
              onClick={() => patchScene({ editMode: false })}
            > {t("返回阅读")} </button>
          )}
          {localProblem && <p className="wb-inline-error">{localProblem.message}</p>}
        </div>
      )}
    />
  );

  const deleteActions = question && (
    <Popover label={t("更多操作")}>
      {({ close }) => (
        <>
          {!question.deletedAt && (
            <MenuItem icon="copy" onClick={() => { close(); navigate(`/questions/copy-${question.id}`); }}> {t("复制修改")} </MenuItem>
          )}
          {question.source?.kind === 'copy' && question.source.questionId && (
            <MenuItem icon="question" onClick={() => { close(); navigate(`/questions/${question.source.questionId}`); }}> {t("查看原题")} </MenuItem>
          )}
          {question.deletedAt ? (
            <MenuItem icon="back" onClick={() => { close(); handleDeletion(false); }}>{t("恢复题目")}</MenuItem>
          ) : (
            <MenuItem icon="trash" danger onClick={() => { close(); setDialog('delete'); }}>{t("删除题目")}</MenuItem>
          )}
        </>
      )}
    </Popover>
  );

  return (
    <div className="wb-module wb-page wb-question" data-region="question-detail" data-question-id={baseline?.id || id}>
      {question?.deletedAt && (
        <div className="wb-banner" data-region="question-deleted">{t("这道题已删除，来源与引用都保留，可以恢复。")}</div>
      )}
      {saveStatus === 'conflict' && (
        <ConflictResolution
          savable={savable}
          onAdopt={savable.adoptServer}
          renderServer={(server) => <QuestionServerVersion server={server} />}
        />
      )}
      {(deleteSubmit.problem || deleteSubmit.pending) && (
        <div className="wb-inline-error" data-region="delete-problem">
          <p>{deleteSubmit.problem?.message || t("上次删除操作的结果未确认")}</p>
          {deleteSubmit.pending && (
            <button
              type="button"
              className="wb-button is-primary"
              name="retry-confirm"
              onClick={() => deleteSubmit.retry(({ key, payload }) => setQuestionDeletion({ key, id: baseline.id, payload }))}
            > {t("重试确认")} </button>
          )}
        </div>
      )}
      {draftBanner}

      {editing ? (
        <div className="wb-editor-wrap">
          {compareToggle}
          {compareKind === 'copy-new' && baseline ? (
            <div className="wb-compare-grid" data-region="copy-compare" data-side={compareSide}>
              <section className="wb-compare-side" data-region="compare-source">
                <header className="wb-compare-head">
                  <h3>{t("原题采用版本")} {baseline.version}</h3>
                </header>
                <QuestionServerVersion server={baseline} />
              </section>
              <section className="wb-compare-side" data-region="compare-target">
                <header className="wb-compare-head"><h3>{t("改编题")}</h3></header>
                {editor}
              </section>
            </div>
          ) : null}

          {compareKind === 'copy-edit' ? (
            <div className="wb-compare-grid" data-region="copy-compare" data-side={compareSide}>
              <section className="wb-compare-side" data-region="compare-source">
                <header className="wb-compare-head">
                  <h3>{t("原题采用版本")} {baseline.source.questionVersion}</h3>
                  {currentSource && currentSource.version !== baseline.source.questionVersion && (
                    <span className="wb-tag is-attention">{t("原题已是版本")} {currentSource.version}</span>
                  )}
                  <button
                    type="button"
                    className="wb-text-button"
                    onClick={() => navigate(`/questions/${baseline.source.questionId}`)}
                  > {t("查看当前原题")} </button>
                </header>
                <QuestionServerVersion server={baseline.source.snapshot} />
              </section>
              <section className="wb-compare-side" data-region="compare-target">
                <header className="wb-compare-head"><h3>{t("改编题")}</h3></header>
                {editor}
              </section>
            </div>
          ) : null}

          {compareKind === 'paste' ? (
            <div className="wb-compare-grid" data-region="paste-compare" data-side={compareSide}>
              <PasteSourcePane
                sourceText={input.source?.text || ''}
                disabled={Boolean(baseline)}
                onTextChange={(text) => savable.setInput((current) => ({ ...current, source: { kind: 'paste', text } }))}
                onOrganize={() => savable.setInput((current) => ({ ...current, body: pastedQuestionInput(current.source.text).body }))}
              />
              <section className="wb-compare-side" data-region="compare-target">
                <header className="wb-compare-head"><h3>{t("整理后的题目")}</h3></header>
                {editor}
              </section>
            </div>
          ) : null}

          {compareKind === 'single' ? <div className="wb-editor-single">{editor}</div> : null}
        </div>
      ) : (
        <QuestionReader
          question={question}
          scroll={readerScroll}
          derivatives={derivatives}
          onEdit={() => patchScene({ editMode: true })}
          onToggleStar={() => savable.save({ input: { ...input, starred: !input.starred } })}
          extraActions={(
            <div className="wb-head-actions">
              <SaveStatus savable={savable} showDraftHint={false} />
              {deleteActions}
            </div>
          )}
        />
      )}

      <ModulePresence present={dialog === 'discard-draft'}>{dialog === 'discard-draft' && (
        <ConfirmDialog title={t("放弃草稿")} message={t("未保存的修改将被移除，已保存的题目不会改变。")} confirmLabel={t("放弃草稿")}
          onCancel={() => setDialog(null)} onConfirm={() => { savable.discardDraft(); setDialog(null); }} />
      )}</ModulePresence>
      <ModulePresence present={Boolean(dialog === 'delete')}>{dialog === 'delete' && (
        <ConfirmDialog
          title={t("删除题目")}
          message={t("删除后题目来源与副本都保留，可以在已删除中恢复。")}
          confirmLabel={t("删除题目")}
          onCancel={() => setDialog(null)}
          onConfirm={() => handleDeletion(true)}
        />
      )}</ModulePresence>
    </div>
  );
}
