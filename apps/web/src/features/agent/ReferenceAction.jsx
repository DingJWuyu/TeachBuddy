import { useEffect, useState } from 'react';
import { useAgent } from './AgentProvider.jsx';
import { workbenchGet } from '../workbench/apiClient.js';
import { Popover } from '../workbench/overlays.jsx';
export function ReferenceAction({ route, onAdded }) {
  const agent = useAgent(); const [lesson, setLesson] = useState(null);
  useEffect(() => {
    let live = true; setLesson(null);
    if (route.name === 'lesson') workbenchGet(`/api/modules/lessons/v3/${route.id}`).then(r => { if (live) setLesson(r.body); }).catch(() => {});
    return () => { live = false; };
  }, [route.id, route.name]);
  if (!['question','lesson'].includes(route.name) || !/^[a-f0-9-]{36}$/i.test(route.id)) return null;
  const add = sectionId => { void agent.addReference(route.name, route.id, sectionId); onAdded(); };
  if (route.name === 'question') return <button className="wb-button" title="引用已保存版本；未保存的编辑请先保存" onClick={() => add()}>加入对话</button>;
  return <Popover label="加入对话" icon={null} buttonClassName="wb-button">{({ close }) => <><button className="wb-menu-item" onClick={() => { add(); close(); }}>整份备课（已保存版本）</button>{lesson?.sections.map(section => <button className="wb-menu-item" key={section.id} onClick={() => { add(section.id); close(); }}>{section.title}</button>)}</>}</Popover>;
}
