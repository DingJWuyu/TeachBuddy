import { useTranslation } from 'react-i18next';

/** Lessons module entry: my lessons list, drafts and the lesson route. */

import { useEffect, useRef, useState } from "react";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useScene } from "../workbench/useScene.js";
import { useForegroundRefresh } from "../workbench/useForegroundRefresh.js";
import { listLocalNames } from "../workbench/storage.js";
import { navigate } from "../workbench/routes.js";
import { Icon } from "../workbench/icons.jsx";
import { useScrollRestore } from "../workbench/useScrollRestore.js";
import { listLessons } from "./api.js";
import LessonDetail from "./LessonDetail.jsx";
import { useLessonOrder, LessonOrderButtons } from "./LessonOrder.jsx";
import { LessonExample, LessonIdentity } from "./LessonIntro.jsx";
import { ModulePresence } from "../workbench/ModuleMotion.jsx";
import { Popover, MenuItem } from "../workbench/ModuleOverlays.jsx";
import { excerptFor } from "../workbench/documents.js";
import "./lessons.css";

function LessonsIndex() {
  const { t } = useTranslation('lessons');
  const shell = useWorkbenchShell();
  const [exampleOpen, setExampleOpen] = useState(false);
  const [scene, patchScene] = useScene(shell.accountKey, "lessons", {
    listQuery: "",
    listState: "active",
  });
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const order = useLessonOrder(() => setReloadToken((token) => token + 1));
  useForegroundRefresh(() => setReloadToken((value) => value + 1));
  const [hasDraft, setHasDraft] = useState(() =>
    listLocalNames(shell.accountKey).includes("draft:lesson:new"),
  );
  const seqRef = useRef(0);
  const scroll = useScrollRestore(
    scene.listScrollTop || 0,
    (top) => patchScene({ listScrollTop: top }),
    items.length,
  );

  useEffect(() => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setStatus("loading");
    listLessons({ q: scene.listQuery, state: scene.listState })
      .then((rows) => {
        if (seq !== seqRef.current) return;
        setItems(rows);
        setStatus("ready");
      })
      .catch((problem) => {
        if (seq !== seqRef.current) return;
        setError(problem.problem || { message: t("读取失败") });
        setStatus("error");
      });
  }, [scene.listQuery, scene.listState, reloadToken, shell.generation]);

  useEffect(() => {
    setHasDraft(listLocalNames(shell.accountKey).includes("draft:lesson:new"));
  }, [shell.accountKey, reloadToken]);

  return (
    <div
      className="wb-module wb-page wb-lessons-index"
      data-region="lessons-index"
    >
      <LessonIdentity subtitle={t("整理讲课思路和课堂材料，生成教案、讲义或练习。")}>
        <div className="lesson-index-actions">
          <Popover label={t("备课列表选项")}>
            {({ close }) => (
              <MenuItem
                onClick={() => {
                  close();
                  patchScene({
                    listState:
                      scene.listState === "deleted" ? "active" : "deleted",
                  });
                }}
              >
                {scene.listState === "deleted"
                  ? t("查看我的备课")
                  : t("查看已归档备课")}
              </MenuItem>
            )}
          </Popover>
          <button
            type="button"
            className="wb-button is-primary"
            name="new-lesson"
            onClick={() => navigate("/lessons/new")}
          >
            <Icon name="plus" size={17} />
            {t("新建备课")}
          </button>
        </div>
      </LessonIdentity>
      {(items.length > 0 ||
        scene.listQuery ||
        scene.listState === "deleted") && (
        <div className="lesson-list-toolbar">
          <div className="wb-search">
            <Icon name="search" size={16} />
            <input
              className="wb-input"
              type="search"
              aria-label={t("搜索备课")}
              placeholder={t("搜索课题或内容")}
              value={scene.listQuery}
              onChange={(event) =>
                patchScene({ listQuery: event.target.value })
              }
            />
          </div>
          <span className="lesson-list-label">
            {scene.listState === "deleted" ? t("已归档的备课") : t("我的备课")}
          </span>
        </div>
      )}

      {scene.listState === "deleted" && items.length > 0 && (
        <p className="lesson-archive-help">
          {t("打开一份归档备课，可以恢复使用或彻底删除。")}
        </p>
      )}
      {hasDraft && scene.listState !== "deleted" && (
        <div className="wb-draft-list" data-region="lesson-draft">
          <button
            type="button"
            className="wb-draft-row"
            onClick={() => navigate("/lessons/new")}
          >
            <Icon name="prep" size={15} />
            <span>{t("继续上次未保存的备课")}</span>
            <span className="wb-muted">{t("草稿在此设备")}</span>
          </button>
        </div>
      )}

      {status === "loading" && <p className="wb-muted">{t("正在加载备课…")}</p>}
      {order.feedback}
      {status === "error" && (
        <div className="wb-inline-error" data-region="lessons-error">
          <p>{error?.message}</p>
          <button
            type="button"
            className="wb-button"
            onClick={() => setReloadToken((token) => token + 1)}
          >
            {t("重试")}
          </button>
        </div>
      )}
      {status === "ready" && items.length === 0 && (
        <div className="lesson-empty" data-region="lessons-empty">
          <span className="lesson-empty-icon">
            <Icon name="prep" size={32} />
          </span>
          <h2>
            {scene.listQuery
              ? t("没有找到这份备课")
              : scene.listState === "deleted"
                ? t("没有已归档的备课")
                : t("从准备一节课开始")}
          </h2>
          <p>
            {scene.listQuery
              ? t("试试课题里的其他词，或清空搜索。")
              : scene.listState === "deleted"
                ? t("归档的备课会保留在这里，可以恢复或彻底删除。")
                : t("先写下这节课准备怎么讲，需要时再加入题目、资料和数学作品。")}
          </p>
          {scene.listQuery ? (
            <button
              className="wb-button"
              onClick={() => patchScene({ listQuery: "" })}
            >
              {t("清空搜索")}
            </button>
          ) : (
            scene.listState === "active" && (
              <div className="lesson-empty-actions">
                <button
                  className="wb-button is-primary"
                  onClick={() => navigate("/lessons/new")}
                >
                  <Icon name="plus" />
                  {t("新建第一份备课")}
                </button>
                <button
                  className="wb-text-button"
                  onClick={() => setExampleOpen(true)}
                >
                  {t("看看一份备课示例")}
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            )
          )}
          {!scene.listQuery && scene.listState === "active" && (
            <div className="lesson-outcome-hints">
              <span>
                <Icon name="prep" />
                {t("教案 · 上课参考")}
              </span>
              <span>
                <Icon name="copy" />
                {t("讲义 · 发给学生")}
              </span>
              <span>
                <Icon name="question" />
                {t("练习 · 巩固知识")}
              </span>
            </div>
          )}
        </div>
      )}
      <div
        className="wb-lessons-scroll"
        data-region="lessons-scroll"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
      >
        {items.length > 0 && (
          <ul className="wb-card-list" data-region="lesson-rows">
            {items.map((item, index) => (
              <li key={item.id} className="wb-lesson-list-row">
                <button
                  type="button"
                  className="wb-card-row"
                  onClick={() => navigate(`/lessons/${item.id}`)}
                >
                  <span className="lesson-row-icon">
                    <Icon name="prep" size={21} />
                  </span>
                  <span className="lesson-row-copy">
                    <span className="wb-card-title">{item.title}</span>
                    <span className="lesson-row-excerpt">
                      {excerptFor("", item.intro, 80) ||
                        item.sections
                          ?.map((section) => section.title)
                          .join(" · ") ||
                        t("还没有写下讲课思路")}
                    </span>
                    <span className="lesson-row-meta">
                      {item.sections?.length || 0} {t("个教学环节 ·")}{" "}
                      {(item.materials?.length || 0) +
                        (item.sections || []).reduce(
                          (count, section) => count + section.references.length,
                          0,
                        )}{" "}
                      {t("份材料")}
                    </span>
                  </span>
                  <span className="wb-row-tags">
                    {item.deletedAt && (
                      <span className="wb-tag is-deleted">{t("已归档")}</span>
                    )}
                  </span>
                </button>
                {!item.deletedAt && items.length > 1 && (
                  <LessonOrderButtons
                    item={item}
                    index={index}
                    items={items}
                    order={order}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ModulePresence present={exampleOpen}>
        {exampleOpen && (
          <LessonExample
            onClose={() => setExampleOpen(false)}
            onStart={() => navigate("/lessons/new")}
          />
        )}
      </ModulePresence>
    </div>
  );
}

export default function LessonsPage({ route }) {

  if (route.name === "lesson")
    return <LessonDetail key={route.id} id={route.id} />;
  return <LessonsIndex />;
}
