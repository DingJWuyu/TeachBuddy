import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createIntegration } from './fixtures/c26/harness.js';
import { provider } from './fixtures/c26/provider.js';
import { valid } from '../src/agent/schema.js';
async function register(world, email='agent@example.test') {
 const c=world.client(); await c.request('POST','/api/auth/session',{body:{action:'bootstrap'}});
 const sent=await c.request('POST','/api/auth/registration-codes',{body:{email}});
 const pending=await c.request('POST','/api/auth/register',{body:{email,nickname:'Agent老师',password:'password-c26',termsAccepted:true,rememberMe:true,challengeId:sent.json.challengeId,verificationCode:world.mailer.lastCode('registration',email)}});
 assert.equal(pending.status,201,pending.text);
 await c.request('POST','/api/auth/session',{body:{action:'activate',sessionId:pending.json.id,rememberMe:true}}); c.sessionId=pending.json.id; return c;
}
const write=(c,method,path,body,key=randomUUID())=>c.request(method,path,{body,headers:{'Idempotency-Key':key}});
async function start(c,text='查找题目') {
 const created=await write(c,'POST','/api/agent/conversations',{}); assert.equal(created.status,201,created.text);
 const path='/api/agent/conversations/'+created.json.conversation.id;
 const draft=await write(c,'PUT',path+'/draft',{baseVersion:1,text,references:[]});assert.equal(draft.status,200,draft.text);
 const sent=await write(c,'POST',path+'/turns',{draftVersion:2,modelId:'deepseek/deepseek-v4.1-flash'}); assert.equal(sent.status,202,sent.text);
 return path;
}
async function finished(c,path) {
 const until=Date.now()+10000;
 while(Date.now()<until) { const r=await c.request('GET',path); if(r.json.turns[0]?.state!=='running') return r.json; await new Promise(r=>setTimeout(r,20)); }
 throw Error('Turn did not finish');
}
test('WB-AG-019/020: 真实SDK只读404无assistant仍保存卡片，另一账户404',async()=>{
 const p=await provider([[{type:'toolCall',id:'read-missing',name:'wb_get_question',arguments:{id:randomUUID()}}]]);
 const w=await createIntegration({agent:p.config});
 try {
  const c=await register(w); const path=await start(c); const result=await finished(c,path);
  assert.equal(result.turns[0].reason,'tool-rejected',JSON.stringify(result));
  assert.equal(result.toolCalls[0].state,'rejected');assert.equal(result.toolCalls[0].problem.type,'/problems/workbench/not-found');
  assert.equal(result.messages.length,1);assert.equal(result.operations.length,0);assert.equal(p.requests(),1);
  assert.equal(valid('Snapshot',result),true);
  const b=await register(w,'other@example.test');assert.equal((await b.request('GET',path)).status,404);
  assert.deepEqual((await c.request('GET',path)).json,result);
 }finally{await w.close();}
});
test('WB-AG-019: 空读取结果和SDK成功标志、实际usage',async()=>{
 const p=await provider([[{type:'toolCall',id:'list-empty',name:'wb_list_questions',arguments:{}}],[{type:'text',text:'未找到题目。'}]]);
 const w=await createIntegration({agent:p.config});
 try {const c=await register(w);const path=await start(c);const s=await finished(c,path);assert.equal(s.turns[0].state,'completed',JSON.stringify(s));assert.equal(s.toolCalls[0].state,'read');assert.deepEqual(s.toolCalls[0].result.items,[]);assert.equal(s.turns[0].usage.totalTokens,30);assert.equal(p.requests(),2);assert.equal(valid('Snapshot',s),true);}finally{await w.close();}
});

import { manualQuestionSample, variantCopySample } from './first-flow-harness.js';
import { createAgentStore } from '../src/agent/store.js';
import { createAgent } from '../src/agent/index.js';

test('WB-AG-023: 重复写调用关联同一operation，业务只写一次', async()=>{
 const input=manualQuestionSample({title:'唯一副本测试'});
 const p=await provider([[{type:'toolCall',id:'create-one',name:'wb_create_question',arguments:{body:input}}],[{type:'toolCall',id:'create-again',name:'wb_create_question',arguments:{body:input}}],[{type:'text',text:'已保存'}]]);
 const w=await createIntegration({agent:p.config});
 try { const c=await register(w);const path=await start(c,'创建一道题');const s=await finished(c,path);
  assert.equal(s.turns[0].state,'completed',JSON.stringify(s)); assert.equal(s.operations.length,1); assert.equal(s.toolCalls.length,2);
  assert.equal(s.toolCalls[0].operationId,s.toolCalls[1].operationId); assert.equal(s.toolCalls[1].state,'confirmed');
  assert.equal((await c.request('GET','/api/modules/questions/items')).json.items.length,1);assert.equal(valid('Snapshot',s),true);
  const key=(await c.request('GET','/api/workbench/context')).json.accountKey;
  const native=w.workbench.agent.store.read(key,s.conversation.id).entries.filter(e=>e.message?.role==='toolResult');
  assert.equal(native.length,2);for(const e of native){assert.equal(e.message.isError,false);assert.equal(valid('ToolOutcome',e.message.details),true);}
 }finally{await w.close();}
});

test('WB-AG-005/010/016: 草稿冲突、发送同键重放、白名单和缺配置不产生请求',async()=>{
 let release;const wait=new Promise(r=>release=r);
 const p=await provider([async()=>{await wait;return [{type:'text',text:'结束'}];}]); const w=await createIntegration({agent:p.config});
 try {const c=await register(w);const created=await write(c,'POST','/api/agent/conversations',{});const path='/api/agent/conversations/'+created.json.conversation.id;
 const input={baseVersion:1,text:'第一条',references:[]};const key=randomUUID();
 const first=await write(c,'PUT',path+'/draft',input,key);assert.equal(first.status,200);
 assert.deepEqual((await write(c,'PUT',path+'/draft',input,key)).json,first.json);
 assert.equal((await write(c,'PUT',path+'/draft',{...input,text:'另一设备'})).json.type,'/problems/agent/draft-conflict');
 assert.equal((await write(c,'POST',path+'/turns',{draftVersion:2,modelId:'unknown-model'})).status,422);assert.equal(p.requests(),0);
 const sendKey=randomUUID();const body={draftVersion:2,modelId:'deepseek/deepseek-v4.1-flash'};
 const sent=await write(c,'POST',path+'/turns',body,sendKey);assert.equal(sent.status,202);
 await write(c,'PUT',path+'/draft',{baseVersion:3,text:'下一条',references:[]});
 assert.deepEqual((await write(c,'POST',path+'/turns',body,sendKey)).json,sent.json);
 assert.equal((await c.request('GET',path)).json.draft.text,'下一条');
 assert.equal((await write(c,'POST',path+'/turns',{...body,draftVersion:4})).json.type,'/problems/agent/turn-active');
 release();const s=await finished(c,path);assert.equal(s.messages.filter(m=>m.role==='user').length,1);assert.equal(p.requests(),1);
 }finally{release();await w.close();}
});

test('WB-AG-006: 发送前核验版本与软删除，历史引用冻结',async()=>{
 const p=await provider([[{type:'text',text:'已读取引用'}]]);const w=await createIntegration({agent:p.config});
 try {const c=await register(w);const q=(await write(c,'POST','/api/modules/questions/items',manualQuestionSample())).json;
 const created=await write(c,'POST','/api/agent/conversations',{});const path='/api/agent/conversations/'+created.json.conversation.id;
 await write(c,'PUT',path+'/draft',{baseVersion:1,text:'阅读引用',references:[{kind:'question',id:q.id,version:1}]});
 await write(c,'POST',`/api/modules/questions/items/${q.id}/deletion`,{baseVersion:1,deleted:true});
 const refused=await write(c,'POST',path+'/turns',{draftVersion:2,modelId:'deepseek/deepseek-v4.1-flash'});assert.equal(refused.json.type,'/problems/agent/reference-conflict');assert.equal(p.requests(),0);
 await write(c,'POST',`/api/modules/questions/items/${q.id}/deletion`,{baseVersion:2,deleted:false});
 await write(c,'PUT',path+'/draft',{baseVersion:2,text:'阅读引用',references:[{kind:'question',id:q.id,version:3}]});
 assert.equal((await write(c,'POST',path+'/turns',{draftVersion:3,modelId:'deepseek/deepseek-v4.1-flash'})).status,202);
 const s=await finished(c,path);assert.equal(s.messages[0].references[0].snapshot.version,3);assert.equal(valid('Snapshot',s),true);
 }finally{await w.close();}
});

test('WB-AG-012/023: 业务提交后journal失败，原题更新后核实仍是原键原体',async()=>{
 let source;
 const p=await provider([()=>[{type:'toolCall',id:'copy-lost-response',name:'wb_copy_question',arguments:{id:source.id,body:variantCopySample(1)}}]]);
 const w=await createIntegration({agent:p.config});
 try {
  const c=await register(w); source=(await write(c,'POST','/api/modules/questions/items',manualQuestionSample())).json;
  w.workbench.db.exec(`CREATE TRIGGER c26_lose_confirmation BEFORE UPDATE ON agent_conversations WHEN NEW.document LIKE '%"state":"confirmed"%' BEGIN SELECT RAISE(ABORT,'injected journal failure'); END;`);
  const path=await start(c,'复制这道题');const s=await finished(c,path);
  assert.equal(s.operations[0].state,'unconfirmed',JSON.stringify(s));assert.equal(s.toolCalls[0].state,'unconfirmed');
  w.workbench.db.exec('DROP TRIGGER c26_lose_confirmation');
  const edit={...manualQuestionSample(),baseVersion:1,title:'老师已修改原题'};delete edit.source;
  assert.equal((await write(c,'PUT','/api/modules/questions/items/'+source.id,edit)).status,200);
  const result=await write(c,'POST',path+'/operations/'+s.operations[0].id+'/reconcile',{});
  assert.equal(result.status,200,result.text);assert.equal(result.json.state,'confirmed');assert.equal(result.json.result.source.questionVersion,1);
  const after=(await c.request('GET',path)).json;assert.equal(after.toolCalls[0].state,'confirmed');assert.equal(valid('Snapshot',after),true);
  assert.equal((await c.request('GET','/api/modules/questions/items/'+source.id+'/copies')).json.items.length,1);assert.equal(p.requests(),1);
  const read=(await c.request('GET','/api/modules/questions/items/'+source.id)).json;assert.equal(read.title,'老师已修改原题');assert.equal(read.version,2);
 }finally{await w.close();}
});

test('WB-AG-021: 读取异常映射安全失败，同批后续工具取消',async()=>{
 const p=await provider([[{type:'toolCall',id:'read-fault',name:'wb_list_questions',arguments:{}},{type:'toolCall',id:'never-start',name:'wb_create_question',arguments:{body:manualQuestionSample()}}]]);
 const w=await createIntegration({agent:p.config});
 try {const c=await register(w);
 const prepare=w.workbench.db.prepare.bind(w.workbench.db);
 // SQLite fault at the public storage boundary, not a synthetic tool success.
 w.workbench.db.prepare=sql=>{if(sql.includes('FROM question_items')&&sql.includes('accountKey')) throw Error('private storage detail');return prepare(sql);};
 // Repositories prepare statements at startup; use a temporary read denial by renaming the backing table.
 w.workbench.db.prepare=prepare;w.workbench.db.exec('ALTER TABLE question_items RENAME TO c26_unavailable_questions');
 const path=await start(c);const s=await finished(c,path);
 assert.equal(s.toolCalls[0].state,'failed',JSON.stringify(s));assert.equal(s.turns[0].reason,'tool-failed');assert.equal(s.toolCalls[1].state,'cancelled');assert.equal(s.operations[0].state,'cancelled');
 assert.equal(JSON.stringify(s).includes('no such table'),false);assert.equal(p.requests(),1);assert.equal(valid('Snapshot',s),true);
 w.workbench.db.exec('ALTER TABLE c26_unavailable_questions RENAME TO question_items');
 }finally{await w.close();}
});

test('WB-AG-013/017: 停止后无新请求，用量不完整，保留已接受输入',async()=>{
 const p=await provider([async (context,options)=>{await new Promise(resolve=>options.signal.addEventListener('abort',resolve,{once:true}));throw Error('aborted');}]);
 const w=await createIntegration({agent:p.config});
 try {const c=await register(w);const path=await start(c);let snapshot;
 for(let i=0;i<100;i++){snapshot=(await c.request('GET',path)).json;if(snapshot.turns[0].usage.requestsStarted)break;await new Promise(r=>setTimeout(r,10));}
 const stop=path+'/turns/'+snapshot.turns[0].id+'/stop';assert.equal((await write(c,'POST',stop,{})).status,200);
 const s=await finished(c,path);assert.equal(s.turns[0].state,'stopped');assert.equal(s.turns[0].usage.complete,false);assert.equal(s.turns[0].usage.requestsReported,0);assert.equal(p.requests(),1);
 assert.equal((await write(c,'POST',stop,{})).json.state,'stopped');
 }finally{await w.close();}
});

test('WB-AG-022/004: 保留库重启取消prepared、中断executing读取并补同ID原生结果',async()=>{
 let w=await createIntegration();let directory;
 try {const c=await register(w);const made=await write(c,'POST','/api/agent/conversations',{});const id=made.json.conversation.id;directory=w.directory;
 const key=(await c.request('GET','/api/workbench/context')).json.accountKey;
 const turnId=randomUUID();const messageId=randomUUID();
 w.workbench.agent.store.update(key,id,(d,emit)=>{
 const turn={id:turnId,conversationId:id,userMessageId:messageId,modelId:'deepseek/deepseek-v4.1-flash',state:'running',reason:null,createdAt:new Date().toISOString(),endedAt:null,usage:{input:null,output:null,cacheRead:null,cacheWrite:null,reasoning:null,totalTokens:null,requestsStarted:0,requestsReported:0,complete:false,actualCost:null}};
 d.snapshot.turns.push(turn);emit('turn',turn);
 for(const [ordinal,state]of [[1,'prepared'],[2,'executing']]){const call={turnId,toolCallId:'restart-'+ordinal,ordinal,name:'wb_list_questions',arguments:{},operationId:null,state,result:null,problem:null};d.snapshot.toolCalls.push(call);emit('toolCall',call);}
 });
 await w.close();w=await createIntegration({directory});const next=w.client();
 await next.request('POST','/api/auth/session',{body:{action:'bootstrap'}});
 const login=await next.request('POST','/api/auth/login',{body:{email:'agent@example.test',password:'password-c26',rememberMe:true}});assert.equal(login.status,200,login.text);
 await next.request('POST','/api/auth/session',{body:{action:'activate',sessionId:login.json.id,rememberMe:true}});
 const result=(await next.request('GET','/api/agent/conversations/'+id)).json;
 assert.equal(result.turns[0].state,'interrupted');assert.deepEqual(result.toolCalls.map(c=>c.state),['cancelled','interrupted']);
 const native=w.workbench.agent.store.read(key,id).entries.filter(e=>e.message?.role==='toolResult');assert.equal(native.length,2);assert.ok(native.every(e=>e.message.isError));
 assert.deepEqual((await next.request('GET','/api/agent/conversations/'+id)).json,result);
 }finally{await w.close();}
});

test('WB-AG-023: 无效完整参数只生成拒绝卡，没有非法journal',async()=>{
 const p=await provider([[{type:'toolCall',id:'invalid',name:'wb_create_question',arguments:{principal:'forged-account',body:{}}}]]);const w=await createIntegration({agent:p.config});
 try{const c=await register(w);const path=await start(c);const s=await finished(c,path);assert.equal(s.toolCalls[0].arguments,null);assert.equal(s.toolCalls[0].state,'rejected');assert.equal(s.operations.length,0);assert.equal(p.requests(),1);assert.equal(valid('Snapshot',s),true);}finally{await w.close();}
});

test('WB-AG-008: 工具布尔标记筛选与手工HTTP字面true保持一致',async()=>{
 const p=await provider([[{type:'toolCall',id:'starred',name:'wb_list_questions',arguments:{query:{starred:true}}}],[{type:'text',text:'找到标记题'}]]);const w=await createIntegration({agent:p.config});
 try {const c=await register(w);await write(c,'POST','/api/modules/questions/items',manualQuestionSample({title:'已标记',starred:true}));await write(c,'POST','/api/modules/questions/items',manualQuestionSample({title:'未标记'}));
 const path=await start(c);const s=await finished(c,path);const manual=(await c.request('GET','/api/modules/questions/items?starred=true')).json;
 assert.deepEqual(s.toolCalls[0].result,manual);assert.equal(s.toolCalls[0].result.items.length,1);
 }finally{await w.close();}
});

import https from 'node:https';
async function events(c,path,after,count) {
 return new Promise((resolve,reject)=>{
  const request=https.get(c.baseUrl+path+'/events?after='+after,{rejectUnauthorized:false,headers:{Cookie:c.jar.header(),'X-TeachBuddy-Page':c.pageId}},response=>{
   let buffer='';const result=[];
   response.on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const line=frame.split('\n').find(s=>s.startsWith('data: '));if(line)result.push(JSON.parse(line.slice(6)));}if(result.length>=count){request.destroy();resolve(result);}});
  });request.setTimeout(5000,()=>{request.destroy();reject(Error('SSE timed out'));});request.on('error',reject);
 });
}
test('WB-AG-011/020: HTTPS SSE各游标补发与snapshot一致，无额外请求',async()=>{
 const p=await provider([[{type:'toolCall',id:'event-read',name:'wb_get_question',arguments:{id:randomUUID()}}]]);const w=await createIntegration({agent:p.config});
 try {const c=await register(w);const path=await start(c);const s=await finished(c,path);
 for(const after of [0,1,Math.floor(s.lastEventSeq/2),s.lastEventSeq-1]){
  const result=await events(c,path,after,s.lastEventSeq-after);assert.equal(result[0].seq,after+1);assert.equal(result.at(-1).seq,s.lastEventSeq);
  for(let i=1;i<result.length;i++)assert.equal(result[i].seq,result[i-1].seq+1);
  const card=result.filter(e=>e.type==='toolCall').at(-1);if(card)assert.deepEqual(card.value,s.toolCalls[0]);
 }
 assert.equal((await c.request('GET',path+'/events?after='+(s.lastEventSeq+1))).json.type,'/problems/agent/cursor-ahead');assert.equal(p.requests(),1);
 }finally{await w.close();}
});

test('WB-AG-015: provider返回前撤销真实身份，后续工具取消且不写业务',async()=>{
 let c;const p=await provider([async()=>{assert.equal((await c.request('POST','/api/auth/logout',{body:{sessionId:c.sessionId}})).status,204);return [{type:'toolCall',id:'revoked-write',name:'wb_create_question',arguments:{body:manualQuestionSample()}}];}]);const w=await createIntegration({agent:p.config});
 try {c=await register(w);const path=await start(c);
 const until=Date.now()+5000;let s;
 while(Date.now()<until){const list=w.workbench.agent.store.accounts().flatMap(a=>w.workbench.agent.store.list(a));s=list[0].snapshot;if(s.turns[0].state!=='running')break;await new Promise(r=>setTimeout(r,20));}
 assert.equal(s.turns[0].reason,'auth-invalid',JSON.stringify(s));assert.equal(s.toolCalls[0].state,'cancelled');assert.equal(p.requests(),1);assert.equal((await c.request('GET',path)).status,401);
 }finally{await w.close();}
});

test('WB-AG-018: 12次provider上限停止，无自动重置窗口',async()=>{
 const p=await provider(Array.from({length:12},(_,i)=>[{type:'toolCall',id:'bounded-'+i,name:'wb_list_questions',arguments:{}}]));const w=await createIntegration({agent:p.config});
 try {const c=await register(w);const path=await start(c);const s=await finished(c,path);assert.equal(s.turns[0].reason,'run-limit');assert.equal(p.requests(),12);assert.equal(s.turns[0].usage.requestsStarted,12);assert.equal(s.toolCalls.length,12);}finally{await w.close();}
});

test('WB-AG-009/014: 复制已保存而备课版本冲突，保留副本和真实失败结果',async()=>{
 let c,question,lesson;
 const p=await provider([
 ()=>[{type:'toolCall',id:'partial-copy',name:'wb_copy_question',arguments:{id:question.id,body:variantCopySample(1)}}],
 async context=>{
  const copy=context.messages.find(m=>m.role==='toolResult'&&m.toolCallId==='partial-copy').details.result;
  const edit={title:'老师已改备课',intro:{version:1,blocks:[]},sections:[],materials:[],baseVersion:1};
  assert.equal((await write(c,'PUT','/api/modules/lessons/items/'+lesson.id,edit)).status,200);
  return [{type:'toolCall',id:'partial-lesson',name:'wb_update_lesson',arguments:{id:lesson.id,body:{...edit,title:lesson.title,materials:[{id:randomUUID(),questionId:copy.id,questionVersion:1,note:''}]}}}];
 }]);
 const w=await createIntegration({agent:p.config});
 try {c=await register(w);question=(await write(c,'POST','/api/modules/questions/items',manualQuestionSample())).json;
 lesson=(await write(c,'POST','/api/modules/lessons/items',{title:'原备课',intro:{version:1,blocks:[]},sections:[],materials:[]})).json;
 const path=await start(c,'复制并加入备课');const s=await finished(c,path);assert.equal(s.turns[0].reason,'tool-rejected');assert.deepEqual(s.operations.map(o=>o.state),['confirmed','rejected']);
 assert.equal((await c.request('GET','/api/modules/questions/items/'+question.id+'/copies')).json.items.length,1);assert.equal((await c.request('GET','/api/modules/lessons/items/'+lesson.id)).json.title,'老师已改备课');
 const key=(await c.request('GET','/api/workbench/context')).json.accountKey;const results=w.workbench.agent.store.read(key,s.conversation.id).entries.filter(e=>e.message?.role==='toolResult');assert.deepEqual(results.map(e=>e.message.isError),[false,true]);assert.equal(p.requests(),2);
 }finally{await w.close();}
});

test('WB-AG-018/021: 业务响应不匹配契约为只读failed，损坏entries保留原记录',async()=>{
 let question;const p=await provider([()=>[{type:'toolCall',id:'invalid-response',name:'wb_get_question',arguments:{id:question.id}}]]);const w=await createIntegration({agent:p.config});
 try {const c=await register(w);question=(await write(c,'POST','/api/modules/questions/items',manualQuestionSample())).json;
 w.workbench.db.prepare('UPDATE question_items SET title=? WHERE id=?').run('x'.repeat(201),question.id);
 const path=await start(c);const s=await finished(c,path);assert.equal(s.toolCalls[0].state,'failed');assert.equal(s.operations.length,0);assert.equal(s.turns[0].reason,'tool-failed');
 const key=(await c.request('GET','/api/workbench/context')).json.accountKey;w.workbench.agent.store.update(key,s.conversation.id,d=>{d.entries=[{type:'unknown-format',data:'retain-me'}];});
 await write(c,'PUT',path+'/draft',{baseVersion:s.draft.version,text:'继续',references:[]});
 await write(c,'POST',path+'/turns',{draftVersion:s.draft.version+1,modelId:'deepseek/deepseek-v4.1-flash'});
 for(let i=0;i<100;i++){const latest=(await c.request('GET',path)).json;if(latest.turns.at(-1).state!=='running'){assert.equal(latest.turns.at(-1).reason,'model-unavailable');break;}await new Promise(r=>setTimeout(r,10));}
 assert.equal(p.requests(),1);assert.deepEqual(w.workbench.agent.store.read(key,s.conversation.id).entries,[{type:'unknown-format',data:'retain-me'}]);
 }finally{await w.close();}
});

import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { spawn } from 'node:child_process';
test('WB-AG-012: 真实进程SIGKILL的三个写检查点，同库重启原键核实',async()=>{
 for(const checkpoint of ['prepared','committed','result']){
  const directory=fs.mkdtempSync(nodePath.join(os.tmpdir(),'c26-crash-'));
  const child=spawn(process.execPath,['apps/api/test/fixtures/c26/crash.mjs',directory,checkpoint],{stdio:'pipe',cwd:repoRoot});
  let diagnostics='';child.stderr.on('data',chunk=>diagnostics+=chunk);
  const outcome=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
  assert.equal(outcome.signal,'SIGKILL',diagnostics);
  const saved=JSON.parse(fs.readFileSync(nodePath.join(directory,'checkpoint.json'),'utf8'));
  const p=await provider([]);const w=await createIntegration({directory,agent:p.config});
  try {
   const c=w.client();await c.request('POST','/api/auth/session',{body:{action:'bootstrap'}});
   const login=await c.request('POST','/api/auth/login',{body:{email:'crash@example.test',password:'password-c26',rememberMe:true}});assert.equal(login.status,200);
   await c.request('POST','/api/auth/session',{body:{action:'activate',sessionId:login.json.id,rememberMe:true}});
   const endpoint='/api/agent/conversations/'+saved.conversation.id;
   const snapshot=(await c.request('GET',endpoint)).json;assert.equal(snapshot.turns[0].state,'interrupted');assert.equal(p.requests(),0);
   const state={prepared:'cancelled',committed:'unconfirmed',result:'confirmed'}[checkpoint];assert.equal(snapshot.toolCalls[0].state,state);
   assert.equal((await write(c,'PUT','/api/modules/questions/items/'+saved.source.id,{title:'老师修改原题v2',body:saved.source.body,solution:saved.source.solution,note:saved.source.note,starred:saved.source.starred,baseVersion:1})).status,200);
   if(state==='unconfirmed'){
    const replay=await write(c,'POST',endpoint+'/operations/'+snapshot.operations[0].id+'/reconcile',{});assert.equal(replay.status,200,replay.text);assert.equal(replay.json.state,'confirmed');
   }
   const copies=(await c.request('GET','/api/modules/questions/items/'+saved.source.id+'/copies')).json.items;
   assert.equal(copies.length,checkpoint==='prepared'?0:1);
   const final=(await c.request('GET',endpoint)).json;
   if(copies.length){assert.equal(copies[0].id,final.operations[0].result.id);assert.equal(final.operations[0].result.source.questionVersion,1);}
   const native=w.workbench.agent.store.read(saved.accountKey,saved.conversation.id).entries.filter(e=>e.message?.toolCallId==='crash-copy');assert.equal(native.length,1);
   assert.equal(p.requests(),0);
  }finally{await w.close();}
 }
});

import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
test('WB-AG-004/008: 固定A11产品真实旧库升级，认证与题目记录保持',async()=>{
 const source=fs.mkdtempSync(nodePath.join(os.tmpdir(),'c26-a11-source-'));
 const archive=execFileSync('git',['archive','9ecabbf60cbbaecce2e9be8191d270068eb675cf','apps/api','packages','package.json'],{cwd:repoRoot});
 execFileSync('tar',['-x','-C',source],{input:archive});fs.symlinkSync(nodePath.join(repoRoot,'node_modules'),nodePath.join(source,'node_modules'),'dir');
 const {createApp:oldApp}=await import(pathToFileURL(nodePath.join(source,'apps/api/src/app.js')));
 let w=await createIntegration({appFactory:oldApp});const directory=w.directory;
 try {
  const c=await register(w);const q=(await write(c,'POST','/api/modules/questions/items',manualQuestionSample({title:'A11升级保留题'}))).json;
  assert.equal(w.workbench.db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='agent_conversations'").get().count,0);
  await w.close();w=await createIntegration({directory});
  const next=w.client();await next.request('POST','/api/auth/session',{body:{action:'bootstrap'}});
  const login=await next.request('POST','/api/auth/login',{body:{email:'agent@example.test',password:'password-c26',rememberMe:true}});assert.equal(login.status,200);
  await next.request('POST','/api/auth/session',{body:{action:'activate',sessionId:login.json.id,rememberMe:true}});
  assert.deepEqual((await next.request('GET','/api/modules/questions/items/'+q.id)).json,q);
  assert.equal((await write(next,'POST','/api/agent/conversations',{})).status,201);
  assert.equal(w.workbench.db.prepare("SELECT count(*) AS count FROM workbench_migrations WHERE id='agent_001_conversations'").get().count,1);
 }finally{await w.close();fs.rmSync(source,{recursive:true,force:true});}
});

test('WB-AG-008/019: 13个真实SDK工具贯通手工HTTP业务与删除恢复版本',async()=>{
 let question,lesson;
 const questionBody=manualQuestionSample();const lessonBody={title:'工具全链备课',intro:{version:1,blocks:[]},sections:[],materials:[]};
 const tool=(id,name,args)=>({type:'toolCall',id,name,arguments:args});
 const p=await provider([
  [tool('all-create-q','wb_create_question',{body:questionBody}),tool('all-create-l','wb_create_lesson',{body:lessonBody})],
  context=>{question=context.messages.find(m=>m.toolCallId==='all-create-q').details.result;lesson=context.messages.find(m=>m.toolCallId==='all-create-l').details.result;return [tool('all-get-q','wb_get_question',{id:question.id}),tool('all-get-l','wb_get_lesson',{id:lesson.id}),tool('all-list-q','wb_list_questions',{}),tool('all-list-l','wb_list_lessons',{})];},
  ()=>[tool('all-update-q','wb_update_question',{id:question.id,body:{title:'已由工具修改',body:question.body,solution:question.solution,note:question.note,starred:true,baseVersion:1}}),tool('all-update-l','wb_update_lesson',{id:lesson.id,body:{...lessonBody,title:'已由工具修改备课',baseVersion:1}})],
  ()=>[tool('all-copy','wb_copy_question',{id:question.id,body:variantCopySample(2)})],
  ()=>[tool('all-copies','wb_list_derivatives',{id:question.id}),tool('all-usages','wb_list_question_usages',{questionId:question.id})],
  ()=>[tool('all-delete-q','wb_set_question_deletion',{id:question.id,body:{baseVersion:2,deleted:true}}),tool('all-delete-l','wb_set_lesson_deletion',{id:lesson.id,body:{baseVersion:2,deleted:true}})],
  ()=>[tool('all-restore-q','wb_set_question_deletion',{id:question.id,body:{baseVersion:3,deleted:false}}),tool('all-restore-l','wb_set_lesson_deletion',{id:lesson.id,body:{baseVersion:3,deleted:false}})],
  [{type:'text',text:'完成'}]
 ]);
 const w=await createIntegration({agent:p.config});
 try{const c=await register(w);const endpoint=await start(c,'执行已明确授权的创建修改复制删除恢复');const s=await finished(c,endpoint);assert.equal(s.turns[0].state,'completed',JSON.stringify(s));assert.equal(new Set(s.toolCalls.map(t=>t.name)).size,13);assert.equal(p.requests(),8);
 assert.equal((await c.request('GET','/api/modules/questions/items/'+question.id)).json.version,4);assert.equal((await c.request('GET','/api/modules/lessons/items/'+lesson.id)).json.version,4);
 const copies=(await c.request('GET','/api/modules/questions/items/'+question.id+'/copies')).json;assert.deepEqual(s.toolCalls.find(t=>t.name==='wb_list_derivatives').result,copies);
 const key=(await c.request('GET','/api/workbench/context')).json.accountKey;const native=w.workbench.agent.store.read(key,s.conversation.id).entries.filter(e=>e.message?.role==='toolResult');assert.equal(native.length,15);assert.ok(native.every(e=>!e.message.isError));
 }finally{await w.close();}
});

test('WB-AG-016/017: SDK未知或替换模型零请求，额度错误不重试且usage不完整',async()=>{
 for(const selection of ['unknown','mismatch','quota']){
  const p=await provider([()=>{throw new Error('429 provider quota exhausted');}]);
  if(selection!=='quota'){
   const get=p.config.modelRuntime.getModel.bind(p.config.modelRuntime);
   p.config.modelRuntime.getModel=(provider,id)=>selection==='unknown'?undefined:{...get(provider,id),id:'not-allowed-model'};
  }
  const w=await createIntegration({agent:p.config});
  try {const c=await register(w);const endpoint=await start(c);const s=await finished(c,endpoint);
   assert.equal(s.turns[0].reason,selection==='quota'?'provider-quota':'model-unavailable');assert.equal(p.requests(),selection==='quota'?1:0);assert.equal(s.turns[0].usage.complete,false);assert.equal(s.turns[0].usage.actualCost,null);assert.equal(s.turns[0].usage.requestsReported,0);
  }finally{await w.close();}
 }
});

test('WB-AG-018: prepared落盘失败不能执行业务或发出未保存toolCall事件',async()=>{
 const p=await provider([[{type:'toolCall',id:'unsaved-prepared',name:'wb_create_question',arguments:{body:manualQuestionSample()}}]]);const w=await createIntegration({agent:p.config});
 try {const c=await register(w);w.workbench.db.exec("CREATE TRIGGER fail_prepared BEFORE INSERT ON agent_events WHEN json_extract(NEW.event,'$.type')='toolCall' BEGIN SELECT RAISE(FAIL,'isolated prepared failure'); END;");
 const endpoint=await start(c);const s=await finished(c,endpoint);assert.equal(s.turns[0].state,'failed');assert.equal(s.turns[0].reason,'store-unavailable');assert.equal(s.toolCalls.length,0);assert.equal(s.operations.length,0);assert.equal((await c.request('GET','/api/modules/questions/items')).json.items.length,0);assert.equal(p.requests(),1);
 }finally{await w.close();}
});

test('WB-AG-013/022: 首个写入已确认后停止，同批未开始调用取消且不回滚',async()=>{
 const p=await provider([[{type:'toolCall',id:'stop-saved',name:'wb_create_question',arguments:{body:manualQuestionSample({title:'必须保留'})}},{type:'toolCall',id:'stop-prepared',name:'wb_create_question',arguments:{body:manualQuestionSample({title:'不能创建'})}}]]);
 const w=await createIntegration({agent:p.config});let stopping=false,toolAuthorizations=0,release;const firstSaved=new Promise(resolve=>release=resolve);
 try{const c=await register(w);const authorize=w.workbench.identity.resolvePrincipal.bind(w.workbench.identity);
 const store=w.workbench.agent.store,update=store.update.bind(store);store.update=(account,id,change)=>{const value=update(account,id,change);if(store.read(account,id).snapshot.toolCalls.some(t=>t.state==='confirmed'))release();return value;};
 w.workbench.identity.resolvePrincipal=async request=>{
  const principal=await authorize(request);const snapshot=w.workbench.agent.store.list(principal.accountKey)[0]?.snapshot;
  if(!stopping&&request.originalUrl?.endsWith('/turns')&&snapshot?.toolCalls.length===2&&++toolAuthorizations===2){
   await firstSaved;stopping=true;assert.equal((await write(c,'POST',`/api/agent/conversations/${snapshot.conversation.id}/turns/${snapshot.turns[0].id}/stop`,{})).status,200);
  }
  return principal;
 };
 const endpoint=await start(c);const s=await finished(c,endpoint);assert.equal(s.turns[0].state,'stopped',JSON.stringify(s));assert.deepEqual(s.toolCalls.map(t=>t.state),['confirmed','cancelled']);assert.equal((await c.request('GET','/api/modules/questions/items')).json.items.length,1);assert.equal(p.requests(),1);
 }finally{await w.close();}
});
