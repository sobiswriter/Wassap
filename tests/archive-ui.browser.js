// Focused archive/navigation check; run with playwright-cli --filename.
async (page) => {
 const context=await page.context().browser().newContext({serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(5000);
 const check=(value,message)=>{if(!value)throw new Error(message);};
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:3013');
 await page.getByRole('button',{name:'Open chat with Big Bro',exact:true}).waitFor();
 await page.waitForFunction(()=>localStorage.getItem('whatsapp_chats'));
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).find(c=>c.name==='Big Bro').messages);
 await page.getByRole('button',{name:'Open chat with Big Bro',exact:true}).click();
 check(await page.getByRole('button',{name:'Voice call',exact:true}).getAttribute('title')==='Start voice call','Call action missing');
 const call=await page.getByRole('button',{name:'Voice call',exact:true}).boundingBox(),search=await page.getByRole('button',{name:'Search messages',exact:true}).boundingBox();check(call.x<search.x,'Call icon not beside search');
 await page.getByRole('button',{name:'Chat options',exact:true}).click();await page.getByRole('button',{name:'Archive chat',exact:true}).click();
 await page.getByRole('button',{name:'New chat',exact:true}).waitFor();
 check(await page.getByRole('button',{name:'Open chat with Big Bro',exact:true}).count()===0,'Archived chat still in main list');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).some(c=>c.name==='Big Bro'&&c.archived));
 await page.reload();await page.getByRole('button',{name:/^Archived/}).click();await page.getByRole('button',{name:'Open chat with Big Bro',exact:true}).click();
 check(await page.locator('.mobile-conversation').evaluate(el=>getComputedStyle(el).transitionDuration.includes('0.26s')),'Chat transition missing');
 await page.getByRole('heading',{name:'Big Bro',exact:true,level:2}).click();const profile=page.getByRole('dialog',{name:'Contact info',exact:true});await profile.waitFor();
 await profile.locator('[data-panel-close]').click();check(await profile.evaluate(el=>el.classList.contains('mobile-panel-closing')),'Reverse profile motion missing');await profile.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Chat options',exact:true}).click();await page.getByRole('button',{name:'Unarchive chat',exact:true}).click();
 await page.getByRole('button',{name:'Back to chats',exact:true}).click();await page.getByRole('button',{name:'Back from archived',exact:true}).click();
 await page.getByRole('button',{name:'Open chat with Big Bro',exact:true}).waitFor();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).some(c=>c.name==='Big Bro'&&c.archived===false));
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('whatsapp_chats')).find(c=>c.name==='Big Bro').messages);check(JSON.stringify(before)===JSON.stringify(after),'Archive changed message history');
 await page.getByRole('button',{name:/^Archived/}).click();await page.goBack();await page.getByRole('button',{name:'Open chat with Big Bro',exact:true}).waitFor();
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('.mobile-conversation').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<.001),'Reduced motion not respected');
 await context.close();return 'Archive/unarchive, persistence and message preservation, call icon/action, forward/reverse motion and reduced motion passed';
}
