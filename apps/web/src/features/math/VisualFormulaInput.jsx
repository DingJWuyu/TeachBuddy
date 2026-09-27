import { useEffect, useRef, useState } from 'react';

export default function VisualFormulaInput({ value, onChange }) {
  const host = useRef(null);
  const field = useRef(null);
  const allowFocus = useRef(() => {});
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
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
      const input = new MathfieldElement();
      input.mathVirtualKeyboardPolicy = 'manual';
      input.setAttribute('aria-label', '可视化公式输入');
      input.value = current.current.value;
      input.addEventListener('input', () => current.current.onChange(input.value));
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
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; lifecycle.abort(); allowFocus.current = () => {}; field.current = null; host.current?.replaceChildren(); };
  }, [attempt]);
  useEffect(() => {
    if (field.current && field.current.value !== value) {
      field.current.setValue(value, { silenceNotifications: true });
      field.current.resetUndo();
    }
  }, [value, ready]);
  function insert(latex) {
    allowFocus.current();
    field.current?.focus();
    field.current?.insert(latex, { selectionMode: 'placeholder' });
  }
  return <div className="math-visual-formula">
    <p className="math-hint">点击公式中的位置直接输入，用方向键移动。选中内容后，可将它放入分式或根式。</p>
    {error && <p role="alert">公式编辑器暂时无法加载，源码仍保留。<button onClick={() => retry(n => n + 1)}>重试</button></p>}
    {!ready && !error && <p role="status">正在准备公式编辑器…</p>}
    <div ref={host} className="math-visual-field"/>
    <div className="math-insert" aria-label="插入公式结构">
      {[
        ['分式', '\\frac{#@}{#?}'], ['根式', '\\sqrt{#@}'], ['上标', '#@^{#?}'], ['下标', '#@_{#?}'],
        ['向量', '\\overrightarrow{#@}'], ['分段式', '\\begin{cases}#? & #?\\\\#? & #?\\end{cases}'],
      ].map(([label, latex]) => <button key={label} disabled={!ready} onMouseDown={event => event.preventDefault()} onClick={() => insert(latex)}>{label}</button>)}
    </div>
  </div>;
}
