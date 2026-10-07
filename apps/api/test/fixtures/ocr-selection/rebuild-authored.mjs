import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

// Run after npm ci and npx playwright install chromium. Output is deliberately
// separate from the frozen fixtures. Rendering never reads an OCR result.
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../../..');
const requireWeb = createRequire(path.join(root, 'apps/web/package.json'));
const katex = requireWeb('katex');
const output = path.resolve(process.argv[2] ?? path.join(root, 'test-results/ocr-selection/inputs/rebuilt-authored'));
const split = process.argv[3] ?? 'development';
if (!['development', 'heldout'].includes(split)) throw new Error('Expected development or heldout');
const source = JSON.parse(await fs.readFile(path.join(directory, `authoring-${split}.json`), 'utf8'));
await fs.mkdir(output, { recursive: true });
const cssKatex = pathToFileURL(path.join(path.dirname(requireWeb.resolve('katex')), 'katex.min.css')).href;
const fontDir = path.join(root, 'node_modules/@fontsource/noto-sans-sc');
const cssFont = pathToFileURL(path.join(fontDir, '400.css')).href;
const cssBold = pathToFileURL(path.join(fontDir, '700.css')).href;
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const normalize = (s) => s.normalize('NFKC').replace(/\s/gu, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1654, height: 2339 }, deviceScaleFactor: 1 });
const references = [];
try {
  for (const input of source.pages) {
    let nextFormula = 0;
    let nextBody = 0;
    const formulas = [];
    const bodies = [];
    const tables = [];
    const runs = (items, body = true) => {
      const formulaIds = [];
      let text = '';
      const html = items.map((item) => {
        if (typeof item === 'string') { text += item; return `<span>${escape(item)}</span>`; }
        const id = `${input.id}-f${++nextFormula}`;
        formulaIds.push(id);
        formulas.push({ id, latex: item.latex });
        return `<span class="formula" data-formula="${id}">${katex.renderToString(item.latex, { throwOnError: true })}</span>`;
      }).join('');
      if (!body) return { html, text, formulaIds };
      const id = `${input.id}-b${++nextBody}`;
      if (normalize(text)) bodies.push({ id, text });
      return `<p data-body="${normalize(text) ? id : ''}">${html}</p>`;
    };
    const title = runs([input.title]);
    const subtitle = runs([input.subtitle]);
    const sectionHtml = input.sections.map((section, index) => {
      let content = `<section>${runs([section.heading])}`;
      content += (section.paragraphs ?? []).map((p) => runs(p)).join('');
      if (section.figure === 'circle-tangent') {
        content += `<figure data-figure="${input.id}-g1"><svg viewBox="0 0 900 430" xmlns="http://www.w3.org/2000/svg"><g stroke="#222" stroke-width="3" fill="none"><circle cx="260" cy="225" r="145"/><path d="M260 225 L620 225 L318.4 92.25 Z"/><path d="M309 113 L329 122 L338 101"/></g><g fill="#111" font-size="34" font-family="Noto Sans SC"><text x="224" y="269">O</text><text x="622" y="255">P</text><text x="295" y="75">A</text><text x="226" y="143">5</text><text x="420" y="267">13</text><text x="461" y="127">切线</text></g></svg><figcaption>${runs(['图 1　半径与切线在切点处互相垂直。'])}</figcaption></figure>`;
      }
      if (section.table) {
        const id = `${input.id}-t${index + 1}`;
        const cells = [];
        content += `<table data-table="${id}"><colgroup>${section.table.columns.map((w) => `<col style="width:${w * 100}%">`).join('')}</colgroup>`;
        content += section.table.rows.map((row, r) => `<tr>${row.map((cell, c) => {
          const value = runs(cell, false);
          const cellId = `${id}-r${r}-c${c}`;
          cells.push({ id: cellId, row: r, column: c, rowSpan: 1, columnSpan: 1, text: value.text, formulaIds: value.formulaIds });
          const bodyId = normalize(value.text) ? `${cellId}-body` : '';
          if (bodyId) bodies.push({ id: bodyId, text: value.text });
          return `<${r === 0 ? 'th' : 'td'} data-cell="${cellId}" data-body="${bodyId}">${value.html}</${r === 0 ? 'th' : 'td'}>`;
        }).join('')}</tr>`).join('');
        content += '</table>';
        tables.push({ id, rows: section.table.rows.length, columns: section.table.columns.length, cells });
      }
      return content + '</section>';
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${cssFont}"><link rel="stylesheet" href="${cssBold}"><link rel="stylesheet" href="${cssKatex}"><style>
      *{box-sizing:border-box}html,body{margin:0;background:white;color:#171717}body{font-family:'Noto Sans SC',sans-serif;font-size:27px;line-height:1.7}.sheet{width:1654px;height:2339px;padding:100px 115px;transform:rotate(${input.angle ?? 0}deg);transform-origin:50% 50%}.title p{font-size:46px;font-weight:700;margin:0 0 12px}.subtitle p{font-size:24px;color:#444;border-bottom:2px solid #333;padding-bottom:25px;margin:0 0 35px}p{margin:14px 0}.columns{${input.twoColumns ? 'column-count:2;column-gap:70px;' : ''}}section{break-inside:avoid;margin:0 0 28px}section>p:first-child{font-size:30px;font-weight:700;line-height:1.45;margin-top:0}.formula{display:inline-block;margin:0 5px}.katex{font-size:1.17em}.katex .text{font-family:'Noto Sans SC',sans-serif}table{border-collapse:collapse;width:100%;margin:25px 0;font-size:25px;line-height:1.65;table-layout:fixed}td,th{border:2px solid #222;padding:18px;overflow-wrap:break-word;text-align:left}th{background:#f2f2f2}td .katex{font-size:1em}figure{margin:20px 0}svg{display:block;width:100%;height:420px}figcaption p{font-size:23px;text-align:center;color:#333}footer{position:absolute;bottom:60px;left:115px;font-size:20px;color:#555}
      </style><div class="sheet"><header class="title">${title}</header><div class="subtitle">${subtitle}</div><main class="columns">${sectionHtml}</main><footer>作者稿 · 固定教学材料</footer></div>`;
    const htmlPath = path.join(output, `${input.id}.html`);
    await fs.writeFile(htmlPath, html);
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => document.fonts.ready);
    const measured = await page.evaluate(() => {
      const result = {};
      for (const [selector, name] of [['[data-body]', 'body'], ['[data-formula]', 'formula'], ['[data-cell]', 'cell'], ['[data-table]', 'table'], ['[data-figure]', 'figure']]) {
        for (const element of document.querySelectorAll(selector)) {
          const id = element.dataset[name];
          if (!id) continue;
          const rect = element.getBoundingClientRect();
          result[id] = [Math.floor(rect.left), Math.floor(rect.top), Math.ceil(rect.right), Math.ceil(rect.bottom)];
        }
      }
      return result;
    });
    if (Object.values(measured).some((b) => b[0] < 0 || b[1] < 0 || b[2] > 1654 || b[3] > 2250)) throw new Error(`${input.id} content is clipped`);
    for (const item of [...bodies, ...formulas]) item.bbox = measured[item.id];
    for (const table of tables) { table.bbox = measured[table.id]; for (const cell of table.cells) cell.bbox = measured[cell.id]; }
    const figures = input.sections.some((s) => s.figure) ? [{ id: `${input.id}-g1`, bbox: measured[`${input.id}-g1`], labels: ['O', 'P', 'A', '5', '13', '切线'], criticalLabels: ['O', 'P', 'A', '5', '13'] }] : [];
    const blocks = [...bodies.map((b) => ({ id: b.id, type: 'body', bbox: b.bbox })), ...formulas.map((b) => ({ id: b.id, type: 'formula', bbox: b.bbox })), ...tables.map((b) => ({ id: b.id, type: 'table', bbox: b.bbox })), ...figures.map((b) => ({ id: b.id, type: 'figure', bbox: b.bbox }))];
    references.push({ id: input.id, contentGroup: input.contentGroup, imageSize: [1654, 2339], body: bodies, formulas, tables, figures, blocks, denominators: { bodyCharacters: [...normalize(bodies.map((b) => b.text).join(''))].length, formulas: formulas.length, tableCells: tables.reduce((n,t) => n+t.cells.length,0), importantBlocks: blocks.length }, referenceOrigin: `authoring-${split}.json and visual page inspection` });
    await page.screenshot({ path: path.join(output, `${input.id}.png`), fullPage: false });
    await fs.unlink(htmlPath);
  }
  await fs.writeFile(path.join(output, `authored-${split}.truth.json`), JSON.stringify({ pages: references }, null, 2) + '\n');
  console.log(`Rendered ${references.length} ${split} pages into ${output}`);
} finally { await browser.close(); }
