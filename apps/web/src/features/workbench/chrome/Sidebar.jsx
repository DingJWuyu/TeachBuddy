import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useScene } from '../useScene.js';
import { useWorkbenchShell } from '../shellContext.js';
import { SUPPORT_MENU_ITEMS } from './SupportMenu.jsx';
import { createDragChip } from './dragChip.js';
import { HOME_PATH, modulePath, routeClick, withSearch } from './routes.js';
import { Icon } from './icons.jsx';
import SidebarHead from './SidebarHead.jsx';
import { workbenchModules } from '../../modules/moduleRegistry.js';
const MODULES = workbenchModules.filter(module => module.navigation === 'sidebar');
const INITIAL_LAYOUT = {groups:[{id:'teaching-group',name:'教学',collapsed:false,fixed:false,moduleIds:MODULES.map(m=>m.id)},{id:'ungrouped',name:'未分组',collapsed:false,fixed:true,moduleIds:[]}],hiddenModuleIds:[]};
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

export function useLayoutModel(accountKey) {
  const [saved, patchSaved] = useScene(accountKey, 'restored-navigation', { layout: INITIAL_LAYOUT });
  // Saved device layouts may still mention modules removed from the catalog.
  const layout = {
    ...saved.layout,
    groups: saved.layout.groups.map(group => ({
      ...group, moduleIds: group.moduleIds.filter(id => moduleById(id))
    })),
    hiddenModuleIds: saved.layout.hiddenModuleIds.filter(id => moduleById(id))
  };
  const setLayout = value => patchSaved(current => ({ layout: typeof value === 'function' ? value(current.layout) : value }));
  const [announcement, setAnnouncement] = useState('工作台布局已载入');
  /*
   * Bumped on every accepted change. Consumers that only care that the layout
   * moved, and not which part of it moved, watch this instead of trying to see a
   * change through the mutable layout object they already hold.
   */
  const [revision, setRevision] = useState(0);

  /*
   * Every layout change is written through. This is the one piece of state that
   * outlives the session, so it is also the one that has to survive the route
   * change, the reload and the browser restart a user would actually perform.
   */
  function update(message, recipe) {
    setLayout((current) => {
      const next = cloneLayout(current);
      recipe(next);
      
      return next;
    });
    setRevision((current) => current + 1);
    setAnnouncement(message);
  }

  return {
    layout,
    revision,
    announcement,
    announce: setAnnouncement,
    reset() {
      const next = cloneLayout(INITIAL_LAYOUT);
      
      setLayout(next);
      setAnnouncement('已恢复默认布局');
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
    /*
     * A group dragged to the trash is deleted, not stored.
     *
     * Only its modules are recoverable, and they come back individually. Keeping
     * the group itself in the trash would mean the trash holds something the user
     * cannot see anywhere else, and restoring it would rebuild a grouping they
     * had already thrown away. What they threw away is the grouping, so the
     * grouping is what goes; the modules inside it are what they might miss.
     */
    hideGroup(groupId) {
      update('分组已删除，其中的模块已移入垃圾桶', (next) => {
        const sourceIndex = next.groups.findIndex((group) => group.id === groupId && !group.fixed);
        if (sourceIndex < 0) return;
        const [group] = next.groups.splice(sourceIndex, 1);
        for (const moduleId of group.moduleIds) {
          if (!next.hiddenModuleIds.includes(moduleId)) next.hiddenModuleIds.push(moduleId);
        }
      });
    },
    moveModule(moduleId, destinationGroupId, targetModuleId = null, position = 'before') {
      if (moduleId === targetModuleId) return;
      update(`${moduleById(moduleId)?.name || '模块'}已移动`, (next) => {
        removeModule(next.groups, moduleId);
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
    <div ref={menuRef} className="tb-context-menu" role="menu" style={{ left: position.x, top: position.y }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}>
      <button role="menuitem" onClick={onRename}>重命名分组</button>
      <button role="menuitem" className="is-danger" onClick={onDelete}>移到未分组</button>
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
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (onCreate(name)) onClose();
      }}
    >
      <input name="new-group-name" aria-label="新分组名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="分组名称" />
    </form>
  );
}

function HiddenModules({ model, open, onToggle, dragState, onDrop, onStartDrag, onFinishDrag }) {
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0 });
  /*
   * True while a draggable module or group is over the trash. The row turns into
   * a delete target: the icon goes red and swells, which is the confirmation the
   * user gets before releasing. It is cleared on leave as well as on drop, so a
   * drag that changes its mind leaves no red behind.
   */
  const [isDropTarget, setIsDropTarget] = useState(false);
  const hiddenCount = model.layout.hiddenModuleIds.length;

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
        className={`tb-trash-target${isDropTarget ? ' is-drop-target' : ''}`}
        aria-label={hiddenCount ? `垃圾桶，${hiddenCount} 项` : '垃圾桶'}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        onDragOver={(event) => {
          const payload = readDragPayload(event) || dragState;
          if (payload?.type === 'module' || payload?.type === 'group') {
            event.preventDefault();
            setIsDropTarget(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDropTarget(false);
        }}
        onDrop={(event) => {
          setIsDropTarget(false);
          onDrop(event);
        }}
      >
        <span className="tb-trash-icon"><Icon name="trash" /></span>
        <span>垃圾桶</span>
        {hiddenCount > 0 && <b>{hiddenCount}</b>}
      </button>
      {open && (
        <div className="tb-hidden-panel" style={panelPosition}>
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

export default function Sidebar({ modulePaths = {}, model, routePath, onNavigate, mobileOpen, onCloseMobile, isNarrow, railCollapsed, openSurface, onToggleSurface, onOpenSurface, onCloseSurface, accountName }) {

  function moduleHref(id) {
    const path = modulePath(id);
    const remembered = modulePaths[id];
    return remembered && (remembered === path || remembered.startsWith(path + '/') || remembered.startsWith(path + '?'))
      ? remembered : path;
  }

  const [addingGroup, setAddingGroup] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingGroupId, setRenamingGroupId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dragState, setDragState] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const dragTargetRef = useRef(null);
  // The drag image in flight. Created on dragstart and removed on dragend, so a
  // cancelled drag leaves no chip behind in the document.
  const dragChipRef = useRef(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [mobileSupportOpen, setMobileSupportOpen] = useState(false);
  const [railTooltip, setRailTooltip] = useState(null);
  function showRailTooltip(event, label) {
    if (!railCollapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setRailTooltip({ label, left: rect.right + 14, top: rect.top + rect.height / 2 });
  }
  useEffect(() => {
    setRailTooltip(null);
    const clear = () => setRailTooltip(null);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [railCollapsed, routePath]);
  const longPressTimerRef = useRef(null);
  const mobileCloseRef = useRef(null);
  // Cached when a drag starts so boundary resolution stays stable for the whole
  // gesture: group id -> id of the group above it, and group id -> bottom edge
  // of that group's last row (used to split the gap between two groups).
  const previousGroupRef = useRef(new Map());
  const previousGroupEndRef = useRef(new Map());
  const hidden = new Set(model.layout.hiddenModuleIds);

  /*
   * The chip follows the pointer through window-level listeners rather than
   * through each row's own handlers. A drag spends most of its life over rows the
   * sidebar did not write, and the chip has to keep up there too.
   */
  useEffect(() => {
    function handleMove(event) {
      dragChipRef.current?.moveTo(event.clientX, event.clientY);
    }
    window.addEventListener('dragover', handleMove);
    window.addEventListener('drag', handleMove);
    return () => {
      window.removeEventListener('dragover', handleMove);
      window.removeEventListener('drag', handleMove);
    };
  }, []);

  useEffect(() => {
    if (!isNarrow || !mobileOpen) return undefined;
    mobileCloseRef.current?.focus();
  }, [isNarrow, mobileOpen]);

  useEffect(() => {
    if (!isNarrow || !mobileOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !event.defaultPrevented && !openSurface) onCloseMobile();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isNarrow, mobileOpen, onCloseMobile, openSurface]);

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
    const ends = new Map();
    let previous = null;
    for (const group of model.layout.groups) {
      if (previous) map.set(group.id, previous);
      const section = document.querySelector(`[data-drop-group="${group.id}"]`);
      const lastRow = section?.querySelector('.tb-module-row:last-of-type');
      if (lastRow) ends.set(group.id, lastRow.getBoundingClientRect().bottom);
      previous = group.id;
    }
    previousGroupRef.current = map;
    previousGroupEndRef.current = ends;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));

    /*
     * A row dragged at full size covers the trash it is aimed at, which hides the
     * only feedback that says the trash has recognised the drag. The chip is the
     * same 32px white disc for modules and groups, differing only in icon, so the
     * gesture reads the same everywhere in the shell. It starts under the pointer
     * and is moved by `followDrag`, because the native image is suppressed.
     */
    dragChipRef.current?.remove();
    dragChipRef.current = createDragChip({ icon: payload.type === 'group' ? 'folder' : moduleById(payload.id)?.icon || 'inbox' });
    dragChipRef.current.set(event);
    dragChipRef.current.moveTo(event.clientX, event.clientY);
  }

  /** Keeps the chip under the pointer for the whole gesture. */
  function followDrag(event) {
    dragChipRef.current?.moveTo(event.clientX, event.clientY);
  }

  function finishDrag() {
    setDragState(null);
    dragTargetRef.current = null;
    setDragTarget(null);
    dragChipRef.current?.remove();
    dragChipRef.current = null;
  }

  /* Keep the resolved target with its insertion mark; dragging removes the source from the layout, so drop-time geometry differs. */
  function applyDragTarget(target) {
    dragTargetRef.current = target;
    const next = markOf(target);
    setDragTarget((current) => (current === next ? current : next));
  }

  function markOf(target) {
    if (!target) return null;
    if (target.kind === 'group') return `group:${target.groupId}`;
    /*
     * An empty group is marked as a place rather than as a boundary. There is no
     * row to draw an insertion line against, so the whole group is outlined
     * instead, which is also what tells the user the group will accept the drop.
     */
    if (target.kind === 'groupOnly') return `group-empty:${target.groupId}`;
    if (target.kind === 'groupEnd') return `group-end:${target.groupId}`;
    if (target.kind === 'start') return moduleDropMark('before', target.groupId, target.moduleId);
    return moduleDropMark(target.kind, target.groupId, target.moduleId);
  }

  /**
   * Where a module drop inside this group would land.
   *
   * A module can land before or after a row, or at the very top of a group. The
   * last one is the group's own insertion point rather than a row's, because
   * above the first row there is no row to be "before": the pointer is over the
   * heading, the group's padding or the gap the group shares with the one above.
   * Resolving it to the end of the previous group, which is what a row-only rule
   * does, is why a module could not be dropped at the top of a group.
   */
  function resolveModuleTarget(section, y, current) {
    const rows = [...section.querySelectorAll('.tb-module-row')];
    const firstRow = rows[0]?.getBoundingClientRect();
    const previousGroupId = previousGroupRef.current.get(section.dataset.dropGroup);

    /* With no rows, the whole group targets its empty list. */
    if (!firstRow) return { kind: 'groupOnly', groupId: section.dataset.dropGroup };

    const row = y >= firstRow.top && y <= rows.at(-1).getBoundingClientRect().bottom
      ? rows.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      })
      : null;

    if (row) {
      const rect = row.getBoundingClientRect();
      const id = row.dataset.dropModule;
      const middle = rect.top + rect.height / 2;
      // A whole row of hysteresis: the pointer must travel a quarter row clear of
      // the midpoint on either side before the marked side flips, so a hand that
      // sits on one boundary does not make the insertion line flicker.
      const slack = rect.height / 2;
      let after = y >= middle;
      if (current?.kind === 'after' && current.moduleId === id && y < middle - slack) after = false;
      if (current?.kind === 'before' && current.moduleId === id && y >= middle + slack) after = true;
      return after
        ? { kind: 'after', groupId: section.dataset.dropGroup, moduleId: id }
        : { kind: 'before', groupId: section.dataset.dropGroup, moduleId: id };
    }

    /*
     * Above the first row. The gap between two groups belongs to both, so it is
     * split at the midpoint between the previous group's last row and where this
     * group begins. Above the split the module joins the previous group's end,
     * below it it joins the top of this one. The heading counts as the group's
     * top: a pointer on the heading has arrived at this group, not at the one
     * above it, which is what makes the top of a group a real drop target.
     */
    const groupTop = section.querySelector('.tb-group-heading')?.getBoundingClientRect().top ?? firstRow.top;
    if (!previousGroupId || y >= groupTop) {
      return { kind: 'start', groupId: section.dataset.dropGroup, moduleId: rows[0].dataset.dropModule };
    }
    const boundaryY = (previousGroupEndRef.current.get(previousGroupId) + groupTop) / 2;
    const slack = firstRow.height / 2;
    let usePrevious = y < boundaryY;
    if (current?.kind === 'groupEnd' && current.groupId === previousGroupId && y > boundaryY + slack) usePrevious = false;
    if (current?.kind === 'start' && current.groupId === section.dataset.dropGroup && y < boundaryY - slack) usePrevious = true;
    return usePrevious
      ? { kind: 'groupEnd', groupId: previousGroupId }
      : { kind: 'start', groupId: section.dataset.dropGroup, moduleId: rows[0].dataset.dropModule };
  }

  function dropOnGroup(event, groupId) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event) || dragState;
    if (payload?.type === 'module') moveModuleTo(payload.id, dragTargetRef.current);
    if (payload?.type === 'group') model.moveGroup(payload.id, groupId);
    finishDrag();
  }

  function dropOnModule(event) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event) || dragState;
    if (payload?.type === 'module') moveModuleTo(payload.id, dragTargetRef.current);
    finishDrag();
  }

  /** Applies one resolved module target to the layout. */
  function moveModuleTo(moduleId, target) {
    if (!target) return;
    /*
     * An empty group has no anchor row, so the module is appended to it: with no
     * rows, the end of its list is the only place the module can go.
     */
    if (target.kind === 'groupEnd' || target.kind === 'groupOnly') {
      model.moveModule(moduleId, target.groupId, null, 'after');
      return;
    }
    model.moveModule(moduleId, target.groupId, target.moduleId, target.kind === 'after' ? 'after' : 'before');
  }

  /*
   * The row is a link, so Enter and Space are left alone: they navigate, which
   * is what a row that goes somewhere should do with the keyboard. Only the two
   * layout gestures stay, Delete to hide and Alt plus an arrow to reorder.
   */
  function handleModuleKeyDown(event, moduleId) {
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
        <SidebarHead
          accountName={accountName}
          onAnnounce={model.announce}
          openSurface={openSurface}
          onToggleSurface={onToggleSurface}
          onOpenSurface={onOpenSurface}
          onCloseSurface={onCloseSurface}
          visible={isNarrow ? mobileOpen : !railCollapsed}
        />

        {}
        {isNarrow && (
          <nav className="tb-mobile-nav" aria-label="全局导航">
            <a
              className={`tb-module-row${routePath === HOME_PATH ? ' is-active' : ''}`}
              href={withSearch(HOME_PATH)}
              aria-current={routePath === HOME_PATH ? 'page' : undefined}
              onClick={(event) => {
                routeClick(event, HOME_PATH);
                onCloseMobile();
              }}
            >
              <span className="tb-module-icon"><Icon name="home" /></span>
              <span>首页</span>
            </a>
            {workbenchModules.filter(module => module.navigation === 'top').map(module => <a
              key={module.id}
              className={`tb-module-row${routePath === module.path ? ' is-active' : ''}`}
              href={module.path}
              aria-current={routePath === module.path ? 'page' : undefined}
              onClick={(event) => { routeClick(event, module.path); onCloseMobile(); }}
            >
              <span className="tb-module-icon"><Icon name={module.icon} /></span>
              <span>{module.name}</span>
            </a>)}
            <button
              type="button"
              className="tb-module-row"
              aria-expanded={mobileSupportOpen}
              onClick={() => setMobileSupportOpen((current) => !current)}
            >
              <span className="tb-module-icon"><Icon name="circleHelp" /></span>
              <span>支持</span>
              <Icon name="chevron" size={16} />
            </button>
            {/*
              The drawer renders the same destinations as the desktop support
              menu, and every one of them leaves the drawer behind: the row
              closes the drawer and then lets the link navigate.
            */}
            {mobileSupportOpen && SUPPORT_MENU_ITEMS.map((item) => (
              <a
                className={`tb-module-row tb-mobile-support-item${routePath === item.route ? ' is-active' : ''}`}
                key={item.label}
                href={withSearch(item.route)}
                aria-current={routePath === item.route ? 'page' : undefined}
                onClick={(event) => {
                  routeClick(event, item.route);
                  onCloseMobile();
                }}
              >
                <span className="tb-module-icon"><Icon name={item.icon} size={16} /></span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        )}

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
          {model.layout.groups.map((group) => {
            /*
             * A group that has lost every module keeps its heading, and so does
             * one that never had a module. Removing it would take away the only
             * place those modules could be dragged back to, which is why dropping
             * a module into an emptied group never worked: by the time the group
             * was empty there was nothing left to drop onto. The ungrouped area
             * is always shown for the same reason, and because restores land in
             * it.
             */
            const visibleModuleIds = group.moduleIds.filter((moduleId) => !hidden.has(moduleId));
            return (
            <section
              className={`tb-group ${dragTarget === `group:${group.id}` ? 'is-group-insert-target' : ''} ${dragTarget === `group-empty:${group.id}` ? 'is-empty-drop-target' : ''} ${dragTarget === `group-end:${group.id}` ? 'is-module-end-target' : ''}`}
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
                  applyDragTarget(resolveModuleTarget(event.currentTarget, event.clientY, dragTargetRef.current));
                  return;
                }
                if (payload?.type === 'group') {
                  event.preventDefault();
                  if (payload.id !== group.id) applyDragTarget({ kind: 'group', groupId: group.id });
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
                onDrag={followDrag}
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
                      if (event.key === 'Escape') {
                        event.stopPropagation();
                        setRenamingGroupId(null);
                      }
                    }}
                  />
                ) : (
                  /*
                   * The name is a heading and the chevron is a button, because a
                   * collapsed group cannot be a link: a heading that navigates to
                   * a hidden row would land the user on a page they cannot see.
                   * Collapsed, the heading is a plain label and the chevron is the
                   * only control. The heading is still the whole drag handle, as
                   * it was before, via the wrapper's own heading classes.
                   */
                  <>
                    {group.collapsed ? (
                      <span className="tb-group-label">{group.name}</span>
                    ) : (
                      <a
                        className="tb-group-label"
                        href={withSearch(group.moduleIds[0] ? modulePath(group.moduleIds[0]) : HOME_PATH)}
                        onClick={(event) => routeClick(event, group.moduleIds[0] ? modulePath(group.moduleIds[0]) : HOME_PATH)}
                        onKeyDown={(event) => {
                          if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') openContextMenu(event, group);
                        }}
                      >
                        {group.name}
                      </a>
                    )}
                    <button
                      type="button"
                      className="tb-group-toggle"
                      aria-expanded={!group.collapsed}
                      aria-label={group.collapsed ? `展开分组 ${group.name}` : `收起分组 ${group.name}`}
                      onClick={() => model.toggleGroup(group.id)}
                      onKeyDown={(event) => {
                        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') openContextMenu(event, group);
                      }}
                    >
                      <Icon name="chevron" size={16} />
                    </button>
                  </>
                )}
              </div>
              {/*
                * The list stays mounted and the wrapper animates its height, so a
                * group opens and closes instead of appearing. Keeping it mounted
                * is also what lets a drag start from a group that is still
                * closing. `inert` takes the collapsed rows out of the tab order
                * and out of the accessibility tree at the same time the collapse
                * starts, so a shrinking row cannot be reached by keyboard.
                */}
              <div className={`tb-module-collapse${group.collapsed && !railCollapsed ? ' is-collapsed' : ''}`}>
                <div className="tb-module-clip" inert={group.collapsed && !railCollapsed ? true : undefined}>
                  <div className="tb-module-list">
                  {visibleModuleIds.map((moduleId) => {
                    const moduleItem = moduleById(moduleId);
                    return (
                      /*
                       * A module row navigates, so it is an anchor rather than a
                       * div with a button role: middle-click, copy link and the
                       * browser's own status bar all come for free. Drag still
                       * works, and a drag that moves the row never fires click.
                       *
                       * Alt+arrow and Delete still reorder and hide, but the row
                       * is no longer a tab stop of its own: the link is the tab
                       * stop, which is what a row that goes somewhere should be.
                       */
                      <a
                        key={moduleId}
                        href={moduleHref(moduleId)}
                        className={`tb-module-row ${modulePath(moduleId) === routePath ? 'is-active' : ''} ${dragState?.type === 'module' && dragState.id === moduleId ? 'is-dragging' : ''} ${isModuleDropTarget(dragTarget, moduleId, 'before') ? 'is-drop-target is-drop-before' : ''} ${isModuleDropTarget(dragTarget, moduleId, 'after') ? 'is-drop-target is-drop-after' : ''}`}
                        data-drop-module={moduleId}
                        data-label={moduleItem.name}
                        onPointerEnter={(event) => showRailTooltip(event, moduleItem.name)}
                        onPointerLeave={() => setRailTooltip(null)}
                        onFocus={(event) => showRailTooltip(event, moduleItem.name)}
                        onBlur={() => setRailTooltip(null)}
                        draggable
                        aria-current={modulePath(moduleId) === routePath ? 'page' : undefined}
                        aria-label={`${moduleItem.name}${modulePath(moduleId) === routePath ? '，当前页面' : ''}。Enter 打开；可拖动；Alt 加方向键移动；Delete 隐藏`}
                        onKeyDown={(event) => handleModuleKeyDown(event, moduleId)}
                        onClick={(event) => {
                          /* Keep the shell mounted for ordinary clicks; modified clicks retain native link behavior. */
                          routeClick(event, moduleHref(moduleId));
                          onNavigate();
                        }}
                        onDragStart={(event) => startDrag(event, { type: 'module', id: moduleId })}
                        onDrag={followDrag}
                        onDragEnd={finishDrag}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const payload = readDragPayload(event) || dragState;
                          if (payload?.type !== 'module' || payload.id === moduleId) return;
                          applyDragTarget(resolveModuleTarget(
                            event.currentTarget.closest('[data-drop-group]'),
                            event.clientY,
                            dragTargetRef.current
                          ));
                        }}
                        onDrop={dropOnModule}
                      >
                        <span className="tb-module-icon"><Icon name={moduleItem.icon} /></span>
                        <span>{moduleItem.name}</span>
                      </a>
                    );
                  })}
                  </div>
                </div>
              </div>
            </section>
            );
          })}
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
      {railCollapsed && railTooltip && (
        <span className="tb-rail-tooltip" role="tooltip" style={{ left: railTooltip.left, top: railTooltip.top }}>
          {railTooltip.label}
        </span>
      )}
    </>
  );
}

