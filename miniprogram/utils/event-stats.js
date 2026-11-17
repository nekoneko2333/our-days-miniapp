const D = require('./domain');
const { period, studySummary, breakdown, percentages } = require('./study-stats');
const LABELS = { study: '学习', sleep: '睡眠', meal: '饮食', activity: '活动', body: '身体' };
function eventSummary(records, options) {
  const { date, scope = 'week', now = Date.now(), uid, partnerId, owner = 'me', kind = 'study', bodyCategory = '经期' } = options;
  const range = period(date, scope), until = Math.max(range.from, Math.min(now, range.to));
  const duration = ['study','sleep','activity'].includes(kind);
  const allowed = records.filter(r => r.kind === kind && (kind !== 'body' || r.category === bodyCategory) && D.canRead(r,uid,partnerId)
    && (owner === 'all' || r.owner === (owner === 'me' ? uid : partnerId)));
  const matches = allowed.filter(r => until > range.from && D.overlaps(r, range.from, until));
  const days = Math.max(0, Math.ceil((until-range.from)/D.DAY));
  const countBetween = (from,to) => to > from ? allowed.filter(r=>r.start>=from && r.start<to).length : 0;
  const durationRecords = allowed.map(r=>({...r,kind:'study'}));
  const valueBetween = (from,to) => duration ? breakdown(durationRecords,from,to).total : countBetween(from,to);
  let report;
  if (duration) report = studySummary(records, options);
  else {
    // Point-event counts use start timestamps: a menstrual interval counts once, not once per day.
    const points = matches.filter(r=>r.start>=range.from && r.start<until), total = points.length;
    const trend = [];
    for(let t=range.from;t<range.to;t+=D.DAY) { const value=countBetween(t,Math.min(t+D.DAY,until)); trend.push({date:D.dayKey(t),label:String(Number(D.dayKey(t).slice(8))),ms:value,duration:value+'次',future:t>=until,selected:D.dayKey(t)===date}); }
    const peak=Math.max(1,...trend.map(d=>d.ms)); trend.forEach(d=>{d.height=d.ms/peak*100;});
    const subjects=percentages(D.CATEGORIES[kind].map(name=>{const count=points.filter(r=>r.category===name).length;return {name:D.categoryLabel(name),ms:count,label:count+'次'};}).filter(r=>r.ms),total);
    const ids=owner==='all'?[uid,partnerId].filter(Boolean):[owner==='me'?uid:partnerId].filter(Boolean);
    const members=ids.map(id=>{const count=points.filter(r=>r.owner===id).length;return {id,label:count+'次',percent:total?Math.round(count/total*100):0};});
    const best=trend.slice().sort((a,b)=>b.ms-a.ms)[0];
    report={total,label:total+'次',average:(days?Math.round(total/days*10)/10:0)+'次',days,activeDays:trend.filter(d=>d.ms).length,subjects,members,trend,sessions:total,bestDay:best&&best.ms?best.date:'—',bestDuration:best?best.duration:'0次',rangeLabel:D.dayKey(range.from)+' — '+D.dayKey(range.to-D.DAY)};
  }
  if (options.compact) return report;
  // Hour x weekday heatmap. Interval overlap is merged per owner, exactly as in the summary.
  const values = Array.from({length:24},()=>Array(7).fill(0));
  const denominators = Array(7).fill(0);
  for(let t=range.from;t<until;t+=D.DAY) {
    const weekday=(new Date(t+8*3600000).getUTCDay()+6)%7; denominators[weekday]++;
    for(let hour=0;hour<24;hour++) { const from=t+hour*3600000,to=Math.min(from+3600000,until); if(to>from) values[hour][weekday]+=valueBetween(from,to); }
  }
  const peak=Math.max(1,...values.flat());
  report.heatmap=values.map((row,hour)=>({hour,label:D.clock(D.dayStart(date)+hour*3600000),cells:row.map((value,day)=>({key:hour+'-'+day,day,value,level:value?Math.max(1,Math.ceil(value/peak*4)):0,label:['周一','周二','周三','周四','周五','周六','周日'][day]+' '+String(hour).padStart(2,'0')+':00–'+String(hour+1).padStart(2,'0')+':00 · '+(duration?D.durationLabel(value):value+'次')}))}));
  report.weekdays=denominators.map((n,day)=>{const value=values.reduce((sum,row)=>sum+row[day],0);return {name:['周一','周二','周三','周四','周五','周六','周日'][day],average:duration?D.durationLabel(n?value/n:0):(n?Math.round(value/n*10)/10:0)+'次'};});
  const merchants={};
  if(kind==='meal') matches.forEach(r=>{const name=r.merchant||'未填写商家';merchants[name]=(merchants[name]||0)+1;});
  const merchantPeak=Math.max(1,...Object.values(merchants));
  report.merchants=Object.entries(merchants).map(([name,count])=>({name,count,percent:Math.round(count/merchantPeak*100)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  report.duration=duration; report.labelName=LABELS[kind];
  let angle=0;
  const colors=['#6b8864','#b49a73','#90a8a0','#c68f96','#b2b780','#7d94b1','#a498b3','#89b789','#c8ae99','#8bb5bd','#a7ae98'];
  report.subjects.forEach((item,i)=>{item.color=colors[i%colors.length];const end=angle+item.percent*3.6;item.ringSegment=item.color+' '+angle+'deg '+end+'deg';angle=end;});
  report.ring=report.subjects.length?'conic-gradient('+report.subjects.map(x=>x.ringSegment).join(',')+')':'#e5eadf';
  return report;
}
module.exports={eventSummary,LABELS};
