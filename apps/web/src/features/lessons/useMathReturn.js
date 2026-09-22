import { useEffect, useRef, useState } from 'react';
import { useScene } from '../workbench/useScene.js';
import { addReferences, removeReference, targetLabel, targetReferences } from './model.js';
import { getLesson } from './api.js';

/** Lessons owns the return intent, original draft and the second save. */
export function useMathReturn({ shell, savable, id }) {
  const [scene, patch] = useScene(shell.accountKey, 'math-return', {});
  const [problem, setProblem] = useState(null);
  const consumed = useRef(false);
  async function enter(target, replacement = null) {
    if (savable.pending) { setProblem('先确认上一次保存结果'); return; }
    let saved = savable.baseline;
    if (!saved?.id) saved = await savable.save();
    if (!saved) return;
    patch({ target: { lessonId: saved.id, sectionId: target.sectionId ?? null, baseVersion: saved.version,
      referenceId: crypto.randomUUID(), label: `${savable.input.title} · ${targetLabel(savable.input, target)}`,
      note: replacement?.note ?? "", replaceWorkId: replacement?.workId ?? null, replaceId: replacement?.id ?? null }, result: null });
    shell.navigate(replacement ? `/math?workId=${replacement.workId}` : '/math');
  }
  async function apply(target = scene.target) {
    if (!target || !scene.result || savable.pending) return;
    setProblem(null);
    try {
      const server = await getLesson(id);
      if (server.deletedAt) {setProblem('目标备课已删除，请恢复或重新选择备课');return;}
      if (server.version !== savable.baseline.version || savable.status === 'conflict') {savable.compareServer(server);setProblem('备课有更新，请先对照并处理版本冲突，再确认带回');return;}
      if (target.sectionId && (!server.sections.some(s=>s.id===target.sectionId) || !savable.input.sections.some(s=>s.id===target.sectionId))) {
        setProblem('目标环节已删除，请明确选择本课材料或取消带回'); return;
      }
      const placement = target.sectionId ? {type:'section',sectionId:target.sectionId} : {type:'materials'};
      const existing = targetReferences(savable.input,placement);
      if(target.replaceId && !existing.some(r=>r.id===target.replaceId)) {setProblem('原引用已移除，请选择本课材料或取消带回');return;}
      const same = existing.find(r=>r.kind==='math' && r.workId===scene.result.id);
      let input = savable.input;
      if (target.replaceId) input = removeReference(input,target.replaceId);
      if (!same || target.replaceId) input=addReferences(input,placement,[{id:target.referenceId,kind:'math',workId:scene.result.id,workVersion:scene.result.version,note:target.note??'',snapshot:scene.result.snapshot,sourceState:'active',latestVersion:scene.result.version}]);
      // Persist the reference ID before starting the request. A reload or unknown
      // result confirms this save, never creates a second reference.
      patch({target, inserted:true});
      const result=await savable.save({input});
      if(result) patch({target:null,result:null,inserted:false});
    } catch(error) {setProblem(error.problem?.message ?? '暂时无法带回，作品和原稿已保留');}
  }
  useEffect(()=>{
    if (!scene.result || scene.target?.lessonId!==id || !savable.baseline || !savable.input || consumed.current) return;
    consumed.current=true;
    if (!scene.inserted) apply();
  },[savable.baseline,scene.result,id]);
  useEffect(()=>{
    if(scene.inserted && scene.target?.lessonId===id && ['saved','clean'].includes(savable.status)) patch({target:null,result:null,inserted:false});
  },[savable.status]);
  return { enter, problem, pending:scene.result && scene.target?.lessonId===id,
    retry:()=>apply(), toMaterials:()=>apply({...scene.target,sectionId:null,replaceId:null}),
    cancel:()=>{patch({target:null,result:null,inserted:false});setProblem(null);} };
}
