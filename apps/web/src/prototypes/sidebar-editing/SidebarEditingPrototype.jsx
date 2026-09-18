// High-fidelity interaction prototype for TeachBuddy sidebar organization.
// PROTOTYPE: memory-only state, no production persistence or API calls.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  hiddenModuleIds: [],
  hiddenGroups: []
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
  close: <path d="M6 6l12 12M18 6L6 18"/>,
  panelClose: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M7 9l-2 3 2 3"/></>,
  panelOpen: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5 9l2 3-2 3"/></>,
  folder: <><path d="M3.5 6.5h6l2 2h9v10h-17z"/><path d="M3.5 9h17"/></>
};

function Icon({ name, size = 20 }) {
  return (
    <svg className="tb-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

function cloneLayout(layout) {
  return {
    groups: layout.groups.map((group) => ({ ...group, moduleIds: [...group.moduleIds] })),
    hiddenModuleIds: [...layout.hiddenModuleIds],
    hiddenGroups: layout.hiddenGroups.map((group) => ({ ...group, moduleIds: [...group.moduleIds] }))
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

// Drag target marks are strings so they can drive CSS classes directly. Module
// marks encode which side of the row the insertion line belongs to.
function moduleDropMark(kind, groupId, moduleId) {
  return `module-${kind}:${groupId}:${moduleId}`;
}

function isModuleDropTarget(mark, moduleId, kind) {
  if (!mark || !moduleId) return false;
  const [head, , markedModuleId] = mark.split(':');
  return head === `module-${kind}` && markedModuleId === moduleId;
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
    hideGroup(groupId) {
      update('分组及其中模块已移入垃圾桶', (next) => {
        const sourceIndex = next.groups.findIndex((group) => group.id === groupId && !group.fixed);
        if (sourceIndex < 0) return;
        const [group] = next.groups.splice(sourceIndex, 1);
        next.hiddenGroups.push(group);
      });
    },
    restoreGroup(groupId, targetId = 'ungrouped') {
      update('分组及其中模块已恢复', (next) => {
        const sourceIndex = next.hiddenGroups.findIndex((group) => group.id === groupId);
        if (sourceIndex < 0) return;
        const [group] = next.hiddenGroups.splice(sourceIndex, 1);
        const targetIndex = next.groups.findIndex((item) => item.id === targetId);
        next.groups.splice(targetIndex < 0 ? next.groups.length : targetIndex, 0, group);
      });
    },
    moveModule(moduleId, destinationGroupId, targetModuleId = null, position = 'before') {
      if (moduleId === targetModuleId) return;
      update(`${moduleById(moduleId)?.name || '模块'}已移动`, (next) => {
        removeModule(next.groups, moduleId);
        next.hiddenGroups.forEach((group) => {
          group.moduleIds = group.moduleIds.filter((id) => id !== moduleId);
        });
        next.hiddenModuleIds = next.hiddenModuleIds.filter((id) => id !== moduleId);
        const destination = next.groups.find((group) => group.id === destinationGroupId);
        if (!destination) return;
        // Resolve the anchor index after the removal, so dragging downwards
        // within a group does not land one slot short.
        const anchorIndex = targetModuleId ? destination.moduleIds.indexOf(targetModuleId) : -1;
        const insertIndex = anchorIndex < 0
          ? destination.moduleIds.length
          : anchorIndex + (position === 'after' ? 1 : 0);
        destination.moduleIds.splice(insertIndex, 0, moduleId);
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
        removeModule(next.groups, moduleId);
        if (!next.hiddenModuleIds.includes(moduleId)) next.hiddenModuleIds.push(moduleId);
      });
    },
    restoreModule(moduleId) {
      update(`${moduleById(moduleId)?.name || '模块'}已恢复到未分组`, (next) => {
        removeModule(next.groups, moduleId);
        next.hiddenModuleIds = next.hiddenModuleIds.filter((id) => id !== moduleId);
        const ungrouped = next.groups.find((group) => group.fixed);
        if (ungrouped && !ungrouped.moduleIds.includes(moduleId)) ungrouped.moduleIds.push(moduleId);
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

function Topbar({ onOpenMobileSidebar, sidebarCollapsed, onToggleSidebar }) {
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
      <button
        type="button"
        className="tb-sidebar-toggle"
        aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        aria-pressed={sidebarCollapsed}
        onClick={onToggleSidebar}
      >
        <Icon name={sidebarCollapsed ? 'panelOpen' : 'panelClose'} size={16} />
      </button>
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

// Anchors the new-group popover to the right of its trigger, matching the
// trash panel's flyout grammar instead of pushing a full-width form into flow.
function useFlyoutPosition(open) {
  const triggerRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = document.querySelector('[data-new-group-toggle]');
    if (!trigger) return;
    triggerRef.current = trigger;
    const rect = trigger.getBoundingClientRect();
    const width = 236;
    const margin = 8;
    const left = Math.min(rect.right + margin, window.innerWidth - width - 12);
    const top = Math.min(rect.top - 8, window.innerHeight - 60);
    setPosition({ top, left });
  }, [open]);

  return position;
}

function NewGroupForm({ onCreate, onClose }) {
  const formRef = useRef(null);
  const [name, setName] = useState('');
  const position = useFlyoutPosition(true);

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
      style={{ top: position.top, left: position.left }}
      onSubmit={(event) => {
        event.preventDefault();
        if (onCreate(name)) onClose();
      }}
    >
      <input name="new-group-name" aria-label="新分组名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="分组名称" />
      <span>Enter</span>
    </form>
  );
}

function HiddenModules({ model, open, onToggle, dragState, onDrop, onStartDrag, onFinishDrag }) {
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0 });
  const hiddenCount = model.layout.hiddenModuleIds.length + model.layout.hiddenGroups.length;

  const positionPanel = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelHeight = Math.min(340, 64 + hiddenCount * 45);
    setPanelPosition({
      left: Math.min(rect.right + 10, window.innerWidth - 246),
      top: Math.max(12, Math.min(rect.top, window.innerHeight - panelHeight - 12))
    });
  }, [hiddenCount]);

  useEffect(() => {
    if (!open) return undefined;
    positionPanel();
    function handlePointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) onToggle(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onToggle(false);
    }
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onToggle, positionPanel]);

  return (
    <div className="tb-trash-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        data-trash-toggle
        className="tb-trash-target"
        aria-label={hiddenCount ? `垃圾桶，${hiddenCount} 项` : '垃圾桶'}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        onDragOver={(event) => {
          const payload = readDragPayload(event) || dragState;
          if (payload?.type === 'module' || payload?.type === 'group') event.preventDefault();
        }}
        onDrop={onDrop}
      >
        <Icon name="trash" />
        <span>垃圾桶</span>
        {hiddenCount > 0 && <b>{hiddenCount}</b>}
      </button>
      {open && (
        <div className="tb-hidden-panel" style={panelPosition}>
          {model.layout.hiddenGroups.map((group) => (
            <button
              key={group.id}
              draggable
              aria-label={`${group.name}。点击恢复，或拖到侧边栏指定位置`}
              onClick={() => model.restoreGroup(group.id)}
              onDragStart={(event) => onStartDrag(event, { type: 'hidden-group', id: group.id })}
              onDragEnd={onFinishDrag}
            >
              <span className="tb-module-icon"><Icon name="folder" /></span>
              <span>{group.name}</span>
              <small>{group.moduleIds.length}</small>
            </button>
          ))}
          {model.layout.hiddenModuleIds.map((moduleId) => {
            const moduleItem = moduleById(moduleId);
            return (
              <button
                key={moduleId}
                draggable
                aria-label={`${moduleItem.name}。点击恢复到未分组，或拖到其他分组`}
                onClick={() => model.restoreModule(moduleId)}
                onDragStart={(event) => onStartDrag(event, { type: 'module', id: moduleId })}
                onDragEnd={onFinishDrag}
              >
                <span className="tb-module-icon"><Icon name={moduleItem.icon} /></span>
                <span>{moduleItem.name}</span>
                <Icon name="plus" size={15} />
              </button>
            );
          })}
          {!hiddenCount && <p>空</p>}
        </div>
      )}
    </div>
  );
}

function Sidebar({ model, mobileOpen, onCloseMobile, isNarrow, railCollapsed }) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingGroupId, setRenamingGroupId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dragState, setDragState] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const longPressTimerRef = useRef(null);
  const mobileCloseRef = useRef(null);
  // Group id -> id of the group rendered above it, cached when a drag starts so
  // the inter-group gap can be attributed to the previous group.
  const previousGroupRef = useRef(new Map());
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
    const map = new Map();
    let previous = null;
    for (const group of model.layout.groups) {
      if (previous) map.set(group.id, previous);
      previous = group.id;
    }
    previousGroupRef.current = map;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function finishDrag() {
    setDragState(null);
    setDragTarget(null);
  }

  /*
   * Drop-target state drives the insertion line, so it must only change when the
   * target actually changes. Reassigning the same value on every dragover
   * re-rendered the sidebar continuously and made the rows twitch under the
   * pointer.
   */
  function applyDragTarget(next) {
    setDragTarget((current) => (current === next ? current : next));
  }

  /*
   * Resolves which boundary a module drop should land on. The sidebar has no
   * explicit drop zones between groups, and the gap between two groups belongs
   * to both: a pointer in that gap is nearer the previous group's last row, so
   * it targets the previous group's end rather than jumping a whole group down.
   * Both the hover rule and the drop rule call this, so they always agree.
   */
  function pickModuleBoundary(event, groupId) {
    const section = event.currentTarget;
    const rows = [...section.querySelectorAll('.tb-module-row')];
    const row = event.target instanceof Element ? event.target.closest('.tb-module-row') : null;
    if (row) {
      const rect = row.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2
        ? { kind: 'before', groupId, moduleId: row.dataset.dropModule }
        : { kind: 'after', groupId, moduleId: row.dataset.dropModule };
    }
    const rect = section.getBoundingClientRect();
    const firstRow = rows[0]?.getBoundingClientRect();
    const inTopGap = firstRow ? event.clientY < firstRow.top : event.clientY < rect.top + rect.height / 2;
    const previousGroupId = groupId === model.layout.groups[0]?.id ? null : previousGroupRef.current.get(groupId);
    if (inTopGap && previousGroupId) return { kind: 'groupEnd', groupId: previousGroupId };
    return { kind: 'groupEnd', groupId };
  }

  function markOf(target) {
    if (!target) return null;
    if (target.kind === 'group') return `group:${target.groupId}`;
    if (target.kind === 'groupEnd') return `group-end:${target.groupId}`;
    return moduleDropMark(target.kind, target.groupId, target.moduleId);
  }

  function dropOnGroup(event, groupId) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event) || dragState;
    // Re-resolve the target at drop time with the same rule the hover used, so
    // the group that receives the drop is the one the insertion line marked.
    const target = payload?.type === 'module' ? pickModuleBoundary(event, groupId) : { kind: 'group', groupId };
    if (payload?.type === 'module') model.moveModule(payload.id, target.groupId, target.moduleId, target.kind);
    if (payload?.type === 'group') model.moveGroup(payload.id, groupId);
    if (payload?.type === 'hidden-group') model.restoreGroup(payload.id, groupId);
    finishDrag();
  }

  function dropOnModule(event, groupId, moduleId) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event) || dragState;
    // Re-resolve with the pointer position so a drop lands on the side of the
    // row that the insertion line marked.
    const target = pickModuleBoundary(event, groupId);
    if (payload?.type === 'module') {
      model.moveModule(payload.id, target.groupId, target.moduleId, target.kind);
    }
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
        className={`tb-sidebar ${mobileOpen ? 'is-mobile-open' : ''} ${railCollapsed ? 'is-rail-collapsed' : ''}`}
        aria-label="工作台导航"
        aria-hidden={isNarrow && !mobileOpen ? true : undefined}
        inert={isNarrow && !mobileOpen ? true : undefined}
      >
        <div className="tb-sidebar-mobile-head"><strong>工作台</strong><button ref={mobileCloseRef} onClick={onCloseMobile} aria-label="关闭"><Icon name="close" /></button></div>
        <div className="tb-account-block">
          <button className="tb-account-row">
            <span className="tb-avatar">林</span>
            <span><strong>林老师</strong><small>2026 秋季学期</small></span>
          </button>
          <button className="tb-language-row" aria-label="语言：简体中文"><Icon name="language" /></button>
        </div>
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
              className={`tb-group ${dragTarget === `group:${group.id}` ? 'is-group-insert-target' : ''} ${dragTarget === `group-end:${group.id}` ? 'is-module-end-target' : ''}`}
              data-drop-group={group.id}
              key={group.id}
              /*
               * Target resolution lives in onDragOver, the only drag event that
               * carries pointer coordinates. Resolution happens on enter, and
               * the boundary belonging to the gap above a group depends on where
               * in that gap the pointer sits.
               */
              onDragOver={(event) => {
                const payload = readDragPayload(event) || dragState;
                if (payload?.type === 'module') {
                  event.preventDefault();
                  applyDragTarget(markOf(pickModuleBoundary(event, group.id)));
                  return;
                }
                if (payload?.type === 'group' || payload?.type === 'hidden-group') {
                  event.preventDefault();
                  if (payload.id !== group.id) applyDragTarget(markOf({ kind: 'group', groupId: group.id }));
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) applyDragTarget(null);
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
                    <Icon name="chevron" size={16} />
                  </button>
                )}
              </div>
              {(!group.collapsed || railCollapsed) && (
                <div className="tb-module-list">
                  {group.moduleIds.filter((moduleId) => !hidden.has(moduleId)).map((moduleId) => {
                    const moduleItem = moduleById(moduleId);
                    return (
                      <div
                        key={moduleId}
                        className={`tb-module-row ${moduleId === 'classes' ? 'is-active' : ''} ${dragState?.type === 'module' && dragState.id === moduleId ? 'is-dragging' : ''} ${isModuleDropTarget(dragTarget, moduleId, 'before') ? 'is-drop-target is-drop-before' : ''} ${isModuleDropTarget(dragTarget, moduleId, 'after') ? 'is-drop-target is-drop-after' : ''}`}
                        data-drop-module={moduleId}
                        data-label={moduleItem.name}
                        role="button"
                        tabIndex={0}
                        draggable
                        aria-label={`${moduleItem.name}。可拖动；Alt 加方向键移动；Delete 隐藏`}
                        onKeyDown={(event) => handleModuleKeyDown(event, moduleId)}
                        onDragStart={(event) => startDrag(event, { type: 'module', id: moduleId })}
                        onDragEnd={finishDrag}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const payload = readDragPayload(event) || dragState;
                          if (payload?.type !== 'module' || payload.id === moduleId) return;
                          applyDragTarget(markOf(pickModuleBoundary(event, group.id)));
                        }}
                        onDrop={(event) => dropOnModule(event, group.id, moduleId)}
                      >
                        <span className="tb-module-icon"><Icon name={moduleItem.icon} /></span>
                        <span>{moduleItem.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
          <HiddenModules
            model={model}
            open={hiddenOpen}
            onToggle={setHiddenOpen}
            dragState={dragState}
            onStartDrag={startDrag}
            onFinishDrag={finishDrag}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const payload = readDragPayload(event) || dragState;
              if (payload?.type === 'module') model.hideModule(payload.id);
              if (payload?.type === 'group') model.hideGroup(payload.id);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isNarrow = useNarrowLayout();
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  useEffect(() => {
    document.title = 'TeachBuddy 工作台侧栏原型';
  }, []);

  return (
    <div className={`tb-prototype ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <Topbar
        onOpenMobileSidebar={openMobileSidebar}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
      />
      <div className="tb-shell">
        <Sidebar
          model={model}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={closeMobileSidebar}
          isNarrow={isNarrow}
          railCollapsed={sidebarCollapsed && !isNarrow}
        />
        <Dashboard />
      </div>
      <div className="tb-announcer" aria-live="polite">{model.announcement}</div>
    </div>
  );
}
