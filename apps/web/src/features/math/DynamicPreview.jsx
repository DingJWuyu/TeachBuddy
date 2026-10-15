import { useTranslation } from 'react-i18next';

import { readLocal, writeLocal } from '../../platform/device/storage.js';
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { renderGraphic } from "@teachbuddy/shared/math/graphics";
import {
  dynamicState,
  dynamicPlane,
  snapParameter,
} from "@teachbuddy/shared/math/dynamic";
import { mountDynamic } from "@teachbuddy/shared/math/presentation";
import { mathFontStyle } from "@teachbuddy/shared/math/formula";
export default function DynamicPreview({ source, font, onChange, accountKey, workId, onSelect, selectedId }) {
  const { t, i18n } = useTranslation('math');
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
        labels: {
          error: error => error.reason === 'invalid-geometry' ? t('sourceError.geometry')
            : error.reason === 'invalid-expression' ? t('sourceError.expression') : error.message,
          steps: t('演示步骤'), play: t('播放'), pause: t('暂停'), clear: t('清除轨迹'), reset: t('重置'),
          automatic: label => t('自动演示 · {{label}}', { label }),
          slider: name => t('{{name}} 滑杆', { name }),
          number: name => t('{{name}} 数值', { name }),
          undefined: ids => t('此取值下无定义：{{objects}}', { objects: ids.join(i18n.resolvedLanguage === 'en' ? ', ' : '、') }),
        },
        onState: state => { if (accountKey) writeLocal(accountKey, name, { sourceJson, state }); } },
    );
    highlight();
    const observer = new MutationObserver(highlight);
    observer.observe(root.current, { childList: true, subtree: true });
    return () => { observer.disconnect(); runtime.current?.destroy(); runtime.current = null; };
  }, [source, font, accountKey, workId, i18n.resolvedLanguage, t]);
  return (
    <div ref={container} className={`math-dynamic${show ? " math-presenting" : ""}`} style={{ transformOrigin: 'top left' }}>
      <div className="math-add">
        {!show && <span className="math-preview-label">{t("试演 · 拖动不会修改作品")}</span>}
        <button aria-pressed={show} onClick={() => togglePresentation(!show)}>
          {show ? t("退出课堂展示") : t("课堂展示")}
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
            {t("设为开场画面")}
          </button>
        )}
      </div>
      <div ref={root} onPointerDownCapture={event => { pointer.current = { x: event.clientX, y: event.clientY, id: event.target.closest('[data-object]')?.getAttribute('data-object') }; }}
        onPointerUp={event => { const start = pointer.current; pointer.current = null; if (!show && start?.id && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) onSelect?.(start.id); }}/>
    </div>
  );
}
