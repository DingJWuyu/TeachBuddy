// High-fidelity interaction prototype for TeachBuddy sidebar organization.
// PROTOTYPE: memory-only state, no production persistence or API calls.
import { useCallback, useEffect, useRef, useState } from 'react';
import './sidebarEditingPrototype.css';

const MODULES = [
  { id: 'classes', name: '我的班级', icon: 'classes' },
  { id: 'timetable', name: '课程表', icon: 'calendar' },
  { id: 'planner', name: '规划器', icon: 'planner' },
  { id: 'lessons', name: '课程', icon: 'lessons' },
  { id: 'students', name: '学生', icon: 'students' },
  { id: 'classwork', name: '课堂作业', icon: 'classwork' },
  { id: 'grades', name: '成绩', icon: 'grades' },
  { id: 'attendance', name: '出勤', icon: 'attendance' },
  { id: 'standards', name: '课程标准', icon: 'standards' }
];

const INITIAL_LAYOUT = {
  groups: [
    { id: 'classes-group', name: '班级', collapsed: false, fixed: false, moduleIds: ['classes', 'timetable', 'planner'] },
    { id: 'planning-group', name: '计划', collapsed: false, fixed: false, moduleIds: ['lessons', 'students', 'classwork'] },
    { id: 'assessment-group', name: '评估', collapsed: false, fixed: false, moduleIds: ['grades', 'attendance', 'standards'] },
    { id: 'ungrouped', name: '未分组', collapsed: false, fixed: true, moduleIds: [] }
  ],
  hiddenModuleIds: []
};

const ICON_PATHS = {
  classes: <><path d="M4 6.5h16v12H4z"/><path d="M8 6.5v12M16 6.5v12M4 10.5h16"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9h17"/></>,
  planner: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  lessons: <><path d="M4 5.5c3-1.6 5.6-1.6 8 0v14c-2.4-1.6-5-1.6-8 0z"/><path d="M20 5.5c-3-1.6-5.6-1.6-8 0v14c2.4-1.6 5-1.6 8 0z"/></>,
  students: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M14 14c3-.5 5 .9 5.8 4"/></>,
  classwork: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l2 2 5-5M8 15h8"/></>,
  grades: <><path d="M5 19L19 5M7 6h.01M17 18h.01"/><circle cx="7" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/></>,
  attendance: <><path d="M5 4h14v16H5zM8 8h8M8 12h4"/><path d="M14 16l1.5 1.5L19 14"/></>,
  standards: <><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></>,
  feedback: <><path d="M4 5h16v12H8l-4 3z"/><path d="M8 9h8M8 13h5"/></>,
  tutorial: <><path d="M4 6h16v12H4z"/><path d="M10 9l5 3-5 3z"/></>,
  shield: <><path d="M12 3l7 3v5c0 4.6-2.4 7.8-7 10-4.6-2.2-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-5"/></>,
  language: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  trash: <><path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  chevron: <path d="M8 10l4 4 4-4"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="M6 6l12 12M18 6L6 18"/>
};

function Icon({ name, size = 18 }) {
  return (
    <svg className="tb-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

function cloneLayout(layout) {
  return {
    groups: layout.groups.map((group) => ({ ...group, moduleIds: [...group.moduleIds] })),
    hiddenModuleIds: [...layout.hiddenModuleIds]
  };
}

function moduleById(moduleId) {
  return MODULES.find((moduleItem) => moduleItem.id === moduleId);
}

function removeModule(groups, moduleId) {
  groups.forEach((group) => {
    group.moduleIds = group.moduleIds.filter((id) => id !== moduleId);
  });
}

function readDragPayload(event) {
  try {
    return JSON.parse(event.dataTransfer.getData('text/plain'));
  } catch {
    return null;
  }
}

function useLayoutModel() {
  const [layout, setLayout] = useState(() => cloneLayout(INITIAL_LAYOUT));
  const [announcement, setAnnouncement] = useState('工作台布局已载入');

  function update(message, recipe) {
    setLayout((current) => {
      const next = cloneLayout(current);
      recipe(next);
      return next;
    });
    setAnnouncement(message);
  }

  return {
    layout,
    announcement,
    reset() {
      setLayout(cloneLayout(INITIAL_LAYOUT));
      setAnnouncement('已恢复原型默认布局');
    },
    toggleGroup(groupId) {
      update('已切换分组展开状态', (next) => {
        const group = next.groups.find((item) => item.id === groupId);
        if (group) group.collapsed = !group.collapsed;
      });
    },
    createGroup(name) {
      const trimmedName = name.trim();
      if (!trimmedName) return false;
      update(`已创建分组 ${trimmedName}`, (next) => {
        const ungroupedIndex = next.groups.findIndex((group) => group.fixed);
        next.groups.splice(ungroupedIndex, 0, {
          id: `group-${Date.now()}`,
          name: trimmedName,
          collapsed: false,
          fixed: false,
          moduleIds: []
        });
      });
      return true;
    },
    renameGroup(groupId, name) {
      const trimmedName = name.trim();
      if (!trimmedName) return false;
      update(`分组已重命名为 ${trimmedName}`, (next) => {
        const group = next.groups.find((item) => item.id === groupId && !item.fixed);
        if (group) group.name = trimmedName;
      });
      return true;
    },
    deleteGroup(groupId) {
      update('分组已删除，原有模块已移到未分组', (next) => {
        const group = next.groups.find((item) => item.id === groupId && !item.fixed);
        const ungrouped = next.groups.find((item) => item.fixed);
        if (!group || !ungrouped) return;
        ungrouped.moduleIds.push(...group.moduleIds.filter((id) => !ungrouped.moduleIds.includes(id)));
        next.groups = next.groups.filter((item) => item.id !== groupId);
      });
    },
    moveGroup(sourceId, targetId) {
      if (sourceId === targetId) return;
      update('分组顺序已调整', (next) => {
        const sourceIndex = next.groups.findIndex((group) => group.id === sourceId && !group.fixed);
        const targetIndex = next.groups.findIndex((group) => group.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [source] = next.groups.splice(sourceIndex, 1);
        const nextTargetIndex = next.groups.findIndex((group) => group.id === targetId);
        next.groups.splice(nextTargetIndex < 0 ? next.groups.length - 1 : nextTargetIndex, 0, source);
      });
    },
    moveModule(moduleId, destinationGroupId, targetModuleId = null) {
      update(`${moduleById(moduleId)?.name || '模块'}已移动`, (next) => {
        removeModule(next.groups, moduleId);
        const destination = next.groups.find((group) => group.id === destinationGroupId);
        if (!destination) return;
        const targetIndex = targetModuleId ? destination.moduleIds.indexOf(targetModuleId) : -1;
        destination.moduleIds.splice(targetIndex < 0 ? destination.moduleIds.length : targetIndex, 0, moduleId);
      });
    },
    moveModuleByKeyboard(moduleId, direction) {
      update(`${moduleById(moduleId)?.name || '模块'}已移动`, (next) => {
        const groupIndex = next.groups.findIndex((group) => group.moduleIds.includes(moduleId));
        if (groupIndex < 0) return;
        const group = next.groups[groupIndex];
        const moduleIndex = group.moduleIds.indexOf(moduleId);
        if (direction === 'up' || direction === 'down') {
          const offset = direction === 'up' ? -1 : 1;
          const targetIndex = moduleIndex + offset;
          if (targetIndex < 0 || targetIndex >= group.moduleIds.length) return;
          [group.moduleIds[moduleIndex], group.moduleIds[targetIndex]] = [group.moduleIds[targetIndex], group.moduleIds[moduleIndex]];
          return;
        }
        const groupOffset = direction === 'left' ? -1 : 1;
        const destination = next.groups[groupIndex + groupOffset];
        if (!destination) return;
        group.moduleIds.splice(moduleIndex, 1);
        destination.moduleIds.push(moduleId);
      });
    },
    hideModule(moduleId) {
      update(`${moduleById(moduleId)?.name || '模块'}已隐藏`, (next) => {
        if (!next.hiddenModuleIds.includes(moduleId)) next.hiddenModuleIds.push(moduleId);
      });
    },
    restoreModule(moduleId) {
      update(`${moduleById(moduleId)?.name || '模块'}已恢复`, (next) => {
        next.hiddenModuleIds = next.hiddenModuleIds.filter((id) => id !== moduleId);
      });
    }
  };
}

function useNarrowLayout() {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 700px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 700px)');
    function handleChange(event) {
      setIsNarrow(event.matches);
    }
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isNarrow;
}

function Topbar({ onOpenMobileSidebar }) {
  return (
    <header className="tb-topbar">
      <div className="tb-brand-slot">
        <button className="tb-mobile-menu" onClick={onOpenMobileSidebar} aria-label="打开工作台导航"><Icon name="menu" /></button>
        <span className="tb-brand-mark">T</span>
        <strong>TeachBuddy</strong>
      </div>
      <nav className="tb-global-nav" aria-label="全局导航">
        <button className="is-current">首页</button>
        <button>日历</button>
        <button>支持</button>
      </nav>
      <div className="tb-top-actions">
        <button aria-label="搜索"><Icon name="search" /></button>
        <button aria-label="反馈"><Icon name="feedback" /></button>
        <button className="tb-tutorial" aria-label="教程进度"><Icon name="tutorial" /><span>3</span></button>
        <button aria-label="Privacy & Security"><Icon name="shield" /></button>
        <button className="tb-avatar" aria-label="账户菜单">林</button>
      </div>
    </header>
  );
}

function ContextMenu({ position, onRename, onDelete, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    menuRef.current?.querySelector('button')?.focus();
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) onClose();
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} className="tb-context-menu" role="menu" style={{ left: position.x, top: position.y }}>
      <button role="menuitem" onClick={onRename}>重命名分组</button>
      <button role="menuitem" className="is-danger" onClick={onDelete}>
        <span>删除分组</span><small>模块将移到未分组</small>
      </button>
    </div>
  );
}

function NewGroupForm({ onCreate, onClose }) {
  const formRef = useRef(null);
  const [name, setName] = useState('');

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
    function handlePointerDown(event) {
      if (!formRef.current?.contains(event.target) && !event.target.closest('[data-new-group-toggle]')) onClose();
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <form
      ref={formRef}
      className="tb-new-group-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (onCreate(name)) onClose();
      }}
    >
      <input name="new-group-name" aria-label="新分组名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="输入分组名称" />
      <span>按 Enter 创建</span>
    </form>
  );
}

function HiddenModules({ model, open, onToggle, dragState, onDragEnter, onDragLeave, onDrop }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!panelRef.current?.contains(event.target) && !event.target.closest('[data-trash-toggle]')) onToggle(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onToggle(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onToggle]);

  return (
    <div className="tb-trash-wrap" ref={panelRef}>
      <button
        type="button"
        data-trash-toggle
        className={`tb-trash-target ${dragState?.type === 'module' ? 'is-ready' : ''}`}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          if (dragState?.type === 'module') event.preventDefault();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Icon name="trash" />
        <span>{dragState?.type === 'module' ? '拖到这里隐藏' : '已隐藏'}</span>
        {model.layout.hiddenModuleIds.length > 0 && <b>{model.layout.hiddenModuleIds.length}</b>}
      </button>
      {open && (
        <div className="tb-hidden-panel">
          <div className="tb-hidden-panel-title"><strong>已隐藏模块</strong><span>点击即可恢复</span></div>
          {model.layout.hiddenModuleIds.length ? model.layout.hiddenModuleIds.map((moduleId) => {
            const moduleItem = moduleById(moduleId);
            return (
              <button key={moduleId} onClick={() => model.restoreModule(moduleId)}>
                <span className="tb-module-icon"><Icon name={moduleItem.icon} /></span>
                <span>{moduleItem.name}</span>
                <Icon name="plus" size={15} />
              </button>
            );
          }) : <p>没有隐藏的模块</p>}
        </div>
      )}
    </div>
  );
}

function Sidebar({ model, mobileOpen, onCloseMobile, isNarrow }) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingGroupId, setRenamingGroupId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dragState, setDragState] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const longPressTimerRef = useRef(null);
  const mobileCloseRef = useRef(null);
  const hidden = new Set(model.layout.hiddenModuleIds);

  useEffect(() => {
    if (!isNarrow || !mobileOpen) return undefined;
    mobileCloseRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCloseMobile();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isNarrow, mobileOpen, onCloseMobile]);

  function beginRename(group) {
    setContextMenu(null);
    setRenamingGroupId(group.id);
    setRenameDraft(group.name);
  }

  function commitRename(groupId) {
    if (model.renameGroup(groupId, renameDraft)) setRenamingGroupId(null);
  }

  function openContextMenu(event, group) {
    if (group.fixed) return;
    event.preventDefault();
    setContextMenu({
      group,
      position: {
        x: Math.min(event.clientX || 24, window.innerWidth - 220),
        y: Math.min(event.clientY || 80, window.innerHeight - 150)
      }
    });
  }

  function startLongPress(event, group) {
    if (event.pointerType === 'mouse' || group.fixed) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => openContextMenu(event, group), 480);
  }

  function clearLongPress() {
    window.clearTimeout(longPressTimerRef.current);
  }

  function startDrag(event, payload) {
    setDragState(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function finishDrag() {
    setDragState(null);
    setDragTarget(null);
  }

  function dropOnGroup(event, groupId) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragState || readDragPayload(event);
    if (payload?.type === 'module') model.moveModule(payload.id, groupId);
    if (payload?.type === 'group') model.moveGroup(payload.id, groupId);
    finishDrag();
  }

  function dropOnModule(event, groupId, moduleId) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragState || readDragPayload(event);
    if (payload?.type === 'module') model.moveModule(payload.id, groupId, moduleId);
    finishDrag();
  }

  function handleModuleKeyDown(event, moduleId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      model.hideModule(moduleId);
      return;
    }
    if (!event.altKey) return;
    const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (directions[event.key]) {
      event.preventDefault();
      model.moveModuleByKeyboard(moduleId, directions[event.key]);
    }
  }

  return (
    <>
      <button hidden={!mobileOpen} aria-hidden={!mobileOpen} className={`tb-mobile-scrim ${mobileOpen ? 'is-visible' : ''}`} aria-label="关闭工作台导航" onClick={onCloseMobile} />
      <aside
        className={`tb-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}
        aria-label="工作台导航"
        aria-hidden={isNarrow && !mobileOpen ? true : undefined}
        inert={isNarrow && !mobileOpen ? true : undefined}
      >
        <div className="tb-sidebar-mobile-head"><strong>工作台</strong><button ref={mobileCloseRef} onClick={onCloseMobile} aria-label="关闭"><Icon name="close" /></button></div>
        <button className="tb-account-row">
          <span className="tb-avatar">林</span>
          <span><strong>林老师</strong><small>2026 秋季学期</small></span>
          <Icon name="chevron" size={15} />
        </button>
        <button className="tb-language-row"><Icon name="language" /><span>简体中文</span></button>
        <button className="tb-term-button"><Icon name="plus" size={16} /><span>创建学期</span></button>

        <div className="tb-workspace-heading">
          <strong>工作台</strong>
          <button
            type="button"
            data-new-group-toggle
            aria-label={addingGroup ? '关闭新建分组' : '新建分组'}
            aria-expanded={addingGroup}
            onClick={() => setAddingGroup((current) => !current)}
          >
            <Icon name={addingGroup ? 'minus' : 'plus'} size={16} />
          </button>
        </div>
        {addingGroup && <NewGroupForm onCreate={model.createGroup} onClose={() => setAddingGroup(false)} />}

        <nav className="tb-module-nav" aria-label="功能模块">
          {model.layout.groups.map((group) => (
            <section
              className={`tb-group ${dragTarget === `group:${group.id}` ? 'is-drop-target' : ''}`}
              data-drop-group={group.id}
              key={group.id}
              onDragEnter={() => setDragTarget(`group:${group.id}`)}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragTarget(null);
              }}
              onDrop={(event) => dropOnGroup(event, group.id)}
            >
              <div
                className={`tb-group-heading ${dragState?.type === 'group' && dragState.id === group.id ? 'is-dragging' : ''}`}
                draggable={!group.fixed && renamingGroupId !== group.id}
                onDragStart={(event) => startDrag(event, { type: 'group', id: group.id })}
                onDragEnd={finishDrag}
                onContextMenu={(event) => openContextMenu(event, group)}
                onPointerDown={(event) => startLongPress(event, group)}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerMove={clearLongPress}
              >
                {renamingGroupId === group.id ? (
                  <input
                    autoFocus
                    className="tb-group-rename"
                    name={`rename-${group.id}`}
                    aria-label={`重命名分组 ${group.name}`}
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => commitRename(group.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename(group.id);
                      if (event.key === 'Escape') setRenamingGroupId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="tb-group-toggle"
                    aria-expanded={!group.collapsed}
                    onClick={() => model.toggleGroup(group.id)}
                    onKeyDown={(event) => {
                      if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') openContextMenu(event, group);
                    }}
                  >
                    <span>{group.name}</span>
                    <Icon name="chevron" size={13} />
                  </button>
                )}
              </div>
              {!group.collapsed && (
                <div className="tb-module-list">
                  {group.moduleIds.filter((moduleId) => !hidden.has(moduleId)).map((moduleId) => {
                    const moduleItem = moduleById(moduleId);
                    return (
                      <div
                        key={moduleId}
                        className={`tb-module-row ${moduleId === 'classes' ? 'is-active' : ''} ${dragState?.type === 'module' && dragState.id === moduleId ? 'is-dragging' : ''} ${dragTarget === `module:${moduleId}` ? 'is-drop-target' : ''}`}
                        data-drop-module={moduleId}
                        role="button"
                        tabIndex={0}
                        draggable
                        aria-label={`${moduleItem.name}。可拖动；Alt 加方向键移动；Delete 隐藏`}
                        onKeyDown={(event) => handleModuleKeyDown(event, moduleId)}
                        onDragStart={(event) => startDrag(event, { type: 'module', id: moduleId })}
                        onDragEnd={finishDrag}
                        onDragEnter={() => setDragTarget(`module:${moduleId}`)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => dropOnModule(event, group.id, moduleId)}
                      >
                        <span className="tb-module-icon"><Icon name={moduleItem.icon} /></span>
                        <span>{moduleItem.name}</span>
                      </div>
                    );
                  })}
                  {!group.moduleIds.filter((moduleId) => !hidden.has(moduleId)).length && dragState?.type === 'module' && <div className="tb-empty-group">放在这里</div>}
                </div>
              )}
            </section>
          ))}
          <HiddenModules
            model={model}
            open={hiddenOpen}
            onToggle={setHiddenOpen}
            dragState={dragState}
            onDragEnter={() => dragState?.type === 'module' && setDragTarget('trash')}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(event) => {
              event.preventDefault();
              const payload = dragState || readDragPayload(event);
              if (payload?.type === 'module') model.hideModule(payload.id);
              finishDrag();
            }}
          />
        </nav>

        <div className="tb-sidebar-footer">
          <button>设置</button>
        </div>

        {contextMenu && (
          <ContextMenu
            position={contextMenu.position}
            onRename={() => beginRename(contextMenu.group)}
            onDelete={() => {
              model.deleteGroup(contextMenu.group.id);
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}
      </aside>
    </>
  );
}

function MiniCalendar() {
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const dates = [31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4];
  return (
    <section className="tb-card tb-calendar-card">
      <header><div><span>九月</span><strong>2026</strong></div><div><button aria-label="上个月">‹</button><button aria-label="下个月">›</button></div></header>
      <div className="tb-calendar-grid">
        {days.map((day) => <span className="tb-weekday" key={day}>{day}</span>)}
        {dates.map((date, index) => <button className={`${index === 18 ? 'is-today' : ''} ${index === 0 || index > 30 ? 'is-outside' : ''}`} key={`${date}-${index}`}>{date}</button>)}
      </div>
    </section>
  );
}

function Dashboard() {
  return (
    <main className="tb-main">
      <div className="tb-dashboard-grid">
        <div className="tb-dashboard-left">
          <section className="tb-card tb-welcome-card">
            <div><span className="tb-card-kicker">星期五 · 9 月 18 日</span><h1>早上好，林老师</h1><p>今天有 3 节课，下一节在 10:20 开始。</p></div>
            <div className="tb-welcome-orbit"><span /><span /><span /></div>
          </section>
          <section className="tb-card tb-lessons-card">
            <header><h2>本周课程</h2><button>查看全部</button></header>
            <div className="tb-lesson-row"><span className="tb-date-block"><b>18</b><small>周五</small></span><div><strong>八年级数学</strong><small>10:20 - 11:05 · 教学楼 A203</small></div><span className="tb-class-chip">8A</span></div>
            <div className="tb-lesson-row"><span className="tb-date-block"><b>19</b><small>周六</small></span><div><strong>数学兴趣小组</strong><small>09:00 - 10:30 · 多功能教室</small></div><span className="tb-class-chip is-green">社团</span></div>
          </section>
        </div>

        <section className="tb-card tb-schedule-card">
          <header><div><span className="tb-card-kicker">今日</span><h2>日程</h2></div><button aria-label="日程菜单">•••</button></header>
          <div className="tb-timeline">
            <div><time>08:30</time><span className="tb-timeline-dot is-purple"/><article><strong>晨间备课</strong><small>办公室</small></article></div>
            <div><time>10:20</time><span className="tb-timeline-dot is-dark"/><article><strong>八年级数学</strong><small>教学楼 A203</small></article></div>
            <div><time>14:00</time><span className="tb-timeline-dot is-green"/><article><strong>教研会议</strong><small>第三会议室</small></article></div>
          </div>
          <button className="tb-add-event"><Icon name="plus" size={16}/> 添加日程</button>
        </section>

        <div className="tb-dashboard-right">
          <MiniCalendar />
          <section className="tb-card tb-tasks-card">
            <header><h2>即将到来</h2><button><Icon name="plus" size={15}/> 新建</button></header>
            <label><input name="task-unit-test" type="checkbox"/><span><strong>准备单元测验</strong><small>今天 · 教学</small></span></label>
            <label><input name="task-research-record" type="checkbox"/><span><strong>提交教研记录</strong><small>明天 · 行政</small></span></label>
            <button className="tb-all-tasks">查看全部任务</button>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function SidebarEditingPrototype() {
  const model = useLayoutModel();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isNarrow = useNarrowLayout();
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  useEffect(() => {
    document.title = 'TeachBuddy 工作台侧栏原型';
  }, []);

  return (
    <div className="tb-prototype">
      <Topbar onOpenMobileSidebar={openMobileSidebar} />
      <div className="tb-shell">
        <Sidebar model={model} mobileOpen={mobileSidebarOpen} onCloseMobile={closeMobileSidebar} isNarrow={isNarrow} />
        <Dashboard />
      </div>
      <div className="tb-announcer" aria-live="polite">{model.announcement}</div>
    </div>
  );
}
