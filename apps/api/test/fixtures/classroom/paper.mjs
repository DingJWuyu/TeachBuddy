import sharp from 'sharp';
import { generateDocx } from '../../../src/workbench/files/pandoc.js';

const paragraph = text => ({ type: 'paragraph', runs: [{ type: 'text', text }] });

export async function paperImage() {
  return sharp(Buffer.from(`<svg width="1000" height="1200" xmlns="http://www.w3.org/2000/svg">
    <rect width="1000" height="1200" fill="white"/>
    <g font-family="Noto Sans CJK SC" fill="#111" font-size="34">
      <text x="75" y="100">班级考试原卷</text>
      <text x="75" y="200">1. 解方程 x² - 5x + 6 = 0。（4 分）</text>
      <text x="75" y="370">2. 求直角三角形 ABC 的面积。（6 分）</text>
      <text x="200" y="480">A</text><text x="200" y="825">B</text><text x="650" y="825">C</text>
      <text x="150" y="660">3</text><text x="410" y="860">4</text><text x="450" y="610">5</text>
    </g>
    <path d="M230 500 L230 800 L630 800 Z M230 770 L260 770 L260 800" fill="none" stroke="#111" stroke-width="4"/>
  </svg>`)).png().toBuffer();
}

export async function paperFigure() {
  return sharp(await paperImage()).extract({ left: 100, top: 430, width: 650, height: 500 }).png().toBuffer();
}

export async function paperDocx({ files, principal, figureFileId }) {
  return generateDocx([
    { type: 'heading', level: 1, runs: [{ type: 'text', text: '班级考试原卷' }] },
    paragraph('数学正式考试　满分 10 分'),
    { type: 'question', blocks: [
      { type: 'paragraph', runs: [{ type: 'text', text: '1. 解方程 ' },
        { type: 'math', latex: 'x^2-5x+6=0' }, { type: 'text', text: '。（4 分）' }] },
      paragraph('请写出两个根。'),
    ] },
    { type: 'question', blocks: [
      paragraph('2. 求直角三角形 ABC 的面积。（6 分）'),
      paragraph('直角边分别为 3 和 4，斜边为 5。'),
      { type: 'image', fileId: figureFileId, widthMm: 100, alt: '直角三角形 ABC' },
    ] },
  ], { files, principal });
}
