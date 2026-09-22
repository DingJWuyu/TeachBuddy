import fs from 'node:fs';
import {chromium} from '/home/liam_t/项目/TeacherWorkspace-m43/node_modules/@playwright/test/index.mjs';
import {createIntegration} from '/home/liam_t/项目/TeacherWorkspace-m43/apps/api/test/fixtures/auth-integration/harness.js';
const world=await createIntegration();const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome'});const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
const out='/home/liam_t/项目/TeacherWorkspace-m43/docs/acceptance/evidence/M43/v1';
try{
 await page.goto(world.origin);await page.getByRole('button',{name:'创建账户'}).click();
 await page.getByLabel('昵称',{exact:true}).fill('接口观察');await page.getByLabel('邮箱',{exact:true}).fill('m43-observation@example.test');
 await page.getByLabel('密码',{exact:true}).fill('m43-observation-pass');await page.getByLabel('确认密码',{exact:true}).fill('m43-observation-pass');
 const sent=page.waitForResponse(r=>r.url().endsWith('/api/auth/registration-codes'));await page.getByRole('button',{name:'发送验证码'}).click();await sent;
 await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration','m43-observation@example.test'));await page.getByRole('checkbox').check();await page.getByRole('button',{name:'注册',exact:true}).click();
 await page.locator('.wb-sidebar').getByRole('link',{name:'题库',exact:true}).click();await page.getByRole('button',{name:'收录',exact:true}).click();
 await page.getByLabel('原始文字').fill('1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$');await page.getByRole('button',{name:'保存原稿并整理'}).click();
 await page.getByLabel('草稿标题').fill('真实材料题目');for(const select of await page.locator('.q-issue select').all())await select.selectOption('corrected');
 await page.getByRole('button',{name:'保存校对',exact:true}).click();await page.getByText('校对已保存',{exact:true}).waitFor();
 await page.getByRole('button',{name:'确认收录',exact:true}).click();await page.getByRole('button',{name:'查看已入库题目'}).click();
 await page.locator('.wb-sidebar').getByRole('link',{name:'班级教学',exact:true}).click();await page.getByRole('button',{name:'新建班级',exact:true}).click();await page.getByLabel('班级名称',{exact:true}).fill('观察班');await page.getByRole('button',{name:'创建',exact:true}).click();
 await page.getByLabel('写一句').fill('尝试关联真实题目');await page.getByRole('button',{name:'补充',exact:true}).click();await page.getByRole('button',{name:'关联资料',exact:true}).click();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/modules/questions/items');await page.getByRole('tab',{name:'题目',exact:true}).click();const r=await response;
 const body=await r.json();await page.screenshot({path:out+'/browser/question-link-open.png'});
 fs.writeFileSync(out+'/question-link-open.json',JSON.stringify({status:'OPEN',identity:'real-auth',directory:world.directory,endpoint:new URL(r.url()).pathname,httpStatus:r.status(),body,scope:'T51 question link consumes frozen legacy port, not M43 math reference'},null,2));
}finally{await browser.close();await world.close();}
