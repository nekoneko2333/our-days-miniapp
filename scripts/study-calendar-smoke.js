const a=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'}),checks=[];let timerId='',timerKey='';
 try{
  const p=await m.currentPage();assert.equal(await p.data('mode'),'demo');
  await m.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({tab:'timeline',studyOpen:false,searchOpen:false,editorRequest:null});p.tick();});
  const existing=await p.data('timer');assert.ok(!existing,'Do not overwrite an existing user timer');
  await (await p.$('.quick[data-kind="study"]')).tap();await p.waitFor(200);assert.equal(await p.data('studyOpen'),true);assert.equal((await p.$$('.study-subject')).length,8);
  await (await p.$('.study-subject[data-subject="408其他"]')).tap();await p.waitFor(150);assert.equal(await p.data('studyCategory'),'408其他');await m.screenshot({path:'output/study-picker.png'});
  await (await p.$('.study-start')).tap();await p.waitFor(150);const timer=await p.data('timer');assert.ok(timer.runningSince);timerId=timer.id;
  timerKey=await m.evaluate(()=> 'ourdays-timer-demo-'+getCurrentPages().slice(-1)[0].data.me.id);assert.equal(timer.category,'408其他');assert.equal(await p.data('studyOpen'),false);assert.ok(await p.$('.timer-finish'));checks.push('real study quick button -> eighth subject -> start -> visible finish');
  await p.waitFor(2300);assert.notEqual(await p.data('elapsed'),'00:00:00');await (await p.$('.timer-pause')).tap();await p.waitFor(150);assert.equal((await p.data('timer')).runningSince,null);
  await (await p.$('.quick[data-kind="study"]')).tap();await p.waitFor(150);assert.ok(await p.$('.study-controls'));await (await p.$('.study-controls .secondary')).tap();await p.waitFor(150);assert.ok((await p.data('timer')).runningSince);await (await p.$('.study-sheet .arrow')).tap();checks.push('pause, visible control entry and resume');
  await (await p.$('.tab[data-tab="calendar"]')).tap();await p.waitFor(150);assert.ok(await p.$('.timer-finish'));await m.mockWxMethod('showModal',{confirm:true,cancel:false});try{await (await p.$('.timer-finish')).tap();await p.waitFor(700);}finally{await m.restoreWxMethod('showModal');}
  assert.ok(!(await p.data('timer')));assert.ok((await p.data('mine')).some(r=>r.clientId===timerId));checks.push('finish on calendar saves and reveals timer record');
  await m.evaluate(()=>{const p=getCurrentPages().slice(-1)[0],start=new Date(p.data.date+'T10:00:00+08:00').getTime();p._records=p._records.concat(['经期','排便','自慰'].map((category,i)=>({_id:'visual_only_'+i,owner:p.data.me.id,kind:'body',category,title:category,start,end:null,visibility:'shared',photos:[],segments:[]})));p.setData({tab:'calendar',calendarPanel:'calendar',calendarMode:'month',calendarKind:'all',calendarOwner:'all',calendarFiltersOpen:false});p.render();});
  await p.waitFor(200);assert.equal((await p.$$('.calendar-cell.chosen .special-symbol')).length,3);const day=await p.$('.calendar-cell.chosen .calendar-day');const size=await day.size();assert.equal(size.width,size.height);await m.screenshot({path:'output/calendar-circles.png'});checks.push('three deduplicated body symbols and circular selected date');
  await p.callMethod('toggleStats');await p.waitFor(100);
  for(const detail of ['rhythm','sessions','activity']){await (await p.$('.statistics-tabs text[data-detail="'+detail+'"]')).tap();await p.waitFor(100);assert.equal(await p.data('statsDetail'),detail);await m.screenshot({path:'output/stats-'+detail+'.png'});}
  checks.push('subject, time-of-day, session and activity statistics tabs');fs.writeFileSync('output/study-calendar-smoke.json',JSON.stringify({ok:true,checks},null,2));console.log(checks);
 }finally{
  await m.evaluate(({id,key})=>{if(id){const d=wx.getStorageSync('ourdays-demo-v1');if(d){d.records=d.records.filter(r=>r.clientId!==id);wx.setStorageSync('ourdays-demo-v1',d);}const t=key&&wx.getStorageSync(key);if(t&&t.id===id)wx.removeStorageSync(key);}const p=getCurrentPages().slice(-1)[0];p.setData({tab:'timeline',studyOpen:false,calendarPanel:'calendar'});p.refresh();},{id:timerId,key:timerKey}).catch(()=>{});m.disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});


