import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuxiliaryTools, useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { workbenchGet } from '../workbench/apiClient.js';
import { SourceRecordsPanel } from '../classes/index.jsx';

export function MathTools({ children, sceneKey = 'current' }) {
  const shell = useWorkbenchShell();
  const [scene, patch] = useScene(shell.accountKey, `math-tools:${sceneKey}`, { top: 0, listTop: 0, expanded: {} });
  const [host, setHost] = useState(null);
  const restored = useRef(null);
  useAuxiliaryTools([{ id: 'math-tools', label: '作品与工具', render: () => <div className="math-tools-panel wb-module" ref={setHost}
    onScrollCapture={event => {
      if (event.target === event.currentTarget) patch({ top: event.target.scrollTop });
      else if (event.target.tagName === 'NAV') patch({ listTop: event.target.scrollTop });
    }} onToggleCapture={event => {
      if (event.target.tagName !== 'DETAILS') return;
      const title = event.target.querySelector(':scope > summary')?.textContent;
      if (title) patch(current => ({ expanded: { ...current.expanded, [title]: event.target.open } }));
    }} /> }]);
  useLayoutEffect(() => {
    if (!host || restored.current?.host === host && restored.current?.key === sceneKey) return;
    for (const details of host.querySelectorAll('details')) {
      const title = details.querySelector(':scope > summary')?.textContent;
      if (Object.hasOwn(scene.expanded, title)) details.open = scene.expanded[title];
    }
    host.scrollTop = scene.top;
    const list = host.querySelector('nav'); if (list) list.scrollTop = scene.listTop;
    restored.current = { host, key: sceneKey };
  }, [host, children, sceneKey]);
  return host ? createPortal(children, host) : null;
}
export function MathIntegration({ work, saved, busy, onError, client }) {
  const shell=useWorkbenchShell();
  const [scene,patch]=useScene(shell.accountKey,'math-return',{});
  const [usages,setUsages]=useState([]),[error,setError]=useState(null),[reload,setReload]=useState(0);
  useEffect(()=>{
    let live=true;setUsages([]);setError(null);
    if(work?.id) workbenchGet(`/api/modules/lessons/v3/usages?kind=math&id=${work.id}`).then(({body})=>{if(live)setUsages(body.items);}).catch(e=>{if(live)setError(e.problem?.message||'无法读取使用位置');});
    return()=>{live=false;};
  },[work?.id,work?.version,reload]);
  async function bringBack() {
    try {
      const current=await client.json(`/api/modules/math/v1/works/${work.id}/reference`);
      if(current.deletedAt || current.version!==work.version || work.render.state==='invalid') throw new Error('作品状态已变化，请重新读取并确认');
      patch({result:{id:work.id,version:work.version,snapshot:current.snapshot},inserted:false});
      shell.navigate(`/lessons/${scene.target.lessonId}`);
    } catch(e) {onError(e);}
  }
  const fromPath=window.history.state?.fromPath;
  return <div className="math-integration">
    {fromPath?.startsWith("/classes/") && <button className="wb-button" onClick={()=>shell.navigate(fromPath)}>返回教学记录</button>}
    {scene.target && <div className="wb-material-return">
      <span>来自：{scene.target.label}</span>
      {scene.target.replaceId && <span>请另存作品后替换本处</span>}
      <button className="wb-button" disabled={!saved||busy||!work?.id||work.deletedAt||work.render?.state==='invalid'||scene.target.replaceWorkId===work.id} onClick={bringBack}>带回备课</button>
      <button className="wb-button" onClick={()=>{const id=scene.target.lessonId;patch({target:null,result:null,inserted:false});shell.navigate(`/lessons/${id}`);}}>取消返回</button>
    </div>}
    {work?.id && <details><summary>使用位置与教学反馈</summary>
      {error && <p role="alert">{error}<button onClick={()=>setReload(n=>n+1)}>重试使用位置</button></p>}
      {usages.map(u=><button className="wb-text-button" key={u.referenceId} onClick={()=>shell.openQuestionUsage(u.lessonId,u.referenceId,`/math?workId=${work.id}`)}>{u.lessonTitle} · {u.sectionTitle||'本课材料'} · 版本 {u.adoptedVersion}</button>)}
      <SourceRecordsPanel kind="math" id={work.id}/>
    </details>}
  </div>;
}
