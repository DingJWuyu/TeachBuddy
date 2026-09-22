/**
 * Honest save feedback. Every label here is derived from the save lifecycle so
 * the UI can never show "已保存" for a submission the server did not confirm.
 */

import { useState } from 'react';
import { useWorkbenchShell } from './shellContext.js';
import { keepsDraft, needsConfirmation, isBlockingWrite } from './saveStates.js';

const STATUS_TEXT = {
  loading: '加载中…',
  clean: '已保存',
  saved: '已保存',
  dirty: '未保存',
  saving: '保存中…',
  failed: '保存失败',
  unconfirmed: '暂时无法确认是否保存',
  conflict: '内容已在别处修改',
  identity: '登录状态已失效',
  deleted: '对象已被删除',
  missing: '未找到内容'
};

function saveStatusText(status) {
  return STATUS_TEXT[status] || '';
}

export function SaveStatus({ savable, showDraftHint = true }) {
  const shell = useWorkbenchShell();
  const { status, problem, localDraft, baseline, input } = savable;
  const [copied, setCopied] = useState(false);
  const text = status === 'clean' && !baseline ? '' : saveStatusText(status);
  // The state label and the problem reason must never print the same sentence
  // twice. An unconfirmed result without a named cause therefore keeps the label
  // alone, while a distinct cause (an unreachable service, a rejected field, a
  // conflict) still shows next to it.
  const reason = problem?.message && problem.message !== text ? problem.message : null;

  async function copyInput() {
    const payload = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
    } catch (error) {
      window.prompt('复制输入内容', payload);
    }
  }

  return (
    <div className="wb-save-block" data-save-status={status}>
      <span className="wb-save-status" role="status" aria-live="polite">{text}</span>
      {reason && (
        <span className="wb-save-reason">{reason}</span>
      )}
      {showDraftHint && localDraft && keepsDraft(status) && (
        <span className="wb-draft-hint">草稿在此设备</span>
      )}
      {shell.storageFailed && input && (
        <button type="button" className="wb-text-button" name="copy-input" onClick={copyInput}>
          {copied ? '已复制' : '复制输入'}
        </button>
      )}
    </div>
  );
}

export function SaveActions({ savable, onSave, saveLabel = '保存', disabled = false, children }) {
  const { status, pending } = savable;
  const saving = status === 'saving';
  const needsConfirm = Boolean(pending) || needsConfirmation(status);
  return (
    <div className="wb-save-actions">
      {children}
      {needsConfirm ? (
        <button
          type="button"
          className="wb-button is-primary"
          name="retry-confirm"
          disabled={saving}
          onClick={() => (onSave ? onSave({ retry: true }) : savable.retryConfirm())}
        >
          重试确认
        </button>
      ) : (
        <button
          type="button"
          className="wb-button is-primary"
          name="save"
          disabled={saving || disabled || isBlockingWrite(status)}
          onClick={() => (onSave ? onSave() : savable.save())}
        >
          {saving ? '保存中…' : saveLabel}
        </button>
      )}
    </div>
  );
}
