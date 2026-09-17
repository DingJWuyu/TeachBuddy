import LessonPlannerPanel from '../lesson-planner/Panel.jsx';
import ReminderCenterPanel from '../reminder-center/Panel.jsx';
import ResourceVaultPanel from '../resource-vault/Panel.jsx';
import ScheduleOrganizerPanel from '../schedule-organizer/Panel.jsx';
import WorksheetDesignerPanel from '../worksheet-designer/Panel.jsx';

export const frontendModules = [
  {
    id: 'schedule-organizer',
    title: '排课管理',
    category: '规划',
    description: '查看和管理课程时段、日常安排与每周教学节奏。',
    icon: '日历',
    panel: ScheduleOrganizerPanel
  },
  {
    id: 'reminder-center',
    title: '提醒中心',
    category: '效率',
    description: '跟踪截止日期、重复任务和关联的备课提醒。',
    icon: '提醒',
    panel: ReminderCenterPanel
  },
  {
    id: 'lesson-planner',
    title: '备课规划',
    category: '规划',
    description: '围绕教学目标、时长和教学重点规划课程流程。',
    icon: '备课',
    panel: LessonPlannerPanel
  },
  {
    id: 'worksheet-designer',
    title: '练习单设计',
    category: '内容创作',
    description: '准备练习单结构，并导出排版完善的文件。',
    icon: '练习单',
    panel: WorksheetDesignerPanel
  },
  {
    id: 'resource-vault',
    title: '资源库',
    category: '资料库',
    description: '集中存放并标记教学附件、资料笔记和可复用文件。',
    icon: '资源库',
    panel: ResourceVaultPanel
  }
];
