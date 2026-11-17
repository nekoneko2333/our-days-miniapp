const D = require('./domain');
const S = require('./service');
const { eventTimes } = require('./timeline');
module.exports = {
  data: { merchant: '', merchants: [], periodDays: 5, timeHint: '', kind: 'activity', category: '', categories: [], title: '', note: '', startDate: '', startTime: '', endDate: '', endTime: '', visibility: 'shared', photos: [], flow: '未填写', flows: ['未填写', '少', '中', '多'], flowIndex: 0, hasEnd: true, periodEnded: false, isPeriod: false, busy: false, readOnly: false, editing: false, error: '', pausedRecord: false, effectiveDuration: '', mode: S.mode() },
  onLoad(options) {
    const old = Object.prototype.hasOwnProperty.call(options, 'record') ? options.record : getApp().editingRecord; this.original = old; this.timesTouched = false; this.clientId = old ? old.clientId : S.id(); this.requestId = S.id();
    const kind = old ? old.kind : options.kind || 'activity';
    const categories = D.CATEGORIES[kind] || D.CATEGORIES.activity;
    this.draftDate = options.date;
    const defaults = eventTimes(kind, old ? old.category : categories[0], options.date);
    const start = old ? old.start : defaults.start;
    const end = old && old.end ? old.end : defaults.end;
    this.setData({ merchant: old ? old.merchant || '' : '', merchants: S.getMerchants(), periodDays: old ? old.periodDays || 5 : 5, timeHint: old ? '' : defaults.hint, busy: false, error: '', mode: S.mode(), kind, categories: categories.map(value => ({ value, label: D.categoryLabel(value) })), category: old ? D.normalizeCategory(old.category) : categories[0], title: old && old.title !== old.category && old.title !== D.categoryLabel(old.category) ? old.title : '', note: old ? old.note : '', startDate: D.dayKey(start), startTime: D.clock(start), endDate: D.dayKey(end), endTime: D.clock(end), visibility: old ? old.visibility : 'shared', photos: old ? old.photos.map(file => ({ file, url: (options.photoUrls || getApp().editingPhotos || {})[file] || '', status: 'saved' })) : [], flow: old ? old.flow : '未填写', flowIndex: old ? Math.max(0, this.data.flows.indexOf(old.flow)) : 0, editing: !!old, readOnly: !!old && old.owner !== S.uid(), periodEnded: !!old && !!old.end, pausedRecord: !!old && !!old.segments.length, effectiveDuration: old && old.segments.length ? D.durationLabel(D.unionDuration(old.segments)) : '' });
    this.updateKind();
    this.initialTimes = { startDate: this.data.startDate, startTime: this.data.startTime, endDate: this.data.endDate, endTime: this.data.endTime };
    if (!this.triggerEvent) wx.setNavigationBarTitle({ title: this.data.readOnly ? '对方记录' : old ? '编辑记录' : '新增记录' });
  },
  finishEditing(saved, record, deletedId) { if (this.triggerEvent) { this.triggerEvent('close', { saved: !!saved, record: record || null, deletedId: deletedId || '' }); return Promise.resolve(); } return wx.navigateBack(); },
  closeEditor() { if (!this.data.busy) this.finishEditing(false); },
  useNow() {
    if (this.data.readOnly || this.data.busy) return;
    this.timesTouched = true;
    const start = Math.floor(Date.now() / 60000) * 60000;
    const duration = D.timestamp(this.data.endDate, this.data.endTime) - D.timestamp(this.data.startDate, this.data.startTime);
    const end = start + Math.max(60000, duration);
    this.setData({ startDate: D.dayKey(start), startTime: D.clock(start), endDate: D.dayKey(end), endTime: D.clock(end) }); this.requestId = S.id();
  },
  updateKind() { const isPeriod = this.data.kind === 'body' && this.data.category === '经期'; this.setData({ categoryLabel: D.categoryLabel(this.data.category), isPeriod, hasEnd: ['study','activity','sleep'].includes(this.data.kind) || isPeriod && this.data.periodEnded }); },
  field(e) { if (this.data.readOnly) return; if (/^(start|end)/.test(e.currentTarget.dataset.field)) this.timesTouched = true; this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); this.requestId = S.id(); },
  categoryTap(e) {
    if (this.data.readOnly) return;
    const category = e.currentTarget.dataset.category, old = this.data.category;
    const title = this.data.title === old || this.data.title === D.categoryLabel(old) ? '' : this.data.title;
    this.setData({ category, title });
    if (!this.original && this.data.kind === 'sleep' && !this.timesTouched) {
      const v = eventTimes('sleep', category, this.draftDate);
      this.setData({ startDate: D.dayKey(v.start), startTime: D.clock(v.start), endDate: D.dayKey(v.end), endTime: D.clock(v.end), timeHint: v.hint });
    }
    this.requestId = S.id(); this.updateKind();
  },
  merchantTap(e) { if (!this.data.readOnly) { this.setData({ merchant: e.currentTarget.dataset.merchant }); this.requestId = S.id(); } },
  rememberMerchant() { if (this.data.readOnly) return; try { S.rememberMerchant(this.data.merchant); this.setData({ merchants: S.getMerchants() }); } catch(e) { this.setData({ error: e.message }); } },
  forgetMerchant(e) { if (this.data.readOnly) return; S.forgetMerchant(e.currentTarget.dataset.merchant); this.setData({ merchants: S.getMerchants() }); },
  visible(e) { if (this.data.readOnly) return; this.setData({ visibility: e.currentTarget.dataset.value }); this.requestId = S.id(); },
  periodSwitch(e) { this.setData({ periodEnded: e.detail.value }); this.requestId = S.id(); this.updateKind(); },
  flowTap(e) { if(this.data.readOnly || this.data.busy)return; const flow=e.currentTarget.dataset.flow;this.setData({flow,flowIndex:this.data.flows.indexOf(flow)});this.requestId=S.id(); },
  flowChange(e) { this.setData({ flowIndex: Number(e.detail.value), flow: this.data.flows[Number(e.detail.value)] }); this.requestId = S.id(); },
  async choosePhotos() {
    if (this.data.busy || this.data.readOnly) return;
    try {
      const result = await wx.chooseMedia({ count: 6 - this.data.photos.length, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'] });
      this.setData({ photos: this.data.photos.concat(result.tempFiles.map(p => ({ file: '', url: p.tempFilePath, status: 'pending' }))) }); this.requestId = S.id();
    } catch (e) { if (!/cancel/.test(e.errMsg || '')) this.setData({ error: '无法选择照片，请检查微信权限后重试' }); }
  },
  removePhoto(e) { if (this.data.busy || this.data.readOnly) return; this.setData({ photos: this.data.photos.filter((_, i) => i !== Number(e.currentTarget.dataset.index)) }); this.requestId = S.id(); },
  preview(e) { const urls = this.data.photos.map(p => p.url).filter(Boolean); const selected = this.data.photos[e.currentTarget.dataset.index]; if (urls.length && selected.url) wx.previewImage({ urls, current: selected.url }); },
  async savePhoto(e) {
    const photo = this.data.photos[e.currentTarget.dataset.index]; if (!photo.url) return;
    try { const path = /^https?:/.test(photo.url) ? (await wx.downloadFile({ url: photo.url })).tempFilePath : photo.url; await wx.saveImageToPhotosAlbum({ filePath: path }); wx.showToast({ title: '已保存到相册' }); }
    catch (_) { wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' }); }
  },
  async save() {
    if (this.data.readOnly || this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const v = this.data;
      const startUnchanged = this.original && v.startDate === this.initialTimes.startDate && v.startTime === this.initialTimes.startTime;
      const endUnchanged = this.original && this.original.end && v.endDate === this.initialTimes.endDate && v.endTime === this.initialTimes.endTime;
      const start = startUnchanged ? this.original.start : D.timestamp(v.startDate, v.startTime);
      const end = v.hasEnd ? endUnchanged ? this.original.end : D.timestamp(v.endDate, v.endTime) : null;
      let segments = this.original ? this.original.segments : [];
      if (segments.length && (start !== this.original.start || end !== this.original.end)) {
        const r = await wx.showModal({ title: '改为手动学习时段？', content: '修改起止时间后，这条记录会按新的完整时段计算，不再沿用暂停分段。' }); if (!r.confirm) return; segments = [];
      }
      const record = { merchant: v.merchant, periodDays: v.periodDays, kind: v.kind, category: v.category, title: v.title || D.categoryLabel(v.category), note: v.note, start, end, segments, visibility: v.visibility, flow: v.flow, photos: [] };
      D.validateRecord(record);
      const photos = v.photos.slice();
      for (let i = 0; i < photos.length; i++) {
        if (!photos[i].file) {
          try { photos[i].file = await S.upload(photos[i].url, this.clientId); photos[i].status = 'saved'; }
          catch (e) { photos[i].status = 'failed'; this.setData({ photos }); throw new Error('第' + (i + 1) + '张照片上传失败，点击保存重试，已上传照片会保留'); }
          this.setData({ photos });
        }
      }
      record.photos = photos.map(p => p.file);
      const result = await S.save(record, this.clientId, this.original ? this.original.version : 0, this.requestId);
      if (v.kind === 'meal' && v.merchant.trim()) { try { S.rememberMerchant(v.merchant); } catch (_) {} }
      const saved = Object.assign({}, D.validateRecord(record), { _id: result.id, clientId: this.clientId, owner: S.uid(), version: this.original ? this.original.version + 1 : 1 });
      wx.showToast({ title: '已保存', icon: 'none', duration: 900 }); await this.finishEditing(true, saved);
    } catch (e) { this.setData({ error: e.message || e.errMsg || '保存失败，请重试' }); }
    finally { this.setData({ busy: false }); }
  },
  async remove() {
    if (!this.original || this.data.readOnly || this.data.busy) return;
    const res = await wx.showModal({ title: '删除这条记录？', content: '记录和对应照片将被删除，无法恢复。' }); if (!res.confirm) return;
    this.setData({ busy: true });
    try { const result = await S.remove(this.original); if (result.cleanupPending) await wx.showModal({ title: '记录已删除', content: '部分照片待清理，请在「我的」中点击重试清理已删除照片。', showCancel: false }); await this.finishEditing(true, null, this.original._id); }
    catch (e) { this.setData({ error: e.message || '删除失败' }); } finally { this.setData({ busy: false }); }
  }
};
