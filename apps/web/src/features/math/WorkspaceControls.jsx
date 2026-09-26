import { Popover, MenuItem } from '../workbench/ModuleOverlays.jsx';
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';

export function WorkspaceToolbar({ draft, busy, readOnly, pending, exportOpen, empty,
  onHome, onSave, onCopy, onDelete, onPurge, onExport, onUsage }) {
  const presentation = ['dynamic', 'html'].includes(draft?.source.kind);
  return <div className="math-workspace-actions">
    {draft && <>
      <button className="math-primary" disabled={busy || (!pending && (readOnly || empty))} onClick={draft.deletedAt && !pending ? onDelete : onSave}>
        {pending ? pending.kind === 'purge' ? '确认删除结果' : pending.kind === 'deletion' ? pending.input.deleted ? '确认归档结果' : '确认恢复结果' : pending.kind === 'export' ? '确认导出结果' : '确认保存结果' : draft.deletedAt ? '恢复作品' : '保存'}
      </button>
      <button className="math-action-button" aria-expanded={exportOpen} aria-controls="math-export-options" onClick={onExport}>{presentation ? '下载演示' : '下载图片'}</button>
      <Popover label="作品操作" buttonClassName="math-more-button">
        {({ close }) => <>
          <MenuItem icon="folder" onClick={() => { close(); onHome(); }}>我的作品</MenuItem>
          {!draft.deletedAt && <MenuItem icon="copy" disabled={busy || readOnly || !!pending} onClick={() => { close(); onCopy(); }}>另存作品</MenuItem>}
          {draft.id && <MenuItem onClick={() => { close(); onUsage(); }}>使用位置与教学反馈</MenuItem>}
          {draft.id && !draft.deletedAt && <MenuItem icon="folder" disabled={busy || !!pending}
            onClick={() => { close(); onDelete(); }}>归档作品</MenuItem>}
          {draft.deletedAt && <MenuItem icon="trash" danger disabled={busy || !!pending}
            onClick={() => { close(); onPurge(); }}>彻底删除</MenuItem>}
        </>}
      </Popover>
    </>}
  </div>;
}

export function ToolPanel({ name, active, children }) {
  return active === name ? <section id={`math-panel-${name}`} className="math-tool-section" aria-label={{ objects: '图形编辑', parameters: '滑杆设置', steps: '讲解步骤', canvas: '画布设置' }[name]}>{children}</section> : null;
}

export function ObjectProperties({ value, onChange, Fields, expanded, onExpanded }) {
  const { style, label, domain, ...content } = value;
  return <div className="math-object-properties">
    <Fields value={content} onChange={next => onChange({ ...value, ...next })} />
    {domain && <ModuleDisclosure title="定义域" className="math-property-group" open={!!expanded.domain} onOpenChange={open => onExpanded('domain', open)}>
      <Fields value={domain} prefix="domain-" onChange={next => onChange({ ...value, domain: next })}/>
    </ModuleDisclosure>}
    {label && <ModuleDisclosure title="图上标注" className="math-property-group" open={!!expanded.label} onOpenChange={open => onExpanded('label', open)}>
      <Fields value={label} prefix="label-" onChange={next => onChange({ ...value, label: next })} />
    </ModuleDisclosure>}
    {style && <ModuleDisclosure title="颜色与样式" className="math-property-group" open={!!expanded.style} onOpenChange={open => onExpanded('style', open)}>
      <Fields value={style} prefix="style-" onChange={next => onChange({ ...value, style: next })} />
    </ModuleDisclosure>}
  </div>;
}
