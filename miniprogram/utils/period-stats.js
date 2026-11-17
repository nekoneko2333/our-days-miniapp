const D=require('./domain');
function historyRange(date,now=Date.now()) {
 const end=Math.min(D.dayStart(date)+D.DAY,D.dayStart(D.dayKey(now))+D.DAY);
 return {from:D.dayKey(end-180*D.DAY),to:D.dayKey(end),until:Math.min(end,now)};
}
function periodReport(records,{date,uid,partnerId,owner='me',now=Date.now()}) {
 const range=historyRange(date,now),from=D.dayStart(range.from),until=range.until;
 const ids=owner==='all'?[uid,partnerId].filter(Boolean):[owner==='me'?uid:partnerId].filter(Boolean);
 const groups=ids.map(id=>{
  const rows=records.filter(r=>r.kind==='body'&&r.category==='经期'&&r.owner===id&&D.canRead(r,uid,partnerId)&&r.start>=from&&r.start<until).sort((a,b)=>a.start-b.start);
  const starts=[...new Set(rows.map(r=>D.dayKey(r.start)))];
  const cycles=starts.slice(1).map((start,i)=>({date:start,previous:starts[i],days:Math.round((D.dayStart(start)-D.dayStart(starts[i]))/D.DAY)}));
  const complete=rows.filter(r=>r.end&&r.end<=until);
  const span=r=>Math.max(1,Math.round((D.dayStart(D.dayKey((r.end&&r.end<=until?r.end:until)-1))-D.dayStart(D.dayKey(r.start)))/D.DAY)+1);
  const average=items=>items.length?Math.round(items.reduce((a,b)=>a+b,0)/items.length*10)/10+'天':'—';
  const peak=Math.max(1,...cycles.map(c=>c.days));cycles.forEach(c=>c.width=c.days/peak*100);
  const flow=['少','中','多','未填写'].map(name=>({name,count:rows.filter(r=>(r.flow||'未填写')===name).length}));
  const flowPeak=Math.max(1,...flow.map(f=>f.count));flow.forEach(f=>f.width=f.count/flowPeak*100);
  const latest=rows[rows.length-1];
  return {id,count:rows.length,cycleAverage:average(cycles.map(c=>c.days)),cycleCount:cycles.length,durationAverage:average(complete.map(span)),completedCount:complete.length,latest:latest?D.dayKey(latest.start):'—',status:latest?(!latest.end||latest.end>until?'第 '+span(latest)+' 天 · 未结束':'最近一次已结束'):'还没有 🩸 数据',cycles:cycles.reverse(),flow,history:rows.slice().reverse().map(r=>({id:r._id,start:D.dayKey(r.start),end:r.end&&r.end<=until?D.dayKey(r.end-1):'未结束',duration:span(r)+'天',flow:r.flow||'未填写',open:!r.end||r.end>until}))};
 });
 return {rangeLabel:range.from+' — '+D.shiftDay(range.to,-1),groups};
}
module.exports={historyRange,periodReport};
