import i18n from '../../../i18n/index.js';

export function groupDisplayName(group) {
  return ['teaching', 'ungrouped'].includes(group?.nameKey)
    ? i18n.t(`navigationGroups.${group.nameKey}`, { ns: 'workbench' })
    : group?.name ?? '';
}
