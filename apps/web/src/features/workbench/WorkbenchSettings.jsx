import { useRef, useState } from 'react';
import { clearLocalPartition, listLocalNames } from './storage.js';
import { useWorkbenchShell } from './shellContext.js';

function localDraftNames(accountKey) {
  return listLocalNames(accountKey).filter((name) => name.startsWith('draft:'));
}

export function WorkbenchSettings() {
  const shell = useWorkbenchShell();
  const { logout } = shell;
  const running = useRef(false);
  const [logoutState, setLogoutState] = useState('idle');
  async function exitAccount() {
    if (running.current) return;
    running.current = true;
    setLogoutState('running');
    try { await logout(); }
    catch (error) { setLogoutState(error.kind === 'logout-unconfirmed' ? 'unknown' : 'failed'); }
    finally { running.current = false; }
  }
  const [drafts, setDrafts] = useState(() => localDraftNames(shell.accountKey));
  const [cleared, setCleared] = useState(false);

  function clearDeviceData() {
    const confirmed = window.confirm('清除本设备保存的草稿与现场？未上传的输入会丢失。');
    if (!confirmed) return;
    clearLocalPartition(shell.accountKey);
    setDrafts([]);
    setCleared(true);
  }

  return (
    <div className="wb-page wb-settings" data-region="settings">
      <section className="wb-panel">
        <h2>身份</h2>
        <dl className="wb-facts">
          <div>
            <dt>当前账户</dt>
            <dd data-field="account-key">{shell.nickname}</dd>
          </div>
        </dl>
        <button className="wb-button" disabled={logoutState === 'running'} onClick={exitAccount}>
          {logoutState === 'running' ? '正在退出…' : logoutState === 'unknown' ? '重试确认退出' : '退出登录'}
        </button>
        {logoutState === 'failed' && <p role="alert">退出失败，请重试。</p>}
        {logoutState === 'unknown' && <p role="alert">退出结果暂未确认，业务操作已锁定。请重试确认。</p>}
      </section>

      <section className="wb-panel">
        <h2>本设备草稿</h2>
        <p data-field="draft-count">
          {drafts.length > 0 ? `${drafts.length} 份未上传草稿保存在此设备` : '此设备没有未上传草稿'}
        </p>
        <p className="wb-note">草稿只留在这台设备，不代表已保存到服务器。</p>
        <button type="button" className="wb-button" disabled={drafts.length === 0} onClick={clearDeviceData}>
          清除本设备草稿
        </button>
        {cleared && <span className="wb-save-status" role="status">本设备草稿已清除</span>}
      </section>
    </div>
  );
}
