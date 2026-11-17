const test=require('node:test'),assert=require('node:assert/strict'),D=require('../miniprogram/utils/domain');
const {periodReport,historyRange}=require('../miniprogram/utils/period-stats');
const t=(d,h='12:00')=>D.timestamp(d,h);
const opts={date:'2026-09-20',now:t('2026-09-20'),uid:'a',partnerId:'b'};
const r=(id,start,end,flow='中',extra={})=>({_id:id,owner:'a',kind:'body',category:'经期',visibility:'private',start:t(start),end:end?t(end):null,flow,...extra});
test('Cycle intervals span months; completed durations exclude open entries',()=>{
 const report=periodReport([r('1','2026-07-25','2026-07-29'),r('2','2026-08-22','2026-08-26'),r('3','2026-09-19',null)],opts).groups[0];
 assert.equal(report.cycleAverage,'28天');assert.equal(report.durationAverage,'5天');assert.equal(report.completedCount,2);assert.equal(report.status,'第 2 天 · 未结束');assert.equal(report.history[0].open,true);
});
test('One start gives no cycle estimate and unknown flow remains a separate category',()=>{
 const report=periodReport([r('1','2026-09-19',null,'未填写')],opts).groups[0];assert.equal(report.cycleAverage,'—');assert.equal(report.durationAverage,'—');assert.equal(report.flow.find(f=>f.name==='未填写').count,1);assert.equal(report.flow.find(f=>f.name==='少').count,0);
});
test('Members remain separate and private partner data stays hidden',()=>{
 const report=periodReport([r('1','2026-09-01','2026-09-05'),r('2','2026-09-10',null,'多',{owner:'b'}),r('3','2026-08-01','2026-08-03','少',{owner:'b',visibility:'shared'})],{...opts,owner:'all'});
 assert.equal(report.groups[0].count,1);assert.equal(report.groups[1].count,1);assert.equal(report.groups[1].flow.find(f=>f.name==='多').count,0);assert.equal(report.groups[0].cycles.length,0);
});
test('Duplicate same-day starts do not become zero-day cycles; future records are excluded',()=>{
 const report=periodReport([r('1','2026-08-20','2026-08-24'),r('2','2026-08-20','2026-08-24'),r('3','2026-09-17',null),r('4','2026-10-01',null)],opts).groups[0];assert.equal(report.cycles.length,1);assert.equal(report.cycleAverage,'28天');assert.equal(report.count,3);
});
test('History stays bounded and an exclusive midnight end does not add a day',()=>{
 const range=historyRange(opts.date,opts.now);assert.equal(D.dayStart(range.to)-D.dayStart(range.from),180*D.DAY);
 const report=periodReport([r('1','2025-01-01','2025-01-04'),r('2','2026-09-01','2026-09-05','中',{end:t('2026-09-05','00:00')})],opts).groups[0];assert.equal(report.count,1);assert.equal(report.durationAverage,'4天');assert.equal(report.history[0].end,'2026-09-04');
});
