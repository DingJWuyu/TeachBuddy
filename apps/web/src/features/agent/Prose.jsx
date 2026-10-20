import { Fragment } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
function agentMarkdown(text) {
  return text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$${math}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);
}


/*
 * Assistant answers are markdown with LaTeX. The app ships react-markdown with
 * math but without GFM, so pipe tables are lifted out here and drawn as real
 * tables; everything else goes through the app's own renderer.
 */
function splitBlocks(text) {
  const lines = text.split('\n');
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) { out.push({ type: 'md', text: buf.join('\n') }); buf = []; } };
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*\|.*\|\s*$/.test(lines[i])) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i += 1; }
      i -= 1;
      const cells = (row) => row.trim().slice(1, -1).split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(cells);
      out.push({ type: 'table', head: body[0] ?? [], rows: body.slice(1) });
    } else buf.push(lines[i]);
  }
  flush();
  return out;
}

function Inline({ text }) {
  return (
    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]} skipHtml components={{ p: ({ children }) => <Fragment>{children}</Fragment> }}>
      {agentMarkdown(text)}
    </Markdown>
  );
}
export { Inline };

export function Prose({ text, className = 'tbx-prose' }) {
  const blocks = splitBlocks(text || '');
  return (
    <div className={className}>
      {blocks.map((b, i) => (b.type === 'table' ? (
        <div className="tbx-table" key={i}>
          <table>
            <thead><tr>{b.head.map((c, j) => <th key={j}><Inline text={c} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <Markdown key={i} remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]} skipHtml>
          {agentMarkdown(b.text)}
        </Markdown>
      )))}
    </div>
  );
}
