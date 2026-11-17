const a=require('miniprogram-automator'),assert=require('node:assert/strict');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'}),title='sleep_ui_'+Date.now();
 try{const p=await m.currentPage();assert.equal(await p.data('mode'),'demo');
 await p.setData({tab:'timeline',editorRequest:null,studyOpen:false,profileOpen:false});assert.equal((await p.$$('.quick')).length,5);assert.equal(await p.$('.study-entry'),null);await m.screenshot({path:'output/home-compact.png'});
 await (await p.$('.quick[data-kind="sleep"]')).tap();await p.waitFor(150);
 const initial=await m.evaluate(()=>{const c=getCurrentPages().slice(-1)[0].selectComponent('#recordEditor');return {hasEnd:c.data.hasEnd,visibility:c.data.visibility,kind:c.data.kind};});assert.deepEqual(initial,{hasEnd:true,visibility:'shared',kind:'sleep'});
 await m.evaluate(async title=>{const c=getCurrentPages().slice(-1)[0].selectComponent('#recordEditor');c.setData({title,startDate:'2026-09-13',startTime:'23:00',endDate:'2026-09-14',endTime:'07:00'});await c.save();},title);await p.waitFor(200);assert.ok((await p.data('mine')).some(r=>r.title===title));
 await m.evaluate(async()=>{const p=getCurrentPages().slice(-1)[0];await p.changeDate('2026-09-14');p.setData({tab:'calendar',calendarPanel:'stats',statsOwner:'me',statScope:'day'});});
 await (await p.$('.statistics-kind button[data-kind="sleep"]')).tap();await p.waitFor(150);assert.equal((await p.data('studyReport')).label,'7小时');await m.screenshot({path:'output/sleep-stats.png'});
 await (await p.$('.tab[data-tab="me"]')).tap();await p.waitFor(100);await (await p.$('.profile-panel')).tap();await p.waitFor(150);assert.equal(await p.data('profileOpen'),true);const sheet=await p.$('.profile-sheet');const [pos,size]=await Promise.all([sheet.offset(),sheet.size()]);assert.ok(pos.top>0);assert.ok(size.height>250);const input=await p.$('.profile-sheet input');assert.ok((await input.size()).width>100);await m.screenshot({path:'output/profile-fixed.png'});
 console.log('Compact tools, sleep save/reveal, seven-hour day clipping, sleep statistics and profile layout passed');
 }finally{await m.evaluate(async title=>{const d=wx.getStorageSync('ourdays-demo-v1');if(d){d.records=d.records.filter(r=>r.title!==title);wx.setStorageSync('ourdays-demo-v1',d);}const p=getCurrentPages().slice(-1)[0];p.setData({tab:'timeline',profileOpen:false,editorRequest:null});await p.refresh();},title).catch(()=>{});m.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
