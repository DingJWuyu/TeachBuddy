import { groupDisplayName } from './displayNames.js';
import i18n from "../../../i18n/index.js";
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: "workbench", ...options });
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { workbenchModules, moduleDisplayName } from '../../modules/moduleRegistry.js';
import { ModulePresence, useModuleDialogFocus } from '../../../components/interaction/ModuleMotion.jsx';
const names = ids => ids.map(id => moduleDisplayName(workbenchModules.find(m => m.id === id)) || t("暂不可用模块")).join('、') || t("空");
function Summary({ layout }) {
  const { t } = useTranslation("workbench");
  return <dl>{layout.groups.map(group => <div key={group.id}><dt>{groupDisplayName(group)}</dt><dd>{names(group.moduleIds)}</dd></div>)}<div><dt>{t("已隐藏")}</dt><dd>{names(layout.hiddenModuleIds)}</dd></div></dl>;
}
function Comparison({ nav, onClose }) {
  const { t } = useTranslation("workbench");
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return <div className="wb-dialog-host wb-module-dialog" data-overlay="dialog">
    <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
    <div ref={ref} className="wb-dialog tb-navigation-comparison" role="dialog" aria-modal="true" aria-label={t("对照导航布局")}>
      <h2>{t("对照导航布局")}</h2>
      <p>{t("导航已在别处修改。选择要保留的布局；取消后本机修改仍会保留。")}</p>
      <div className="tb-navigation-columns">
        <section><h3>{t("此设备")}</h3><Summary layout={nav.raw} /></section>
        <section><h3>{t("账户已保存")}</h3><Summary layout={nav.serverObject.layout} /></section>
      </div>
      <div className="wb-dialog-actions">
        <button type="button" className="wb-button" onClick={onClose}>{t("取消")}</button>
        <button type="button" className="wb-button" onClick={async () => {
          if (window.confirm(t("使用账户已保存的导航布局？此设备尚未保存的布局修改将被替换。")) && await nav.adoptServer()) onClose();
        }}>{t("使用已保存布局")}</button>
        <button type="button" className="wb-button is-primary" onClick={async () => {
          if (window.confirm(t("用此设备的导航布局替换对照中的账户布局？"))) { await nav.keepLocal(); onClose(); }
        }}>{t("保留此设备布局")}</button>
      </div>
    </div>
  </div>;
}
export function NavigationBusy({ navigation: nav }) {
  const { t } = useTranslation("workbench");
  const busy = ['saving', 'loading'].includes(nav.status) && nav.loadState !== 'error';
  return busy ? <span className="tb-navigation-busy" role="status" data-navigation-status={nav.status}>{nav.status === 'saving' ? t("导航保存中…") : t("导航读取中…")}</span> : null;
}
export default function NavigationStatus({ navigation: nav, railCollapsed, onExpand }) {
  const { t } = useTranslation("workbench");
  const [comparing, setComparing] = useState(false);
  const failedRead = nav.loadState === 'error';
  const conflict = nav.status === 'conflict';
  const uncertain = Boolean(nav.pending) && nav.status !== 'saving';
  const text = failedRead ? t("导航读取失败") : uncertain ? t("导航保存结果未确认") : conflict ? t("导航已在别处修改")
    : nav.status === 'failed' ? t("导航保存失败") : '';
  return <>
    {text && (railCollapsed ? <div className="tb-navigation-rail-status" data-navigation-status={nav.status}>
      <button type="button" aria-label={t("展开侧栏处理导航同步")} title={t("{{text}}，展开侧栏处理", { text: text })} onClick={onExpand}>
        <Icon name="info" size={18} />
      </button>
    </div> : <div className="tb-navigation-status" data-navigation-status={nav.status}>
      <span role="status">{text}</span>
      {nav.localDraft && (conflict || uncertain || nav.status === 'failed') && <span>{t("本机修改已保留")}</span>}
      {failedRead && <button type="button" onClick={nav.retryLoad}>{t("重试读取导航")}</button>}
      {uncertain && !failedRead && nav.baseline && <button type="button" onClick={nav.retryConfirm}>{t("确认导航保存")}</button>}
      {!uncertain && !failedRead && nav.status === 'failed' && <button type="button" onClick={() => nav.save()}>{t("重试保存导航")}</button>}
      {conflict && !failedRead && !nav.pending && (nav.serverObject
        ? <button type="button" onClick={() => setComparing(true)}>{t("对照布局")}</button>
        : <button type="button" onClick={nav.refreshServer}>{t("读取冲突布局")}</button>)}
    </div>)}
    {createPortal(<ModulePresence present={comparing && conflict && !nav.pending && Boolean(nav.serverObject)}>
      {nav.serverObject && <Comparison nav={nav} onClose={() => setComparing(false)} />}
    </ModulePresence>, document.querySelector('.wb-workspace') ?? document.body)}
  </>;
}
