async function clickReal(page, selector) {
 await waitFor(page, `document.readyState === 'complete'`);
 await evaluate(page, `new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 const point = await evaluate(page, `(() => {const n=document.querySelector(${JSON.stringify(selector)}); n.scrollIntoView({block:'center'}); const r=n.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; if(!n.contains(document.elementFromPoint(x,y))) throw Error('occluded '+n.outerHTML+' '+JSON.stringify({x,y,hit:document.elementFromPoint(x,y)?.outerHTML})); return {x,y};})()`);
 for(const type of ['mousePressed','mouseReleased']) await page.cdp.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1},page.sessionId);
}
async function typeReal(page,selector,text) {
 await clickReal(page,selector);
 await page.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65},page.sessionId);
 await page.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65},page.sessionId);
 await page.cdp.send('Input.insertText',{text},page.sessionId);
}
async function stop(browser) {
 const ended=new Promise(resolve=>browser.child.once('exit',resolve));
 await browser.cdp.send('Browser.close'); browser.cdp.close(); await ended;
}
const proof={};
let browser=await launchChrome({profile:join(profileRoot,'independent-real-input'),label:'real-input'});
try {
 let page=await openPageSession(browser.cdp,appUrl);
 await waitFor(page,`document.querySelector('#dynamic-save')`);
 await clickReal(page,'[data-tab="dynamic"]');
 for(const [selector,value] of [['#dynamic-a-min','-2.5'],['#dynamic-a-max','2.5'],['#dynamic-a-step-size','0.5'],['#dynamic-step-title-2',STEP_TITLE_2]]) await typeReal(page,selector,value);
 await clickReal(page,'#dynamic-save');
 await waitFor(page,`document.querySelector('#dynamic-status').textContent.includes('已保存')`);
 await evaluate(page,SETUP);
 proof.before=await evaluate(page,`window.__c23.dynamicSnapshot()`);
 await stop(browser);
 browser=await launchChrome({profile:join(profileRoot,'independent-real-input'),label:'restart'});
 page=await openPageSession(browser.cdp,appUrl);
 await waitFor(page,`document.querySelector('#dynamic-save')`);
 await clickReal(page,'[data-tab="dynamic"]');
 await evaluate(page,SETUP);
 proof.after=await evaluate(page,`window.__c23.dynamicSnapshot()`);
 const r=proof.after.rangeInputs[0];
 if(r.min!=='-2.5'||r.max!=='2.5'||r.step!=='0.5'||proof.after.stepTitles[1]!==STEP_TITLE_2) throw Error('restart mismatch');
 await screenshot(page,'independent-real-input-restart.png');
 for(const kind of ['quadratic','piecewise']) {
  await browser.cdp.send('Page.navigate',{url:`file://${join(downloadDir,`M-F-${kind}.svg`)}`},page.sessionId);
  await waitFor(page,`document.querySelector('svg text')`);
  const note=await evaluate(page,`[...document.querySelectorAll('svg > text')].map(n=>n.textContent).join('')`);
  if(note!==(kind==='quadratic'?NOTE_QUADRATIC:NOTE_PIECEWISE)) throw Error('full SVG note mismatch '+note);
  proof[kind]={note};
  await screenshot(page,`independent-${kind}-svg.png`);
 }
 proof.browser=browser.version.Browser; proof.status='PASS'; proof.finished_at_utc=new Date().toISOString();
 await writeFile(join(outRoot,'supplement.json'),JSON.stringify(proof,null,2)+'\n');
 console.log('PASS: real pointer/text input, full browser restart, full SVG notes');
} finally { await stop(browser); }
