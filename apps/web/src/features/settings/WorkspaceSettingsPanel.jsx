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

export default function WorkspaceSettingsPanel({ modules, layout, onToggleVisibility, onUpdateLayout }) {
  const [newGroupName, setNewGroupName] = useState('');
  const [draftGroupNames, setDraftGroupNames] = useState({});
  const pointerDragRef = useRef(null);

  const groups = layout?.groups || [];
  const hiddenModuleIds = new Set(layout?.hiddenModuleIds || []);
  const modulesById = new Map(modules.map((moduleItem) => [moduleItem.id, moduleItem]));

  useEffect(() => {
    setDraftGroupNames(Object.fromEntries(groups.map((group) => [group.id, group.name])));
  }, [layout]);

  function saveLayout(nextLayout, successMessage) {
    if (onUpdateLayout) {
      return onUpdateLayout(nextLayout, successMessage);
    }
    return Promise.resolve(null);
  }

  function createGroup(event) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name || !layout) return;

    const nextLayout = copyLayout(layout);
    nextLayout.groups.push({ id: createGroupId(nextLayout.groups), name, moduleIds: [] });
    setNewGroupName('');
    saveLayout(nextLayout, '模块分组已创建。');
  }

  function commitGroupName(group) {
    const name = (draftGroupNames[group.id] || '').trim();
    if (!name || name === group.name || !layout) {
      setDraftGroupNames((current) => ({ ...current, [group.id]: group.name }));
      return;
    }

    const nextLayout = copyLayout(layout);
    nextLayout.groups = nextLayout.groups.map((item) => (item.id === group.id ? { ...item, name } : item));
    saveLayout(nextLayout, '模块分组名称已保存。');
  }

  function deleteGroup(groupId) {
    if (!layout) return;
    const nextLayout = copyLayout(layout);
    nextLayout.groups = nextLayout.groups.filter((group) => group.id !== groupId);
    saveLayout(nextLayout, '模块分组已删除，模块已移入未分组。');
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
    saveLayout(nextLayout, '模块分组顺序已保存。');
  }

  function reorderGroups(sourceGroupId, targetGroupId) {
    if (!layout || sourceGroupId === targetGroupId) return;
    const nextLayout = copyLayout(layout);
    const sourceIndex = nextLayout.groups.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = nextLayout.groups.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [sourceGroup] = nextLayout.groups.splice(sourceIndex, 1);
    nextLayout.groups.splice(nextLayout.groups.findIndex((group) => group.id === targetGroupId), 0, sourceGroup);
    saveLayout(nextLayout, '模块分组顺序已保存。');
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
    saveLayout(nextLayout, '模块顺序已保存。');
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
    saveLayout(nextLayout, '模块顺序已保存。');
  }

  function handleDragStart(event, payload) {
    pointerDragRef.current = payload;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function handlePointerDown(event, payload) {
    if (event.button !== 0 || event.target.closest('button, input, select, textarea, label')) return;
    pointerDragRef.current = payload;
  }

  function handlePointerDrop(event, destinationId, targetModuleId = null) {
    const payload = pointerDragRef.current;
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    pointerDragRef.current = null;
    if (payload.type === 'module') {
      moveModule(payload.moduleId, destinationId, targetModuleId);
    } else if (payload.type === 'group' && !targetModuleId) {
      reorderGroups(payload.groupId, destinationId);
    }
  }

  function handleDrop(event, destinationId, targetModuleId = null) {
    event.preventDefault();
    event.stopPropagation();
    pointerDragRef.current = null;
    const payload = readDragPayload(event);
    if (!payload) return;
    if (payload.type === 'module') {
      moveModule(payload.moduleId, destinationId, targetModuleId);
    } else if (payload.type === 'group' && !targetModuleId) {
      reorderGroups(payload.groupId, destinationId);
    }
  }

  function renderModule(moduleId, containerId, containerItems) {
    const moduleItem = modulesById.get(moduleId);
    if (!moduleItem) return null;
    const itemIndex = containerItems.indexOf(moduleId);
    const isVisible = !hiddenModuleIds.has(moduleId);

    return (
      <article
        className="layout-module"
        key={moduleId}
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
          className="drag-handle module-drag-handle"
          draggable={false}
          aria-label="拖动此模块"
          tabIndex={-1}
        >
          ⋮⋮
        </button>
        <div className="layout-module-copy">
          <strong>{moduleItem.icon} {moduleItem.title}</strong>
          <span className="muted tiny-text">{moduleItem.description}</span>
        </div>
        <div className="layout-module-actions">
          <label className="layout-visibility-toggle">
            <input
              type="checkbox"
              aria-label="布局中显示模块"
              checked={isVisible}
              onChange={(event) => onToggleVisibility(moduleId, event.target.checked)}
            />
            <span>{isVisible ? '显示中' : '已隐藏'}</span>
          </label>
          <label className="layout-move-select">
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
      </article>
    );
  }

  function renderModuleList(moduleIds, containerId, ariaLabel) {
    return (
      <div
        className="layout-module-list"
        role="list"
        aria-label={ariaLabel}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event, containerId)}
      >
        {moduleIds.map((moduleId) => renderModule(moduleId, containerId, moduleIds))}
        {!moduleIds.length && <p className="muted tiny-text layout-empty">拖动模块到这里。</p>}
      </div>
    );
  }

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <p className="eyebrow">工作台设置</p>
          <h2>管理功能模块</h2>
          <p className="muted">隐藏只整理工作台界面，不会停止模块的数据、自动行为或跨模块协作。</p>
        </div>
        <span className="badge">{modules.length} 个模块</span>
      </div>

      <div className="card layout-editor">
        <div className="section-header">
          <div>
            <h2>模块布局</h2>
            <p className="muted">创建分组并拖动分组或模块来安排工作台顺序。键盘用户可以使用上移、下移和移动到分组操作。</p>
          </div>
          <span className="badge">未分组始终保留</span>
        </div>

        <form className="layout-create-group" onSubmit={createGroup}>
          <label>
            <span>新分组名称</span>
            <input
              aria-label="新分组名称"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="例如：备课与排课"
            />
          </label>
          <button className="primary-button" type="submit">创建分组</button>
        </form>

        <div className="layout-groups">
          {groups.map((group, index) => (
            <section
              className="layout-group"
              data-layout-group
              key={group.id}
              role="region"
              aria-label={`模块分组：${group.name}`}
              onDragOver={(event) => event.preventDefault()}
              onPointerUp={(event) => handlePointerDrop(event, group.id)}
              onDrop={(event) => handleDrop(event, group.id)}
            >
              <div className="layout-group-header">
                <button
                  type="button"
                  className="drag-handle"
                  aria-label={`拖动分组 ${group.name}`}
                  draggable
                  onPointerDown={(event) => handlePointerDown(event, { type: 'group', groupId: group.id })}
                  onDragEnd={() => { pointerDragRef.current = null; }}
                  onDragStart={(event) => handleDragStart(event, { type: 'group', groupId: group.id })}
                >
                  ⋮⋮
                </button>
                <label className="layout-group-name">
                  <span className="sr-only">分组名称</span>
                  <input
                    aria-label={`重命名分组 ${group.name}`}
                    value={draftGroupNames[group.id] ?? group.name}
                    onChange={(event) => setDraftGroupNames((current) => ({ ...current, [group.id]: event.target.value }))}
                    onBlur={() => commitGroupName(group)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        setDraftGroupNames((current) => ({ ...current, [group.id]: group.name }));
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                <div className="layout-group-actions">
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
                    删除分组
                  </button>
                </div>
              </div>
              {renderModuleList(group.moduleIds, group.id, `${group.name}中的模块`)}
            </section>
          ))}

          <section
            className="layout-group layout-group-ungrouped"
            role="region"
            aria-label="未分组模块"
            onDragOver={(event) => event.preventDefault()}
            onPointerUp={(event) => handlePointerDrop(event, UNGROUPED_ID)}
            onDrop={(event) => handleDrop(event, UNGROUPED_ID)}
          >
            <div className="layout-group-header">
              <div>
                <p className="eyebrow">永久区域</p>
                <h3>未分组</h3>
              </div>
              <span className="badge">不能删除</span>
            </div>
            {renderModuleList(layout?.ungroupedModuleIds || [], UNGROUPED_ID, '未分组中的模块')}
          </section>
        </div>
      </div>

      <div className="card visibility-list">
        <div className="section-header">
          <div>
            <h2>工作台设置</h2>
            <p className="muted">选择要显示在侧栏和工作台首页中的模块；隐藏模块会保留在上面的分组和顺序中。</p>
          </div>
          <span className="badge">核心入口和设置始终可见</span>
        </div>
        {modules.map((moduleItem) => {
          const isVisible = !hiddenModuleIds.has(moduleItem.id);
          return (
            <label className="visibility-row" key={moduleItem.id}>
              <input
                type="checkbox"
                aria-label={moduleItem.title}
                checked={isVisible}
                onChange={(event) => onToggleVisibility(moduleItem.id, event.target.checked)}
              />
              <span className="module-icon">{moduleItem.icon}</span>
              <span className="visibility-copy">
                <strong>{moduleItem.title}</strong>
                <span className="muted">{moduleItem.description}</span>
              </span>
              <span className="badge">{isVisible ? '显示中' : '已隐藏'}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
