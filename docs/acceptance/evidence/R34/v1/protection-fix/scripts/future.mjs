import {C,page,browser,ready,api,nav,doc,empty,expect,save,shot} from './common.mjs';
const {default:Database}=await import(C+'/node_modules/better-sqlite3/lib/index.js');
const db=new Database('/home/liam_t/r34p6/data/workspace.sqlite');
const phase=process.argv[2]??'red'; const results=[];
try {
 await ready();
 for(const kind of ['question','lesson']) {
  const title=`未来保护-${kind}-${phase}-${Date.now()}`;
  const input=kind==='question'?{title,body:doc('原始题干'),solution:empty(),answerStatus:'absent',note:'',starred:false,typeId:null,tagIds:[],source:{kind:'manual'}}:{title,intro:doc('原始备课'),sections:[],materials:[]};
  const url=kind==='question'?'/api/modules/questions/v2/items':'/api/modules/lessons/v3';
  const created=await api(url,'POST',input);expect(created.status).toBe(201);
  const id=created.value.id, table=kind==='question'?'question_items':'lesson_items', field=kind==='question'?'body':'intro';
  const future={version:99,blocks:[{type:'future-node',payload:{text:'不得丢弃-006',unknown:[1,{a:'完整原节点'}]}}]};
  db.prepare(`UPDATE ${table} SET ${field}=? WHERE id=?`).run(JSON.stringify(future),id);
  const before=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  if(kind==='question') {await nav('题库');if(await page.getByRole('button',{name:'返回题库',exact:true}).isVisible())await page.getByRole('button',{name:'返回题库',exact:true}).click();await page.getByLabel('搜索题目').fill(title);await page.locator('.q-list').getByRole('button',{name:title,exact:true}).click();}
  else await page.goto('https://127.0.0.1:50635/lessons/'+id);
  await expect(page.getByText('文档版本 99 暂不支持，原数据只读保留。',{exact:true})).toBeVisible();
  if(kind==='lesson')await page.getByRole('button',{name:'更多操作',exact:true}).click();
  const button=page.getByRole(kind==='question'?'button':'menuitem',{name:kind==='question'?'删除题目':'删除备课',exact:true});
  const disabled=await button.isDisabled();
  if(!disabled)await button.click();
  await shot(`${phase}-future-${kind}`);
  const afterUi=(await api(url+'/'+id)).value;
  const deletion=await api(url+'/'+id+'/deletion','POST',{baseVersion:afterUi.version,deleted:true});
  let current=(await api(url+'/'+id)).value;
  if(current.deletedAt) {await api(url+'/'+id+'/deletion','POST',{baseVersion:current.version,deleted:false});current=(await api(url+'/'+id)).value;}
  const {source,...fields}=input;
  const overwrite=await api(url+'/'+id,'PUT',{...fields,baseVersion:current.version});
  const after=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  results.push({kind,id,future,disabled,afterUi,deletion,overwrite,before,after,preserved:JSON.stringify(before)===JSON.stringify(after)});
 }
 save(phase+'-future',results);
 for(const result of results){expect(result.preserved).toBe(true);expect(result.deletion.status).toBe(422);expect(result.overwrite.status).toBe(422);expect(result.disabled).toBe(true);}
}finally{db.close();await browser.close();}
