const test = require('node:test'), assert = require('node:assert/strict');
const D = require('../miniprogram/utils/domain');
const {buildCalendar,monthRange}=require('../miniprogram/utils/calendar');
const date='2026-09-01', at=(day,time)=>D.timestamp(day,time);
const opts={date,uid:'me',partnerId:'p'};
const r=(id,owner,visibility,start,end=null)=>({_id:id,owner,visibility,start,end,kind:'body',category:'经期',title:'经期',photos:[],segments:[]});
test('Special day symbols deduplicate categories and respect member privacy and filters',()=>{
 const rows=[r('a','me','shared',at(date,'08:00')),r('b','me','shared',at(date,'09:00')),r('c','p','shared',at(date,'10:00')),{...r('d','me','shared',at(date,'11:00')),category:'排便'},{...r('e','p','private',at(date,'12:00')),category:'自慰'}];
 const symbols=buildCalendar(rows,opts).cells.find(d=>d.date===date).special;
 assert.equal(symbols.length,1);assert.deepEqual(symbols[0],{category:'经期',symbol:'🩸',count:3,mine:true,theirs:true});assert.equal(buildCalendar(rows,opts).count,4);
 assert.equal(buildCalendar(rows,{...opts,owner:'partner'}).cells.find(d=>d.date===date).special.length,1);
 assert.equal(buildCalendar(rows,{...opts,kind:'study'}).cells.find(d=>d.date===date).special.length,0);
});
test('Calendar shows cross-month events on each overlapping day and excludes private partner data',()=>{
 const rows=[r('cross','me','shared',at('2026-08-31','23:00'),at(date,'01:00')),r('private','p','private',at(date,'10:00')),r('shared','p','shared',at(date,'12:00'))];
 const c=buildCalendar(rows,opts);assert.equal(c.count,2);assert.equal(c.cells.find(d=>d.date===date).count,2);assert.equal(c.agenda[0].title,'🩸');assert.equal(c.cells[0].date,'2026-08-31');assert.equal(c.cells[0].outside,true);
 assert.equal(buildCalendar(rows,{...opts,owner:'partner'}).count,1);assert.equal(buildCalendar(rows,{...opts,kind:'meal'}).count,0);
});
test('Calendar provides overflow counts and seven-day weeks across year boundaries',()=>{
 const rows=Array.from({length:5},(_,i)=>r(String(i),'me','shared',at(date,'12:00'))),c=buildCalendar(rows,opts),cell=c.cells.find(d=>d.date===date);
 assert.equal(cell.previews.length,2);assert.equal(cell.more,3);assert.equal(c.agenda.length,5);
 const week=buildCalendar([],{...opts,date:'2027-01-01',mode:'week'});assert.equal(week.cells.length,7);assert.equal(week.cells[0].date,'2026-12-28');assert.equal(week.cells[6].date,'2027-01-03');
 assert.equal(monthRange('2026-02-01').from,'2026-01-26');assert.equal(monthRange('2026-02-01').to,'2026-03-02');
});
test('Combined calendar study totals count each member independently',()=>{
 const rows=['me','p'].map((owner,i)=>({...r(String(i),owner,'shared',at(date,'09:00'),at(date,'10:00')),kind:'study',category:'数学一'}));
 assert.equal(buildCalendar(rows,opts).study,'2小时');assert.equal(buildCalendar(rows,{...opts,owner:'me'}).study,'1小时');
});
