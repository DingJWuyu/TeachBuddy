import React from "react";
export function Taxonomy({
  value,
  scene,
  patchScene,
  onSave,
  disabled,
  items,
}) {
  const {
    edit = null,
    name = "",
    parentId = "",
    remove = null,
  } = scene.taxonomyDraft ?? {};
  function change(patch) {
    patchScene((current) => ({
      taxonomyDraft: { ...current.taxonomyDraft, ...patch },
    }));
  }
  const setEdit = (edit) => change({ edit });
  const setName = (name) => change({ name });
  const setParent = (parentId) => change({ parentId });
  const setRemove = (remove) => change({ remove });
  function open(kind, item) {
    change({
      edit: { kind, item },
      name: item?.name ?? "",
      parentId: item?.parentId ?? "",
      remove: null,
    });
  }
  async function save() {
    const group = edit.kind === "folder" ? "folders" : "tags";
    const item = {
      id: edit.item?.id ?? crypto.randomUUID(),
      name,
      ...(group === "folders" ? { parentId: parentId || null } : {}),
    };
    const next = {
      baseVersion: value.version,
      folders: value.folders,
      tags: value.tags,
      [group]: edit.item
        ? value[group].map((v) => (v.id === item.id ? item : v))
        : [...value[group], item],
    };
    if (await onSave(next))
      patchScene((current) => ({
        taxonomyDraft:
          JSON.stringify(current.taxonomyDraft) ===
          JSON.stringify(scene.taxonomyDraft)
            ? { ...current.taxonomyDraft, edit: null }
            : current.taxonomyDraft,
      }));
  }
  async function erase() {
    const group = remove.kind === "folder" ? "folders" : "tags";
    if (
      await onSave({
        baseVersion: value.version,
        folders: value.folders,
        tags: value.tags,
        [group]: value[group].filter((v) => v.id !== remove.item.id),
      })
    )
      setRemove(null);
  }
  function folderRows(parent = null, depth = 0) {
    return value.folders
      .filter((f) => f.parentId === parent)
      .map((f) => (
        <React.Fragment key={f.id}>
          <div className="res-tax-row" style={{ paddingLeft: depth * 12 }}>
            <button
              className={scene.folderId === f.id ? "is-selected" : ""}
              onClick={() => patchScene({ folderId: f.id })}
            >
              {f.name}
            </button>
            <button
              aria-label={`管理文件夹 ${f.name}`}
              onClick={() => open("folder", f)}
            >
              ···
            </button>
          </div>
          {folderRows(f.id, depth + 1)}
        </React.Fragment>
      ));
  }
  return (
    <div className="res-tools">
      <div className="res-tool-head">
        <h3>文件夹</h3>
        <button onClick={() => open("folder")} disabled={disabled}>
          新建文件夹
        </button>
      </div>
      <button
        className={!scene.folderId ? "is-selected" : ""}
        onClick={() => patchScene({ folderId: "" })}
      >
        全部资料
      </button>
      {folderRows()}
      <div className="res-tool-head">
        <h3>标签</h3>
        <button onClick={() => open("tag")} disabled={disabled}>
          新建标签
        </button>
      </div>
      {value.tags.length === 0 && <p className="res-muted">还没有标签</p>}
      {value.tags.map((t) => (
        <div className="res-tax-row" key={t.id}>
          <label>
            <input
              type="checkbox"
              checked={scene.tagIds.includes(t.id)}
              onChange={() =>
                patchScene({
                  tagIds: scene.tagIds.includes(t.id)
                    ? scene.tagIds.filter((id) => id !== t.id)
                    : [...scene.tagIds, t.id],
                })
              }
            />
            {t.name}
          </label>
          <button
            aria-label={`管理标签 ${t.name}`}
            onClick={() => open("tag", t)}
          >
            ···
          </button>
        </div>
      ))}
      {edit && (
        <div className="res-pop" role="dialog" aria-label="管理分类">
          <label>
            名称
            <input
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {edit.kind === "folder" && (
            <label>
              上级文件夹
              <select
                value={parentId}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">根目录</option>
                {value.folders
                  .filter((f) => f.id !== edit.item?.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="res-actions">
            <button onClick={save} disabled={disabled || !name.trim()}>
              保存分类
            </button>
            <button onClick={() => setEdit(null)}>取消</button>
            {edit.item && (
              <button
                onClick={() => {
                  setRemove(edit);
                  setEdit(null);
                }}
              >
                删除分类
              </button>
            )}
          </div>
        </div>
      )}
      {remove && (
        <div className="res-pop" role="alertdialog" aria-label="删除分类">
          <p>
            删除“{remove.item.name}”？影响{" "}
            {
              items.filter((i) =>
                remove.kind === "folder"
                  ? i.folderId === remove.item.id
                  : i.tagIds.includes(remove.item.id),
              ).length
            }{" "}
            份资料
            {remove.kind === "folder"
              ? "，直接子文件夹与资料移到上级。"
              : "，资料保留。"}
          </p>
          <button onClick={erase} disabled={disabled}>
            确认删除分类
          </button>
          <button onClick={() => setRemove(null)}>取消</button>
        </div>
      )}
    </div>
  );
}
