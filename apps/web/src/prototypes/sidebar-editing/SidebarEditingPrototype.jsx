// Three variants of the sidebar editing experience, switchable via ?variant=,
// mounted inside the existing workspace shell. PROTOTYPE: throw this code away.
import { useEffect, useMemo, useState } from 'react';
import './sidebarEditingPrototype.css';

const MODULES = [
  { id: 'classes', name: '我的班级', icon: '▦' },
  { id: 'timetable', name: '课程表', icon: '◷' },
  { id: 'planner', name: '规划器', icon: '◇' },
  { id: 'lessons', name: '课程', icon: '▤' },
  { id: 'students', name: '学生', icon: '◎' },
  { id: 'classwork', name: '课堂作业', icon: '✓' },
  { id: 'grades', name: '成绩', icon: '%' },
  { id: 'attendance', name: '出勤', icon: '☷' },
  { id: 'standards', name: '课程标准', icon: '⌁' }
];

const INITIAL_LAYOUT = {
  groups: [
    { id: 'classes-group', name: '班级', collapsed: false, moduleIds: ['classes', 'timetable', 'planner'] },
    { id: 'planning-group', name: '计划', collapsed: false, moduleIds: ['lessons', 'students', 'classwork'] },
    { id: 'assessment-group', name: '评估', collapsed: true, moduleIds: ['grades', 'attendance', 'standards'] }
  ],
  ungroupedModuleIds: [],
  hiddenModuleIds: ['standards']
};

const VARIANTS = {
  A: { name: '直接整理', summary: '日常侧栏就是编辑表面，拖拽最快，菜单补齐键盘与触摸路径。' },
  B: { name: '编辑模式', summary: '浏览时保持克制，进入编辑模式后集中暴露全部布局操作。' },
  C: { name: '导航编排器', summary: '侧栏只负责导航，复杂整理进入独立面板完成。' }
};

function cloneLayout(layout) {
  return {
    groups: layout.groups.map((group) => ({ ...group, moduleIds: [...group.moduleIds] })),
    ungroupedModuleIds: [...layout.ungroupedModuleIds],
    hiddenModuleIds: [...layout.hiddenModuleIds]
  };
}

function getContainer(layout, containerId) {
  return containerId === 'ungrouped'
    ? layout.ungroupedModuleIds
    : layout.groups.find((group) => group.id === containerId)?.moduleIds;
}

function findModuleContainer(layout, moduleId) {
  return layout.groups.find((group) => group.moduleIds.includes(moduleId))?.id || 'ungrouped';
}

function usePrototypeLayout() {
  const [layout, setLayout] = useState(() => cloneLayout(INITIAL_LAYOUT));
  const [lastAction, setLastAction] = useState('载入默认布局');

  function update(message, recipe) {
    setLayout((current) => {
      const next = cloneLayout(current);
      recipe(next);
      return next;
    });
    setLastAction(message);
  }

  return {
    layout,
    lastAction,
    reset() {
      setLayout(cloneLayout(INITIAL_LAYOUT));
      setLastAction('恢复原型默认布局');
    },
    toggleGroup(groupId) {
      update('切换分组折叠状态', (next) => {
        const group = next.groups.find((item) => item.id === groupId);
        if (group) group.collapsed = !group.collapsed;
      });
    },
    addGroup(name) {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      update(`新建分组“${trimmedName}”`, (next) => {
        next.groups.push({ id: `group-${Date.now()}`, name: trimmedName, collapsed: false, moduleIds: [] });
      });
    },
    renameGroup(groupId, name) {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      update(`重命名分组为“${trimmedName}”`, (next) => {
        const group = next.groups.find((item) => item.id === groupId);
        if (group) group.name = trimmedName;
      });
    },
    deleteGroup(groupId) {
      update('删除分组，模块移入未分组', (next) => {
        const group = next.groups.find((item) => item.id === groupId);
        if (!group) return;
        next.ungroupedModuleIds.push(...group.moduleIds);
        next.groups = next.groups.filter((item) => item.id !== groupId);
      });
    },
    moveGroup(groupId, offset) {
      update('调整分组顺序', (next) => {
        const index = next.groups.findIndex((group) => group.id === groupId);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= next.groups.length) return;
        [next.groups[index], next.groups[target]] = [next.groups[target], next.groups[index]];
      });
    },
    moveModule(moduleId, destinationId, targetModuleId = null) {
      update('移动模块', (next) => {
        next.groups.forEach((group) => {
          group.moduleIds = group.moduleIds.filter((id) => id !== moduleId);
        });
        next.ungroupedModuleIds = next.ungroupedModuleIds.filter((id) => id !== moduleId);
        const destination = getContainer(next, destinationId);
        if (!destination) return;
        const targetIndex = targetModuleId ? destination.indexOf(targetModuleId) : -1;
        destination.splice(targetIndex < 0 ? destination.length : targetIndex, 0, moduleId);
      });
    },
    moveModuleByOffset(moduleId, offset) {
      update('调整模块顺序', (next) => {
        const containerId = findModuleContainer(next, moduleId);
        const items = getContainer(next, containerId);
        const index = items.indexOf(moduleId);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= items.length) return;
        [items[index], items[target]] = [items[target], items[index]];
      });
    },
    setModuleHidden(moduleId, hidden) {
      update(hidden ? '隐藏模块' : '恢复模块', (next) => {
        next.hiddenModuleIds = hidden
          ? [...new Set([...next.hiddenModuleIds, moduleId])]
          : next.hiddenModuleIds.filter((id) => id !== moduleId);
      });
    }
  };
}

function IconButton({ label, children, className = '', ...props }) {
  return <button type="button" className={`proto-icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function Brand() {
  return (
    <div className="proto-brand" aria-label="TeachBuddy">
      <span className="proto-brand-mark">T</span>
      <strong>TeachBuddy</strong>
    </div>
  );
}

function ShellTopbar() {
  return (
    <header className="proto-topbar">
      <Brand />
      <nav className="proto-primary-nav" aria-label="全局导航">
        <button className="is-active">首页</button>
        <button>日历</button>
        <button>支持</button>
      </nav>
      <div className="proto-top-actions">
        <IconButton label="搜索">⌕</IconButton>
        <IconButton label="通知">♢</IconButton>
        <button className="proto-avatar" aria-label="打开账户菜单">林</button>
      </div>
    </header>
  );
}

function FixedSidebarHeader({ children }) {
  return (
    <>
      <button className="proto-account">
        <span className="proto-avatar small">林</span>
        <span><strong>林老师</strong><small>2026 秋季学期</small></span>
        <span aria-hidden="true">⌄</span>
      </button>
      <button className="proto-create-term">＋ 创建学期</button>
      {children}
    </>
  );
}

function CoreLinks() {
  return (
    <div className="proto-core-links">
      <button className="is-active"><span>⌂</span>首页</button>
      <button><span>▣</span>日历</button>
    </div>
  );
}

function ModuleRow({ moduleId, active = false, controls = null, draggable = false, onDragStart, onDrop }) {
  const moduleItem = MODULES.find((item) => item.id === moduleId);
  if (!moduleItem) return null;
  return (
    <div
      className={`proto-module-row ${active ? 'is-active' : ''} ${draggable ? 'is-draggable' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDrop ? (event) => event.preventDefault() : undefined}
      onDrop={onDrop}
    >
      {draggable && <span className="proto-grip" aria-hidden="true">⠿</span>}
      <span className="proto-module-icon" aria-hidden="true">{moduleItem.icon}</span>
      <span className="proto-module-name">{moduleItem.name}</span>
      {controls}
    </div>
  );
}

function CollapseButton({ group, onToggle }) {
  return (
    <button className="proto-collapse" type="button" onClick={() => onToggle(group.id)} aria-expanded={!group.collapsed}>
      <span>{group.name}</span>
      <span aria-hidden="true">{group.collapsed ? '›' : '⌄'}</span>
    </button>
  );
}

function HiddenTray({ layout, onRestore, compact = false }) {
  if (!layout.hiddenModuleIds.length) return null;
  return (
    <section className={`proto-hidden-tray ${compact ? 'is-compact' : ''}`}>
      <div>
        <strong>已隐藏</strong>
        <small>数据仍保留，恢复后回到原分组</small>
      </div>
      <div className="proto-hidden-items">
        {layout.hiddenModuleIds.map((moduleId) => {
          const moduleItem = MODULES.find((item) => item.id === moduleId);
          return <button key={moduleId} onClick={() => onRestore(moduleId)}>＋ {moduleItem?.name}</button>;
        })}
      </div>
    </section>
  );
}

function GroupMenu({ group, groupIndex, groupCount, actions, onClose }) {
  const [name, setName] = useState(group.name);
  return (
    <div className="proto-popover" role="dialog" aria-label={`编辑分组 ${group.name}`}>
      <label>
        <span>分组名称</span>
        <input name={`group-${group.id}-name`} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button onClick={() => { actions.renameGroup(group.id, name); onClose(); }}>保存名称</button>
      <div className="proto-inline-actions">
        <button disabled={groupIndex === 0} onClick={() => actions.moveGroup(group.id, -1)}>上移</button>
        <button disabled={groupIndex === groupCount - 1} onClick={() => actions.moveGroup(group.id, 1)}>下移</button>
      </div>
      <button className="is-danger" onClick={() => actions.deleteGroup(group.id)}>删除分组</button>
    </div>
  );
}

function ModuleMenu({ moduleId, layout, actions, onClose }) {
  const containerId = findModuleContainer(layout, moduleId);
  return (
    <div className="proto-popover proto-module-popover" role="dialog" aria-label="模块操作">
      <label>
        <span>移动到</span>
        <select name={`module-${moduleId}-destination`} value={containerId} onChange={(event) => actions.moveModule(moduleId, event.target.value)}>
          {layout.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
          <option value="ungrouped">未分组</option>
        </select>
      </label>
      <div className="proto-inline-actions">
        <button onClick={() => actions.moveModuleByOffset(moduleId, -1)}>上移</button>
        <button onClick={() => actions.moveModuleByOffset(moduleId, 1)}>下移</button>
      </div>
      <button onClick={() => { actions.setModuleHidden(moduleId, true); onClose(); }}>从侧栏隐藏</button>
      <button onClick={onClose}>完成</button>
    </div>
  );
}

function DirectVariant({ model }) {
  const { layout } = model;
  const [openGroupMenu, setOpenGroupMenu] = useState(null);
  const [openModuleMenu, setOpenModuleMenu] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [dragged, setDragged] = useState(null);
  const hidden = new Set(layout.hiddenModuleIds);

  function submitGroup(event) {
    event.preventDefault();
    model.addGroup(newGroup);
    setNewGroup('');
    setAdding(false);
  }

  return (
    <aside className="proto-sidebar variant-direct">
      <FixedSidebarHeader><CoreLinks /></FixedSidebarHeader>
      <div className="proto-sidebar-title">
        <span>我的工作台</span>
        <IconButton label="新建分组" onClick={() => setAdding((value) => !value)}>＋</IconButton>
      </div>
      {adding && (
        <form className="proto-inline-create" onSubmit={submitGroup}>
          <input autoFocus name="direct-new-group" aria-label="新分组名称" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="分组名称" />
          <button>创建</button>
        </form>
      )}
      <div className="proto-groups-scroll">
        {layout.groups.map((group, groupIndex) => (
          <section
            className="proto-nav-group proto-drop-zone"
            key={group.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragged?.type === 'module') model.moveModule(dragged.id, group.id);
              if (dragged?.type === 'group') model.moveGroup(dragged.id, groupIndex - layout.groups.findIndex((item) => item.id === dragged.id));
              setDragged(null);
            }}
          >
            <div className="proto-group-heading">
              <span className="proto-grip group-grip" draggable onDragStart={() => setDragged({ type: 'group', id: group.id })}>⠿</span>
              <CollapseButton group={group} onToggle={model.toggleGroup} />
              <IconButton label={`编辑分组 ${group.name}`} onClick={() => setOpenGroupMenu(openGroupMenu === group.id ? null : group.id)}>•••</IconButton>
              {openGroupMenu === group.id && (
                <GroupMenu group={group} groupIndex={groupIndex} groupCount={layout.groups.length} actions={model} onClose={() => setOpenGroupMenu(null)} />
              )}
            </div>
            {!group.collapsed && group.moduleIds.filter((id) => !hidden.has(id)).map((moduleId) => (
              <div className="proto-module-wrap" key={moduleId}>
                <ModuleRow
                  moduleId={moduleId}
                  active={moduleId === 'classes'}
                  draggable
                  onDragStart={() => setDragged({ type: 'module', id: moduleId })}
                  onDrop={(event) => {
                    event.stopPropagation();
                    if (dragged?.type === 'module') model.moveModule(dragged.id, group.id, moduleId);
                    setDragged(null);
                  }}
                  controls={<IconButton label="调整模块" onClick={() => setOpenModuleMenu(openModuleMenu === moduleId ? null : moduleId)}>•••</IconButton>}
                />
                {openModuleMenu === moduleId && (
                  <ModuleMenu moduleId={moduleId} layout={layout} actions={model} onClose={() => setOpenModuleMenu(null)} />
                )}
              </div>
            ))}
          </section>
        ))}
        <section className="proto-nav-group proto-ungrouped">
          <div className="proto-group-heading"><strong>未分组</strong><span className="proto-lock">固定</span></div>
          {layout.ungroupedModuleIds.filter((id) => !hidden.has(id)).map((moduleId) => <ModuleRow key={moduleId} moduleId={moduleId} />)}
        </section>
        <HiddenTray layout={layout} onRestore={(id) => model.setModuleHidden(id, false)} compact />
      </div>
      <p className="proto-sidebar-hint">拖动把手快速整理，••• 提供键盘与触摸替代。</p>
    </aside>
  );
}

function EditModeVariant({ model }) {
  const { layout } = model;
  const [editing, setEditing] = useState(true);
  const [newGroup, setNewGroup] = useState('');
  const hidden = new Set(layout.hiddenModuleIds);

  return (
    <aside className={`proto-sidebar variant-edit ${editing ? 'is-editing' : ''}`}>
      <FixedSidebarHeader><CoreLinks /></FixedSidebarHeader>
      <div className="proto-sidebar-title edit-title">
        <div><span>我的工作台</span>{editing && <small>编辑模式</small>}</div>
        <button className={editing ? 'proto-done-button' : 'proto-edit-button'} onClick={() => setEditing((value) => !value)}>{editing ? '完成' : '编辑导航'}</button>
      </div>
      <div className="proto-groups-scroll">
        {layout.groups.map((group, groupIndex) => (
          <section className="proto-nav-group proto-edit-group" key={group.id}>
            {editing ? (
              <div className="proto-edit-group-heading">
                <span className="proto-grip">⠿</span>
                <input name={`edit-group-${group.id}`} aria-label={`重命名 ${group.name}`} value={group.name} onChange={(event) => model.renameGroup(group.id, event.target.value)} />
                <IconButton label="上移分组" disabled={groupIndex === 0} onClick={() => model.moveGroup(group.id, -1)}>↑</IconButton>
                <IconButton label="下移分组" disabled={groupIndex === layout.groups.length - 1} onClick={() => model.moveGroup(group.id, 1)}>↓</IconButton>
                <IconButton label="删除分组" onClick={() => model.deleteGroup(group.id)}>×</IconButton>
              </div>
            ) : <CollapseButton group={group} onToggle={model.toggleGroup} />}
            {(!group.collapsed || editing) && group.moduleIds.filter((id) => !hidden.has(id)).map((moduleId) => (
              <ModuleRow
                key={moduleId}
                moduleId={moduleId}
                active={!editing && moduleId === 'classes'}
                controls={editing ? (
                  <div className="proto-row-controls">
                    <select name={`edit-module-${moduleId}-destination`} aria-label="移动模块到分组" value={group.id} onChange={(event) => model.moveModule(moduleId, event.target.value)}>
                      {layout.groups.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}
                      <option value="ungrouped">未分组</option>
                    </select>
                    <IconButton label="上移模块" onClick={() => model.moveModuleByOffset(moduleId, -1)}>↑</IconButton>
                    <IconButton label="下移模块" onClick={() => model.moveModuleByOffset(moduleId, 1)}>↓</IconButton>
                    <IconButton label="隐藏模块" onClick={() => model.setModuleHidden(moduleId, true)}>−</IconButton>
                  </div>
                ) : null}
              />
            ))}
          </section>
        ))}
        {editing && (
          <>
            <form className="proto-add-group-row" onSubmit={(event) => { event.preventDefault(); model.addGroup(newGroup); setNewGroup(''); }}>
              <input name="edit-new-group" aria-label="新分组名称" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="新分组名称" />
              <button>＋ 添加</button>
            </form>
            <HiddenTray layout={layout} onRestore={(id) => model.setModuleHidden(id, false)} compact />
          </>
        )}
      </div>
      {editing && <p className="proto-sidebar-hint">触摸与键盘可直接使用箭头和分组菜单，不依赖拖拽。</p>}
    </aside>
  );
}

function CleanSidebar({ model, onOpenComposer }) {
  const hidden = new Set(model.layout.hiddenModuleIds);
  return (
    <aside className="proto-sidebar variant-clean">
      <FixedSidebarHeader><CoreLinks /></FixedSidebarHeader>
      <div className="proto-sidebar-title"><span>我的工作台</span></div>
      <div className="proto-groups-scroll">
        {model.layout.groups.map((group) => (
          <section className="proto-nav-group" key={group.id}>
            <CollapseButton group={group} onToggle={model.toggleGroup} />
            {!group.collapsed && group.moduleIds.filter((id) => !hidden.has(id)).map((moduleId) => (
              <ModuleRow key={moduleId} moduleId={moduleId} active={moduleId === 'classes'} />
            ))}
          </section>
        ))}
      </div>
      <button className="proto-organize-button" onClick={onOpenComposer}>⚙ 组织模块与导航</button>
    </aside>
  );
}

function Composer({ model, onClose }) {
  const [selectedGroupId, setSelectedGroupId] = useState(model.layout.groups[0]?.id || 'ungrouped');
  const [newGroup, setNewGroup] = useState('');
  const selectedGroup = model.layout.groups.find((group) => group.id === selectedGroupId);
  const selectedIds = selectedGroup ? selectedGroup.moduleIds : model.layout.ungroupedModuleIds;
  const hidden = new Set(model.layout.hiddenModuleIds);

  useEffect(() => {
    if (selectedGroupId !== 'ungrouped' && !model.layout.groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(model.layout.groups[0]?.id || 'ungrouped');
    }
  }, [model.layout.groups, selectedGroupId]);

  return (
    <section className="proto-composer" aria-label="导航编排器">
      <header className="proto-composer-header">
        <div><span className="proto-kicker">导航编排器</span><h2>组织模块与分组</h2><p>改动仅影响导航展示，不会删除模块数据。</p></div>
        <button className="proto-close-composer" onClick={onClose}>完成</button>
      </header>
      <div className="proto-composer-body">
        <aside className="proto-outline-panel">
          <h3>分组顺序</h3>
          {model.layout.groups.map((group) => (
            <div className={`proto-outline-row ${selectedGroupId === group.id ? 'is-selected' : ''}`} key={group.id}>
              <button className="proto-outline-select" onClick={() => setSelectedGroupId(group.id)}>
                <span>⠿</span><span>{group.name}<small>{group.moduleIds.length} 个模块</small></span>
              </button>
              <span className="proto-mini-arrows">
                <button type="button" onClick={() => model.moveGroup(group.id, -1)} aria-label={`上移分组 ${group.name}`}>↑</button>
                <button type="button" onClick={() => model.moveGroup(group.id, 1)} aria-label={`下移分组 ${group.name}`}>↓</button>
              </span>
            </div>
          ))}
          <button className={`proto-ungrouped-select ${selectedGroupId === 'ungrouped' ? 'is-selected' : ''}`} onClick={() => setSelectedGroupId('ungrouped')}><span>◫</span><span>未分组<small>固定安全落点</small></span></button>
          <form onSubmit={(event) => { event.preventDefault(); model.addGroup(newGroup); setNewGroup(''); }}>
            <input name="composer-new-group" aria-label="新分组名称" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="新分组名称" />
            <button>＋</button>
          </form>
        </aside>
        <main className="proto-detail-panel">
          <div className="proto-detail-title">
            {selectedGroup ? (
              <input name={`composer-group-${selectedGroup.id}`} value={selectedGroup.name} aria-label="分组名称" onChange={(event) => model.renameGroup(selectedGroup.id, event.target.value)} />
            ) : <h3>未分组</h3>}
            {selectedGroup && <button className="is-danger" onClick={() => model.deleteGroup(selectedGroup.id)}>删除分组</button>}
          </div>
          <p className="proto-detail-help">使用箭头调整顺序，或从菜单移动到其他分组。此路径适合键盘、触摸和窄屏。</p>
          <div className="proto-composer-modules">
            {selectedIds.filter((id) => !hidden.has(id)).map((moduleId) => (
              <ModuleRow
                key={moduleId}
                moduleId={moduleId}
                controls={(
                  <div className="proto-row-controls">
                    <IconButton label="上移" onClick={() => model.moveModuleByOffset(moduleId, -1)}>↑</IconButton>
                    <IconButton label="下移" onClick={() => model.moveModuleByOffset(moduleId, 1)}>↓</IconButton>
                    <select name={`composer-module-${moduleId}-destination`} aria-label="移动到分组" value={selectedGroupId} onChange={(event) => model.moveModule(moduleId, event.target.value)}>
                      {model.layout.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
                      <option value="ungrouped">未分组</option>
                    </select>
                    <button className="proto-hide-button" onClick={() => model.setModuleHidden(moduleId, true)}>隐藏</button>
                  </div>
                )}
              />
            ))}
            {!selectedIds.filter((id) => !hidden.has(id)).length && <div className="proto-empty">此分组没有可见模块</div>}
          </div>
          <HiddenTray layout={model.layout} onRestore={(id) => model.setModuleHidden(id, false)} />
        </main>
      </div>
    </section>
  );
}

function WorkspaceCanvas({ variant, model, composerOpen, setComposerOpen }) {
  return (
    <main className="proto-workspace">
      <div className="proto-page-heading">
        <div><span className="proto-kicker">2026 秋季学期</span><h1>早上好，林老师</h1><p>这是一个临时交互原型。请尝试折叠、移动、隐藏和恢复模块。</p></div>
        <button className="proto-secondary-button" onClick={model.reset}>重置原型</button>
      </div>
      <div className="proto-dashboard-grid">
        <section className="proto-welcome-card"><span>星期五 · 9 月 18 日</span><h2>今天有 3 节课</h2><p>下一节：八年级数学 · 10:20</p><button>查看今日安排</button></section>
        <section className="proto-card"><header><h3>今日日程</h3><button>查看全部</button></header><div className="proto-schedule"><b>10:20</b><span>八年级数学<small>教学楼 A203</small></span></div><div className="proto-schedule"><b>14:00</b><span>教研会议<small>第三会议室</small></span></div></section>
        <section className="proto-card proto-state-card"><header><h3>当前原型状态</h3><span>仅内存</span></header><dl><div><dt>方案</dt><dd>{variant} · {VARIANTS[variant].name}</dd></div><div><dt>最近操作</dt><dd>{model.lastAction}</dd></div><div><dt>分组</dt><dd>{model.layout.groups.map((group) => group.name).join(' / ')}</dd></div><div><dt>隐藏模块</dt><dd>{model.layout.hiddenModuleIds.map((id) => MODULES.find((item) => item.id === id)?.name).join('、') || '无'}</dd></div></dl></section>
      </div>
      {variant === 'C' && !composerOpen && <button className="proto-open-composer-callout" onClick={() => setComposerOpen(true)}>打开导航编排器</button>}
      {variant === 'C' && composerOpen && <Composer model={model} onClose={() => setComposerOpen(false)} />}
    </main>
  );
}

function PrototypeSwitcher({ variant, onChange }) {
  const keys = Object.keys(VARIANTS);
  function cycle(offset) {
    const index = keys.indexOf(variant);
    onChange(keys[(index + offset + keys.length) % keys.length]);
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key === 'ArrowLeft') cycle(-1);
      if (event.key === 'ArrowRight') cycle(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="proto-switcher" aria-label="原型方案切换器">
      <button onClick={() => cycle(-1)} aria-label="上一个方案">←</button>
      <div><strong>{variant} · {VARIANTS[variant].name}</strong><span>{VARIANTS[variant].summary}</span></div>
      <button onClick={() => cycle(1)} aria-label="下一个方案">→</button>
    </div>
  );
}

export default function SidebarEditingPrototype() {
  const [variant, setVariant] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
    return VARIANTS[requested] ? requested : 'A';
  });
  const [composerOpen, setComposerOpen] = useState(true);
  const model = usePrototypeLayout();

  useEffect(() => {
    document.title = `TeachBuddy 侧栏原型 · ${variant}`;
  }, [variant]);

  function changeVariant(nextVariant) {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', nextVariant);
    window.history.replaceState({}, '', url);
    setVariant(nextVariant);
    setComposerOpen(true);
  }

  const sidebar = useMemo(() => {
    if (variant === 'A') return <DirectVariant model={model} />;
    if (variant === 'B') return <EditModeVariant model={model} />;
    return <CleanSidebar model={model} onOpenComposer={() => setComposerOpen(true)} />;
  }, [variant, model.layout, model.lastAction]);

  return (
    <div className={`sidebar-prototype variant-${variant.toLowerCase()}`}>
      <ShellTopbar />
      <div className="proto-shell-body">
        {sidebar}
        <WorkspaceCanvas variant={variant} model={model} composerOpen={composerOpen} setComposerOpen={setComposerOpen} />
      </div>
      <nav className="proto-mobile-nav" aria-label="移动端导航"><button>⌂<span>首页</span></button><button>▣<span>日历</span></button><button className="is-active">☰<span>工作台</span></button></nav>
      <PrototypeSwitcher variant={variant} onChange={changeVariant} />
    </div>
  );
}
