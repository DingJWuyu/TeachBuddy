export const teacherModuleCategories = {
  CORE: 'core',
  PLANNING: 'planning',
  PRODUCTIVITY: 'productivity',
  CONTENT: 'content-creation',
  LIBRARY: 'library'
};

export const starterModules = [
  {
    id: 'schedule-organizer',
    name: 'Schedule Organizer',
    category: teacherModuleCategories.PLANNING,
    description: 'Plan weekly classes, periods, and routines.'
  },
  {
    id: 'reminder-center',
    name: 'Reminder Center',
    category: teacherModuleCategories.PRODUCTIVITY,
    description: 'Track time-sensitive tasks and recurring reminders.'
  },
  {
    id: 'lesson-planner',
    name: 'Lesson Planner',
    category: teacherModuleCategories.PLANNING,
    description: 'Design class-ready lesson plans with objectives and activities.'
  },
  {
    id: 'worksheet-designer',
    name: 'Worksheet Designer',
    category: teacherModuleCategories.CONTENT,
    description: 'Draft worksheet layouts and export O-Level style papers.'
  },
  {
    id: 'resource-vault',
    name: 'Resource Vault',
    category: teacherModuleCategories.LIBRARY,
    description: 'Store attachments, lesson files, and reusable teaching resources.'
  }
];

export function buildManifest(moduleConfig) {
  return {
    version: '0.3.0',
    enabled: true,
    capabilities: ['create', 'read', 'update', 'delete'],
    ...moduleConfig
  };
}
