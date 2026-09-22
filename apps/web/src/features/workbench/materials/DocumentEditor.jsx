import { useState } from 'react';
import { supportedDocument } from '@refatos/shared';
import { parseInlineRuns, serializeInlineRuns } from '../documents.js';
import { DocumentView, Formula, ControlledImage } from './DocumentView.jsx';

const paragraph = () => ({ type: 'paragraph', runs: [] });
const kinds = {
  paragraph: '段落',
  math: '公式',
  image: '图片',
  heading: '标题',
  list: '列表',
  table: '表格',
  'teacher-note': '教师注记'
};
function Controls({ index, count, label, change }) {
  return (
    <div className="wb-block-controls">
      <button
        type="button"
        className="wb-icon-button"
        aria-label={`上移${label}`}
        disabled={!index}
        onClick={() => change('up')}
      >
        ↑
      </button>
      <button
        type="button"
        className="wb-icon-button"
        aria-label={`下移${label}`}
        disabled={index === count - 1}
        onClick={() => change('down')}
      >
        ↓
      </button>
      <button
        type="button"
        className="wb-icon-button"
        aria-label={`删除${label}`}
        onClick={() => change('remove')}
      >
        ×
      </button>
    </div>
  );
}
function Text({ value, change, label }) {
  return (
    <textarea
      className="wb-input wb-auto-textarea"
      rows={Math.max(1, value.split('\n').length)}
      aria-label={label}
      value={value}
      onChange={(e) => change(e.target.value)}
    />
  );
}
function BlockEditor({ block, change, label, onOpenFile, onPickImage }) {
  const [error, setError] = useState('');
  async function pick() {
    try {
      const file = await onPickImage?.();
      if (file) change({ ...block, fileId: file.id });
      setError('');
    } catch {
      setError('图片未能保存，请重试。');
    }
  }
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return (
        <div className="wb-inline-editor">
          {block.type === 'heading' && (
            <select
              aria-label={`${label}层级`}
              value={block.level}
              onChange={(e) => change({ ...block, level: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} 级标题
                </option>
              ))}
            </select>
          )}
          <Text
            label={label}
            value={serializeInlineRuns(block.runs)}
            change={(text) => change({ ...block, runs: parseInlineRuns(text) })}
          />
          {block.runs.some((r) => r.type === 'math') && (
            <DocumentView value={{ version: 2, blocks: [block] }} />
          )}
        </div>
      );
    case 'math':
      return (
        <div className="wb-math-block-editor">
          <Text
            label={`${label}源`}
            value={block.latex}
            change={(latex) => change({ ...block, latex })}
          />
          <div className="wb-math-block-preview">
            <Formula latex={block.latex} display />
          </div>
        </div>
      );
    case 'image':
      return (
        <div>
          <ControlledImage {...block} onOpenFile={onOpenFile} />
          <label>
            图像说明
            <Text
              label={`${label}说明`}
              value={block.alt}
              change={(alt) => change({ ...block, alt })}
            />
          </label>
          <label>
            宽度（毫米）
            <input
              aria-label={`${label}宽度`}
              type="number"
              min="5"
              max="170"
              value={block.widthMm}
              onChange={(e) => change({ ...block, widthMm: Number(e.target.value) })}
            />
          </label>
          <button type="button" disabled={!onPickImage} onClick={pick}>
            替换图片
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      );
    case 'teacher-note':
      return (
        <div className="material-note">
          <span>教师注记</span>
          <BlockList
            blocks={block.blocks}
            change={(blocks) => change({ ...block, blocks })}
            label={label}
            leaf
            onOpenFile={onOpenFile}
            onPickImage={onPickImage}
          />
        </div>
      );
    case 'list':
      return (
        <div>
          <select
            aria-label={`${label}用途`}
            value={block.role}
            onChange={(e) => change({ ...block, role: e.target.value })}
          >
            {[
              ['plain', '普通列表'],
              ['options', '选项'],
              ['subquestions', '小问']
            ].map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </select>
          {block.items.map((item, i) => (
            <div className="material-list-item" key={i}>
              <Text
                label={`${label}项目 ${i + 1}标号`}
                value={item.label}
                change={(text) =>
                  change({
                    ...block,
                    items: block.items.map((x, j) => (i === j ? { ...x, label: text } : x))
                  })
                }
              />
              <BlockList
                blocks={item.blocks}
                change={(blocks) =>
                  change({
                    ...block,
                    items: block.items.map((x, j) => (i === j ? { ...x, blocks } : x))
                  })
                }
                label={`${label}项目 ${i + 1}`}
                leaf
                onOpenFile={onOpenFile}
                onPickImage={onPickImage}
              />
              <Controls
                index={i}
                count={block.items.length}
                label={`${label}项目 ${i + 1}`}
                change={(action) => change({ ...block, items: reorder(block.items, i, action) })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              change({ ...block, items: [...block.items, { label: '', blocks: [paragraph()] }] })
            }
          >
            添加项目
          </button>
        </div>
      );
    case 'table':
      return (
        <div className="material-table-scroll">
          <table>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      <BlockList
                        blocks={cell.blocks}
                        change={(blocks) =>
                          change({
                            ...block,
                            rows: block.rows.map((r, ri) =>
                              ri === i ? r.map((c, ci) => (ci === j ? { blocks } : c)) : r
                            )
                          })
                        }
                        label={`${label}第 ${i + 1} 行第 ${j + 1} 列`}
                        leaf
                        onOpenFile={onOpenFile}
                        onPickImage={onPickImage}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="wb-block-add">
            <button
              type="button"
              onClick={() =>
                change({
                  ...block,
                  rows: [...block.rows, block.rows[0].map(() => ({ blocks: [] }))]
                })
              }
            >
              添加行
            </button>
            <button
              type="button"
              disabled={block.rows.length === 1}
              onClick={() => change({ ...block, rows: block.rows.slice(0, -1) })}
            >
              删除末行
            </button>
            <button
              type="button"
              onClick={() =>
                change({ ...block, rows: block.rows.map((row) => [...row, { blocks: [] }]) })
              }
            >
              添加列
            </button>
            <button
              type="button"
              disabled={block.rows[0].length === 1}
              onClick={() => change({ ...block, rows: block.rows.map((row) => row.slice(0, -1)) })}
            >
              删除末列
            </button>
          </div>
        </div>
      );
    default:
      return <pre>{JSON.stringify(block)}</pre>;
  }
}
function reorder(items, index, action) {
  if (action === 'remove') return items.filter((_, i) => i !== index);
  const target = index + (action === 'up' ? -1 : 1);
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
function BlockList({
  blocks,
  change,
  label,
  leaf = false,
  legacy = false,
  onOpenFile,
  onPickImage
}) {
  const [error, setError] = useState('');
  async function append(type) {
    let block;
    if (type === 'paragraph') block = paragraph();
    if (type === 'math') block = { type, latex: '' };
    if (type === 'heading') block = { type, level: 1, runs: [] };
    if (type === 'list')
      block = { type, role: 'plain', items: [{ label: '', blocks: [paragraph()] }] };
    if (type === 'table') block = { type, rows: [[{ blocks: [] }, { blocks: [] }]] };
    if (type === 'teacher-note') block = { type, blocks: [paragraph()] };
    if (type === 'image') {
      try {
        const file = await onPickImage?.();
        if (!file) return;
        block = { type, fileId: file.id, alt: '', widthMm: 100 };
      } catch {
        setError('图片未能保存，请重试。');
        return;
      }
    }
    setError('');
    change([...blocks, block]);
  }
  const counts = {};
  return (
    <div className="material-block-list">
      {blocks.map((block, i) => {
        counts[block.type] = (counts[block.type] ?? 0) + 1;
        const blockLabel = `${label}${kinds[block.type]} ${counts[block.type]}`;
        return (
          <div className="wb-block material-edit-block" key={i}>
            <BlockEditor
              block={block}
              label={blockLabel}
              change={(value) => change(blocks.map((x, j) => (j === i ? value : x)))}
              onOpenFile={onOpenFile}
              onPickImage={onPickImage}
            />
            <Controls
              index={i}
              count={blocks.length}
              label={blockLabel}
              change={(action) => change(reorder(blocks, i, action))}
            />
          </div>
        );
      })}
      <div className="wb-block-add">
        {Object.entries(kinds)
          .filter(([type]) =>
            legacy
              ? ['paragraph', 'math'].includes(type)
              : !leaf || ['paragraph', 'math', 'image'].includes(type)
          )
          .map(([type, text]) => (
            <button
              type="button"
              className="wb-button"
              key={type}
              disabled={type === 'image' && !onPickImage}
              onClick={() => append(type)}
            >
              {text}
            </button>
          ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function DocumentEditor({
  value,
  document,
  onChange,
  readOnly = false,
  onOpenFile,
  onPickImage,
  label = '文稿'
}) {
  const source = value ?? document;
  if (value === undefined && source?.version === 2)
    return (
      <div data-document-editor={label}>
        <p className="wb-field-error" data-region="unsupported-version">
          这段内容来自更新的文档版本 2，在这里只读保留，不会被改写。
        </p>
        <DocumentView value={source} onOpenFile={onOpenFile} />
      </div>
    );
  if (readOnly || !supportedDocument(source))
    return (
      <div data-document-editor={label}>
        <DocumentView value={source} onOpenFile={onOpenFile} />
      </div>
    );
  // Legacy callers retain their v1 controls. The materials value interface may
  // promote to v2 only when a new node is actually introduced.
  return (
    <div className="wb-document-editor material-editor" data-document-editor={label}>
      <BlockList
        blocks={source.blocks}
        label={label}
        legacy={value === undefined}
        onOpenFile={onOpenFile}
        onPickImage={onPickImage}
        change={(blocks) =>
          onChange({
            version:
              source.version === 2 || blocks.some((b) => !['paragraph', 'math'].includes(b.type))
                ? 2
                : 1,
            blocks
          })
        }
      />
    </div>
  );
}
