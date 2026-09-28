import i18n from "../../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Popover } from '../../workbench/overlays.jsx';
import { useWorkbenchShell } from '../../workbench/shellContext.js';
import { useIdempotentSubmit } from '../../workbench/useIdempotentSubmit.js';
import { workbenchGet, workbenchPost } from '../../workbench/apiClient.js';
import { navigate } from '../../workbench/routes.js';
import './notifications.css';

const endpoint = '/api/modules/schedule/notifications';
export default function Notifications() {
  const { t } = useTranslation("schedule");
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
  function act(action) {
    submit.submit(run, { path: '/api/modules/schedule/notification-actions', body: { ids: state.items.map(n => n.id), action } });
  }
  function open(notice, close) {
    if (shell.storageFailed) {
      setError(t("草稿无法保留，请先复制或保存后再打开安排"));
      return;
    }
    if (!notice.readAt) submit.submit(run, { path: `${endpoint}/${notice.id}`, body: { action: 'read' } });
    const query = new URLSearchParams({ entry: notice.key.entryId });
    if (notice.key.originDate) query.set('on', notice.key.originDate);
    const path = `/calendar?${query}`;
    navigate(path, { replace: window.location.pathname + window.location.search === path });
    close();
  }
  const label = t("通知{{value}}", { value: state.unreadCount ? t("（{{unreadCount}} 条未读）", { unreadCount: state.unreadCount }) : '' });
  return <div className="sch-notifications">
    <Popover label={label} icon="bell">
      {({ close }) => <div data-region="notifications">
        <div className="sch-notification-head"><strong>{t("通知")}</strong>
          <button className="wb-text-button" disabled={!state.items.length || Boolean(submit.pending)} onClick={() => act('read')}>{t("全部已读")}</button>
          <button className="wb-text-button" disabled={!state.items.length || Boolean(submit.pending)} onClick={() => act('dismiss')}>{t("清空")}</button>
        </div>
        {error && <div role="alert">{error}<button className="wb-text-button" onClick={refresh}>{t("重试读取")}</button></div>}
        {!state.items.length && !error && <p className="wb-empty-note">{t("暂无通知")}</p>}
        <div className="sch-notification-list">{state.items.map(notice =>
          <button key={notice.id} className="sch-notification" data-notification-id={notice.id}
            data-unread={String(!notice.readAt)} onClick={() => open(notice, close)}>
            <span>{notice.title}</span><time dateTime={notice.dueAt}>{new Intl.DateTimeFormat(i18n.resolvedLanguage, {
              timeZone: zone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
            }).format(new Date(notice.dueAt))}</time>
            {!notice.readAt && <i aria-label={t("未读")} />}
          </button>)}</div>
      </div>}
    </Popover>
    {state.unreadCount > 0 && <span className="sch-notification-dot" aria-hidden="true" />}
    {submit.problem && <div className="sch-notification-error" role="alert">
      <span>{submit.problem.message}{t("，仍可打开安排")}</span>
      <button className="wb-text-button" disabled={submit.isRunning} onClick={() => {
        if (submit.pending) submit.retry(run);
        else { submit.reset(); refresh(); }
      }}>{submit.pending ? t("重试确认") : t("重新读取")}</button>
    </div>}
  </div>;
}
