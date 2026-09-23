import { readLocal, writeLocal } from '../workbench/storage.js';
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const container = useRef(null);
  const origin = useRef(null);
  const transition = useRef(null);
  function togglePresentation(next) {
    origin.current = container.current.getBoundingClientRect();
    transition.current?.cancel();
    setShow(next);
  }
  useLayoutEffect(() => {
    if (!origin.current || !container.current) return;
    const previous = origin.current;
    origin.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = container.current.getBoundingClientRect();
    transition.current = container.current.animate([
      { transform: `translate(${previous.left - target.left}px, ${previous.top - target.top}px) scale(${previous.width / target.width}, ${previous.height / target.height})` },
      { transform: 'none' },
    ], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }, [show]);
  useEffect(() => {
    if (!show) return;
    const close = event => { if (event.key === 'Escape') togglePresentation(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [show]);
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
    <div ref={container} className={`math-dynamic${show ? " math-presenting" : ""}`} style={{ transformOrigin: 'top left' }}>
      <div className="math-add">
        <button aria-pressed={show} onClick={() => togglePresentation(!show)}>
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
