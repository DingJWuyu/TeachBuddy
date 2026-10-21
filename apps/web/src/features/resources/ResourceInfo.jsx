import { useTranslation } from 'react-i18next';
import { Icon } from "../../components/icons.jsx";
import { ModuleDisclosure } from "../../components/interaction/ModuleMotion.jsx";

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
  loading,
  error,
}) {
  const { t } = useTranslation("resources");
  if (!item || !draft)
    return (
      <div className="res-info res-ui">
        <p className="res-muted">{loading
          ? t("正在读取资料信息…")
          : error ? t("资料暂时无法读取") : t("未找到资料")}</p>
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
            {item.deletedAt ? t("已归档，恢复后可以继续整理") : t("整理这份资料")}
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
        <label> {t("名称")} <input
            aria-label={t("资源名称")}
            maxLength={200}
            value={draft.title}
            onChange={(event) => onEdit({ title: event.target.value })}
            disabled={!!item.deletedAt}
          />
        </label>
        <div className="res-field">
          <div className="res-field-heading">
            <label htmlFor="resource-folder">{t("文件夹")}</label>
            <button
              type="button"
              className="res-text-button"
              disabled={disabled || !!item.deletedAt}
              onClick={() => onManage("folder")}
            >
              <Icon name="plus" size={13} /> {t("新建")} </button>
          </div>
          <select
            id="resource-folder"
            aria-label={t("资源文件夹")}
            value={draft.folderId ?? ""}
            onChange={(event) =>
              onEdit({ folderId: event.target.value || null })
            }
            disabled={!!item.deletedAt}
          >
            <option value="">{t("未归入文件夹")}</option>
            {tax.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset disabled={!!item.deletedAt}>
          <legend>{t("标签")}</legend>
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
            {tax.tags.length ? t("新建标签") : t("添加第一个标签")}
          </button>
        </fieldset>
        <label> {t("备注")} <textarea
            aria-label={t("资源笔记")}
            placeholder={t("记下用途、使用方法或教学想法…")}
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
            > {t("保存修改")} </button>
            <span className="res-muted" role="status">
              {dirty ? t("有未保存的修改") : t("资料信息已保存")}
            </span>
          </div>
        )}
      </form>
      <ModuleDisclosure title={t("原文件信息")} className="res-file-details">
        <div className="res-file-info">
          <strong>{file?.name}</strong>
          <span>{t("资料保存版本")} {item.version}</span>
          <p>{t("更新文件会保留名称、文件夹、标签与备注。")}</p>
        </div>
      </ModuleDisclosure>
    </div>
  );
}
