import { useMemo, useState } from 'react';
import ResourcePicker from '../../components/ResourcePicker.jsx';
import { localizeText } from '../../utils/labels.js';

const initialForm = {
  topic: '',
  className: '',
  objective: '',
  duration: '35 分钟',
  materials: '',
  starter: '',
  mainActivity: '',
  assessment: '',
  resourceIds: []
};

function normalize(payload) {
  return {
    ...payload,
    resourceIds: Array.isArray(payload.resourceIds) ? payload.resourceIds : []
  };
}

export default function LessonPlannerPanel({
  title,
  data,
  templates = [],
  resources = [],
  onCreate,
  onUpdate,
  onDelete,
  onSaveTemplate,
  onDeleteTemplate,
  onGenerateWorksheet
}) {
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [templateName, setTemplateName] = useState('');

  const filteredData = useMemo(() => data.filter((item) => (
    `${item.topic} ${item.className} ${item.objective} ${item.materials || ''}`.toLowerCase().includes(search.toLowerCase())
  )), [data, search]);

  function handleSubmit(event) {
    event.preventDefault();
    const payload = normalize(form);

    if (editingId) {
      onUpdate(editingId, payload);
      setEditingId(null);
    } else {
      onCreate(payload);
    }

    setForm(initialForm);
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      topic: item.topic,
      className: item.className,
      objective: item.objective,
      duration: item.duration,
      materials: item.materials || '',
      starter: item.starter || '',
      mainActivity: item.mainActivity || '',
      assessment: item.assessment || '',
      resourceIds: item.resourceIds || []
    });
  }

  function applyTemplate(template) {
    setForm({
      ...initialForm,
      ...template.payload,
      resourceIds: template.payload.resourceIds || []
    });
  }

  function saveCurrentTemplate() {
    if (!templateName.trim()) return;
    onSaveTemplate(templateName.trim(), normalize(form));
    setTemplateName('');
  }

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <h2>{title}</h2>
          <p className="muted">规划课程、关联资源库中的实际资料，然后一键生成练习单草稿。</p>
        </div>
        <span className="badge">{data.length} 个计划</span>
      </div>

      <div className="card split-card align-center">
        <div>
          <p className="eyebrow">模板</p>
          <h3>可复用的课程结构</h3>
        </div>
        <div className="inline-actions">
          <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="模板名称" />
          <button className="ghost-button" type="button" onClick={saveCurrentTemplate}>将当前表单保存为模板</button>
        </div>
      </div>

      {templates.length > 0 && (
        <div className="template-grid">
          {templates.map((template) => (
            <div key={template.id} className="mini-card">
              <strong>{localizeText(template.name)}</strong>
              <p className="muted">时长：{localizeText(template.payload.duration) || '未设置'}</p>
              <div className="inline-actions">
                <button className="ghost-button" type="button" onClick={() => applyTemplate(template)}>应用</button>
                <button className="danger-button" type="button" onClick={() => onDeleteTemplate(template.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>{editingId ? '编辑课程计划' : '创建课程计划'}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            <span>主题</span>
            <input value={localizeText(form.topic)} onChange={(event) => setForm({ ...form, topic: event.target.value })} placeholder="单摆" required />
          </label>
          <label>
            <span>班级</span>
            <input value={localizeText(form.className)} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="STD VI" required />
          </label>
          <label>
            <span>时长</span>
            <input value={localizeText(form.duration)} onChange={(event) => setForm({ ...form, duration: event.target.value })} placeholder="35 分钟" required />
          </label>
          <label className="full-span">
            <span>教学目标</span>
            <textarea value={localizeText(form.objective)} onChange={(event) => setForm({ ...form, objective: event.target.value })} required />
          </label>
          <label className="full-span">
            <span>教学材料</span>
            <textarea value={localizeText(form.materials)} onChange={(event) => setForm({ ...form, materials: event.target.value })} placeholder="书籍、器材、图示等..." />
          </label>
          <label className="full-span">
            <span>导入活动</span>
            <textarea value={localizeText(form.starter)} onChange={(event) => setForm({ ...form, starter: event.target.value })} placeholder="引入、热身或导入问题..." />
          </label>
          <label className="full-span">
            <span>主要活动</span>
            <textarea value={localizeText(form.mainActivity)} onChange={(event) => setForm({ ...form, mainActivity: event.target.value })} placeholder="教学流程、板书或实验..." />
          </label>
          <label className="full-span">
            <span>评估方式</span>
            <textarea value={localizeText(form.assessment)} onChange={(event) => setForm({ ...form, assessment: event.target.value })} placeholder="离堂小测、口头提问或家庭作业..." />
          </label>
          <div className="full-span">
            <ResourcePicker
              resources={resources}
              selectedIds={form.resourceIds}
              onChange={(resourceIds) => setForm({ ...form, resourceIds })}
              label="课程资源"
              helperText="选择资源库中的项目，不要手动输入资源 ID。"
            />
          </div>
          <div className="full-span form-actions">
            <button className="primary-button" type="submit">{editingId ? '更新课程计划' : '保存课程计划'}</button>
            {editingId && (
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(initialForm);
                }}
              >
               取消编辑
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索主题、班级、教学目标和材料..." />
        </div>
      </div>

      <div className="card list-card">
        {filteredData.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-card-header">
              <div>
                <strong>{localizeText(item.topic)}</strong>
                <p className="muted">{localizeText(item.className)} | {localizeText(item.duration)}</p>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" onClick={() => onGenerateWorksheet(item.id)}>自动起草练习单</button>
                <button className="ghost-button" onClick={() => handleEdit(item)}>编辑</button>
                <button className="danger-button" onClick={() => onDelete(item.id)}>删除</button>
              </div>
            </div>
            <p><strong>教学目标：</strong> {localizeText(item.objective)}</p>
            {item.materials && <p><strong>教学材料：</strong> {localizeText(item.materials)}</p>}
            {item.starter && <p><strong>导入活动：</strong> {localizeText(item.starter)}</p>}
            {item.mainActivity && <p><strong>主要活动：</strong> {localizeText(item.mainActivity)}</p>}
            {item.assessment && <p><strong>评估方式：</strong> {localizeText(item.assessment)}</p>}
            {item.resourceIds?.length ? (
              <p><strong>资源：</strong> {item.resourceIds.map((resourceId) => localizeText(resources.find((resource) => resource.id === resourceId)?.title || resourceId)).join('、')}</p>
            ) : null}
          </div>
        ))}
        {!filteredData.length && <p className="muted">没有符合搜索条件的课程计划。</p>}
      </div>
    </section>
  );
}
