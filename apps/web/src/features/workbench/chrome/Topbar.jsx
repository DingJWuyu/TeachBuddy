import { SearchModal, FeedbackPanel, TutorialPanel, PrivacyPanel, TutorialCelebration, CoachMark } from './TopbarSurfaces.jsx';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import SupportMenu from './SupportMenu.jsx';
import { followAnchor } from '../routes.js';
import { useScene } from '../useScene.js';
import { useWorkbenchShell } from '../shellContext.js';
import Notifications from './Notifications.jsx';
const modules = [{id:'questions',name:'题库',icon:'lessons'},{id:'lessons',name:'备课',icon:'pencil'},{id:'math',name:'数学工坊',icon:'graph'},{id:'resources',name:'资源库',icon:'folder'},{id:'classes',name:'班级教学',icon:'classes'}];
export default function Topbar({ route, collapsed, toggleSidebar, surface, setSurface, children }) {
 const ref = useRef(null);
 const { accountKey } = useWorkbenchShell();
 const [scene, patch] = useScene(accountKey, 'topbar', { completed: [], coachDismissed: false });
 const [announcement, announce] = useState('');
 const [celebrating, celebrate] = useState(false);
 const dismissCoach = () => patch({ coachDismissed: true });
 useEffect(() => {
  const close = e => {
   if (e.type === 'keydown' && e.key === 'Escape') { celebrate(false); if (!scene.coachDismissed) dismissCoach(); }
   if (e.type === 'keydown' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSurface('search'); return; }
   if (!['support','search','feedback','tutorial','privacy','notifications'].includes(surface)) return;
   if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setSurface(null);
  };
  document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
  return () => { document.removeEventListener('pointerdown',close); document.removeEventListener('keydown',close); };
 }, [surface, setSurface, scene.coachDismissed]);
 const toggle = value => setSurface(surface === value ? null : value);
 const entry = (name, icon, label, content, badge) => <span className={`tb-entry-wrap${name==='tutorial' && !scene.coachDismissed ? ' is-coached' : ''}`}>
  <button className="tb-entry" aria-label={label} aria-haspopup="dialog" aria-expanded={surface===name} onClick={()=>toggle(name)}><Icon name={icon} size={22}/>{badge>0 && <span className="tb-badge is-amber">{badge}</span>}</button>
  {name==='tutorial' && !scene.coachDismissed && <CoachMark onDismiss={dismissCoach}/>}
  {surface!==name && (name!=='tutorial' || scene.coachDismissed) && <span className="tb-tooltip" aria-hidden="true">{label}</span>}{surface===name && content}
 </span>;
 return <header className="tb-topbar" ref={ref}>
  <div className="tb-brand-slot"><button className="tb-mobile-menu" onClick={toggleSidebar} aria-label="打开工作台导航"><Icon name="menu" /></button><a className="tb-brand" href="/" onClick={e=>followAnchor(e,'/')}><span className="tb-brand-mark">T</span><span className="tb-brand-wordmark">TeachBuddy</span></a></div>
  <nav className="tb-global-nav" aria-label="全局导航"><a className={`tb-nav-item${route.name==='home'?' is-current':''}`} href="/" onClick={e=>followAnchor(e,'/')}>首页</a><a className={`tb-nav-item${route.name==='schedule'?' is-current':''}`} href="/calendar" onClick={e=>followAnchor(e,'/calendar')}>日程</a><SupportMenu open={surface==='support'} onOpen={()=>setSurface('support')} onClose={()=>setSurface(null)} onSelect={()=>{}} /></nav>
  <div className="tb-top-actions">
   {entry('search','search','全局搜索',null)}
   <Notifications open={surface==='notifications'} onToggle={()=>toggle('notifications')} onClose={()=>setSurface(null)} onAnnounce={announce}/>
   {entry('feedback','feedback','发送反馈',<FeedbackPanel onAnnounce={announce} onClose={()=>setSurface(null)}/>)}
   {entry('tutorial','tutorial','使用教程',<TutorialPanel modules={modules} completed={scene.completed} onAnnounce={announce} onComplete={id=>{ const completed=scene.completed.includes(id)?scene.completed.filter(x=>x!==id):[...scene.completed,id]; patch({completed}); if(completed.length===modules.length) celebrate(true); }}/>,modules.length-scene.completed.length)}
   {entry('privacy','shield','隐私与数据保护',<PrivacyPanel/>)}{children}
  </div>
  <button className="tb-sidebar-toggle" aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={toggleSidebar}><Icon name={collapsed?'panelOpen':'panelClose'} size={16}/></button>
  {surface==='search' && <SearchModal onClose={()=>setSurface(null)} onAnnounce={announce}/>}
  {!scene.coachDismissed && <span className="tb-coach-scrim" onPointerDown={dismissCoach}/> }
  {celebrating && <TutorialCelebration onClose={()=>celebrate(false)}/>}
  <span className="sr-only" role="status">{announcement}</span>
 </header>;
}
