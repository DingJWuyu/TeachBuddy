import { MathSourceError } from './expression.js';
import { escapeXml } from './graphics.js';

// Both MathJax entry points use only base + ams. No autoload, require, HTML,
// URL or user-defined macro packages are installed in either renderer.
export const formulaPackages = ['base', 'ams'];
export function checkFormula(latex) {
  const fail = (message, position) => { throw Object.assign(new MathSourceError('invalid-formula', message), { position }); };
  if (!latex.trim()) fail('LaTeX 不能为空', 0);
  const opened = [];
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === '\\') { i++; continue; }
    if (latex[i] === '%') { while (i < latex.length && latex[i] !== '\n') i++; continue; }
    if (latex[i] === '{') opened.push(i);
    if (latex[i] === '}' && opened.pop() === undefined) fail('多余的右花括号', i);
  }
  if (opened.length) fail('花括号未闭合', opened.at(-1));
}

export function mathFontStyle(fontBase64) {
  return `<style>@font-face{font-family:'Noto Sans SC';src:url(data:font/woff;base64,${fontBase64}) format('woff')}text{font-family:'Noto Sans SC',sans-serif}</style>`;
}
export function formulaSvg(source, mathSvg, fontBase64, width) {
  const match = mathSvg.match(/viewBox="([^"]+)"/);
  if (!match || /data-mjx-error|<merror/.test(mathSvg))
    throw new MathSourceError('invalid-formula', '请检查 LaTeX 语法');
  const [x, y, w, h] = match[1].split(/\s+/).map(Number);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0)
    throw new MathSourceError('invalid-formula', '公式没有可显示内容');
  const size = source.fontSize, padding = size, captionSize = size * 0.65;
  const formulaWidth = w * size / 1000, formulaHeight = h * size / 1000;
  const lines = [];
  if (source.includeCaption && source.caption) {
    for (const paragraph of source.caption.split('\n')) {
      const chars = Array.from(paragraph);
      if (!chars.length) lines.push('');
      for (let i = 0; i < chars.length; i += 40) lines.push(chars.slice(i, i + 40).join(''));
    }
  }
  const captionWidth = Math.max(0, ...lines.map(line => Array.from(line).length * captionSize));
  const naturalWidth = Math.ceil(Math.max(formulaWidth, captionWidth) + 2 * padding);
  const naturalHeight = Math.ceil(formulaHeight + 2 * padding + (lines.length ? size / 2 + lines.length * captionSize * 1.6 : 0));
  const outputWidth = width ?? naturalWidth;
  const outputHeight = Math.max(1, Math.round(outputWidth * naturalHeight / naturalWidth));
  const inner = mathSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const caption = lines.map((line, i) => `<text x="${padding}" y="${padding + formulaHeight + size / 2 + (i + 1) * captionSize * 1.6}" font-size="${captionSize}">${escapeXml(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${naturalWidth} ${naturalHeight}" color="${source.color}" fill="${source.color}">${mathFontStyle(fontBase64)}<svg x="${padding}" y="${padding}" width="${formulaWidth}" height="${formulaHeight}" viewBox="${x} ${y} ${w} ${h}">${inner}</svg>${caption}</svg>`;
}
