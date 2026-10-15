import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';
import { useModuleDialogFocus } from '../../components/interaction/ModuleMotion.jsx';
import FormulaPreview from './FormulaPreview.jsx';
import GraphicPreview from './GraphicPreview.jsx';
import { useMathDialogKeys } from './useMathDialogKeys.js';

export default function WorkHistory({ work, client, font, hasChanges, onClose, onRestore }) {
  const { t } = useTranslation('math');
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  useMathDialogKeys(ref);
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let live = true;
    setError(''); setItems(null); setSelected(null);
    client.json(`/api/modules/math/v1/works/${work.id}/versions`).then(result => {
      if (!live) return;
      setItems(result.items);
      setSelected(result.items.find(item => item.version < work.version && !item.deletedAt) ?? result.items[0]);
    }).catch(() => { if (live) setError(t("历史版本暂时无法读取。当前作品没有改变。")); });
    return () => { live = false; };
  }, [work.id, client, attempt]);
  return <div className="wb-dialog-host wb-module-dialog math-history-host" data-overlay="dialog">
    <div className="wb-dialog-scrim" onClick={onClose} role="presentation"/>
    <div ref={ref} className="wb-dialog math-history" role="dialog" aria-modal="true" aria-label={t("历史版本")}>
      <div className="math-history-heading"><h2>{t("历史版本")}</h2><button className="math-icon-button" aria-label={t("关闭历史版本")} onClick={onClose}>×</button></div>
      <p className="math-hint">{t("选一版查看。恢复后成为当前编辑内容，保存时生成新版本。")}</p>
      {error ? <p role="alert">{error}<button onClick={() => retry(n => n + 1)}>{t("重试")}</button></p> : !items ? <p role="status">{t("正在读取历史版本…")}</p> : <>
        <label className="math-version-select">{t("保存记录")}<select aria-label={t("保存记录")} value={selected?.version ?? ''} onChange={event => setSelected(items.find(item => item.version === Number(event.target.value)))}>
          {items.map(item => <option key={item.version} value={item.version}>{t("版本")} {item.version} · {new Date(item.createdAt).toLocaleString(i18n.resolvedLanguage, { hour12: false })}{item.deletedAt ? t("· 已归档") : ''}{item.version === work.version ? t("· 当前版本") : ''}</option>)}
        </select></label>
        {selected && <><strong className="math-history-title">{selected.title}</strong>
          <div className="math-history-preview">
            {selected.source.kind === 'formula' ? <FormulaPreview source={selected.source}/>
              : selected.source.kind === 'html' ? <p>{t("HTML 历史版本不会自动运行。恢复此版本后，可查看源码并运行预览。")}</p>
              : ['geogebra', 'workshop'].includes(selected.source.kind) ? <SavedVersionPoster key={`${work.id}:${selected.version}`} version={selected} client={client}/>
              : <GraphicPreview source={selected.source} font={font}/>}
          </div>
          <div className="wb-dialog-actions"><button className="wb-button" onClick={onClose}>{t("取消")}</button>
            <button name="dialog-confirm" className="wb-button is-primary" disabled={!hasChanges && selected.version === work.version} onClick={() => onRestore(selected)}>{t("恢复此版本")}</button></div>
        </>}
      </>}
    </div>
  </div>;
}

function SavedVersionPoster({ version, client }) {
  const { t } = useTranslation('math');
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let live = true, objectUrl;
    setUrl(null); setFailed(false);
    const id = version.render?.posterFileId;
    if (!id) { setFailed(true); return; }
    client.blob(`/api/workbench/files/${id}/content`).then(blob => {
      if (!live) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [version.render?.posterFileId, client, attempt]);
  if (failed) return <p role="alert">{t('此版本预览暂时无法读取。当前作品没有改变。')} <button className="wb-button" onClick={() => retry(value => value + 1)}>{t('重试')}</button></p>;
  return url ? <img className="math-history-poster" src={url} alt={t('版本 {{version}} 预览', { version: version.version })} onError={() => setFailed(true)}/> : <p role="status">{t('正在读取版本预览…')}</p>;
}
