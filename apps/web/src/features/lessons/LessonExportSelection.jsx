import { ModuleDisclosure } from "../workbench/ModuleMotion.jsx";

export function LessonExportSelection({ references, options, setOptions }) {
  function override(id, lines) {
    setOptions(current => ({ ...current, answerSpaceOverrides: [
      ...(current.answerSpaceOverrides ?? []).filter(item => item.referenceId !== id),
      ...(lines === null ? [] : [{ referenceId: id, lines }]),
    ] }));
  }
  return <ModuleDisclosure title="按材料细选与留白" className="lesson-export-scope">
    <p className="wb-muted lesson-export-selection-hint">取消勾选只影响本次生成，课稿中的材料仍保留。</p>
    <div className="lesson-export-reference-list">
      {references.map((reference, index) => {
        const included = !options.excludedReferenceIds.includes(reference.id);
        const custom = options.answerSpaceOverrides.find(item => item.referenceId === reference.id);
        const title = reference.snapshot?.title || "材料";
        return <div className="lesson-export-reference" key={reference.id}>
          <label>
            <input type="checkbox" checked={included} aria-label={`输出材料 ${index + 1} ${title}`}
              onChange={() => setOptions(current => ({ ...current,
                excludedReferenceIds: included
                  ? [...(current.excludedReferenceIds ?? []), reference.id]
                  : (current.excludedReferenceIds ?? []).filter(id => id !== reference.id),
              }))} />
            <span>{title}</span>
          </label>
          {included && (reference.kind ?? "question") === "question" && options.kind !== "lesson-plan" && (
            custom ? <div className="lesson-export-reference-space">
              <label>作答空白 <input className="wb-input" type="number" min="0" max="20"
                aria-label={`作答行数 ${index + 1} ${title}`} value={custom.lines}
                onChange={event => override(reference.id, Number(event.target.value))} /> 行</label>
              <button className="wb-text-button" onClick={() => override(reference.id, null)}>使用统一留白</button>
            </div> : <button className="wb-text-button" onClick={() => override(reference.id, options.answerSpaceLines)}>单独设置留白</button>
          )}
        </div>;
      })}
    </div>
  </ModuleDisclosure>;
}
