import { moduleCatalog } from '@refatos/shared';
import { moduleDefinition as scheduleOrganizer } from '../modules/schedule-organizer/index.js';
import { moduleDefinition as reminderCenter } from '../modules/reminder-center/index.js';
import { moduleDefinition as lessonPlanner } from '../modules/lesson-planner/index.js';
import { moduleDefinition as worksheetDesigner } from '../modules/worksheet-designer/index.js';
import { moduleDefinition as resourceVault } from '../modules/resource-vault/index.js';

const moduleDefinitions = [scheduleOrganizer, reminderCenter, lessonPlanner, worksheetDesigner, resourceVault];
if (moduleDefinitions.length !== moduleCatalog.length) {
  throw new Error('Backend module definitions must cover the complete teacher module catalog.');
}
const registeredModules = moduleCatalog.map((metadata) => {
  const moduleItem = moduleDefinitions.find((definition) => definition.manifest.id === metadata.id);
  if (!moduleItem) {
    throw new Error(`Backend contribution missing for teacher module: ${metadata.id}`);
  }
  return moduleItem;
});

export function getModuleManifests() {
  return registeredModules.map((moduleItem) => moduleItem.manifest);
}

export function registerModules({ app, eventBus, dataStore }) {
  for (const moduleItem of registeredModules) {
    moduleItem.register({ app, eventBus, dataStore });
  }
}
