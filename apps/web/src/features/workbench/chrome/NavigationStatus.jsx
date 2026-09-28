import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { workbenchModules } from '../../modules/moduleRegistry.js';
import { ModulePresence, useModuleDialogFocus } from '../ModuleMotion.jsx';
const names = ids => ids.map(id => workbenchModules.find(m => m.id === id)?.name ?? '暂不可用模块').join('、') || '空';
function Summary({ layout }) {
  return <dl>{layout.groups.map(group => <div key={group.id}><dt>{group.name}</dt><dd>{names(group.moduleIds)}</dd></div>)}<div><dt>已隐藏</dt><dd>{names(layout.hiddenModuleIds)}</dd></div></dl>;
}
function Comparison({ nav, onClose }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return <div className="wb-dialog-host wb-module-dialog" data-overlay="dialog">
    <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
    <div ref={ref} className="wb-dialog tb-navigation-comparison" role="dialog" aria-modal="true" aria-label="对照导航布局">
      <h2>对照导航布局</h2>
      <p>导航已在别处修改。选择要保留的布局；取消后本机修改仍会保留。</p>
      <div className="tb-navigation-columns">
        <section><h3>此设备</h3><Summary layout={nav.raw} /></section>
        <section><h3>账户已保存</h3><Summary layout={nav.serverObject.layout} /></section>
      </div>
      <div className="wb-dialog-actions">
        <button type="button" className="wb-button" onClick={onClose}>取消</button>
        <button type="button" className="wb-button" onClick={async () => {
          if (window.confirm('使用账户已保存的导航布局？此设备尚未保存的布局修改将被替换。') && await nav.adoptServer()) onClose();
        }}>使用已保存布局</button>
        <button type="button" className="wb-button is-primary" onClick={async () => {
          if (window.confirm('用此设备的导航布局替换对照中的账户布局？')) { await nav.keepLocal(); onClose(); }
        }}>保留此设备布局</button>
      </div>
    </div>
  </div>;
}
export function NavigationBusy({ navigation: nav }) {
  const busy = ['saving', 'loading'].includes(nav.status) && nav.loadState !== 'error';
  return busy ? <span className="tb-navigation-busy" role="status" data-navigation-status={nav.status}>{nav.status === 'saving' ? '导航保存中…' : '导航读取中…'}</span> : null;
}
export default function NavigationStatus({ navigation: nav }) {
  const [comparing, setComparing] = useState(false);
  const failedRead = nav.loadState === 'error';
  const conflict = nav.status === 'conflict';
  const uncertain = Boolean(nav.pending) && nav.status !== 'saving';
  const text = failedRead ? '导航读取失败' : uncertain ? '导航保存结果未确认' : conflict ? '导航已在别处修改'
    : nav.status === 'failed' ? '导航保存失败' : '';
  return <>
    {text && <div className="tb-navigation-status" data-navigation-status={nav.status}>
      <span role="status">{text}</span>
      {nav.localDraft && (conflict || uncertain || nav.status === 'failed') && <span>本机修改已保留</span>}
      {failedRead && <button type="button" onClick={nav.retryLoad}>重试读取导航</button>}
      {uncertain && nav.baseline && <button type="button" onClick={nav.retryConfirm}>确认导航保存</button>}
      {!uncertain && !failedRead && nav.status === 'failed' && <button type="button" onClick={() => nav.save()}>重试保存导航</button>}
      {conflict && !nav.pending && (nav.serverObject
        ? <button type="button" onClick={() => setComparing(true)}>对照布局</button>
        : <button type="button" onClick={nav.refreshServer}>读取冲突布局</button>)}
    </div>}
    {createPortal(<ModulePresence present={comparing && conflict && !nav.pending && Boolean(nav.serverObject)}>
      {nav.serverObject && <Comparison nav={nav} onClose={() => setComparing(false)} />}
    </ModulePresence>, document.querySelector('.wb-workspace') ?? document.body)}
  </>;
}
