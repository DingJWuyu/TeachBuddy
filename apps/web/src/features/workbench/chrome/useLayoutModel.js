import { useState } from 'react';
import i18n from '../../../i18n/index.js';
import { useNavigation } from '../useNavigation.js';
import { workbenchModules, moduleDisplayName } from '../../modules/moduleRegistry.js';
const t = (key, options) => i18n.t(key, { ns: 'workbench', ...options });
const MODULES = workbenchModules.filter(module => module.navigation === 'sidebar');

function moduleById(moduleId) {
  return MODULES.find((moduleItem) => moduleItem.id === moduleId);
}

function removeModule(groups, moduleId) {
  groups.forEach((group) => {
    group.moduleIds = group.moduleIds.filter((id) => id !== moduleId);
  });
}

export function useLayoutModel(accountKey, generation) {
  const navigation = useNavigation(accountKey, generation);
  const layout = {
    ...navigation.raw,
    groups: navigation.raw.groups.map(group => ({
      ...group, fixed: group.id === 'ungrouped', collapsed: Boolean(navigation.device.collapsed[group.id]),
      moduleIds: group.moduleIds.filter(id => moduleById(id))
    })),
    hiddenModuleIds: navigation.raw.hiddenModuleIds.filter(id => moduleById(id))
  };
  const [announcement, setAnnouncement] = useState(t("工作台布局已载入"));
  /*
   * Bumped on every accepted change. Consumers that only care that the layout
   * moved, and not which part of it moved, watch this instead of trying to see a
   * change through the mutable layout object they already hold.
   */
  const [revision, setRevision] = useState(0);

  function update(message, recipe) {
    if (!navigation.editable) { setAnnouncement(t("导航尚未读取，请先重试读取")); return false; }
    navigation.change(recipe);
    setRevision(current => current + 1);
    setAnnouncement(message);
    return true;
  }

  return {
    navigation,
    layout,
    revision,
    announcement,
    announce: setAnnouncement,
    reset() {
      if (!navigation.editable) return;
      navigation.reset();
      setAnnouncement(t("已恢复默认布局"));
    },
    toggleGroup(groupId) {
      navigation.toggleGroup(groupId);
      setAnnouncement(t("已切换分组展开状态"));
    },
    createGroup(name) {
      const trimmedName = name.trim();
      if (!navigation.editable || !trimmedName || trimmedName.length > 80) return false;
      update(t("已创建分组 {{trimmedName}}", { trimmedName: trimmedName }), (next) => {
        const ungroupedIndex = next.groups.findIndex((group) => group.id === 'ungrouped');
        next.groups.splice(ungroupedIndex, 0, {
          id: `group-${crypto.randomUUID()}`,
          name: trimmedName,
          moduleIds: []
        });
      });
      return true;
    },
    renameGroup(groupId, name) {
      const trimmedName = name.trim();
      if (!navigation.editable || !trimmedName || trimmedName.length > 80) return false;
      update(t("分组已重命名为 {{trimmedName}}", { trimmedName: trimmedName }), (next) => {
        const group = next.groups.find((item) => item.id === groupId && item.id !== 'ungrouped');
        if (group) { group.name = trimmedName; delete group.nameKey; }
      });
      return true;
    },
    deleteGroup(groupId) {
      update(t("分组已删除，原有模块已移到未分组"), (next) => {
        const group = next.groups.find((item) => item.id === groupId && item.id !== 'ungrouped');
        const ungrouped = next.groups.find((item) => item.id === 'ungrouped');
        if (!group || !ungrouped) return;
        ungrouped.moduleIds.push(...group.moduleIds.filter((id) => !ungrouped.moduleIds.includes(id)));
        next.groups = next.groups.filter((item) => item.id !== groupId);
      });
    },
    moveGroup(sourceId, targetId) {
      if (sourceId === targetId) return;
      update(t("分组顺序已调整"), (next) => {
        const sourceIndex = next.groups.findIndex((group) => group.id === sourceId && group.id !== 'ungrouped');
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
      update(t("分组已删除，其中的模块已移入垃圾桶"), (next) => {
        const sourceIndex = next.groups.findIndex((group) => group.id === groupId && group.id !== 'ungrouped');
        if (sourceIndex < 0) return;
        const [group] = next.groups.splice(sourceIndex, 1);
        for (const moduleId of group.moduleIds) {
          if (!next.hiddenModuleIds.includes(moduleId)) next.hiddenModuleIds.push(moduleId);
        }
      });
    },
    moveModule(moduleId, destinationGroupId, targetModuleId = null, position = 'before') {
      if (moduleId === targetModuleId) return;
      update(t("{{value}}已移动", { value: moduleDisplayName(moduleById(moduleId)) || t("模块") }), (next) => {
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
      update(t("{{value}}已移动", { value: moduleDisplayName(moduleById(moduleId)) || t("模块") }), (next) => {
        const groupIndex = next.groups.findIndex((group) => group.moduleIds.includes(moduleId));
        if (groupIndex < 0) return;
        const group = next.groups[groupIndex];
        const moduleIndex = group.moduleIds.indexOf(moduleId);
        if (direction === 'up' || direction === 'down') {
          const visible = group.moduleIds.filter(id => moduleById(id));
          const target = visible[visible.indexOf(moduleId) + (direction === 'up' ? -1 : 1)];
          if (!target) return;
          const targetIndex = group.moduleIds.indexOf(target);
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
      update(t("{{value}}已隐藏", { value: moduleDisplayName(moduleById(moduleId)) || t("模块") }), (next) => {
        removeModule(next.groups, moduleId);
        if (!next.hiddenModuleIds.includes(moduleId)) next.hiddenModuleIds.push(moduleId);
      });
    },
    restoreModule(moduleId) {
      update(t("{{value}}已恢复到未分组", { value: moduleDisplayName(moduleById(moduleId)) || t("模块") }), (next) => {
        removeModule(next.groups, moduleId);
        next.hiddenModuleIds = next.hiddenModuleIds.filter((id) => id !== moduleId);
        const ungrouped = next.groups.find((group) => group.id === 'ungrouped');
        if (ungrouped && !ungrouped.moduleIds.includes(moduleId)) ungrouped.moduleIds.push(moduleId);
      });
    }
  };
}
