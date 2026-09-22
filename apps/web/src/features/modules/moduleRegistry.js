/**
 * Web projection of the single static module catalog.
 *
 * The catalog owns the descriptors (id, name, path, navigation, auxiliary panel,
 * required public ports); this file maps them to the local page components and
 * fails loudly on a missing mapping, a duplicate id/path, an unknown requirement
 * or a dependency cycle, so a broken catalog cannot silently ship. The shared
 * catalog is the only source of descriptors (ADR 0001).
 */

import { moduleCatalog } from '@refatos/shared';
import QuestionsPage from '../questions/index.jsx';
import LessonsPage from '../lessons/index.jsx';

const localRegistry = {
  questions: { Page: QuestionsPage, icon: 'bank' },
  lessons: { Page: LessonsPage, icon: 'prep' }
};

const PORT_PROVIDERS = {
  'questions.readForReference': 'questions'
};

export function resolveWorkbenchModules() {
  const descriptors = moduleCatalog;
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
    .filter((descriptor) => descriptor.navigation === 'sidebar')
    .map((descriptor) => ({
      ...descriptor,
      ...localRegistry[descriptor.id]
    }));
}

/**
 * The previous shell keeps its own module list: its layout API has not reported
 * any module, and the workbench catalog is not a replacement for that legacy
 * contract.
 */
export const frontendModules = Object.freeze([]);
