import React, { useState, useEffect } from "react";
async function request(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "X-TeachBuddy-Request": "1",
            "Idempotency-Key": crypto.randomUUID(),
            ...(body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" }),
          },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );
  if (!response.ok) throw Error(`请求失败 ${response.status}`);
  return response.json();
}
function FileImage({ id, ...props }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      url;
    fetch(`/api/workbench/files/${id}/content`)
      .then((r) => r.blob())
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setUrl(url);
        else URL.revokeObjectURL(url);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return url ? <img src={url} {...props} /> : <span>载入页图</span>;
}
export function PreviewFixture() {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [page, setPage] = useState(1),
    [crop, setCrop] = useState(null),
    [status, setStatus] = useState("选择原文件，查看预览并裁图"),
    [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ x: 0.1, y: 0.15, width: 0.8, height: 0.65 });
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("file");
    if (!id) return;
    Promise.all([
      request(`/api/workbench/files/${id}`),
      request(`/api/workbench/files/${id}/preview`),
    ])
      .then(([file, preview]) => {
        setFile(file);
        setPreview(preview);
        setStatus(`已恢复预览，共 ${preview.pageCount} 页`);
      })
      .catch((e) => setStatus(e.message));
  }, []);
  async function upload(event) {
    const source = event.target.files[0];
    if (!source) return;
    setBusy(true);
    setCrop(null);
    setPreview(null);
    setPage(1);
    try {
      const body = new FormData();
      body.append("file", source);
      const saved = await request("/api/workbench/files", body);
      setFile(saved);
      history.replaceState(null, "", `/?preview&file=${saved.id}`);
      setStatus("原件已保存，正在生成预览");
      const job = await request(`/api/workbench/files/${saved.id}/preview`, {});
      for (;;) {
        const current = await request(`/api/workbench/jobs/${job.id}`);
        if (!["queued", "running", "cancelling"].includes(current.state)) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const result = await request(`/api/workbench/files/${saved.id}/preview`);
      setPreview(result);
      setStatus(
        result.state === "ready"
          ? `预览已就绪，共 ${result.pageCount} 页`
          : result.state === "limited"
            ? "受限预览：旧文档对象可能缺失"
            : "预览失败，原件仍保留",
      );
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cropRegion() {
    setBusy(true);
    try {
      const saved = await request("/api/workbench/files/crops", {
        location: {
          kind: "page",
          fileId: file.id,
          renditionFileId: preview.renditionFileId,
          page,
          box,
        },
      });
      setCrop(saved);
      setStatus("裁图已持久保存");
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  const selected = preview?.pages.find((p) => p.page === page);
  return (
    <main>
      <header>
        <h1>材料预览</h1>
        <a href="/">文稿编辑</a>
        <input
          aria-label="上传材料"
          type="file"
          disabled={busy}
          onChange={upload}
        />
      </header>
      <p role="status">{status}</p>
      <div className="columns preview-columns">
        <section aria-label="原稿预览">
          <header>
            <strong>{file?.name ?? "原稿"}</strong>
            {preview?.pages.length > 0 && (
              <select
                aria-label="预览页码"
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              >
                {preview.pages.map((p) => (
                  <option key={p.page} value={p.page}>
                    第 {p.page} 页
                  </option>
                ))}
              </select>
            )}
          </header>
          {selected && (
            <div className="preview-sheet">
              <FileImage id={selected.imageFileId} alt={`原稿第 ${page} 页`} />
              <div
                className="crop-box"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              />
            </div>
          )}
        </section>
        <section aria-label="裁图">
          <h2>选取区域</h2>
          <p>调整比例，蓝色框内的内容将另存为图片。</p>
          {Object.entries(box).map(([key, value]) => (
            <label className="crop-field" key={key}>
              {{ x: "左侧", y: "顶部", width: "宽度", height: "高度" }[key]}
              <input
                aria-label={`裁图 ${key}`}
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={value}
                onChange={(e) =>
                  setBox({ ...box, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <button disabled={!selected || busy} onClick={cropRegion}>
            保存裁图
          </button>
          {crop && (
            <FileImage id={crop.id} alt="已保存裁图" className="saved-crop" />
          )}
        </section>
      </div>
    </main>
  );
}
