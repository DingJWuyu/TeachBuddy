import { useMemo, useState } from 'react';
import { getUploadUrl } from '../../utils/api.js';
import { localizeModuleId, localizeTag, localizeTagList, localizeText } from '../../utils/labels.js';

const initialForm = {
  title: '',
  tags: '',
  moduleLinks: ''
};

export default function ResourceVaultPanel({ data, onUpdate, onDelete, onUpload }) {
  const [form, setForm] = useState(initialForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  const filteredData = useMemo(() => data.filter((item) => {
    const haystack = [
      item.title,
      item.originalName,
      ...(item.tags || []),
      ...(item.moduleLinks || [])
    ].join(' ').toLowerCase();

    return haystack.includes(search.toLowerCase());
  }), [data, search]);

  function resetForm() {
    setForm(initialForm);
    setSelectedFile(null);
    setEditingId(null);
  }

  function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) return;

    const uploadData = new FormData();
    uploadData.set('file', selectedFile);
    uploadData.set('title', form.title);
    uploadData.set('tags', form.tags);
    uploadData.set('moduleLinks', form.moduleLinks);
    onUpload(uploadData);
    resetForm();
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      tags: (item.tags || []).join(', '),
      moduleLinks: (item.moduleLinks || []).join(', ')
    });
    setSelectedFile(null);
  }

  function handleMetadataSave(event) {
    event.preventDefault();
    if (!editingId) return;

    onUpdate(editingId, {
      title: form.title,
      tags: form.tags,
      moduleLinks: form.moduleLinks
    });
    resetForm();
  }

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <h2>资源库</h2>
          <p className="muted">将课程文件、笔记和可复用附件集中存放在一个可搜索的资源架上。</p>
        </div>
        <span className="badge">{data.length} 个资源</span>
      </div>

      <div className="card">
        <h3>{editingId ? '编辑资源信息' : '上传资源'}</h3>
        <form className="form-grid" onSubmit={editingId ? handleMetadataSave : handleUpload}>
          <label className="full-span">
            <span>标题</span>
            <input value={localizeText(form.title)} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="单摆实验讲义" />
          </label>
          <label className="full-span">
            <span>标签</span>
            <input value={localizeTagList(form.tags)} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="科学, 练习单, 六年级" />
          </label>
          <label className="full-span">
            <span>关联模块</span>
            <input value={form.moduleLinks} onChange={(event) => setForm({ ...form, moduleLinks: event.target.value })} placeholder="lesson-planner, worksheet-designer" />
          </label>
          {!editingId && (
            <label className="full-span file-picker">
              <span>文件</span>
              <input
                className="file-input"
                type="file"
                aria-label="选择文件"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                required
              />
              <span className="file-picker-control">{selectedFile?.name || '选择文件'}</span>
            </label>
          )}
          <div className="full-span form-actions">
            <button className="primary-button" type="submit">{editingId ? '保存资源信息' : '上传资源'}</button>
            {editingId && <button className="ghost-button" type="button" onClick={resetForm}>取消编辑</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、文件名、标签或关联模块..." />
        </div>
      </div>

      <div className="card list-card">
        {filteredData.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-card-header">
              <div>
                <strong>{localizeText(item.title)}</strong>
                <p className="muted">{item.originalName} | {item.mimeType}</p>
              </div>
              <div className="inline-actions">
                {item.path && (
                  <a className="ghost-button link-button" href={getUploadUrl(item.path)} target="_blank" rel="noreferrer">
                    打开文件
                  </a>
                )}
                <button className="ghost-button" onClick={() => handleEdit(item)}>编辑</button>
                <button className="danger-button" onClick={() => onDelete(item.id)}>删除</button>
              </div>
            </div>
            <p><strong>标签：</strong> {(item.tags || []).map(localizeTag).join('、') || '无'}</p>
            <p><strong>关联模块：</strong> {(item.moduleLinks || []).map(localizeModuleId).join('、') || '无'}</p>
          </div>
        ))}
        {!filteredData.length && <p className="muted">没有符合搜索条件的资源。</p>}
      </div>
    </section>
  );
}
