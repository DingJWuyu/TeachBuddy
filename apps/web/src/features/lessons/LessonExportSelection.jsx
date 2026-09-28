import { useTranslation } from 'react-i18next';

import { ModuleDisclosure } from "../workbench/ModuleMotion.jsx";

export function LessonExportSelection({ references, options, setOptions }) {
  const { t } = useTranslation('lessons');
  function override(id, lines) {
    setOptions(current => ({ ...current, answerSpaceOverrides: [
      ...(current.answerSpaceOverrides ?? []).filter(item => item.referenceId !== id),
      ...(lines === null ? [] : [{ referenceId: id, lines }]),
    ] }));
  }
  return <ModuleDisclosure title={t("按材料细选与留白")} className="lesson-export-scope">
    <p className="wb-muted lesson-export-selection-hint">{t("取消勾选只影响本次生成，课稿中的材料仍保留。")}</p>
    <div className="lesson-export-reference-list">
      {references.map((reference, index) => {
        const included = !options.excludedReferenceIds.includes(reference.id);
        const custom = options.answerSpaceOverrides.find(item => item.referenceId === reference.id);
        const title = reference.snapshot?.title || t("材料");
        return <div className="lesson-export-reference" key={reference.id}>
          <label>
            <input type="checkbox" checked={included} aria-label={t("输出材料 {{number}} {{title}}", { number: index + 1, title: title })}
              onChange={() => setOptions(current => ({ ...current,
                excludedReferenceIds: included
                  ? [...(current.excludedReferenceIds ?? []), reference.id]
                  : (current.excludedReferenceIds ?? []).filter(id => id !== reference.id),
              }))} />
            <span>{title}</span>
          </label>
          {included && reference.kind === "resource" && <div className="lesson-resource-output">
            {["application/pdf", "application/msword", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg", "image/webp"].includes(reference.snapshot?.mediaType) ? <>
              <label><input type="checkbox" checked={options.resourcePageReferenceIds.includes(reference.id)}
                onChange={event => setOptions(current => ({ ...current, resourcePageReferenceIds: event.target.checked
                  ? [...(current.resourcePageReferenceIds ?? []), reference.id]
                  : (current.resourcePageReferenceIds ?? []).filter(id => id !== reference.id) }))} />{t("按原页插入")}</label>
              {options.resourcePageReferenceIds.includes(reference.id) && <small>{t("原件页面作为图片加入，页面内文字与公式不可编辑。原件里的答案和注记会一并保留，请在分发前预览核对。")}</small>}
            </> : <small>{t("此文件仅列标题；按原页插入支持 PDF、Word、PPT 和图片。")}</small>}
          </div>}
          {included && (reference.kind ?? "question") === "question" && options.kind !== "lesson-plan" && (
            custom ? <div className="lesson-export-reference-space">
              <label>{t("作答空白")} <input className="wb-input" type="number" min="0" max="20"
                aria-label={t("作答行数 {{number}} {{title}}", { number: index + 1, title: title })} value={custom.lines}
                onChange={event => override(reference.id, Number(event.target.value))} /> {t("行")}</label>
              <button className="wb-text-button" onClick={() => override(reference.id, null)}>{t("使用统一留白")}</button>
            </div> : <button className="wb-text-button" onClick={() => override(reference.id, options.answerSpaceLines)}>{t("单独设置留白")}</button>
          )}
        </div>;
      })}
    </div>
  </ModuleDisclosure>;
}
