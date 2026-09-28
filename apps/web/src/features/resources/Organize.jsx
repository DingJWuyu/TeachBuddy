import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { ResourceDialog } from "./ResourceDialog.jsx";

export function Organize({
  action,
  resources,
  tax,
  disabled,
  onSave,
  onClose,
}) {
  const { t } = useTranslation("resources");
  const [folderId, setFolder] = useState("");
  const [tagIds, setTags] = useState([]);
  const title = {
    move: t("移动所选资料"),
    "add-tags": t("为所选资料添加标签"),
    archive: t("归档所选资料"),
    restore: t("恢复所选资料"),
  }[action];
  return (
    <ResourceDialog label={title} onClose={onClose}>
      <h2>{title}</h2>
      <p> {t("已选择")} {resources.length} {t("份资料。")} {action === "archive"
          ? t("归档后可恢复，已有备课引用保持不变。")
          : action === "add-tags"
            ? t("保留原有标签。")
            : t("原文件和已有备课引用保持不变。")}
      </p>
      {action === "move" && (
        <label> {t("移动到文件夹")} <select
            aria-label={t("目标文件夹")}
            value={folderId}
            onChange={(event) => setFolder(event.target.value)}
          >
            <option value="">{t("未归入文件夹")}</option>
            {tax.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {action === "add-tags" && (
        <div className="res-tag-options">
          {tax.tags.map((tag) => (
            <label key={tag.id} className="res-tag-option">
              <input
                type="checkbox"
                checked={tagIds.includes(tag.id)}
                onChange={() =>
                  setTags((ids) =>
                    ids.includes(tag.id)
                      ? ids.filter((id) => id !== tag.id)
                      : [...ids, tag.id],
                  )
                }
              />
              {tag.name}
            </label>
          ))}
          {!tax.tags.length && <p>{t("还没有标签，请先在“文件夹与标签”中新建。")}</p>}
        </div>
      )}
      <div className="res-actions">
        <button
          className="res-primary"
          disabled={
            disabled ||
            !resources.length ||
            (action === "add-tags" && !tagIds.length)
          }
          onClick={() =>
            onSave({
              action,
              items: resources.map((item) => ({
                id: item.id,
                baseVersion: item.version,
              })),
              folderId: folderId || null,
              tagIds,
            })
          }
        > {t("确认")} {action === "move"
            ? t("移动")
            : action === "add-tags"
              ? t("添加标签")
              : action === "archive"
                ? t("归档")
                : t("恢复")}
        </button>
        <button onClick={onClose}>{t("取消")}</button>
      </div>
    </ResourceDialog>
  );
}
