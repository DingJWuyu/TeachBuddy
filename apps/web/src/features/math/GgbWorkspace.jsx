import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GeoGebraEditor } from './geogebra/index.js';
import { MathWebAssistant } from './web-ai/MathWebAssistant.jsx';
import { useAuxiliaryAssistant } from '../workbench/shellContext.js';
import { Icon } from '../workbench/icons.jsx';
import { mathStatusLabel } from './WorkspaceHome.jsx';
import './ggb-workspace.css';

export default function GgbWorkspace({ draft, accountKey, busy, pending, status, message, conflict, flushRef,
  onChangeSource, onDirty, onUnchanged, onTitle, onHome, onSave, onError, onHistory, onRestore, onOpenServer, children }) {
  const { t } = useTranslation('math');
  const [controller, setController] = useState(null);
  const [reading, setReading] = useState(false);
  const timer = useRef(null);
  const live = useRef(true);
  const current = useRef({ draft, status, onChangeSource, onError, onDirty, onUnchanged });
  const dirtyMarker = useRef(null);
  current.current = { draft, status, onChangeSource, onError, onDirty, onUnchanged };
  const initialBase64 = useRef(draft.source.base64);
  const readTask = useRef(Promise.resolve());
  const serializedRevision = useRef(initialBase64.current ? 0 : -1);
  const serializedBase64 = useRef(initialBase64.current);
  const initializing = useRef(true);
  const interacted = useRef(false);
  const initializedController = useRef(null);
  const assistant = useCallback(() => <MathWebAssistant controller={draft.deletedAt ? null : controller} title={draft.title} accountKey={accountKey}/>, [controller, draft.title, draft.deletedAt, accountKey]);
  useAuxiliaryAssistant(assistant);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const task = readTask.current.catch(() => {}).then(async () => {
      if (!controller || !live.current) throw new Error(t('画布尚未就绪，请稍后再试。'));
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const snapshot = await controller.serialize();
          if (!live.current) return snapshot;
          if (snapshot.revision !== controller.read().revision) continue;
          const { draft: latest, onChangeSource: change } = current.current;
          if (serializedRevision.current !== snapshot.revision) {
            if (snapshot.base64 === serializedBase64.current && dirtyMarker.current) current.current.onUnchanged(...dirtyMarker.current);
            if (snapshot.base64 !== serializedBase64.current) change({ ...latest.source, base64: snapshot.base64 }, serializedRevision.current >= 0 || controller.read().objects.length > 0);
            serializedBase64.current = snapshot.base64;
            serializedRevision.current = snapshot.revision;
          }
          dirtyMarker.current = null;
          return snapshot;
        } catch (error) {
          if (error.code !== 'conflict' || attempt === 3) throw error;
        }
      }
      throw new Error(t('画布正在变化，请暂停操作后再保存。'));
    });
    readTask.current = task;
    return task;
  }, [controller, t]);

  useEffect(() => {
    flushRef.current = controller ? flush : null;
    return () => { if (flushRef.current === flush) flushRef.current = null; };
  }, [flushRef, flush, controller]);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!controller || draft.deletedAt || initializedController.current === controller) return;
    initializedController.current = controller;
    initializing.current = true;
    const initialize = initialBase64.current ? controller.serialize().then(snapshot => {
      serializedRevision.current = snapshot.revision; serializedBase64.current = snapshot.base64;
    }) : flush();
    if (initialBase64.current) readTask.current = initialize;
    initialize.catch(error => { if (live.current) current.current.onError(error); }).finally(() => { initializing.current = false; });
  }, [controller, flush]);

  function changed(snapshot) {
    if (snapshot.origin !== 'manual') interacted.current = true;
    // Imported files emit layout notifications before the user starts editing.
    if (snapshot.origin === 'manual' && !interacted.current) { serializedRevision.current = snapshot.revision; return; }
    if (initializing.current || current.current.draft.deletedAt || snapshot.revision === serializedRevision.current) return;
    if (!dirtyMarker.current) dirtyMarker.current = [current.current.draft, current.current.status];
    current.current.onDirty();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush().catch(error => { if (live.current) current.current.onError(error); }), 300);
  }
  async function download() {
    setReading(true);
    try {
      const snapshot = await flush();
      const bytes = Uint8Array.from(atob(snapshot.base64), character => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.geogebra.file' }));
      const link = document.createElement('a');
      link.href = url; link.download = `${draft.title.replace(/[\\/:*?"<>|]/g, '_') || '数学作品'}.ggb`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { onError(error); }
    finally { if (live.current) setReading(false); }
  }
  async function submit() {
    setReading(true);
    try { await onSave(); }
    finally { if (live.current) setReading(false); }
  }
  const disabled = busy || reading || !controller || !!draft.deletedAt;
  return <div className="math-workbench wb-module math-ggb-workspace">
    {children}
    <section className="math-main math-ggb-main">
      <header className="math-ggb-header">
        <button className="math-return" onClick={onHome} disabled={busy || reading}><Icon name="back"/><span>{t('返回工坊')}</span></button>
        <div className="math-ggb-document"><span className="math-ggb-kind">{t('数学画布')}</span>
          <input className="math-work-title" aria-label={t('作品名称')} value={draft.title} maxLength={200} readOnly={!!draft.deletedAt} onChange={event => onTitle(event.target.value)}/>
        </div>
        <span className="math-ggb-status" role="status">{draft.deletedAt ? t('已归档') : mathStatusLabel(status)}{draft.version ? ` · ${t('版本')} ${draft.version}` : ''}</span>
        <div className="math-ggb-actions">
          <button className="math-icon-button" title={t('撤销')} aria-label={t('撤销')} disabled={disabled || !!pending} onClick={() => { try { controller.undo(); } catch (error) { onError(error); } }}><Icon name="back"/></button>
          <button className="math-icon-button math-ggb-redo" title={t('重做')} aria-label={t('重做')} disabled={disabled || !!pending} onClick={() => { try { controller.redo(); } catch (error) { onError(error); } }}><Icon name="back"/></button>
          {draft.id && <button disabled={busy || !!pending} onClick={onHistory}>{t('历史版本')}</button>}
          <button disabled={disabled} onClick={download}>{reading ? t('正在读取画布…') : t('下载 .ggb')}</button>
          <button className="math-primary" disabled={busy || reading || (!controller && !pending)} onClick={draft.deletedAt ? onRestore : submit}>{busy ? t('保存中') : pending ? t('确认保存结果') : draft.deletedAt ? t('恢复作品') : t('保存')}</button>
        </div>
      </header>
      {message && <div className="math-message" role="alert">{message}</div>}
      {conflict && <div className="math-message" role="alert">{t('服务器已有新版本，当前画布已保留。可以读取服务器作品重新核对。')}<button disabled={busy || !!pending} onClick={onOpenServer}>{t('读取服务器作品')}</button></div>}
      {draft.deletedAt ? <div className="math-ggb-archived">{t('已归档，恢复后可继续编辑。')}</div> : <div className="math-ggb-canvas" onPointerDownCapture={() => { interacted.current = true; }} onKeyDownCapture={() => { interacted.current = true; }}>
        <GeoGebraEditor initialBase64={initialBase64.current} appName={draft.source.appName} onReady={setController} onChange={changed} onError={onError}/>
      </div>}
    </section>
  </div>;
}
