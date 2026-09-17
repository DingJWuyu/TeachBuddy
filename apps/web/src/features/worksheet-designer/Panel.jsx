import { useMemo, useState } from 'react';
import ResourcePicker from '../../components/ResourcePicker.jsx';
import { fetchJson } from '../../utils/api.js';
import { localizeQuestionType, localizeText, localizeWorksheetFormat } from '../../utils/labels.js';

function buildQuestion(number, marks = 3, topic = '') {
  return {
    number,
    type: 'structured',
    prompt: topic ? `第 ${number} 题，主题：${topic}` : '',
    marks,
    lines: 4,
    diagramSpace: false
  };
}

function syncQuestionItems(questionCount, marks, topic, currentItems = []) {
  const safeCount = Math.max(1, Number(questionCount || 1));
  const defaultMarks = Math.max(1, Math.round(Number(marks || safeCount) / safeCount));
  const nextItems = Array.from({ length: safeCount }, (_, index) => {
    const currentItem = currentItems[index];
    if (currentItem) {
      return {
        ...currentItem,
        number: index + 1,
        marks: Number(currentItem.marks || defaultMarks),
        lines: Number(currentItem.lines ?? 4),
        prompt: currentItem.prompt || buildQuestion(index + 1, defaultMarks, topic).prompt
      };
    }
    return buildQuestion(index + 1, defaultMarks, topic);
  });

  return nextItems;
}

const initialForm = {
  title: '',
  className: '',
  topic: '',
  format: 'O-Level structured',
  marks: 15,
  duration: '35 分钟',
  questionCount: 5,
  instructions: '回答所有问题，写出完整解题过程，并在需要时为图示留出空间。',
  resourceIds: [],
  questionItems: syncQuestionItems(5, 15, '')
};

function normalize(payload) {
  const marks = Number(payload.marks);
  const questionCount = Number(payload.questionCount);
  const questionItems = syncQuestionItems(questionCount, marks, payload.topic, payload.questionItems).map((question, index) => ({
    ...question,
    number: index + 1,
    marks: Number(question.marks),
    lines: Number(question.lines),
    diagramSpace: Boolean(question.diagramSpace)
  }));

  return {
    ...payload,
    marks,
    questionCount,
    resourceIds: Array.isArray(payload.resourceIds) ? payload.resourceIds : [],
    questionItems
  };
}

export default function WorksheetDesignerPanel({
  title,
  data,
  templates = [],
  resources = [],
  onCreate,
  onUpdate,
  onDelete,
  onSaveTemplate,
  onDeleteTemplate,
  onOpenExport
}) {
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [exportSpec, setExportSpec] = useState(null);

  const filteredData = useMemo(() => data.filter((item) => (
    `${item.title} ${item.className} ${item.topic} ${item.format}`.toLowerCase().includes(search.toLowerCase())
  )), [data, search]);

  function setQuestionCount(nextCount) {
    const questionCount = Number(nextCount);
    setForm((currentForm) => ({
      ...currentForm,
      questionCount,
      questionItems: syncQuestionItems(questionCount, currentForm.marks, currentForm.topic, currentForm.questionItems)
    }));
  }

  function setMarks(nextMarks) {
    const marks = Number(nextMarks);
    setForm((currentForm) => ({
      ...currentForm,
      marks,
      questionItems: syncQuestionItems(currentForm.questionCount, marks, currentForm.topic, currentForm.questionItems)
    }));
  }

  function setTopic(nextTopic) {
    setForm((currentForm) => ({
      ...currentForm,
      topic: nextTopic,
      questionItems: syncQuestionItems(currentForm.questionCount, currentForm.marks, nextTopic, currentForm.questionItems)
    }));
  }

  function updateQuestionItem(index, updates) {
    setForm((currentForm) => ({
      ...currentForm,
      questionItems: currentForm.questionItems.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...updates, number: index + 1 } : item
      ))
    }));
  }

  function autoFillQuestions() {
    setForm((currentForm) => ({
      ...currentForm,
      questionItems: syncQuestionItems(currentForm.questionCount, currentForm.marks, currentForm.topic, []).map((item, index) => ({
        ...item,
        type: index % 3 === 2 ? 'diagram' : 'structured',
        prompt: currentForm.topic
          ? index % 3 === 2
            ? `绘制、标注或解读关于${currentForm.topic}的图示。`
            : `回答关于${currentForm.topic}的第 ${index + 1} 题。`
          : item.prompt,
        diagramSpace: index % 3 === 2,
        lines: index % 3 === 2 ? 2 : 5
      }))
    }));
  }

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
      ...initialForm,
      ...item,
      marks: Number(item.marks),
      questionCount: Number(item.questionCount),
      resourceIds: item.resourceIds || [],
      questionItems: syncQuestionItems(item.questionCount, item.marks, item.topic, item.questionItems || [])
    });
  }

  function applyTemplate(template) {
    const templateForm = {
      ...initialForm,
      ...template.payload,
      marks: Number(template.payload.marks ?? initialForm.marks),
      questionCount: Number(template.payload.questionCount ?? initialForm.questionCount),
      resourceIds: template.payload.resourceIds || []
    };

    setForm({
      ...templateForm,
      questionItems: syncQuestionItems(templateForm.questionCount, templateForm.marks, templateForm.topic, template.payload.questionItems || [])
    });
  }

  function saveCurrentTemplate() {
    if (!templateName.trim()) return;
    onSaveTemplate(templateName.trim(), normalize(form));
    setTemplateName('');
  }

  async function loadExportSpec(itemId) {
    const spec = await fetchJson(`/modules/worksheet-designer/${itemId}/export/spec`);
    setExportSpec(spec);
  }

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <h2>{title}</h2>
          <p className="muted">导出功能已经就绪，现在可以预览、导出 DOCX 和 PDF，并在导出前调整每道题。</p>
        </div>
        <span className="badge">{data.length} 份草稿</span>
      </div>

      <div className="card split-card align-center">
        <div>
          <p className="eyebrow">模板</p>
          <h3>可复用的练习单设置</h3>
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
              <p className="muted">{localizeWorksheetFormat(template.payload.format) || '练习单模板'}</p>
              <div className="inline-actions">
                <button className="ghost-button" type="button" onClick={() => applyTemplate(template)}>应用</button>
                <button className="danger-button" type="button" onClick={() => onDeleteTemplate(template.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>{editingId ? '编辑练习单草稿' : '创建练习单草稿'}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="full-span">
            <span>标题</span>
            <input value={localizeText(form.title)} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="测验 1 - 物理" required />
          </label>
          <label>
            <span>班级</span>
            <input value={localizeText(form.className)} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="STD IX" required />
          </label>
          <label>
            <span>主题</span>
            <input value={localizeText(form.topic)} onChange={(event) => setTopic(event.target.value)} placeholder="电与磁" required />
          </label>
          <label>
            <span>格式</span>
            <select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}>
              <option value="O-Level structured">O-Level 结构化试卷</option>
              <option value="Mixed worksheet">混合练习单</option>
              <option value="MCQ + structured">选择题 + 结构化题</option>
              <option value="Practical investigation">实践探究</option>
            </select>
          </label>
          <label>
            <span>总分</span>
            <input type="number" min="1" value={form.marks} onChange={(event) => setMarks(event.target.value)} required />
          </label>
          <label>
            <span>时长</span>
            <input value={localizeText(form.duration)} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
          </label>
          <label>
            <span>题目数量</span>
            <input type="number" min="1" max="20" value={form.questionCount} onChange={(event) => setQuestionCount(event.target.value)} required />
          </label>
          <label className="full-span">
            <span>说明</span>
            <textarea value={localizeText(form.instructions)} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
          </label>
          <div className="full-span">
            <ResourcePicker
              resources={resources}
              selectedIds={form.resourceIds}
              onChange={(resourceIds) => setForm({ ...form, resourceIds })}
              label="练习单资源"
              helperText="从资源库添加笔记、图示或源文件。"
            />
          </div>

          <div className="full-span card question-editor-shell">
            <div className="section-header">
              <div>
                <p className="eyebrow">题目编辑器</p>
                <h3>在导出前调整试卷内容</h3>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" type="button" onClick={autoFillQuestions}>自动填充题目</button>
                <span className="badge">已准备 {form.questionItems.length} 道题</span>
              </div>
            </div>
            <div className="question-grid">
              {form.questionItems.map((question, index) => (
                <div key={`question-${index + 1}`} className="question-card">
                  <div className="split-card">
                    <div>
                      <p className="eyebrow">第 {index + 1} 题</p>
                      <strong>{localizeQuestionType(question.type || 'structured')}</strong>
                    </div>
                    <span className="badge">{question.marks} 分</span>
                  </div>
                  <label>
                    <span>题型</span>
                    <select value={question.type} onChange={(event) => updateQuestionItem(index, { type: event.target.value })}>
                      <option value="structured">结构化题</option>
                      <option value="short-answer">简答题</option>
                      <option value="diagram">图示题</option>
                      <option value="mcq">选择题</option>
                      <option value="investigation">探究题</option>
                    </select>
                  </label>
                  <label className="full-span">
                    <span>题目</span>
                    <textarea value={localizeText(question.prompt)} onChange={(event) => updateQuestionItem(index, { prompt: event.target.value })} />
                  </label>
                  <div className="question-card-meta">
                    <label>
                      <span>分值</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={question.marks}
                        onChange={(event) => updateQuestionItem(index, { marks: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span>答题行数</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={question.lines}
                        onChange={(event) => updateQuestionItem(index, { lines: Number(event.target.value) })}
                      />
                    </label>
                    <label className="question-toggle">
                      <input
                        type="checkbox"
                        checked={question.diagramSpace}
                        onChange={(event) => updateQuestionItem(index, { diagramSpace: event.target.checked })}
                      />
                      <span>包含图示区域</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="full-span form-actions">
            <button className="primary-button" type="submit">{editingId ? '更新练习单草稿' : '保存练习单草稿'}</button>
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、班级、主题或格式..." />
        </div>
      </div>

      {exportSpec && (
        <div className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">导出规格</p>
              <h3>DOCX/PDF 导出规格</h3>
            </div>
            <button className="ghost-button" onClick={() => setExportSpec(null)}>清除</button>
          </div>
          <pre className="code-block">{JSON.stringify(exportSpec, null, 2)}</pre>
        </div>
      )}

      <div className="card list-card">
        {filteredData.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-card-header">
              <div>
                <strong>{localizeText(item.title)}</strong>
                <p className="muted">{localizeText(item.className)} | {localizeText(item.topic)} | {localizeWorksheetFormat(item.format)}{item.generatedFromLessonId ? ' | 由课程自动生成' : ''}</p>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" onClick={() => handleEdit(item)}>编辑</button>
                <button className="ghost-button" onClick={() => loadExportSpec(item.id)}>导出规格</button>
                <button className="ghost-button" type="button" onClick={() => onOpenExport(item.id, 'preview')}>预览</button>
                <button className="ghost-button" type="button" onClick={() => onOpenExport(item.id, 'docx')}>DOCX</button>
                <button className="ghost-button" type="button" onClick={() => onOpenExport(item.id, 'pdf')}>PDF</button>
                <button className="danger-button" onClick={() => onDelete(item.id)}>删除</button>
              </div>
            </div>
            <p><strong>试卷设置：</strong> {item.marks} 分 | {localizeText(item.duration)} | {item.questionCount} 道题</p>
            <p><strong>说明：</strong> {localizeText(item.instructions)}</p>
            <p><strong>题目：</strong> {(item.questionItems || []).length ? item.questionItems.map((question) => `第 ${question.number} 题：${localizeQuestionType(question.type)}`).join('、') : '导出时自动生成'}</p>
            {item.resourceIds?.length ? (
              <p><strong>资源：</strong> {item.resourceIds.map((resourceId) => localizeText(resources.find((resource) => resource.id === resourceId)?.title || resourceId)).join('、')}</p>
            ) : null}
          </div>
        ))}
        {!filteredData.length && <p className="muted">没有符合搜索条件的练习单草稿。</p>}
      </div>
    </section>
  );
}
