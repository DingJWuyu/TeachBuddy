import fs from 'node:fs';
import path from 'node:path';
export const C='/home/liam_t/项目/TeacherWorkspace-r34-protection-fix';
export const E=path.resolve(import.meta.dirname,'..');
export const {chromium,expect}=await import(C+'/node_modules/@playwright/test/index.mjs');
export const browser=await chromium.connectOverCDP('http://127.0.0.1:50636');
export const context=browser.contexts()[0];
export const page=context.pages().find(p=>p.url().includes('50635'))??await context.newPage();
page.setDefaultTimeout(12000);
await page.setViewportSize({width:1440,height:900});
export const origin='https://127.0.0.1:50635';
let header;
page.on('request',r=>{if(r.headers()['x-teachbuddy-page'])header=r.headers()['x-teachbuddy-page'];});
page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')&&!u.pathname.startsWith('/api/auth/'))fs.appendFileSync(E+'/network.ndjson',JSON.stringify({at:new Date().toISOString(),method:r.request().method(),path:u.pathname,status:r.status()})+'\n');});
export const save=(name,value)=>fs.writeFileSync(E+'/'+name+'.json',JSON.stringify(value,null,2));
export const shot=async(name)=>{await page.screenshot({path:E+'/'+name+'.png',animations:'disabled'});};
export const nav=async(name)=>page.locator('.wb-sidebar').getByRole('link',{name,exact:true}).click();
export async function ready(){await page.reload();await expect(page.locator('.wb-shell')).toBeVisible();}
export async function api(url,method='GET',input){const result=await page.evaluate(async({url,method,input,header})=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-TeachBuddy-Request':'1','X-TeachBuddy-Page':header,'Idempotency-Key':crypto.randomUUID()},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,value:await r.json()};},{url,method,input,header});fs.appendFileSync(E+'/http.ndjson',JSON.stringify({url,method,input,...result})+'\n');return result;}
export async function register(email='protection6@example.test'){
 await page.goto(origin); await page.getByRole('button',{name:'创建账户',exact:true}).click();
 await page.getByLabel('昵称',{exact:true}).fill('本地验收五');await page.getByLabel('邮箱',{exact:true}).fill(email);await page.getByLabel('密码',{exact:true}).fill('Local5-review-only');await page.getByLabel('确认密码',{exact:true}).fill('Local5-review-only');await page.getByRole('button',{name:'发送验证码',exact:true}).click();
 await expect.poll(()=>{try{const m=JSON.parse(fs.readFileSync('/home/liam_t/r34p6/data/mail.json'));return m.email===email?m.verificationCode:null}catch{return null}}).toBeTruthy();
 const mail=JSON.parse(fs.readFileSync('/home/liam_t/r34p6/data/mail.json'));await page.getByLabel('邮箱验证码').fill(mail.verificationCode);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.locator('.wb-shell')).toBeVisible();
}
export const doc=(text)=>({version:2,blocks:[{type:'paragraph',runs:[{type:'text',text}]}]});
export const empty=()=>({version:2,blocks:[]});
export async function bytes(id){const data=await page.evaluate(async({id,header})=>{const r=await fetch('/api/workbench/files/'+id+'/content',{headers:{'X-TeachBuddy-Page':header}});if(!r.ok)throw Error('File HTTP '+r.status);return Array.from(new Uint8Array(await r.arrayBuffer()));},{id,header});return Buffer.from(data);}

export async function uploadFile(bytes) {return page.evaluate(async({bytes,header})=>{const form=new FormData();form.append('file',new Blob([new Uint8Array(bytes)],{type:'image/png'}),'保护回归.png');const r=await fetch('/api/workbench/files',{method:'POST',headers:{'X-TeachBuddy-Request':'1','X-TeachBuddy-Page':header,'Idempotency-Key':crypto.randomUUID()},body:form});return {status:r.status,body:await r.json()};},{bytes,header});}
