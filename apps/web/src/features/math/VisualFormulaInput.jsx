import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';

export default function VisualFormulaInput({ value, onChange, autoFocus = false, onConfirm }) {
  const { t, i18n } = useTranslation('math');
  const host = useRef(null);
  const field = useRef(null);
  const allowFocus = useRef(() => {});
  const current = useRef({ value, onChange, onConfirm });
  current.current = { value, onChange, onConfirm };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let live = true;
    const lifecycle = new AbortController();
    setError(false); setReady(false);
    Promise.all([import('mathlive'), import('mathlive/fonts.css')]).then(([{ MathfieldElement }]) => {
      if (!live) return;
      MathfieldElement.fontsDirectory = null; // Vite bundles the pinned local fonts.
      MathfieldElement.soundsDirectory = null;
      MathfieldElement.locale = i18n.resolvedLanguage;
      const input = new MathfieldElement();
      input.mathVirtualKeyboardPolicy = 'manual';
      input.setAttribute('aria-label', t("可视化公式输入"));
      input.value = current.current.value;
      input.addEventListener('input', () => current.current.onChange(input.value));
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && !event.repeat && !event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey && current.current.onConfirm) {
          event.preventDefault(); event.stopPropagation(); void current.current.onConfirm();
        }
      });
      host.current.replaceChildren(input);
      input.menuItems = [];
      field.current = input;
      // MathLive 0.110.0 completes focus asynchronously. Once another control
      // has received focus, that pending completion must not take it back.
      let transferred = null;
      allowFocus.current = () => { transferred = null; };
      document.addEventListener('pointerdown', event => {
        if (event.composedPath().includes(input) || event.target.closest?.('.math-visual-formula .math-insert')) transferred = null;
        else transferred = event.target.closest?.('input, textarea, select, button, a[href], [tabindex]') ?? document.activeElement;
      }, { capture: true, signal: lifecycle.signal });
      document.addEventListener('keydown', event => {
        if (event.key === 'Tab') transferred = null;
      }, { capture: true, signal: lifecycle.signal });
      document.addEventListener('focusin', event => {
        if (event.target !== input) { transferred = event.target; return; }
        const target = transferred;
        if (target?.isConnected) queueMicrotask(() => {
          if (live && transferred === target && document.activeElement === input) target.focus({ preventScroll: true });
        });
      }, { capture: true, signal: lifecycle.signal });
      setReady(true);
      if (autoFocus) input.focus();
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; lifecycle.abort(); allowFocus.current = () => {}; field.current = null; host.current?.replaceChildren(); };
  }, [attempt]);
  useEffect(() => {
    if (field.current && field.current.value !== value) {
      field.current.setValue(value, { silenceNotifications: true });
      field.current.resetUndo();
    }
  }, [value, ready]);
  useEffect(() => {
    if (!field.current) return;
    field.current.constructor.locale = i18n.resolvedLanguage;
    field.current.setAttribute('aria-label', t('可视化公式输入'));
  }, [ready, i18n.resolvedLanguage, t]);
  function insert(latex) {
    allowFocus.current();
    field.current?.focus();
    field.current?.insert(latex, { selectionMode: 'placeholder' });
  }
  return <div className="math-visual-formula">
    <p className="math-hint">{t("点击公式中的位置直接输入，用方向键移动。选中内容后，可将它放入分式或根式。")}</p>
    {error && <p role="alert">{t("公式编辑器暂时无法加载，源码仍保留。")}<button onClick={() => retry(n => n + 1)}>{t("重试")}</button></p>}
    {!ready && !error && <p role="status">{t("正在准备公式编辑器…")}</p>}
    <div ref={host} className="math-visual-field"/>
    <div className="math-insert" aria-label={t("插入公式结构")}>
      {[
        [t("分式"), '\\frac{#@}{#?}'], [t("根式"), '\\sqrt{#@}'], [t("上标"), '#@^{#?}'], [t("下标"), '#@_{#?}'],
        [t("向量"), '\\overrightarrow{#@}'], [t("分段式"), '\\begin{cases}#? & #?\\\\#? & #?\\end{cases}'],
      ].map(([label, latex]) => <button key={label} disabled={!ready} onMouseDown={event => event.preventDefault()} onClick={() => insert(latex)}>{label}</button>)}
    </div>
  </div>;
}
