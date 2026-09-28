import { moduleCatalog } from './moduleCatalog.js';

// Account data keeps absent module IDs. Filtering belongs only to the view.
export function defaultNavigation(catalog = moduleCatalog) {
  return { structureVersion: 1, defaultLayoutVersion: 1, groups: [
    { id: 'teaching-group', name: '教学', nameKey: 'teaching', moduleIds: catalog.filter(m => m.navigation === 'sidebar').map(m => m.id) },
    { id: 'ungrouped', name: '未分组', nameKey: 'ungrouped', moduleIds: [] }
  ], hiddenModuleIds: [] };
}

export const navigationLayoutSchema = {
  type: 'object', additionalProperties: false,
  required: ['structureVersion', 'defaultLayoutVersion', 'groups', 'hiddenModuleIds'],
  properties: {
    structureVersion: { type: 'integer', const: 1 },
    defaultLayoutVersion: { type: 'integer', const: 1 },
    groups: { type: 'array', minItems: 1, maxItems: 100, items: {
      type: 'object', additionalProperties: false, required: ['id', 'name', 'moduleIds'], properties: {
        id: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9_-]+$' },
        name: { type: 'string', minLength: 1, maxLength: 80, pattern: '\\S' },
        nameKey: { type: 'string', enum: ['teaching', 'ungrouped'] },
        moduleIds: { type: 'array', maxItems: 500, items: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9_-]+$' } }
      }
    } },
    hiddenModuleIds: { type: 'array', maxItems: 500, items: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9_-]+$' } }
  }
};

// Shape validation is shared with response readers; the API validates the same
// schema and reports precise input errors before these cross-field invariants.
export function validNavigation(layout) {
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  if (!layout || layout.structureVersion !== 1 || layout.defaultLayoutVersion !== 1 ||
      !Array.isArray(layout.groups) || !layout.groups.length || layout.groups.length > 100 ||
      !Array.isArray(layout.hiddenModuleIds) || layout.hiddenModuleIds.length > 500) return false;
  const groups = new Set(), modules = new Set();
  for (const group of layout.groups) {
    if (!group || !id(group.id) || groups.has(group.id) || typeof group.name !== 'string' ||
        !group.name.trim() || group.name.length > 80 || !Array.isArray(group.moduleIds) || group.moduleIds.length > 500) return false;
    groups.add(group.id);
    if (group.nameKey !== undefined && !(
      (group.nameKey === 'teaching' && group.id === 'teaching-group' && group.name === '教学') ||
      (group.nameKey === 'ungrouped' && group.id === 'ungrouped' && group.name === '未分组')
    )) return false;
    for (const moduleId of group.moduleIds) {
      if (!id(moduleId) || modules.has(moduleId)) return false;
      modules.add(moduleId);
    }
  }
  for (const moduleId of layout.hiddenModuleIds) {
    if (!id(moduleId) || modules.has(moduleId)) return false;
    modules.add(moduleId);
  }
  return layout.groups.at(-1).id === 'ungrouped';
}

export function includeNewNavigationModules(layout, catalog = moduleCatalog) {
  const known = new Set([...layout.groups.flatMap(g => g.moduleIds), ...layout.hiddenModuleIds]);
  const additions = catalog.filter(m => m.navigation === 'sidebar' && !known.has(m.id)).map(m => m.id);
  if (!additions.length) return layout;
  return { ...layout, groups: layout.groups.map(g => g.id === 'ungrouped' ? { ...g, moduleIds: [...g.moduleIds, ...additions] } : g) };
}
