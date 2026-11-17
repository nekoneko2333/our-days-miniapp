const { test } = require('node:test'); const assert = require('node:assert/strict'); const Module = require('module');
const { AsyncLocalStorage } = require('async_hooks'); const context = new AsyncLocalStorage();
const D = require('../miniprogram/utils/domain');
const data = {}; for (const c of ['users', 'records', 'spaces', 'invites', 'garbage', 'weather_cache']) data[c] = {};
const copy = x => JSON.parse(JSON.stringify(x));
function predicate(fn) { return { test: fn, and(p) { return predicate(v => fn(v) && p.test(v)); } }; }
function database(store) { return { collection(name) { if (!store[name]) throw new Error('collection not exist'); let filters = {}, offset = 0, limit = 100, order = null; const api = {
  doc(id) { return { async get() { return { data: store[name][id] ? Object.assign({ _id: id }, copy(store[name][id])) : null }; }, async set({ data: d }) { store[name][id] = copy(d); }, async update({ data: d }) { if (!store[name][id]) throw new Error('document not exist'); Object.assign(store[name][id], copy(d)); }, async remove() { delete store[name][id]; } }; },
  where(f) { filters = f; return api; }, skip(n) { offset = n; return api; }, limit(n) { limit = n; return api; }, orderBy(key) { order = key; return api; },
  async get() { let rows = Object.entries(store[name]).map(([id, v]) => Object.assign({ _id: id }, copy(v))).filter(r => Object.entries(filters).every(([k, v]) => v && v.test ? v.test(r[k]) : r[k] === v)); if (order) rows.sort((a, b) => a[order] - b[order]); return { data: rows.slice(offset, offset + limit) }; }
}; return api; } }; }
const db = database(data); let queue = Promise.resolve();
db.command = { gte: x => predicate(v => v >= x), lt: x => predicate(v => v < x) };
db.runTransaction = fn => { const promise = queue.then(async () => { const clone = copy(data); const result = await fn(database(clone)); for (const k of Object.keys(data)) data[k] = clone[k]; return result; }); queue = promise.catch(() => {}); return promise; };
const deleted = [];
const sdk = { init() {}, DYNAMIC_CURRENT_ENV: 'env', database: () => db, getWXContext: () => ({ OPENID: context.getStore(), ENV: 'env' }), async getTempFileURL({ fileList }) { return { fileList: fileList.map(f => ({ fileID: f.fileID, tempFileURL: 'https://files.invalid/' + encodeURIComponent(f.fileID) })) }; }, async deleteFile({ fileList }) { deleted.push(...fileList); return { fileList: fileList.map(fileID => ({ fileID, status: 0 })) }; } };
const originalLoad = Module._load; Module._load = function(name, parent, isMain) { return name === 'wx-server-sdk' ? sdk : originalLoad.call(this, name, parent, isMain); };
const main = require('../cloudfunctions/couple').main; Module._load = originalLoad;
const run = (user, action, args) => context.run(user, () => main(Object.assign({ action }, args)));
const rec = visibility => ({ kind: 'meal', category: '早餐', start: D.timestamp('2026-09-12', '08:30'), end: null, visibility, photos: [] });
test('Cloud end-to-end: pairing, privacy, forged photos, idempotent saves, unlink and delete', async () => {
  for (const u of ['alice', 'bob', 'eve']) assert.equal((await run(u, 'bootstrap')).ok, true);
  const invite = await run('alice', 'invite');
  assert.equal((await run('alice', 'join', { code: invite.data.code })).ok, false);
  assert.equal((await run('bob', 'join', { code: invite.data.code })).ok, true);
  assert.equal((await run('eve', 'join', { code: invite.data.code })).ok, false);
  const one = await run('alice', 'save', { id: 'record_001', requestId: 'save1', version: 0, record: rec('private') }); assert.equal(one.ok, true);
  assert.equal((await run('alice', 'save', { id: 'record_001', requestId: 'save1', version: 0, record: rec('private') })).ok, true);
  assert.equal(Object.keys(data.records).length, 1);
  const range = { from: '2026-09-12', to: '2026-09-13' };
  assert.equal((await run('bob', 'list', range)).data.length, 0);
  const photo = 'cloud://env.bucket/couple/alice/record_001/photo.jpg';
  assert.equal((await run('bob', 'save', { id: 'record_bad', version: 0, record: Object.assign(rec('shared'), { photos: [photo] }) })).ok, false);
  assert.equal((await run('alice', 'save', { id: 'record_001', version: 1, requestId: 'save2', record: Object.assign(rec('shared'), { photos: [photo] }) })).ok, true);
  assert.equal((await run('bob', 'list', range)).data.length, 1);
  assert.equal((await run('eve', 'list', range)).data.length, 0);
  assert.equal(Object.keys((await run('eve', 'photoUrls', { ids: [one.data.id] })).data).length, 0);
  assert.equal(Object.keys((await run('bob', 'photoUrls', { ids: [one.data.id] })).data).length, 1);
  assert.equal((await run('bob', 'remove', { id: one.data.id })).ok, false);
  assert.equal((await run('alice', 'save', { id: 'record_001', version: 1, requestId: 'stale', record: rec('shared') })).ok, false);
  assert.equal((await run('bob', 'unlink')).ok, true);
  assert.equal((await run('bob', 'list', range)).data.length, 0);
  assert.equal(Object.keys((await run('bob', 'photoUrls', { ids: [one.data.id] })).data).length, 0);
  assert.equal((await run('alice', 'remove', { id: one.data.id })).ok, true);
  assert.equal(Object.keys(data.records).length, 0); assert.deepEqual(deleted, [photo]);
});
test('Concurrent invite claims never produce a three-person space', async () => {
  for (const u of ['owner2', 'guest2', 'guest3']) await run(u, 'bootstrap');
  const invitation = await run('owner2', 'invite');
  const attempts = await Promise.all([run('guest2', 'join', { code: invitation.data.code }), run('guest3', 'join', { code: invitation.data.code })]);
  assert.equal(attempts.filter(r => r.ok).length, 1);
  for (const space of Object.values(data.spaces)) assert.equal(space.members.length, 2);
});

test('Comments enforce access, length, retry identity and survive concurrent record edits; notifications respect privacy', async()=>{
 const sent=[];sdk.openapi={subscribeMessage:{send:async value=>{sent.push(value);return {};}}};
 process.env.WECHAT_NOTIFY_TEMPLATE_ID='test-template';process.env.WECHAT_NOTIFY_FIELDS=JSON.stringify({thing1:'summary',thing2:'actor',time3:'time'});
 try {
  await run('c-a','bootstrap');await run('c-b','bootstrap');await run('c-e','bootstrap');
  const invite=await run('c-a','invite');await run('c-b','join',{code:invite.data.code});
  const args={id:'comment_record',version:0,requestId:'create_req',record:rec('shared')};
  const saved=await run('c-a','save',args);assert.equal(saved.ok,true);assert.equal(sent.length,1);assert.equal(sent[0].touser,'c-b');
  await run('c-a','save',args);assert.equal(sent.length,1);
  const comment={id:saved.data.id,text:'好好吃饭 🍚',requestId:'comment_req'};
  assert.equal((await run('c-e','comment',comment)).ok,false);
  assert.equal((await run('c-b','comment',{...comment,text:'a'.repeat(41)})).ok,false);
  assert.equal((await run('c-b','comment',comment)).data.comments.length,1);assert.equal(sent.length,2);assert.equal(sent[1].touser,'c-a');
  assert.equal((await run('c-b','comment',comment)).data.comments.length,1);assert.equal(sent.length,2);
  await run('c-a','save',{...args,version:1,requestId:'edit_req',record:rec('private')});assert.equal(data.records[saved.data.id].comments.length,1);
  assert.equal((await run('c-b','comment',{...comment,requestId:'another_req'})).ok,false);
  await run('c-a','comment',{...comment,requestId:'own_private'});assert.equal(sent.length,2);
  sdk.openapi.subscribeMessage.send=async()=>{throw Error('delivery failed');};
  const failed=await run('c-a','save',{...args,id:'another_record',requestId:'another_save'});assert.equal(failed.ok,true);assert.equal(failed.data.notification.status,'failed');
  await run('c-b','unlink');assert.equal((await run('c-b','comment',comment)).ok,false);
 }finally{delete process.env.WECHAT_NOTIFY_TEMPLATE_ID;delete process.env.WECHAT_NOTIFY_FIELDS;}
});

test('Replies validate parent within the same record, derive author server-side and deduplicate',async()=>{
 const user='reply-owner';await run(user,'bootstrap');
 const record=await run(user,'save',{id:'reply_record_1',requestId:'reply_save_1',version:0,record:rec('private')});
 const other=await run(user,'save',{id:'reply_record_2',requestId:'reply_save_2',version:0,record:rec('private')});
 const first=await run(user,'comment',{id:record.data.id,text:'原评论',requestId:'reply_parent_1'});const parent=first.data.comments[0];
 assert.equal((await run(user,'comment',{id:other.data.id,text:'跨记录伪造',requestId:'reply_cross_1',replyTo:parent.id})).ok,false);
 const args={id:record.data.id,text:'这是回复',requestId:'reply_child_1',replyTo:parent.id,replyAuthor:'forged'};
 const result=await run(user,'comment',args);assert.equal(result.ok,true);assert.equal(result.data.comments[1].replyTo,parent.id);assert.equal(result.data.comments[1].replyAuthor,user);
 assert.equal((await run(user,'comment',args)).data.comments.length,2);
 const nested=await run(user,'comment',{...args,requestId:'reply_nested_1',replyTo:result.data.comments[1].id});assert.equal(nested.data.comments[2].replyTo,result.data.comments[1].id);
 await run(user,'remove',{id:record.data.id});await run(user,'remove',{id:other.data.id});
});

test('Configured chat template delivers event, comment and reply fields to the partner',async()=>{
 const sent=[];sdk.openapi={subscribeMessage:{send:async value=>{sent.push(value);return {};}}};
 const bootstrap=await run('notify-a','bootstrap');await run('notify-b','bootstrap');
 assert.equal(bootstrap.data.notification.templateId,'dM0CWBhaT0qWkoK-3jraAuRlrjwGoB4SIHSDBQXK8QU');
 const invite=await run('notify-a','invite');await run('notify-b','join',{code:invite.data.code});
 data.users['notify-a'].name='测试昵称';
 const saved=await run('notify-a','save',{id:'notify_record',requestId:'notify_save',version:0,record:{...rec('shared'),title:'一起吃早餐'}});
 assert.equal(saved.data.notification.status,'sent');
 assert.deepEqual(sent[0].data,{thing1:{value:'新事件'},thing2:{value:'1'},thing3:{value:'测试昵称'},thing5:{value:'一起吃早餐'},time6:{value:D.dayKey(Date.now())+' '+D.clock(Date.now())}});
 assert.equal(sent[0].miniprogramState,'trial');assert.equal(sent[0].page,'pages/index/index?date=2026-09-12');
 const parent=await run('notify-b','comment',{id:saved.data.id,requestId:'notify_comment',text:'好'.repeat(25)});
 assert.equal(sent[1].data.thing1.value,'新评论');assert.equal(sent[1].data.thing5.value,'好'.repeat(20));assert.equal(sent[1].touser,'notify-a');
 const reply={id:saved.data.id,requestId:'notify_reply',text:'好呀',replyTo:parent.data.comments[0].id};
 await run('notify-a','comment',reply);assert.equal(sent[2].data.thing1.value,'评论回复');assert.equal(sent[2].touser,'notify-b');
 await run('notify-a','comment',reply);assert.equal(sent.length,3);
});
