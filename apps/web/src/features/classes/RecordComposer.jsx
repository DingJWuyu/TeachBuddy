import { useTranslation } from 'react-i18next';

import { RecordContent } from './RecordContent.jsx';
import { useScene } from '../workbench/useScene.js';
/**
 * One-line class record composer.
 *
 * The shortest path is: type one sentence, save. Date defaults to the account
 * day; position/unfinished/commonIssues/nextNote and material links are one
 * "补充" away and never required. A confirmed save clears only its input and keeps
 * the teacher in this class for the next sentence; an unknown result keeps the
 * exact request and the typed input.
 */
import { useEffect, useRef, useState } from 'react';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { Icon } from '../workbench/icons.jsx';
import { readLocal, removeLocal, writeLocal } from '../workbench/storage.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import { useSaveShortcut } from '../workbench/useSaveShortcut.js';
import { createRecord, decodeRecordRequest, recordRequest } from './api.js';
import { emptyRecordInput, supportedSources, hasAnyRecordText, recordCreatePayload, todayInZone } from './model.js';
import { SourceChips, SourcePicker } from './SourcePicker.jsx';
import { RecordFields, RECORD_FIELDS } from './RecordFields.jsx';

export function RecordComposer({ accountKey, classId, timeZone, onCreated, initialSources = [], draftKey, journal = false, active = true }) {
  const { t } = useTranslation('classes');
  const draftName = `draft:class-record-new:${draftKey ?? classId}`;
  const [input, setInput] = useState(() => {
    const stored = readLocal(accountKey, draftName);
    const sources = supportedSources(stored?.input?.sources ?? initialSources);
    return stored?.input ? { ...stored.input, sources, recordedOn: journal && !stored.manualDate && !hasAnyRecordText(stored.input) && !sources.length ? todayInZone(timeZone) : stored.input.recordedOn } : { ...emptyRecordInput(classId, todayInZone(timeZone)), sources };
  });
  const manualDate = useRef(readLocal(accountKey, draftName)?.manualDate ?? false);
  const [expanded, setExpanded] = useState(() => readLocal(accountKey, draftName)?.expanded ?? false);
  const [fields, setFields] = useState(() => {
    const stored = readLocal(accountKey, draftName);
    return stored?.fields ?? (stored?.expanded ? RECORD_FIELDS.map(field => field.key) : []);
  });
  const [pickerScene, patchPicker] = useScene(accountKey, `class-composer-picker:${draftKey ?? classId}`, { open: false });
  const pickerOpen = pickerScene.open;
  const setPickerOpen = open => patchPicker({ open });
  const [uploadBusy, setUploadBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(input);
  const alive = useRef(true);
  const formRef = useRef(null);
  const submit = useIdempotentSubmit({ accountKey, name: `pending:class-record-new:${draftKey ?? classId}` });

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!hasAnyRecordText(input) && input.sources.length === 0 && (!journal || (fields.length === 0 && !input.content?.blocks.length && input.recordedOn === todayInZone(timeZone)))) {
      removeLocal(accountKey, draftName);
      return;
    }
    writeLocal(accountKey, draftName, { input, expanded, fields, manualDate: manualDate.current });
  }, [accountKey, draftName, input, expanded, fields, timeZone, journal]);

  function refreshDate() {
    if (!journal || manualDate.current || submit.pending || hasAnyRecordText(inputRef.current) || inputRef.current.sources.length) return;
    const today = todayInZone(timeZone);
    if (inputRef.current.recordedOn !== today) {
      inputRef.current = { ...inputRef.current, recordedOn: today };
      setInput(inputRef.current);
    }
  }
  useForegroundRefresh(refreshDate);
  useEffect(() => {
    const timer = setInterval(refreshDate, 30000);
    return () => clearInterval(timer);
  }, [timeZone, submit.pending]);

  function patch(values) {
    if (Object.hasOwn(values, 'recordedOn')) manualDate.current = values.recordedOn !== todayInZone(timeZone);
    else refreshDate();
    setNotice(null);
    inputRef.current = { ...inputRef.current, ...values };
    setInput(inputRef.current);
    writeLocal(accountKey, draftName, { input: inputRef.current, expanded, fields, manualDate: manualDate.current });
  }

  function settle(result, payload) {
    if (!result || !alive.current) return;
    const unchanged = JSON.stringify(recordCreatePayload(inputRef.current)) === JSON.stringify(recordCreatePayload(payload));
    if (unchanged) {
      manualDate.current = false;
      inputRef.current = emptyRecordInput(classId, journal ? todayInZone(timeZone) : inputRef.current.recordedOn);
      setInput(inputRef.current);
      setExpanded(false);
      setFields([]);
    }
    setNotice({ kind: 'saved', message: unchanged ? (journal ? t("记录已保存") : t("已保存")) : t("上次内容已保存，新输入仍为草稿") });
    onCreated(result);
  }

  async function save() {
    if (uploadBusy) return;
    if (!hasAnyRecordText(input)) {
      setNotice({ kind: 'error', message: t("至少写一句再保存") });
      return;
    }
    const payload = recordCreatePayload(input);
    settle(await submit.submit(({ key, payload: body }) => createRecord({ key, ...decodeRecordRequest(body) }), recordRequest(payload)), payload);
  }

  async function retryConfirm() {
    const payload = decodeRecordRequest(submit.pending?.payload).payload;
    settle(await submit.retry(({ key, payload }) => createRecord({ key, ...decodeRecordRequest(payload) })), payload);
  }

  useSaveShortcut(() => {
    if (journal && (formRef.current?.closest('[inert]') || [...document.querySelectorAll('[role="dialog"]')].some(dialog => !dialog.closest('[inert]')))) return;
    return submit.status === 'unconfirmed' ? retryConfirm() : save();
  }, active && !uploadBusy && submit.status !== 'running' && (!journal || !pickerOpen));

  const problem = submit.problem;
  const statusText = submit.status === 'unconfirmed'
    ? t("暂时无法确认是否保存")
    : submit.status === 'failed' ? (problem?.message || t("保存失败")) : notice?.message;
  const statusKind = submit.status === 'unconfirmed'
    ? 'unconfirmed'
    : submit.status === 'failed' ? 'error' : (notice?.kind || 'idle');

  return (
    <form
      ref={formRef}
      className={`c-composer${journal ? ' c-journal-composer' : ''}`}
      data-region="record-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (submit.status === 'unconfirmed') retryConfirm();
        else save();
      }}
    >
      {journal ? <>
        <div className="c-composer-heading">
          <h2><Icon name="prep" size={18} />{t("记一条课堂记录")}</h2>
          <label className="c-compact-date">
            <input className="wb-input" type="date" aria-label={t("记录日期")} value={input.recordedOn}
              onChange={event => patch({ recordedOn: event.target.value })} />
          </label>
          {input.recordedOn !== todayInZone(timeZone) && <button type="button" className="wb-button c-text-action" onClick={() => patch({ recordedOn: todayInZone(timeZone) })}>{t("今天")}</button>}
        </div>
        <textarea className="wb-input c-composer-input" aria-label={t("写一句")} rows={3}
          placeholder={t("今天这个班讲得怎么样？例如：讲完单调性定义，例2还没讲，下次先复习定义。")}
          value={input.note} onChange={event => patch({ note: event.target.value })} />
        <RecordFields input={input} onChange={patch} fields={fields} onFieldsChange={setFields} onPick={() => setPickerOpen(true)} />
        <RecordContent key={`${accountKey}:${draftKey ?? classId}`} resetKey={submit.result?.id} accountKey={accountKey} scope={`new:${draftKey ?? classId}`} value={input.content} onChange={content => patch({ content })} onBusyChange={setUploadBusy} />
        {input.sources.length > 0 && <SourceChips sources={input.sources} onRemove={source => patch({
          sources: input.sources.filter(item => !(item.kind === source.kind && item.id === source.id))
        })} />}
        <div className="c-composer-footer">
          <span className="c-compose-hint">{t("写一句就能保存")}</span>
          <button type="submit" className="wb-button is-primary" disabled={submit.status === 'running' || uploadBusy}
            name={submit.status === 'unconfirmed' ? 'retry-confirm' : 'save-record'}>
            {submit.status === 'running' ? t("保存中…") : submit.status === 'unconfirmed' ? t("重试确认") : t("保存记录")}
          </button>
        </div>
      </> : <>
      <div className="c-composer-row">
        <textarea
          className="wb-input c-composer-input"
          aria-label={t("写一句")}
          rows={2}
          placeholder={t("记下今天的教学进展或课堂反馈…")}
          value={input.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </div>
      <div className="c-composer-actions">
        <label className="c-date-field">
          <span className="wb-label">{t("日期")}</span>
          <input
            className="wb-input"
            type="date"
            aria-label={t("记录日期")}
            value={input.recordedOn}
            onChange={(event) => patch({ recordedOn: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="wb-button"
          name="toggle-supplement"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t("收起补充") : t("补充进度与资料")}
        </button>
        <span className="c-composer-spacer" />
        {submit.status === 'unconfirmed' ? (
          <button type="button" className="wb-button is-primary" name="retry-confirm" onClick={retryConfirm}>
            {t("重试确认")}
          </button>
        ) : (
          <button type="submit" className="wb-button is-primary" name="save-record">
            {t("保存")}
          </button>
        )}
      </div>

      <ModulePresence present={expanded} mode="collapse">
      {expanded && (
        <div className="c-composer-extra" data-region="record-supplement">
          <label className="wb-field">
            <span className="wb-label">{t("教到哪里")}</span>
            <textarea
              className="wb-input c-textarea"
              aria-label={t("教学位置")}
              rows={2}
              value={input.position}
              onChange={(event) => patch({ position: event.target.value })}
            />
          </label>
          <label className="wb-field">
            <span className="wb-label">{t("未讲内容")}</span>
            <textarea
              className="wb-input c-textarea"
              aria-label={t("未讲内容")}
              rows={2}
              value={input.unfinished}
              onChange={(event) => patch({ unfinished: event.target.value })}
            />
          </label>
          <label className="wb-field">
            <span className="wb-label">{t("共性问题")}</span>
            <textarea
              className="wb-input c-textarea"
              aria-label={t("共性问题")}
              rows={2}
              value={input.commonIssues}
              onChange={(event) => patch({ commonIssues: event.target.value })}
            />
          </label>
          <label className="wb-field">
            <span className="wb-label">{t("下次备注")}</span>
            <textarea
              className="wb-input c-textarea"
              aria-label={t("下次备注")}
              rows={2}
              value={input.nextNote}
              onChange={(event) => patch({ nextNote: event.target.value })}
            />
          </label>
          <div className="wb-field">
            <span className="wb-label">{t("关联资料")}</span>
            <SourceChips
              sources={input.sources}
              onRemove={(source) => patch({
                sources: input.sources.filter((item) => !(item.kind === source.kind && item.id === source.id))
              })}
              onPick={() => setPickerOpen(true)}
            />
          </div>
        </div>
      )}

      </ModulePresence>
      </>}

      <div className={`c-composer-status is-${statusKind}`} data-region="composer-status" role="status" aria-live="polite">
        {statusText && (
          <span className="c-status-text">
            {statusKind === 'saved' && <Icon name="check" size={13} />}
            {statusText}
          </span>
        )}
        {!statusText && hasAnyRecordText(input) && <span className="wb-draft-hint">{t("草稿在此设备")}</span>}
      </div>

      <ModulePresence present={pickerOpen}>
      {pickerOpen && (
        <SourcePicker
          explain={journal}
          sceneKey={`new:${draftKey ?? classId}`}
          accountKey={accountKey}
          value={input.sources}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(sources) => {
            patch({ sources });
            setPickerOpen(false);
          }}
        />
      )}
      </ModulePresence>
    </form>
  );
}
