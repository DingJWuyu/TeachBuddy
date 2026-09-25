import { Icon } from "../workbench/chrome/icons.jsx";
import { ResourceDialog } from "./ResourceDialog.jsx";

export function Taxonomy({ value, scene, patchScene, disabled, onManage }) {
  function folderRows(parent = null, depth = 0) {
    return value.folders
      .filter((folder) => folder.parentId === parent)
      .map((folder) => (
        <div key={folder.id}>
          <div className="res-tax-row" style={{ paddingLeft: depth * 12 }}>
            <button
              className={scene.folderId === folder.id ? "is-selected" : ""}
              onClick={() =>
                patchScene({ folderId: folder.id, state: "active" })
              }
            >
              <Icon name="folder" size={16} />
              <span>{folder.name}</span>
            </button>
            <button
              className="res-icon-button"
              aria-label={`管理文件夹 ${folder.name}`}
              title={`管理文件夹 ${folder.name}`}
              disabled={disabled}
              onClick={() => onManage("folder", folder)}
            >
              <Icon name="more" size={15} />
            </button>
          </div>
          {folderRows(folder.id, depth + 1)}
        </div>
      ));
  }
  return (
    <div className="res-tools res-ui wb-module">
      <div className="res-tool-head">
        <h2>文件夹</h2>
        <button
          className="res-icon-button"
          aria-label="新建文件夹"
          title="新建文件夹"
          disabled={disabled}
          onClick={() => onManage("folder")}
        >
          <Icon name="plus" size={17} />
        </button>
      </div>
      <div className="res-tax-row">
        <button
          className={
            !scene.folderId && scene.state !== "deleted" ? "is-selected" : ""
          }
          onClick={() => patchScene({ folderId: "", state: "active" })}
        >
          <Icon name="inbox" size={16} />
          <span>全部资料</span>
        </button>
      </div>
      {folderRows()}
      {!value.folders.length && (
        <p className="res-muted res-tax-hint">按学科、章节或用途整理资料。</p>
      )}
      <div className="res-tool-head">
        <h2>标签</h2>
        <button
          className="res-icon-button"
          aria-label="新建标签"
          title="新建标签"
          disabled={disabled}
          onClick={() => onManage("tag")}
        >
          <Icon name="plus" size={17} />
        </button>
      </div>
      {!value.tags.length && (
        <p className="res-muted res-tax-hint">
          给资料加上标签，之后更容易找到。
        </p>
      )}
      {value.tags.map((tag) => (
        <div className="res-tax-row" key={tag.id}>
          <button
            aria-pressed={scene.tagIds.includes(tag.id)}
            className={scene.tagIds.includes(tag.id) ? "is-selected" : ""}
            onClick={() =>
              patchScene({
                state: "active",
                tagIds: scene.tagIds.includes(tag.id)
                  ? scene.tagIds.filter((id) => id !== tag.id)
                  : [...scene.tagIds, tag.id],
              })
            }
          >
            <Icon name="tag" size={15} />
            <span>{tag.name}</span>
            {scene.tagIds.includes(tag.id) && <Icon name="check" size={14} />}
          </button>
          <button
            className="res-icon-button"
            aria-label={`管理标签 ${tag.name}`}
            title={`管理标签 ${tag.name}`}
            disabled={disabled}
            onClick={() => onManage("tag", tag)}
          >
            <Icon name="more" size={15} />
          </button>
        </div>
      ))}
      <div className="res-tax-footer">
        <button
          className={scene.state === "deleted" ? "is-selected" : ""}
          onClick={() =>
            patchScene({
              state: "deleted",
              folderId: "",
              tagIds: [],
              q: "",
              mediaType: "",
            })
          }
        >
          <Icon name="trash" size={16} />
          已删除资料
        </button>
      </div>
    </div>
  );
}

export function TaxonomyDialog({
  value,
  draft,
  onChange,
  onSave,
  onClose,
  disabled,
  items,
}) {
  const { edit, name = "", parentId = "", remove = false } = draft;
  const folder = edit.kind === "folder";
  const noun = folder ? "文件夹" : "标签";
  const group = folder ? "folders" : "tags";
  const title = `${remove ? "删除" : edit.item ? "编辑" : "新建"}${noun}`;
  const descendants = new Set(edit.item ? [edit.item.id] : []);
  for (let size = -1; descendants.size !== size; ) {
    size = descendants.size;
    value.folders.forEach((item) => {
      if (descendants.has(item.parentId)) descendants.add(item.id);
    });
  }
  async function save(event) {
    event.preventDefault();
    const item = {
      id: edit.item?.id ?? crypto.randomUUID(),
      name: name.trim(),
      ...(folder ? { parentId: parentId || null } : {}),
    };
    const next = remove
      ? value[group].filter((entry) => entry.id !== edit.item.id)
      : edit.item
        ? value[group].map((entry) => (entry.id === item.id ? item : entry))
        : [...value[group], item];
    await onSave(
      {
        baseVersion: value.version,
        folders: value.folders,
        tags: value.tags,
        [group]: next,
      },
      remove ? null : item,
    );
  }
  return (
    <ResourceDialog label={title} onClose={onClose}>
      <header className="res-dialog-heading">
        <h2>{title}</h2>
        <button
          className="res-icon-button"
          aria-label={`关闭${title}`}
          onClick={onClose}
        >
          <Icon name="close" size={17} />
        </button>
      </header>
      <form onSubmit={save}>
        {remove ? (
          <p>
            删除“{edit.item.name}”？
            {
              items.filter((item) =>
                folder
                  ? item.folderId === edit.item.id
                  : item.tagIds.includes(edit.item.id),
              ).length
            }{" "}
            份资料
            {folder
              ? "及直接子文件夹会移到上级，资料不会被删除。"
              : "会移除此标签，资料仍然保留。"}
          </p>
        ) : (
          <>
            <label>
              名称
              <input
                value={name}
                maxLength={200}
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </label>
            {folder && (
              <label>
                上级文件夹
                <select
                  value={parentId}
                  onChange={(event) =>
                    onChange({ parentId: event.target.value })
                  }
                >
                  <option value="">无上级文件夹</option>
                  {value.folders
                    .filter((item) => !descendants.has(item.id))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </>
        )}
        <footer className="res-actions">
          {edit.item && !remove && (
            <button
              type="button"
              className="res-danger res-delete-tax"
              onClick={() => onChange({ remove: true })}
            >
              删除{noun}
            </button>
          )}
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            className={remove ? "res-danger" : "res-primary"}
            disabled={disabled || (!remove && !name.trim())}
          >
            {remove
              ? `确认删除${noun}`
              : edit.item
                ? `保存${noun}`
                : `创建${noun}`}
          </button>
        </footer>
      </form>
    </ResourceDialog>
  );
}
