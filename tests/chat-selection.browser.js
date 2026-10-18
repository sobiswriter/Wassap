// Fresh-context mobile touch and desktop mouse/keyboard regression.
async (page) => {
 const browser=page.context().browser();const check=(v,m)=>{if(!v)throw Error(m);};const results=[];
 for(const mobile of [true,false]){
  const context=await browser.newContext({viewport:{width:mobile?390:1440,height:844},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});const p=await context.newPage();p.setDefaultTimeout(5000);await p.goto('http://127.0.0.1:3013');
  const row=(name)=>p.getByRole('button',{name:`Open chat with ${name}`,exact:true});await row('Mom').waitFor();await p.waitForFunction(()=>localStorage.getItem('whatsapp_chats'));
  const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).find(c=>c.name==='Mom').messages);
  const cdp=mobile?await context.newCDPSession(p):null;
  const hold=async(name)=>{const r=await row(name).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;if(mobile){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});}else{await p.mouse.move(x,y);await p.mouse.down();}await p.getByRole('toolbar',{name:'Selected chats'}).waitFor();if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();};
  await hold('Mom');check(await row('Mom').getAttribute('aria-pressed')==='true','Hold did not select');check(await p.getByRole('heading',{name:'Mom',level:2,exact:true}).count()===0,'Hold opened chat');
  await row('Sis').click();check(await row('Sis').getAttribute('aria-pressed')==='true','Multi-selection missing');await p.getByRole('button',{name:'Pin selected chats',exact:true}).click();
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).filter(c=>c.pinned).length===2);
  check(await p.locator('.chat-list-row').first().getAttribute('aria-label')==='Open chat with Mom','Pinned order incorrect');
  await p.reload();await row('Mom').waitFor();check(await p.locator('.chat-list-row').first().getAttribute('aria-label')==='Open chat with Mom','Pin did not survive reload');
  if(mobile){
   const r=await row('Mom').boundingBox();const x=r.x+100,y=r.y+20;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+25}]});await p.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check(await p.getByRole('toolbar',{name:'Selected chats'}).count()===0,'Scrolling triggered hold');
   await hold('Mom');await p.goBack();await p.getByRole('toolbar',{name:'Selected chats'}).waitFor({state:'hidden'});
   await hold('Mom');
  }else{
   await row('Mom').click({button:'right'});await p.getByRole('toolbar',{name:'Selected chats'}).waitFor();await p.keyboard.press('Escape');await p.getByRole('toolbar',{name:'Selected chats'}).waitFor({state:'hidden'});
   await row('Mom').focus();await p.keyboard.press('Space');await p.getByRole('toolbar',{name:'Selected chats'}).waitFor();
  }
  await p.getByRole('button',{name:'Archive selected chats',exact:true}).click();await p.getByRole('toolbar',{name:'Selected chats'}).waitFor({state:'hidden'});check(await row('Mom').count()===0,'Archive did not hide row');
  await p.getByRole('button',{name:/^Archived/}).click();await row('Mom').waitFor();await hold('Mom');await p.getByRole('button',{name:'Unarchive selected chats',exact:true}).click();await p.getByRole('button',{name:'Back from archived',exact:true}).click();await row('Mom').waitFor();
  await hold('Mom');await p.getByRole('button',{name:'Unpin selected chats',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).find(c=>c.name==='Mom').pinned===false);check(await p.locator('.chat-list-row').first().getAttribute('aria-label')==='Open chat with Sis','Unpin did not restore order');
  const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).find(c=>c.name==='Mom').messages);check(JSON.stringify(before)===JSON.stringify(after),'Message history changed');results.push(mobile?'Touch hold, movement cancellation, multi-select, Back, pin persistence, archive/unarchive passed':'Mouse hold, right-click, Space/Escape, multi-select, pin persistence, archive/unarchive passed');await context.close();
 }
 return results;
}
