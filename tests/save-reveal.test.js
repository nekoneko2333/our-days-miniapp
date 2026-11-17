const test=require('node:test'),assert=require('node:assert/strict');
global.wx={getStorageSync:()=>'',getSystemInfoSync:()=>({windowWidth:375})};let definition;global.Page=p=>definition=p;
require('../miniprogram/pages/index/index');
const S=require('../miniprogram/utils/service'),D=require('../miniprogram/utils/domain');
function page(){return {...definition,data:{...JSON.parse(JSON.stringify(definition.data)),date:'2026-09-06',tab:'timeline',view:'partner',partner:{id:'partner',name:'对方'},me:{name:'我'},feedOwner:'partner',searchOpen:true},_records:[],_photos:{},_recordScope:'demo:demo-me',_width:375,setData(p,cb){Object.assign(this.data,p);if(cb)cb();}};}
test('Study supports all eleven subjects and opens the focus screen without invoking native action sheet',()=>{
 const previous={getTimer:S.getTimer,setTimer:S.setTimer};let timer=null;const p=page();
 global.wx.showActionSheet=()=>{throw Error('Native menu limit');};
 try { S.getTimer=()=>timer;S.setTimer=t=>timer=t;p.add({currentTarget:{dataset:{kind:'study'}}});assert.equal(p.data.studyOpen,true);assert.equal(p.data.studyCategories.length,11);
 p.chooseStudy({currentTarget:{dataset:{subject:p.data.studyCategories[7]}}});p.startTimer();assert.equal(timer.category,p.data.studyCategories[7]);assert.ok(timer.runningSince);assert.equal(p.data.studyOpen,false);
 assert.equal(p.data.focusOpen,true);p.minimizeFocus();assert.equal(p.data.focusOpen,false);
 const id=timer.id;p.startTimer();assert.equal(timer.id,id);assert.equal(p.data.focusOpen,true);
 }finally{Object.assign(S,previous);p.onUnload();delete global.wx.showActionSheet;}
});
const saved={_id:'saved_record',clientId:'saved_record',owner:'demo-me',version:1,kind:'activity',category:'阅读',title:'测试',start:D.timestamp('2026-10-01','20:15'),end:D.timestamp('2026-10-01','21:15'),photos:[],segments:[],visibility:'shared'};
test('Acknowledged saves remain visible through stale reads or failed refreshes',async()=>{
 const old=S.list;try{
  S.list=async()=>[];const p=page();await p.editorClosed({detail:{saved:true,record:saved}});
  assert.equal(p.data.date,'2026-10-01');assert.equal(p.data.view,'split');assert.equal(p.data.mine[0]._id,saved._id);assert.equal(p.data.eventAnchor,"event-"+saved._id);assert.equal(p.data.feedOwner,'all');assert.equal(p.data.searchOpen,false);p.onUnload();
  S.list=async()=>{throw Error('断网');};const q=page();await q.editorClosed({detail:{saved:true,record:saved}});assert.equal(q.data.mine[0]._id,saved._id);assert.equal(q.data.error,'断网');q.onUnload();
 }finally{S.list=old;}
});
test('New timeline entries use today even when browsing history; calendar additions keep the selected day',()=>{
 const p=page();p.openEditor('body');assert.equal(p.data.editorRequest.date,D.dayKey(Date.now()));p.setData({editorRequest:null,tab:'calendar',searchOpen:false});p.openEditor('activity');assert.equal(p.data.editorRequest.date,'2026-09-06');
});
test('Finish study saves paused segments and retains the draft when saving fails',async()=>{
 const previous={getTimer:S.getTimer,setTimer:S.setTimer,save:S.save,list:S.list};const now=Date.now();let timer={id:'test_timer',category:'数学一',start:now-3600000,runningSince:now-1800000,segments:[[now-3600000,now-2700000]]},stored;
 global.wx.showModal=async()=>({confirm:true});global.wx.showToast=()=>{};
 const p=page();try{
  S.getTimer=()=>timer;S.setTimer=t=>timer=t;S.list=async()=>[];S.save=async()=>{throw Error('保存失败');};
  await p.finishTimer();assert.ok(timer);assert.equal(timer.runningSince,null);assert.equal(p.data.timerSaving,false);assert.equal(p._finishing,false);
  S.save=async record=>{stored=record;return {id:'study_saved'};};await p.finishTimer();assert.equal(timer,null);assert.equal(stored.visibility,'shared');assert.equal(stored.segments.length,2);assert.ok(D.unionDuration(stored.segments)>=45*60000);assert.equal(p.data.mine.some(r=>r._id==='study_saved'),true);
 }finally{Object.assign(S,previous);p.onUnload();}
});
test('Pomodoro restored after background time stops exactly at its target and cannot resume accidentally',()=>{
 const previous={getTimer:S.getTimer,setTimer:S.setTimer};const now=Date.now();let timer={id:'pomodoro',category:'高数',start:now-600000,runningSince:now-600000,segments:[],goalMs:60000};const p=page();
 global.wx.showToast=()=>{};
 try {S.getTimer=()=>timer;S.setTimer=t=>timer=t;p.tick();assert.equal(timer.runningSince,null);assert.equal(timer.completed,true);assert.equal(D.timerElapsed(timer,now),60000);assert.equal(p.data.remaining,'00:00:00');p.pauseTimer();assert.equal(timer.runningSince,null);}finally{Object.assign(S,previous);p.onUnload();}
});
test('Calendar additions preserve the selected day and open manual study instead of a realtime timer',()=>{
 const p=page();p.setData({tab:'calendar',searchOpen:false});p.openCalendarAdd();p.add({currentTarget:{dataset:{kind:'study'}}});assert.equal(p.data.editorRequest.kind,'study');assert.equal(p.data.editorRequest.date,'2026-09-06');assert.equal(p.data.studyOpen,false);assert.equal(p.data.calendarAddOpen,false);
});
test('Photo completion patches image fields without rerendering the calendar or statistics',async()=>{
 const previous={list:S.list,photoUrls:S.photoUrls};const p=page();let renders=0,patches=[];
 const originalRender=p.render;p.render=function(){renders++;return originalRender.call(this);};
 const originalSet=p.setData;p.setData=function(patch,cb){patches.push(patch);return originalSet.call(this,patch,cb);};
 try{S.list=async()=>[{...saved,start:D.timestamp('2026-09-06','12:00'),end:D.timestamp('2026-09-06','13:00'),photos:['cloud-photo']}];S.photoUrls=async()=>({'cloud-photo':'https://example.invalid/photo'});await p.loadRecords();assert.equal(renders,1);assert.ok(patches.some(patch=>patch['mine[0].photo']==='https://example.invalid/photo'));}finally{Object.assign(S,previous);p.onUnload();}
});

test('Event homepage includes both members regardless of the hour-axis member selection',()=>{
 const p=page();p.setData({view:'me',mine:[{...saved,createdAt:100}],theirs:[{...saved,_id:'partner_event',owner:'partner',start:saved.start+100000,createdAt:200}]});
 p.renderEvents();assert.deepEqual(p.data.events.map(r=>r._id),['partner_event','saved_record']);assert.equal(p.data.events[0].own,false);assert.equal(p.data.events[1].own,true);
 const old=wx.setStorageSync;let stored;wx.setStorageSync=(key,value)=>{stored={key,value};};
 try{p._scroll=120;p.switchHomeStyle({currentTarget:{dataset:{style:'axis'}}});assert.equal(stored.value,'axis');p._scroll=700;p.switchHomeStyle({currentTarget:{dataset:{style:'events'}}});assert.equal(p.data.scrollTop,120);assert.equal(p.data.events.length,2);assert.equal(p.data.view,'me');}finally{wx.setStorageSync=old;}
});
