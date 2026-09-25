import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { DataManagement } from '../reliability/DataManagement.jsx';
import { SettingsConfirm } from '../reliability/SettingsControls.jsx';
import { useWorkbenchShell } from './shellContext.js';
import './settings-shell.css';
import { LANGUAGES } from './chrome/sidebarHeadData.js';
import { Presence } from './chrome/Presence.jsx';
import { Icon } from './chrome/icons.jsx';
const FLAGS = import.meta.glob('./chrome/flags/*.svg', { eager: true, query: '?url', import: 'default' });

function Segment({ label, value, options, onChange, disabled }) {
  return <div className="settings-segment" role="group" aria-label={label}>{options.map(([key, text]) => <button type="button" key={key} disabled={disabled} aria-pressed={value === key} aria-label={label === '外观' ? (key === 'light' ? '浅色' : '深色') : undefined} onClick={() => onChange(key)}>{label === '外观' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{key === 'light' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>}</svg>}{text}</button>)}</div>;
}
function Row({ title, description, children, className = '' }) {
  return <section className={`settings-row ${className}`}><div className="settings-row-copy"><h2>{title}</h2>{description && <p>{description}</p>}</div><div className="settings-row-control">{children}</div></section>;
}
const backgrounds = [['grid', '网格'], ['parchment', '羊皮纸'], ['circles', '圆形'], ['stripes', '条纹']];

function LanguageMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const focusOnOpen = useRef(null);
  const current = LANGUAGES.find(item => item.code === value);
  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) {
      const options = root.current.querySelectorAll('[role=menuitemradio]');
      const target = focusOnOpen.current === 'last' ? options[options.length - 1] : options[0];
      target?.focus({ preventScroll: true });
      focusOnOpen.current = null;
    }
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="settings-language" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { focusOnOpen.current = ['ArrowUp', 'End'].includes(event.key) ? 'last' : 'first'; setOpen(true); return; }
      const options = [...root.current.querySelectorAll('[role=menuitemradio]')];
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    }
  }}><button ref={trigger} className="wb-button settings-language-trigger" aria-label="语言" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><img src={FLAGS[`./chrome/flags/${current.flag}.svg`]} alt="" />{current.native}<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
    <Presence show={open}><div className="settings-language-menu" role="menu" aria-label="选择语言">{LANGUAGES.map(item => <button role="menuitemradio" aria-checked={value === item.code} key={item.code} onClick={() => { onChange(item.code); setOpen(false); trigger.current?.focus(); }}><img src={FLAGS[`./chrome/flags/${item.flag}.svg`]} alt="" /><span>{item.native}{item.english && <small>{item.english}</small>}</span>{value === item.code && <span className="settings-language-check" aria-hidden="true">✓</span>}</button>)}</div></Presence>
  </div>;
}

export function WorkbenchSettings() {
  const shell = useWorkbenchShell();
  const { account } = useAuth();
  const running = useRef(false);
  const avatarInput = useRef(null);
  const [logoutState, setLogoutState] = useState('idle');
  const { theme, background, avatar } = shell.appearance;
  const preferences = shell.preferences;
  const appearanceDisabled = !preferences.baseline || preferences.status === 'identity';
  const [language, setLanguage] = useState('zh-CN');
  const [modal, setModal] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarRequest = useRef(0);
  const [avatarError, setAvatarError] = useState('');
  const nickname = account?.nickname || shell.nickname;
  useEffect(() => () => { avatarRequest.current += 1; }, []);
  async function exitAccount() {
    if (running.current) return;
    running.current = true; setLogoutState('running');
    try { await shell.logout(); }
    catch (error) { setLogoutState(error.kind === 'logout-unconfirmed' ? 'unknown' : 'failed'); }
    finally { running.current = false; }
  }
  async function chooseAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setAvatarError('请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。'); return;
    }
    const request = ++avatarRequest.current;
    setAvatarError(''); setAvatarLoading(true);
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const size = Math.min(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
      if (request === avatarRequest.current) shell.setAppearance({ avatar: canvas.toDataURL('image/webp', 0.9) });
    } catch {
      if (request === avatarRequest.current) setAvatarError('图片无法读取，请选择其他 JPG、PNG 或 WebP 图片。');
    } finally {
      bitmap?.close();
      if (request === avatarRequest.current) setAvatarLoading(false);
    }
  }
  return <div className="wb-support wb-settings settings-preview" data-region="settings">
    <div className="settings-sheet">
      <header className="settings-profile">
        <div className="settings-avatar">
          {avatar ? <img src={avatar} alt="账户头像" /> : <span>{Array.from(nickname || 'T')[0]}</span>}
          <div className="settings-avatar-tools"><button type="button" aria-label="选择头像" disabled={avatarLoading || appearanceDisabled} onClick={() => avatarInput.current?.click()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 5 9.5 3h5L16 5h4v15H4V5Z"/><circle cx="12" cy="12" r="4"/></svg></button><button type="button" aria-label="删除头像" disabled={!avatar || avatarLoading || appearanceDisabled} onClick={() => { setAvatarError(''); shell.setAppearance({ avatar: '' }); }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg></button></div>
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseAvatar} />
        </div>
        <div className="settings-profile-copy"><h1 data-field="account-key">{nickname}</h1>{account?.email && <p>{account.email}</p>}<span className="settings-account-badge">TeachBuddy 账户</span>{avatarLoading && <p role="status" className="settings-preview-note">正在读取头像…</p>}</div>
      </header>
      {avatarError && <p role="alert">{avatarError}</p>}
      <Row title="外观" description="切换浅色和深色模式"><Segment label="外观" disabled={appearanceDisabled} value={theme} onChange={theme => shell.setAppearance({ theme })} options={[[ 'light', '浅色' ], [ 'dark', '深色' ]]} /></Row>
      <Row title="语言"><LanguageMenu value={language} onChange={setLanguage} /></Row>
      <Row title="内容背景" description="自定义所有页面的内容区背景" className="settings-background-row"><div className="settings-background-options" role="group" aria-label="内容背景">{backgrounds.map(([value, text]) => <button type="button" key={value} disabled={appearanceDisabled} aria-label={text} aria-pressed={background === value} onClick={() => shell.setAppearance({ background: value })}><span className="settings-background-swatch" data-pattern={value} /><span>{text}</span></button>)}</div></Row>
      <p className="settings-preview-note settings-preview-scope">语言切换暂未应用。</p>
      <div className="settings-save-status" role="status">{preferences.isSaving ? '正在保存…' : preferences.status === 'saved' || preferences.status === 'clean' ? '已保存' : ''}</div>
      {preferences.loadState === 'error' && <p role="alert">设置读取失败。<button className="wb-button" onClick={() => preferences.adoptServer()}>重新读取</button></p>}
      {['failed', 'unconfirmed'].includes(preferences.status) && <p role="alert">设置尚未保存。<button className="wb-button" onClick={() => preferences.pending ? preferences.retryConfirm() : preferences.save()}>重试保存</button></p>}
      {preferences.status === 'conflict' && <p role="alert">设置已在其他页面更新。<button className="wb-button" onClick={() => preferences.pending ? preferences.retryConfirm() : preferences.adoptServer()}>{preferences.pending ? '确认上次保存' : '使用已保存设置'}</button></p>}
    </div>
    <DataManagement accountActions={<>
      <Row title="数据处理协议"><button className="wb-button" onClick={() => setModal('agreement')}>签署协议</button></Row>
      <Row title="退出登录" description="结束当前会话"><button className="wb-button" disabled={logoutState === 'running'} onClick={exitAccount}>{logoutState === 'running' ? '正在退出…' : logoutState === 'unknown' ? '重试确认退出' : '退出登录'}</button></Row>
      {logoutState === 'failed' && <p role="alert">退出失败，请重试。</p>}
      {logoutState === 'unknown' && <p role="alert">退出结果暂未确认，业务操作已锁定。请重试确认。</p>}
    </>} dangerActions={<section className="settings-sheet settings-danger-section"><h2><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></svg>危险操作</h2>
      <Row title="删除您的账户" description="永久删除您的账户和所有数据。此操作无法撤销。" className="settings-danger-row"><button className="wb-button settings-danger-text" onClick={() => setModal('delete')}><Icon name="trash" size={20}/>删除账户</button></Row>
    </section>} />
    <SettingsConfirm show={modal === 'agreement'} title="数据处理协议" className="settings-reading-dialog" onClose={() => setModal(null)}><div className="settings-agreement-paper"><h3>TeachBuddy 数据处理协议</h3><p>协议暂未开放。</p></div></SettingsConfirm>
    <SettingsConfirm show={modal === 'delete'} title="删除账户？" onClose={() => setModal(null)} confirmLabel="永久删除账户" danger confirmDisabled><p>账户删除暂不可用，当前账户和资料不会被删除。</p></SettingsConfirm>
  </div>;
}
