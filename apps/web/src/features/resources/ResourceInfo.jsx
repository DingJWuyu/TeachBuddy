import { Icon } from "../workbench/chrome/icons.jsx";
import { ModuleDisclosure } from "../workbench/ModuleMotion.jsx";

export function ResourceInfo({
  item,
  file,
  draft,
  tax,
  onEdit,
  onSave,
  onManage,
  disabled,
  dirty,
  usages,
  usageError,
  onRefresh,
  onOpenLesson,
}) {
  if (!item || !draft)
    return (
      <div className="res-info res-ui">
        <p className="res-muted">正在读取资料信息…</p>
      </div>
    );
  return (
    <div className="res-info res-ui wb-module">
      <div className="res-info-file">
        <span className="res-heading-icon">
          <Icon name="file" size={21} />
        </span>
        <div>
          <strong>{file?.name ?? item.title}</strong>
          <span>
            {item.deletedAt ? "已删除，恢复后可以继续整理" : "整理这份资料"}
          </span>
        </div>
      </div>
      <form
        className="res-metadata"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label>
          名称
          <input
            aria-label="资源名称"
            maxLength={200}
            value={draft.title}
            onChange={(event) => onEdit({ title: event.target.value })}
            disabled={!!item.deletedAt}
          />
        </label>
        <div className="res-field">
          <div className="res-field-heading">
            <label htmlFor="resource-folder">文件夹</label>
            <button
              type="button"
              className="res-text-button"
              disabled={disabled || !!item.deletedAt}
              onClick={() => onManage("folder")}
            >
              <Icon name="plus" size={13} />
              新建
            </button>
          </div>
          <select
            id="resource-folder"
            aria-label="资源文件夹"
            value={draft.folderId ?? ""}
            onChange={(event) =>
              onEdit({ folderId: event.target.value || null })
            }
            disabled={!!item.deletedAt}
          >
            <option value="">未归入文件夹</option>
            {tax.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset disabled={!!item.deletedAt}>
          <legend>标签</legend>
          <div className="res-tag-options">
            {tax.tags.map((tag) => (
              <label key={tag.id} className="res-tag-option">
                <input
                  type="checkbox"
                  checked={draft.tagIds.includes(tag.id)}
                  onChange={() =>
                    onEdit({
                      tagIds: draft.tagIds.includes(tag.id)
                        ? draft.tagIds.filter((id) => id !== tag.id)
                        : [...draft.tagIds, tag.id],
                    })
                  }
                />
                {tag.name}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="res-text-button"
            disabled={disabled || !!item.deletedAt}
            onClick={() => onManage("tag")}
          >
            <Icon name="plus" size={13} />
            {tax.tags.length ? "新建标签" : "添加第一个标签"}
          </button>
        </fieldset>
        <label>
          备注
          <textarea
            aria-label="资源笔记"
            placeholder="记下用途、使用方法或下次备课的想法…"
            maxLength={20000}
            value={draft.note}
            onChange={(event) => onEdit({ note: event.target.value })}
            disabled={!!item.deletedAt}
          />
        </label>
        {!item.deletedAt && (
          <div className="res-save-row">
            <button
              type="submit"
              className="res-primary"
              disabled={disabled || !dirty || !draft.title.trim()}
            >
              保存修改
            </button>
            <span className="res-muted" role="status">
              {dirty ? "有未保存的修改" : "资料信息已保存"}
            </span>
          </div>
        )}
      </form>
      <section className="res-usages">
        <h2>
          <Icon name="lessons" size={16} />
          用于哪些备课<span className="res-count">{usages.length}</span>
        </h2>
        {usageError ? (
          <p role="alert">
            使用位置暂时无法读取。<button onClick={onRefresh}>重试</button>
          </p>
        ) : usages.length ? (
          usages.map((usage) => (
            <button
              className="res-usage"
              key={usage.referenceId}
              onClick={() => onOpenLesson?.(usage)}
            >
              <span>{usage.lessonTitle}</span>
              <small>
                {usage.sectionTitle ?? "备用材料"}
                {usage.adoptedVersion < item.version ? " · 来源有更新" : ""}
              </small>
              <Icon name="arrowRight" size={14} />
            </button>
          ))
        ) : (
          <p className="res-muted">尚未加入备课</p>
        )}
      </section>
      <ModuleDisclosure title="原文件信息" className="res-file-details">
        <div className="res-file-info">
          <strong>{file?.name}</strong>
          <span>当前版本 {item.version}</span>
          <p>更新文件会保留名称、文件夹、标签与备注。</p>
        </div>
      </ModuleDisclosure>
    </div>
  );
}
