import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedDocument } from '@teachbuddy/shared';
import { parseInlineRuns } from '../../components/materials/documents.js';
import { DocumentView } from '../../components/materials/index.js';

function assignFragment(material, draftId, fragment, destination) {
  const target = material.drafts.find(draft => draft.id === draftId);
  if (!target || target.disposition !== 'pending' || fragment.disposition !== 'unassigned') return material;
  const document = fragment.document ?? { version: 2, blocks: [{ type: 'paragraph', runs: parseInlineRuns(fragment.text) }] };
  if (!supportedDocument(document)) return material;
  return { ...material,
    drafts: material.drafts.map(draft => {
      if (draft.id !== draftId) return draft;
      if (destination === 'note') return { ...draft, noteFragments: [...(draft.noteFragments ?? []),
        { id: fragment.id, importId: material.id, document: structuredClone(document), locations: structuredClone(fragment.locations) }] };
      return { ...draft, [destination]: { version: 2, blocks: [...draft[destination].blocks, ...structuredClone(document.blocks)] },
        ...(destination === 'solution' && draft.answerStatus === 'absent' ? { answerStatus: 'present' } : {}),
        parts: [...draft.parts, { role: destination, locations: structuredClone(fragment.locations) }] };
    }),
    fragments: material.fragments.map(item => item.id === fragment.id ? { ...item, disposition: 'assigned' } : item),
  };
}

function Fragment({ fragment, material, draft, locked, onChange }) {
  const { t } = useTranslation('questions');
  const [destination, setDestination] = useState(() => {
    if (material.drafts.some(item => item.noteFragments?.some(note => note.id === fragment.id))) return 'note';
    const part = material.drafts.flatMap(item => item.parts).find(part => part.role === 'solution' && JSON.stringify(part.locations) === JSON.stringify(fragment.locations));
    return part ? 'solution' : 'body';
  });
  const assigned = fragment.disposition === 'assigned';
  const disabled = locked || !draft || draft.disposition !== 'pending' || fragment.disposition !== 'unassigned'
    || Boolean(fragment.document && !supportedDocument(fragment.document));
  const label = { body: '归入题干', solution: '归入答案与解析', note: '归入笔记' }[destination];
  return <div className="q-unassigned-fragment">
    {fragment.document ? <DocumentView value={fragment.document} /> : <pre>{['未确定题目归属的识别疑点：这行有不一致的识别结果，请对照原稿核对。', '未确定题目归属的识别疑点：这行有较大留白，请对照原稿核对。'].includes(fragment.text) ? t(fragment.text) : fragment.text}</pre>}
    <div className="q-fragment-actions">
      <select aria-label={t('片段处理')} value={fragment.disposition} disabled={locked || assigned} onChange={event => onChange({ ...material,
        fragments: material.fragments.map(item => item.id === fragment.id ? { ...item, disposition: event.target.value } : item) })}>
        <option value="unassigned">{t('待处理')}</option><option value="assigned" disabled>{t('已归入')}</option><option value="ignored">{t('忽略')}</option>
      </select>
      <select aria-label={t('片段归入位置')} value={destination} disabled={disabled} onChange={event => setDestination(event.target.value)}>
        <option value="body">{t('题干')}</option><option value="solution">{t('答案与解析')}</option><option value="note">{t('教学笔记')}</option>
      </select>
      <button disabled={disabled} onClick={() => onChange(assignFragment(material, draft.id, fragment, destination))}>{t(label)}</button>
    </div>
  </div>;
}

export function FragmentReview({ material, draft, locked, onChange }) {
  const { t } = useTranslation('questions');
  if (!material.fragments.length) return null;
  return <details className="q-fragment-review"><summary>{t('未分配片段 ·')} {material.fragments.length}</summary>
    {material.fragments.map(fragment => <Fragment key={fragment.id} fragment={fragment} material={material} draft={draft} locked={locked} onChange={onChange} />)}
  </details>;
}
