import { useTranslation } from 'react-i18next';

export function isCompletedImport(material) {
  return material.jobState === 'succeeded'
    && !material.drafts.some(draft => draft.disposition === 'pending')
    && !material.fragments.some(fragment => fragment.disposition === 'unassigned');
}

export function ImportList({ imports, archived, selectedId, onOpen }) {
  const { t } = useTranslation('questions');
  const groups = archived ? [[t('归档材料'), imports, true]] : [
    [t('继续收录'), imports.filter(material => !isCompletedImport(material)), true],
    [t('已完成材料'), imports.filter(isCompletedImport), false],
  ];
  return groups.map(([label, materials, expanded]) => materials.length > 0 && (
    <details className="q-imports" key={label} open={expanded || undefined}>
      <summary>{label} · {materials.length} {t('份材料')}</summary>
      {materials.map(material => <button key={material.id}
        className={selectedId === material.id ? 'selected' : ''} onClick={() => onOpen(material.id)}>
        <strong>{material.title}</strong>
        <small>{material.drafts.filter(draft => draft.disposition === 'confirmed').length} {t('已入库 ·')} {' '}
          {material.drafts.filter(draft => draft.disposition === 'pending').length} {t('待校对')}</small>
      </button>)}
    </details>
  ));
}
