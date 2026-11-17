const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../miniprogram/utils/domain'),{eventSummary}=require('../miniprogram/utils/event-stats'),{presentStats}=require('../miniprogram/utils/stats-presentation');
const at=(d,t)=>D.timestamp('2026-09-'+d,t);
const r=(kind,category,start,end,extra={})=>({owner:'a',kind,category,start,end,visibility:'shared',segments:[],photos:[],...extra});
const options={date:'2026-09-16',scope:'week',now:at('17','12:00'),uid:'a',kind:'study'};
test('Stats presentation keeps unrecorded and future days distinct and explains the active-day average',()=>{
 const records=[r('study','高数',at('15','09:00'),at('15','11:00')),r('study','线代',at('16','09:00'),at('16','10:00'))];const report=eventSummary(records,options),v=presentStats(report,options);
 assert.equal(v.metrics[1].value,'1小时30分');assert.equal(v.trend.find(d=>d.date==='2026-09-14').valueLabel,'未记录');assert.equal(v.trend.find(d=>d.date==='2026-09-18').valueLabel,'未到');assert.equal(v.ranked[0].name,'高数');assert.equal(v.slots.reduce((n,s)=>n+s.value,0),report.total);
 const picked=presentStats(report,{...options,selectedDate:'2026-08-01'});assert.equal(picked.picked.date,options.date);assert.equal(picked.trend.filter(d=>d.chosen).length,1);
});
test('Merchant summary does not recommend an unnamed merchant or expose private partner entries',()=>{
 const opts={...options,kind:'meal',owner:'all',partnerId:'b'};
 const rows=[r('meal','午餐',at('15','12:00'),null),r('meal','晚餐',at('15','18:00'),null,{merchant:'食堂'}),r('meal','早餐',at('16','08:00'),null,{merchant:'私密店',owner:'b',visibility:'private'})];
 const v=presentStats(eventSummary(rows,opts),opts);assert.equal(v.insight,'最常吃 食堂 · 1次');assert.equal(v.metrics[2].value,'1次');assert.equal(v.headline,'2次');
});
test('Body categories stay independent and empty views do not fabricate conclusions',()=>{
 const opts={...options,kind:'body',bodyCategory:'排便'};const rows=[r('body','经期',at('15','12:00'),null)];const v=presentStats(eventSummary(rows,opts),opts);assert.equal(v.hasData,false);assert.equal(v.label,'💩');assert.equal(v.headline,'0次');assert.ok(!v.insight.includes('最多'));
});
