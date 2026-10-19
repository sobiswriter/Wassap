// Isolated production-browser regression: phone keyboard-height simulation and desktop resizing.
async (page) => {
 const browser=page.context().browser(),results=[];
 const check=(v,m)=>{if(!v)throw Error(m);};
 for(const mobile of [true,false])for(const theme of ['dark','light']){
  const c=await browser.newContext({viewport:{width:mobile?390:1440,height:844},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  await c.addInitScript(({theme})=>localStorage.setItem('whatsapp_settings',JSON.stringify({theme,aiProvider:'vertex',chatWallpaper:'/images/misty-forest.svg',chatWallpaperOpacity:.85})),{theme});
  const p=await c.newPage();p.setDefaultTimeout(5000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:3013');check(await p.title()==='Wassap v1.9.9','Stale browser title');
  if(mobile){
   const styles=await p.locator('.chat-list-row').first().evaluate(e=>({divider:getComputedStyle(e,'::after').borderBottomColor,right:getComputedStyle(document.querySelector('.mobile-inbox > .app-panel')).borderRightWidth}));
   check(styles.right==='0px','Mobile right frame remains');
   check(Number(styles.divider.match(/[\d.]+/g).at(-1))<.06,'Strong row divider '+theme+' '+styles.divider);
   const nav=await p.getByRole('navigation',{name:'Main navigation'}).evaluate(e=>getComputedStyle(e).borderTopColor);check(Number(nav.match(/[\d.]+/g).at(-1))<.06,'Strong nav frame');
   await p.screenshot({path:`output/playwright/197-inbox-${theme}.png`,animations:'disabled'});
  }
  await p.getByRole('button',{name:'Open chat with Big Bro',exact:true}).click();
  const t=p.getByRole('textbox',{name:'Message',exact:true}),w=p.locator('.chat-wallpaper');
  const initial=await w.boundingBox();
  await t.fill('Line one\nLine two\nLine three');await t.focus();
  check(await t.evaluate(e=>getComputedStyle(e).outlineStyle)==='none','Composer focus bars remain');
  await p.waitForFunction(h=>document.querySelector('.chat-wallpaper').clientHeight===h,initial.height);
  const date=p.locator('button[title="Save this day as a diary memory"]').first();check(await date.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))===12,'Date chip too small');
  await p.setViewportSize({width:mobile?390:1440,height:480});
  await p.waitForFunction(({h,mobile})=>{const pane=document.querySelector('.mobile-conversation'),w=document.querySelector('.chat-wallpaper');return mobile?w.clientHeight===h:w.clientHeight===pane.clientHeight;},{h:initial.height,mobile});
  const box=await t.boundingBox();check(box.y+box.height<=480,'Composer outside visible viewport');
  check(await t.inputValue()==='Line one\nLine two\nLine three','Draft changed during resize');
  check(await t.evaluate(e=>e===document.activeElement),'Resize lost input focus');
  check(await w.evaluate(e=>e.parentElement.contains(document.querySelector('.message-composer'))),'Wallpaper excludes composer');
  if(mobile&&theme==='dark')await p.screenshot({path:'output/playwright/197-keyboard-dark.png',animations:'disabled'});
  await p.setViewportSize({width:mobile?390:1440,height:844});
  await date.click();await p.getByRole('heading',{name:"Big Bro's Diary",exact:true}).waitFor();
  // Close the diary without invoking paid generation.
  await p.getByRole('button',{name:'Close diary',exact:true}).click();
  const call=p.getByRole('button',{name:'Voice call',exact:true});await p.keyboard.press('Tab');await call.focus();
  check(await call.evaluate(e=>getComputedStyle(e).outlineStyle)!=='none','Keyboard button focus disappeared');
  if(mobile){
   await p.setViewportSize({width:740,height:390});await p.waitForFunction(()=>document.querySelector('.chat-wallpaper').clientWidth===740&&document.querySelector('.chat-wallpaper').clientHeight===document.querySelector('.mobile-conversation').clientHeight);
  }
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
  await p.evaluate(()=>{document.title='(1) New Message';document.dispatchEvent(new Event('visibilitychange'));});check(await p.title()==='Wassap v1.9.9','Foreground title loses version');
  check(errors.length===0,errors.join('; '));results.push(`${mobile?'mobile':'desktop'} ${theme}`);await c.close();
 }
 return `Passed wallpaper crop/draft/focus, composer bars, diary action/date, subtle dividers, title and overflow: ${results.join(', ')}`;
}
