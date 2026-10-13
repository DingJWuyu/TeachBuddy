import { Preview } from "./Preview.jsx";
import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ResourceDialog } from "./ResourceDialog.jsx";

export function FileHistory({ client, item, disabled, onRestore, onClose }) {
  const { t } = useTranslation("resources");
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [reload, setReload] = useState(0);
  const previewRef = useRef(null);
  const previewButtons = useRef(new Map());
  const lastViewed = useRef(null);
  useLayoutEffect(() => {
    if (viewing) previewRef.current?.focus();
    else previewButtons.current.get(lastViewed.current)?.focus();
  }, [viewing]);
  useEffect(() => {
    let active = true;
    setError("");
    client
      .request(`/api/modules/resources/items/${item.id}/history`)
      .then((result) => {
        if (active) setEntries(result.items);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [client, item.id, item.version, reload]);
  return (
    <ResourceDialog label={t("文件历史版本")} onClose={onClose} className={viewing ? "res-history-dialog" : ""}>
      <h2>{t("文件历史版本")}</h2>
      <p>{t("下载核对旧文件，或将它恢复为当前文件。名称、分类和备注保持不变。")}</p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>{t("重新读取")}</button>
        </p>
      )}
      {!entries && !error && <p>{t("正在读取历史版本…")}</p>}
      {viewing && (
        <div className="res-history-preview" ref={previewRef} tabIndex={-1}>
          <h3>{viewing.file.name} · {t("保存版本 {{version}}", {version: viewing.version})}</h3>
          <p>{t("只读预览，不会更改当前文件或资料信息。")}{viewing.supplementPreviewFileId ? t(" · 含补充 PDF") : ""}</p>
          <Preview key={viewing.version} client={client} fileId={viewing.supplementPreviewFileId || viewing.fileId}
            page={page} onPage={setPage} zoom={zoom} onZoom={setZoom} readOnly />
          <div className="res-actions">
            <button onClick={() => setViewing(null)}>{t("返回历史列表")}</button>
            {!confirm && !item.deletedAt && viewing.version !== entries?.[0]?.version && <button disabled={disabled} onClick={() => setConfirm(viewing)}>{t("恢复为当前文件")}</button>}
          </div>
        </div>
      )}
      {confirm ? (
        <>
          <p> {t("将当前文件恢复为“")}{confirm.file.name} {t("”？")} </p>
          <div className="res-actions">
            <button
              className="res-primary"
              disabled={disabled}
              onClick={() => onRestore(confirm)}
            > {t("确认恢复文件")} </button>
            <button onClick={() => setConfirm(null)}>{t("取消恢复")}</button>
          </div>
        </>
      ) : !viewing && (
        <div className="res-history-list">
          {entries?.map((entry, index) => (
            <div className="res-history-entry" key={entry.version}>
              <strong>{entry.file?.name ?? t("文件暂不可读取")}</strong>
              <p className="res-muted">
                {index === 0 ? t("当前文件") : t("历史文件")} {t("· 保存版本")}{" "}
                {entry.version} ·{" "}
                {new Date(entry.createdAt).toLocaleString(i18n.resolvedLanguage, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {entry.supplementPreviewFileId ? t(" · 含补充 PDF") : ""}
              </p>
              <div className="res-actions">
                <button
                  ref={button => {
                    if (button) previewButtons.current.set(entry.version, button);
                    else previewButtons.current.delete(entry.version);
                  }}
                  disabled={entry.unavailable}
                  onClick={() => {
                    lastViewed.current = entry.version;
                    setViewing(entry);
                    setPage(1);
                    setZoom(100);
                  }}
                >{t("预览此版本")}</button>
                <button
                  disabled={entry.unavailable}
                  onClick={() =>
                    client
                      .download(entry.fileId, entry.file.name)
                      .catch((e) => setError(e.message))
                  }
                > {t("下载此版本")} </button>
                {index > 0 && !item.deletedAt && (
                  <button
                    disabled={disabled || entry.unavailable}
                    onClick={() => setConfirm(entry)}
                  > {t("恢复为当前文件")} </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="res-actions">
        <button onClick={onClose}>{t("关闭历史版本")}</button>
      </div>
    </ResourceDialog>
  );
}
