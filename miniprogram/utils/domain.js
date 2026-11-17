/* Shared pure rules. scripts/sync.js copies this file into the cloud function. */
const DAY = 86400000;
const ZONE = 8 * 3600000;
const CATEGORIES = {
  meal: ['早餐', '午餐', '晚餐', '零食', '饮料'],
  activity: ['阅读', '休息', '散步', '运动', '娱乐', '出门', '其他'],
  study: ['政治', '英语一', '数学一', '概率论', '高数', '线代', '数据结构', '计算机组成原理', '操作系统', '计算机网络', '408整卷'],
  body: ['经期', '排便', '自慰'],
  sleep: ['夜间睡眠', '小睡']
};
const CITIES = [
  { name: '杭州', location: '101210101' }, { name: '成都', location: '101270101' },
  { name: '北京', location: '101010100' }, { name: '上海', location: '101020100' },
  { name: '广州', location: '101280101' }, { name: '深圳', location: '101280601' },
  { name: '南京', location: '101190101' }, { name: '武汉', location: '101200101' },
  { name: '西安', location: '101110101' }, { name: '重庆', location: '101040100' }
];
function categoryLabel(category) { return category === '经期' ? '🩸' : category === '自慰' ? '💗' : category === '排便' ? '💩' : category; }
function normalizeCategory(category) { return category === '408其他' ? '408整卷' : category; }
function displayTitle(record) { return record.title === record.category || !record.title ? categoryLabel(normalizeCategory(record.category)) : record.title; }
function memberName(profile, own) {
  const name = profile && String(profile.name || '').trim();
  return !name || ['我', '你', '他', '她', '对方', '本人'].includes(name) ? (own ? '我' : '对方') : name;
}
function pad(n) { return String(n).padStart(2, '0'); }
function dayKey(t) { return new Date(t + ZONE).toISOString().slice(0, 10); }
function dayStart(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) throw new Error('日期格式不正确');
  const t = Date.parse(s + 'T00:00:00+08:00');
  if (!Number.isFinite(t) || dayKey(t) !== s) throw new Error('日期不存在');
  return t;
}
function clock(t) { const d = new Date(t + ZONE); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
function timestamp(date, time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('时间格式不正确');
  return dayStart(date) + Number(time.slice(0, 2)) * 3600000 + Number(time.slice(3)) * 60000;
}
function shiftDay(date, n) { return dayKey(dayStart(date) + n * DAY); }
function durationLabel(ms) { const m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + '小时' + (m % 60 ? m % 60 + '分' : '') : m + '分钟'; }
function validateRecord(input) {
  input = Object.assign({}, input, { title: input.title === input.category ? normalizeCategory(input.category) : input.title, category: normalizeCategory(input.category) });
  const kind = input.kind;
  if (!CATEGORIES[kind] || !CATEGORIES[kind].includes(input.category)) throw new Error('请选择记录类型');
  const start = Number(input.start), end = input.end === null || input.end === '' || input.end === undefined ? null : Number(input.end);
  if (!Number.isFinite(start) || start < dayStart('2000-01-01') || start > dayStart('2100-01-01')) throw new Error('记录时间超出范围');
  if (['study', 'activity', 'sleep'].includes(kind) && end === null) throw new Error('请填写结束时间');
  if (end !== null && (!Number.isFinite(end) || end <= start || end - start > 31 * DAY)) throw new Error('结束须晚于开始，单条记录最长31天');
  if (kind === 'meal' && end !== null) throw new Error('饮食请记录一个时间点');
  if (kind === 'body' && input.category !== '经期' && end !== null) throw new Error('此身体记录只需要时间点');
  const title = String(input.title || input.category).trim();
  const note = String(input.note || '').trim();
  if (!title || title.length > 40 || note.length > 1000) throw new Error('标题最多40字，备注最多1000字');
  if (!['private', 'shared'].includes(input.visibility)) throw new Error('请选择可见范围');
  const photos = input.photos || [];
  if (!Array.isArray(photos) || photos.length > 6 || photos.some(p => typeof p !== 'string' || p.length > 1024)) throw new Error('最多上传6张照片');
  const flow = String(input.flow || '未填写');
  if (!['未填写', '少', '中', '多'].includes(flow)) throw new Error('经量选项不正确');
  const segments = input.segments || [];
  if (!Array.isArray(segments) || segments.length > 500) throw new Error('学习分段数量超限');
  let previous = start;
  segments.forEach(s => {
    if (!Array.isArray(s) || s.length !== 2 || !Number.isFinite(s[0]) || !Number.isFinite(s[1]) || s[0] < previous || s[1] <= s[0] || end === null || s[1] > end) throw new Error('学习计时分段不正确');
    previous = s[1];
  });
  if (segments.length && kind !== 'study') throw new Error('仅学习记录支持计时分段');
  const merchant = kind === 'meal' ? String(input.merchant || '').trim() : '';
  if (merchant.length > 30) throw new Error('商家标签最多30字');
  const periodDays = Number(input.periodDays || 5);
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 15) throw new Error('预计经期天数须为1至15天');
  return { kind, category: input.category, title, note, start, end, visibility: input.visibility, photos, flow, segments, merchant, periodDays };
}
function overlaps(r, from, to) { return r.start < to && (r.end === null || r.end === undefined ? r.start >= from : r.end > from); }
function canRead(r, viewer, partner) { return r.owner === viewer || (r.owner === partner && r.visibility === 'shared'); }
function canWrite(r, viewer) { return r.owner === viewer; }
function intervals(r, from, to) {
  return (r.segments && r.segments.length ? r.segments : r.end ? [[r.start, r.end]] : []).map(s => [Math.max(s[0], from), Math.min(s[1], to)]).filter(s => s[1] > s[0]);
}
function unionDuration(spans) {
  let total = 0, left = 0, right = 0;
  spans.slice().sort((a, b) => a[0] - b[0]).forEach(s => {
    if (s[0] > right) { total += right - left; left = s[0]; right = s[1]; }
    else right = Math.max(right, s[1]);
  });
  return total + right - left;
}
function stats(records, from, to) {
  const study = records.filter(r => r.kind === 'study');
  const total = unionDuration(study.reduce((a, r) => a.concat(intervals(r, from, to)), []));
  const subjects = CATEGORIES.study.map(name => {
    const ms = unionDuration(study.filter(r => r.category === name).reduce((a, r) => a.concat(intervals(r, from, to)), []));
    return { name, ms, label: durationLabel(ms), percent: total ? Math.round(ms / total * 100) : 0 };
  }).filter(s => s.ms > 0);
  return { total, label: durationLabel(total), subjects };
}
// Pack visually overlapping cards into lanes, including point-event minimum heights.
function layout(records, date) {
  const from = dayStart(date), to = from + DAY, scale = 104 / 60;
  const items = records.filter(r => overlaps(r, from, to)).map(r => {
    const top = Math.max(0, (r.start - from) / 60000 * scale);
    const actualEnd = r.end ? Math.min(r.end, to) : r.start;
    const height = r.end ? Math.max(62, (actualEnd - Math.max(r.start, from)) / 60000 * scale) : 52;
    return Object.assign({}, r, { top, height, timeLabel: (r.start < from ? '前日 ' : '') + clock(r.start) + (r.end ? '–' + (r.end >= to ? '次日 ' : '') + clock(r.end) : ''), duration: r.end ? durationLabel(unionDuration(intervals(r, from, to))) : '', lane: 0, lanes: 1 });
  }).sort((a, b) => a.top - b.top || b.height - a.height);
  let group = [], boundary = -1;
  function pack() {
    const ends = [];
    group.forEach(r => { let i = ends.findIndex(e => e <= r.top); if (i < 0) i = ends.length; r.lane = i; ends[i] = r.top + r.height; });
    group.forEach(r => { r.lanes = ends.length; r.left = r.lane / r.lanes * 100; r.width = 100 / r.lanes; });
  }
  items.forEach(r => { if (r.top >= boundary) { pack(); group = []; } group.push(r); boundary = Math.max(boundary, r.top + r.height); });
  pack(); return items;
}
function timerElapsed(t, now) { return (t.segments || []).reduce((sum, s) => sum + s[1] - s[0], 0) + (t.runningSince ? Math.max(0, now - t.runningSince) : 0); }
function timerEnd(t, now) { return t.goalMs && t.runningSince ? Math.min(now, t.runningSince + Math.max(0, t.goalMs - timerElapsed(Object.assign({},t,{runningSince:null}),now))) : now; }
module.exports = { DAY, CATEGORIES, CITIES, normalizeCategory, memberName, categoryLabel, displayTitle, dayKey, dayStart, timestamp, clock, shiftDay, durationLabel, validateRecord, overlaps, canRead, canWrite, intervals, unionDuration, stats, layout, timerElapsed, timerEnd };
