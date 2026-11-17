const test=require('node:test'),assert=require('node:assert/strict');
const storage=new Map();global.wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,structuredClone(v)),removeStorageSync:k=>storage.delete(k),showToast(){},vibrateShort(){}};
let definition;global.Page=p=>definition=p;require('../miniprogram/pages/index/index');
const Back=require('../miniprogram/utils/back-navigation'),S=require('../miniprogram/utils/service'),D=require('../miniprogram/utils/domain');
function page(){const p={...definition,data:structuredClone(definition.data),updates:[],setData(p,cb){Object.assign(this.data,p);this.updates.push({...p});if(cb)cb();}};Back.install(p);return p;}
test('Manual study changes overlays without dismissing the native return guard',()=>{
 const p=page();p.setData({studyOpen:true});p.updates=[];p.manualStudy();assert.equal(p.data.editorRequest.kind,'study');assert.equal(p.data.studyOpen,false);assert.ok(p.updates.every(x=>x.backGuard));
 const q=page();q.setData({calendarAddOpen:true,tab:'calendar',date:'2026-09-01'});q.updates=[];q.add({currentTarget:{dataset:{kind:'study'}}});assert.equal(q.data.editorRequest.date,'2026-09-01');assert.ok(q.updates.every(x=>x.backGuard));
});
test('Rest persists, expires once and never adds study time',()=>{
 const p=page(),now=Date.now();S.setTimer({id:'round',category:'高数',start:now-60000,segments:[[now-60000,now]],runningSince:null,goalMs:60000,completed:true});p.startRest();let t=S.getTimer();assert.ok(t.restUntil>now);assert.equal(D.timerElapsed(t,now+999999),60000);const until=t.restUntil;p.startRest();assert.equal(S.getTimer().restUntil,until);t.restUntil=now-1;S.setTimer(t);p.tick();assert.equal(S.getTimer().restCompleted,true);assert.equal(p.data.restRemaining,'00:00:00');S.setTimer(null);
});
test('Next round requires successful save and preserves subject and duration',async()=>{
 const p=page();S.setTimer({category:'线代',completed:true,goalMs:45*60000});let starts=0;p.startTimer=()=>starts++;p.finishTimer=async()=>false;await p.nextRound();assert.equal(starts,0);p.finishTimer=async()=>true;await p.nextRound();assert.equal(starts,1);assert.equal(p.data.studyCategory,'线代');assert.equal(p.data.focusMinutes,45);S.setTimer(null);
});
