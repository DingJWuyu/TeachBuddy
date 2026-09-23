import { DataManagement } from '../reliability/DataManagement.jsx';
import { useEffect, useRef, useState } from 'react';
import { useWorkbenchShell } from './shellContext.js';
import { SaveActions, SaveStatus } from './SaveStatus.jsx';
import { ConflictResolution } from './ConflictResolution.jsx';
import { inspectDeviceData, clearDeviceData, downloadDeviceData } from './deviceData.js';

const sizeNames = { standard: '标准', large: '大字号' };
const motionNames = { system: '跟随系统', reduce: '减少动效' };
export function WorkbenchSettings() {
  const shell = useWorkbenchShell();
  const preferences = shell.preferences;
  const running = useRef(false);
  const [logoutState, setLogoutState] = useState('idle');
  const [inventory, setInventory] = useState(null);
  const [deviceError, setDeviceError] = useState('');
  const [clearing, setClearing] = useState(false);
  async function inspect() {
    try { setInventory(await inspectDeviceData(shell.accountKey)); setDeviceError(''); }
    catch { setDeviceError('无法读取本设备资料，暂不能清理。请检查浏览器存储权限后重试。'); }
  }
  useEffect(() => { inspect(); }, [shell.accountKey]);
  async function exitAccount() {
    if (running.current) return;
    running.current = true; setLogoutState('running');
    try { await shell.logout(); }
    catch (error) { setLogoutState(error.kind === 'logout-unconfirmed' ? 'unknown' : 'failed'); }
    finally { running.current = false; }
  }
  async function clear() {
    if (!window.confirm('清除当前账户在本设备的草稿与现场？未上传的输入会丢失，服务器内容保持不变。待确认操作及相关模块现场会保留。')) return;
    setClearing(true);
    try {
      const result = await clearDeviceData(shell.accountKey);
      shell.resetDeviceScene(`已清除本设备可清理的草稿与现场，保留 ${result.retainedCount} 项待确认或不可自动读取的资料。`);
    } catch (error) { setDeviceError(error.message || '清理失败，请重试。'); }
    finally { setClearing(false); }
  }
  return <div className="wb-support wb-settings" data-region="settings">
    <header><h1>设置</h1><p>个人偏好与本设备资料</p></header>
    <section className="wb-support-section">
      <h2>阅读与交互</h2>
      {preferences.loadError && <div role="alert">偏好读取失败。<button className="wb-button" onClick={preferences.adoptServer}>重新读取</button></div>}
      {preferences.input ? <>
        <label className="wb-setting-row"><span>阅读字号</span><select aria-label="阅读字号" value={preferences.input.readingSize}
          onChange={event => preferences.setInput(value => ({ ...value, readingSize: event.target.value }))}>
          <option value="standard">标准</option><option value="large">大字号</option></select></label>
        <label className="wb-setting-row"><span>界面动效</span><select aria-label="界面动效" value={preferences.input.motion}
          onChange={event => preferences.setInput(value => ({ ...value, motion: event.target.value }))}>
          <option value="system">跟随系统</option><option value="reduce">减少动效</option></select></label>
        <div className="wb-support-actions"><SaveActions savable={preferences} saveLabel="保存偏好" disabled={!preferences.baseline || preferences.loadState !== 'ready'} /><SaveStatus savable={preferences} /></div>
        {preferences.status === 'conflict' && <ConflictResolution savable={preferences} onAdopt={preferences.adoptServer}
          renderServer={value => <p>阅读字号：{sizeNames[value.values.readingSize]}；界面动效：{motionNames[value.values.motion]}</p>} />}
      </> : !preferences.loadError && <p>正在读取偏好…</p>}
    </section>
    <section className="wb-support-section"><h2>账户</h2>
      <div className="wb-setting-row"><span>当前账户</span><span data-field="account-key">{shell.nickname}</span></div>
      <div><button className="wb-button" disabled={logoutState === 'running'} onClick={exitAccount}>
        {logoutState === 'running' ? '正在退出…' : logoutState === 'unknown' ? '重试确认退出' : '退出登录'}</button></div>
      {logoutState === 'failed' && <p role="alert">退出失败，请重试。</p>}
      {logoutState === 'unknown' && <p role="alert">退出结果暂未确认，业务操作已锁定。请重试确认。</p>}
    </section>
    <DataManagement />
    <section className="wb-support-section"><h2>本设备草稿与现场</h2>
      {inventory && <p data-field="draft-count">{inventory.draftCount} 份草稿，{inventory.pendingCount} 项待确认操作{inventory.unreadableCount ? `，${inventory.unreadableCount} 项无法自动读取的资料` : ''}</p>}
      <p className="wb-note">草稿只留在此浏览器。清理不删除已保存内容；待确认操作及相关现场会保留。</p>
      <div className="wb-support-actions">
        <button className="wb-button" disabled={clearing || !inventory?.removableCount || Boolean(deviceError)} onClick={clear}>清除本设备草稿</button>
        <button className="wb-button" disabled={!inventory?.entries.length} onClick={async () => {
          try { downloadDeviceData(shell.accountKey, await inspectDeviceData(shell.accountKey)); } catch { setDeviceError('无法读取草稿，请重试。'); }
        }}>下载本设备草稿</button>
        <button className="wb-text-button" onClick={inspect}>重新检查</button>
      </div>
      {shell.deviceClearNotice && <p role="status">{shell.deviceClearNotice}</p>}
      {deviceError && <p role="alert">{deviceError}</p>}
    </section>
  </div>;
}
