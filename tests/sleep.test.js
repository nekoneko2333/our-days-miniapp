const test=require('node:test'),assert=require('node:assert/strict'),D=require('../miniprogram/utils/domain'),{studySummary}=require('../miniprogram/utils/study-stats');
const at=(date,time)=>D.timestamp(date,time),sleep=(owner,start,end,extra={})=>({kind:'sleep',category:'夜间睡眠',owner,start,end,visibility:'shared',segments:[],photos:[],...extra});
test('Sleep requires an end, supports overnight ranges and preserves sharing validation',()=>{
 const r=sleep('me',at('2026-09-13','23:00'),at('2026-09-14','07:00'));
 assert.equal(D.validateRecord(r).end,r.end);assert.throws(()=>D.validateRecord({...r,end:null}),/结束时间/);assert.throws(()=>D.validateRecord({...r,end:r.start}),/结束须晚于/);
 assert.equal(D.layout([r],'2026-09-14')[0].duration,'7小时');
});
test('Sleep totals clip midnight, deduplicate overlap and exclude private partner data and learning',()=>{
 const r=sleep('me',at('2026-09-13','23:00'),at('2026-09-14','07:00'));
 const records=[r,{...r,category:'小睡'},sleep('partner',r.start,r.end,{visibility:'private'}),{...r,kind:'study',category:'数学一'}];
 const options={date:'2026-09-14',kind:'sleep',uid:'me',partnerId:'partner',owner:'all',now:at('2026-09-14','12:00')};
 const day=studySummary(records,options);assert.equal(day.label,'7小时');assert.equal(day.subjects.reduce((n,r)=>n+r.percent,0),100);assert.equal(day.slots[0].label,'6小时');assert.equal(day.slots[1].label,'1小时');
 const month=studySummary(records,{...options,scope:'month'});assert.equal(month.label,'8小时');assert.equal(month.days,14);assert.equal(day.activity.find(a=>a.kind==='sleep').count,2);
});
