/** Current question/resource composition used by the isolated first-flow harness. */
import { moduleCatalog } from '@refatos/shared';
import { createWorkbench } from '../../../src/workbench/index.js';
import { moduleImplementations } from '../../../src/workbench/moduleImplementations.js';
export function createB16Workbench({ env }) {
  return createWorkbench({
    env: { ...env, workbench: { ...env.workbench, catalogOverride: moduleCatalog.filter(item => ['questions', 'resources'].includes(item.id)).map(item => ({...item, requires: item.requires.filter(port=>!port.startsWith('math.'))})) } },
    implementations: { questions: moduleImplementations.questions, resources: moduleImplementations.resources }
  });
}
