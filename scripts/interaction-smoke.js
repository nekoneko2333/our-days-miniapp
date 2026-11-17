const automator=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}),errors=[],timings=[];
 mini.on('exception',e=>errors.push(e.message)); const title='界面回归_'+Date.now();
 try {
  let page=await mini.currentPage();
  if(page.path!=='pages/index/index'){await mini.callWxMethod('reLaunch',{url:'/pages/index/index'});await new Promise(r=>setTimeout(r,1000));page=await mini.currentPage();}
  assert.equal(await page.data('mode'),'demo','Only write test records in demo mode');
  await mini.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({editorRequest:null,tab:'timeline',calendarKind:'all',calendarOwner:'all',searchOpen:false,calendarFiltersOpen:true,calendarPanel:'calendar'});});
  for(const kind of ['activity','body']){
   const result=await mini.evaluate(kind=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],t=Date.now();p.openEditor(kind);wx.nextTick(()=>{const c=p.selectComponent('#recordEditor');const check=()=>c.createSelectorQuery().select('.editor-overlay').boundingClientRect(rect=>{if(!rect&&Date.now()-t<3000){setTimeout(check,16);return;}resolve({ms:Date.now()-t,kind:c.data.kind,visibility:c.data.visibility,rendered:!!rect,categories:c.data.categories});}).exec();check();});}),kind);
   assert.equal(result.kind,kind);assert.equal(result.visibility,'shared');assert.ok(result.rendered);timings.push({kind,renderMs:result.ms});console.log(kind,result.ms);
   if(kind==='body'){assert.equal(result.categories[0].label,'🩸');await mini.screenshot({path:'output/body-current.png'});}
   await mini.evaluate(()=>getCurrentPages().slice(-1)[0].selectComponent('#recordEditor').closeEditor());
  }
  await mini.evaluate(async title=>{const p=getCurrentPages().slice(-1)[0];p.openEditor('activity');await new Promise(r=>wx.nextTick(r));const c=p.selectComponent('#recordEditor');c.setData({title,note:'回归测试'});await c.save();},title);
  await page.waitFor(300);assert.ok(!(await page.data('editorRequest')));
  const saved=await mini.evaluate(title=>wx.getStorageSync('ourdays-demo-v1').records.find(r=>r.title===title),title);assert.equal(saved.visibility,'shared');
  await mini.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.changeTab({currentTarget:{dataset:{tab:'calendar'}}});});
  assert.equal((await page.data('dayAgenda')).some(r=>r.title===title),true);
  await (await page.$('[data-field="calendarMode"][data-value="week"]')).tap();await page.waitFor(150);assert.equal((await page.data('monthCells')).length,7);
  await (await page.$('[data-field="calendarKind"][data-value="body"]')).tap();await page.waitFor(200);assert.equal((await page.data('dayAgenda')).some(r=>r.title===title),false);
  await (await page.$('[data-field="calendarKind"][data-value="all"]')).tap();await page.waitFor(150);
  await (await page.$('[data-field="calendarMode"][data-value="month"]')).tap();await page.waitFor(150);
  await mini.screenshot({path:'output/calendar-events.png'});
  await (await page.$('[data-tab="timeline"]')).tap();await page.setData({view:'me'});
  if(await page.data('partner')){
   await (await page.$('[data-side="partner"]')).tap();await page.waitFor(100);assert.equal(await page.data('view'),'split');assert.equal(await page.data('rippleSide'),'partner');
   await page.waitFor(700);const left=await (await page.$('.mine-column')).size(),right=await (await page.$('.partner-column')).size();assert.ok(Math.abs(left.width-right.width)<2);
   await (await page.$('[data-side="partner"]')).tap();await page.waitFor(700);assert.equal(await page.data('view'),'partner');assert.equal((await (await page.$('.mine-column')).size()).width,0);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('output/interaction-smoke.json',JSON.stringify({ok:true,timings,checks:['inline activity/body rendered','shared defaults','blood drop','save and close','calendar saved event','week/month views','event filters','avatar wave and split widths']},null,2));console.log(JSON.stringify({ok:true,timings}));
 } finally {
  await mini.evaluate(title=>{const d=wx.getStorageSync('ourdays-demo-v1');if(d){d.records=d.records.filter(r=>r.title!==title);wx.setStorageSync('ourdays-demo-v1',d);}const p=getCurrentPages().slice(-1)[0];p.setData({editorRequest:null,tab:'calendar',view:'me'});p.refresh();},title).catch(()=>{});mini.disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
