import { useTranslation } from 'react-i18next';
import { NotificationPanel } from './TopbarSurfaces.jsx';
import { Icon } from '../../../components/icons.jsx';
import { useWorkbenchShell } from '../shellContext.js';
import { useNotifications } from '../../schedule/useNotifications.js';

export default function Notifications({ open: isOpen, onToggle, onClose, onAnnounce }) {
  const { t } = useTranslation('workbench');
  const shell = useWorkbenchShell();
  const notifications = useNotifications(shell);
  return <span className="tb-entry-wrap" data-topbar-surface="notifications">
    <button className="tb-entry" aria-label={t("通知")} aria-haspopup="dialog" aria-expanded={isOpen} onClick={onToggle}><Icon name="bell" size={22}/>{notifications.unreadCount>0 && <span className="tb-badge is-red">!</span>}</button>
    {!isOpen && <span className="tb-tooltip" aria-hidden="true">{t("通知")}</span>}
    {isOpen && <NotificationPanel items={notifications.items} onChange={notifications.change} onAnnounce={onAnnounce} onOpenItem={item=>notifications.open(item,onClose)}
      feedback={notifications.problem && <div className="tb-notification-problem" role="alert">{notifications.problem}<button disabled={notifications.isRunning} onClick={notifications.retry}>{t("重试")}</button></div>}/>
    }
  </span>;
}
