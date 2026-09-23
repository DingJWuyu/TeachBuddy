/**
 * Conflict resolution panel: keep the local draft or compare against and adopt
 * the server version. Nothing is overwritten automatically.
 */

import { useState } from 'react';
import { ModuleDisclosure, ModulePresence } from './ModuleMotion.jsx';
import { ConfirmDialog } from './ModuleOverlays.jsx';

export function ConflictResolution({ savable, onAdopt, renderServer, hint }) {
  const [showServer, setShowServer] = useState(false);
  const [confirmAdopt, setConfirmAdopt] = useState(false);
  const server = savable.serverObject || savable.baseline;
  return (
    <div className="wb-conflict" data-region="conflict">
      <div className="wb-conflict-head">
        <strong>内容已在别处修改</strong>
        <span>服务器版本 {savable.problem?.currentVersion ?? server?.version ?? '未知'}</span>
      </div>
      {savable.pending && <p>请先重试确认上次请求，再选择要保留的版本。</p>}
      <p>{hint || '当前草稿保留在这里。采用服务器版本会丢弃本地输入，请先对照。'}</p>
      <div className="wb-conflict-actions">
        <button type="button" className="wb-button" onClick={() => setShowServer((current) => !current)}>
          {showServer ? '收起服务器版本' : '查看服务器版本'}
        </button>
        <button
          type="button"
          className="wb-button is-primary"
          name="adopt-server"
          disabled={Boolean(savable.pending)}
          onClick={() => setConfirmAdopt(true)}
        >
          采用服务器版本
        </button>
      </div>
      <ModuleDisclosure open={showServer && Boolean(server)}>
      {server && (
        <div className="wb-conflict-server" data-region="server-version">
          {renderServer ? renderServer(server) : <p className="wb-muted">服务器版本 {server.version}</p>}
          <p className="wb-muted">版本 {server.version}</p>
        </div>
      )}
      </ModuleDisclosure>
      <ModulePresence present={confirmAdopt}>
        {confirmAdopt && <ConfirmDialog title="采用服务器版本？" message="当前本地输入会被替换，请先确认已完成对照。" confirmLabel="采用服务器版本" onCancel={() => setConfirmAdopt(false)} onConfirm={async () => { setConfirmAdopt(false); await onAdopt(); }} />}
      </ModulePresence>
    </div>
  );
}
