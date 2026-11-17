const D = require('./domain');
function buildFeed(records, options) {
  const { date, uid, partnerId, owner = 'all', kind = 'all', query = '' } = options;
  const from = D.dayStart(date.slice(0, 7) + '-01');
  const to = D.dayStart(D.dayKey(from + 32 * D.DAY).slice(0, 7) + '-01');
  const needle = query.trim().toLowerCase();
  const filtered = records.filter(r => D.canRead(r, uid, partnerId) && D.overlaps(r, from, to)
    && (owner === 'all' || (owner === 'me' ? r.owner === uid : r.owner === partnerId))
    && (kind === 'all' || r.kind === kind)
    && (!needle || [r.title, r.category, r.note, r.merchant].join(' ').toLowerCase().includes(needle)))
    .slice().sort((a, b) => b.start - a.start || String(a._id).localeCompare(String(b._id)));
  const groups = [];
  filtered.forEach(r => {
    const day = D.dayKey(Math.max(from, r.start));
    let group = groups[groups.length - 1];
    if (!group || group.date !== day) { group = { date: day, records: [] }; groups.push(group); }
    group.records.push(Object.assign({}, r, { title: D.displayTitle(r), private: r.visibility === 'private',
      timeLabel: D.clock(r.start) + (r.end ? ' – ' + (D.dayKey(r.end) !== D.dayKey(r.start) ? D.dayKey(r.end) + ' ' : '') + D.clock(r.end) : ''),
      continued: r.start < from, duration: r.end ? D.durationLabel(D.unionDuration(D.intervals(r, from, to))) : '' }));
  });
  return { groups, count: filtered.length };
}
module.exports = { buildFeed };
