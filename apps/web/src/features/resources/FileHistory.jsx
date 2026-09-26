import { useEffect, useState } from "react";
import { ResourceDialog } from "./ResourceDialog.jsx";

export function FileHistory({ client, item, disabled, onRestore, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [reload, setReload] = useState(0);
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
    <ResourceDialog label="文件历史版本" onClose={onClose}>
      <h2>文件历史版本</h2>
      <p>下载核对旧文件，或将它恢复为当前文件。名称、分类和备注保持不变。</p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {!entries && !error && <p>正在读取历史版本…</p>}
      {confirm ? (
        <>
          <p>
            将当前文件恢复为“{confirm.file.name}
            ”？已有备课继续保留其采用的版本。
          </p>
          <div className="res-actions">
            <button
              className="res-primary"
              disabled={disabled}
              onClick={() => onRestore(confirm)}
            >
              确认恢复文件
            </button>
            <button onClick={() => setConfirm(null)}>取消恢复</button>
          </div>
        </>
      ) : (
        <div className="res-history-list">
          {entries?.map((entry, index) => (
            <div className="res-history-entry" key={entry.version}>
              <strong>{entry.file?.name ?? "文件暂不可读取"}</strong>
              <p className="res-muted">
                {index === 0 ? "当前文件" : "历史文件"} · 保存版本{" "}
                {entry.version} ·{" "}
                {new Date(entry.createdAt).toLocaleString("zh-CN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {entry.supplementPreviewFileId ? " · 含补充 PDF" : ""}
              </p>
              <div className="res-actions">
                <button
                  disabled={entry.unavailable}
                  onClick={() =>
                    client
                      .download(entry.fileId, entry.file.name)
                      .catch((e) => setError(e.message))
                  }
                >
                  下载此版本
                </button>
                {index > 0 && !item.deletedAt && (
                  <button
                    disabled={disabled || entry.unavailable}
                    onClick={() => setConfirm(entry)}
                  >
                    恢复为当前文件
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="res-actions">
        <button onClick={onClose}>关闭历史版本</button>
      </div>
    </ResourceDialog>
  );
}
