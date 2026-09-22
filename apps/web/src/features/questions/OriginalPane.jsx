import React, { useEffect, useState, useRef } from "react";
import { ControlledImage } from "../workbench/materials/DocumentView.jsx";
import { get, write, download } from "./materials-api.js";
export default function OriginalPane({
  material,
  draft,
  onLocation,
  onCrop,
  scene,
  onScene,
}) {
  const files = [
    ...(material.input.fileIds ?? []),
    ...material.supplementFileIds,
  ];
  const [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [box, setBox] = useState(null),
    [locationRole, setLocationRole] = useState("body");
  const start = useRef(null);
  const loc = draft?.parts
    .flatMap((p) => p.locations)
    .find((x) => x.kind === "page" || x.kind === "docx");
  const fileId = scene.fileId ?? loc?.fileId ?? files[0],
    page = scene.page ?? loc?.page ?? 1;
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError("");
    setBox(null);
    let timer;
    async function refresh() {
      try {
        const value = await get(`/api/workbench/files/${fileId}/preview`);
        if (!active) return;
        setPreview(value);
        if (!value.pages.length && value.state !== "failed")
          timer = setTimeout(refresh, 2000);
        if (value.state === "failed")
          setError("原稿预览失败，可下载原稿或补充清晰照片");
      } catch {
        if (active) setError("原稿预览暂不可用");
      }
    }
    if (fileId) refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fileId, material.version]);
  const current = preview?.pages.find((x) => x.page === page);
  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const location = () => ({
    kind: "page",
    fileId,
    renditionFileId: preview.renditionFileId,
    page,
    box,
  });
  const positions =
    draft?.parts.flatMap((p) =>
      p.locations.map((l) => ({ ...l, role: p.role })),
    ) ?? [];
  const roleName = {
    body: "题面",
    solution: "答案",
    figure: "配图",
    unassigned: "未分配",
  };
  return (
    <section className="q-original" aria-label="原始材料">
      <header>
        <strong>原始材料</strong>
        {fileId && <button onClick={() => download(fileId)}>下载原稿</button>}
      </header>
      {material.input.kind === "text" && (
        <pre>
          {(() => {
            const l =
              positions.find(
                (x) => x.kind === "text" && x.start === scene.textStart,
              ) ?? positions.find((x) => x.kind === "text");
            const chars = [...material.input.text];
            return l ? (
              <>
                {chars.slice(0, l.start).join("")}
                <mark>{chars.slice(l.start, l.end).join("")}</mark>
                {chars.slice(l.end).join("")}
              </>
            ) : (
              material.input.text
            );
          })()}
        </pre>
      )}
      {files.length > 0 && (
        <>
          <div className="q-tools">
            <select
              aria-label="原稿文件"
              value={fileId}
              onChange={(e) => onScene({ fileId: e.target.value, page: 1 })}
            >
              {files.map((id, i) => (
                <option key={id} value={id}>
                  原稿 {i + 1}
                </option>
              ))}
            </select>
            <select
              aria-label="原稿页码"
              value={page}
              onChange={(e) => onScene({ page: Number(e.target.value) })}
            >
              {(preview?.pages ?? []).map((x) => (
                <option key={x.page} value={x.page}>
                  第 {x.page} 页
                </option>
              ))}
            </select>
            <select
              aria-label="原稿缩放"
              value={scene.zoom ?? 1}
              onChange={(e) => onScene({ zoom: Number(e.target.value) })}
            >
              <option value="1">适合宽度</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
            </select>
          </div>
          {loc?.kind === "docx" && (
            <p>段落 {scene.paragraph ?? loc.paragraph}（原生结构位置）</p>
          )}
          {current ? (
            <div className="q-page-scroll">
              <div
                className="q-page"
                style={{ width: `${(scene.zoom ?? 1) * 100}%` }}
                onPointerDown={(e) => {
                  start.current = point(e);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerUp={(e) => {
                  if (!start.current) return;
                  const a = start.current,
                    b = point(e);
                  start.current = null;
                  const next = {
                    x: Math.min(a.x, b.x),
                    y: Math.min(a.y, b.y),
                    width: Math.abs(a.x - b.x),
                    height: Math.abs(a.y - b.y),
                  };
                  if (next.width > 0.005 && next.height > 0.005) setBox(next);
                }}
              >
                <ControlledImage
                  fileId={current.imageFileId}
                  alt={`原稿第 ${page} 页`}
                  widthMm={170}
                />
                {box && (
                  <span
                    className="q-box"
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.width * 100}%`,
                      height: `${box.height * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <p>{error || "原稿已保存，预览尚未就绪"}</p>
          )}
          <div className="q-tools">
            <select
              aria-label="定位用途"
              value={locationRole}
              onChange={(e) => setLocationRole(e.target.value)}
            >
              <option value="body">题面定位</option>
              <option value="solution">答案定位</option>
            </select>
            <button
              disabled={!box || !draft}
              onClick={() => onLocation(location(), locationRole)}
            >
              保存选区定位
            </button>
            <button
              disabled={!box || !draft}
              onClick={() => onCrop(location())}
            >
              裁图加入题面
            </button>
            <button
              onClick={async () => {
                try {
                  await write(
                    `/api/workbench/files/${fileId}/preview`,
                    {},
                    crypto.randomUUID(),
                  );
                  setError("预览已受理，请稍后重新打开原稿");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              生成预览
            </button>
          </div>
        </>
      )}
      {positions.length > 0 && (
        <div className="q-tools">
          {positions.map((l, i) => (
            <button
              key={i}
              onClick={() =>
                l.kind === "page"
                  ? onScene({ fileId: l.fileId, page: l.page })
                  : l.kind === "text"
                    ? onScene({ textStart: l.start })
                    : onScene({ fileId: l.fileId, paragraph: l.paragraph })
              }
            >
              {roleName[l.role]} ·{" "}
              {l.fileId ? `原稿 ${files.indexOf(l.fileId) + 1} · ` : ""}
              {l.kind === "text"
                ? `字符 ${l.start}-${l.end}`
                : l.kind === "docx"
                  ? `段落 ${l.paragraph}`
                  : `第 ${l.page} 页`}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
