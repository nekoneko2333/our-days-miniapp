const automator = require('miniprogram-automator'); const fs = require('fs');
(async () => { const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }); try {
  const report = await mini.evaluate(async () => {
    const env = 'cloud1-d3grl99hge18bca2a', checks = []; let recordId = null, fileID = null;
    const call = async (action, args) => { const r = await wx.cloud.callFunction({ name: 'couple', config: { env }, data: Object.assign({ action }, args || {}) }); if (!r.result || !r.result.ok) throw new Error(r.result && r.result.message || 'Unexpected response'); return r.result.data; };
    try {
      const user = await call('bootstrap'); const now = Date.now(), id = 'photo_smoke_' + now;
      const local = wx.env.USER_DATA_PATH + '/cloud-smoke-pixel.png';
      wx.getFileSystemManager().writeFileSync(local, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOsAAAAASUVORK5CYII=', 'base64');
      fileID = (await wx.cloud.uploadFile({ config: { env }, cloudPath: 'couple/' + user.me.id + '/' + id + '/pixel.png', filePath: local })).fileID; checks.push('Upload owned photo');
      const record = { kind: 'meal', category: '零食', title: '照片联调验证（自动删除）', start: now, end: null, visibility: 'private', photos: [fileID], note: '' };
      recordId = (await call('save', { id, requestId: id, version: 0, record })).id; checks.push('Save photo ownership validation');
      const links = await call('photoUrls', { ids: [recordId] }); if (!links[fileID]) throw new Error('Missing photo URL'); checks.push('Authorized temporary photo URL');
      await wx.cloud.downloadFile({ config: { env }, fileID }); checks.push('Download photo');
      await call('remove', { id: recordId }); recordId = null;
      let deleted = false; try { await wx.cloud.downloadFile({ config: { env }, fileID }); } catch (_) { deleted = true; } if (!deleted) throw new Error('Photo still exists after delete');
      fileID = null; checks.push('Delete record and photo'); return { ok: true, checks };
    } catch (e) { return { ok: false, checks, error: e.message || e.errMsg }; }
    finally { if (recordId) { try { await call('remove', { id: recordId }); } catch (_) {} } if (fileID) { try { await wx.cloud.deleteFile({ fileList: [fileID], config: { env } }); } catch (_) {} } }
  }); fs.writeFileSync('output/cloud-photo-smoke.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); if (!report.ok) process.exitCode = 1;
} finally { mini.disconnect(); } })().catch(e => { console.error(e); process.exitCode = 1; });
