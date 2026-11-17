const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../miniprogram/utils/domain');const {studySummary,breakdown,timerClock}=require('../miniprogram/utils/study-stats');
const at=(day,time)=>D.timestamp(day,time);
const row=(id,owner,category,start,end,extra={})=>({_id:id,owner,kind:'study',category,start,end,visibility:'shared',segments:[],...extra});
const opts={date:'2026-09-09',uid:'me',partnerId:'partner',owner:'me',now:at('2026-09-09','12:00')};
test('Time slots split midnight sessions and record statistics exclude hidden events',()=>{
 const records=[row('a','me','数学一',at('2026-09-08','23:00'),at('2026-09-09','01:00')),row('b','me','英语一',at('2026-09-09','09:00'),at('2026-09-09','10:00')),row('c','partner','排便',at('2026-09-09','09:00'),null,{kind:'body',visibility:'private'}),row('d','me','排便',at('2026-09-09','09:00'),null,{kind:'body'})];
 const result=studySummary(records,{...opts,scope:'week',owner:'all'});
 assert.deepEqual(result.slots.map(s=>s.ms),[3600000,3600000,0,3600000]);assert.equal(result.slots.reduce((n,s)=>n+s.percent,0),100);
 assert.equal(result.sessions,2);assert.equal(result.sessionAverage,'1小时30分');assert.equal(result.longest,'2小时');assert.equal(result.bestDay,'2026-09-09');
 assert.equal(result.activity.find(a=>a.kind==='body').count,1);assert.equal(result.activity.find(a=>a.kind==='body').categories[0].name,'💩');
 assert.equal(studySummary(records,{...opts,date:'2026-10-01'}).activity.reduce((n,a)=>n+a.count,0),0);
});
test('Day/week/month averages use elapsed days including zero-study days and exclude future time',()=>{
 const records=[row('a','me','数学一',at('2026-09-07','09:00'),at('2026-09-07','11:00')),row('b','me','英语一',at('2026-09-09','10:00'),at('2026-09-09','11:00')),row('future','me','政治',at('2026-09-10','10:00'),at('2026-09-10','12:00'))];
 const week=studySummary(records,{...opts,scope:'week'});assert.equal(week.days,3);assert.equal(week.label,'3小时');assert.equal(week.average,'1小时');assert.equal(week.activeDays,2);assert.equal(week.share,4.2);assert.equal(week.subjects.reduce((s,x)=>s+x.percent,0),100);
 assert.equal(studySummary(records,{...opts,scope:'month'}).days,9);assert.equal(studySummary(records,{...opts,scope:'month'}).average,'20分钟');assert.equal(studySummary(records,{...opts,scope:'day'}).label,'1小时');
});
test('Overlapping subjects divide shared time; members do not erase each other; private partner study stays hidden',()=>{
 const records=[row('a','me','数学一',at('2026-09-09','09:00'),at('2026-09-09','11:00')),row('b','me','英语一',at('2026-09-09','10:00'),at('2026-09-09','12:00')),row('c','partner','政治',at('2026-09-09','09:00'),at('2026-09-09','10:00')),row('d','partner','政治',at('2026-09-09','10:00'),at('2026-09-09','12:00'),{visibility:'private'})];
 const r=studySummary(records,{...opts,owner:'all'});assert.equal(r.label,'4小时');assert.equal(r.subjects.reduce((n,s)=>n+s.percent,0),100);assert.equal(r.members.find(m=>m.id==='me').percent,75);assert.equal(r.members.find(m=>m.id==='partner').percent,25);
 const own=breakdown(records.filter(r=>r.owner==='me'),at('2026-09-09','00:00'),opts.now);assert.equal(own.subjects['数学一'],1.5*3600000);assert.equal(own.subjects['英语一'],1.5*3600000);
});
test('Statistics handle paused segments, empty future periods and timer seconds',()=>{
 const r=row('a','me','数学一',at('2026-09-09','09:00'),at('2026-09-09','11:00'),{segments:[[at('2026-09-09','09:00'),at('2026-09-09','09:30')]]});assert.equal(studySummary([r],opts).label,'30分钟');
 const future=studySummary([],{...opts,date:'2026-10-01',scope:'month'});assert.equal(future.days,0);assert.equal(future.share,0);assert.equal(future.average,'0分钟');assert.equal(timerClock(3661000),'01:01:01');
});
