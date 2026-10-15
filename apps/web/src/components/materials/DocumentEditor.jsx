import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: "workbench", ...options });
import { useState } from 'react';
import { supportedDocument } from '@refatos/shared';
import { parseInlineRuns, serializeInlineRuns } from './documents.js';
import { DocumentView, Formula, ControlledImage } from './DocumentView.jsx';
import { Icon } from '../icons.jsx';
import { Popover, MenuItem } from '../interaction/ModuleOverlays.jsx';

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
  const { t } = useTranslation("workbench");
  return (
    <div className="wb-block-controls">
      <button
        type="button"
        className="wb-icon-button"
        aria-label={t("上移{{label}}", { label: label })}
        disabled={!index}
        onClick={() => change('up')}
      >
        <Icon name="chevron" size={14} className="material-move-up" />
      </button>
      <button
        type="button"
        className="wb-icon-button"
        aria-label={t("下移{{label}}", { label: label })}
        disabled={index === count - 1}
        onClick={() => change('down')}
      >
        <Icon name="chevron" size={14} className="material-move-down" />
      </button>
      <button
        type="button"
        className="wb-icon-button"
        aria-label={t("删除{{label}}", { label: label })}
        onClick={() => change('remove')}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
function Text({ value, change, label }) {
  useTranslation("workbench");
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
  const { t } = useTranslation("workbench");
  const [error, setError] = useState('');
  async function pick() {
    try {
      const file = await onPickImage?.();
      if (file) change({ ...block, fileId: file.id });
      setError('');
    } catch {
      setError(t("图片未能保存，请重试。"));
    }
  }
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return (
        <div className="wb-inline-editor">
          {block.type === 'heading' && (
            <select
              aria-label={t("{{label}}层级", { label: label })}
              value={block.level}
              onChange={(e) => change({ ...block, level: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} {t("级标题")} </option>
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
            label={t("{{label}}源", { label: label })}
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
          <label> {t("图像说明")} <Text
              label={t("{{label}}说明", { label: label })}
              value={block.alt}
              change={(alt) => change({ ...block, alt })}
            />
          </label>
          <label> {t("宽度（毫米）")} <input
              aria-label={t("{{label}}宽度", { label: label })}
              type="number"
              min="5"
              max="170"
              value={block.widthMm}
              onChange={(e) => change({ ...block, widthMm: Number(e.target.value) })}
            />
          </label>
          <button type="button" disabled={!onPickImage} onClick={pick}> {t("替换图片")} </button>
          {error && <p role="alert">{error}</p>}
        </div>
      );
    case 'teacher-note':
      return (
        <div className="material-note">
          <span>{t("教师注记")}</span>
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
            aria-label={t("{{label}}用途", { label: label })}
            value={block.role}
            onChange={(e) => change({ ...block, role: e.target.value })}
          >
            {[
              ['plain', t("普通列表")],
              ['options', t("选项")],
              ['subquestions', t("小问")]
            ].map(([id, text]) => (
              <option key={id} value={id}>
                {t(text)}
              </option>
            ))}
          </select>
          {block.items.map((item, i) => (
            <div className="material-list-item" key={i}>
              <Text
                label={t("{{label}}项目 {{detail}}标号", { label: label, detail: i + 1 })}
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
                label={t("{{label}}项目 {{detail}}", { label: label, detail: i + 1 })}
                leaf
                onOpenFile={onOpenFile}
                onPickImage={onPickImage}
              />
              <Controls
                index={i}
                count={block.items.length}
                label={t("{{label}}项目 {{detail}}", { label: label, detail: i + 1 })}
                change={(action) => change({ ...block, items: reorder(block.items, i, action) })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              change({ ...block, items: [...block.items, { label: '', blocks: [paragraph()] }] })
            }
          > {t("添加项目")} </button>
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
                        label={t("{{label}}第 {{detail}} 行第 {{extra}} 列", { label: label, detail: i + 1, extra: j + 1 })}
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
            > {t("添加行")} </button>
            <button
              type="button"
              disabled={block.rows.length === 1}
              onClick={() => change({ ...block, rows: block.rows.slice(0, -1) })}
            > {t("删除末行")} </button>
            <button
              type="button"
              onClick={() =>
                change({ ...block, rows: block.rows.map((row) => [...row, { blocks: [] }]) })
              }
            > {t("添加列")} </button>
            <button
              type="button"
              disabled={block.rows[0].length === 1}
              onClick={() => change({ ...block, rows: block.rows.map((row) => row.slice(0, -1)) })}
            > {t("删除末列")} </button>
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
  allowTeacherNotes = true,
  onOpenFile,
  onPickImage
}) {
  const { t } = useTranslation("workbench");
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
        setError(t("图片未能保存，请重试。"));
        return;
      }
    }
    setError('');
    change([...blocks, block]);
  }
  const counts = {};
  const available = Object.entries(kinds)
    .filter(([type]) => allowTeacherNotes || type !== 'teacher-note')
    .filter(([type]) => legacy ? ['paragraph', 'math'].includes(type) : !leaf || ['paragraph', 'math', 'image'].includes(type));
  const primary = available.filter(([type]) => ['paragraph', 'math', 'image'].includes(type));
  const secondary = available.filter(([type]) => !['paragraph', 'math', 'image'].includes(type));
  return (
    <div className="material-block-list">
      {blocks.map((block, i) => {
        counts[block.type] = (counts[block.type] ?? 0) + 1;
        const blockLabel = `${label} ${t(kinds[block.type])} ${counts[block.type]}`;
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
        {primary.map(([type, text]) => (
            <button
              type="button"
              className="wb-button"
              key={type}
              disabled={type === 'image' && !onPickImage}
              onClick={() => append(type)}
            >
              {t(text)}
            </button>
          ))}
        {secondary.length > 0 && <Popover label={t("更多内容")} icon={null} buttonClassName="wb-button" align="start">
          {({ close }) => secondary.map(([type, text]) => <MenuItem key={type} onClick={() => { append(type); close(); }}>{t(text)}</MenuItem>)}
        </Popover>}
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
  allowTeacherNotes = true,
  label = t("文稿")
}) {
  const { t } = useTranslation("workbench");
  const source = value ?? document;
  if (value === undefined && source?.version === 2)
    return (
      <div data-document-editor={label}>
        <p className="wb-field-error" data-region="unsupported-version"> {t("这段内容来自更新的文档版本 2，在这里只读保留，不会被改写。")} </p>
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
        allowTeacherNotes={allowTeacherNotes}
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
