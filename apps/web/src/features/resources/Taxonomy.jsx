import { useTranslation } from 'react-i18next';
import { Icon } from "../../components/icons.jsx";
import { ResourceDialog } from "./ResourceDialog.jsx";

export function TaxonomyDialog({
  value,
  draft,
  onChange,
  onSave,
  onClose,
  disabled,
  items,
}) {
  const { t } = useTranslation("resources");
  const { edit, name = "", parentId = "", remove = false } = draft;
  const folder = edit.kind === "folder";
  const noun = folder ? t("文件夹") : t("标签");
  const group = folder ? "folders" : "tags";
  const title = `${remove ? t("删除") : edit.item ? t("编辑") : t("新建")}${noun}`;
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
          aria-label={t("关闭{{title}}", { title: title })}
          onClick={onClose}
        >
          <Icon name="close" size={17} />
        </button>
      </header>
      <form onSubmit={save}>
        {remove ? (
          <p> {t("删除“")}{edit.item.name}”？
            {
              items.filter((item) =>
                folder
                  ? item.folderId === edit.item.id
                  : item.tagIds.includes(edit.item.id),
              ).length
            }{" "} {t("份资料")} {folder
              ? t("及直接子文件夹会移到上级，资料不会被删除。")
              : t("会移除此标签，资料仍然保留。")}
          </p>
        ) : (
          <>
            <label> {t("名称")} <input
                value={name}
                maxLength={200}
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </label>
            {folder && (
              <label> {t("上级文件夹")} <select
                  value={parentId}
                  onChange={(event) =>
                    onChange({ parentId: event.target.value })
                  }
                >
                  <option value="">{t("无上级文件夹")}</option>
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
            > {t("删除")}{noun}
            </button>
          )}
          <button type="button" onClick={onClose}> {t("取消")} </button>
          <button
            className={remove ? "res-danger" : "res-primary"}
            disabled={disabled || (!remove && !name.trim())}
          >
            {remove
              ? t("确认删除{{noun}}", { noun: noun })
              : edit.item
                ? t("保存{{noun}}", { noun: noun })
                : t("创建{{noun}}", { noun: noun })}
          </button>
        </footer>
      </form>
    </ResourceDialog>
  );
}
