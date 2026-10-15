import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdempotentSubmit } from '../../platform/saving/useIdempotentSubmit.js';
import { navigate } from '../workbench/routes.js';
import { listNotifications, changeNotifications } from './api.js';

const endpoint = '/api/modules/schedule/notifications';

/** Schedule owns polling, pending requests and notification navigation. */
export function useNotifications({ accountKey, storageFailed, timeZone }) {
  const { t } = useTranslation('workbench');
  const [state, setState] = useState({ items: [], unreadCount: 0 });
  const [error, setError] = useState(null);
  const zone = timeZone ?? 'Asia/Shanghai';
  const alive = useRef(true);
  const sequence = useRef(0);
  const submit = useIdempotentSubmit({ accountKey, name: 'pending:notifications' });
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const body = await listNotifications();
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
    const result = await changeNotifications({ key, payload });
    await refresh();
    return result;
  };
  function open(notice, close) {
    if (storageFailed) {
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
  return { items, unreadCount: state.unreadCount, problem: error || submit.problem?.message,
    isRunning: submit.isRunning, change, open: (item, close) => open(state.items.find(notice => notice.id === item.id), close),
    retry: () => submit.pending ? submit.retry(run) : refresh() };
}
