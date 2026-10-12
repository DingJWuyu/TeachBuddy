import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COPY } from './presentation.js';
import { useInternalAuth } from './AuthProvider.jsx';

export default function AccountDeletion() {
  const { t } = useTranslation('auth');
  const auth = useInternalAuth();
  const [retryFailed, setRetryFailed] = useState(false);
  return <div className="wb-gate"><section className="wb-gate-card" aria-labelledby="account-deletion-title" aria-busy={Boolean(auth.deletionRunning)}>
    <h1 id="account-deletion-title">{t(auth.deletionRunning ? '正在删除账户' : '核实账户删除')}</h1>
    <p>{auth.deletion.account.email}</p>
    <p role={auth.deletionError ? 'alert' : 'status'}>{auth.deletionError === 'context-lost' ? COPY.deletionUnverifiable : t(auth.deletionError === 'device'
      ? '账户已从服务器删除。本设备资料尚未清理完成，请重试清理。'
      : auth.deletionError === 'incomplete'
        ? '删除尚未完成，账户已锁定。请重试完成清理。'
        : auth.deletionRunning
          ? '正在停止任务并清理账户资料，请稍候。'
          : '删除结果尚未确认。请使用原请求核实，不要将登录失效当作删除成功。')}</p>
    {retryFailed && <p role="alert">{t('无法核实删除，请检查浏览器存储权限后重试。')}</p>}
    {!auth.deletionRunning && <button className="wb-button" onClick={async () => {
      setRetryFailed(false);
      try { await auth.deleteAccount(); } catch { setRetryFailed(true); }
    }}>
      {t(auth.deletionError === 'device' ? '重试清理本设备' : '重试核实删除')}
    </button>}
    {!auth.deletionRunning && auth.deletionError === 'context-lost' && <button className="wb-button" onClick={async () => {
      setRetryFailed(false);
      try { await auth.returnFromDeletionVerification(); } catch { setRetryFailed(true); }
    }}>{t('重新准备登录')}</button>}
    {!auth.deletionRunning && <button className="wb-button" onClick={async () => {
      setRetryFailed(false);
      try { await auth.deferDeletion(); } catch { setRetryFailed(true); }
    }}>{t('稍后核实，登录其他账户')}</button>}
  </section></div>;
}
