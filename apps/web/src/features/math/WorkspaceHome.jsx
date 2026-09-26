import { Icon } from '../workbench/icons.jsx';

export const workshopKinds = [
  { kind: 'formula', title: '公式', purpose: '排出清晰公式，放进讲义或课件' },
  { kind: 'plane', title: '平面图形', purpose: '画函数图像、几何图形与标注' },
  { kind: 'space', title: '空间图形', purpose: '制作立体几何示意图' },
  { kind: 'dynamic', title: '动态演示', purpose: '拖动参数，观察图形如何变化' },
];

export function WorkIllustration({ kind }) {
  return <svg className="math-work-illustration" viewBox="0 0 220 100" fill="none" aria-hidden="true">
    {kind === 'formula' ? <g fill="currentColor" fontFamily="serif" textAnchor="middle">
      <text x="48" y="58" fontSize="23">x =</text><text x="139" y="38" fontSize="22">−b ± √(b²−4ac)</text>
      <path d="M76 48H204" stroke="currentColor"/><text x="139" y="74" fontSize="22">2a</text>
    </g> : kind === 'space' ? <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="m67 29 57-18 36 25v48l-57 8-36-24zM67 29l36 24 57-17M103 53v39"/>
      <path d="M124 11v48l-57 9M124 59l36 25" strokeDasharray="4 4" opacity=".45"/>
    </g> : <g stroke="currentColor" strokeWidth="1.6">
      <path d="M32 72h158M101 88V10" opacity=".22"/>
      <path d="M48 16Q101 128 154 16"/>
      {kind === 'dynamic' && <><path d="M80 16Q133 92 186 16" strokeDasharray="4 4" opacity=".4"/>
        <path d="M65 91h98" strokeWidth="3" opacity=".25"/><circle cx="128" cy="91" r="5" fill="currentColor"/></>}
    </g>}
  </svg>;
}

export default function WorkspaceHome({ draft, status, items, search, deleted, busy, onSearch, onDeleted, onNew, onOpen, onResume, onDiscard, onImport, onImportSource, onRestore, onPurge }) {
  return <div className="math-home">
    <section aria-labelledby="math-start-heading">
      <h2 id="math-start-heading" tabIndex={-1}>这节课，需要什么数学素材？</h2>
      <div className="math-start-options">
        {workshopKinds.map(({ kind, title, purpose }) => <button key={kind} className="math-start-option" aria-label={`新建${title}`} disabled={busy} onClick={() => onNew(kind)}>
          <WorkIllustration kind={kind}/><span><strong>{title}</strong><small>{purpose}</small></span>
          <Icon name="chevron"/>
        </button>)}
      </div>
      <div className="math-import-actions"><button className="math-import-link" disabled={busy} onClick={onImport}><Icon name="folder"/>导入已有 HTML 演示</button>
      <button className="math-import-link" disabled={busy} onClick={onImportSource}><Icon name="folder"/>导入制作源 JSON</button></div>
    </section>
    {draft && status !== '已保存' && <section className="math-resume" aria-label="本设备草稿">
      <div><strong>{draft.title}</strong><span>{status === '未保存' ? '草稿保留在本设备，可继续制作' : status}</span></div>
      <button onClick={onResume}>继续制作</button><button className="math-icon-button" title="丢弃草稿" aria-label="丢弃草稿" disabled={busy} onClick={onDiscard}><Icon name="trash"/></button>
    </section>}
    <section className="math-library" aria-labelledby="math-library-heading">
      <div className="math-library-heading"><h2 id="math-library-heading">我的作品</h2>
        <label className="math-library-search"><Icon name="search"/><input aria-label="搜索作品" placeholder="搜索作品" value={search} onChange={e => onSearch(e.target.value)}/></label>
        <label className="math-deleted-filter"><input type="checkbox" checked={deleted} onChange={e => onDeleted(e.target.checked)}/>已归档</label>
      </div>
      <div className="math-work-list">
        {items.map(item => <div key={item.id} className="math-work-entry">
          <button className="math-work-row" disabled={busy} onClick={() => onOpen(item)}>
          <span className="math-work-symbol"><Icon name="math" size={20}/></span>
          <span><strong>{item.title}</strong><small>{workshopKinds.find(k => k.kind === (item.kind ?? item.source?.kind))?.title ?? 'HTML 演示'}</small></span><Icon name="chevron"/>
          </button>
          {deleted && <div className="math-archive-actions" role="group" aria-label={`${item.title}的归档操作`}>
            <button disabled={busy} onClick={() => onRestore(item)}>恢复</button>
            <button className="math-danger-button" disabled={busy} onClick={() => onPurge(item)}>彻底删除</button>
          </div>}
        </div>)}
      </div>
      {!items.length && <p className="math-library-empty">{search ? '没有找到匹配的作品' : deleted ? '没有已归档的作品' : '制作并保存后，你的作品会留在这里。'}</p>}
    </section>
  </div>;
}
