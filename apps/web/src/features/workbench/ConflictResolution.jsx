/**
 * Conflict resolution panel: keep the local draft or compare against and adopt
 * the server version. Nothing is overwritten automatically.
 */

import { useState } from 'react';

export function ConflictResolution({ savable, onAdopt, renderServer, hint }) {
  const [showServer, setShowServer] = useState(false);
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
          onClick={async () => {
            const confirmed = window.confirm('采用服务器版本会丢弃当前的本地输入，继续？');
            if (confirmed) await onAdopt();
          }}
        >
          采用服务器版本
        </button>
      </div>
      {showServer && server && (
        <div className="wb-conflict-server" data-region="server-version">
          {renderServer ? renderServer(server) : <p className="wb-muted">服务器版本 {server.version}</p>}
          <p className="wb-muted">版本 {server.version}</p>
        </div>
      )}
    </div>
  );
}
