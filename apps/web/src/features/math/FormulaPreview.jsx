import React, { useEffect, useState } from 'react';
import { checkFormula, formulaPackages, formulaSvg } from '../../../../../packages/shared/src/math/formula.js';

import { loadMathFont } from './localFont.js';

let renderer;
function loadRenderer() {
  if (!renderer) renderer = (async () => {
    window.MathJax = {
      tex: { packages: formulaPackages, maxBuffer: 10000,
        formatError: (_jax, error) => { throw new Error(error.message); } },
      svg: { fontCache: 'none' }, startup: { typeset: false }
    };
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/math/mathjax-3.2.2/tex-svg.js';
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('公式组件加载失败，请重试')); };
      document.head.append(script);
    });
    await window.MathJax.startup.promise;
    const font = await loadMathFont();
    return { mathjax: window.MathJax, font };
  })().catch(error => { renderer = null; throw error; });
  return renderer;
}
export default function FormulaPreview({ source, retry, onLocate }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let live = true;
    setPreview(null);
    if (!source.latex.trim()) return;
    const timer = setTimeout(async () => {
      try {
        checkFormula(source.latex);
        const { mathjax, font } = await loadRenderer();
        mathjax.texReset();
        const node = mathjax.tex2svg(source.latex, { display: true });
        const svg = formulaSvg(source, node.querySelector('svg').outerHTML, font);
        if (live) setPreview({ source, url: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })) });
      } catch (error) {
        if (live) setPreview({ source, error: error.message, position: error.position });
      }
    }, 150);
    return () => { live = false; clearTimeout(timer); };
  }, [source, retry]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  if (!source.latex.trim()) return <div className="math-formula-preview math-formula-placeholder">输入公式，预览会显示在这里</div>;
  if (!preview || preview.source !== source) return <div className="math-formula-preview math-formula-placeholder" role="status">正在预览…</div>;
  const before = Number.isInteger(preview.position) ? source.latex.slice(0, preview.position).split('\n') : null;
  return preview.error ? <div role="alert">LaTeX：{preview.error}
    {before ? <button onClick={() => onLocate(preview.position)}>定位到第 {before.length} 行第 {Array.from(before.at(-1)).length + 1} 列</button>
      : <p>无法精确定位，请检查 LaTeX 源码。</p>}
  </div>
    : <div className="math-formula-preview"><img alt="当前公式预览" src={preview.url} /></div>;
}
