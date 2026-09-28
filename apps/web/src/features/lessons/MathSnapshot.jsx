import { useTranslation } from 'react-i18next';

import { useEffect, useState } from 'react';
import { workbenchBlob } from '../workbench/apiClient.js';
import { DocumentView } from '../workbench/materials/index.js';
import { openLessonFile } from './files.js';
export function MathSnapshot({ snapshot }) {
  const { t } = useTranslation('lessons');
  const [url,setUrl]=useState(null),[error,setError]=useState(false);
  useEffect(()=>{
    let live=true,objectUrl;
    setUrl(null);setError(false);
    if(snapshot?.posterFileId) workbenchBlob(`/api/workbench/files/${snapshot.posterFileId}/content`).then(blob=>{
      objectUrl=URL.createObjectURL(blob);if(live)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl);
    }).catch(()=>{if(live)setError(true);});
    return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[snapshot?.posterFileId]);
  if(!snapshot)return null;
  return <div className="lesson-math-snapshot">
    {snapshot.source.kind==='formula' ? <DocumentView value={{version:2,blocks:[{type:'math',latex:snapshot.source.latex}]}}/> : url ? <img src={url} alt={snapshot.title} style={{maxWidth:'100%',maxHeight:260,objectFit:'contain'}}/> : error ? <p role="alert">{t("固定预览暂不可用，请重新打开")}</p> : null}
    {snapshot.presentationFileId && <button className="wb-text-button" onClick={()=>openLessonFile(snapshot.presentationFileId)}>{t("下载采用版本演示")}</button>}
    {snapshot.source.kind==='html' && <p className="wb-muted">{t("交互演示见单独文件")}</p>}
  </div>;
}
