import { Icon } from "../workbench/chrome/icons.jsx";
import { Popover } from "../workbench/ModuleOverlays.jsx";
import { ModulePresence } from "../workbench/ModuleMotion.jsx";
import { FileImage } from "./Preview.jsx";
import { useLayoutEffect, useRef } from "react";

const formats = [
  ["application/pdf", "PDF"],
  ["application/vnd.ms-powerpoint", "PowerPoint (.ppt)"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "PowerPoint (.pptx)",
  ],
  ["application/msword", "Word (.doc)"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Word (.docx)",
  ],
  ["image/png", "图片 (.png)"],
  ["image/jpeg", "图片 (.jpg)"],
  ["image/webp", "图片 (.webp)"],
  ["text/html", "HTML"],
];

export function UploadButton({ onUpload, disabled, first = false }) {
  return (
    <label
      className={`res-button res-primary${disabled ? " is-disabled" : ""}`}
    >
      <Icon name="upload" size={17} />
      {first ? "上传第一份资料" : "上传资料"}
      <input
        type="file"
        multiple
        aria-label={first ? "上传第一份资料" : "上传资料"}
        disabled={disabled}
        onChange={(event) => {
          onUpload(Array.from(event.target.files));
          event.target.value = "";
        }}
      />
    </label>
  );
}

export function Library({
  scene,
  patchScene,
  items,
  allItems,
  tax,
  files,
  previews,
  fileErrors = {},
  client,
  busy,
  loading,
  searchInfo,
  onRetrySearch,
  listRef,
  breadcrumbs,
  onOpen,
  onUpload,
  onFolders,
  foldersOpen,
  onPickResources,
  onOrganize,
  onAddToLesson,
}) {
  const selectionRef = useRef(null);
  useLayoutEffect(() => {
    const element = selectionRef.current;
    const workspace = listRef.current?.closest(".res-workspace");
    if (!element || !workspace || scene.openId) return;
    const measure = () =>
      workspace.style.setProperty(
        "--res-selection-height",
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      workspace.style.removeProperty("--res-selection-height");
    };
  }, [scene.selectionMode, Boolean(onPickResources), scene.openId, listRef]);
  const deleted = scene.state === "deleted";
  const filtered = Boolean(
    scene.q || scene.folderId || scene.mediaType || scene.tagIds.length,
  );
  const firstVisit =
    !loading &&
    !allItems.some((item) => !item.deletedAt) &&
    !deleted &&
    !filtered;
  const clear = () =>
    patchScene({ q: "", folderId: "", tagIds: [], mediaType: "" });
  return (
    <section className="res-library" hidden={!!scene.openId}>
      <header className="res-header res-surface">
        <div className="res-heading">
          <span className="res-heading-icon">
            <Icon name={deleted ? "trash" : "folder"} size={23} />
          </span>
          <div>
            <h1 tabIndex={-1}>{deleted ? "已归档资料" : "资源库"}</h1>
            <p>
              {deleted
                ? "暂时不用的资料，可恢复或彻底删除"
                : "收藏教学资料，随时查看与取用"}
            </p>
          </div>
        </div>
        <div className="res-header-actions">
          {deleted ? (
            <button
              onClick={() =>
                patchScene({
                  state: "active",
                  selected: [],
                  selectionMode: false,
                })
              }
            >
              <Icon name="arrowLeft" size={16} />
              全部资料
            </button>
          ) : (
            <>
              {onFolders && (
                <button aria-expanded={foldersOpen} onClick={onFolders}>
                  <Icon name="folder" size={17} />
                  <span>文件夹与标签</span>
                </button>
              )}
              {!firstVisit && (
                <UploadButton disabled={busy} onUpload={onUpload} />
              )}
              <Popover
                label="资源库更多操作"
                className="res-menu"
                buttonClassName="res-icon-button"
              >
                {({ close }) => (
                  <button
                    role="menuitem"
                    onClick={() => {
                      close();
                      patchScene({
                        state: "deleted",
                        selected: [],
                        selectionMode: false,
                        q: "",
                        folderId: "",
                        mediaType: "",
                        tagIds: [],
                      });
                    }}
                  >
                    <Icon name="trash" size={16} />
                    已归档资料
                  </button>
                )}
              </Popover>
            </>
          )}
        </div>
      </header>
      <div className="res-browser res-surface" aria-busy={loading}>
        {!firstVisit && (
          <>
            <div className="res-browser-toolbar">
              {items.length > 0 && !onPickResources && (
                <button
                  aria-pressed={Boolean(scene.selectionMode)}
                  onClick={() =>
                    patchScene({
                      selectionMode: !scene.selectionMode,
                      selected: [],
                    })
                  }
                >
                  选择资料
                </button>
              )}
              <label className="res-search">
                <Icon name="search" size={17} />
                <input
                  aria-label="搜索资料"
                  placeholder="搜索名称、备注或正文"
                  maxLength={200}
                  value={scene.q}
                  onChange={(event) => patchScene({ q: event.target.value })}
                />
                {scene.q && (
                  <button
                    className="res-icon-button"
                    aria-label="清除搜索"
                    onClick={() => patchScene({ q: "" })}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </label>
              <button
                className={scene.filtersOpen ? "is-selected" : ""}
                aria-expanded={Boolean(scene.filtersOpen)}
                aria-controls="resource-filters"
                onClick={() => patchScene({ filtersOpen: !scene.filtersOpen })}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                筛选
                {(scene.mediaType || scene.tagIds.length > 0) && (
                  <span className="res-count">
                    {Number(Boolean(scene.mediaType)) + scene.tagIds.length}
                  </span>
                )}
              </button>
              <div
                className="res-view-switch"
                role="group"
                aria-label="资料显示方式"
              >
                <button
                  className="res-icon-button"
                  aria-label="缩略图视图"
                  title="缩略图视图"
                  aria-pressed={scene.view === "grid"}
                  onClick={() => patchScene({ view: "grid" })}
                >
                  <Icon name="grid" size={16} />
                </button>
                <button
                  className="res-icon-button"
                  aria-label="列表视图"
                  title="列表视图"
                  aria-pressed={scene.view === "list"}
                  onClick={() => patchScene({ view: "list" })}
                >
                  <Icon name="list" size={17} />
                </button>
              </div>
            </div>
            <ModulePresence
              present={Boolean(scene.filtersOpen)}
              mode="collapse"
            >
              <div id="resource-filters" className="res-filter-panel">
                <label>
                  文件类型
                  <select
                    aria-label="格式筛选"
                    value={scene.mediaType}
                    onChange={(event) =>
                      patchScene({ mediaType: event.target.value })
                    }
                  >
                    <option value="">全部类型</option>
                    {formats.map(([value, name]) => (
                      <option value={value} key={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {tax.tags.length > 0 && (
                  <fieldset>
                    <legend>按标签筛选</legend>
                    <div className="res-tag-options">
                      {tax.tags.map((tag) => (
                        <label className="res-tag-option" key={tag.id}>
                          <input
                            type="checkbox"
                            checked={scene.tagIds.includes(tag.id)}
                            onChange={() =>
                              patchScene({
                                tagIds: scene.tagIds.includes(tag.id)
                                  ? scene.tagIds.filter((id) => id !== tag.id)
                                  : [...scene.tagIds, tag.id],
                              })
                            }
                          />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            </ModulePresence>
            <div className="res-location">
              <nav aria-label="当前资料文件夹">
                <button onClick={() => patchScene({ folderId: "" })}>
                  全部资料
                </button>
                {breadcrumbs.map((folder) => (
                  <span key={folder.id}>
                    <Icon name="arrowRight" size={12} />
                    <button onClick={() => patchScene({ folderId: folder.id })}>
                      {folder.name}
                    </button>
                  </span>
                ))}
              </nav>
              <span>{loading ? "正在读取…" : `${items.length} 份资料`}</span>
            </div>
            {(scene.mediaType || scene.tagIds.length > 0) && (
              <div className="res-chips">
                {scene.mediaType && (
                  <button onClick={() => patchScene({ mediaType: "" })}>
                    {formats.find(([value]) => value === scene.mediaType)?.[1]}
                    <Icon name="close" size={12} />
                  </button>
                )}
                {scene.tagIds.map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      patchScene({
                        tagIds: scene.tagIds.filter((value) => value !== id),
                      })
                    }
                  >
                    {tax.tags.find((tag) => tag.id === id)?.name}
                    <Icon name="close" size={12} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {scene.q && searchInfo && (
          <div className="res-search-status" role="status">
            {searchInfo.interrupted && (
              <span>
                正文检索已中断。
                <button onClick={onRetrySearch}>继续检索</button>
              </span>
            )}
            {searchInfo.pending > 0 && (
              <span>
                正在读取 {searchInfo.pending} 份资料的正文，结果会自动补充…
              </span>
            )}
            {searchInfo.unavailable > 0 && (
              <span>
                {searchInfo.unavailable}{" "}
                份资料暂无可直接提取的文字，扫描内容可在预览中识别。
              </span>
            )}
            {searchInfo.failed > 0 && (
              <span>
                {searchInfo.failed} 份资料正文读取失败。
                <button onClick={onRetrySearch}>重新读取正文</button>
              </span>
            )}
            {searchInfo.ocr?.pendingPages > 0 && (
              <span>
                正在识别 {searchInfo.ocr.pendingPages}{" "}
                页，已完成页面会加入搜索结果。
              </span>
            )}
            {searchInfo.ocr?.unprocessedPages > 0 && (
              <span>
                {searchInfo.ocr.unprocessedPages}{" "}
                页尚无可检索文字，可打开资料后识别。
              </span>
            )}
            {searchInfo.ocr?.failedPages > 0 && (
              <span>
                {searchInfo.ocr.failedPages}{" "}
                页识别未完成，已完成页面仍可检索；可在预览中重试。
              </span>
            )}
          </div>
        )}
        <div
          className={`res-items res-${scene.view}${!items.length ? " is-empty" : ""}`}
          ref={listRef}
          onScroll={(event) =>
            patchScene({ scroll: event.currentTarget.scrollTop })
          }
        >
          {items.map((resource) => {
            const preview = previews[resource.fileId];
            const extension =
              files[resource.fileId]?.name.split(".").pop()?.toUpperCase() ||
              "文件";
            return (
              <article className="res-card" key={resource.id}>
                <button
                  className="res-card-open"
                  onClick={(event) => onOpen(resource.id, event)}
                >
                  <div className="res-thumb">
                    {preview?.pages[0] ? (
                      <FileImage
                        client={client}
                        id={preview.pages[0].imageFileId}
                        alt={`${resource.title} 缩略图`}
                      />
                    ) : (
                      <div className="res-file-placeholder">
                        <Icon name="file" size={32} />
                        <span>{extension}</span>
                      </div>
                    )}
                  </div>
                  <div className="res-card-text">
                    <strong title={resource.title}>{resource.title}</strong>
                    {searchInfo?.matches[resource.id] && (
                      <span className="res-search-excerpt">
                        {searchInfo.matches[resource.id].page
                          ? `第 ${searchInfo.matches[resource.id].page} 页 · `
                          : "正文 · "}
                        {searchInfo.matches[resource.id].excerpt}
                      </span>
                    )}
                    <span>
                      {tax.folders.find(
                        (folder) => folder.id === resource.folderId,
                      )?.name || "未归入文件夹"}
                      {resource.tagIds.length
                        ? ` · ${resource.tagIds
                            .map(
                              (id) =>
                                tax.tags.find((tag) => tag.id === id)?.name,
                            )
                            .filter(Boolean)
                            .join("、")}`
                        : ""}
                    </span>
                  </div>
                  <span className="res-file-type">{extension}</span>
                  {(fileErrors[resource.fileId] ||
                    ["limited", "failed"].includes(preview?.state)) && (
                    <span className="res-preview-state">
                      {fileErrors[resource.fileId]
                        ? "文件读取失败"
                        : preview.state === "limited"
                          ? "预览需核对"
                          : "暂不可预览"}
                    </span>
                  )}
                </button>
                {(onPickResources
                  ? !resource.deletedAt
                  : scene.selectionMode) && (
                  <label className="res-pick">
                    <input
                      type="checkbox"
                      checked={scene.selected.includes(resource.id)}
                      disabled={
                        !scene.selected.includes(resource.id) &&
                        scene.selected.length >= 100
                      }
                      onChange={() =>
                        patchScene({
                          selected: scene.selected.includes(resource.id)
                            ? scene.selected.filter((id) => id !== resource.id)
                            : [...scene.selected, resource.id],
                        })
                      }
                    />
                    <span>选择资料</span>
                  </label>
                )}
              </article>
            );
          })}
          {!items.length && (
            <div className="res-empty">
              <span className="res-empty-icon">
                <Icon
                  name={filtered ? "search" : deleted ? "trash" : "folder"}
                  size={32}
                />
              </span>
              <h2>
                {loading || searchInfo?.pending || searchInfo?.ocr?.pendingPages
                  ? "正在读取资料"
                  : searchInfo?.interrupted
                    ? "暂时无法完成检索"
                    : filtered
                      ? "没有找到匹配的资料"
                      : deleted
                        ? "没有已归档的资料"
                        : "把教学资料收在一起"}
              </h2>
              {!loading && (
                <>
                  <p>
                    {searchInfo?.pending || searchInfo?.ocr?.pendingPages
                      ? "正在补充正文搜索结果，请稍候。"
                      : searchInfo?.interrupted
                        ? "请继续检索，补充尚未读取的结果。"
                        : filtered
                          ? "试试其他关键词，或清除筛选条件。"
                          : deleted
                            ? "归档的资料会出现在这里，可以恢复或彻底删除。"
                            : "上传课件、文档或图片，随时预览，也可以加入备课。"}
                  </p>
                  {filtered ? (
                    <button onClick={clear}>清除筛选</button>
                  ) : (
                    !deleted && (
                      <UploadButton first disabled={busy} onUpload={onUpload} />
                    )
                  )}
                  {firstVisit && (
                    <span className="res-empty-hint">
                      上传即保存，文件夹和标签可以稍后整理
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {(onPickResources || scene.selectionMode) && (
          <div className="res-selection" ref={selectionRef}>
            <span>已选 {scene.selected.length} 份</span>
            <button
              disabled={!items.length}
              onClick={() =>
                patchScene({
                  selected: items.slice(0, 100).map((item) => item.id),
                })
              }
            >
              选择当前结果{items.length > 100 ? "前 100 份" : ""}
            </button>
            {onPickResources ? (
              <button
                className="res-primary"
                onClick={() =>
                  onPickResources(
                    scene.selected
                      .map((id) =>
                        allItems.find(
                          (item) => item.id === id && !item.deletedAt,
                        ),
                      )
                      .filter(Boolean),
                  )
                }
              >
                采用所选资料
              </button>
            ) : (
              <>
                {!deleted && (
                  <>
                    <button
                      disabled={busy || !scene.selected.length}
                      onClick={() => onOrganize("move")}
                    >
                      移动
                    </button>
                    <button
                      disabled={busy || !scene.selected.length}
                      onClick={() => onOrganize("add-tags")}
                    >
                      添加标签
                    </button>
                    <button
                      disabled={busy || !scene.selected.length}
                      onClick={onAddToLesson}
                    >
                      加入备课
                    </button>
                  </>
                )}
                <button
                  disabled={busy || !scene.selected.length}
                  onClick={() => onOrganize(deleted ? "restore" : "archive")}
                >
                  {deleted ? "恢复" : "归档"}
                </button>
              </>
            )}
            <button
              onClick={() => patchScene({ selected: [], selectionMode: false })}
            >
              取消选择
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
