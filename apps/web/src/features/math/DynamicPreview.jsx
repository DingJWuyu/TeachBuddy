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
export default function DynamicPreview({ source, font, onChange, accountKey, workId, onSelect, selectedId }) {
  const root = useRef(null),
    runtime = useRef(null);
  const [show, setShow] = useState(false);
  const container = useRef(null);
  const origin = useRef(null);
  const transition = useRef(null);
  const pointer = useRef(null);
  const selected = useRef(selectedId);
  selected.current = selectedId;
  const highlight = () => {
    for (const node of root.current?.querySelectorAll('[data-object]') ?? []) node.classList.toggle('is-selected', node.getAttribute('data-object') === selected.current);
  };
  useLayoutEffect(highlight, [selectedId]);
  function togglePresentation(next) {
    runtime.current?.pause();
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
    highlight();
    const observer = new MutationObserver(highlight);
    observer.observe(root.current, { childList: true, subtree: true });
    return () => { observer.disconnect(); runtime.current?.destroy(); runtime.current = null; };
  }, [source, font, accountKey, workId]);
  return (
    <div ref={container} className={`math-dynamic${show ? " math-presenting" : ""}`} style={{ transformOrigin: 'top left' }}>
      <div className="math-add">
        {!show && <span className="math-preview-label">试演 · 拖动不会修改作品</span>}
        <button aria-pressed={show} onClick={() => togglePresentation(!show)}>
          {show ? "退出课堂展示" : "课堂展示"}
        </button>
        {!show && (
          <button
            disabled={!font}
            onClick={() => {
              runtime.current.pause();
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
            设为开场画面
          </button>
        )}
      </div>
      <div ref={root} onPointerDownCapture={event => { pointer.current = { x: event.clientX, y: event.clientY, id: event.target.closest('[data-object]')?.getAttribute('data-object') }; }}
        onPointerUp={event => { const start = pointer.current; pointer.current = null; if (!show && start?.id && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) onSelect?.(start.id); }}/>
    </div>
  );
}
