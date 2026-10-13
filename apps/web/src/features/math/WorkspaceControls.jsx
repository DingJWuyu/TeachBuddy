import { useTranslation } from 'react-i18next';

import FunctionInput from './FunctionInput.jsx';
import { ConstructionFields } from './ConstructionTools.jsx';
import { Popover, MenuItem } from '../workbench/ModuleOverlays.jsx';
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';

export function WorkspaceToolbar({ draft, busy, readOnly, pending, exportOpen, empty,
  onHome, onSave, onCopy, onDelete, onPurge, onExport, onFeedback, onHistory, onDynamic }) {
  const { t } = useTranslation('math');
  const presentation = ['dynamic', 'html'].includes(draft?.source.kind);
  return <div className="math-workspace-actions">
    {draft && <>
      <button className="math-primary" disabled={busy || (!pending && (readOnly || empty))} onClick={draft.deletedAt && !pending ? onDelete : onSave}>
        {pending ? pending.kind === 'import-source' ? t("确认导入结果") : pending.kind === 'purge' ? t("确认删除结果") : pending.kind === 'deletion' ? pending.input.deleted ? t("确认归档结果") : t("确认恢复结果") : pending.kind === 'export' ? t("确认导出结果") : t("确认保存结果") : draft.deletedAt ? t("恢复作品") : t("保存")}
      </button>
      <button className="math-action-button" aria-expanded={exportOpen} aria-controls="math-export-options" onClick={onExport}>{presentation ? t("下载演示") : t("下载图片")}</button>
      <Popover label={t("作品操作")} buttonClassName="math-more-button">
        {({ close }) => <>
          <MenuItem icon="folder" onClick={() => { close(); onHome(); }}>{t("我的作品")}</MenuItem>
          {!draft.deletedAt && <MenuItem icon="copy" disabled={busy || readOnly || !!pending} onClick={() => { close(); onCopy(); }}>{t("另存作品")}</MenuItem>}
          {draft.id && !draft.deletedAt && <MenuItem icon="history" disabled={busy || readOnly || !!pending} onClick={() => { close(); onHistory(); }}>{t("历史版本")}</MenuItem>}
          {draft.source.kind === 'plane' && !draft.deletedAt && <MenuItem disabled={busy || readOnly || !!pending} onClick={() => { close(); onDynamic(); }}>{t("制作动态副本")}</MenuItem>}
          {draft.id && <MenuItem onClick={() => { close(); onFeedback(); }}>{t("教学反馈")}</MenuItem>}
          {draft.id && !draft.deletedAt && <MenuItem icon="folder" disabled={busy || !!pending}
            onClick={() => { close(); onDelete(); }}>{t("归档作品")}</MenuItem>}
          {draft.deletedAt && <MenuItem icon="trash" danger disabled={busy || !!pending}
            onClick={() => { close(); onPurge(); }}>{t("彻底删除")}</MenuItem>}
        </>}
      </Popover>
    </>}
  </div>;
}

export function ToolPanel({ name, active, children }) {
  const { t } = useTranslation('math');
  return active === name ? <section id={`math-panel-${name}`} className="math-tool-section" aria-label={{ objects: t("图形编辑"), parameters: t("滑杆设置"), steps: t("讲解步骤"), canvas: t("画布设置"), analysis: t("函数分析"), construct: t("关联构造") }[name]}>{children}</section> : null;
}

export function ObjectProperties({ value, onChange, Fields, expanded, onExpanded, elements = [] }) {
  const { t } = useTranslation('math');
  const { style, label, domain, construction, expression, ...rawContent } = value;
  const content = construction ? Object.fromEntries(Object.entries(rawContent).filter(([key]) => !["at", "from", "to", "center", "rx", "ry"].includes(key))) : rawContent;
  return <div className="math-object-properties">
    <Fields value={content} onChange={next => onChange({ ...value, ...next })} />
    {expression !== undefined && <FunctionInput expression={expression} onChange={expression => onChange({ ...value, expression })}/>}
    {construction && <><p className="math-hint">{t("关联构造 ·")} {t(`construction.${construction.kind}`)}{t("，随原对象变化。")}</p><ConstructionFields construction={construction} elements={elements} id={value.id} onChange={construction => onChange({ ...value, construction })}/></>}
    {domain && <ModuleDisclosure title={t("定义域")} className="math-property-group" open={!!expanded.domain} onOpenChange={open => onExpanded('domain', open)}>
      <Fields value={domain} prefix="domain-" onChange={next => onChange({ ...value, domain: next })}/>
    </ModuleDisclosure>}
    {label && <ModuleDisclosure title={t("图上标注")} className="math-property-group" open={!!expanded.label} onOpenChange={open => onExpanded('label', open)}>
      <Fields value={label} prefix="label-" onChange={next => onChange({ ...value, label: next })} />
    </ModuleDisclosure>}
    {style && <ModuleDisclosure title={t("颜色与样式")} className="math-property-group" open={!!expanded.style} onOpenChange={open => onExpanded('style', open)}>
      <Fields value={style} prefix="style-" onChange={next => onChange({ ...value, style: next })} />
    </ModuleDisclosure>}
  </div>;
}
