import { useState } from "react";
import { recoveryArchives, archivedUploads } from "./deviceRecovery.js";
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function RecoveryDrafts({ accountKey }) {
  const [archives] = useState(() => recoveryArchives(accountKey)),
    [uploads, setUploads] = useState([]),
    [error, setError] = useState("");
  async function showUploads(id) {
    try {
      setUploads(await archivedUploads(accountKey, id));
    } catch {
      setError("无法读取恢复前的上传，请保留本设备数据后重试。");
    }
  }
  function files(value) {
    if (value instanceof Blob) return [value];
    if (value && typeof value === "object")
      return Object.values(value).flatMap(files);
    return [];
  }
  if (!archives.length) return null;
  return (
    <section className="wb-panel reliability-data">
      <h2>恢复前的本设备草稿</h2>
      <p>
        工作台已从备份恢复。旧草稿和待确认请求已隔离，不会自动重放；请先对照当前资料，再复制所需内容保存。
      </p>
      {archives.map((archive) => (
        <details key={archive.to}>
          <summary>
            {new Date(archive.createdAt).toLocaleString("zh-CN")} ·{" "}
            {Object.keys(archive.records).length} 项设备记录
          </summary>
          <button
            className="wb-button"
            onClick={() =>
              download(
                new Blob([JSON.stringify(archive, null, 2)], {
                  type: "application/json",
                }),
                "TeachBuddy-恢复前草稿.json",
              )
            }
          >
            下载原始草稿
          </button>
          <button className="wb-button" onClick={() => showUploads(archive.to)}>
            查看恢复前上传
          </button>
          <pre>{JSON.stringify(archive.records, null, 2)}</pre>
        </details>
      ))}
      {uploads.map((item, i) => (
        <div key={i}>
          <pre>
            {JSON.stringify(
              item.value,
              (key, value) =>
                value instanceof Blob
                  ? { name: value.name, size: value.size, type: value.type }
                  : value,
              2,
            )}
          </pre>
          {files(item.value).map((file, j) => (
            <button
              key={j}
              className="wb-button"
              onClick={() => download(file, file.name || "恢复前上传文件")}
            >
              下载 {file.name || "原文件"}
            </button>
          ))}
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
