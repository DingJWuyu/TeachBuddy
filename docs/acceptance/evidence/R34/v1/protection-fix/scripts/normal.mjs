import {page,browser,ready,api,nav,doc,empty,expect,save,shot} from './common.mjs';
try {
 await ready();await page.setViewportSize({width:1280,height:800});
 const title='正常题目-'+Date.now();
 const created=await api('/api/modules/questions/v2/items','POST',{title,body:doc('正常题干'),solution:empty(),answerStatus:'absent',note:'',starred:false,typeId:null,tagIds:[],source:{kind:'manual'}});expect(created.status).toBe(201);
 await nav('题库');if(await page.getByRole('button',{name:'返回题库',exact:true}).isVisible())await page.getByRole('button',{name:'返回题库',exact:true}).click();await page.getByLabel('搜索题目').fill(title);await page.locator('.q-list').getByRole('button',{name:title+' 正常题干',exact:true}).click();
 await page.getByLabel('题目标题',{exact:true}).fill(title+'已修改');await page.getByLabel('长期笔记',{exact:true}).fill('正常笔记');await page.getByRole('button',{name:'保存题目',exact:true}).click();await expect(page.getByText('题目已保存',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'删除题目',exact:true}).click();await expect(page.getByRole('button',{name:'恢复题目',exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复题目',exact:true}).click();await expect(page.getByRole('button',{name:'删除题目',exact:true})).toBeVisible();
 const q=(await api('/api/modules/questions/v2/items/'+created.value.id)).value;expect(q.note).toBe('正常笔记');expect(q.deletedAt).toBe(null);await shot('normal-question');
 await page.getByRole('button',{name:'复制改编',exact:true}).click();await expect(page.getByLabel('长期笔记',{exact:true})).toHaveValue('');
 const input={title:'正常备课',intro:doc('正常开头'),sections:[],materials:[]};const lesson=await api('/api/modules/lessons/v3','POST',input);expect(lesson.status).toBe(201);
 await page.goto('https://127.0.0.1:50635/lessons/'+lesson.value.id);await page.getByLabel('课题',{exact:true}).fill('正常课题已修改');await page.getByLabel('开头文稿段落 1',{exact:true}).fill('正常文稿已修改');await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.locator('.wb-save-status')).toHaveText('已保存');
 await page.reload();await expect(page.getByLabel('课题',{exact:true})).toHaveValue('正常课题已修改');await expect(page.getByLabel('开头文稿段落 1',{exact:true})).toHaveValue('正常文稿已修改');
 await page.getByRole('button',{name:'更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'删除备课',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'删除备课',exact:true}).click();await expect(page.locator('[data-region="lesson-deleted"]')).toBeVisible();
 await page.getByRole('button',{name:'更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'恢复备课',exact:true}).click();await expect(page.locator('[data-region="lesson-deleted"]')).toHaveCount(0);
 const l=(await api('/api/modules/lessons/v3/'+lesson.value.id)).value;expect(l.deletedAt).toBe(null);expect(l.intro).toEqual(doc('正常文稿已修改'));await shot('normal-lesson');save('normal-results',{status:'PASS',question:q,lesson:l,copyNoteEmpty:true});
} finally {await browser.close();}
