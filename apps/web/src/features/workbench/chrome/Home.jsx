import { useEffect, useRef } from 'react';
import { useAgent } from '../../agent/AgentProvider.jsx';
import { AiWorkspace } from '../AuxiliaryPanel.jsx';
import { Icon } from './icons.jsx';
import { navigate } from '../routes.js';
export default function Home({ returnPath }) {
 const agent=useAgent(); const empty=!agent.snapshot?.messages?.length;
 const focusComposer = useRef(false);
 const pendingPrompt = useRef(null);
 useEffect(()=>{
  if (!agent.draft) return;
  if (pendingPrompt.current !== null) { agent.edit({text:pendingPrompt.current}); pendingPrompt.current=null; }
  if (focusComposer.current) { document.querySelector('.restored-home .wb-ai-input')?.focus(); focusComposer.current=false; }
 },[Boolean(agent.draft)]);
 return <div className={`restored-home${empty?' is-new':''}${agent.list.some(item => item.id !== agent.id) ? ' has-history' : ''}`}><div className="restored-home-frame">
  <div className="restored-home-top"><span><Icon name="sparkles" size={16}/>教学助理</span>
  {returnPath && <button className="wb-button restored-return" onClick={()=>navigate(returnPath)}><Icon name="arrowLeft" size={14}/>返回工作</button>}</div>
  {empty && <div className="restored-welcome"><div className="restored-mark"><Icon name="sparkles" size={30}/></div><h1>今天，想从哪里开始？</h1><p>从一道好题、一个想法，开始准备下一节课。</p></div>}
  <div className="restored-composer-area">
  <AiWorkspace variant="home" />
  {empty && !agent.draft && <button className="restored-start" onClick={()=>{focusComposer.current=true; void agent.create();}} disabled={agent.busy}><span className="restored-placeholder">聊聊备课思路，或带上一道题……</span><span className="restored-composer-bottom"><span>教学助理</span><span className="restored-send" aria-hidden="true"><Icon name="arrowUp" size={18}/></span></span></button>}
  {empty && <div className="restored-suggestions">{['梳理一节课的讲解顺序','讨论一道题的不同讲法','构思一个数学演示'].map(text=><button className="wb-button" key={text} disabled={agent.busy} onClick={()=>{
   if (agent.draft) { agent.edit({text}); document.querySelector('.restored-home .wb-ai-input')?.focus(); }
   else { pendingPrompt.current=text; focusComposer.current=true; void agent.create(); }
  }}>{text}</button>)}</div>}
  </div>
 </div></div>;
}
