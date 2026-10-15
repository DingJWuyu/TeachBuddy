import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/index.jsx';
import { ShellContext } from '../workbench/shellContext.js';
import { ModulePresence } from '../../components/interaction/ModuleMotion.jsx';
import { loadMathFont } from './localFont.js';
import { useMathConfirm } from './useMathConfirm.jsx';
import { useMathWorkSession } from './useMathWorkSession.js';
import WorkspaceHome from './WorkspaceHome.jsx';
import WorkshopWorkspace from './WorkshopWorkspace.jsx';
import GgbWorkspace from './GgbWorkspace.jsx';
import LegacyWorkspace from './LegacyWorkspace.jsx';
import WorkHistory from './WorkHistory.jsx';
import './math.css';
import './workspace.css';
export function MathWorkbench({ transport, route } = {}) {
  return transport ? (
    <MathSession transport={transport} route={route} />
  ) : (
    <AuthenticatedMath route={route} />
  );
}
function AuthenticatedMath({ route }) {
  const { request, account } = useAuth();
  return (
    <MathSession key={account.accountKey} transport={request} route={route} />
  );
}
function MathSession({ transport, route }) {
  const { t } = useTranslation('math');
  const shell = useContext(ShellContext);
  const [font, setFont] = useState(null);
  const [fontError, setFontError] = useState("");
  const [fontAttempt, setFontAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFontError("");
    loadMathFont().then(
      (value) => {
        if (live) setFont(value);
      },
      () => {
        if (live) setFontError(t("本地字体加载失败，预览暂不可用。"));
      },
    );
    return () => {
      live = false;
    };
  }, [fontAttempt]);
  const [confirm, confirmationDialog] = useMathConfirm();
  const importFile = useRef(null);
  const sourceFile = useRef(null);
  const session = useMathWorkSession({ transport, route, confirm, reselectHtml: () => importFile.current.click() });
  const { work: draft, status, pending, conflict, message, busy, home, account, client, actions, editor, history, importPending } = session;
  if (session.locked) return <main className="math-lock">
    <h1>{t('请重新验证身份')}</h1><p>{t('原账户内容已保留')}</p>
    <button onClick={actions.identify}>{t('重新验证')}</button>
  </main>;
  const serverVersion = typeof conflict === 'object' ? conflict?.version : conflict;
  const conflictNotice = conflict && draft ? <div className="math-message" role="alert">
    {t('服务器版本')} {serverVersion}{t('，本地版本')} {draft.version}
    <button disabled={busy || !!pending} onClick={actions.retainLocalVersion}>{t('以服务器版本为基线保留本地内容')}</button>
    <button disabled={busy || !!pending} onClick={() => actions.save(true)}>{t('另存作品')}</button>
    <button disabled={busy || !!pending} onClick={() => actions.open({ id: draft.id })}>{t('读取服务器作品')}</button>
  </div> : null;
  if (home) return <div className="math-workbench wb-module mw-home-wrapper">{confirmationDialog}
    <input ref={importFile} type="file" accept=".html,.htm,text/html" hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void actions.importHtml(file); }}/>
    <input ref={sourceFile} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void actions.importSource(file); }}/>
    {(message || pending || importPending) && <div className="mw-notice" role="alert">
      {message || t('上次操作结果待确认。')}
      {pending && <button disabled={busy} onClick={() => actions.save()}>{t('确认操作结果')}</button>}
      {importPending && <button disabled={busy || !!pending} onClick={() => actions.importHtml()}>{importPending.requiresReselection ? t('重选原文件并确认上传') : t('重试原文件上传')}</button>}
    </div>}
    <WorkspaceHome accountKey={account} client={client} items={session.library.items} search={session.library.search} deleted={session.library.deleted} busy={busy || !!pending}
      onSearch={session.library.searchWorks} onDeleted={session.library.showArchived} onNew={request => actions.newWork('workshop', typeof request === 'string' ? request : null)} onOpen={actions.open}
      onImport={() => importFile.current.click()} onImportSource={() => sourceFile.current.click()} onRestore={actions.archive} onPurge={actions.purge}/>
  </div>;
  const overlays = <><ModulePresence present={history.open}>{history.open && <WorkHistory work={draft} client={client} font={font} hasChanges={status !== '已保存'} onClose={history.close} onRestore={history.restore}/>}</ModulePresence>{confirmationDialog}</>;
  if (draft.source.kind === 'workshop') return <WorkshopWorkspace key={editor.session} draft={draft} accountKey={account} busy={busy} pending={pending} status={status} message={message} conflictNotice={conflictNotice} flushRef={editor.flushRef} client={shell ? client : null}
    takeAssistantRequest={editor.takeAssistantRequest} onChangeSource={next => editor.captureSource('workshop', next)} onChangeInput={editor.rememberInput}
    onTitle={actions.rename} onHome={actions.home} onSave={() => actions.save()} onError={actions.reportError} onHistory={history.show} onCopy={() => actions.save(true)} onArchive={() => actions.archive()} onDownload={actions.exportFile}>
    {overlays}
  </WorkshopWorkspace>;
  if (!session.readOnly && draft.source.kind === 'geogebra') return <GgbWorkspace key={editor.session} draft={draft} accountKey={account} busy={busy} pending={pending} status={status} message={message} conflictNotice={conflictNotice} flushRef={editor.flushRef}
    onChangeSource={(next, touched) => editor.captureSource('geogebra', next, touched)} onUnchanged={editor.acknowledgeUnchanged} onDirty={editor.dirty}
    onTitle={actions.rename} onHome={actions.home} onSave={() => actions.save()} onError={actions.reportError} onHistory={history.show} onRestore={() => actions.archive()}>
    {overlays}
  </GgbWorkspace>;
  return <LegacyWorkspace session={session} font={font} fontError={fontError} fontAttempt={fontAttempt} retryFont={() => setFontAttempt(value => value + 1)}
    confirm={confirm} confirmationDialog={confirmationDialog} conflictNotice={conflictNotice} importFile={importFile} sourceFile={sourceFile}/>;
}
