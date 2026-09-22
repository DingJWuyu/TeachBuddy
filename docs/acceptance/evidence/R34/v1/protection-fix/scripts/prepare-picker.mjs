import fs from 'node:fs';
import {C,page,browser,ready,api,expect,uploadFile} from './common.mjs';
try {
 await ready();
 const bytes=Array.from(fs.readFileSync(C+'/apps/web/e2e/fixtures/materials-questions/figure.png'));
 const file=await uploadFile(bytes);
 expect(file.status).toBe(201);
 const result=await api('/api/modules/resources/items','POST',{title:'现场-pdf-00',fileId:file.body.id,note:'',folderId:null,tagIds:[]});expect(result.status).toBe(201);
}finally{await browser.close();}
