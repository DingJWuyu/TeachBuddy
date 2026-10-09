import { useTranslation } from 'react-i18next';
import { SearchModal, FeedbackPanel, TutorialPanel, PrivacyPanel, TutorialCelebration, CoachMark } from './TopbarSurfaces.jsx';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import SupportMenu from './SupportMenu.jsx';
import { followAnchor } from '../routes.js';
import { useScene } from '../useScene.js';
import { useWorkbenchShell } from '../shellContext.js';
import Notifications from './Notifications.jsx';
import { workbenchModules, moduleDisplayName } from '../../modules/moduleRegistry.js';
const modules = workbenchModules.filter(module => module.navigation === 'sidebar');
const topModules = workbenchModules.filter(module => module.navigation === 'top');
export default function Topbar({ route, collapsed, toggleSidebar, surface, setSurface, assistantOpen, onToggleAssistant, children }) {
  const { t } = useTranslation("workbench");
 const ref = useRef(null);
 const { accountKey } = useWorkbenchShell();
 const assistantIcon = route.moduleId === 'math' ? 'assistant' : 'gemini';
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
  <div className="tb-brand-slot"><button className="tb-mobile-menu" onClick={toggleSidebar} aria-label={t("打开工作台导航")}><Icon name="menu" /></button><a className="tb-brand" href="/" onClick={e=>followAnchor(e,'/')}><span className="tb-brand-mark">T</span><span className="tb-brand-wordmark">TeachBuddy</span></a></div>
  <nav className="tb-global-nav" aria-label={t("全局导航")}><a className={`tb-nav-item${route.name==='home'?' is-current':''}`} href="/" onClick={e=>followAnchor(e,'/')}>{t("首页")}</a>{topModules.map(module => <a key={module.id} className={`tb-nav-item${route.moduleId===module.id?' is-current':''}`} href={module.path} onClick={e=>followAnchor(e,module.path)}>{moduleDisplayName(module)}</a>)}<SupportMenu open={surface==='support'} onOpen={()=>setSurface('support')} onClose={()=>setSurface(null)} onSelect={()=>{}} /></nav>
  <div className="tb-top-actions">
   {entry('search','search',t("全局搜索"),null)}
   <Notifications open={surface==='notifications'} onToggle={()=>toggle('notifications')} onClose={()=>setSurface(null)} onAnnounce={announce}/>
   {entry('feedback','feedback',t("发送反馈"),<FeedbackPanel onAnnounce={announce} onClose={()=>setSurface(null)}/>)}
   {entry('tutorial','tutorial',t("使用教程"),<TutorialPanel modules={modules} completed={scene.completed} onAnnounce={announce} onComplete={id=>{ const completed=scene.completed.includes(id)?scene.completed.filter(x=>x!==id):[...scene.completed,id]; patch({completed}); if(completed.length===modules.length) celebrate(true); }}/>,modules.length-scene.completed.length)}
   {entry('privacy','shield',t("隐私与数据保护"),<PrivacyPanel/>)}{children}
   <span className="tb-entry-wrap">
    {onToggleAssistant
     ? <button type="button" className="tb-entry" aria-label={t("AI 助理")} aria-expanded={assistantOpen} onClick={onToggleAssistant}><Icon name={assistantIcon} size={22}/></button>
     : <a className="tb-entry" aria-label={t("AI 助理")} href="/" onClick={e=>followAnchor(e,'/')}><Icon name={assistantIcon} size={22}/></a>}
    <span className="tb-tooltip" aria-hidden="true">{t("AI 助理")}</span>
   </span>
  </div>
  <button className="tb-sidebar-toggle" aria-label={collapsed?t("展开侧栏"):t("收起侧栏")} onClick={toggleSidebar}><Icon name={collapsed?'panelOpen':'panelClose'} size={16}/></button>
  {surface==='search' && <SearchModal onClose={()=>setSurface(null)} onAnnounce={announce}/>}
  {!scene.coachDismissed && <span className="tb-coach-scrim" onPointerDown={dismissCoach}/> }
  {celebrating && <TutorialCelebration onClose={()=>celebrate(false)}/>}
  <span className="sr-only" role="status">{announcement}</span>
 </header>;
}
