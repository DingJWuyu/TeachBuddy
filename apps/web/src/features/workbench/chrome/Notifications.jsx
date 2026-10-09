import i18n from "../../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationPanel } from './TopbarSurfaces.jsx';
import { Icon } from './icons.jsx';
import { useWorkbenchShell } from '../shellContext.js';
import { useIdempotentSubmit } from '../useIdempotentSubmit.js';
import { workbenchGet, workbenchPost } from '../apiClient.js';
import { navigate } from '../routes.js';


const endpoint = '/api/modules/schedule/notifications';
export default function Notifications({ open: isOpen, onToggle, onClose, onAnnounce }) {
  const { t } = useTranslation("workbench");
  const shell = useWorkbenchShell();
  const [state, setState] = useState({ items: [], unreadCount: 0 });
  const [error, setError] = useState(null);
  const zone = shell.timeZone ?? 'Asia/Shanghai';
  const alive = useRef(true);
  const sequence = useRef(0);
  const submit = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:notifications' });
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const { body } = await workbenchGet(endpoint);
      if (!alive.current || seq !== sequence.current) return;
      setState(body);
      setError(null);
    } catch (problem) {
      if (alive.current && seq === sequence.current) setError(problem.message);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    const visible = () => {
      if (document.visibilityState !== 'visible') return;
      refresh();

    };
    visible();
    const timer = setInterval(visible, 30_000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', visible);
    };
  }, [refresh]);
  const run = async ({ key, payload }) => {
    const result = await workbenchPost(payload.path, payload.body, key);
    await refresh();
    return result.body;
  };
  function open(notice, close) {
    if (shell.storageFailed) {
      setError(t("草稿无法保留，请先复制或保存后再打开安排"));
      return;
    }
    if (!notice.readAt && !submit.pending) submit.submit(run, { path: `${endpoint}/${notice.id}`, body: { action: 'read' } });
    const query = new URLSearchParams({ entry: notice.key.entryId });
    if (notice.key.originDate) query.set('on', notice.key.originDate);
    const path = `/calendar?${query}`;
    navigate(path, { replace: window.location.pathname + window.location.search === path });
    close();
  }
  const items = state.items.map(notice => ({ id: notice.id, eventId: notice.key.entryId, read: Boolean(notice.readAt), text: notice.title, icon: 'calendar', time: new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeZone: zone, month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(notice.dueAt)) }));
  function change(next) {
    if (submit.pending || submit.isRunning) return;
    const removed = items.filter(item => !next.some(n => n.id === item.id));
    const changed = next.filter(item => item.read !== items.find(n => n.id === item.id)?.read);
    const ids = (removed.length ? removed : changed).map(item => item.id);
    if (ids.length) submit.submit(run, { path:'/api/modules/schedule/notification-actions', body:{ ids, action:removed.length ? 'dismiss' : changed[0].read ? 'read' : 'unread' } });
  }
  return <span className="tb-entry-wrap" data-topbar-surface="notifications">
    <button className="tb-entry" aria-label={t("通知")} aria-haspopup="dialog" aria-expanded={isOpen} onClick={onToggle}><Icon name="bell" size={22}/>{state.unreadCount>0 && <span className="tb-badge is-red">!</span>}</button>
    {!isOpen && <span className="tb-tooltip" aria-hidden="true">{t("通知")}</span>}
    {isOpen && <NotificationPanel items={items} onChange={change} onAnnounce={onAnnounce} onOpenItem={item=>open(state.items.find(n=>n.id===item.id),onClose)}
      feedback={(error || submit.problem) && <div className="tb-notification-problem" role="alert">{error || submit.problem.message}<button disabled={submit.isRunning} onClick={()=>submit.pending?submit.retry(run):refresh()}>{t("重试")}</button></div>}/>
    }
  </span>;
}
