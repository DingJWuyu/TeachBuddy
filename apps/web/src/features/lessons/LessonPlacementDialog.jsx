import { useTranslation } from 'react-i18next';

import { useRef, useState } from "react";
import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";
import { Icon } from "../workbench/icons.jsx";
import { excerptFor } from "../workbench/documents.js";

export function LessonDialog({ title, children, actions, onClose, wide = false }) {
  const { t } = useTranslation('lessons');
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return <div className="wb-module wb-dialog-host" data-overlay="dialog">
    <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
    <section ref={ref} className={`wb-dialog lesson-content-dialog${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="wb-dialog-head"><h2>{title}</h2><button className="wb-icon-button" aria-label={t("关闭")} onClick={onClose}><Icon name="close" /></button></header>
      <div className="lesson-dialog-body">{children}</div>
      <footer className="wb-dialog-actions"><button className="wb-button" onClick={onClose}>{t("取消")}</button>{actions}</footer>
    </section>
  </div>;
}

export function LessonPlacementDialog({ input, referenceId, onClose, onPlace }) {
  const { t } = useTranslation('lessons');
  const section = input.sections.find(s => s.references.some(r => r.id === referenceId));
  const reference = section?.references.find(r => r.id === referenceId);
  const [position, setPosition] = useState(reference?.afterBlock == null ? "end" : String(reference.afterBlock));
  if (!section) return null;
  return <LessonDialog title={t("放到正文之间")} onClose={onClose} actions={
    <button className="wb-button is-primary" onClick={() => onPlace(position === "end" ? null : Number(position))}>{t("移动到这里")}</button>
  }>
    <p>{t("选择“")}{reference.snapshot?.title || t("这份材料")}{t("”在本环节中的位置，课稿与输出使用同一顺序。")}</p>
    <div className="lesson-choice-list">
      {[{ value: "0", label: t("环节开头") }, ...section.content.blocks.map((block, index) => ({
        value: String(index + 1), label: t("第 {{number}} 块内容之后：{{excerpt}}", { number: index + 1, excerpt: excerptFor("", { version: section.content.version, blocks: [block] }, 65) || ({ image: t("图片"), table: t("表格"), "teacher-note": t("教师注记") }[block.type] ?? t("正文")) }),
      })), { value: "end", label: t("全部正文之后（包含以后新增的正文）") }].map(item => <label key={item.value}>
        <input type="radio" name="material-position" value={item.value} checked={position === item.value} onChange={() => setPosition(item.value)} /><span>{item.label}</span>
      </label>)}
    </div>
  </LessonDialog>;
}
