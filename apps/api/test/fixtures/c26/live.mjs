// Explicit runner: never imported by normal tests. Credentials remain in memory.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createIntegration } from './harness.js';
import { manualQuestionSample, lessonSample, sectionInput } from '../../first-flow-harness.js';
const model = process.argv[2];
if (!['deepseek/deepseek-v4.1-flash','z-ai/glm-5.3-flash'].includes(model)) throw Error('Specify an authorized exact model');
const settings = parseEnv(fs.readFileSync('/home/liam_t/项目/TeacherWorkspace-mvp/.env','utf8'));
if (!settings.COMMANDCODE_API_KEY || settings.COMMANDCODE_BASE_URL !== 'https://api.commandcode.ai/provider/v1') throw Error('Authorized configuration unavailable');
const tag = model.startsWith('deepseek') ? 'deepseek' : 'glm';
const directory = path.resolve(`test-results/c26-live-${tag}-${Date.now()}`);fs.mkdirSync(directory,{recursive:true});
const evidence = path.resolve(process.env.AGENT_EVIDENCE_DIR ?? 'test-results/evidence/C26/v1', `live-${tag}.json`);
fs.mkdirSync(path.dirname(evidence), { recursive: true });
if (fs.existsSync(evidence)) throw Error('Existing request ledger must not be overwritten');
const world=await createIntegration({directory,agent:{apiKey:settings.COMMANDCODE_API_KEY,baseUrl:settings.COMMANDCODE_BASE_URL}});
const client=world.client();const request=(method,url,body)=>client.request(method,url,{body,headers:{'Idempotency-Key':randomUUID()}});
let conversationId,accountKey;const report={kind:'live',model,directory,startedAt:new Date().toISOString(),requests:[],status:'incomplete'};
try {
 const email=`c26-${tag}@example.test`;
 await request('POST','/api/auth/session',{action:'bootstrap'});
 const sent=await request('POST','/api/auth/registration-codes',{email});
 const registration=await request('POST','/api/auth/register',{email,nickname:'C26真实模型验证',password:'c26-live-local-password',termsAccepted:true,rememberMe:true,challengeId:sent.json.challengeId,verificationCode:world.mailer.lastCode('registration',email)});
 assert.equal(registration.status,201);accountKey=registration.json.account.accountKey;
 await request('POST','/api/auth/session',{action:'activate',sessionId:registration.json.id,rememberMe:true});
 const doc=text=>({version:1,blocks:[{type:'paragraph',runs:[{type:'text',text}]}]});
 const question=(await request('POST','/api/modules/questions/items',manualQuestionSample({title:`九月数列练习-${tag}`,body:doc('已知等差数列首项为3，公差为2，求前10项和。'),solution:doc('前10项和为120。')}))).json;
 const section=sectionInput(randomUUID(),{title:'小组挑战'});
 const lesson=(await request('POST','/api/modules/lessons/items',lessonSample({title:`数列探索-${tag}`,sections:[sectionInput(randomUUID(),{title:'课堂热身'}),section]}))).json;
 await request('POST','/api/modules/lessons/items',lessonSample({title:'另一堂函数课',sections:[sectionInput(randomUUID(),{title:'不要修改'})]}));
 const conversation=(await request('POST','/api/agent/conversations',{})).json;conversationId=conversation.conversation.id;
 const endpoint='/api/agent/conversations/'+conversationId;
 const text=`找到标题“九月数列练习-${tag}”的题目，保留原题，复制改编为首项5、公差3、求前8项和的新题，并给出正确答案。副本标题用“数列进阶-${tag}”。再把副本加入备课“数列探索-${tag}”的“小组挑战”环节。保留其他内容不变。请实际执行保存。`;
 await request('PUT',endpoint+'/draft',{baseVersion:1,text,references:[]});
 const accepted=await request('POST',endpoint+'/turns',{draftVersion:2,modelId:model});assert.equal(accepted.status,202,accepted.text);
 report.conversationId=conversationId; report.originalQuestion=question;report.originalLesson=lesson;
 const until=Date.now()+195000;
 while(Date.now()<until) {
  const snapshot=(await client.request('GET',endpoint)).json;
  const internal=world.workbench.agent.store.read(accountKey,conversationId);
  report.snapshot=snapshot;report.requests=internal.requests[accepted.json.turn.id]??[];
  fs.writeFileSync(evidence,JSON.stringify(report,null,2)+'\n');
  if(snapshot.turns[0].state!=='running') break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 report.questions=(await client.request('GET','/api/modules/questions/items')).json;
 report.lesson=(await client.request('GET','/api/modules/lessons/items/'+lesson.id)).json;
 report.status=report.snapshot.turns[0].state;
 console.log(JSON.stringify({model,status:report.status,usage:report.snapshot.turns[0].usage,calls:report.snapshot.toolCalls.map(c=>({name:c.name,state:c.state,problem:c.problem})),directory,evidence}));
} finally {
 if(accountKey&&conversationId) {const doc=world.workbench.agent.store.read(accountKey,conversationId);report.requests=doc.requests;report.snapshot=doc.snapshot;report.nativeToolResults=doc.entries.filter(e=>e.message?.role==='toolResult');}
 fs.writeFileSync(evidence,JSON.stringify(report,null,2)+'\n');await world.close();
}
