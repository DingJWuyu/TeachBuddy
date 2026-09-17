import { badRequest, ensureObject, ensureTrimmedString } from './validation.js';

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    badRequest(`${label} must be an array.`);
  }
  return value;
}

function ensureUniqueModuleIds(value, label, moduleIds) {
  const catalogIds = new Set(moduleIds);
  const seen = new Set();

  return ensureArray(value, label).map((moduleId) => {
    const normalized = ensureTrimmedString(moduleId, `${label} module ID`, { maxLength: 80 });
    if (!catalogIds.has(normalized)) {
      badRequest(`Unknown teacher module: ${normalized}.`);
    }
    if (seen.has(normalized)) {
      badRequest(`Module ${normalized} appears more than once in the workspace layout.`);
    }
    seen.add(normalized);
    return normalized;
  });
}

function flattenPlacedModuleIds(layout) {
  return [
    ...layout.groups.flatMap((group) => group.moduleIds),
    ...layout.ungroupedModuleIds
  ];
}

function findWorkspaceLayout(accountStore) {
  return accountStore.list('workspaceLayouts').at(0);
}

function validateGroups(value, moduleIds) {
  const groupIds = new Set();
  const placedModuleIds = new Set();

  const groups = ensureArray(value, 'Groups').map((group, index) => {
    const body = ensureObject(group, `Group ${index + 1} must be an object.`);
    const id = ensureTrimmedString(body.id, `Group ${index + 1} ID`, { maxLength: 80 });
    if (groupIds.has(id)) {
      badRequest(`Group ${id} appears more than once in the workspace layout.`);
    }
    groupIds.add(id);

    const name = ensureTrimmedString(body.name, `Group ${index + 1} name`, { maxLength: 120 });
    const groupModuleIds = ensureUniqueModuleIds(body.moduleIds, `Group ${index + 1}`, moduleIds);
    for (const moduleId of groupModuleIds) {
      if (placedModuleIds.has(moduleId)) {
        badRequest(`Module ${moduleId} appears more than once in the workspace layout.`);
      }
      placedModuleIds.add(moduleId);
    }

    return { id, name, moduleIds: groupModuleIds };
  });

  return { groups, placedModuleIds };
}

function toPublicLayout(layout) {
  return {
    hiddenModuleIds: layout.hiddenModuleIds,
    groups: layout.groups,
    ungroupedModuleIds: layout.ungroupedModuleIds
  };
}

function layoutsEqual(left, right) {
  return JSON.stringify(toPublicLayout(left)) === JSON.stringify(toPublicLayout(right));
}

export function createDefaultWorkspaceLayout(moduleIds) {
  return {
    hiddenModuleIds: [],
    groups: [],
    ungroupedModuleIds: [...moduleIds]
  };
}

export function validateWorkspaceLayout(payload, moduleIds) {
  const body = ensureObject(payload);
  const hiddenModuleIds = ensureUniqueModuleIds(body.hiddenModuleIds, 'Hidden module IDs', moduleIds);
  const { groups, placedModuleIds } = validateGroups(body.groups, moduleIds);
  const ungroupedModuleIds = ensureUniqueModuleIds(body.ungroupedModuleIds, 'Ungrouped module IDs', moduleIds);

  for (const moduleId of ungroupedModuleIds) {
    if (placedModuleIds.has(moduleId)) {
      badRequest(`Module ${moduleId} appears more than once in the workspace layout.`);
    }
    placedModuleIds.add(moduleId);
  }

  for (const moduleId of hiddenModuleIds) {
    if (!placedModuleIds.has(moduleId)) {
      badRequest(`Hidden module ${moduleId} must have a layout position.`);
    }
  }

  return {
    hiddenModuleIds,
    groups,
    ungroupedModuleIds
  };
}

export function readWorkspaceLayout(dataStore, accountId, moduleIds) {
  const accountStore = dataStore.forAccount(accountId);
  const existingLayout = findWorkspaceLayout(accountStore);
  const storedLayout = existingLayout || accountStore.create('workspaceLayouts', {
    ...createDefaultWorkspaceLayout(moduleIds)
  });
  const hiddenModuleIds = [...new Set(storedLayout.hiddenModuleIds.filter((moduleId) => moduleIds.includes(moduleId)))];
  const placedModuleIds = new Set();
  const groups = storedLayout.groups.map((group) => ({
    id: group.id,
    name: group.name,
    moduleIds: group.moduleIds.filter((moduleId) => {
      if (!moduleIds.includes(moduleId) || placedModuleIds.has(moduleId)) return false;
      placedModuleIds.add(moduleId);
      return true;
    })
  }));
  const ungroupedModuleIds = storedLayout.ungroupedModuleIds.filter((moduleId) => {
    if (!moduleIds.includes(moduleId) || placedModuleIds.has(moduleId)) return false;
    placedModuleIds.add(moduleId);
    return true;
  });

  for (const moduleId of moduleIds) {
    if (!placedModuleIds.has(moduleId)) {
      ungroupedModuleIds.push(moduleId);
      placedModuleIds.add(moduleId);
    }
  }

  const resolvedLayout = { hiddenModuleIds, groups, ungroupedModuleIds };
  if (!layoutsEqual(storedLayout, resolvedLayout)) {
    accountStore.update('workspaceLayouts', storedLayout.id, resolvedLayout);
  }

  return resolvedLayout;
}

export function saveWorkspaceLayout(dataStore, accountId, payload, moduleIds) {
  const accountStore = dataStore.forAccount(accountId);
  const resolvedLayout = validateWorkspaceLayout(payload, moduleIds);
  const existingLayout = findWorkspaceLayout(accountStore);

  const placedModuleIds = new Set(flattenPlacedModuleIds(resolvedLayout));
  const previousModuleIds = existingLayout ? flattenPlacedModuleIds(existingLayout) : [];
  const missingModuleIds = [
    ...previousModuleIds.filter((moduleId) => moduleIds.includes(moduleId) && !placedModuleIds.has(moduleId)),
    ...moduleIds.filter((moduleId) => !placedModuleIds.has(moduleId) && !previousModuleIds.includes(moduleId))
  ];
  if (missingModuleIds.length) {
    resolvedLayout.ungroupedModuleIds.push(...missingModuleIds);
  }

  if (existingLayout) {
    accountStore.update('workspaceLayouts', existingLayout.id, resolvedLayout);
  } else {
    accountStore.create('workspaceLayouts', resolvedLayout);
  }

  return resolvedLayout;
}
