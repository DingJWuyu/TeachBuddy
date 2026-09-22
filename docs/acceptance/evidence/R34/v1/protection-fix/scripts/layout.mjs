import {page,browser,ready,api,expect,save,shot,doc} from './common.mjs';
const phase=process.argv[2]??'red';
try {
 await ready();await page.setViewportSize({width:1280,height:800});
 const input={title:'本地五取材现场',intro:doc('独立取材正文'),sections:Array.from({length:6},(_,i)=>({id:crypto.randomUUID(),title:'现场环节'+(i+1),content:doc(('第'+(i+1)+'环节保留文稿，讨论与练习。\n').repeat(12)),references:[]})),materials:[]};
 const created=await api('/api/modules/lessons/v3','POST',input);expect(created.status).toBe(201);const id=created.value.id;
 await page.goto('https://127.0.0.1:50635/lessons/'+id);await expect(page.getByLabel('课题',{exact:true})).toHaveValue(input.title);
 if(!(await page.getByLabel('AI 输入').isVisible()))await page.getByRole('button',{name:'AI 助理',exact:true}).first().click();
 await page.getByLabel('AI 输入').fill('取材往返保留，勿发送');
 await api('/api/modules/lessons/v3/'+id,'PUT',{...input,title:'另一个窗口的课题',baseVersion:created.value.version});
 await page.getByLabel('课题',{exact:true}).fill('本地五取材现场草稿');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByText('当前备课草稿保留在这里。采用服务器版本会丢弃本地输入，请先对照。',{exact:true})).toBeVisible();
 const rows=[];
 for(const [width,height] of [[1280,800],[1440,900],[1024,768],[768,1024]]) {
  await page.setViewportSize({width,height});await shot(phase+'-conflict-'+width);
  rows.push(await page.locator('.wb-object-head').evaluate((el)=>({viewport:innerWidth,text:el.innerText,header:el.getBoundingClientRect().toJSON(),title:el.querySelector('input').getBoundingClientRect().toJSON(),value:el.querySelector('input').value,scrollWidth:document.documentElement.scrollWidth,buttons:[...el.querySelectorAll('button')].map(b=>({text:b.innerText,rect:b.getBoundingClientRect().toJSON()}))})));
 }
 save(phase+'-layout',{id,rows,aiDraft:await page.getByLabel('AI 输入').inputValue()});
 // Compare available title space with this actual title's rendered text, not a product pixel threshold.
 await page.setViewportSize({width:1280,height:800});
 expect(rows.find(row=>row.viewport===1280).title.width).toBeGreaterThan(await page.getByLabel('课题',{exact:true}).evaluate(el=>{const s=getComputedStyle(el),c=document.createElement('canvas').getContext('2d');c.font=s.font;return c.measureText(el.value).width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight);}));
}finally{await browser.close();}
