import { moduleCatalog } from '@refatos/shared';
import LessonPlannerPanel from '../lesson-planner/Panel.jsx';
import ReminderCenterPanel from '../reminder-center/Panel.jsx';
import ResourceVaultPanel from '../resource-vault/Panel.jsx';
import ScheduleOrganizerPanel from '../schedule-organizer/Panel.jsx';
import WorksheetDesignerPanel from '../worksheet-designer/Panel.jsx';
import { dayLabels, localizeText, priorityLabels } from '../../utils/labels.js';

function apiEndpoint(routesBasePath) {
  return routesBasePath.replace(/^\/api/, '');
}

const frontendContributions = {
  'schedule-organizer': {
    panel: ScheduleOrganizerPanel,
    coreEntry: {
      stats: [
        {
          id: 'schedule-count',
          label: '即将开始的课程',
          hint: '每周排课时段',
          value: ({ items }) => items.length
        }
      ],
      cards: [
        {
          id: 'schedule-overview',
          group: 'calendar',
          order: 1,
          eyebrow: '本周安排',
          title: '排课概览',
          items: ({ items }) => items.slice(0, 4),
          itemTitle: (item) => `${dayLabels[item.day] || localizeText(item.day)} | ${localizeText(item.subject)}`,
          itemMeta: (item) => `${localizeText(item.className)} | ${item.startTime}-${item.endTime}`
        }
      ]
    }
  },
  'reminder-center': {
    panel: ReminderCenterPanel,
    coreEntry: {
      stats: [
        {
          id: 'pending-reminder-count',
          label: '待处理提醒',
          hint: '待完成任务',
          value: ({ items }) => items.filter((item) => item.status !== 'done').length
        }
      ],
      cards: [
        {
          id: 'reminder-overview',
          group: 'calendar',
          order: 0,
          eyebrow: '今日安排',
          title: '提醒概览',
          items: ({ items }) => items.slice(0, 4),
          itemTitle: (item) => localizeText(item.title),
          itemMeta: (item) => `${new Date(item.dueAt).toLocaleString('zh-CN')} | ${priorityLabels[item.priority] || localizeText(item.priority)}`
        }
      ],
      actions: {
        completeRecurring: ({ endpoint, id, postJson }) => postJson(`${endpoint}/${id}/complete`, {})
      },
      messages: {
        completeRecurring: '提醒已完成。下一次重复提醒会在适用时自动安排。'
      }
    }
  },
  'lesson-planner': {
    panel: LessonPlannerPanel,
    data: {
      resourceSourceModuleId: 'resource-vault'
    },
    coreEntry: {
      stats: [
        {
          id: 'lesson-count',
          label: '备课计划',
          hint: '可复用的教学流程',
          value: ({ items }) => items.length
        }
      ],
      cards: [
        {
          id: 'lesson-overview',
          group: 'recent',
          order: 0,
          eyebrow: '备课区',
          title: '最近课程',
          items: ({ items }) => items.slice(0, 3),
          itemTitle: (item) => localizeText(item.topic),
          itemMeta: (item) => `${localizeText(item.className)} | ${localizeText(item.duration)}`
        }
      ],
      quickActions: [
        { id: 'open-lesson-planner', label: '规划课程', targetModuleId: 'lesson-planner', variant: 'primary' }
      ]
    },
    messages: {
      create: '课程已保存，同时已创建自动提醒。',
      generateWorksheet: '已根据课程计划创建练习单草稿。'
    },
    actions: {
      generateWorksheet: async ({ endpoint, id, postJson, setActiveModuleId }) => {
        await postJson(`${endpoint}/${id}/generate-worksheet-draft`, {});
        setActiveModuleId('worksheet-designer');
      }
    }
  },
  'worksheet-designer': {
    panel: WorksheetDesignerPanel,
    data: {
      resourceSourceModuleId: 'resource-vault'
    },
    coreEntry: {
      stats: [
        {
          id: 'worksheet-count',
          label: '练习单草稿',
          hint: '可直接导出的练习单',
          value: ({ items }) => items.length
        },
        {
          id: 'template-count',
          label: '模板',
          hint: '已保存的重复模式',
          value: ({ templates }) => templates.length
        }
      ],
      cards: [
        {
          id: 'worksheet-overview',
          group: 'recent',
          order: 1,
          eyebrow: '内容区',
          title: '最近练习单',
          items: ({ items }) => items.slice(0, 3),
          itemTitle: (item) => localizeText(item.title),
          itemMeta: (item) => `${localizeText(item.className)} | ${localizeText(item.topic)}`,
          footer: ({ templates }) => `可用模板：${templates.length}`
        }
      ],
      quickActions: [
        { id: 'open-worksheet-designer', label: '起草练习单', targetModuleId: 'worksheet-designer', variant: 'secondary' }
      ]
    }
  },
  'resource-vault': {
    panel: ResourceVaultPanel,
    coreEntry: {
      stats: [
        {
          id: 'resource-count',
          label: '资源',
          hint: '资源库附件',
          value: ({ items }) => items.length
        }
      ],
      quickActions: [
        { id: 'open-resource-vault', label: '打开资源库', targetModuleId: 'resource-vault', variant: 'secondary' }
      ]
    },
    actions: {
      uploadResource: ({ endpoint, formData, postForm }) => postForm(`${endpoint}/upload`, formData)
    },
    messages: {
      uploadResource: '资源已上传。'
    }
  }
};

const catalogIds = new Set(moduleCatalog.map((moduleItem) => moduleItem.id));
const contributionIds = Object.keys(frontendContributions);
if (contributionIds.length !== catalogIds.size || contributionIds.some((moduleId) => !catalogIds.has(moduleId))) {
  throw new Error('Frontend module contributions must cover the complete teacher module catalog.');
}

function createFrontendModule(metadata) {
  const contribution = frontendContributions[metadata.id];
  if (!contribution) {
    throw new Error(`Frontend contribution missing for teacher module: ${metadata.id}`);
  }

  return {
    ...metadata,
    ...contribution,
    data: {
      endpoint: apiEndpoint(metadata.routesBasePath),
      selectItems: (response) => response.items,
      ...contribution.data
    }
  };
}

export const frontendModules = moduleCatalog.map(createFrontendModule);

export function getFrontendModule(moduleId) {
  return frontendModules.find((moduleItem) => moduleItem.id === moduleId);
}
