const test=require('node:test'), assert=require('node:assert/strict');
const D=require('../miniprogram/utils/domain');
const {eventTimes}=require('../miniprogram/utils/timeline');
const {buildCalendar}=require('../miniprogram/utils/calendar');
const {eventSummary}=require('../miniprogram/utils/event-stats');
const t=(date,time='00:00')=>D.timestamp(date,time);
const record=(kind,category,start,end=null,extra={})=>({kind,category,start,end,owner:'a',visibility:'shared',photos:[],segments:[],...extra});
test('New categories coexist with old 408 data and merchant fields validate on the server',()=>{
 const base=record('study','408其他',t('2026-09-18','09:00'),t('2026-09-18','10:00'));
 assert.equal(D.validateRecord(base).category,'408整卷');
 for(const category of ['数学一','概率论','高数','线代','408整卷']) assert.equal(D.validateRecord({...base,category}).category,category);
 assert.equal(D.validateRecord(record('meal','午餐',t('2026-09-18','12:00'),null,{merchant:'  常吃的店  '})).merchant,'常吃的店');
 assert.throws(()=>D.validateRecord({...base,periodDays:16}));
 assert.throws(()=>D.validateRecord(record('meal','午餐',t('2026-09-18'),null,{merchant:'店'.repeat(31)})));
});
test('Event defaults use minute points, past quarter-hour intervals and category-specific sleep lengths',()=>{
 const now=t('2026-09-18','23:58')+49000;
 for(const kind of ['meal','body']) assert.equal(eventTimes(kind,'',undefined,now).start,t('2026-09-18','23:58'));
 const activity=eventTimes('activity','阅读',undefined,now);assert.equal(activity.end,t('2026-09-18','23:45'));assert.equal(activity.end-activity.start,3600000);
 assert.equal(D.dayKey(eventTimes('meal','午餐','2026-08-01',now).start),'2026-08-01');
 const sleep=eventTimes('sleep','夜间睡眠','2026-09-18',now);assert.equal(sleep.start,t('2026-09-18'));assert.equal(sleep.end,t('2026-09-18','08:00'));
 const nap=eventTimes('sleep','小睡',undefined,now);assert.equal(nap.end-nap.start,30*60000);
});
test('Open periods shade through today, never the future, and respect privacy and an actual end',()=>{
 const r=record('body','经期',t('2026-08-30','12:00'),null,{periodDays:5});
 const options={date:'2026-09-01',uid:'a',partnerId:'b',now:t('2026-09-03','12:00')};
 let c=buildCalendar([r],options);assert.equal(c.cells.find(c=>c.date==='2026-09-03').period,true);assert.equal(c.cells.find(c=>c.date==='2026-09-04').period,false);assert.equal(c.count,0);
 c=buildCalendar([{...r,end:t('2026-09-02')}],options);assert.equal(c.cells.find(c=>c.date==='2026-09-01').period,true);assert.equal(c.cells.find(c=>c.date==='2026-09-02').period,false);
 assert.ok(buildCalendar([{...r,category:'排便'}],options).cells.every(c=>!c.period));
 assert.ok(buildCalendar([{...r,owner:'b',visibility:'private'}],options).cells.every(c=>!c.period));
});
test('Merchant ranking and point heatmaps use the selected member and period without exposing private partner data',()=>{
 const records=[record('meal','午餐',t('2026-09-18','12:10'),null,{merchant:'甲店'}),record('meal','晚餐',t('2026-09-18','18:30'),null,{merchant:'甲店'}),record('meal','午餐',t('2026-09-18','12:00'),null,{owner:'b',merchant:'乙店'}),record('meal','早餐',t('2026-09-18','08:00'),null,{owner:'b',visibility:'private',merchant:'私密店'})];
 const options={date:'2026-09-18',scope:'day',now:t('2026-09-19'),uid:'a',partnerId:'b',kind:'meal'};
 const mine=eventSummary(records,options);assert.equal(mine.total,2);assert.equal(mine.merchants[0].name,'甲店');assert.equal(mine.merchants[0].count,2);
 const partner=eventSummary(records,{...options,owner:'partner'});assert.equal(partner.total,1);assert.equal(partner.merchants[0].name,'乙店');
 const all=eventSummary(records,{...options,owner:'all'});assert.equal(all.total,3);assert.equal(all.heatmap.reduce((sum,row)=>sum+row.cells.reduce((n,c)=>n+c.value,0),0),3);
 assert.deepEqual(all.members.map(m=>m.id),['a','b']);
});
test('Duration heatmap preserves paused segments, overlap union and midnight clipping',()=>{
 const records=[record('study','高数',t('2026-09-17','23:30'),t('2026-09-18','01:30'),{segments:[[t('2026-09-17','23:30'),t('2026-09-18','00:30')],[t('2026-09-18','01:00'),t('2026-09-18','01:30')]]}),record('study','线代',t('2026-09-18','00:15'),t('2026-09-18','00:45'))];
 const report=eventSummary(records,{date:'2026-09-18',scope:'day',now:t('2026-09-19'),uid:'a',kind:'study'});
 assert.equal(report.total,75*60000);assert.equal(report.heatmap.reduce((sum,row)=>sum+row.cells.reduce((n,c)=>n+c.value,0),0),report.total);assert.equal(report.subjects.reduce((n,s)=>n+s.percent,0),100);
});
test('An extended menstrual event counts once and predictions never inflate body statistics',()=>{
 const records=[record('body','经期',t('2026-09-16','09:00'),t('2026-09-19','09:00'))];
 const options={date:'2026-09-18',scope:'week',now:t('2026-09-19'),uid:'a',kind:'body'};
 assert.equal(eventSummary(records,options).total,1);assert.equal(eventSummary(records,{...options,scope:'day'}).total,0);
});
test('Identity labels remain viewer relative even when both stored names are 我',()=>{
 assert.equal(D.memberName({name:'我'},true),'我');assert.equal(D.memberName({name:'我'},false),'对方');assert.equal(D.memberName({name:'小林'},false),'小林');
});
test('Body statistics never combine unrelated categories',()=>{
 const records=['经期','排便','自慰'].map(category=>record('body',category,t('2026-09-18','09:00')));
 for(const bodyCategory of ['经期','排便','自慰']) {
  const report=eventSummary(records,{date:'2026-09-18',scope:'day',now:t('2026-09-19'),uid:'a',kind:'body',bodyCategory});
  assert.equal(report.total,1);assert.equal(report.subjects.length,1);assert.equal(report.subjects[0].name,D.categoryLabel(bodyCategory));
 }
});
test('Point chart percentages sum to 100 and timer saves never exceed a countdown deadline',()=>{
 const records=['早餐','午餐','晚餐'].map((category,i)=>record('meal',category,t('2026-09-18','08:00')+i*3600000));
 const report=eventSummary(records,{date:'2026-09-18',scope:'day',now:t('2026-09-19'),uid:'a',kind:'meal'});assert.equal(report.subjects.reduce((sum,item)=>sum+item.percent,0),100);
 const start=t('2026-09-18','08:00');assert.equal(D.timerEnd({runningSince:start,goalMs:60000,segments:[]},start+3600000),start+60000);
});
