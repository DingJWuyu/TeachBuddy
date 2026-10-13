import i18n from '../../i18n/index.js';
/**
 * Web projection of the single static module catalog.
 *
 * The catalog owns the descriptors (id, name, path, navigation, auxiliary panel,
 * required public ports); this file maps them to the local page components and
 * fails loudly on a missing mapping, a duplicate id/path, an unknown requirement
 * or a dependency cycle, so a broken catalog cannot silently ship. The shared
 * catalog is the only source of descriptors (ADR 0001).
 */

import { moduleCatalog, modulePorts } from '@refatos/shared';
import QuestionsPage from '../questions/index.jsx';
import ResourceRoute from '../resources/ResourceRoute.jsx';
import { MathWorkbench } from '../math/index.jsx';

import { ClassesRoute } from '../classes/index.jsx';
import SchedulePage from '../schedule/index.jsx';
const localRegistry = {
  classes: { Page: ClassesRoute, icon: 'classes' },
  schedule: { Page: SchedulePage, icon: 'calendar' },
  questions: { Page: QuestionsPage, icon: 'book' },
  resources: { Page: ResourceRoute, icon: 'folder' },
  math: { Page: MathWorkbench, icon: 'graph' }
};

const PORT_PROVIDERS = Object.fromEntries(Object.entries(modulePorts).map(([name, descriptor]) => [name, descriptor.provider]));

export function resolveWorkbenchModules(descriptors = moduleCatalog) {
  const ids = new Set();
  const paths = new Set();
  const byId = new Map(descriptors.map((item) => [item.id, item]));

  function visit(moduleId, trail) {
    if (trail.includes(moduleId)) {
      throw new Error(`Module dependency cycle: ${[...trail, moduleId].join(' -> ')}`);
    }
    (byId.get(moduleId)?.requires || []).forEach((port) => {
      const provider = PORT_PROVIDERS[port];
      if (!provider) throw new Error(`Module "${moduleId}" requires unknown port "${port}".`);
      if (!byId.has(provider)) throw new Error(`Module "${moduleId}" requires missing module "${provider}".`);
      visit(provider, [...trail, moduleId]);
    });
  }

  descriptors.forEach((descriptor) => {
    if (!localRegistry[descriptor.id]) {
      throw new Error(`Module catalog entry "${descriptor.id}" has no local page mapping.`);
    }
    if (ids.has(descriptor.id)) throw new Error(`Duplicate module id: ${descriptor.id}`);
    if (paths.has(descriptor.path)) throw new Error(`Duplicate module path: ${descriptor.path}`);
    ids.add(descriptor.id);
    paths.add(descriptor.path);
    visit(descriptor.id, []);
  });

  return descriptors
    .map((descriptor) => ({
      ...descriptor,
      ...localRegistry[descriptor.id]
    }));
}

export const workbenchModules = resolveWorkbenchModules();

// The catalog name is data; localize only known product module identities.
export function moduleDisplayName(module) {
  const id = typeof module === 'string' ? module : module?.id;
  return localRegistry[id] ? i18n.t(`modules.${id}`, { ns: 'workbench' }) : module?.name ?? '';
}
