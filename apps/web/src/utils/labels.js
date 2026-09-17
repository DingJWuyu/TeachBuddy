import { moduleCatalog } from '@refatos/shared';

export const moduleLabels = Object.fromEntries(moduleCatalog.map((moduleItem) => [moduleItem.id, moduleItem.title]));

export const dayLabels = {
  Sunday: '星期日',
  Monday: '星期一',
  Tuesday: '星期二',
  Wednesday: '星期三',
  Thursday: '星期四'
};

export const priorityLabels = {
  low: '低',
  medium: '中',
  high: '高'
};

export const statusLabels = {
  all: '全部状态',
  pending: '待处理',
  done: '已完成'
};

export const recurrenceLabels = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月'
};

export const worksheetFormatLabels = {
  'O-Level structured': 'O-Level 结构化试卷',
  'Mixed worksheet': '混合练习单',
  'MCQ + structured': '选择题 + 结构化题',
  'Practical investigation': '实践探究'
};

export const questionTypeLabels = {
  structured: '结构化题',
  'short-answer': '简答题',
  diagram: '图示题',
  mcq: '选择题',
  investigation: '探究题',
  'starter-recall': '基础回顾题',
  'objective-check': '目标检查题',
  method: '方法题',
  assessment: '评估题',
  'diagram-structured': '图示结构题'
};

const demoTextLabels = {
  'Refat Teacher': 'Refat 老师',
  Physics: '物理',
  Mathematics: '数学',
  'Room 3': '3 号教室',
  'Room 1': '1 号教室',
  'Pendulum practical prep': '单摆实验准备',
  'Revision on fractions': '分数复习',
  'Prepare CT paper for STD IX Physics': '准备九年级物理测验卷',
  'Simple Pendulum': '单摆',
  'Explain oscillation and time period.': '解释振动和周期。',
  '35 min': '35 分钟',
  '40 min': '40 分钟',
  'String, bob, stopwatch, metre rule': '细绳、摆锤、秒表、米尺',
  'Ask students what makes swings go faster or slower.': '询问学生是什么让秋千摆动得更快或更慢。',
  'Measure time for 10 oscillations for different lengths.': '测量不同长度下完成 10 次振动所需的时间。',
  'Exit ticket on time period and oscillation.': '用离堂小测检验周期和振动。',
  'Quick recall quiz from last class.': '上节课内容快速回顾测验。',
  'Board explanation, guided examples, and pair discussion.': '板书讲解、示例引导和同伴讨论。',
  'Short exit ticket with 3 questions.': '包含 3 道题的简短离堂小测。',
  'Electricity & Magnetism Practice': '电与磁练习',
  'Current electricity': '电流',
  'Show all working. Use dotted answer spaces.': '写出完整解题过程。使用点状答题区。',
  'Answer all questions. Show all working. Leave space for diagrams where needed.': '回答所有问题，写出完整解题过程，并在需要时为图示留出空间。',
  'Answer all questions. Use dotted answer lines. Leave blank space for diagrams where necessary.': '回答所有问题，使用点状答题线，并在必要时为图示留出空白区域。',
  'Answer all questions. Show all working. Use dotted answer spaces and blank space for diagrams.': '回答所有问题，写出完整解题过程，使用点状答题区，并为图示留出空白区域。',
  'Pendulum Investigation Notes': '单摆探究笔记',
  'Theory Lesson Starter': '理论课导入模板',
  'CT O-Level Short Paper': 'O-Level 测验短卷',
  'Describe the method used in class.': '描述课堂中使用的方法。',
  'Answer the final checkpoint question.': '回答最后的检查问题。'
};

const tagLabels = {
  science: '科学',
  pendulum: '单摆',
  'std-vi': '六年级'
};

const fieldLabels = {
  Name: '显示名称',
  Email: '邮箱',
  Password: '密码',
  'Password confirmation': '确认密码',
  'Module ID': '模块 ID',
  'Template name': '模板名称',
  'Template payload': '模板内容',
  Topic: '主题',
  Class: '班级',
  Duration: '时长',
  Objective: '教学目标',
  Materials: '教学材料',
  Starter: '导入活动',
  'Main activity': '主要活动',
  Assessment: '评估方式',
  Title: '标题',
  'Due date': '截止日期',
  Priority: '优先级',
  Status: '状态',
  'Linked item': '关联项目',
  Source: '来源',
  Recurrence: '重复',
  'Recurrence interval': '重复间隔',
  Day: '星期',
  'Start time': '开始时间',
  'End time': '结束时间',
  Subject: '科目',
  Room: '教室',
  Note: '备注',
  Tags: '标签',
  'Module links': '关联模块',
  'Resource IDs': '资源 ID',
  'Question count': '题目数量',
  'Total marks': '总分',
  Instructions: '说明',
  'Generated from lesson ID': '来源课程 ID',
  Value: '值',
  number: '编号',
  type: '题型',
  prompt: '题目',
  marks: '分值',
  lines: '答题行数'
};

const enumValueLabels = {
  low: '低',
  medium: '中',
  high: '高',
  pending: '待处理',
  done: '已完成',
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  'O-Level structured': 'O-Level 结构化试卷',
  'Mixed worksheet': '混合练习单',
  'MCQ + structured': '选择题 + 结构化题',
  'Practical investigation': '实践探究'
};

const errorLabels = {
  'Invalid request body.': '请求内容无效。',
  'Invalid email or password.': '邮箱或密码错误。',
  'An account with that email already exists.': '该邮箱已注册，请使用其他邮箱。',
  'Passwords do not match.': '两次输入的密码不一致。',
  'Login failed.': '登录失败。',
  'Could not load RefatOS data.': '无法加载 RefatOS 数据。',
  'Something went wrong.': '出了点问题。',
  'Authentication required.': '请先登录。',
  'Template not found.': '找不到模板。',
  'Schedule item not found.': '找不到排课时段。',
  'End time must be later than start time.': '结束时间必须晚于开始时间。',
  'This time slot clashes with an existing class.': '该时段与现有课程冲突。',
  'Updated slot clashes with another class.': '更新后的时段与其他课程冲突。',
  'Lesson plan not found.': '找不到课程计划。',
  'Reminder not found.': '找不到提醒。',
  'A file upload is required.': '请上传文件。',
  'Upload metadata is required.': '请填写资源信息。',
  'Resource not found.': '找不到资源。',
  'Worksheet draft not found.': '找不到练习单草稿。',
  'Route not found': '找不到请求的路由。',
  'Internal server error': '服务器内部错误。'
};

export function localizeText(value) {
  if (typeof value !== 'string') return value;
  if (demoTextLabels[value]) return demoTextLabels[value];

  const autoWorksheetMatch = value.match(/^(.+) - Auto Worksheet$/);
  if (autoWorksheetMatch) return `${localizeText(autoWorksheetMatch[1])} - 自动练习单`;

  const reviewLessonMatch = value.match(/^Review lesson plan: (.+)$/);
  if (reviewLessonMatch) return `复习课程计划：${localizeText(reviewLessonMatch[1])}`;

  const questionMatch = value.match(/^Question (\d+) on (.+)$/);
  if (questionMatch) return `第 ${questionMatch[1]} 题，主题：${localizeText(questionMatch[2])}`;

  const stateFactMatch = value.match(/^State one fact about (.+)\.$/);
  if (stateFactMatch) return `说出关于${localizeText(stateFactMatch[1])}的一条事实。`;

  const mainIdeaMatch = value.match(/^Explain the main idea of (.+)\.$/);
  if (mainIdeaMatch) return `解释${localizeText(mainIdeaMatch[1])}的主要概念。`;

  const diagramMatch = value.match(/^Draw and label a diagram related to (.+)\.$/);
  if (diagramMatch) return `绘制并标注与${localizeText(diagramMatch[1])}相关的图示。`;

  const drawDiagramMatch = value.match(/^Draw, label, or interpret a diagram for (.+)\.$/);
  if (drawDiagramMatch) return `绘制、标注或解读关于${localizeText(drawDiagramMatch[1])}的图示。`;

  const answerQuestionMatch = value.match(/^Answer question (\d+) about (.+)\.$/);
  if (answerQuestionMatch) return `回答关于${localizeText(answerQuestionMatch[2])}的第 ${answerQuestionMatch[1]} 题。`;

  return value;
}

export function localizeTag(tag) {
  return tagLabels[tag] || tag;
}

export function localizeTagList(value) {
  if (typeof value !== 'string') return value;
  return value.split(',').map((tag) => localizeTag(tag.trim())).join(', ');
}

export function localizeModuleId(moduleId) {
  return moduleLabels[moduleId] || moduleId;
}

function localizeFieldLabel(label) {
  const questionLabelMatch = label.match(/^Question (\d+) (.+)$/);
  if (questionLabelMatch) {
    return `第 ${questionLabelMatch[1]} 题的${fieldLabels[questionLabelMatch[2]] || questionLabelMatch[2]}`;
  }
  const questionOnlyMatch = label.match(/^Question (\d+)$/);
  if (questionOnlyMatch) return `第 ${questionOnlyMatch[1]} 题`;
  return fieldLabels[label] || label;
}

export function localizeQuestionType(type) {
  return questionTypeLabels[type] || localizeText(type);
}

export function localizeWorksheetFormat(format) {
  return worksheetFormatLabels[format] || localizeText(format);
}

export function localizeError(message) {
  if (!message) return message;
  if (errorLabels[message]) return errorLabels[message];

  const requiredMatch = message.match(/^(.+) is required\.$/);
  if (requiredMatch) {
    return `${localizeFieldLabel(requiredMatch[1])}为必填项。`;
  }

  const characterLimitMatch = message.match(/^(.+) must be (\d+) characters or fewer\.$/);
  if (characterLimitMatch) return `${localizeFieldLabel(characterLimitMatch[1])}不得超过 ${characterLimitMatch[2]} 个字符。`;

  const itemCharacterLimitMatch = message.match(/^(.+) items must be (\d+) characters or fewer\.$/);
  if (itemCharacterLimitMatch) return `${localizeFieldLabel(itemCharacterLimitMatch[1])}中的每项不得超过 ${itemCharacterLimitMatch[2]} 个字符。`;

  const textMatch = message.match(/^(.+) must be text\.$/);
  if (textMatch) return `${localizeFieldLabel(textMatch[1])}必须是文本。`;

  const objectMatch = message.match(/^(.+) must be an object\.$/);
  if (objectMatch) return `${localizeFieldLabel(objectMatch[1])}必须是对象。`;

  const enumMatch = message.match(/^(.+) must be one of: (.+)\.$/);
  if (enumMatch) {
    const allowedValues = enumMatch[2]
      .split(', ')
      .map((value) => enumValueLabels[value] || value)
      .join('、');
    return `${localizeFieldLabel(enumMatch[1])}必须是以下值之一：${allowedValues}。`;
  }

  const integerMinMatch = message.match(/^(.+) must be an integer greater than or equal to (\d+)\.$/);
  if (integerMinMatch) return `${localizeFieldLabel(integerMinMatch[1])}必须是大于或等于 ${integerMinMatch[2]} 的整数。`;

  const integerMaxMatch = message.match(/^(.+) must be less than or equal to (\d+)\.$/);
  if (integerMaxMatch) return `${localizeFieldLabel(integerMaxMatch[1])}必须小于或等于 ${integerMaxMatch[2]}。`;

  const dateMatch = message.match(/^(.+) must be a valid date\/time\.$/);
  if (dateMatch) return `${localizeFieldLabel(dateMatch[1])}必须是有效的日期/时间。`;

  const timeMatch = message.match(/^(.+) must use HH:MM format\.$/);
  if (timeMatch) return `${localizeFieldLabel(timeMatch[1])}必须使用 HH:MM 格式。`;

  const corsMatch = message.match(/^Origin (.+) is not allowed by CORS\.$/);
  if (corsMatch) return `来源 ${corsMatch[1]} 不在允许的跨域来源列表中。`;

  const requestMatch = message.match(/^Request failed for (.+)$/);
  if (requestMatch) return `请求失败：${requestMatch[1]}`;

  return message;
}
