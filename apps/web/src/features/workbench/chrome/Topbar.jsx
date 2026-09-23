import { SearchModal } from './TopbarSurfaces.jsx';
import { useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';
import SupportMenu from './SupportMenu.jsx';
import { followAnchor, navigate } from '../routes.js';
import Notifications from '../../schedule/notifications/Notifications.jsx';
export default function Topbar({ route, collapsed, toggleSidebar, surface, setSurface, children }) {
 const ref = useRef(null);
 useEffect(() => { const close = e => { if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setSurface(null); }; document.addEventListener('pointerdown', close);document.addEventListener('keydown', close);return () => {document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);}; }, [setSurface]);
 return <header className="tb-topbar" ref={ref}>
  <div className="tb-brand-slot"><button className="tb-mobile-menu" onClick={toggleSidebar} aria-label="打开工作台导航"><Icon name="menu" /></button><a className="tb-brand" href="/" onClick={e=>followAnchor(e,'/')}><span className="tb-brand-mark">T</span><span className="tb-brand-wordmark">TeachBuddy</span></a></div>
  <nav className="tb-global-nav" aria-label="全局导航"><a className={`tb-nav-item${route.name==='home'?' is-current':''}`} href="/" onClick={e=>followAnchor(e,'/')}>首页</a><a className={`tb-nav-item${route.name==='schedule'?' is-current':''}`} href="/calendar" onClick={e=>followAnchor(e,'/calendar')}>日程</a><SupportMenu open={surface==='support'} onOpen={()=>setSurface('support')} onClose={()=>setSurface(null)} onSelect={()=>{}} /></nav>
  <div className="tb-top-actions"><button className="tb-entry" aria-label="全局搜索" onClick={()=>setSurface('search')}><Icon name="search" size={22}/></button><Notifications/><button className="tb-entry" aria-label="发送反馈" onClick={()=>navigate('/help')}><Icon name="feedback" size={22}/></button><button className="tb-entry" aria-label="使用教程" onClick={()=>navigate('/help')}><Icon name="tutorial" size={22}/></button><button className="tb-entry" aria-label="隐私与数据保护" onClick={()=>navigate('/settings')}><Icon name="shield" size={22}/></button>{children}</div>
  <button className="tb-sidebar-toggle" aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={toggleSidebar}><Icon name={collapsed?'panelOpen':'panelClose'} size={16}/></button>
 {surface==='search' && <SearchModal onClose={()=>setSurface(null)} onAnnounce={()=>{}}/>}
 </header>;
}
