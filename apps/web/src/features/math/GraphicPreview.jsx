import { useTranslation } from 'react-i18next';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { renderGraphic } from '@teachbuddy/shared/math/graphics';
import { renderDynamic } from '@teachbuddy/shared/math/dynamic';
import { mathFontStyle } from '@teachbuddy/shared/math/formula';

export default function GraphicPreview({ source, font, selection, onSelect }) {
  const { t } = useTranslation('math');
  const root = useRef(null);
  const preview = useMemo(() => {
    if (!font) return {};
    try {
      const render = source.kind === 'dynamic' ? renderDynamic : renderGraphic;
      return { html: render(source, { interactive: !!onSelect, selectionLabel: name => t('选择 {{name}}', { name }) }).replace(/(<svg[^>]*>)/, `$1${mathFontStyle(font)}`) };
    }
    catch (error) { return { error: error.message, reason: error.reason }; }
  }, [source, font, !!onSelect, t]);
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
  if (preview.error) {
    const fallback = preview.reason === 'invalid-geometry' ? t('sourceError.geometry')
      : preview.reason === 'invalid-expression' ? t('sourceError.expression') : preview.error;
    const message = t(preview.error, { defaultValue: fallback });
    const detail = t(preview.error, { defaultValue: preview.error });
    return <p className="math-message" role="alert" title={detail}>{message}</p>;
  }
  if (!preview.html) return <p role="status">{t("正在准备画布…")}</p>;
  const select = event => {
    const element = event.target.closest('[data-selection]');
    if (element) onSelect?.(element.dataset.selection);
  };
  return <div className="math-graphic-preview" ref={root} aria-label={onSelect ? t("数学图形编辑画布") : t("数学图形预览")} onClick={select}
    onKeyDown={event => { if (['Enter', ' '].includes(event.key) && event.target.closest('[data-selection]')) { event.preventDefault(); select(event); } }}
    dangerouslySetInnerHTML={{ __html: preview.html }}/>;
}
