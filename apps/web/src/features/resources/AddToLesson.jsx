import { useTranslation } from 'react-i18next';
import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";
import React, { useEffect, useRef, useState } from "react";
import { referenceInputFrom as inputReference } from "../lessons/api.js";
import { Icon } from "../workbench/chrome/icons.jsx";
export function AddToLesson({ client, resources, onSave, onClose, disabled }) {
  const { t } = useTranslation("resources");
  const sequence = useRef(0);
  const dialogRef = useRef(null);
  useModuleDialogFocus(dialogRef, onClose);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]),
    [lesson, setLesson] = useState(null),
    [section, setSection] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    client
      .request("/api/modules/lessons/v3")
      .then((r) => active && setLessons(r.items))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      sequence.current++;
    };
  }, [client]);
  async function choose(id) {
    const request = ++sequence.current;
    setSelectedId(id);
    setError("");
    setLesson(null);
    setSection("");
    if (!id) return;
    try {
      const result = await client.request(`/api/modules/lessons/v3/${id}`);
      if (request === sequence.current) setLesson(result);
    } catch (e) {
      if (request === sequence.current) setError(e.message);
    }
  }
  function save() {
    if (
      !lesson ||
      lesson.id !== selectedId ||
      (section && !lesson.sections.some((s) => s.id === section))
    )
      return;
    const refs = resources.map((r) => ({
      id: crypto.randomUUID(),
      kind: "resource",
      resourceId: r.id,
      resourceVersion: r.version,
      note: "",
    }));
    const input = {
      baseVersion: lesson.version,
      title: lesson.title,
      intro: lesson.intro,
      sections: lesson.sections.map((s) => ({
        ...s,
        references: [
          ...s.references.map(inputReference),
          ...(section === s.id ? refs : []),
        ],
      })),
      materials: [
        ...lesson.materials.map(inputReference),
        ...(!section ? refs : []),
      ],
    };
    onSave(lesson.id, input);
  }
  return (
    <div
      className="res-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="res-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("加入备课")}
      >
        <header className="res-dialog-heading">
          <h2>{t("加入备课")}</h2>
          <button
            className="res-icon-button"
            aria-label={t("关闭加入备课")}
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </header>
        <p>
          {resources.length === 1
            ? t("将“{{title}}”放入已有备课。", { title: resources[0].title })
            : t("将所选 {{count}} 份资料放入已有备课。", { count: resources.length })} {t("原文件仍保存在资源库。")} </p>
        {error && <p role="alert">{error}</p>}
        <label> {t("选择备课")} <select
            aria-label={t("选择备课")}
            value={selectedId}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">
              {loading ? t("正在读取备课…") : t("选择一份备课")}
            </option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        {!loading && !lessons.length && !error && (
          <p>{t("你还没有备课。创建备课后，就可以从这里加入资料。")}</p>
        )}
        {lesson && (
          <label> {t("放入位置")} <select
              aria-label={t("放入位置")}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">{t("备用材料")}</option>
              {lesson.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="res-actions">
          <button onClick={onClose}>{t("取消")}</button>
          <button
            className="res-primary"
            disabled={disabled || !lesson}
            onClick={save}
          > {t("确认加入")} </button>
        </div>
      </div>
    </div>
  );
}
