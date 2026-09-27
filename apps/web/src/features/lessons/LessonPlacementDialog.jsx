import { useRef, useState } from "react";
import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";
import { Icon } from "../workbench/icons.jsx";
import { excerptFor } from "../workbench/documents.js";

export function LessonDialog({ title, children, actions, onClose, wide = false }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return <div className="wb-module wb-dialog-host" data-overlay="dialog">
    <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
    <section ref={ref} className={`wb-dialog lesson-content-dialog${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="wb-dialog-head"><h2>{title}</h2><button className="wb-icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></header>
      <div className="lesson-dialog-body">{children}</div>
      <footer className="wb-dialog-actions"><button className="wb-button" onClick={onClose}>取消</button>{actions}</footer>
    </section>
  </div>;
}

export function LessonPlacementDialog({ input, referenceId, onClose, onPlace }) {
  const section = input.sections.find(s => s.references.some(r => r.id === referenceId));
  const reference = section?.references.find(r => r.id === referenceId);
  const [position, setPosition] = useState(reference?.afterBlock == null ? "end" : String(reference.afterBlock));
  if (!section) return null;
  return <LessonDialog title="放到正文之间" onClose={onClose} actions={
    <button className="wb-button is-primary" onClick={() => onPlace(position === "end" ? null : Number(position))}>移动到这里</button>
  }>
    <p>选择“{reference.snapshot?.title || "这份材料"}”在本环节中的位置，课稿与输出使用同一顺序。</p>
    <div className="lesson-choice-list">
      {[{ value: "0", label: "环节开头" }, ...section.content.blocks.map((block, index) => ({
        value: String(index + 1), label: `第 ${index + 1} 块内容之后：${excerptFor("", { version: section.content.version, blocks: [block] }, 65) || ({ image: "图片", table: "表格", "teacher-note": "教师注记" }[block.type] ?? "正文")}`,
      })), { value: "end", label: "全部正文之后（包含以后新增的正文）" }].map(item => <label key={item.value}>
        <input type="radio" name="material-position" value={item.value} checked={position === item.value} onChange={() => setPosition(item.value)} /><span>{item.label}</span>
      </label>)}
    </div>
  </LessonDialog>;
}
