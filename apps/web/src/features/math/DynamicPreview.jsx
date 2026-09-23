import { readLocal, writeLocal } from '../workbench/storage.js';
import React, { useEffect, useRef, useState } from "react";
import { renderGraphic } from "../../../../../packages/shared/src/math/graphics.js";
import {
  dynamicState,
  dynamicPlane,
  snapParameter,
} from "../../../../../packages/shared/src/math/dynamic.js";
import { mountDynamic } from "../../../../../packages/shared/src/math/presentation.js";
import { mathFontStyle } from "../../../../../packages/shared/src/math/formula.js";
export default function DynamicPreview({ source, font, onChange, accountKey, workId }) {
  const root = useRef(null),
    runtime = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!font) return;
    const name = `scene:math-preview:${workId}`;
    const sourceJson = JSON.stringify(source);
    const saved = accountKey ? readLocal(accountKey, name) : null;
    runtime.current = mountDynamic(
      root.current,
      source,
      renderGraphic,
      dynamicState,
      dynamicPlane,
      snapParameter,
      mathFontStyle(font),
      { initialState: saved?.sourceJson === sourceJson ? saved.state : null,
        onState: state => { if (accountKey) writeLocal(accountKey, name, { sourceJson, state }); } },
    );
    return () => root.current?.replaceChildren();
  }, [source, font, accountKey, workId]);
  return (
    <div className={`math-dynamic${show ? " math-presenting" : ""}`}>
      <div className="math-add">
        <button onClick={() => setShow(!show)}>
          {show ? "退出展示" : "展示"}
        </button>
        {!show && (
          <button
            disabled={!font}
            onClick={() => {
              const state = runtime.current.getState();
              onChange({
                ...source,
                initialStepId: state.stepId,
                parameters: source.parameters.map((p) => ({
                  ...p,
                  initial: state.values[p.name],
                })),
                steps: source.steps.map((s) =>
                  s.id === state.stepId
                    ? {
                        ...s,
                        values: s.values.map((p) => ({
                          ...p,
                          value: state.values[p.name],
                        })),
                      }
                    : s,
                ),
              });
            }}
          >
            设为初始状态
          </button>
        )}
      </div>
      <div ref={root} />
    </div>
  );
}
