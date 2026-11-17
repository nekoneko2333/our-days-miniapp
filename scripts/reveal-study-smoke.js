const a=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'}),title='保存定位回归_'+Date.now(),checks=[];let timerKey='',testTimerId='',timerCreated=false;
 try{
  const p=await m.currentPage();assert.equal(await p.data('mode'),'demo');
  await m.evaluate(async()=>{const p=getCurrentPages().slice(-1)[0];await p.refresh();await p.changeDate('2026-08-06');p.setData({tab:'timeline',view:'partner',feedOwner:'partner',feedKind:'body',feedQuery:'旧筛选',searchOpen:false,editorRequest:null});});
  await m.evaluate(()=>getCurrentPages().slice(-1)[0].openEditor('activity'));
  const initial=await m.evaluate(()=>{const c=getCurrentPages().slice(-1)[0].selectComponent('#recordEditor');return {date:c.data.startDate,time:c.data.startTime,now:Date.now()};});
  assert.ok(initial.time.endsWith(':00'));const rounded=Math.round(initial.now/3600000)*3600000;assert.equal(initial.date,new Date(rounded+8*3600000).toISOString().slice(0,10));checks.push('nearest-hour current date from historical partner view');
  await m.evaluate(async title=>{const c=getCurrentPages().slice(-1)[0].selectComponent('#recordEditor');c.setData({title,startDate:'2026-09-13',startTime:'23:59',endDate:'2026-09-14',endTime:'00:59'});await c.save();},title);
  await p.waitFor(1300);assert.equal(await p.data('date'),'2026-09-13');assert.equal(await p.data('view'),'split');assert.equal(await p.data('feedOwner'),'all');
  const record=(await p.data('mine')).find(r=>r.title===title);assert.ok(record);
  const event=await p.$('.mine-column .event[data-id="'+record._id+'"]'),scroll=await p.$('.timeline-scroll');const [offset,size,viewport,vsize]=await Promise.all([event.offset(),event.size(),scroll.offset(),scroll.size()]);assert.ok(offset.top+size.height>viewport.top&&offset.top<viewport.top+vsize.height,'Saved card must intersect viewport');checks.push('save reveals dated record in viewport');await m.screenshot({path:'output/saved-visible.png'});
  await p.callMethod('openSearch');await p.waitFor(150);assert.ok(await p.$('.feed-search'));await p.callMethod('closeSearch');checks.push('search retained inside one timeline tab');
  await m.evaluate(async()=>{const p=getCurrentPages().slice(-1)[0];await p.changeDate('2026-09-12');p.setData({tab:'calendar',calendarMode:'month',calendarPanel:'calendar',calendarOwner:'all',calendarKind:'all',calendarFiltersOpen:false,agendaExpanded:false,statsOpen:false});p.render();});
  assert.equal((await p.$$('.calendar-event')).length,0);assert.ok((await p.data('agendaPreview')).length<=3);assert.equal((await p.data('tabs')).length,4);await m.screenshot({path:'output/calendar-clean.png'});checks.push('compact calendar dots and limited agenda');
  await p.callMethod('toggleStats');await p.waitFor(150);await m.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({statsOwner:'all',statScope:'month'});p.updateStats();});assert.equal((await p.data('statCards')).length,3);const report=await p.data('studyReport');assert.equal(report.subjects.reduce((n,s)=>n+s.percent,0),100);checks.push('month averages and subject shares');await m.screenshot({path:'output/study-statistics.png'});
  const timer=await m.evaluate(()=>{const p=getCurrentPages().slice(-1)[0],key='ourdays-timer-demo-'+p.data.me.id;return {key,existing:!!wx.getStorageSync(key)};});timerKey=timer.key;
  if(!timer.existing){testTimerId='timer_ui_'+Date.now();await m.evaluate(({key,id})=>{const now=Date.now();wx.setStorageSync(key,{id,category:'数学一',start:now-60000,runningSince:now-60000,segments:[]});getCurrentPages().slice(-1)[0].tick();},{key:timerKey,id:testTimerId});timerCreated=true;}
  await p.waitFor(150);assert.ok(await p.$('.timer-finish'));await m.screenshot({path:'output/calendar-timer.png'});checks.push('finish control visible on calendar');
  if(timerCreated){await m.mockWxMethod('showModal',{confirm:true,cancel:false});try{await p.callMethod('finishTimer');}finally{await m.restoreWxMethod('showModal');}assert.ok(!(await p.data('timer')));assert.ok((await p.data('mine')).some(r=>r.clientId===testTimerId));checks.push('finish timer saves and reveals record');}
  fs.writeFileSync('output/reveal-study-smoke.json',JSON.stringify({ok:true,checks},null,2));console.log(checks);
 }finally{
  await m.evaluate(({title,key,id})=>{const data=wx.getStorageSync('ourdays-demo-v1');if(data){data.records=data.records.filter(r=>r.title!==title&&(!id||r.clientId!==id));wx.setStorageSync('ourdays-demo-v1',data);}const timer=key&&wx.getStorageSync(key);if(timer&&timer.id===id)wx.removeStorageSync(key);const p=getCurrentPages().slice(-1)[0];p.setData({editorRequest:null,searchOpen:false,tab:'timeline',view:'split'});p.refresh();},{title,key:timerKey,id:testTimerId}).catch(()=>{});m.disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
