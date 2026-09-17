import { useMemo, useState } from 'react';
import { localizeTag, localizeText } from '../utils/labels.js';

export default function ResourcePicker({ resources = [], selectedIds = [], onChange, label = '关联资源', helperText = '从资源库添加辅助文件。' }) {
  const [search, setSearch] = useState('');

  const filteredResources = useMemo(() => resources.filter((item) => {
    const haystack = [
      item.title,
      item.originalName,
      ...(item.tags || []),
      ...(item.moduleLinks || [])
    ].join(' ').toLowerCase();

    return haystack.includes(search.toLowerCase());
  }), [resources, search]);

  const selectedResources = resources.filter((item) => selectedIds.includes(item.id));

  function toggleResource(resourceId) {
    if (selectedIds.includes(resourceId)) {
      onChange(selectedIds.filter((id) => id !== resourceId));
      return;
    }

    onChange([...selectedIds, resourceId]);
  }

  return (
    <div className="resource-picker">
      <div className="resource-picker-head">
        <div>
          <span>{label}</span>
          <p className="muted tiny-text">{helperText}</p>
        </div>
        <span className="badge">已选择 {selectedIds.length} 项</span>
      </div>

      {resources.length > 0 ? (
        <>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按标题、标签或文件名搜索资源库..."
          />
          {selectedResources.length > 0 && (
            <div className="selection-chip-row">
              {selectedResources.map((item) => (
                <button
                  key={item.id}
                  className="selection-chip"
                  type="button"
                  onClick={() => toggleResource(item.id)}
                >
                  {localizeText(item.title)}
                </button>
              ))}
            </div>
          )}
          <div className="picker-list">
            {filteredResources.map((item) => (
              <label key={item.id} className="picker-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleResource(item.id)}
                />
                <div>
                  <strong>{localizeText(item.title)}</strong>
                  <p className="muted tiny-text">
                    {item.originalName} {item.tags?.length ? `| ${item.tags.map(localizeTag).join('、')}` : ''}
                  </p>
                </div>
              </label>
            ))}
            {!filteredResources.length && <p className="muted tiny-text">没有匹配的资源。</p>}
          </div>
        </>
      ) : (
        <p className="muted tiny-text">资源库中还没有资源。上传文件后，它们会显示在这里。</p>
      )}
    </div>
  );
}
