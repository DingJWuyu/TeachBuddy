import fs from 'node:fs';
import {E,page,browser,expect,save,shot} from './common.mjs';
try {
 const {id}=JSON.parse(fs.readFileSync(E+'/picker-id.json'));
 await page.goto('https://127.0.0.1:50635/lessons/'+id);
 await page.getByRole('button',{name:'重试确认',exact:true}).click();
 await expect(page.getByText('当前备课草稿保留在这里。采用服务器版本会丢弃本地输入，请先对照。',{exact:true})).toBeVisible();
 await page.setViewportSize({width:768,height:1024});
 // At tablet width the auxiliary pane is an intentional overlay; close it via its visible control.
 await page.getByRole('button',{name:'关闭辅助栏',exact:true}).last().click();
 await expect(page.getByLabel('课题',{exact:true})).toBeVisible();await shot('tablet-conflict-main');
 const measured=await page.locator('.wb-object-head').evaluate(el=>({title:el.querySelector('input').getBoundingClientRect().toJSON(),text:el.innerText,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(measured.scrollWidth).toBe(measured.viewport);
 save('tablet-results',{status:'PASS',measured,auxiliary:'closed through ordinary button; overlay screenshot is not main-content evidence'});
}finally{await browser.close();}
