import { useTranslation } from 'react-i18next';

import { useContext, useEffect, useRef, useState } from 'react';
import { emptyRecordContent } from '@refatos/shared';
import { PUBLIC_AUTH } from '../auth/AuthProvider.jsx';
import { DocumentEditor } from '../workbench/materials/DocumentEditor.jsx';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { Icon } from '../workbench/icons.jsx';
import { useScene } from '../workbench/useScene.js';
import { readLocal } from '../workbench/storage.js';
import { deviceRequestStore, reselectDeviceFile } from '../workbench/deviceRequestStore.js';

export function RecordContent({ accountKey, scope, value, onChange, onBusyChange, resetKey }) {
  const { t } = useTranslation('classes');
  const auth = useContext(PUBLIC_AUTH);
  const documentValue = value ?? emptyRecordContent();
  const [scene, patchScene] = useScene(accountKey, `class-content:${scope}`, { open: false });
  const [pending, setPending] = useState(null);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef(null), resolvePick = useRef(null), alive = useRef(true), latest = useRef(null);
  latest.current = { value: documentValue, onChange };
  const store = (action = 'get', request) => deviceRequestStore({ database: 'teachbuddy.classes.uploads', storeName: 'pending', account: accountKey,
    name: `pending:class-image:${scope}`, action, value: request });
  useEffect(() => { if (resetKey) patchScene({ open: false }); }, [resetKey, patchScene]);
  const busy = !ready || sending || Boolean(pending);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    alive.current = true;
    readPending();
    return () => { alive.current = false; resolvePick.current?.(null); };
  }, [accountKey, scope]);

  async function readPending() {
    setError('');
    try {
      // Text-only records do not need binary storage. An existing upload
      // pointer must still be resolved before its draft can be saved.
      const request = readLocal(accountKey, `pending:class-image:${scope}`) ? await store() : null;
      if (!alive.current) return;
      setPending(request); setReady(true);
      if (request?.result) attach(request.result);
    } catch (problem) { if (alive.current) setError(problem.message); }
  }

  function attach(file) {
    const current = latest.current.value;
    // A confirmed upload retained across reload can safely be appended. It
    // never replaces an existing image without the original editor callback.
    if (!JSON.stringify(current).includes(file.id)) latest.current.onChange({ version: 2,
      blocks: [...current.blocks, { type: 'image', fileId: file.id, alt: '', widthMm: 100 }] });
  }
  useEffect(() => {
    if (!pending?.result || !JSON.stringify(documentValue).includes(pending.result.id)) return;
    let cancelled = false;
    store('delete').then(() => { if (!cancelled && alive.current) { setPending(null); setError(''); } })
      .catch(problem => { if (!cancelled) setError(problem.message); });
    return () => { cancelled = true; };
  }, [pending, value]);

  function pickImage() {
    return new Promise(resolve => { resolvePick.current = resolve; picker.current.click(); });
  }
  async function send(request) {
    setSending(true); setError('');
    try {
      request = await store('put', request);
      if (!alive.current) return;
      setPending(request);
      const body = new FormData(); body.append('file', request.file);
      const response = await auth.request('/api/workbench/files', { method: 'POST', body,
        headers: { 'X-TeachBuddy-Request': '1', 'Idempotency-Key': request.key }, signal: AbortSignal.timeout(30000) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 401) {
          await store('delete'); if (alive.current) setPending(null);
        }
        throw new Error(result.detail || t("图片上传结果未确认，请重试。"));
      }
      if (!result.id || !['image/png', 'image/jpeg', 'image/webp'].includes(result.mediaType)) {
        await store('delete'); if (alive.current) setPending(null);
        throw new Error(t("请选择 PNG、JPEG 或 WebP 图片。"));
      }
      request = { ...request, result };
      await store('put', request);
      if (!alive.current) return;
      setPending(request);
      if (resolvePick.current) { resolvePick.current(result); resolvePick.current = null; }
      else attach(result);
    } catch (problem) {
      if (alive.current) { setError(problem.message); resolvePick.current?.(null); resolvePick.current = null; }
    } finally { if (alive.current) setSending(false); }
  }
  async function selectFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) { resolvePick.current?.(null); resolvePick.current = null; return; }
    try { await send(pending ? await reselectDeviceFile(pending, file) : { key: crypto.randomUUID(), file }); }
    catch (problem) { setError(problem.message); }
  }
  const open = scene.open || documentValue.blocks.length > 0 || Boolean(pending) || Boolean(error);
  return <div className="c-content-editor">
    {!open && <button type="button" className="wb-button c-text-action" onClick={() => patchScene({ open: true })}><Icon name="math" size={16} />{t("公式与图片")}</button>}
    <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" aria-label={t("上传课堂图片")} hidden onChange={selectFile}
      onCancel={() => { resolvePick.current?.(null); resolvePick.current = null; }} />
    <ModulePresence present={open} mode="collapse">
      <div className="c-content-heading"><span className="wb-label">{t("公式与图片")}</span>
        {!documentValue.blocks.length && !pending && <button type="button" className="wb-icon-button" aria-label={t("收起公式与图片")} onClick={() => patchScene({ open: false })}><Icon name="close" size={14} /></button>}
      </div>
      <fieldset disabled={busy} className="c-content-controls">
        <DocumentEditor value={documentValue} label={t("课堂补充")} onChange={onChange} onPickImage={pickImage} allowTeacherNotes={false} />
      </fieldset>
      {sending && <p className="wb-muted" role="status">{t("正在上传图片…")}</p>}
      {pending && !sending && !pending.result && <p className="wb-muted" role="status">{t("图片上传结果未确认。")}
        <button type="button" className="wb-button" onClick={() => pending.requiresReselection ? picker.current.click() : send(pending)}>
          {pending.requiresReselection ? t("重新选择原图片并确认") : t("重试上传图片")}</button></p>}
      {error && <p className="wb-inline-error" role="alert">{error}
        {!ready && <button type="button" className="wb-button" onClick={readPending}>{t("重试读取图片状态")}</button>}
        {pending?.result && <button type="button" className="wb-button" onClick={() => { attach(pending.result); setPending({ ...pending }); }}>{t("重试确认图片")}</button>}
      </p>}
      {documentValue.blocks.length > 0 && <p className="wb-muted c-content-hint">{t("保存记录后，公式与图片才会加入课堂记录。")}</p>}
    </ModulePresence>
  </div>;
}
