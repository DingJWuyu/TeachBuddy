import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';

import { useEffect, useState } from "react";
import { LessonDialog } from "./LessonPlacementDialog.jsx";
import { LessonSectionContent } from "./LessonSectionContent.jsx";
import { ReferenceCard } from "./ReferenceCard.jsx";
import { DocumentView } from "../workbench/materials/index.js";
import { getLessonHistory, getLessonVersion, listLessons } from "./api.js";

export function LessonLibraryDialog({ mode, lesson, hasDraft, onClose, onApply }) {
  const { t } = useTranslation('lessons');
  const history = mode === "history";
  const [query, setQuery] = useState(""), [archived, setArchived] = useState(false);
  const [items, setItems] = useState(null), [selected, setSelected] = useState(null), [preview, setPreview] = useState(null);
  const [sections, setSections] = useState([]), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setItems(null); setSelected(null); setPreview(null); setSections([]); setError("");
    (history ? getLessonHistory(lesson.id).then(result => result.items) : listLessons({ q: query, state: archived ? "deleted" : "active" }))
      .then(rows => { if (live) setItems(history ? rows : rows.filter(row => row.id !== lesson.id)); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [history, lesson.id, query, archived]);
  useEffect(() => {
    let live = true;
    setPreview(null); setSections([]); setError("");
    if (selected != null) (history ? getLessonVersion(lesson.id, selected) : Promise.resolve(items.find(row => row.id === selected)))
      .then(value => { if (live) setPreview(value); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [selected]);
  const canApply = preview && (history ? preview.version !== lesson.version && !lesson.deletedAt : sections.length > 0);
  const renderReference = reference => <ReferenceCard key={reference.id} reference={reference} readOnly />;
  return <LessonDialog wide title={history ? t("已保存版本") : t("从其他备课复用环节")} onClose={onClose} actions={
    <button className="wb-button is-primary" disabled={!canApply} onClick={() => onApply(history ? { version: preview.version } : {
      sourceLessonId: preview.id, sourceVersion: preview.version,
      sectionIds: preview.sections.filter(s => sections.includes(s.id)).map(s => s.id),
    })}>{history ? t("恢复此版本") : t("加入本课{{sectionSuffix}}", { sectionSuffix: sections.length ? t("（{{count}} 个环节）", { count: sections.length }) : "" })}</button>
  }>
    <p>{history ? t("保留最近 50 个保存版本。恢复会另存为新版本，当前已保存内容仍可找回。启用记录之前的旧版本无法补回。") : t("选择一份备课，再勾选要复用的环节，按原顺序加到本课末尾。保留已采用材料和备注，修改本课不会影响原稿。")}</p>
    {hasDraft && <p className="lesson-dialog-notice">{t("确认时会先保存当前草稿，再")}{history ? t("恢复所选版本") : t("加入环节")}。</p>}
    {history && lesson.deletedAt && <p>{t("这份备课已归档，恢复备课后才能使用旧版本。")}</p>}
    {!history && <div className="lesson-library-search"><input className="wb-input" aria-label={t("查找来源备课")} placeholder={t("查找备课…")} value={query} onChange={e => setQuery(e.target.value)} />
      <label><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />{t("查看已归档备课")}</label></div>}
    {error && <p role="alert" className="wb-inline-error">{error}</p>}
    <div className="lesson-library-grid">
      <div className="lesson-library-list" aria-label={history ? t("保存版本列表") : t("来源备课列表")}>
        {!items && !error && <p role="status">{t("正在读取…")}</p>}
        {items?.length === 0 && <p>{t("没有匹配的备课。")}</p>}
        {items?.map(item => <button className={`lesson-library-item${selected === (history ? item.version : item.id) ? " is-selected" : ""}`}
          key={history ? item.version : item.id} aria-pressed={selected === (history ? item.version : item.id)} onClick={() => setSelected(history ? item.version : item.id)}>
          <strong>{history ? t("版本 {{version}}{{currentSuffix}}", { version: item.version, currentSuffix: item.version === lesson.version ? ` ${t("· 当前")}` : "" }) : item.title}</strong>
          <small>{history ? `${item.title} · ${new Date(item.savedAt).toLocaleString(i18n.resolvedLanguage)}` : t("{{count}} 个环节", { count: item.sections.length })}</small>
        </button>)}
      </div>
      <div className="lesson-library-preview" aria-label={t("所选课稿预览")}>
        {!preview && <p>{selected != null ? t("正在读取课稿…") : history ? t("选择版本查看内容。") : t("选择备课查看可复用的环节。")}</p>}
        {preview && <><h3>{preview.title}</h3>{history && <DocumentView value={preview.intro} />}
          {preview.sections.length === 0 && <p>{t("这份备课还没有教学环节。")}</p>}
          {preview.sections.map(section => <section key={section.id} className="lesson-library-section">
            <h4>{history ? section.title : <label><input type="checkbox" checked={sections.includes(section.id)}
              onChange={() => setSections(current => current.includes(section.id) ? current.filter(id => id !== section.id) : [...current, section.id])} />{section.title}</label>}</h4>
            <LessonSectionContent section={section} renderReference={renderReference} />
          </section>)}
          {history && preview.materials.length > 0 && <><h4>{t("备用材料")}</h4>{preview.materials.map(renderReference)}</>}
        </>}
      </div>
    </div>
  </LessonDialog>;
}
