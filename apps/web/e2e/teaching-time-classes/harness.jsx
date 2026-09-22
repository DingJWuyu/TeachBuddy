/**
 * T51 browser fixture: a minimal test shell around the real classes page.
 *
 * The product shell (sidebar, topbar, module registry, route table) is T53's
 * exclusive assembly work, so this fixture mounts the real feature page with the
 * same shell context shape, the same same-origin identity gate contract and the
 * real API. Nothing about the feature page itself is substituted: it is
 * `apps/web/src/features/classes/index.jsx` on a real HTTPS origin with the
 * real SQLite-backed API.
 *
 * Extra fixture routes render the two components T51 exports for other pages
 * (reverse feedback panel, class/record selector) so their browser behaviour
 * can be verified before T53 assembles them.
 */
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShellContext } from '../../src/features/workbench/shellContext.js';
import { navigate } from '../../src/features/workbench/routes.js';
import ClassesPage, { parseClassesPath } from '../../src/features/classes/index.jsx';
import { ClassRecordPicker, SourceRecordsPanel } from '../../src/features/classes/FeedbackPanel.jsx';
import { getWorkbenchContext, setIdentityLostListener } from '../../src/features/workbench/apiClient.js';
import { canPersistLocally, setStorageFailureListener } from '../../src/features/workbench/storage.js';
import '../../src/styles/global.css';
import '../../src/features/workbench/workbench.css';

const NAVIGATION_EVENT = 'tb:navigate';

function useHarnessPath() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    function sync() {
      setPathname(window.location.pathname);
    }
    window.addEventListener('popstate', sync);
    window.addEventListener(NAVIGATION_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAVIGATION_EVENT, sync);
    };
  }, []);
  return pathname;
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1080px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1080px)');
    const listener = (event) => setNarrow(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return narrow;
}

function Gate({ title, children }) {
  return (
    <div className="wb-gate" data-region="identity-gate">
      <div className="wb-gate-card">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

function PickerFixture() {
  const [value, setValue] = useState({ classId: null, recordIds: [] });
  return (
    <div className="wb-page" data-region="picker-fixture">
      <div className="c-detail-scroll">
        <ClassRecordPicker classId={value.classId} recordIds={value.recordIds} onChange={setValue} />
        <p className="wb-muted" data-region="picker-summary">
          {value.classId ? `已选 ${value.recordIds.length} 条记录` : '未选择班级'}
        </p>
      </div>
    </div>
  );
}

function PanelFixture({ kind, id }) {
  return (
    <div className="wb-page" data-region="panel-fixture">
      <div className="c-detail-scroll">
        <SourceRecordsPanel kind={kind} id={id} />
      </div>
    </div>
  );
}

function Harness() {
  const pathname = useHarnessPath();
  const narrow = useIsNarrow();
  const [boot, setBoot] = useState({ mode: 'loading', accountKey: null, generation: 0, storageFailed: false });

  async function check() {
    setBoot((current) => ({ ...current, mode: 'loading' }));
    try {
      const { body } = await getWorkbenchContext();
      if (!body?.accountKey) {
        setBoot((current) => ({ ...current, mode: 'unavailable' }));
        return;
      }
      setBoot((current) => ({
        ...current,
        mode: 'ready',
        accountKey: body.accountKey,
        generation: current.generation + 1
      }));
    } catch (error) {
      const kind = error?.problem?.kind;
      setBoot((current) => ({ ...current, mode: kind === 'identity' ? 'identity' : 'unavailable' }));
    }
  }

  useEffect(() => {
    if (!canPersistLocally()) setBoot((current) => ({ ...current, storageFailed: true }));
    setStorageFailureListener(() => setBoot((current) => (current.storageFailed ? current : { ...current, storageFailed: true })));
    setIdentityLostListener(() => setBoot((current) => (current.mode === 'identity' ? current : { ...current, mode: 'identity' })));
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shell = useMemo(() => ({
    accountKey: boot.accountKey,
    generation: boot.generation,
    storageFailed: boot.storageFailed,
    narrow,
    isPanelOpen: false,
    panelMode: 'ai',
    panelWidth: 300,
    tools: [],
    registerTools() {},
    openPanel() {},
    closePanel() {},
    setPanelMode() {},
    setPanelWidth() {},
    notifyIdentityLost: () => setBoot((current) => ({ ...current, mode: 'identity' })),
    navigate
  }), [boot.accountKey, boot.generation, boot.storageFailed, narrow]);

  if (boot.mode === 'identity') {
    return (
      <Gate title="身份已失效">
        <p>业务内容已隐藏。本设备上的草稿仍然保留，重新验证同一账户后可以继续。</p>
        <button type="button" className="wb-button is-primary" onClick={check}>重新检查身份</button>
      </Gate>
    );
  }
  if (boot.mode === 'unavailable') {
    return (
      <Gate title="暂时无法连接服务">
        <p>身份无法核实，业务内容暂不展示。</p>
        <button type="button" className="wb-button is-primary" onClick={check}>重试</button>
      </Gate>
    );
  }
  if (boot.mode !== 'ready') {
    return (
      <Gate title="正在加载工作台">
        <p className="wb-note">正在核实身份…</p>
      </Gate>
    );
  }

  const panelMatch = /^\/panel\/(lesson|question|math)\/([0-9a-f-]+)$/i.exec(pathname);
  let page = null;
  if (panelMatch) page = <PanelFixture kind={panelMatch[1].toLowerCase()} id={panelMatch[2]} />;
  else if (pathname === '/math') page = <div className="c-detail-scroll"><p>TeachingWork 同版替身</p><button className="wb-button" onClick={() => window.history.back()}>返回记录</button><SourceRecordsPanel kind="math" id={new URLSearchParams(window.location.search).get('workId')} /></div>;
  else if (pathname === '/picker') page = <PickerFixture />;
  else page = <ClassesPage route={parseClassesPath(pathname) ?? undefined} />;

  return (
    <ShellContext.Provider value={shell}>
      <div className="wb-shell" data-route={pathname}>
        <header className="wb-topbar">
          <a className="wb-brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
            <span className="wb-brand-mark" aria-hidden="true">T</span>
            TeachBuddy
          </a>
          <div className="wb-topbar-spacer" />
          <span className="wb-account-chip" title="当前账户">
            <span className="wb-avatar" aria-hidden="true">师</span>
            教师
          </span>
        </header>
        <div className="wb-body">
          <div className="wb-workspace">
            <main className="wb-main" data-region="main">{page}</main>
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
