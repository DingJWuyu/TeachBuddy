import { moduleDefinition as scheduleOrganizer } from '../modules/schedule-organizer/index.js';
import { moduleDefinition as reminderCenter } from '../modules/reminder-center/index.js';
import { moduleDefinition as lessonPlanner } from '../modules/lesson-planner/index.js';
import { moduleDefinition as worksheetDesigner } from '../modules/worksheet-designer/index.js';
import { moduleDefinition as resourceVault } from '../modules/resource-vault/index.js';

const registeredModules = [scheduleOrganizer, reminderCenter, lessonPlanner, worksheetDesigner, resourceVault];

export function getModuleManifests() {
  return registeredModules.map((moduleItem) => moduleItem.manifest);
}

export function registerModules({ app, eventBus, dataStore }) {
  for (const moduleItem of registeredModules) {
    moduleItem.register({ app, eventBus, dataStore });
  }
}
