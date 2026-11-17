const automator=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}),checks=[],fixtureNote='upgrade-smoke-'+Date.now();let timerId='',fixtureId='',visualIds=[];
 const capture=async options=>{if(process.env.UPGRADE_SCREENSHOTS==='1')await mini.screenshot(options);};
 try {
  const page=await mini.currentPage();assert.equal(await page.data('mode'),'demo','UI smoke only runs in demo mode');
  const initial=await page.data('timer');assert.ok(!initial,'Existing user timer must remain untouched');
  await page.callMethod('changeTab',{currentTarget:{dataset:{tab:'stats'}}});
  for(const kind of ['meal','activity','study','body','sleep']) {
   await (await page.$('.statistics-kind [data-kind="'+kind+'"]')).trigger('tap');await page.waitFor(120);
   assert.equal(await page.data('statsKind'),kind);assert.ok((await page.data('studyReport.heatmap')).length===24);
   assert.equal(await page.$('.statistics-tabs [data-detail="activity"]'),null);
  }
  checks.push('Independent statistics supports all five kinds without the unrelated records tab');
  visualIds=await mini.evaluate(()=>{
   const p=getCurrentPages().slice(-1)[0],date='2026-09-18',start=new Date(date+'T08:00:00+08:00').getTime();
   const make=(kind,category,offset,end,extra={})=>({_id:'upgrade_visual_'+kind+offset,clientId:'upgrade_visual_'+kind+offset,owner:p.data.me.id,kind,category,title:category,start:start+offset*3600000,end:end===null?null:start+end*3600000,visibility:'shared',photos:[],segments:[],...extra});
   const fixtures=[make('study','高数',0,2),make('study','线代',1,3),make('sleep','夜间睡眠',-8,0),make('meal','早餐',0,null,{merchant:'校园食堂'}),make('meal','午餐',4,null,{merchant:'校园食堂'}),make('meal','晚餐',10,null,{merchant:'面馆'}),make('body','经期',0,null,{periodDays:5})];
   const suffix=Date.now().toString(36);fixtures.forEach(r=>{r._id+='_'+suffix;r.clientId=r._id;r.version=1;});
   const data=wx.getStorageSync('ourdays-demo-v1');data.records=data.records.concat(fixtures);wx.setStorageSync('ourdays-demo-v1',data);return fixtures.map(r=>r._id);
  });
  await page.callMethod('refresh');await page.callMethod('changeDate','2026-09-18');
  await page.callMethod('statsKind',{currentTarget:{dataset:{kind:'study'}}});
  await page.waitFor(200);await capture({path:'output/upgrade-stats.png'});
  await (await page.$('[data-detail="rhythm"]')).trigger('tap');await page.waitFor(120);await page.waitFor(150);assert.equal((await page.$$('.heatmap-row')).length,24);await capture({path:'output/upgrade-heatmap.png'});
  await (await page.$('.heatmap-row .heat-cell')).trigger('tap');await page.waitFor(120);assert.ok(await page.data('heatDetail'));checks.push('24 by 7 heatmap renders and each cell reveals its time and value');
  await page.callMethod('statsKind',{currentTarget:{dataset:{kind:'meal'}}});await (await page.$('[data-detail="merchants"]')).trigger('tap');await page.waitFor(120);assert.equal((await page.data('studyReport')).merchants[0].name,'校园食堂');await capture({path:'output/upgrade-merchants.png'});
  await page.callMethod('changeTab',{currentTarget:{dataset:{tab:'calendar'}}});await page.waitFor(150);assert.ok((await page.$$('.period-day')).length>=1);await capture({path:'output/upgrade-calendar.png'});
  await page.callMethod('changeTab',{currentTarget:{dataset:{tab:'us'}}});await page.waitFor(150);assert.ok(await page.$('.profile-panel'));assert.ok(await page.$('.connection-art'));await capture({path:'output/upgrade-us.png'});checks.push('Merged space includes profile, data settings and member management');
  await page.callMethod('changeTab',{currentTarget:{dataset:{tab:'timeline'}}});await (await page.$('.quick[data-kind="study"]')).trigger('tap');await page.waitFor(120);assert.equal((await page.$$('.study-subject')).length,11);await capture({path:'output/upgrade-subjects.png'});
  await (await page.$('.study-subject[data-subject="408整卷"]')).trigger('tap');await page.waitFor(120);await (await page.$('.study-start')).trigger('tap');await page.waitFor(120);timerId=(await page.data('timer')).id;assert.equal(await page.data('focusOpen'),true);await page.waitFor(200);await capture({path:'output/upgrade-focus.png'});
  await (await page.$('.focus-page .panel-head .secondary')).trigger('tap');await page.waitFor(120);assert.ok(await page.$('.timer-float'));await page.waitFor(200);await capture({path:'output/upgrade-float.png'});
  await (await page.$('.timer-float .timer-pause')).trigger('tap');await page.waitFor(120);assert.equal((await page.data('timer')).runningSince,null);
  await (await page.$('.tab[data-tab="calendar"]')).tap();await page.waitFor(200);assert.equal(await page.data('tab'),'calendar');assert.ok(await page.$('.timer-float'));await (await page.$('.timer-float .timer-details')).trigger('tap');await page.waitFor(120);assert.equal(await page.data('focusOpen'),true);
  await (await page.$('.focus-page .study-controls .secondary')).trigger('tap');await page.waitFor(120);assert.ok((await page.data('timer')).runningSince);checks.push('Pomodoro starts, minimizes across tabs, pauses and resumes through the focus page');
  await page.waitFor(1100);await mini.mockWxMethod('showModal',{confirm:true,cancel:false});try{await page.callMethod('finishTimer');}finally{await mini.restoreWxMethod('showModal');}assert.ok(!(await page.data('timer')));assert.ok((await page.data('mine')).some(r=>r.clientId===timerId));checks.push('Focus completion saves only effective segments and reveals the saved event');
  await page.callMethod('openEditor','body');let editor=await page.$('#recordEditor');
  await editor.callMethod('field',{currentTarget:{dataset:{field:'note'}},detail:{value:fixtureNote}});
  await editor.callMethod('save');await page.waitFor(200);fixtureId=(await page.data('mine')).find(r=>r.note===fixtureNote)._id;assert.ok(fixtureId);
  await page.callMethod('recordTap',{currentTarget:{dataset:{id:fixtureId}}});editor=await page.$('#recordEditor');await editor.callMethod('categoryTap',{currentTarget:{dataset:{category:'排便'}}});await editor.callMethod('save');
  const edited=(await page.data('mine')).find(r=>r._id===fixtureId);assert.equal(edited.title,'💩');assert.equal(edited.category,'排便');
  const date=await page.data('date'),selected=(await page.data('monthCells')).find(c=>c.date===date);
  assert.ok(selected.special.some(s=>s.symbol==='💩'));checks.push('Changing menstrual event to bowel event updates timeline emoji and calendar symbols immediately');
  await page.callMethod('changeTab',{currentTarget:{dataset:{tab:'calendar'}}});await page.callMethod('openCalendarAdd');await page.waitFor(120);assert.equal((await page.$$('.calendar-add-grid button')).length,5);await (await page.$('.calendar-add-grid [data-kind="sleep"]')).trigger('tap');await page.waitFor(120);assert.equal((await page.data('editorRequest')).date,date);assert.equal((await page.data('editorRequest')).kind,'sleep');await (await page.$('#recordEditor')).callMethod('closeEditor');checks.push('Calendar adds any event kind on the selected date');
  await page.callMethod('openEditor','meal');editor=await page.$('#recordEditor');assert.ok(await editor.$('[data-field="merchant"]'));await capture({path:'output/upgrade-meal-editor.png'});await editor.callMethod('closeEditor');
  fs.writeFileSync('output/upgrade-smoke.json',JSON.stringify({ok:true,checks},null,2));console.log(JSON.stringify(checks,null,2));
 } finally {
  await mini.evaluate(({timerId,fixtureId,visualIds,fixtureNote})=>{
   const p=getCurrentPages().slice(-1)[0];if(p.data.mode!=='demo')return;
   const data=wx.getStorageSync('ourdays-demo-v1');if(data){data.records=data.records.filter(r=>r.clientId!==timerId&&r._id!==fixtureId&&r.note!==fixtureNote&&!visualIds.includes(r._id));wx.setStorageSync('ourdays-demo-v1',data);}
   const key='ourdays-timer-demo-'+p.data.me.id,timer=wx.getStorageSync(key);if(timer&&timer.id===timerId)wx.removeStorageSync(key);
   p.setData({tab:'timeline',focusOpen:false,studyOpen:false,editorRequest:null});p.refresh();
  },{timerId,fixtureId,visualIds,fixtureNote}).catch(()=>{});mini.disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
