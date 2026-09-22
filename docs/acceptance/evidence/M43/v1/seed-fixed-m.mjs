import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {startMathFixture} from './apps/web/e2e/fixtures/math-static/server.mjs';
const dataDir=process.env.M43_M_LIBRARY ?? '/tmp/m43-original-m-library';
if(fs.existsSync(dataDir+'/workbench.sqlite'))throw new Error('Use a new isolated library directory');
const f=await startMathFixture({dataDir,port:49943});
const rows=[];
try {
 const examples=JSON.parse(fs.readFileSync(new URL('./docs/contracts/workbench/math/samples.json',import.meta.url)));
 for(const id of ['create-formula','create-plane','create-dynamic']) {
  const input=examples.find(e=>e.id===id).value;const key=randomUUID();
  const r=await fetch(f.origin+'/api/modules/math/v1/works',{method:'POST',headers:{'Content-Type':'application/json',Cookie:f.workbench.identity.testPrincipalCookie('m41-a').header.split(';')[0],Origin:f.origin,'X-TeachBuddy-Request':'1','Idempotency-Key':key,Connection:'close'},body:JSON.stringify(input)});
  const body=await r.json();if(r.status!==201)throw new Error(JSON.stringify(body));rows.push({input,key,body});
 }
 fs.writeFileSync('/tmp/m43-original-m-library/seed.json',JSON.stringify(rows,null,2));
} finally {await f.close();}
