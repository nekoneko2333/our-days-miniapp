const automator = require('miniprogram-automator'); const fs = require('fs');
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  try {
    const report = await mini.evaluate(async () => {
      const checks = [], env = 'cloud1-d3grl99hge18bca2a'; let recordId = null;
      const call = async (action, args) => { const r = await wx.cloud.callFunction({ name: 'couple', config: { env }, data: Object.assign({ action }, args || {}) }); if (!r.result || !r.result.ok) throw new Error(r.result && r.result.message || 'Unexpected response'); return r.result.data; };
      try {
        const user = await call('bootstrap'); if (!user.me || !user.me.id) throw new Error('Missing identity'); checks.push('Real WeChat identity');
        for (const collection of ['users', 'spaces', 'invites', 'records', 'garbage', 'weather_cache']) {
          let denied = false;
          try { await wx.cloud.database({ env }).collection(collection).limit(1).get(); } catch (e) { if (/permission|权限|-502003/i.test(e.message || e.errMsg || '')) denied = true; else throw e; }
          if (!denied) throw new Error('Client read is not denied for ' + collection); checks.push('Denied client read: ' + collection);
        }
        const now = Date.now(), clientId = 'smoke_' + now, record = { kind: 'activity', category: '其他', title: '联调验证（自动删除）', start: now - 120000, end: now - 60000, visibility: 'private', photos: [], note: 'Automated cloud check', segments: [] };
        const saved = await call('save', { id: clientId, requestId: clientId, version: 0, record }); recordId = saved.id; checks.push('Save record');
        const date = new Date(now + 8 * 3600000).toISOString().slice(0, 10), next = new Date(now + 8 * 3600000 + 86400000).toISOString().slice(0, 10);
        const rows = await call('list', { from: date, to: next }); if (!rows.some(r => r._id === recordId && r.title === record.title)) throw new Error('Saved record not returned'); checks.push('Read own record');
        await call('save', { id: clientId, requestId: clientId, version: 0, record }); checks.push('Idempotent network retry');
        await call('remove', { id: recordId }); recordId = null; checks.push('Delete test record');
        return { ok: true, checks };
      } catch (e) { return { ok: false, checks, error: e.message || e.errMsg, cleanupRequired: !!recordId }; }
      finally { if (recordId) { try { await call('remove', { id: recordId }); } catch (_) { /* report requests cleanup */ } } }
    });
    fs.mkdirSync('output', { recursive: true }); fs.writeFileSync('output/cloud-smoke.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); if (!report.ok) process.exitCode = 1;
  } finally { mini.disconnect(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
