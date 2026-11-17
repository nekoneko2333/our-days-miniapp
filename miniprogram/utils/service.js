const D = require('./domain');
const ENV = 'cloud1-d3grl99hge18bca2a';
let session = null;
const mode = () => {
  const saved=wx.getStorageSync('ourdays-mode'); if(saved) return saved;
  const version=wx.getAccountInfoSync && wx.getAccountInfoSync().miniProgram.envVersion;
  return version==='trial' || version==='release' ? 'cloud' : 'demo';
};
const uid = () => session && session.me ? session.me.id : 'demo-me';
const id = () => 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
function demo() {
  let data = wx.getStorageSync('ourdays-demo-v1');
  if (!data) {
    const today = D.dayKey(Date.now());
    const make = (owner, kind, category, start, end) => { const key = id(); return { _id: key, clientId: key, owner, kind, category, title: category, start: D.timestamp(today, start), end: end ? D.timestamp(today, end) : null, note: '', photos: [], visibility: 'shared', segments: [], flow: '未填写', version: 1 }; };
    data = { me: { id: 'demo-me', name: '我', city: D.CITIES[0], status: '', avatar: '' }, partner: { id: 'demo-partner', name: '他', city: D.CITIES[1], status: '学习中', avatar: '' }, records: [
      make('demo-me', 'meal', '早餐', '08:30'), make('demo-me', 'activity', '阅读', '09:00', '10:30'), make('demo-me', 'meal', '午餐', '12:10'), make('demo-me', 'activity', '散步', '14:00', '15:00'),
      make('demo-partner', 'study', '数学一', '08:00', '10:00'), make('demo-partner', 'study', '数据结构', '10:15', '11:45'), make('demo-partner', 'meal', '午餐', '12:10'), make('demo-partner', 'study', '英语一', '13:00', '15:00')
    ] }; wx.setStorageSync('ourdays-demo-v1', data);
  } return data;
}
async function call(action, args) {
  const res = await wx.cloud.callFunction({ name: 'couple', config: { env: ENV }, data: Object.assign({ action }, args || {}) });
  if (!res.result || !res.result.ok) throw new Error(res.result && res.result.message || '云端响应异常');
  return res.result.data;
}
async function bootstrap() { if (mode() === 'demo') { const d = demo(); session = { me: d.me, partner: d.partner, paired: !!d.partner }; } else session = await call('bootstrap'); return session; }
async function connect() { const value = await call('bootstrap'); wx.setStorageSync('ourdays-mode', 'cloud'); session = value; return value; }
function useDemo() { wx.setStorageSync('ourdays-mode', 'demo'); session = null; }
function normalizeRecord(r) { const category = D.normalizeCategory(r.category); return Object.assign({}, r, { category, title: r.title === r.category ? category : r.title }); }
async function list(from, to, includeOpenPeriods = false) { const records = mode() === 'cloud' ? await call('list', { from, to, includeOpenPeriods }) : demo().records.filter(r => (D.overlaps(r, D.dayStart(from), D.dayStart(to)) || includeOpenPeriods && r.kind === 'body' && r.category === '经期' && !r.end && r.start < D.dayStart(to)) && D.canRead(r, uid(), session && session.partner && session.partner.id)); return records.map(normalizeRecord); }
async function periodHistory(from,to) {
  const batches=[];
  for(let day=from;day<to;day=D.shiftDay(day,32)) batches.push(list(day,D.shiftDay(day,32)<to?D.shiftDay(day,32):to));
  const rows=(await Promise.all(batches)).flat().filter(r=>r.kind==='body'&&r.category==='经期');
  return Array.from(new Map(rows.map(r=>[r._id,r])).values());
}
async function save(record, clientId, version, requestId) {
  const valid = D.validateRecord(record);
  if (mode() === 'cloud') return call('save', { record: valid, id: clientId, version, requestId });
  const data = demo(), old = data.records.find(r => r.clientId === clientId);
  if (old && !D.canWrite(old, uid())) throw new Error('不能修改对方记录');
  const value = Object.assign({}, valid, { _id: old ? old._id : clientId, clientId, owner: uid(), comments:old ? old.comments || [] : [], version: old ? old.version + 1 : 1 });
  data.records = data.records.filter(r => r.clientId !== clientId).concat(value); wx.setStorageSync('ourdays-demo-v1', data); return { id: value._id };
}
async function comment(recordId, text, requestId, replyTo = '') {
  text=String(text||'').trim();if(!text||Array.from(text).length>40)throw Error('评论请输入1至40字');
  if(mode()==='cloud')return call('comment',{id:recordId,text,requestId,replyTo});
  const data=demo(),r=data.records.find(r=>r._id===recordId);
  if(!r||!D.canRead(r,uid(),session&&session.partner&&session.partner.id))throw Error('记录不存在或不可评论');
  r.comments=r.comments||[];
  if(!r.comments.some(c=>c.id===requestId)){if(r.comments.length>=100)throw Error('这条记录已有100条评论');const parent=replyTo?r.comments.find(c=>c.id===replyTo):null;if(replyTo&&!parent)throw Error('回复的评论不存在');r.comments.push({id:requestId,author:uid(),text,replyTo:parent?parent.id:'',replyAuthor:parent?parent.author:'',createdAt:Date.now()});}
  wx.setStorageSync('ourdays-demo-v1',data);return {comments:r.comments};
}
async function remove(record) { if (!D.canWrite(record, uid())) throw new Error('不能删除对方记录'); if (mode() === 'cloud') return call('remove', { id: record._id }); const data = demo(); data.records = data.records.filter(r => r._id !== record._id); wx.setStorageSync('ourdays-demo-v1', data); return {}; }
const photoCache = new Map();
async function photoUrls(records) {
  const scope = mode() + ':' + uid(), now = Date.now(), result = {}, pending = [];
  records.forEach(r => {
    let missing = false;
    (r.photos || []).forEach(p => { const cached = photoCache.get(scope + ':' + p); if (mode() === 'demo') result[p] = p; else if (cached && cached.expires > now) result[p] = cached.url; else missing = true; });
    if (missing) pending.push(r);
  });
  for (let i = 0; i < pending.length; i += 30) {
    const urls = await call('photoUrls', { ids: pending.slice(i,i+30).map(r=>r._id) });
    Object.entries(urls).forEach(([file,url]) => { photoCache.set(scope + ':' + file, { url, expires: now + 8 * 60000 }); result[file] = url; });
  }
  if (photoCache.size > 1000) for (const [key,value] of photoCache) if (value.expires <= now) photoCache.delete(key);
  return result;
}
const merchantKey = () => 'ourdays-merchants-' + mode() + '-' + uid();
function getMerchants() { const values = wx.getStorageSync(merchantKey()); return Array.isArray(values) ? values : []; }
function rememberMerchant(value) { const name = String(value || '').trim(); if (!name || name.length > 30) throw Error('请输入1至30字的商家名称'); wx.setStorageSync(merchantKey(), [name,...getMerchants().filter(s=>s!==name)].slice(0,50)); }
function forgetMerchant(name) { wx.setStorageSync(merchantKey(),getMerchants().filter(s=>s!==name)); }
async function upload(path, recordId) {
  let compressed = path;
  try { compressed = (await wx.compressImage({ src: path, quality: 70, compressedWidth: 1600 })).tempFilePath; } catch (_) { /* keep selected compressed image */ }
  if (mode() === 'demo') return (await wx.saveFile({ tempFilePath: compressed })).savedFilePath;
  return (await wx.cloud.uploadFile({ cloudPath: 'couple/' + uid() + '/' + recordId + '/' + id() + '.jpg', filePath: compressed, config: { env: ENV } })).fileID;
}
async function saveProfile(profile) { if (mode() === 'cloud') await call('profile', profile); else { const d = demo(); d.me = Object.assign({}, d.me, profile, { avatarUrl: profile.avatar }); wx.setStorageSync('ourdays-demo-v1', d); } return bootstrap(); }
async function weather() { return mode() === 'cloud' ? call('weather') : { configured: false, items: {} }; }
const timerKey = () => 'ourdays-timer-' + mode() + '-' + uid();
function getTimer() { return wx.getStorageSync(timerKey()) || null; }
function setTimer(t) { if (t) wx.setStorageSync(timerKey(), t); else wx.removeStorageSync(timerKey()); }
module.exports = { comment, periodHistory, ENV, mode, uid, id, bootstrap, connect, useDemo, list, save, remove, photoUrls, upload, saveProfile, weather, call, getTimer, setTimer, getMerchants, rememberMerchant, forgetMerchant };
