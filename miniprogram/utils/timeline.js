const D = require('./domain');
function draftTimes(date, now = Date.now()) {
  const rounded = Math.round((now - D.dayStart(D.dayKey(now))) / 3600000) * 3600000;
  const start = D.dayStart(date || D.dayKey(now)) + rounded;
  return { start, end: start + 3600000 };
}
function eventTimes(kind, category, date, now = Date.now()) {
  // Point events use exact minutes; retrospective intervals end on the nearest past quarter-hour.
  const today = D.dayKey(now), base = D.dayStart(date || today);
  const minute = Math.floor((now - D.dayStart(today)) / 60000) * 60000;
  let end = base + Math.floor(minute / 900000) * 900000;
  if (kind === 'meal' || kind === 'body') return { start: base + minute, end: base + minute + 3600000, hint: '时刻记录 · 默认当前分钟，可修改为实际发生时间' };
  const duration = kind === 'sleep' ? (category === '小睡' ? 30 : 480) : 60;
  if (kind === 'sleep' && category !== '小睡') end = base + 8 * 3600000;
  if ((!date || date === today) && end > now) end = base + Math.floor(minute / 900000) * 900000;
  return { start: end - duration * 60000, end, hint: kind === 'sleep' ? (category === '小睡' ? '补记小睡 · 默认30分钟，可调整起止时间' : '补记夜间睡眠 · 默认昨晚至当天早晨8小时') : '补记时间段 · 默认最近已过的15分钟刻度结束，持续1小时' };
}
function scrollForTime(time, date, width) {
  const minutes = Math.max(0, Math.min(1440, (time - D.dayStart(date)) / 60000));
  return Math.max(0, minutes - 75) * 104 / 60 * width / 750;
}
function revealState(record, view, partner) {
  return { date: D.dayKey(record.start), tab: 'timeline', searchOpen: false,
    view: partner && view !== 'me' ? 'split' : 'me', focusedId: record._id,
    feedQuery: '', feedOwner: 'all', feedKind: 'all', calendarOwner: 'all', calendarKind: 'all' };
}
module.exports = { draftTimes, eventTimes, scrollForTime, revealState };
