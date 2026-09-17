import StatCard from '../../components/StatCard.jsx';
import { dayLabels, localizeText, priorityLabels } from '../../utils/labels.js';

export default function DashboardPanel({ summary, reminders, schedule, lessons, worksheets, templates, onOpenModule }) {
  return (
    <section className="panel-stack">
      <section className="stats-grid">
        <StatCard label="即将开始的课程" value={summary.scheduleCount} hint="每周排课时段" />
        <StatCard label="待处理提醒" value={summary.reminderCount} hint="待完成任务" />
        <StatCard label="备课计划" value={summary.lessonCount} hint="可复用的教学流程" />
        <StatCard label="练习单草稿" value={summary.worksheetCount} hint="可直接导出的练习单" />
        <StatCard label="模板" value={summary.templateCount} hint="已保存的重复模式" />
        <StatCard label="资源" value={summary.resourceCount || 0} hint="资源库附件" />
      </section>

      <div className="card split-card align-center">
        <div>
          <p className="eyebrow">快速开始</p>
          <h2>选择下一步</h2>
        </div>
        <div className="inline-actions">
          <button className="primary-button" onClick={() => onOpenModule('lesson-planner')}>规划课程</button>
          <button className="ghost-button" onClick={() => onOpenModule('worksheet-designer')}>起草练习单</button>
          <button className="ghost-button" onClick={() => onOpenModule('resource-vault')}>打开资源库</button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card list-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">今日安排</p>
              <h3>提醒概览</h3>
            </div>
          </div>
          {reminders.slice(0, 4).map((item) => (
            <div key={item.id} className="item-card compact">
              <strong>{localizeText(item.title)}</strong>
              <p className="muted">{new Date(item.dueAt).toLocaleString('zh-CN')} | {priorityLabels[item.priority] || localizeText(item.priority)}</p>
            </div>
          ))}
        </div>
        <div className="card list-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">本周安排</p>
              <h3>排课概览</h3>
            </div>
          </div>
          {schedule.slice(0, 4).map((item) => (
            <div key={item.id} className="item-card compact">
              <strong>{dayLabels[item.day] || localizeText(item.day)} | {localizeText(item.subject)}</strong>
              <p className="muted">{localizeText(item.className)} | {item.startTime}-{item.endTime}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card list-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">备课区</p>
              <h3>最近课程</h3>
            </div>
          </div>
          {lessons.slice(0, 3).map((item) => (
            <div key={item.id} className="item-card compact">
              <strong>{localizeText(item.topic)}</strong>
              <p className="muted">{localizeText(item.className)} | {localizeText(item.duration)}</p>
            </div>
          ))}
        </div>
        <div className="card list-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">内容区</p>
              <h3>最近练习单</h3>
            </div>
          </div>
          {worksheets.slice(0, 3).map((item) => (
            <div key={item.id} className="item-card compact">
              <strong>{localizeText(item.title)}</strong>
              <p className="muted">{localizeText(item.className)} | {localizeText(item.topic)}</p>
            </div>
          ))}
          <p className="muted tiny-text">可用模板：{templates.length}</p>
        </div>
      </div>
    </section>
  );
}
