const D = require('./domain');
function presentStats(report, {kind, bodyCategory, scope, date, owner, selectedDate}) {
  const label = kind === 'body' ? D.categoryLabel(bodyCategory) : {study:'学习',sleep:'睡眠',meal:'饮食',activity:'活动'}[kind];
  const format = value => report.duration ? D.durationLabel(value) : (Math.round(value*10)/10)+'次';
  const hasData = report.total > 0;
  const ranked = report.subjects.slice().sort((a,b)=>b.ms-a.ms).map((row,i,rows)=>({...row,rank:i+1,width:rows[0].ms?row.ms/rows[0].ms*100:0}));
  const slots = Array.from({length:6},(_,i)=>{
    const from=i*4, value=report.heatmap.slice(from,from+4).reduce((sum,row)=>sum+row.cells.reduce((n,c)=>n+c.value,0),0);
    return {name:['深夜','清晨','上午','午后','傍晚','夜间'][i],range:String(from).padStart(2,'0')+':00–'+String(from+4).padStart(2,'0')+':00',value,label:format(value)};
  });
  const peak=Math.max(1,...slots.map(s=>s.value));slots.forEach(s=>s.width=s.value/peak*100);
  const trend=report.trend.map(d=>({...d,shortDate:Number(d.date.slice(5,7))+'/'+Number(d.date.slice(8)),valueLabel:d.future?'未到':d.ms?d.duration:'未记录',chosen:d.date===(selectedDate||date)}));
  const picked=trend.find(d=>d.date===(selectedDate||date))||trend.find(d=>d.date===date)||trend.find(d=>!d.future)||trend[0];
  trend.forEach(d=>d.chosen=!!picked && d.date===picked.date);
  const metrics=[{label:'有记录的天数',value:report.activeDays+'天'}];
  if(report.duration) metrics.push({label:owner==='all'?'有记录日均合计':'有记录日均',value:report.activeDays?format(report.total/report.activeDays):'—'});
  else metrics.push({label:'发生次数',value:report.label});
  if(kind==='study'||kind==='activity') metrics.push({label:'单次平均',value:hasData?report.sessionAverage:'—'});
  else if(kind==='meal') metrics.push({label:'已填写商家',value:report.merchants.filter(m=>m.name!=='未填写商家').reduce((n,m)=>n+m.count,0)+'次'});
  else metrics.push({label:'统计范围',value:report.days+'天'});
  const best=report.trend.filter(d=>d.ms>0).sort((a,b)=>b.ms-a.ms)[0];
  const top=kind==='meal'?report.merchants.find(m=>m.name!=='未填写商家'):ranked[0];
  const insight=!hasData?'这个时段还没有'+label+'数据':kind==='meal'?(top?'最常吃 '+top.name+' · '+top.count+'次':'填写商家后，这里会显示常吃排行'):kind==='body'?'已记录'+label+' '+report.sessions+'次':best?'单日最多 '+Number(best.date.slice(5,7))+'/'+Number(best.date.slice(8))+' · '+best.duration:'';
  return {label,hasData,headline:report.label,headlineLabel:report.duration?'累计'+label:'已记录'+label,metrics,ranked,slots,trend,picked,insight,rankTitle:kind==='study'?'时间花在哪些科目':kind==='meal'?'餐次分布':kind==='sleep'?'睡眠类型':'活动分布',unit:report.duration?'时长':'次数',rangeLabel:scope==='day'?date:report.rangeLabel};
}
module.exports={presentStats};
