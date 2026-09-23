import { prepareDeviceRecovery } from '../reliability/deviceRecovery.js';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { bindWorkbenchTransport, getWorkbenchContext, setIdentityLostListener, workbenchGet } from './apiClient.js';
import { canPersistLocally, setStorageFailureListener } from './storage.js';
import WorkbenchApp from './WorkbenchApp.jsx';
import './workbench.css';

export default function WorkbenchRoot() {
  const { account, request, logout } = useAuth();
  const [boot, setBoot] = useState(null);
  const [retry, setRetry] = useState(0);
  const [storageFailed, setStorageFailed] = useState(() => !canPersistLocally());
  useEffect(() => {
    let live = true;
    const unbind = bindWorkbenchTransport(request);
    setBoot(null);
    setIdentityLostListener(() => { if (live) setBoot({ account, mode: 'identity' }); });
    setStorageFailureListener(() => { if (live) setStorageFailed(true); });
    void (async () => {
      try {
        const { body } = await getWorkbenchContext();
        if (body.accountKey !== account.accountKey) throw new Error('Account mismatch');
        const recovery = (await workbenchGet('/api/reliability/v1/context')).body;
        const recoveryChanged = await prepareDeviceRecovery(account.accountKey, recovery);
        const catalog = (await workbenchGet('/api/modules')).body;
        if (catalog.version !== 3) throw new Error('Unsupported module catalog version');
        if (live) setBoot({ account, mode: 'ready', recoveryChanged });
      } catch (error) {
        if (live) setBoot({ account, mode: error.problem?.kind === 'identity' ? 'identity' : 'unavailable' });
      }
    })();
    return () => {
      live = false;
      unbind();
      setIdentityLostListener(null);
      setStorageFailureListener(null);
    };
  }, [account, request, retry]);

  if (boot?.account === account && boot.mode === 'ready') {
    return <WorkbenchApp key={`${account.accountKey}:${retry}`} boot={{
      logout, transport: request, recoveryChanged: boot.recoveryChanged,
      accountKey: account.accountKey, nickname: account.nickname, generation: retry, storageFailed,
      reportIdentityLost: () => setBoot({ account, mode: 'identity' })
    }} />;
  }
  const failed = boot?.account === account;
  return <div className="wb-gate" data-region="identity-gate"><div className="wb-gate-card">
    <h1>{!failed ? '正在加载工作台' : boot.mode === 'identity' ? '正在核实登录状态' : '暂时无法连接服务'}</h1>
    {failed && <><p>本设备的草稿仍然保留。</p><button className="wb-button" onClick={() => setRetry(value => value + 1)}>重试</button></>}
  </div></div>;
}
