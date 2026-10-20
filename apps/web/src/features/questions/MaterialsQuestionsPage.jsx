import { useTranslation } from 'react-i18next';
import { Menu as Popover } from '../../components/ui/menu.jsx';
import { AppConfirmDialog as ConfirmDialog, ConfirmDialog as LifecycleConfirmDialog } from '../../components/ui/confirm.jsx';
import { tx } from '../../i18n/presentation.js';
import { ModulePresence, ModuleDisclosure } from '../../components/interaction/ModuleMotion.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { supportedDocument } from '@teachbuddy/shared';
import { DocumentView } from '../../components/materials/index.js';
import { get, download } from './materials-api.js';
import { sourceText, documentAssets } from './question-documents.js';
import { useQuestionSession } from './useQuestionSession.js';
import { useScrollRestore } from '../../components/interaction/useScrollRestore.js';
import { FragmentReview } from './FragmentReview.jsx';
import { NoteFragments } from './NoteFragments.jsx';
import { isCompletedImport } from './ImportList.jsx';
import OriginalPane from './OriginalPane.jsx';
import ResizeDivider from './ResizeDivider.jsx';
import { QuestionIcon, QuestionDialog, QuestionDocumentEditor } from './QuestionControls.jsx';
import { QuestionFinder, QuestionWelcome, TYPE_HUES } from './QuestionFinder.jsx';
import './questions-materials.css';
const active = new Set(['queued', 'running', 'cancelling']);
const lifecycleTitles = {
  import: { archive: '归档材料？', restore: '恢复材料？', purge: '彻底删除材料？' },
  question: { archive: '归档题目？', restore: '恢复题目？', purge: '彻底删除题目？' },
};
const stateNames = {
  queued: "原稿已保存，等待整理",
  running: "正在整理",
  partial: "部分内容待处理",
  failed: "整理失败，原稿已保存",
  interrupted: "整理已中断",
  cancelled: "已停止",
  cancelling: "正在停止",
  succeeded: "整理完成，等待校对",
};
export default function MaterialsQuestionsPage({
  accountKey,
  transport,
  requestedId,
  onReturnToLibrary,
}) {
  const { t } = useTranslation("questions");
  const pageNode = useRef(null);
  const visibleOriginal = useRef(null);
  const sourceField = useRef(null);
  const sourceCopyAttempt = useRef(0);
  const [sourceCopyStatus, setSourceCopyStatus] = useState("");
  const { state, actions } = useQuestionSession({ accountKey, transport, requestedId, onReturnToLibrary: () => {
    onReturnToLibrary?.();
    requestAnimationFrame(() => pageNode.current?.querySelector('.tbx-qn-bar h1')?.focus({ preventScroll: true }));
  }, onFocusReviewIssue: issueId => {
    const target = issueId
      ? [...(pageNode.current?.querySelectorAll('[data-issue-id]') ?? [])].find(node => node.dataset.issueId === issueId)?.querySelector('select')
      : pageNode.current?.querySelector('[data-question-answer-status]');
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  } });
  const {
    collection, scene, items, imports, taxonomy, listState, loadError, confirmDiscard,
    lifecycleAction, copyCandidate, newCategory, categoryName, value, job, selected,
    message, busy, capture, manage, copies, assets, conflict, includeAnswers, editing,
    archived, hasFilters, text, title, origin, chosenFiles, pages, unsupportedQuestion,
    sourceMissing, hasDraft, hasNewDraft, draft, locked, splitParagraphCount, hasPending,
  } = state;
  const {
    patchScene, open, change, editDraft, startCapture, beginEdit, copyQuestion,
    resumeNewDraft, replaceWithCopy, pickImage, selectDraft, splitDraft, mergeDraft,
    changeCollection, moveCollectionFileUp, locateDraft, resolveReviewIssue, removeNoteFragment,
    resolveConflict, adoptCopySource, reload,
    save, saveQuestion, leaveEditor, confirmDraft, collect, retryPending, openSource,
    requestLifecycle, confirmLifecycle, cancelLifecycle, requestDiscard, cancelDiscard,
    discardDraft, cancelCopy, showTaxonomy, saveTaxonomy, openCategory, closeCategory,
    changeCategoryName, createCategory, stopExtraction, retryExtraction, supplement,
    appendDraft, cropOriginal, generateAssets, refreshAssets, close: returnToLibrary,
  } = actions;
  const [source, setSource] = useState(null);
  const picker = useRef(null);
  const [splitAt, setSplitAt] = useState(1), [mergeId, setMergeId] = useState('');
  useEffect(() => { setSource(null); sourceCopyAttempt.current += 1; setSourceCopyStatus(''); }, [scene.id, scene.kind]);
  const setIncludeAnswers = includeAnswers => patchScene({ includeAnswers });
  const questionScroll = useScrollRestore(
    scene.questionScroll ?? 0,
    (top) => patchScene({ questionScroll: top }),
    value?.id,
  );
  const reviewScroll = useScrollRestore(scene.reviewScroll?.[selected] ?? 0,
    top => patchScene({ reviewScroll: { ...scene.reviewScroll, [selected]: top } }), selected);
  const listNode = useRef(null);
  const initialListTop = useRef(scene.listScroll ?? 0);
  const listRestored = useRef(false);
  useEffect(() => {
    const node = listNode.current;
    if (!node || listState !== 'ready' || listRestored.current) return;
    const finder = node.parentElement;
    const observer = new ResizeObserver(restore);
    const images = new MutationObserver(restore);
    function disconnect() {
      observer.disconnect();
      images.disconnect();
      finder.removeEventListener('transitionend', restore);
    }
    function restore() {
      if (listRestored.current) { disconnect(); return; }
      if (!node.getClientRects().length) return;
      node.scrollTop = initialListTop.current;
      if (!node.querySelector('[data-image-state="loading"]')) {
        listRestored.current = true;
        disconnect();
        patchScene({ listScroll: node.scrollTop });
      }
    }
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    images.observe(finder, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-image-state', 'data-state'] });
    finder.addEventListener('transitionend', restore);
    restore();
    return disconnect;
  }, [listState, items, imports]);
  const classification = (q, onChange) => (
    <div className="q-classify">
      <label> {t("题型")} <select
          aria-label={t("题型")}
          value={q.typeId ?? ""}
          onChange={(e) => onChange({ typeId: e.target.value || null })}
        >
          <option value="">{t("未分类")}</option>
          {taxonomy.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="q-text-button" onClick={() => { openCategory('types', id => onChange({ typeId: id })); }}><QuestionIcon name="plus" size={14} />{t("新建题型")}</button>
      <span className="q-classify-label">{t("标签")}</span>
      {taxonomy.tags.map((t) => (
        <label key={t.id}>
          <input
            type="checkbox"
            checked={q.tagIds.includes(t.id)}
            onChange={(e) =>
              onChange({
                tagIds: e.target.checked
                  ? [...q.tagIds, t.id]
                  : q.tagIds.filter((id) => id !== t.id),
              })
            }
          />
          {t.name}
        </label>
      ))}
      <button type="button" className="q-text-button" onClick={() => { openCategory('tags', id => onChange({ tagIds: [...q.tagIds, id] })); }}><QuestionIcon name="plus" size={14} />{t("新建标签")}</button>
    </div>
  );
  const taxonomyTools = (
    <div className="wb-module q-taxonomy-tools">
      <p className="q-muted">{t("管理所有题目的题型与标签。查找题目请使用列表中的筛选。")}</p>
      {!manage && <button onClick={() => showTaxonomy()}>{t("管理题型与标签")}</button>}
      <ModulePresence present={manage} mode="collapse">{manage && (
        <Taxonomy
          key={taxonomy.version}
          taxonomy={taxonomy}
          disabled={busy}
          onSave={saveTaxonomy}
        />
      )}</ModulePresence>
    </div>
  );
  return (
    <div className="q-workspace-host"><div ref={pageNode} className="wb-module q-workspace" data-review={scene.kind === "import"}
      style={{"--q-ratio": scene.compare ? (scene.compareWidth ?? 0.5) : (scene.listWidth ?? 0.32)}}
      data-compare={Boolean(scene.compare && value?.source?.kind === "copy")}>
      <aside className="q-finder" inert={scene.compare && value?.source?.kind === "copy" ? true : undefined} aria-hidden={scene.compare && value?.source?.kind === "copy" ? true : undefined}>
        <QuestionFinder {...{ archived, items, imports, taxonomy, scene, patchScene, hasFilters, listState, reload, open, startCapture, resumeNewDraft, hasNewDraft, showTaxonomy, returnToLibrary, listNode, listRestored, taxonomyTools, busy }} />
      </aside>
      <ModulePresence present={Boolean(scene.compare && value?.source?.kind === "copy")} className="q-compare-presence">
      {scene.compare && value?.source?.kind === "copy" && <section className="q-copy-source" aria-label={t("原题对照")}>
        <header><strong>{t("改编前的原题")}</strong>
          <button onClick={() => patchScene({compare: false})}>{t("结束对照")}</button></header>
        <h3>{value.source.snapshot.title || t("原题")}</h3>
        <DocumentView value={value.source.snapshot.body} />
        {value.source.snapshot.solution?.blocks?.length > 0 && <details open><summary>{t("答案解析")}</summary><DocumentView value={value.source.snapshot.solution} /></details>}
        <button onClick={() => open("question", value.source.questionId)}>{t("查看当前原题")}</button>
      </section>}
      </ModulePresence>
      <main className="q-main">
        <div className="q-message" role="status">
          {message}
          {hasPending && (
            <button
              onClick={retryPending}
            > {t("确认上次请求")} </button>
          )}
        </div>
        {conflict && !(scene.kind === 'new' && value?.source?.kind === 'copy') && (
          <section aria-label={t("版本冲突对照")}>
            <p>{t("服务器已有更新。本地修改仍保留，请核对后选择。")}</p>
            <details>
              <summary>{t("服务器当前内容")}</summary>
              {(conflict.drafts ?? [conflict]).map((item) => (
                <article key={item.id}>
                  <strong>{item.title || t("未命名题目")}</strong>
                  <DocumentView value={item.body} />
                  <DocumentView value={item.solution} />
                </article>
              ))}
            </details>
            <button
              onClick={() => resolveConflict(false)}
            > {t("采用服务器版本")} </button>
            <button
              onClick={() => resolveConflict(true)}
            > {t("保留本地修改并继续校对")} </button>
          </section>
        )}
        {!value ? (
          scene.kind === 'list' ? archived ? <div className="q-welcome"><span className="q-welcome-icon"><QuestionIcon name="book" size={32} /></span><h2>{items.length || imports.length ? t("选择一份归档内容") : t("暂无归档内容")}</h2><p>{t("归档的题目和材料可以恢复，也可以彻底删除。")}</p></div> : <QuestionWelcome hasItems={items.length > 0} onCapture={startCapture} onCreate={() => open('new', null)} /> : <div className="q-empty" role="status">{loadError || t("正在打开…")}{loadError && <button onClick={() => returnToLibrary()}>{t("返回题库")}</button>}</div>
        ) : scene.kind === "import" ? (
          <>
            <header className="q-review-heading">
              <div className="q-review-title"><button className="q-text-button q-back" onClick={() => returnToLibrary()}><QuestionIcon name="back" />{archived ? t("返回归档内容") : t("返回题库")}</button><h2>{value.title}</h2><span className="q-muted">{value.deletedAt ? t("已归档") : isCompletedImport({ ...value, jobState: job?.state }) ? t("全部检查完成") : (stateNames[job?.state] ? t(stateNames[job.state]) : "")}</span></div>
              <div className="q-review-progress"><span><QuestionIcon name="check" size={15} />{t("原稿已保存")}</span><span>{value.drafts.filter(d => d.disposition === 'confirmed').length} {t("题已入库")}</span><span>{value.drafts.filter(d => d.disposition === 'pending').length} {t("题待检查")}</span></div>
              <div className="q-tools">
                {!value.deletedAt && <button
                  disabled={busy || Boolean(value.deletedAt) || active.has(job?.state)}
                  onClick={save}
                > {t("保存检查进度")} </button>}
                {active.has(job?.state) ? (
                  <button
                    onClick={() =>
                      stopExtraction()
                    }
                  > {t("停止整理")} </button>
                ) : !value.deletedAt && ['partial', 'failed', 'interrupted', 'cancelled'].includes(job?.state) && (
                  <button
                    onClick={() =>
                      retryExtraction()
                    }
                  > {t("重试未完成部分")} </button>
                )}
                <Popover label={t("材料操作")}>{({ close }) => <>
                <button
                  disabled={busy || Boolean(value.deletedAt) || active.has(job?.state)}
                  role="menuitem" onClick={() => { picker.current.click(); close(); }}
                > {t("补充照片")} </button>
                <button
                  disabled={
                    busy || active.has(job?.state) || Boolean(value.deletedAt)
                  }
                  role="menuitem" onClick={() => { appendDraft(visibleOriginal.current); close(); }}
                > {t("补充题目草稿")} </button>
                <button
                  disabled={busy || active.has(job?.state)}
                  role="menuitem" onClick={() => { requestLifecycle(value.deletedAt ? 'restore' : 'archive'); close(); }}
                >
                  {value.deletedAt ? t("恢复材料") : t("归档材料", { context: 'action' })}
                </button>
                {value.deletedAt && <button className="is-danger" role="menuitem" disabled={busy || active.has(job?.state)} onClick={() => { requestLifecycle('purge'); close(); }}>{t("彻底删除材料")}</button>}
                </>}</Popover>
                <input
                  ref={picker}
                  hidden
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = [...e.target.files];
                    supplement(files);
                  }}
                />
              </div>
            </header>
            {job?.issues.map((i, n) => (
              <p className="q-error" key={n}>
                {i.detail}
              </p>
            ))}
            <div className="q-review-switch q-tools">
              <button onClick={() => patchScene({ reviewTab: "original" })}> {t("原稿")} </button>
              <button onClick={() => patchScene({ reviewTab: "result" })}> {t("校对结果")} </button>
            </div>
            <div className="q-review" data-tab={scene.reviewTab ?? "result"}
              style={{"--q-ratio": scene.reviewWidth ?? 0.5}}>
              <ResizeDivider value={scene.reviewWidth ?? 0.5} label={t("调整原稿对照宽度")}
                onChange={reviewWidth => patchScene({reviewWidth})} />
              <OriginalPane
                onVisibleLocation={location => { visibleOriginal.current = location; }}
                readOnly={locked}
                material={value}
                draft={draft}
                scene={scene.original ?? {}}
                onScene={(p) =>
                  patchScene({ original: { ...scene.original, ...p } })
                }
                onLocation={locateDraft}
                onCrop={cropOriginal}
              />
              <section {...reviewScroll} className="q-review-result">
                <nav className="q-review-tabs" aria-label={t("选择待检查题目")}>
                  {value.drafts.map((d, i) => (
                    <button
                      className={selected === d.id ? "selected" : ""}
                      key={d.id}
                      onClick={() => selectDraft(d.id)}
                    >
                      {i + 1}{" "}
                      {d.disposition === "confirmed"
                        ? t("已入库")
                        : d.disposition === "ignored"
                          ? t("已忽略")
                          : t("待检查")}
                    </button>
                  ))}
                </nav>
                {draft ? (
                  <fieldset disabled={locked} className="q-review-fields">
                    <div className="q-review-current"><h3>{t("第 {{number}} 题", { number: value.drafts.indexOf(draft) + 1 })} <span className="q-muted">{t("共 {{count}} 题", { count: value.drafts.length })}</span></h3>{draft.disposition !== 'confirmed' && <button className="q-text-button" onClick={() => patchScene({ reviewEditing: !scene.reviewEditing })}><QuestionIcon name={scene.reviewEditing ? 'check' : 'edit'} size={16} />{scene.reviewEditing ? t("完成修改") : t("修改题目")}</button>}</div>
                    {scene.reviewEditing ? <>
                      <label className="q-title-field">{t("题目名称")}<input aria-label={t("草稿标题")} value={draft.title} onChange={e => editDraft({ title: e.target.value })} /></label>
                      <QuestionDocumentEditor resetKey={value.version} key={draft.id + "-body"} value={draft.body} onChange={body => editDraft({ body })} onPickImage={pickImage} readOnly={locked} />
                    </> : <article className="q-reading-body" aria-label={t("待检查题干")}><DocumentView value={draft.body} /></article>}
                    {draft.answerStatus !== 'absent' && (scene.reviewEditing ? <QuestionDocumentEditor resetKey={value.version} key={draft.id + "-solution"} label={t("答案与解析")} value={draft.solution} onChange={solution => editDraft({ solution })} onPickImage={pickImage} readOnly={locked} /> : <section className="q-review-answer"><h4>{t("答案与解析")}</h4><DocumentView value={draft.solution} /></section>)}
                    {draft.answerStatus === 'absent' && !scene.reviewEditing && <p className="q-muted">{t("原稿中未提供答案")}</p>}
                    {(scene.reviewEditing || draft.answerStatus === 'unresolved') && <label className="q-answer-state">{t("答案是否完整")}<select data-question-answer-status aria-label={t("答案状态")} value={draft.answerStatus} onChange={e => editDraft({ answerStatus: e.target.value })}><option value="absent">{t("未提供答案")}</option><option value="present">{t("已有完整答案")}</option><option value="unresolved">{t("答案待核对")}</option></select></label>}
                    {draft.issues.length > 0 && <section className="q-review-checks" aria-label={t("需要检查的内容")}><h4>{draft.issues.some(i => i.resolution === 'open') ? t("请对照原稿检查") : t("检查已完成")}</h4>
                    {draft.issues.map((issue) => (
                      <div className="q-issue" key={issue.id} data-issue-id={issue.id} data-resolved={issue.resolution !== 'open'}>
                        <span id={`issue-${issue.id}`}>{issue.detail && t(issue.detail, { defaultValue: issue.detail }) || ({
                          'split-boundary': new Set(issue.locations.filter(l => l.kind === 'page').map(l => l.page)).size > 1
                            ? t("这道题包含跨页内容，请对照原稿检查归属。归属不对时可在“调整题目”中拆分或忽略，原始片段仍保留。")
                            : t("题干是否完整，是否混入了其他题目？"),
                          'uncertain-formula': t("请检查并修正这道题的公式。"),
                          'missing-figure': t("请补上原稿中的配图。"),
                          'unverified-location': t("请确认这道题在原稿中的位置。"),
                          'incomplete-answer': t("答案可能不完整，请对照原稿补充。"),
                          'uncertain-text': t("这些文字是否与原稿一致？"),
                          'truncated-input': t("内容可能被截断，请补全题目。"),
                        })[issue.code] || issue.detail || t("请核对这处内容。")}
                        {issue.locations.find(location => location.kind === 'page' && location.box) &&
                          <button className="q-text-button q-issue-location" onClick={() => {
                            const location = issue.locations.find(location => location.kind === 'page' && location.box);
                            patchScene({ original: { ...scene.original, fileId: location.fileId, page: location.page,
                              originalView: 'pages', selection: location, focusIssue: Date.now() } });
                          }}>{t("查看疑点位置")}</button>}
                        </span>
                        <select
                          aria-labelledby={`issue-${issue.id}`}
                          value={issue.resolution}
                          onChange={e => resolveReviewIssue(issue.id, e.target.value)}
                        >
                          <option value="open">{t("待校对")}</option>
                          <option value="corrected">{t("已修正")}</option>
                          {![
                            "uncertain-formula",
                            "missing-figure",
                            "unverified-location",
                            "incomplete-answer",
                          ].includes(issue.code) && (
                            <option value="acknowledged">{t("已核对")}</option>
                          )}
                        </select>
                      </div>
                    ))}</section>}
                    {Boolean(draft.noteFragments?.length) && <ModuleDisclosure title={t("教学笔记")}>
                      <NoteFragments resetKey={value.version} fragments={draft.noteFragments} editing={Boolean(scene.reviewEditing)} onPickImage={pickImage}
                        onChange={noteFragments => editDraft({ noteFragments })} onRemove={removeNoteFragment} />
                    </ModuleDisclosure>}
                    <ModuleDisclosure title={t("题型与标签")}>{classification(draft, editDraft)}</ModuleDisclosure>
                    {draft.disposition !== 'confirmed' && <ModuleDisclosure title={t("调整题目：拆分、合并或忽略")} className="q-adjust-question">
                    <p className="q-muted">{t("同一段有两题时，先修改题目，在分界处换行，再拆分。原稿始终保留。")}</p>
                    <div className="q-tools">
                      <label> {t("在第")}{" "}
                        <input
                          aria-label={t("拆分段落")}
                          type="number"
                          min="1"
                          max={Math.max(1, splitParagraphCount - 1)}
                          disabled={splitParagraphCount < 2}
                          value={splitAt}
                          onChange={(e) => setSplitAt(Number(e.target.value))}
                        />{" "} {t("段后")} </label>
                      <button
                        disabled={splitParagraphCount < 2}
                        onClick={() => splitDraft(splitAt)}
                      > {t("拆分")} </button>
                      <select
                        aria-label={t("合并目标")}
                        value={mergeId}
                        onChange={(e) => setMergeId(e.target.value)}
                      >
                        <option value="">{t("选择后接草稿")}</option>
                        {value.drafts
                          .filter(
                            (x) =>
                              x.id !== draft.id && x.disposition === "pending",
                          )
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.title}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={!mergeId}
                        onClick={() => { mergeDraft(mergeId); setMergeId(''); }}
                      > {t("合并")} </button>
                      <button
                        onClick={() =>
                          editDraft({
                            disposition:
                              draft.disposition === "ignored"
                                ? "pending"
                                : "ignored",
                          })
                        }
                      >
                        {draft.disposition === "ignored" ? t("恢复草稿") : t("忽略")}
                      </button>
                    </div>
                    </ModuleDisclosure>}
                  </fieldset>
                ) : (
                  <p>{t("原稿保留在左侧。处理完成后，题目草稿会出现在这里。")}</p>
                )}
                <FragmentReview material={value} draft={draft} locked={locked} onChange={change} />
                {draft && <footer className="q-review-footer">
                  {draft.questionId ? <><span className="q-saved-label"><QuestionIcon name="check" />{t("这道题已入库")}</span><button onClick={() => open('question', draft.questionId)}>{t("查看题目")}</button>{value.drafts.some(d => d.disposition === 'pending') && <button className="primary" onClick={() => { const next = value.drafts.find(d => d.disposition === 'pending'); selectDraft(next.id); }}>{t("检查下一题")}<QuestionIcon name="chevron" size={15} /></button>}</> : <><span className="q-muted">{draft.issues.filter(i => i.resolution === 'open').length ? t("还有 {{count}} 项需要检查", { count: draft.issues.filter(i => i.resolution === 'open').length }) : draft.disposition === 'ignored' ? t("这道题已忽略，可在调整题目中恢复") : t("确认后，这道题会加入题库")}</span><button className="primary" disabled={locked || draft.disposition === 'ignored'} onClick={confirmDraft}><QuestionIcon name="check" />{t("确认这道题")}</button></>}
                </footer>}
              </section>
            </div>
          </>
        ) : (
          <section className="q-question" ref={questionScroll.ref} onScroll={questionScroll.onScroll}>
            <header className="q-question-heading">
              {editing ? <>
                <button className="q-text-button q-back" disabled={busy} onClick={leaveEditor}><QuestionIcon name="back" />{scene.kind === 'new' ? t("返回题库") : t("返回题目")}</button>
                <span className="q-save-state">{busy ? t("正在保存…") : hasDraft ? t("草稿保存在此设备") : scene.kind === 'new' ? t("尚未保存") : t("已保存")}</span>
                <button className="primary" disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={saveQuestion}><QuestionIcon name="check" />{t("保存题目")}</button>
              </> : <>
                <div className="q-question-title"><span className="q-eyebrow">{value.deletedAt ? t("已归档") : value.source?.kind === 'copy' ? t("改编题目") : ''}</span><h2>{value.title || t("未命名题目")}{value.starred && <QuestionIcon name="star" size={18} />}</h2></div>
                <Popover label={t("更多题目操作")}>{({ close }) => <><button role="menuitem" disabled={busy || unsupportedQuestion} onClick={() => { requestLifecycle(value.deletedAt ? 'restore' : 'archive'); close(); }}>{value.deletedAt ? t("恢复题目") : t("归档题目")}</button>{value.deletedAt && <button className="is-danger" role="menuitem" disabled={busy} onClick={() => { requestLifecycle('purge'); close(); }}>{t("彻底删除题目")}</button>}</>}</Popover>
              </>}
            </header>
            {conflict && scene.kind === 'new' && value?.source?.kind === 'copy' && (
              <section aria-label={t("版本冲突对照")}>
                <p>{t("原题已更新。请核对当前原题，再选择是否将它作为改编来源。题干、答案、分类和笔记都会保留；选择后仍需保存题目。")}</p>
                <details open>
                  <summary>{t("当前原题")}</summary>
                  <strong>{conflict.title || t("未命名题目")}</strong>
                  <DocumentView value={conflict.body} />
                  <DocumentView value={conflict.solution} />
                </details>
                <button disabled={busy || Boolean(conflict.deletedAt)} onClick={adoptCopySource}>{t("以当前原题作为来源，保留改编内容")}</button>
              </section>
            )}
            {unsupportedQuestion && <p className="q-error" role="status">{t("这道题包含当前无法编辑的内容，已保留原数据，可以继续阅读。")}</p>}
            {!editing && <div className="q-reader-actions">{value.deletedAt ? <button className="primary" disabled={busy || unsupportedQuestion} onClick={() => requestLifecycle('restore')}>{t("恢复题目")}</button> : <>
              <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={beginEdit}><QuestionIcon name="edit" />{t("编辑题目")}</button>
              <button disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion} onClick={copyQuestion} title={t("保留原题，另存一道改编题")}><QuestionIcon name="copy" />{t("复制改编")}</button>
            </>}</div>}
            {!editing && hasDraft && <div className="q-draft-notice"><span>{value.deletedAt ? t("未保存的修改仍保存在此设备，恢复题目后可继续编辑。") : t("这道题有未保存的修改，当前显示已保存内容。")}</span>{!value.deletedAt && <button onClick={beginEdit}>{t("继续编辑")}</button>}<button className="q-text-button" onClick={() => requestDiscard()}>{t("放弃草稿")}</button></div>}
            {editing ? <fieldset className="q-edit-fields" disabled={Boolean(value.deletedAt) || unsupportedQuestion}>
              <label className="q-title-field">{t("题目名称")} <span className="q-muted">{t("选填，方便以后查找")}</span><input className="q-title-input" aria-label={t("题目标题")} placeholder={t("例如：二次函数的最值")} value={value.title} maxLength={200} onChange={e => change({ ...value, title: e.target.value })} /></label>
              <QuestionDocumentEditor resetKey={value.version} key={scene.kind + (value.id ?? 'new')} value={value.body} onChange={body => change({ ...value, body })} onPickImage={pickImage} autoFocus />
              {value.answerStatus === 'present' || !supportedDocument(value.solution) ? <QuestionDocumentEditor resetKey={value.version} key={scene.kind + (value.id ?? "new") + "-solution"} label={t("答案与解析")} value={value.solution} onChange={solution => change({ ...value, solution })} onPickImage={pickImage} /> : <button className="q-add-field" onClick={() => change({ ...value, answerStatus: 'present' })}><QuestionIcon name="plus" />{t("添加答案与解析")}</button>}
              <ModuleDisclosure title={t("题型、标签与笔记")} open={Boolean(scene.notesOpen)} onOpenChange={notesOpen => patchScene({ notesOpen })} className="q-question-notes">
                {classification(value, patch => change({ ...value, ...patch }))}
                <label className="q-note-field">{t("教学笔记")}<textarea aria-label={t("长期笔记")} placeholder={t("记下讲解思路、易错点，方便下次使用。")} value={value.note} onChange={e => change({ ...value, note: e.target.value })} /></label>
                <NoteFragments resetKey={value.version} fragments={value.noteFragments} editing onPickImage={pickImage}
                  onChange={noteFragments => change({ ...value, noteFragments })}
                  onRemove={removeNoteFragment} />
                <label className="q-checkbox"><input type="checkbox" checked={value.starred} onChange={e => change({ ...value, starred: e.target.checked })} />{t("标记题目，方便以后查找")}</label>
              </ModuleDisclosure>
              {hasDraft && <button className="q-text-button q-discard" onClick={() => requestDiscard()}>{t("放弃未保存的修改")}</button>}
            </fieldset> : <>
              <div className="q-question-meta">{taxonomy.types.filter(t => t.id === value.typeId).map(t => <span className={`q-type is-${TYPE_HUES[taxonomy.types.indexOf(t) % TYPE_HUES.length]}`} key={t.id}>{t.name}</span>)}{taxonomy.tags.filter(t => value.tagIds.includes(t.id)).map(t => <span className="q-tag" key={t.id}><QuestionIcon name="tag" size={12} />{t.name}</span>)}</div>
              <article className="q-reading-body" aria-label={t("题干")}><DocumentView value={value.body} /></article>
              {value.answerStatus === 'present' ? <ModuleDisclosure title={t("答案与解析")} open={Boolean(scene.answerOpen)} onOpenChange={answerOpen => patchScene({ answerOpen })} className="q-answer"><DocumentView value={value.solution} /></ModuleDisclosure> : <p className="q-missing-answer">{t("暂未添加答案")} <button className="q-text-button" disabled={Boolean(value.deletedAt) || unsupportedQuestion} onClick={() => { beginEdit(true); patchScene({ answerOpen: true }); }}>{t("添加答案")}</button></p>}
              {(value.note || value.noteFragments?.length > 0) && <ModuleDisclosure title={t("教学笔记")} className="q-reader-note">{value.note && <p>{value.note}</p>}<NoteFragments fragments={value.noteFragments} /></ModuleDisclosure>}
            </>}
            {value.source?.kind === "import" && (sourceMissing ? <p className="q-muted">{t("原始材料已彻底删除，题目内容仍保留。")}</p> :
              <button disabled={busy} onClick={openSource}> {t("对照原稿")} </button>
            )}
            {value.source?.kind === "copy" && !scene.compare && (
              <>
                <button onClick={() => patchScene({compare: true})}> {t("对照原题")} </button>
                {sourceMissing ? <p className="q-muted">{t("原题已彻底删除，可以继续查看采用时的原题。")}</p> : <button disabled={busy} onClick={openSource}> {t("查看原题")} </button>}
                <details>
                  <summary>{t("采用时的原题")}</summary>
                  <DocumentView value={value.source.snapshot.body} />
                  <DocumentView value={value.source.snapshot.solution} />
                </details>
              </>
            )}
            {copies.map((q) => (
              <button key={q.id} onClick={() => open("question", q.id)}> {t("改编题：{{title}}", { title: q.title || t("未命名") })}
              </button>
            ))}
            {value.id && (
              <ModuleDisclosure title={t("复制文字或下载图片")} className="q-export">
                <p className="q-muted">{t("把题目放进你自己的课件。图片采用透明背景，可直接插入 PPT。")}</p>
                <label>
                  <input
                    type="checkbox"
                    checked={includeAnswers}
                    onChange={(e) => setIncludeAnswers(e.target.checked)}
                  /> {t("包含答案（单独分片）")} </label>
                <div className="q-tools">
                  <button disabled={sourceCopyStatus === "copying"} onClick={async () => {
                    const text = sourceText(value.body);
                    const attempt = ++sourceCopyAttempt.current;
                    setSource(text);
                    setSourceCopyStatus("copying");
                    try {
                      await navigator.clipboard.writeText(text);
                      if (attempt === sourceCopyAttempt.current) setSourceCopyStatus("copied");
                    } catch {
                      if (attempt === sourceCopyAttempt.current) {
                        setSourceCopyStatus("failed");
                        requestAnimationFrame(() => {
                          if (attempt !== sourceCopyAttempt.current) return;
                          sourceField.current?.focus();
                          sourceField.current?.select();
                        });
                      }
                    }
                  }}> {t("复制文字与公式源")} </button>
                  <button
                    disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                    onClick={() =>
                      generateAssets()
                    }
                  >
                    {editing && hasDraft ? t("保存并生成题面图片") : t("生成题面图片")}
                  </button>
                  {assets && <button
                    disabled={busy}
                    onClick={() =>
                      refreshAssets()
                    }
                  > {t("刷新生成结果")} </button>}
                </div>
                <div className="q-tools">
                  {documentAssets(value.body).figures.map((figure, i) => (
                    <button
                      key={i}
                      disabled={busy || Boolean(value.deletedAt) || unsupportedQuestion}
                      onClick={() =>
                        generateAssets(figure.fileId)
                      }
                    >
                      {editing && hasDraft ? t("保存并生成配图") : t("生成配图")} {i + 1}
                    </button>
                  ))}
                  {documentAssets(value.body).formulas.map((formula, i) => (
                    <button key={i} onClick={() => { sourceCopyAttempt.current += 1; setSourceCopyStatus(""); setSource(formula); }}> {t("公式")} {i + 1} {t("源")} </button>
                  ))}
                </div>
                {sourceCopyStatus && <p role="status" className={sourceCopyStatus === "failed" ? "q-error" : "q-muted"}>{sourceCopyStatus === "copied" ? t("文字与公式源已复制") : sourceCopyStatus === "failed" ? t("未能自动复制，请复制下方已选文字") : t("正在复制…")}</p>}
                {source !== null && (
                  <textarea
                    ref={sourceField}
                    aria-label={t("可复制文字公式源")}
                    readOnly
                    value={source}
                    onFocus={(e) => e.target.select()}
                  />
                )}{" "}
                {assets && (
                  <p>
                    {assets.state === "succeeded"
                      ? t("素材已生成")
                      : active.has(assets.state)
                        ? t("正在生成素材")
                        : t("生成未完成，可重新生成")}
                  </p>
                )}
                {assets?.outputFileIds.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => download(id, `题面-${i + 1}.png`)}
                  > {t("下载分片")} {i + 1}
                  </button>
                ))}
              </ModuleDisclosure>
            )}
          </section>
        )}
      </main>
      <ModulePresence present={Boolean(capture)}>
      {capture && (
        <QuestionDialog title={t("从资料收录题目")} onClose={() => changeCollection({ capture: null })} className="q-capture-dialog">
          <ol className="q-steps" aria-label={t("收录步骤")}><li className="is-current"><span>1</span>{t("选择材料")}</li><li><span>2</span>{t("对照检查")}</li><li><span>3</span>{t("确认入库")}</li></ol>
          {capture === '选择' ? <>
            <p className="q-capture-intro">{t("题目现在在哪里？选择材料后，原稿会保留，整理出的题目由你确认后入库。")}</p>
            <div className="q-capture-options">{[
              ['PDF', 'file', t("试卷、练习册等 PDF 文件")],
              ['Word', 'file', t("已有的 Word 试题文档")],
              ["图片", 'image', t("截图或拍照，可选择多张")],
              ["文字", 'text', t("复制来的题干、答案或多道题")],
            ].map(([kind, icon, description]) => <button key={kind} onClick={() => changeCollection({ capture: kind })}><span className="q-capture-icon"><QuestionIcon name={icon} size={24} /></span><strong>{kind === '文字' ? t("粘贴文字") : kind === '图片' ? t("上传图片") : t("上传 ") + kind}</strong><span>{description}</span><QuestionIcon name="chevron" size={16} /></button>)}</div>
          </> : <>
            <button className="q-text-button q-back" onClick={() => changeCollection({ capture: '选择' })}><QuestionIcon name="back" />{t("更换材料类型")}</button>
            {capture === '文字' ? <label className="q-capture-text">{t("粘贴题目与已有答案")}<textarea aria-label={t("原始文字")} placeholder={t("例如：\n1. 计算 1+1。\n答案：2\n\n可以一次粘贴多道题。")} value={text} onChange={e => changeCollection({ text: e.target.value })} /></label> : <>
              <label className="q-file-picker"><QuestionIcon name="upload" size={28} /><strong>{t("选择")}{capture === '图片' ? t("图片") : capture + t(" 文件")}</strong><span>{capture === '图片' ? t("支持 PNG、JPG、WebP，可一次选择多张") : capture === 'PDF' ? t("选择一份 PDF，保留原稿供对照") : t("支持 .docx 和 .doc")}</span><input type="file" aria-label={t("选择原稿")} multiple={capture === '图片'} accept={capture === '图片' ? 'image/png,image/jpeg,image/webp' : capture === 'PDF' ? '.pdf' : '.doc,.docx'} onChange={e => changeCollection({ files: [...e.target.files] })} /></label>
              {!chosenFiles.length && collection.fileNames?.length > 0 && <p className="q-muted">{t("继续收录需要重新选择：")}{collection.fileNames.join('、')}</p>}
              {chosenFiles.length > 0 && <div className="q-chosen-files">{chosenFiles.map((file, i) => <div key={i}><QuestionIcon name="file" /><span>{file.name}</span>{chosenFiles.length > 1 && <button disabled={!i} onClick={() => moveCollectionFileUp(i)}>{t("上移")}</button>}</div>)}</div>}
              <p className="q-muted">{capture === '图片' ? t("原图会完整保留，识别结果需对照检查后再入库。") : capture === 'PDF' ? t("可整理文字 PDF 和扫描件；公式、配图和复杂排版请对照原稿检查。") : t("复杂排版和旧版 Word 的公式可能需要对照原稿修正。")}</p>
            </>}
            <ModuleDisclosure title={t("材料名称、出处与处理范围")} className="q-capture-metadata">
              <label>{t("材料名称")} <span className="q-muted">{t("选填")}</span><input value={title} placeholder={t("留空时使用文件名")} onChange={e => changeCollection({ title: e.target.value })} /></label>
              <label>{t("出处")} <span className="q-muted">{t("选填")}</span><input value={origin} placeholder={t("例如：教材页码、试卷名称")} onChange={e => changeCollection({ origin: e.target.value })} /></label>
              {['PDF', 'Word'].includes(capture) && <label>{t("仅处理这些页")}<input aria-label={t("处理页码")} placeholder={t("留空处理全部，例如 2,3,4")} value={pages} onChange={e => changeCollection({ pages: e.target.value })} /></label>}
            </ModuleDisclosure>
            <footer><span className="q-muted">{t("先保存原稿，再整理题目供你检查。")}</span><button className="primary" disabled={busy || (capture === '文字' ? !text.trim() : !chosenFiles.length)} onClick={collect}>{busy ? t("正在保存原稿…") : t("开始整理")}<QuestionIcon name="chevron" size={16} /></button></footer>
          </>}
          {message && <p className="q-error" role="alert">{message}</p>}
        </QuestionDialog>
      )}
      </ModulePresence>
      <ModulePresence present={confirmDiscard}>{confirmDiscard && <ConfirmDialog title={t("放弃未保存的修改？")} message={t("此设备上的这份草稿将被删除，已经保存的题目不受影响。")} confirmLabel={t("放弃修改")} onCancel={() => cancelDiscard()} onConfirm={discardDraft} />}</ModulePresence>
      <ModulePresence present={Boolean(copyCandidate)}>{copyCandidate && <ConfirmDialog title={t("替换未完成的题目？")} message={t("你还有一份未完成的新题草稿。开始这次改编会替换它，已保存的题目不受影响。")} confirmLabel={t("替换并开始改编")} onCancel={() => cancelCopy()} onConfirm={replaceWithCopy} />}</ModulePresence>
      <ModulePresence present={Boolean(lifecycleAction)}>{lifecycleAction && <LifecycleConfirmDialog
        title={t(lifecycleTitles[lifecycleAction.kind === 'import' ? 'import' : 'question'][lifecycleAction.mode])}
        message={lifecycleAction.mode === 'purge'
          ? t("“{{value}}”及其本地草稿将彻底删除，无法恢复。{{detail}}", { value: lifecycleAction.item.title || t("未命名题目"), detail: lifecycleAction.kind === 'import' ? t("已入库的题目会保留。") : t("已有改编题会保留。") })
          : lifecycleAction.mode === 'restore' ? t("恢复后，会重新出现在题库中。") : tx("将移出当前列表。之后可以在左侧的“已归档”里恢复或彻底删除。")}
        danger={lifecycleAction.mode === 'purge'}
        icon={lifecycleAction.mode === 'restore' ? 'restore' : 'trash'}
        busy={busy}
        confirmLabel={busy ? t("正在处理…") : lifecycleAction.mode === 'purge' ? t("彻底删除") : lifecycleAction.mode === 'restore' ? t("确认恢复") : t("确认归档")}
        onConfirm={confirmLifecycle}
        onCancel={cancelLifecycle}>
        {message && <p className="q-error" role="alert">{message}</p>}
      </LifecycleConfirmDialog>}</ModulePresence>
      <ModulePresence present={Boolean(newCategory)}>{newCategory && <QuestionDialog title={newCategory.kind === 'types' ? t("新建题型") : t("新建标签")} onClose={() => closeCategory()}>
        <form onSubmit={event => { event.preventDefault(); createCategory(); }}>
          <label>{t("名称")}<input aria-label={t("分类名称")} value={categoryName} maxLength={80} onChange={event => changeCategoryName(event.target.value)} /></label>
          <p className="q-muted">{t("创建后直接选用于当前题目。")}</p>
          <footer><button type="button" onClick={() => closeCategory()}>{t("取消")}</button><button className="primary" disabled={busy || !categoryName.trim()}>{t("创建并选用")}</button></footer>
          {message && <p role="alert">{message}</p>}
        </form>
      </QuestionDialog>}</ModulePresence>
    </div></div>
  );
}
function Taxonomy({ taxonomy, disabled, onSave }) {
  const { t } = useTranslation("questions");
  const [draft, setDraft] = useState({
      types: taxonomy.types,
      tags: taxonomy.tags,
    }),
    [name, setName] = useState(""),
    [kind, setKind] = useState("types"),
    [deleting, setDeleting] = useState(false),
    [pendingDelete, setPendingDelete] = useState(null),
    [error, setError] = useState("");
  return (
    <div className="q-taxonomy">
      <div className="q-taxonomy-add">
        <select
          aria-label={t("分类类别")}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="types">{t("题型")}</option>
          <option value="tags">{t("标签")}</option>
        </select>
        <input
          aria-label={t("新分类名称")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() => {
            if (name.trim()) {
              setDraft({
                ...draft,
                [kind]: [...draft[kind], { id: crypto.randomUUID(), name }],
              });
              setName("");
            }
          }}
        > {t("新增")} </button>
      </div>
      {["types", "tags"].map((k) => (
        <fieldset key={k} className="q-taxonomy-group">
          <legend>{t(k === "types" ? "题型" : "标签")}</legend>
          {draft[k].length === 0 && <p className="q-muted">{t(k === "types" ? "暂无题型" : "暂无标签")}</p>}
          {draft[k].map((category) => (
            <div key={category.id} className="q-taxonomy-row">
              <input
                aria-label={t(k === "types" ? "题型名称" : "标签名称")}
                value={category.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [k]: draft[k].map((x) =>
                      x.id === category.id ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                aria-label={t(k === "types" ? "删除题型“{{name}}”" : "删除标签“{{name}}”", { name: category.name })}
                disabled={disabled || deleting}
                onClick={async () => {
                  setDeleting(true);
                  setError("");
                  try {
                    const lists = await Promise.all([
                      get("/items"),
                      get("/items?state=deleted"),
                    ]);
                    const affected = lists
                      .flatMap((x) => x.items)
                      .filter(
                        (q) => q.typeId === category.id || q.tagIds.includes(category.id),
                      ).length;
                    setPendingDelete({ kind: k, id: category.id, name: category.name, affected });
                  } catch (error) { setError(error.message); }
                  finally { setDeleting(false); }
                }}
              > {t("删除")} </button>
            </div>
          ))}
        </fieldset>
      ))}
      <button disabled={disabled || deleting} onClick={() => onSave(draft)}>{t("保存分类")}</button>
      {error && <p role="alert">{error}</p>}
      <ModulePresence present={Boolean(pendingDelete)}>{pendingDelete && <ConfirmDialog
        title={t(pendingDelete.kind === "types" ? "删除题型" : "删除标签")}
        message={t(pendingDelete.kind === "types" ? "删除题型“{{name}}”并解除 {{affected}} 道题的关联？题目本身会保留。" : "删除标签“{{name}}”并解除 {{affected}} 道题的关联？题目本身会保留。", { name: pendingDelete.name, affected: pendingDelete.affected })}
        confirmLabel={t(pendingDelete.kind === "types" ? "删除题型" : "删除标签")} onCancel={() => setPendingDelete(null)} onConfirm={() => {
          setDraft(current => ({ ...current, [pendingDelete.kind]: current[pendingDelete.kind].filter(item => item.id !== pendingDelete.id) }));
          setPendingDelete(null);
        }} />}</ModulePresence>
    </div>
  );
}
