import { useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import { useWorkspace, newId } from "./context.js";
import { Button, Empty, Graph, IconButton, Toolbar } from "./ui.jsx";

export function ResourceCover({ item }) {
  return (
    <div className={"wb-resource-cover is-" + (item.cover || "document")}>
      {item.cover === "graph" ? (
        <Graph compact />
      ) : (
        <>
          <span className="wb-cover-kicker">
            {item.type === "PPT" ? "MATHEMATICS" : "TEACHING NOTES"}
          </span>
          <strong>
            {item.cover === "template"
              ? "让思路清晰呈现"
              : item.cover === "example"
                ? "一步一步，理解数学"
                : item.name.replace(/\.[^.]+$/, "")}
          </strong>
          <span className="wb-cover-rule" />
          <small>
            {item.cover === "template"
              ? "我的课堂 · 自己的表达"
              : item.type === "PPT"
                ? "观察 · 思考 · 表达"
                : "高中数学 / 教学材料"}
          </small>
        </>
      )}
    </div>
  );
}

export default function ResourcesPage() {
  const w = useWorkspace();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [previewId, setPreviewId] = useState(null);
  const upload = useRef(null);
  const replace = useRef(null);
  const preview = w.resources.find((item) => item.id === previewId);
  const list = w.resources.filter(
    (item) =>
      (w.folder === "全部资源" || item.folder === w.folder) &&
      (item.name + item.note).includes(query),
  );
  function update(patch) {
    w.setResources((items) =>
      items.map((item) =>
        item.id === previewId ? { ...item, ...patch } : item,
      ),
    );
  }
  function fileData(file) {
    return {
      name: file.name,
      type: file.name.split(".").pop().toUpperCase(),
      mime: file.type,
      size: Math.max(1, Math.round(file.size / 1024)) + " KB",
      url: w.fileUrl(file),
      cover: "document",
    };
  }
  function collect(event) {
    const files = Array.from(event.target.files);
    w.setResources((items) => [
      ...files.map((file) => ({
        id: newId("r"),
        ...fileData(file),
        folder: w.folder === "全部资源" ? "未分类" : w.folder,
        note: "",
      })),
      ...items,
    ]);
    event.target.value = "";
  }
  return (
    <div className="wb-module">
      <Toolbar title="资源库" trail={w.folder}>
        <Button primary icon="upload" onClick={() => upload.current?.click()}>
          收录资源
        </Button>
      </Toolbar>
      <input ref={upload} type="file" multiple hidden onChange={collect} />
      <input
        ref={replace}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files[0];
          if (file) {
            const data = fileData(file);
            delete data.name;
            update(data);
          }
          event.target.value = "";
        }}
      />
      <div className="wb-resource-browser" hidden={Boolean(preview)}>
        <div className="wb-resource-controls">
          <div className="wb-list-search">
            <Icon name="search" size={16} />
            <input
              aria-label="搜索资源"
              placeholder="搜索名称或备注"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="wb-secondary">{list.length} 份资源</span>
          <div className="wb-segment">
            <IconButton
              icon="grid"
              label="缩略图视图"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            />
            <IconButton
              icon="list"
              label="列表视图"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            />
          </div>
        </div>
        <div
          className={"wb-scroll wb-resource-items is-" + view}
          aria-label="资源列表"
        >
          {list.map((item) => (
            <button
              key={item.id}
              className="wb-resource-card"
              onClick={() => setPreviewId(item.id)}
            >
              <ResourceCover item={item} />
              <div className="wb-resource-card-info">
                <strong>{item.name}</strong>
                <span>
                  {item.type} · {item.size}
                </span>
              </div>
              {view === "list" && (
                <span className="wb-resource-folder">{item.folder}</span>
              )}
            </button>
          ))}
          {!list.length && (
            <Empty title="这里还没有资源">
              <Button onClick={() => upload.current?.click()}>
                收录第一份材料
              </Button>
            </Empty>
          )}
        </div>
      </div>
      {preview && (
        <div className="wb-resource-preview">
          <div className="wb-section-head">
            <Button icon="arrowLeft" onClick={() => setPreviewId(null)}>
              返回资源
            </Button>
            <div className="wb-actions">
              <Button icon="upload" onClick={() => replace.current?.click()}>
                更新文件
              </Button>
            </div>
          </div>
          <div className="wb-scroll wb-resource-preview-scroll">
            <div className="wb-preview-media">
              {preview.mime?.startsWith("image/") ? (
                <img src={preview.url} alt={preview.name} />
              ) : preview.mime === "application/pdf" ? (
                <iframe
                  className="wb-file-frame"
                  title={preview.name}
                  src={preview.url}
                />
              ) : (
                <ResourceCover item={preview} />
              )}
            </div>
            <div className="wb-resource-description">
              <h2>{preview.name}</h2>
              <span className="wb-secondary">
                {preview.folder} / {preview.type} / {preview.size}
              </span>
              {preview.url && (
                <a
                  className="wb-button"
                  href={preview.url}
                  download={preview.name}
                >
                  下载文件
                </a>
              )}
              <label className="wb-field">
                我的备注
                <textarea
                  rows={3}
                  value={preview.note}
                  placeholder="记下使用方式或值得保留的细节"
                  onChange={(event) => update({ note: event.target.value })}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
