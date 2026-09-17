export const teacherModuleCategories = {
  CORE: 'core',
  PLANNING: 'planning',
  PRODUCTIVITY: 'productivity',
  CONTENT: 'content-creation',
  LIBRARY: 'library'
};

const registeredModuleCatalog = [
  {
    id: 'schedule-organizer',
    name: 'Schedule Organizer',
    category: teacherModuleCategories.PLANNING,
    categoryLabel: '规划',
    title: '排课管理',
    description: '查看和管理课程时段、日常安排与每周教学节奏。',
    icon: '日历',
    routesBasePath: '/api/modules/schedule-organizer'
  },
  {
    id: 'reminder-center',
    name: 'Reminder Center',
    category: teacherModuleCategories.PRODUCTIVITY,
    categoryLabel: '效率',
    title: '提醒中心',
    description: '跟踪截止日期、重复任务和关联的备课提醒。',
    icon: '提醒',
    routesBasePath: '/api/modules/reminder-center'
  },
  {
    id: 'lesson-planner',
    name: 'Lesson Planner',
    category: teacherModuleCategories.PLANNING,
    categoryLabel: '规划',
    title: '备课规划',
    description: '围绕教学目标、时长和教学重点规划课程流程。',
    icon: '备课',
    routesBasePath: '/api/modules/lesson-planner'
  },
  {
    id: 'worksheet-designer',
    name: 'Worksheet Designer',
    category: teacherModuleCategories.CONTENT,
    categoryLabel: '内容创作',
    title: '练习单设计',
    description: '准备练习单结构，并导出排版完善的文件。',
    icon: '练习单',
    routesBasePath: '/api/modules/worksheet-designer'
  },
  {
    id: 'resource-vault',
    name: 'Resource Vault',
    category: teacherModuleCategories.LIBRARY,
    categoryLabel: '资料库',
    title: '资源库',
    description: '集中存放并标记教学附件、资料笔记和可复用文件。',
    icon: '资源库',
    routesBasePath: '/api/modules/resource-vault'
  }
];

export const moduleCatalog = Object.freeze(registeredModuleCatalog.map((moduleItem) => Object.freeze({ ...moduleItem })));

// Kept as a compatibility alias for consumers of the original shared seed list.
export const starterModules = moduleCatalog;

export function getModuleMetadata(moduleId) {
  const moduleItem = moduleCatalog.find((item) => item.id === moduleId);
  if (!moduleItem) {
    throw new Error(`Unknown teacher module: ${moduleId}`);
  }
  return moduleItem;
}

export function buildManifest(moduleConfig = {}) {
  const {
    id,
    name: _name,
    title: _title,
    category: _category,
    categoryLabel: _categoryLabel,
    description: _description,
    icon: _icon,
    routesBasePath: _routesBasePath,
    ...runtimeConfig
  } = moduleConfig;
  const metadata = getModuleMetadata(id);

  return {
    version: '0.3.0',
    enabled: true,
    capabilities: ['create', 'read', 'update', 'delete'],
    ...metadata,
    ...runtimeConfig,
    id: metadata.id,
    routesBasePath: metadata.routesBasePath
  };
}
