import {page,register,shot,browser} from './common.mjs';
try {await page.setViewportSize({width:1440,height:900});await register();await shot('registered');} finally {await browser.close();}
