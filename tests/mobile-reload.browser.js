// Run against the production preview with playwright-cli; uses an isolated, worker-enabled context.
async (page) => {
 const c=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
 const p=await c.newPage();p.setDefaultTimeout(8000);
 const check=(v,m)=>{if(!v)throw Error(m);};
 try {
  await p.goto('http://127.0.0.1:3013');await p.getByRole('button',{name:'Reload app',exact:true}).waitFor();
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.reload();await p.getByRole('button',{name:'Reload app',exact:true}).waitFor();
  await p.waitForFunction(()=>navigator.serviceWorker.controller&&JSON.parse(localStorage.getItem('whatsapp_chats')||'[]').find(c=>c.isGroup)?.voiceSettings);
  const before=await p.evaluate(()=>({chats:localStorage.getItem('whatsapp_chats'),settings:localStorage.getItem('whatsapp_settings')}));
  const button=p.getByRole('button',{name:'Reload app',exact:true});
  check(await button.innerText()==='WhatsApp','Heading appearance changed');
  check(await button.evaluate(e=>parseFloat(getComputedStyle(e).minHeight)>=44&&e.getBoundingClientRect().height>=43.5),'Touch target too small'); // Fractional device scaling can round a 44px box slightly below 44.
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),button.click()]);
  await p.getByRole('button',{name:'Reload app',exact:true}).waitFor();
  const after=await p.evaluate(()=>({chats:localStorage.getItem('whatsapp_chats'),settings:localStorage.getItem('whatsapp_settings')}));
  check(JSON.stringify(before)===JSON.stringify(after),'Reload changed saved chats/settings');check(await p.title()==='Wassap v1.9.9.5','Version changed');
  // The installed app has no browser reload control; exercise its cached offline fallback too.
  await c.setOffline(true);await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.getByRole('button',{name:'Reload app',exact:true}).click()]);
  await p.getByRole('button',{name:'Reload app',exact:true}).waitFor();check(await p.evaluate(()=>localStorage.getItem('whatsapp_chats'))===before.chats,'Offline reload changed chats');
  await c.setOffline(false);await p.setViewportSize({width:1440,height:844});await p.getByRole('heading',{name:'Chats',exact:true}).waitFor();check(await p.getByRole('button',{name:'Reload app',exact:true}).count()===0,'Mobile reload appeared on desktop');
  return 'Worker-controlled mobile reload, offline cached reload, 44px target, saved chats/settings, version 1.9.9.5 and unchanged desktop heading passed';
 } finally {await c.close();}
}
