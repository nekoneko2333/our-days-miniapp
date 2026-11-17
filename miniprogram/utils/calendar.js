const D = require('./domain');
function combinedStats(records, from, to) {
  const owners = Array.from(new Set(records.map(r => r.owner)));
  const results = owners.map(owner => D.stats(records.filter(r => r.owner === owner), from, to));
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const subjects = D.CATEGORIES.study.map(name => {
    const ms = results.reduce((sum, r) => sum + (r.subjects.find(s => s.name === name) || { ms: 0 }).ms, 0);
    return { name, ms, label: D.durationLabel(ms), percent: total ? Math.round(ms / total * 100) : 0 };
  }).filter(s => s.ms);
  return { total, label: D.durationLabel(total), subjects };
}
function monthRange(date) {
  const first = date.slice(0, 7) + '-01', start = D.dayStart(first);
  const next = D.dayStart(D.dayKey(start + 32 * D.DAY).slice(0, 7) + '-01');
  const offset = (new Date(start + 8 * 3600000).getUTCDay() + 6) % 7;
  const from = start - offset * D.DAY;
  const to = from + Math.ceil((next - from) / (7 * D.DAY)) * 7 * D.DAY;
  return { from: D.dayKey(from), to: D.dayKey(to) };
}
function buildCalendar(records, { date, uid, partnerId, owner = 'all', kind = 'all', mode = 'month', now = Date.now() }) {
  const range = monthRange(date), selected = D.dayStart(date);
  let from = D.dayStart(range.from), to = D.dayStart(range.to);
  if (mode === 'week') { from = selected - (new Date(selected + 8 * 3600000).getUTCDay() + 6) % 7 * D.DAY; to = from + 7 * D.DAY; }
  const visible = records.filter(r => D.canRead(r, uid, partnerId)
    && (owner === 'all' || (owner === 'me' ? r.owner === uid : r.owner === partnerId))
    && (kind === 'all' || r.kind === kind));
  const cells = [];
  for (let t = from; t < to; t += D.DAY) {
    const key = D.dayKey(t);
    const events = visible.filter(r => D.overlaps(r, t, t + D.DAY)).sort((a, b) => a.start - b.start);
    const periods = visible.filter(r => r.kind === 'body' && r.category === '经期' && r.start < t + D.DAY
      && Math.min(r.end || Infinity, D.dayStart(D.dayKey(now)) + D.DAY) > t);
    const special = D.CATEGORIES.body.filter(category => category !== '排便').map(category => {
      const matches = events.filter(r => r.kind === 'body' && r.category === category);
      return { category, symbol: D.categoryLabel(category), count: matches.length,
        mine: matches.some(r => r.owner === uid), theirs: matches.some(r => r.owner !== uid) };
    }).filter(item => item.count);
    cells.push({ date: key, day: Number(key.slice(8)), active: true, outside: key.slice(0, 7) !== date.slice(0, 7),
      selected: key === date, today: key === D.dayKey(now), weekend: cells.length % 7 >= 5,
      mine: events.some(r => r.owner === uid), theirs: events.some(r => r.owner !== uid),
      period: periods.length > 0,
      periodMine: periods.some(r => r.owner === uid), periodTheirs: periods.some(r => r.owner === partnerId),
      special, count: events.length, more: Math.max(0, events.length - 2),
      previews: events.slice(0, 2).map(r => ({ id: r._id, title: D.displayTitle(r), kind: r.kind, partner: r.owner !== uid })) });
  }
  const agenda = D.layout(visible, date).sort((a, b) => a.start - b.start).map(r => ({ ...r,
    title: D.displayTitle(r), private: r.visibility === 'private', own: r.owner === uid,
    timeLabel: (r.start < selected ? '跨日 · ' : '') + D.clock(r.start) + (r.end ? ' – ' + (r.end >= selected + D.DAY ? D.dayKey(r.end) + ' ' : '') + D.clock(r.end) : ''),
    photoCount: (r.photos || []).length }));
  return { cells, agenda, count: agenda.length, study: combinedStats(visible, selected, selected + D.DAY).label,
    photoCount: agenda.reduce((n, r) => n + r.photoCount, 0) };
}
module.exports = { monthRange, buildCalendar, combinedStats };
