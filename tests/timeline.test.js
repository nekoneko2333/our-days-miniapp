const test = require('node:test'), assert = require('node:assert/strict');
const D = require('../miniprogram/utils/domain');
const {draftTimes,scrollForTime,revealState}=require('../miniprogram/utils/timeline');
test('New times use the nearest hour, preserving explicit calendar dates and midnight rollover',()=>{
 const now=Date.parse('2026-09-13T23:58:49+08:00');
 const v=draftTimes(undefined,now);assert.equal(v.start,D.timestamp('2026-09-14','00:00'));assert.equal(D.dayKey(v.end),'2026-09-14');
 assert.equal(draftTimes('2026-09-06',now).start,D.timestamp('2026-09-07','00:00'));
 assert.equal(scrollForTime(D.timestamp('2026-09-13','00:01'),'2026-09-13',375),0);
 assert.ok(scrollForTime(v.start,'2026-09-13',375)>1100);
});
test('Saving from partner-only/search views reveals the owner and clears hiding filters',()=>{
 const r={_id:'record',start:D.timestamp('2026-10-01','18:30')};
 const state=revealState(r,'partner',{});assert.equal(state.view,'split');assert.equal(state.date,'2026-10-01');assert.equal(state.tab,'timeline');assert.equal(state.searchOpen,false);assert.equal(state.feedOwner,'all');assert.equal(state.focusedId,'record');
 assert.equal(revealState(r,'partner',null).view,'me');
});
