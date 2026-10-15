import { useTranslation } from 'react-i18next';
import { DocumentView } from '../../components/materials/index.js';
import { QuestionDocumentEditor } from './QuestionControls.jsx';

export function NoteFragments({ fragments = [], editing = false, onChange, onRemove, onPickImage, resetKey }) {
  const { t } = useTranslation('questions');
  return <div className="q-note-fragments">
    {fragments.map((fragment, index) => <section key={fragment.id}>
      {editing ? <QuestionDocumentEditor resetKey={resetKey} label={t('笔记片段 {{number}}', { number: index + 1 })} value={fragment.document} onPickImage={onPickImage}
        onChange={document => onChange(fragments.map(item => item.id === fragment.id ? { ...item, document } : item))} /> : <DocumentView value={fragment.document} />}
      {editing && <button className="q-text-button" onClick={() => onRemove(fragment.id)}>{t('移除笔记片段 {{number}}', { number: index + 1 })}</button>}
    </section>)}
  </div>;
}
