import fs from 'node:fs';
import {C,E,page,browser,ready,api,expect,save} from './common.mjs';
const {default:Database}=await import(C+'/node_modules/better-sqlite3/lib/index.js');
const db=new Database('/home/liam_t/r34p6/data/workspace.sqlite',{readonly:true});
try {
 await ready();const results=[];
 for(const record of JSON.parse(fs.readFileSync(E+'/green-future.json'))) {
  const table=record.kind==='question'?'question_items':'lesson_items';
  const stored=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(record.id);
  expect(stored).toEqual(record.before);
  const route=record.kind==='question'?'/api/modules/questions/v2/items/':'/api/modules/lessons/v3/';
  const result=await api(route+record.id);expect(result.status).toBe(200);
  expect(result.value[record.kind==='question'?'body':'intro']).toEqual(record.future);
  results.push({kind:record.kind,id:record.id,rowUnchanged:true,document:record.future});
 }
 save('restart-results',{status:'PASS',results});
}finally{db.close();await browser.close();}
