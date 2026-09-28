import { useTranslation } from 'react-i18next';

/** Auxiliary panel tools for the lessons module: 我的备课 and 本课大纲. */

import { useEffect, useState } from "react";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { Icon } from "../workbench/icons.jsx";
import { navigate } from "../workbench/routes.js";
import { listLessons } from "./api.js";
import { useLessonOrder, LessonOrderButtons } from "./LessonOrder.jsx";
import { Popover, MenuItem } from "../workbench/ModuleOverlays.jsx";

export function LessonIndex({ currentId }) {
  const { t } = useTranslation('lessons');
  const shell = useWorkbenchShell();
  const [state, setState] = useState("active");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);
  const order = useLessonOrder(() => setRevision((value) => value + 1));

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listLessons({ q: query, state })
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [query, state, revision, currentId, shell.generation]);

  return (
    <div
      className="wb-module wb-tool lesson-index-tool"
      data-region="lesson-index"
    >
      <div className="wb-search">
        <Icon name="search" size={15} />
        <input
          className="wb-input"
          type="search"
          aria-label={t("搜索备课")}
          placeholder={t("搜索备课")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="lesson-tool-heading">
        <span>{state === "deleted" ? t("已归档的备课") : t("我的备课")}</span>
        <Popover label={t("备课目录选项")}>
          {({ close }) => (
            <MenuItem
              onClick={() => {
                close();
                setState(state === "active" ? "deleted" : "active");
              }}
            >
              {state === "active" ? t("查看已归档备课") : t("查看我的备课")}
            </MenuItem>
          )}
        </Popover>
      </div>
      {status === "error" && (
        <div className="wb-muted">
          {t("读取失败")}
          <button
            className="wb-text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t("重新读取")}
          </button>
        </div>
      )}
      {order.feedback}
      {status === "ready" && items.length === 0 && (
        <p className="wb-empty-note">{t("没有备课")}</p>
      )}
      <ul className="wb-tool-list" data-region="lesson-index-list">
        {items.map((item, index) => (
          <li key={item.id} className="wb-lesson-list-row">
            <button
              type="button"
              className={`wb-nav-row${currentId === item.id ? " is-active" : ""}`}
              aria-pressed={currentId === item.id}
              onClick={() => navigate(`/lessons/${item.id}`)}
            >
              <span className="wb-nav-label">{item.title}</span>
              {item.deletedAt && (
                <span className="wb-tag is-deleted">{t("已归档")}</span>
              )}
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
      <button
        type="button"
        className="wb-button"
        name="new-lesson"
        onClick={() => navigate("/lessons/new")}
      >
        {t("新建备课")}
      </button>
    </div>
  );
}

export function LessonOutline({ input, onFocus, onMove, readOnly = false }) {
  const { t } = useTranslation('lessons');
  const sections = input.sections || [];
  if (sections.length === 0) {
    return (
      <p className="wb-empty-note" data-region="outline-empty">
        {t("还没有环节")}
      </p>
    );
  }
  return (
    <ol className="wb-module wb-outline" data-region="lesson-outline">
      {sections.map((section, index) => (
        <li key={section.id}>
          <button
            type="button"
            className="wb-outline-row"
            onClick={() => onFocus(section.id)}
          >
            <span className="lesson-outline-number">{index + 1}</span>
            <span>{section.title || t("未命名环节")}</span>
          </button>
          {!readOnly && sections.length > 1 && (
            <Popover label={t("调整大纲 {{title}}", { title: section.title })}>
              {({ close }) => (
                <>
                  <MenuItem
                    disabled={index === 0}
                    onClick={() => {
                      close();
                      onMove(section.id, -1);
                    }}
                  >
                    {t("上移环节")}
                  </MenuItem>
                  <MenuItem
                    disabled={index === sections.length - 1}
                    onClick={() => {
                      close();
                      onMove(section.id, 1);
                    }}
                  >
                    {t("下移环节")}
                  </MenuItem>
                </>
              )}
            </Popover>
          )}
        </li>
      ))}
    </ol>
  );
}
