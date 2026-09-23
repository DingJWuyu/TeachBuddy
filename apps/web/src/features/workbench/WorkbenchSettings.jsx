import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { DataManagement } from '../reliability/DataManagement.jsx';
import { SettingsConfirm } from '../reliability/SettingsControls.jsx';
import { useWorkbenchShell } from './shellContext.js';
import './settings-shell.css';
import { LANGUAGES } from './chrome/sidebarHeadData.js';
import { Presence } from './chrome/Presence.jsx';
const FLAGS = import.meta.glob('./chrome/flags/*.svg', { eager: true, query: '?url', import: 'default' });

function Segment({ label, value, options, onChange }) {
  return <div className="settings-segment" role="group" aria-label={label}>{options.map(([key, text]) => <button type="button" key={key} aria-pressed={value === key} aria-label={label === '外观' ? (key === 'light' ? '浅色' : '深色') : undefined} onClick={() => onChange(key)}>{label === '外观' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{key === 'light' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>}</svg>}{text}</button>)}</div>;
}
function Row({ title, description, children, className = '' }) {
  return <section className={`settings-row ${className}`}><div className="settings-row-copy"><h2>{title}</h2>{description && <p>{description}</p>}</div><div className="settings-row-control">{children}</div></section>;
}
const backgrounds = [['grid', '网格'], ['parchment', '羊皮纸'], ['circles', '圆形'], ['stripes', '条纹']];

function LanguageMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const current = LANGUAGES.find(item => item.code === value);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="settings-language" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const options = [...root.current.querySelectorAll('[role=menuitemradio]')];
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    }
  }}><button ref={trigger} className="wb-button settings-language-trigger" aria-label="语言" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><img src={FLAGS[`./chrome/flags/${current.flag}.svg`]} alt="" />{current.native}<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
    <Presence show={open}><div className="settings-language-menu" role="menu" aria-label="选择语言">{LANGUAGES.map(item => <button role="menuitemradio" aria-checked={value === item.code} key={item.code} onClick={() => { onChange(item.code); setOpen(false); trigger.current?.focus(); }}><img src={FLAGS[`./chrome/flags/${item.flag}.svg`]} alt="" /><span>{item.native}{item.english && <small>{item.english}</small>}</span>{value === item.code && <span className="settings-language-check">✓</span>}</button>)}</div></Presence>
  </div>;
}

export function WorkbenchSettings() {
  const shell = useWorkbenchShell();
  const { account } = useAuth();
  const running = useRef(false);
  const avatarInput = useRef(null);
  const [logoutState, setLogoutState] = useState('idle');
  const [theme, setTheme] = useState('light');
  const [weekStart, setWeekStart] = useState('monday');
  const [language, setLanguage] = useState('zh-CN');
  const [background, setBackground] = useState('grid');
  const [modal, setModal] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const nickname = account?.nickname || shell.nickname;
  useEffect(() => () => { if (avatar) URL.revokeObjectURL(avatar); }, [avatar]);
  async function exitAccount() {
    if (running.current) return;
    running.current = true; setLogoutState('running');
    try { await shell.logout(); }
    catch (error) { setLogoutState(error.kind === 'logout-unconfirmed' ? 'unknown' : 'failed'); }
    finally { running.current = false; }
  }
  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setAvatarError('请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。'); return;
    }
    setAvatarError(''); setAvatar(URL.createObjectURL(file));
  }
  return <div className="wb-support wb-settings settings-preview" data-region="settings" data-settings-theme={theme} data-settings-background={background}>
    <div className="settings-sheet">
      <header className="settings-profile">
        <div className="settings-avatar">
          {avatar ? <img src={avatar} alt="头像预览" /> : <span>{Array.from(nickname || 'T').slice(0, 2).join('')}</span>}
          <div className="settings-avatar-tools"><button type="button" aria-label="选择头像" onClick={() => avatarInput.current?.click()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 5 9.5 3h5L16 5h4v15H4V5Z"/><circle cx="12" cy="12" r="4"/></svg></button><button type="button" aria-label="移除头像预览" disabled={!avatar} onClick={() => setAvatar('')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg></button></div>
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseAvatar} />
        </div>
        <div className="settings-profile-copy"><h1 data-field="account-key">{nickname}</h1>{account?.email && <p>{account.email}</p>}<span className="settings-account-badge">TeachBuddy 账户</span>{avatar && <p className="settings-preview-note">头像仅预览，尚未保存</p>}</div>
      </header>
      {avatarError && <p role="alert">{avatarError}</p>}
      <Row title="外观" description="切换浅色和深色模式"><Segment label="外观" value={theme} onChange={setTheme} options={[[ 'light', '浅色' ], [ 'dark', '深色' ]]} /></Row>
      <Row title="每周开始于" description="日历中一周的第一天"><Segment label="每周开始于" value={weekStart} onChange={setWeekStart} options={[[ 'sunday', '星期日' ], [ 'monday', '星期一' ]]} /></Row>
      <Row title="语言"><LanguageMenu value={language} onChange={setLanguage} /></Row>
      <Row title="内容背景" description="自定义内容区的背景" className="settings-background-row"><div className="settings-background-options" role="group" aria-label="内容背景">{backgrounds.map(([value, text]) => <button type="button" key={value} aria-pressed={background === value} onClick={() => setBackground(value)}><span className="settings-background-swatch" data-pattern={value} /><span>{text}</span></button>)}</div></Row>
      <p className="settings-preview-note settings-preview-scope">外观与背景仅预览本页；每周开始日和语言尚未应用，离开后不保存。</p>
    </div>
    <DataManagement accountActions={<>
      <Row title="数据处理协议"><button className="wb-button" onClick={() => setModal('agreement')}>签署协议</button></Row>
      <Row title="退出登录"><button className="wb-button" disabled={logoutState === 'running'} onClick={exitAccount}>{logoutState === 'running' ? '正在退出…' : logoutState === 'unknown' ? '重试确认退出' : '退出登录'}</button></Row>
      {logoutState === 'failed' && <p role="alert">退出失败，请重试。</p>}
      {logoutState === 'unknown' && <p role="alert">退出结果暂未确认，业务操作已锁定。请重试确认。</p>}
    </>} dangerActions={<section className="settings-sheet settings-danger-section"><h2>危险操作</h2>
      <Row title="删除账户" description="永久删除账户及其资料" className="settings-danger-row"><button className="wb-button settings-danger-text" onClick={() => setModal('delete')}>删除账户</button></Row>
    </section>} />
    <SettingsConfirm show={modal === 'agreement'} title="数据处理协议" className="settings-reading-dialog" onClose={() => setModal(null)}><div className="settings-agreement-paper"><h3>TeachBuddy 数据处理协议</h3><p>协议内容待提供。</p></div></SettingsConfirm>
    <SettingsConfirm show={modal === 'delete'} title="删除账户？" onClose={() => setModal(null)} confirmLabel="永久删除账户" danger confirmDisabled><p>账户删除暂不可用，当前账户和资料不会被删除。</p></SettingsConfirm>
  </div>;
}
