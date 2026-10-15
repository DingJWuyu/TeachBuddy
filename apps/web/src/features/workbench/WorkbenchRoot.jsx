import { getWorkbenchContext } from './api.js';
import { moduleCatalogVersion } from '@refatos/shared';
import { useTranslation } from 'react-i18next';
import { prepareDeviceRecovery } from '../reliability/deviceRecovery.js';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { bindWorkbenchTransport, setIdentityLostListener, workbenchGet } from '../../platform/http/apiClient.js';
import { canPersistLocally, setStorageFailureListener, resetLocalReaders } from '../../platform/device/storage.js';
import WorkbenchApp from './WorkbenchApp.jsx';
import './workbench.css';

export default function WorkbenchRoot() {
  const { t } = useTranslation("workbench");
  const { account, sessionId, request, logout } = useAuth();
  const accountKey = account.accountKey;
  const [boot, setBoot] = useState(null);
  const [retry, setRetry] = useState(0);
  const [deviceReset, setDeviceReset] = useState(0);
  const [deviceClearNotice, setDeviceClearNotice] = useState(null);
  const [storageFailed, setStorageFailed] = useState(() => !canPersistLocally());
  useEffect(() => {
    const cleared = event => {
      if (event.key !== `tb.device.clear:${account.accountKey}`) return;
      resetLocalReaders(account.accountKey);
      setDeviceClearNotice(t("本设备草稿与现场已在另一个标签页清理。待确认资料仍保留。"));
      setDeviceReset(value => value + 1);
    };
    window.addEventListener('storage', cleared);
    return () => window.removeEventListener('storage', cleared);
  }, [account.accountKey]);
  useEffect(() => {
    let live = true;
    const unbind = bindWorkbenchTransport(request);
    setBoot(null);
    setIdentityLostListener(() => { if (live) setBoot({ accountKey, sessionId, mode: 'identity' }); });
    setStorageFailureListener(() => { if (live) setStorageFailed(true); });
    void (async () => {
      try {
        const { body } = await getWorkbenchContext();
        if (body.accountKey !== accountKey) throw new Error('Account mismatch');
        const recovery = (await workbenchGet('/api/reliability/v1/context')).body;
        const recoveryChanged = await prepareDeviceRecovery(accountKey, recovery);
        const catalog = (await workbenchGet('/api/modules')).body;
        if (catalog.version !== moduleCatalogVersion) throw new Error('Unsupported module catalog version');
        if (live) setBoot({ accountKey, sessionId, mode: 'ready', recoveryChanged });
      } catch (error) {
        if (live) setBoot({ accountKey, sessionId, mode: error.problem?.kind === 'identity' ? 'identity' : 'unavailable' });
      }
    })();
    return () => {
      live = false;
      unbind();
      setIdentityLostListener(null);
      setStorageFailureListener(null);
    };
  }, [accountKey, sessionId, request, retry]);

  if (boot?.accountKey === accountKey && boot.sessionId === sessionId && boot.mode === 'ready') {
    return <WorkbenchApp key={`${account.accountKey}:${retry}:${deviceReset}`} boot={{
      logout, transport: request, recoveryChanged: boot.recoveryChanged, deviceClearNotice,
      resetDeviceScene: notice => { setDeviceClearNotice(notice); setDeviceReset(value => value + 1); },
      accountKey: account.accountKey, nickname: account.nickname, generation: retry, storageFailed,
      reportIdentityLost: () => setBoot({ accountKey, sessionId, mode: 'identity' })
    }} />;
  }
  const failed = boot?.accountKey === accountKey && boot.sessionId === sessionId;
  return <div className="wb-gate" data-region="identity-gate"><div className="wb-gate-card">
    <h1>{!failed ? t("正在加载工作台") : boot.mode === 'identity' ? t("正在核实登录状态") : t("暂时无法连接服务")}</h1>
    {failed && <><p>{t("本设备的草稿仍然保留。")}</p><button className="wb-button" onClick={() => setRetry(value => value + 1)}>{t("重试")}</button></>}
  </div></div>;
}
