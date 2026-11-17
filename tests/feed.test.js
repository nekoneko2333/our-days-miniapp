const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../miniprogram/utils/domain');
const { buildFeed } = require('../miniprogram/utils/feed');
const options = { date: '2026-09-13', uid: 'me', partnerId: 'partner' };
const record = (id, owner, visibility, start, end = null, extra = {}) => ({ _id: id, owner, visibility, kind: 'activity', category: '阅读', title: '阅读', note: '', start: Date.parse(start + '+08:00'), end: end && Date.parse(end + '+08:00'), photos: [], ...extra });
const records = [
  record('mine', 'me', 'private', '2026-09-13T10:00:00', '2026-09-13T11:00:00', { note: '章节 ABC' }),
  record('shared', 'partner', 'shared', '2026-09-14T12:00:00'),
  record('secret', 'partner', 'private', '2026-09-14T13:00:00'),
  record('stranger', 'stranger', 'shared', '2026-09-14T14:00:00'),
  record('cross', 'me', 'private', '2026-08-31T23:00:00', '2026-09-01T01:00:00'),
  record('end-boundary', 'me', 'private', '2026-08-31T23:00:00', '2026-09-01T00:00:00')
];
test('Monthly feed enforces permissions, descending order and cross-month overlap', () => {
  const feed = buildFeed(records, options);
  assert.equal(feed.count, 3);
  assert.deepEqual(feed.groups.map(g => g.date), ['2026-09-14', '2026-09-13', '2026-09-01']);
  assert.equal(feed.groups[2].records[0].continued, true);
  assert.equal(feed.groups[2].records[0].duration, '1小时');
  assert.equal(records[0].continued, undefined);
});
test('Feed combines member, type and case-insensitive text filters, including no partner', () => {
  assert.equal(buildFeed(records, { ...options, owner: 'me', query: ' abc ' }).count, 1);
  assert.equal(buildFeed(records, { ...options, owner: 'partner' }).count, 1);
  assert.equal(buildFeed(records, { ...options, kind: 'meal' }).count, 0);
  assert.equal(buildFeed(records, { ...options, owner: 'partner', partnerId: null }).count, 0);
  assert.equal(buildFeed(records, { ...options, date: '2026-10-01' }).count, 0);
});
