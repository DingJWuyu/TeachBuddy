import { useLayoutEffect, useMemo, useRef } from 'react';
import { renderGraphic } from '../../../../../packages/shared/src/math/graphics.js';
import { mathFontStyle } from '../../../../../packages/shared/src/math/formula.js';

export default function GraphicPreview({ source, font, selection, onSelect }) {
  const root = useRef(null);
  const preview = useMemo(() => {
    if (!font) return {};
    try { return { html: renderGraphic(source, { interactive: true }).replace(/(<svg[^>]*>)/, `$1${mathFontStyle(font)}`) }; }
    catch (error) { return { error: error.message }; }
  }, [source, font]);
  useLayoutEffect(() => {
    for (const group of root.current?.querySelectorAll('[data-selection]') ?? []) {
      const selected = group.dataset.selection === selection;
      group.classList.toggle('is-selected', selected);
      group.setAttribute('aria-pressed', String(selected));
      if (group.querySelector('.math-graphic-hit')) continue;
      for (const shape of [...group.children].filter(e => ['path', 'circle', 'ellipse', 'polygon', 'polyline'].includes(e.tagName))) {
        const hit = shape.cloneNode(true);
        hit.classList.add('math-graphic-hit');
        hit.setAttribute('aria-hidden', 'true');
        group.prepend(hit);
      }
    }
  }, [preview, selection]);
  if (preview.error) return <p className="math-message" role="alert">{preview.error}</p>;
  if (!preview.html) return <p role="status">正在准备画布…</p>;
  const select = event => {
    const element = event.target.closest('[data-selection]');
    if (element) onSelect(element.dataset.selection);
  };
  return <div className="math-graphic-preview" ref={root} aria-label="数学图形编辑画布" onClick={select}
    onKeyDown={event => { if (['Enter', ' '].includes(event.key) && event.target.closest('[data-selection]')) { event.preventDefault(); select(event); } }}
    dangerouslySetInnerHTML={{ __html: preview.html }}/>;
}
