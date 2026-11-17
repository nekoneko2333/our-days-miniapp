const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');
const D = require('./domain');
const notificationDefaults = require('./notification.json');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const cmd = db.command;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
async function get(store, collection, id) {
  try { const result = await store.collection(collection).doc(id).get(); return result.data || null; }
  catch (e) { if (/document.*(not exist|not found)|does not exist|DATABASE_DOCUMENT_NOT_EXIST/i.test(e.message || '')) return null; throw e; }
}
async function ensureUser(uid) {
  return db.runTransaction(async tx => {
    const found = await get(tx, 'users', uid);
    if (found) return found;
    const user = { name: '我', city: D.CITIES[0], status: '', avatar: '', spaceId: '', createdAt: Date.now() };
    await tx.collection('users').doc(uid).set({ data: user }); return Object.assign({ _id: uid }, user);
  });
}
async function partnerOf(user, uid) {
  if (!user.spaceId) return null;
  const space = await get(db, 'spaces', user.spaceId);
  if (!space || !space.members.includes(uid)) return null;
  const other = space.members.find(id => id !== uid);
  if (!other) return null;
  const partner = await get(db, 'users', other);
  return partner && partner.spaceId === user.spaceId ? partner : null;
}
async function listOwn(owner, from, to) {
  let result = [], offset = 0;
  // Start dates are indexed; maximum record duration is 31 days.
  while (true) {
    const page = await db.collection('records').where({ owner, start: cmd.gte(from - 31 * D.DAY).and(cmd.lt(to)) }).orderBy('start', 'asc').skip(offset).limit(100).get();
    result = result.concat(page.data.filter(r => D.overlaps(r, from, to)));
    if (page.data.length < 100) return result;
    offset += page.data.length;
    if (offset > 20000) fail('记录过多，请缩小日期范围');
  }
}
async function openPeriods(owner, to) {
  let result=[],offset=0;
  while(true) {
    const page=await db.collection('records').where({owner,kind:'body',category:'经期',end:null}).orderBy('start','asc').skip(offset).limit(100).get();
    result=result.concat(page.data.filter(r=>r.start<to));
    if(page.data.length<100)return result;
    offset+=page.data.length;if(offset>20000)fail('记录过多，请缩小日期范围');
  }
}
function validFile(file, uid) {
  const env = cloud.getWXContext().ENV || process.env.TCB_ENV || '';
  return typeof file === 'string' && file.startsWith('cloud://' + env + '.') && file.includes('/couple/' + uid + '/') && !file.includes('..');
}
async function urls(files) {
  if (!files.length) return {};
  const result = await cloud.getTempFileURL({ fileList: files.map(fileID => ({ fileID, maxAge: 600 })) });
  const map = {}; result.fileList.forEach(f => { if (f.tempFileURL) map[f.fileID] = f.tempFileURL; }); return map;
}
async function profileView(user) {
  if (!user) return null;
  const result = { id: user._id, name: user.name, city: user.city, status: user.status, avatar: user.avatar || '' };
  if (result.avatar) result.avatarUrl = (await urls([result.avatar]))[result.avatar] || '';
  return result;
}
async function deleteFiles(files) {
  if (!files.length) return;
  const result = await cloud.deleteFile({ fileList: files });
  if (result.fileList.some(f => f.status !== 0 && !/not exist|not found/i.test(f.errMsg || ''))) fail('部分照片未能删除，请重试');
}
async function cleanup(uid) {
  const result = await db.collection('garbage').where({ owner: uid }).limit(50).get();
  for (const item of result.data) {
    await deleteFiles(item.files);
    await db.collection('garbage').doc(item._id).remove();
  }
}
async function removeRecord(uid, id) {
  await db.runTransaction(async tx => {
    const r = await get(tx, 'records', id);
    if (!r) return;
    if (!D.canWrite(r, uid)) fail('不能修改对方记录');
    if (r.photos.length) await tx.collection('garbage').doc(id).set({ data: { owner: uid, files: r.photos } });
    await tx.collection('records').doc(id).remove();
  });
  try { await cleanup(uid); return { cleanupPending: false }; } catch (_) { return { cleanupPending: true }; }
}
function weatherRequest(host, location, key) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: host, path: '/v7/weather/now?location=' + encodeURIComponent(location), headers: { 'X-QW-Api-Key': key, 'Accept-Encoding': 'identity' }, timeout: 8000 }, res => {
      let body = ''; res.on('data', b => { body += b; if (body.length > 100000) req.destroy(new Error('天气响应异常')); });
      res.on('end', () => { try { const value = JSON.parse(body); if (res.statusCode !== 200 || value.code !== '200') reject(new Error('天气服务暂不可用')); else resolve(value); } catch (_) { reject(new Error('天气响应异常')); } });
    }); req.on('timeout', () => req.destroy(new Error('天气请求超时'))); req.on('error', reject);
  });
}
function notificationConfig() {
  const templateId=process.env.WECHAT_NOTIFY_TEMPLATE_ID ?? notificationDefaults.templateId;
  let fields; try { fields=process.env.WECHAT_NOTIFY_FIELDS ? JSON.parse(process.env.WECHAT_NOTIFY_FIELDS) : notificationDefaults.fields; } catch (_) { fields={}; }
  if(!fields || typeof fields!=='object' || Array.isArray(fields))fields={};
  const allowed=['type','count','actor','summary','time'];
  const configured=!!templateId && Object.keys(fields).length>0 && Object.entries(fields).every(([k,v])=>/^(thing|time|phrase|name|character_string)\d+$/.test(k)&&allowed.includes(v));
  return {templateId:configured?templateId:'',fields};
}
async function notifyPartner(uid, recordId, type, comment) {
  try {
    const config=notificationConfig(); if(!config.templateId)return {status:'unconfigured'};
    const user=await get(db,'users',uid), partner=await partnerOf(user,uid), record=await get(db,'records',recordId);
    if(!partner||!record||record.visibility!=='shared'||![uid,partner._id].includes(record.owner))return {status:'skipped'};
    const now=Date.now();
    const values={type:type==='comment'?(comment&&comment.replyTo?'评论回复':'新评论'):'新事件',count:'1',actor:user.name||'对方',summary:type==='comment'?(comment&&comment.text||'对方留下了一条评论'):(record.title||record.category||'对方新增了一条共享记录'),time:D.dayKey(now)+' '+D.clock(now)};
    const data={}; Object.entries(config.fields).forEach(([key,value])=>{const max=key.startsWith('phrase')?5:key.startsWith('name')?10:20;data[key]={value:Array.from(values[value]).slice(0,max).join('')};});
    const result=await cloud.openapi.subscribeMessage.send({touser:partner._id,templateId:config.templateId,page:'pages/index/index?date='+D.dayKey(record.start),data,miniprogramState:process.env.WECHAT_NOTIFY_STATE||notificationDefaults.state});
    return {status:result.errCode?'failed':'sent'};
  }catch(e){console.warn('Notification failed:',e.errCode||'unknown');return {status:'failed'};}
}
exports.main = async event => {
  try {
    const uid = cloud.getWXContext().OPENID;
    if (!uid) fail('请从微信小程序登录');
    const action = event.action;
    const user = await ensureUser(uid);
    const partner = await partnerOf(user, uid);
    if (action === 'bootstrap') return { ok: true, data: { me: await profileView(user), partner: await profileView(partner), paired: !!partner, notification: {templateId:notificationConfig().templateId} } };
    if (action === 'profile') {
      const name = String(event.name || '').trim(), status = String(event.status || '').trim();
      const city = D.CITIES.find(c => c.location === (event.city || {}).location);
      if (!name || name.length > 16 || status.length > 30 || !city) fail('请检查昵称、城市和状态');
      const avatar = event.avatar || '';
      if (avatar && !validFile(avatar, uid)) fail('头像文件不属于当前账号');
      await db.runTransaction(async tx => {
        const current = await get(tx, 'users', uid);
        if (current.avatar && current.avatar !== avatar) await tx.collection('garbage').doc('avatar-' + uid).set({ data: { owner: uid, files: [current.avatar] } });
        await tx.collection('users').doc(uid).update({ data: { name, status, city, avatar } });
      });
      return { ok: true, data: {} };
    }
    if (action === 'list') {
      const from = D.dayStart(event.from), to = D.dayStart(event.to);
      if (to <= from || to - from > 32 * D.DAY) fail('每次最多查询32天');
      const own = await listOwn(uid, from, to);
      const other = partner ? (await listOwn(partner._id, from, to)).filter(r => D.canRead(r, uid, partner._id)) : [];
      let records = own.concat(other);
      if(event.includeOpenPeriods) {
        const active=await openPeriods(uid,to);
        const shared=partner?(await openPeriods(partner._id,to)).filter(r=>D.canRead(r,uid,partner._id)):[];
        records=Array.from(new Map(records.concat(active,shared).map(r=>[r._id,r])).values());
      }
      return { ok: true, data: records.map(r => Object.assign({}, r, { mine: r.owner === uid })) };
    }
    if (action === 'photoUrls') {
      const ids = event.ids;
      if (!Array.isArray(ids) || ids.length > 30) fail('图片请求过多');
      let files = [];
      for (const id of ids) {
        const r = await get(db, 'records', String(id));
        if (r && D.canRead(r, uid, partner && partner._id)) files = files.concat(r.photos);
      }
      return { ok: true, data: await urls([...new Set(files)]) };
    }
    if (action === 'comment') {
      const text=String(event.text||'').trim(), requestId=String(event.requestId||'');
      if(!text||Array.from(text).length>40)fail('评论请输入1至40字');
      if(!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))fail('评论标识无效');
      const id=String(event.id||''), replyTo=String(event.replyTo||'');
      const result=await db.runTransaction(async tx=>{
        const current=await get(tx,'users',uid), record=await get(tx,'records',id);
        let other=null;
        if(current.spaceId){const space=await get(tx,'spaces',current.spaceId);if(space&&space.members.includes(uid)){const oid=space.members.find(x=>x!==uid);const p=oid&&await get(tx,'users',oid);if(p&&p.spaceId===current.spaceId)other=oid;}}
        if(!record||!D.canRead(record,uid,other))fail('记录不存在或不可评论');
        const comments=record.comments||[], cid=hash(uid+':'+requestId);
        if(comments.some(c=>c.id===cid))return {comments,added:false};
        if(comments.length>=100)fail('这条记录已有100条评论');
        const parent=replyTo?comments.find(c=>c.id===replyTo):null;
        if(replyTo&&!parent)fail('回复的评论不存在');
        comments.push({id:cid,author:uid,text,replyTo:parent?parent.id:'',replyAuthor:parent?parent.author:'',createdAt:Date.now()});
        await tx.collection('records').doc(id).update({data:{comments}});
        return {comments,added:true};
      });
      const notification=result.added?await notifyPartner(uid,id,'comment',result.comments[result.comments.length-1]):{status:'duplicate'};
      return {ok:true,data:{comments:result.comments,notification}};
    }
    if (action === 'save') {
      if (!/^[a-zA-Z0-9_-]{8,80}$/.test(event.id || '')) fail('记录标识无效');
      const record = D.validateRecord(event.record || {});
      if (record.photos.some(f => !validFile(f, uid))) fail('照片文件不属于当前账号');
      const id = hash(uid + ':' + event.id);
      const created = await db.runTransaction(async tx => {
        const old = await get(tx, 'records', id);
        if (old && !D.canWrite(old, uid)) fail('不能修改对方记录');
        if (old && event.requestId && old.requestId === event.requestId) return false;
        if (old && Number(event.version) !== old.version) fail('记录已在另一设备更新，请返回刷新后再编辑');
        const removed = old ? old.photos.filter(f => !record.photos.includes(f)) : [];
        if (removed.length) await tx.collection('garbage').doc(id + '-' + Date.now()).set({ data: { owner: uid, files: removed } });
        await tx.collection('records').doc(id).set({ data: Object.assign(record, { comments: old ? old.comments || [] : [], owner: uid, clientId: event.id, requestId: String(event.requestId || '').slice(0, 100), version: old ? old.version + 1 : 1, createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now() }) });
        return !old;
      });
      const notification=created?await notifyPartner(uid,id,'record'):{status:'skipped'};
      return { ok: true, data: { id, notification } };
    }
    if (action === 'remove') return { ok: true, data: await removeRecord(uid, String(event.id)) };
    if (action === 'cleanup') { await cleanup(uid); return { ok: true, data: {} }; }
    if (action === 'invite') {
      const code = crypto.randomBytes(16).toString('hex').toUpperCase();
      await db.runTransaction(async tx => {
        const current = await get(tx, 'users', uid);
        if (current.spaceId) fail('已在双人空间中，请先解除绑定');
        await tx.collection('invites').doc(uid).set({ data: { codeHash: hash(code), expiresAt: Date.now() + D.DAY, owner: uid } });
      });
      // Owner id is opaque to users, hash code is stored; share only the full invitation token.
      return { ok: true, data: { code: uid + '.' + code, expiresAt: Date.now() + D.DAY } };
    }
    if (action === 'join') {
      const token = String(event.code || '').trim(), dot = token.lastIndexOf('.');
      if (dot < 1 || token.length > 200) fail('邀请口令格式不正确');
      const owner = token.slice(0, dot), code = token.slice(dot + 1);
      if (owner === uid) fail('请让对方输入这份邀请口令');
      const sid = hash([owner, uid].sort().join(':') + ':' + code);
      await db.runTransaction(async tx => {
        const invite = await get(tx, 'invites', owner);
        const a = await get(tx, 'users', owner), b = await get(tx, 'users', uid);
        if (!invite || invite.codeHash !== hash(code) || invite.expiresAt < Date.now()) fail('邀请已失效，请重新生成');
        if (!a || !b || a.spaceId || b.spaceId) fail('其中一人已经绑定');
        await tx.collection('spaces').doc(sid).set({ data: { members: [owner, uid], createdAt: Date.now() } });
        await tx.collection('users').doc(owner).update({ data: { spaceId: sid } });
        await tx.collection('users').doc(uid).update({ data: { spaceId: sid } });
        await tx.collection('invites').doc(owner).remove();
      });
      return { ok: true, data: {} };
    }
    if (action === 'unlink') {
      await db.runTransaction(async tx => {
        const current = await get(tx, 'users', uid);
        if (!current.spaceId) return;
        const space = await get(tx, 'spaces', current.spaceId);
        if (space && space.members.includes(uid)) {
          for (const id of space.members) {
            const p = await get(tx, 'users', id);
            if (p && p.spaceId === current.spaceId) await tx.collection('users').doc(id).update({ data: { spaceId: '' } });
          }
          await tx.collection('spaces').doc(current.spaceId).remove();
        } else await tx.collection('users').doc(uid).update({ data: { spaceId: '' } });
      });
      return { ok: true, data: {} };
    }
    if (action === 'weather') {
      const host = process.env.QWEATHER_HOST, key = process.env.QWEATHER_KEY;
      if (!host || !key || !/^[a-z0-9-]+\.qweatherapi\.com$/.test(host)) return { ok: true, data: { configured: false, items: {} } };
      const items = {};
      for (const p of [user, partner].filter(Boolean)) {
        const location = p.city.location;
        const cache = await get(db, 'weather_cache', location);
        if (cache && Date.now() - cache.fetchedAt < 30 * 60000) { items[location] = cache; continue; }
        try {
          const response = await weatherRequest(host, location, key);
          const data = { text: response.now.text, temp: response.now.temp, observedAt: response.now.obsTime, fetchedAt: Date.now(), link: response.fxLink || 'https://www.qweather.com' };
          await db.collection('weather_cache').doc(location).set({ data }); items[location] = data;
        } catch (_) { items[location] = cache ? Object.assign({}, cache, { stale: true }) : { error: true }; }
      }
      return { ok: true, data: { configured: true, items } };
    }
    fail('未知操作');
  } catch (error) {
    console.error('couple request failed:', error.message);
    const message = String(error.message || '云端操作失败');
    return { ok: false, message: /collection.*(not exist|not found)|DATABASE_COLLECTION_NOT_EXIST/i.test(message) ? '请先按部署说明创建数据库集合' : message.slice(0, 180) };
  }
};
