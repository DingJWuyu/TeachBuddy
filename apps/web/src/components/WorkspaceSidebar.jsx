import { useEffect, useRef, useState } from 'react';

const UNGROUPED_ID = '';

function copyLayout(layout) {
  return {
    hiddenModuleIds: [...(layout?.hiddenModuleIds || [])],
    groups: (layout?.groups || []).map((group) => ({ ...group, moduleIds: [...group.moduleIds] })),
    ungroupedModuleIds: [...(layout?.ungroupedModuleIds || [])]
  };
}

function readDragPayload(event) {
  try {
    return JSON.parse(event.dataTransfer.getData('text/plain'));
  } catch {
    return null;
  }
}

function createGroupId(groups) {
  let id = `group-${Date.now().toString(36)}`;
  let suffix = 1;
  while (groups.some((group) => group.id === id)) {
    id = `group-${Date.now().toString(36)}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export default function WorkspaceSidebar({
  modules,
  layout,
  activeModuleId,
  onSelectModule,
  onUpdateLayout
}) {
  const [newGroupName, setNewGroupName] = useState('');
  const [draftGroupNames, setDraftGroupNames] = useState({});
  const pointerDragRef = useRef(null);

  const groups = layout?.groups || [];
  const hiddenModuleIds = new Set(layout?.hiddenModuleIds || []);
  const modulesById = new Map(modules.map((moduleItem) => [moduleItem.id, moduleItem]));
  const visibleModuleIds = new Set(modules
    .filter((moduleItem) => !hiddenModuleIds.has(moduleItem.id))
    .map((moduleItem) => moduleItem.id));
  const fallbackUngroupedModuleIds = modules.map((moduleItem) => moduleItem.id);
  const ungroupedModuleIds = layout?.ungroupedModuleIds || fallbackUngroupedModuleIds;

  useEffect(() => {
    setDraftGroupNames((current) => Object.fromEntries(
      groups.map((group) => [group.id, current[group.id] ?? group.name])
    ));
  }, [layout]);

  function createGroup(event) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name || !layout) return;

    const nextLayout = copyLayout(layout);
    nextLayout.groups.push({ id: createGroupId(nextLayout.groups), name, moduleIds: [] });
    setNewGroupName('');
    onUpdateLayout(nextLayout, '模块分组已创建。');
  }

  function commitGroupName(group, value = draftGroupNames[group.id]) {
    const name = (value || '').trim();
    if (!name || name === group.name || !layout) {
      setDraftGroupNames((current) => ({ ...current, [group.id]: group.name }));
      return;
    }

    const nextLayout = copyLayout(layout);
    nextLayout.groups = nextLayout.groups.map((item) => (item.id === group.id ? { ...item, name } : item));
    onUpdateLayout(nextLayout, '模块分组名称已保存。');
  }

  function deleteGroup(groupId) {
    if (!layout) return;
    const nextLayout = copyLayout(layout);
    const deletedGroup = nextLayout.groups.find((group) => group.id === groupId);
    nextLayout.groups = nextLayout.groups.filter((group) => group.id !== groupId);
    if (deletedGroup) {
      nextLayout.ungroupedModuleIds = [
        ...nextLayout.ungroupedModuleIds,
        ...deletedGroup.moduleIds.filter((moduleId) => !nextLayout.ungroupedModuleIds.includes(moduleId))
      ];
    }
    onUpdateLayout(nextLayout, '模块分组已删除，模块已移入未分组。');
  }

  function moveGroupByOffset(groupId, offset) {
    if (!layout) return;
    const nextLayout = copyLayout(layout);
    const currentIndex = nextLayout.groups.findIndex((group) => group.id === groupId);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= nextLayout.groups.length) return;
    [nextLayout.groups[currentIndex], nextLayout.groups[targetIndex]] = [
      nextLayout.groups[targetIndex],
      nextLayout.groups[currentIndex]
    ];
    onUpdateLayout(nextLayout, '模块分组顺序已保存。');
  }

  function reorderGroups(sourceGroupId, targetGroupId) {
    if (!layout || sourceGroupId === targetGroupId) return;
    const nextLayout = copyLayout(layout);
    const sourceIndex = nextLayout.groups.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = nextLayout.groups.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [sourceGroup] = nextLayout.groups.splice(sourceIndex, 1);
    nextLayout.groups.splice(nextLayout.groups.findIndex((group) => group.id === targetGroupId), 0, sourceGroup);
    onUpdateLayout(nextLayout, '模块分组顺序已保存。');
  }

  function moveModule(moduleId, destinationId, targetModuleId = null) {
    if (!layout) return;
    const nextLayout = copyLayout(layout);
    const sourceGroup = nextLayout.groups.find((group) => group.moduleIds.includes(moduleId));
    const sourceId = sourceGroup?.id || UNGROUPED_ID;
    if (sourceId === destinationId && targetModuleId === moduleId) return;

    for (const group of nextLayout.groups) {
      group.moduleIds = group.moduleIds.filter((itemId) => itemId !== moduleId);
    }
    nextLayout.ungroupedModuleIds = nextLayout.ungroupedModuleIds.filter((itemId) => itemId !== moduleId);

    const destinationItems = destinationId === UNGROUPED_ID
      ? nextLayout.ungroupedModuleIds
      : nextLayout.groups.find((group) => group.id === destinationId)?.moduleIds;
    if (!destinationItems) return;

    const targetIndex = targetModuleId ? destinationItems.indexOf(targetModuleId) : -1;
    destinationItems.splice(targetIndex < 0 ? destinationItems.length : targetIndex, 0, moduleId);
    onUpdateLayout(nextLayout, '模块顺序已保存。');
  }

  function moveModuleByOffset(moduleId, containerId, offset) {
    if (!layout) return;
    const nextLayout = copyLayout(layout);
    const items = containerId === UNGROUPED_ID
      ? nextLayout.ungroupedModuleIds
      : nextLayout.groups.find((group) => group.id === containerId)?.moduleIds;
    if (!items) return;
    const currentIndex = items.indexOf(moduleId);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return;
    [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];
    onUpdateLayout(nextLayout, '模块顺序已保存。');
  }

  function handleDragStart(event, payload) {
    pointerDragRef.current = payload;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function handlePointerDown(event, payload) {
    const interactiveTarget = event.target.closest('button, input, select, textarea, label');
    if (event.button !== 0 || (interactiveTarget && !interactiveTarget.classList.contains('drag-handle'))) return;
    pointerDragRef.current = payload;
  }

  function applyDropPayload(payload, destinationId, targetModuleId = null) {
    if (!payload) return;
    if (payload.type === 'module') {
      moveModule(payload.moduleId, destinationId, targetModuleId);
    } else if (payload.type === 'group' && !targetModuleId) {
      reorderGroups(payload.groupId, destinationId);
    }
  }

  function resolvePointerDrop(event, destinationId, targetModuleId) {
    if (!event.pointerType || event.pointerType === 'mouse') {
      return { destinationId, targetModuleId };
    }

    const pointerTarget = document.elementFromPoint(event.clientX, event.clientY);
    const targetGroup = pointerTarget?.closest('[data-layout-group]');
    if (!targetGroup) return null;
    const targetModule = pointerTarget?.closest('[data-layout-module]');
    return {
      destinationId: targetGroup.getAttribute('data-layout-group') || UNGROUPED_ID,
      targetModuleId: targetModule?.getAttribute('data-layout-module') || null
    };
  }

  function handlePointerDrop(event, destinationId, targetModuleId = null) {
    const payload = pointerDragRef.current;
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    pointerDragRef.current = null;
    const dropTarget = resolvePointerDrop(event, destinationId, targetModuleId);
    if (dropTarget) applyDropPayload(payload, dropTarget.destinationId, dropTarget.targetModuleId);
  }

  function handleDrop(event, destinationId, targetModuleId = null) {
    event.preventDefault();
    event.stopPropagation();
    pointerDragRef.current = null;
    applyDropPayload(readDragPayload(event), destinationId, targetModuleId);
  }

  function renderModule(moduleId, containerId, containerItems) {
    const moduleItem = modulesById.get(moduleId);
    if (!moduleItem || !visibleModuleIds.has(moduleId)) return null;
    const itemIndex = containerItems.indexOf(moduleId);

    return (
      <div
        className="sidebar-module"
        key={moduleId}
        data-layout-module={moduleId}
        role="listitem"
        draggable
        onPointerDown={(event) => handlePointerDown(event, { type: 'module', moduleId })}
        onPointerUp={(event) => handlePointerDrop(event, containerId, moduleId)}
        onDragStart={(event) => handleDragStart(event, { type: 'module', moduleId })}
        onDragEnd={() => { pointerDragRef.current = null; }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event, containerId, moduleId)}
      >
        <button
          type="button"
          className={`sidebar-module-button ${activeModuleId === moduleId ? 'active' : ''}`}
          draggable
          onDragStart={(event) => handleDragStart(event, { type: 'module', moduleId })}
          onClick={() => onSelectModule(moduleId)}
        >
          <span className="sidebar-module-icon" aria-hidden="true">{moduleItem.icon}</span>
          <span>{moduleItem.title}</span>
        </button>
        <button
          type="button"
          className="drag-handle sidebar-drag-handle"
          draggable
          aria-label="拖动此模块"
          onPointerDown={(event) => handlePointerDown(event, { type: 'module', moduleId })}
          onDragStart={(event) => handleDragStart(event, { type: 'module', moduleId })}
          tabIndex={-1}
        >
          ⋮⋮
        </button>
        <div className="sidebar-module-actions">
          <label className="sidebar-module-move-select">
            <span className="sr-only">移动模块</span>
            <select
              aria-label="移动模块到分组"
              value={containerId}
              onChange={(event) => moveModule(moduleId, event.target.value)}
            >
              <option value={UNGROUPED_ID}>未分组</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="text-button compact-button"
            aria-label="上移模块"
            disabled={itemIndex <= 0}
            onClick={() => moveModuleByOffset(moduleId, containerId, -1)}
          >
            上移
          </button>
          <button
            type="button"
            className="text-button compact-button"
            aria-label="下移模块"
            disabled={itemIndex < 0 || itemIndex >= containerItems.length - 1}
            onClick={() => moveModuleByOffset(moduleId, containerId, 1)}
          >
            下移
          </button>
        </div>
      </div>
    );
  }

  function renderModuleList(moduleIds, containerId, ariaLabel) {
    return (
      <div
        className="sidebar-module-list"
        role="list"
        aria-label={ariaLabel}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event, containerId)}
      >
        {moduleIds.map((moduleId) => renderModule(moduleId, containerId, moduleIds))}
      </div>
    );
  }

  function renderGroup(group, index) {
    return (
      <section
        className="sidebar-group"
        data-layout-group={group.id}
        key={group.id}
        role="region"
        aria-label={`模块分组：${group.name}`}
        onDragOver={(event) => event.preventDefault()}
        onPointerUp={(event) => handlePointerDrop(event, group.id)}
        onDrop={(event) => handleDrop(event, group.id)}
      >
        <div className="sidebar-group-header">
          <button
            type="button"
            className="drag-handle sidebar-drag-handle"
            aria-label={`拖动分组 ${group.name}`}
            draggable
            onPointerDown={(event) => handlePointerDown(event, { type: 'group', groupId: group.id })}
            onDragEnd={() => { pointerDragRef.current = null; }}
            onDragStart={(event) => handleDragStart(event, { type: 'group', groupId: group.id })}
          >
            ⋮⋮
          </button>
          <label className="sidebar-group-name">
            <span className="sr-only">分组名称</span>
            <input
              aria-label={`重命名分组 ${group.name}`}
              value={draftGroupNames[group.id] ?? group.name}
              onChange={(event) => setDraftGroupNames((current) => ({ ...current, [group.id]: event.target.value }))}
              onBlur={(event) => commitGroupName(group, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitGroupName(group, event.currentTarget.value);
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  setDraftGroupNames((current) => ({ ...current, [group.id]: group.name }));
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
          <div className="sidebar-group-actions">
            <button
              type="button"
              className="text-button compact-button"
              aria-label={`上移分组 ${group.name}`}
              disabled={index === 0}
              onClick={() => moveGroupByOffset(group.id, -1)}
            >
              上移
            </button>
            <button
              type="button"
              className="text-button compact-button"
              aria-label={`下移分组 ${group.name}`}
              disabled={index === groups.length - 1}
              onClick={() => moveGroupByOffset(group.id, 1)}
            >
              下移
            </button>
            <button
              type="button"
              className="danger-button compact-button"
              aria-label={`删除分组 ${group.name}`}
              onClick={() => deleteGroup(group.id)}
            >
              删除
            </button>
          </div>
        </div>
        {renderModuleList(group.moduleIds, group.id, `${group.name}中的模块`)}
      </section>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">教师工作台</p>
        <h2>RefatOS</h2>
        <p className="muted">一个让教学保持从容、随时容纳新功能的模块化教师工作台。</p>
      </div>

      <div className="sidebar-core-nav" aria-label="工作台核心导航">
        <button
          className={`nav-button ${activeModuleId === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectModule('dashboard')}
        >
          工作台首页
        </button>
        <button
          className={`nav-button ${activeModuleId === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectModule('settings')}
        >
          设置
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="工作台导航">
        <div className="sidebar-nav-heading">
          <div>
            <p className="eyebrow">功能模块</p>
            <h3>我的工作台</h3>
          </div>
        </div>

        <form className="sidebar-create-group" onSubmit={createGroup}>
          <label>
            <span>新分组名称</span>
            <input
              aria-label="新分组名称"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="例如：近期安排"
            />
          </label>
          <button className="primary-button compact-button" type="submit" disabled={!layout}>创建分组</button>
        </form>

        <div className="sidebar-groups">
          {groups.map(renderGroup)}
          <section
            className="sidebar-group sidebar-group-ungrouped"
            data-layout-group={UNGROUPED_ID}
            role="region"
            aria-label="未分组模块"
            onDragOver={(event) => event.preventDefault()}
            onPointerUp={(event) => handlePointerDrop(event, UNGROUPED_ID)}
            onDrop={(event) => handleDrop(event, UNGROUPED_ID)}
          >
            <div className="sidebar-group-header sidebar-ungrouped-header">
              <div>
                <p className="eyebrow">永久区域</p>
                <h3>未分组</h3>
              </div>
              <span className="badge">不能删除</span>
            </div>
            {renderModuleList(ungroupedModuleIds, UNGROUPED_ID, '未分组中的模块')}
          </section>
        </div>
      </nav>
    </aside>
  );
}
