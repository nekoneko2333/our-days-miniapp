const D = require('./domain');
function period(date, scope) {
  let from = D.dayStart(date), to = from + D.DAY;
  if (scope === 'week') { from -= (new Date(from + 8 * 3600000).getUTCDay() + 6) % 7 * D.DAY; to = from + 7 * D.DAY; }
  if (scope === 'month') { from = D.dayStart(date.slice(0, 7) + '-01'); to = D.dayStart(D.dayKey(from + 32 * D.DAY).slice(0, 7) + '-01'); }
  return { from, to };
}
// Split simultaneous subjects evenly, so their shares sum to the actual elapsed time.
function breakdown(records, from, to) {
  let total = 0; const subjects = {};
  for (const owner of new Set(records.map(r => r.owner))) {
    const events = [];
    records.filter(r => r.owner === owner && r.kind === 'study').forEach(r => D.intervals(r, from, to).forEach(([a,b]) => {
      events.push({ time:a, name:r.category, delta:1 }, { time:b, name:r.category, delta:-1 });
    }));
    events.sort((a,b) => a.time-b.time);
    const active = new Map(); let previous = from;
    events.forEach(e => {
      const span = e.time - previous;
      if (span > 0 && active.size) { total += span; active.forEach((_,name) => { subjects[name] = (subjects[name] || 0) + span / active.size; }); }
      const count = (active.get(e.name) || 0) + e.delta;
      if (count) active.set(e.name,count); else active.delete(e.name);
      previous = e.time;
    });
  }
  return { total, subjects };
}
function percentages(items, total) {
  const rows = items.map(item => ({ ...item, percent: total ? Math.floor(item.ms/total*100) : 0, remainder: total ? item.ms/total*100 % 1 : 0 }));
  const ordered = rows.slice().sort((a,b) => b.remainder-a.remainder);
  for (let i=0, remaining=total ? 100-rows.reduce((n,r)=>n+r.percent,0) : 0; i<remaining && ordered.length; i++) ordered[i % ordered.length].percent++;
  return rows;
}
function studySummary(records, { date, scope='day', now=Date.now(), uid, partnerId, owner='me', kind='study' }) {
  const range=period(date,scope), until=Math.max(range.from,Math.min(now,range.to));
  const days=Math.max(0,Math.ceil((until-range.from)/D.DAY));
  const allowed=records.filter(r => r.kind===kind && D.canRead(r,uid,partnerId)
    && (owner==='all' || (owner==='me' ? r.owner===uid : r.owner===partnerId))).map(r=>({...r,kind:'study'}));
  const result=breakdown(allowed,range.from,until);
  const subjects=percentages(Object.entries(result.subjects).map(([name,ms])=>({name,ms,label:D.durationLabel(ms)})),result.total).sort((a,b)=>b.ms-a.ms);
  const ids=owner==='all' ? [uid,...(partnerId ? [partnerId] : [])] : [owner==='me' ? uid : partnerId].filter(Boolean);
  const members=percentages(ids.map(id=>{ const ms=breakdown(allowed.filter(r=>r.owner===id),range.from,until).total; return {id,ms,label:D.durationLabel(ms),average:D.durationLabel(days ? ms/days : 0)}; }),result.total);
  const trend=[];
  for(let t=range.from;t<range.to;t+=D.DAY) {
    const ms=t<until ? breakdown(allowed,t,Math.min(t+D.DAY,until)).total : 0;
    trend.push({date:D.dayKey(t),label:String(Number(D.dayKey(t).slice(8))),ms,duration:D.durationLabel(ms),future:t>=until,selected:D.dayKey(t)===date});
  }
  const peak=Math.max(1,...trend.map(d=>d.ms)); trend.forEach(d=>{d.height=d.ms ? Math.max(3,Math.round(d.ms/peak*100)) : 0;});
  const sessions = allowed.map(r => D.unionDuration(D.intervals(r,range.from,until))).filter(ms=>ms>0);
  const slots = [
    {name:'凌晨',from:0,to:6}, {name:'上午',from:6,to:12},
    {name:'下午',from:12,to:18}, {name:'晚上',from:18,to:24}
  ].map(slot => {
    let ms=0;
    for(let t=range.from;t<until;t+=D.DAY) ms+=breakdown(allowed,t+slot.from*3600000,Math.min(t+slot.to*3600000,until)).total;
    return {name:slot.name,ms,label:D.durationLabel(ms)};
  });
  const weekdays = ['周一','周二','周三','周四','周五','周六','周日'].map((name,index)=> {
    const days=trend.filter(d=>!d.future && (new Date(D.dayStart(d.date)+8*3600000).getUTCDay()+6)%7===index);
    const ms=days.reduce((sum,d)=>sum+d.ms,0);return {name,ms,label:D.durationLabel(ms),average:D.durationLabel(days.length ? ms/days.length : 0)};
  });
  const best=trend.filter(d=>d.ms>0).sort((a,b)=>b.ms-a.ms)[0];
  const history = records.filter(r=> D.canRead(r,uid,partnerId)
    && (owner==='all' || (owner==='me' ? r.owner===uid : r.owner===partnerId)));
  const activity = Object.entries(D.CATEGORIES).map(([kind,categories])=> {
    const matching=until>range.from ? history.filter(r=>r.kind===kind && D.overlaps(r,range.from,until)) : [];
    return {kind,name:{meal:'饮食',activity:'活动',study:'学习',body:'身体',sleep:'睡眠'}[kind],count:matching.length,
      categories:categories.map(category=>({name:D.categoryLabel(category),count:matching.filter(r=>r.category===category).length})).filter(c=>c.count)};
  });
  return {total:result.total,label:D.durationLabel(result.total),average:D.durationLabel(days ? result.total/days : 0),days,
    activeDays:trend.filter(d=>d.ms>0).length,share:days && ids.length ? Math.min(100,Math.round(result.total/(days*D.DAY*ids.length)*1000)/10) : 0,
    sessions:sessions.length,sessionAverage:D.durationLabel(sessions.length ? sessions.reduce((n,ms)=>n+ms,0)/sessions.length : 0),
    longest:D.durationLabel(Math.max(0,...sessions)),bestDay:best ? best.date : '—',bestDuration:best ? best.duration : '0分钟',
    slots:percentages(slots,result.total),weekdays,activity,
    subjects,members,trend,rangeLabel:D.dayKey(range.from)+' — '+D.dayKey(range.to-D.DAY)};
}
function timerClock(ms) { const seconds=Math.max(0,Math.floor(ms/1000)); return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':'); }
module.exports={period,breakdown,studySummary,timerClock,percentages};
