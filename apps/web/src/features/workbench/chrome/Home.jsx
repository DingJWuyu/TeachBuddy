import { useAgent } from '../../agent/AgentProvider.jsx';
import { AiWorkspace } from '../AuxiliaryPanel.jsx';
import { Icon } from './icons.jsx';
import { navigate } from '../routes.js';
export default function Home() {
 const agent=useAgent(); const empty=!agent.snapshot?.messages?.length;
 return <div className={`restored-home${empty?' is-new':''}`}>
  <div className="restored-home-label"><Icon name="sparkles" size={16}/>教学助理</div>
  <button className="wb-button restored-return" onClick={()=>navigate('/lessons')}>‹ 返回工作</button>
  {empty && <div className="restored-welcome"><div className="restored-mark"><Icon name="sparkles" size={30}/></div><h1>今天，想从哪里开始？</h1><p>从一道好题、一个想法，开始准备下一节课。</p></div>}
  <AiWorkspace variant="home" />
  {empty && !agent.draft && <button className="restored-start" onClick={agent.create} disabled={agent.busy}>聊聊备课思路，或带上一道题……<span>教学助理 <b>↑</b></span></button>}
  {empty && <div className="restored-suggestions">{['梳理一节课的讲解顺序','讨论一道题的不同讲法','构思一个数学演示'].map(text=><button className="wb-button" key={text} onClick={async()=>{if(!agent.draft) await agent.create(); agent.edit({text});}}>{text}</button>)}</div>}
 </div>;
}
