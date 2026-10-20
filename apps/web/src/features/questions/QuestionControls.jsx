import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: "questions", ...options });
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons.jsx';
import { DocumentEditor, DocumentView } from '../../components/materials/index.js';
import { parseInlineRuns, serializeInlineRuns } from '../../components/materials/documents.js';
import { Menu as Popover } from '../../components/ui/menu.jsx';
import { structureChanged, undoStructure } from './document-structure.js';
import { supportedDocument } from '@teachbuddy/shared';
import { useModuleDialogFocus } from '../../components/interaction/ModuleMotion.jsx';

const paths = {
  undo: 'M6 4 2 8l4 4M2 8h9a5 5 0 0 1 0 10',
  book: 'M10 5C7 3 4 3 2 4v12c3-1 5-1 8 1 3-2 5-2 8-1V4c-2-1-5-1-8 1Zm0 0v12',
  upload: 'M10 13V3M6 7l4-4 4 4M3 12v5h14v-5',
  edit: 'm4 12 9-9 4 4-9 9-5 1 1-5Zm7-7 4 4',
  filter: 'M3 5h14M6 10h8M8 15h4',
  tag: 'M3 3h7l7 7-7 7-7-7V3Zm4 4h.01',
  image: 'M3 3h14v14H3V3Zm0 10 4-4 4 4 3-3 3 3M13 6h.01',
  file: 'M4 2h8l4 4v12H4V2Zm8 0v5h4M7 11h6M7 14h4',
  text: 'M4 4h12M10 4v12M7 16h6',
  download: 'M10 3v10m-4-4 4 4 4-4M3 13v4h14v-4',
};

export function QuestionIcon({ name, size = 18 }) {
  useTranslation("questions");
  if (!paths[name]) return <Icon name={name} size={size} />;
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function QuestionDialog({ title, children, onClose, className = '' }) {
  const { t } = useTranslation("questions");
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  useEffect(() => {
    ref.current?.querySelector('input:not([type="file"]), textarea')?.focus();
  }, []);
  return <div className="q-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} className={`q-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button className="q-icon-button" aria-label={t("关闭")} title={t("关闭")} onClick={onClose}><QuestionIcon name="close" /></button></header>
      {children}
    </section>
  </div>;
}

function QuestionParagraph({ block, onChange, label }) {
  const { t } = useTranslation("questions");
  const [text, setText] = useState(() => serializeInlineRuns(block.runs));
  const lastSent = useRef(block);
  // Keep native selection/input against the same block as the committed DOM.
  // A passive effect can otherwise replace the value between select-all and typing.
  useLayoutEffect(() => {
    if (JSON.stringify(lastSent.current) !== JSON.stringify(block)) {
      setText(serializeInlineRuns(block.runs));
      lastSent.current = block;
    }
  }, [block]);
  return <div>
    <textarea aria-label={label} placeholder={t("直接输入或粘贴内容…")} value={text} onChange={event => {
      const input = event.target.value;
      const next = { ...block, runs: parseInlineRuns(input) };
      lastSent.current = next;
      setText(input);
      onChange(next);
    }} />
    {block.runs.some(run => run.type === 'math') && <div className="q-formula-preview"><DocumentView value={{ version: 2, blocks: [block] }} /></div>}
  </div>;
}

export function QuestionDocumentEditor({ value, onChange, label = t("题干"), onPickImage, readOnly = false, autoFocus = false, resetKey }) {
  const { t } = useTranslation("questions");
  const ref = useRef(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  useEffect(() => setHistory([]), [resetKey]);
  useEffect(() => { if (autoFocus) ref.current?.querySelector('textarea')?.focus(); }, []);
  const blocks = value.blocks?.length ? value.blocks : [{ type: 'paragraph', runs: [] }];
  const update = (blocks, recordStructure = true) => {
    const next = { ...value, version: value.version === 2 || blocks.some(block => !['paragraph', 'math'].includes(block.type)) ? 2 : 1, blocks };
    if (recordStructure && structureChanged(value, next)) setHistory(current => [...current, { before: value, after: next }]);
    onChange(next);
  };
  const undo = () => {
    const operation = history.at(-1);
    if (!operation) return;
    onChange(undoStructure(operation.before, operation.after, value));
    setHistory(current => current.slice(0, -1));
  };
  async function insert(type) {
    let block;
    if (type === 'paragraph') block = { type, runs: [] };
    if (type === 'math') block = { type, latex: '' };
    if (type === 'heading') block = { type, level: 1, runs: [] };
    if (type === 'list') block = { type, role: 'plain', items: [{ label: '', blocks: [{ type: 'paragraph', runs: [] }] }] };
    if (type === 'table') block = { type, rows: [[{ blocks: [] }, { blocks: [] }]] };
    if (type === 'image') {
      try {
        const file = await onPickImage();
        if (!file) return;
        block = { type, fileId: file.id, alt: '', widthMm: 100 };
      } catch { setError(t("图片未能保存，请重试。")); return; }
    }
    setError('');
    update([...value.blocks, block]);
  }
  return <section ref={ref} className="q-document-field" aria-label={label}>
    <div className="q-document-heading"><h3>{label}</h3>
      {!readOnly && supportedDocument(value) && history.length > 0 && <button type="button" className="q-text-button" aria-label={t("撤销{{label}}结构操作", { label })} onClick={undo}><QuestionIcon name="undo" size={15} />{t("撤销结构操作")}</button>}
    </div>
    {readOnly || !supportedDocument(value) ? <DocumentView value={value} /> : <div className="q-composer">
      {blocks.map((block, index) => <div className="q-compose-block" key={index}>
        {block.type === 'paragraph' ? <QuestionParagraph block={block} label={t("{{label}}段落 {{detail}}", { label: label, detail: index + 1 })} onChange={next => update(blocks.map((item, i) => i === index ? next : item), false)} /> : <div className="q-structured-block"><DocumentEditor label={label} value={{ ...value, blocks: [block] }} allowTeacherNotes={false} onPickImage={onPickImage} onChange={next => update(blocks.flatMap((item, i) => i === index ? next.blocks : [item]))} /></div>}
        <div className="q-block-controls">
          {blocks.length > 1 && <><button type="button" className="q-move-up" aria-label={t("上移{{label}}第 {{detail}} 段", { label: label, detail: index + 1 })} title={t("上移")} disabled={!index} onClick={() => { const next = [...blocks]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update(next); }}><QuestionIcon name="back" size={14} /></button><button type="button" className="q-move-down" aria-label={t("下移{{label}}第 {{detail}} 段", { label: label, detail: index + 1 })} title={t("下移")} disabled={index === blocks.length - 1} onClick={() => { const next = [...blocks]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; update(next); }}><QuestionIcon name="back" size={14} /></button></>}
          {value.blocks.length > 0 && <button type="button" aria-label={t("删除{{label}}第 {{detail}} 段", { label: label, detail: index + 1 })} title={t("删除此段")} onClick={() => update(blocks.filter((_, i) => i !== index))}><QuestionIcon name="close" size={14} /></button>}
        </div>
      </div>)}
      <div className="q-insert-tools"><button type="button" onClick={() => insert('math')}><QuestionIcon name="math" size={16} />{t("插入公式")}</button><button type="button" onClick={() => insert('image')} disabled={!onPickImage}><QuestionIcon name="image" size={16} />{t("插入图片")}</button>
        <Popover label={t("插入更多内容")} icon={null} buttonClassName="q-text-button" align="start">{({ close }) => <>{[['paragraph', t("添加段落")], ['heading', t("添加小标题")], ['list', t("添加选项或列表")], ['table', t("添加表格")]].map(([kind, text]) => <button key={kind} role="menuitem" type="button" onClick={() => { insert(kind); close(); }}>{text}</button>)}</>}</Popover>
      </div>
      {error && <p className="q-error" role="alert">{error}</p>}
    </div>}
  </section>;
}
