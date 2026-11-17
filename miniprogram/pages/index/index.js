const D = require('../../utils/domain');
const S = require('../../utils/service');
const { buildFeed } = require('../../utils/feed');
const { monthRange, buildCalendar } = require('../../utils/calendar');
const { scrollForTime, revealState } = require('../../utils/timeline');
const { timerClock } = require('../../utils/study-stats');
const { eventSummary, LABELS } = require('../../utils/event-stats');
const Back = require('../../utils/back-navigation');
const { presentStats } = require('../../utils/stats-presentation');
const { historyRange, periodReport } = require('../../utils/period-stats');
const icons = { meal: 'meal', activity: 'leaf', study: 'book', body: 'heart', sleep: 'moon' };
Page({
  data: {
    events: [], expandedNotes: {}, expandedComments: {}, replyTo: "", replyName: "", replyText: "", commentId: "", commentText: "", commentBusy: false, notification: {}, eventAnchor: "", periodView:false, periodStats:{groups:[]}, periodBusy:false, periodError:'', statsVisual: {}, statsSelectedDate: '', statsHeatExpanded: false, backGuard: false, bodyCategory: '经期', bodyCategories: D.CATEGORIES.body.map(value=>({value,label:D.categoryLabel(value)})),
    focusOpen: false, timerMode: 'pomodoro', focusMinutes: 25, remaining: '00:25:00', focusProgress: 0, floatX: 180, floatY: 320, heatDetail: '',
    studyOpen: false, studyCategory: '数学一', studyCategories: D.CATEGORIES.study, statsDetail: 'subjects', statsKind: 'study', statsLabel: '学习',
    calendarPanel: 'calendar', calendarAddOpen: false, searchOpen: false, calendarFiltersOpen: false, agendaExpanded: false, statsOpen: true, focusedId: '', nowTop: 0, isToday: true,
    editorRequest: null, rippleSide: '', rippleActive: false, motionSide: '',
    homeStyle: 'events', tab: 'timeline', mode: S.mode(), busy: false, error: '', date: D.dayKey(Date.now()), view: 'me', scrollTop: 0,
    me: { name: '我', city: { name: '选择城市' } }, meLabel: '我', partnerLabel: '对方', partner: null, meWeather: '天气未接入', partnerWeather: '天气未接入',
    hours: Array.from({ length: 25 }, (_, i) => ({ label: String(i).padStart(2, '0') + ':00', top: i * 104 })),
    mine: [], theirs: [], monthCells: [], subjects: [], total: '0分钟', count: 0, dateLabel: '',
    calendarMode: 'month', calendarOwner: 'all', calendarKind: 'all', dayAgenda: [], dayCount: 0, dayStudy: '0分钟', dayPhotos: 0,
    feedGroups: [], feedCount: 0, feedOwner: 'all', feedKind: 'all', feedQuery: '', feedScroll: 0,
    tabs: [{ key: 'timeline', label: '时间线', icon: 'home' }, { key: 'calendar', label: '日历', icon: 'calendar' }, { key: 'stats', label: '统计', icon: 'book' }, { key: 'us', label: '我们', icon: 'users' }],
    quick: [{ kind: 'meal', label: '饮食', icon: 'meal' }, { kind: 'activity', label: '活动', icon: 'leaf' }, { kind: 'study', label: '学习', icon: 'book' }, { kind: 'body', label: '身体', icon: 'heart' }, { kind: 'sleep', label: '睡眠', icon: 'moon' }],
    timer: null, elapsed: '', invite: '', joinCode: '', profileOpen: false, profile: {}, cities: D.CITIES.map(c => c.name), cityIndex: 0, weatherSource: '', statScope: 'week', statsOwner: 'me', studyReport: {}, statCards: [], timerSaving: false, empty: false,
    weekLabels: ['一', '二', '三', '四', '五', '六', '日'], exportYear: new Date().getFullYear()
  },
  onLoad(options = {}) { if (/^\d{4}-\d{2}-\d{2}$/.test(options.date || "")) this.setData({date:options.date,view:'split'}); this.setData({homeStyle:wx.getStorageSync('ourdays-home-style')==='axis'?'axis':'events'}); Back.install(this); this._width = wx.getSystemInfoSync().windowWidth; this._scroll = this.data.homeStyle==='axis'?scrollForTime(Date.now(),this.data.date,this._width):0; this.setData({ scrollTop: this._scroll }); },
  nativeBack() {
    if(!this.data.backGuard || this._backTransition) return;
    this._backTransition=true;
    this.setData({backGuard:false},()=>{
      Back.goBack(this);
      this.setData({},()=>{ this._backTransition=false; this.setData({backGuard:Back.canGoBack(this.data)}); });
    });
  },
  onShow() { this.refresh(); this.tick(); clearInterval(this._ticker); this._ticker = setInterval(() => this.tick(), 1000); },
  onHide() { clearInterval(this._ticker); }, onUnload() { clearInterval(this._ticker); clearTimeout(this._motionTimer); clearTimeout(this._focusTimer); },
  async refresh() {
    if (this._loading) return; this._loading = true; this._periodCache=null; this._periodRequest=(this._periodRequest||0)+1; this._periodPending=''; this.setData({ busy: true, error: '', mode: S.mode() });
    try { const session = await S.bootstrap(); this.setData({ notification: session.notification || {}, me: session.me, partner: session.partner, meLabel: D.memberName(session.me, true), partnerLabel: D.memberName(session.partner, false) }); this.tick(); await this.loadRecords(); this.loadWeather(); }
    catch (e) { this.setData({ error: this.message(e) }); }
    finally { this._loading = false; this.setData({ busy: false }); wx.stopPullDownRefresh(); }
  },
  onPullDownRefresh() { this.refresh(); },
  message(e) { return /FunctionName|FUNCTION_NOT_FOUND|function.*not.*found/i.test(e.message || e.errMsg || '') ? '云函数尚未部署，请按 README 完成部署后重试' : e.message || e.errMsg || '操作失败，请重试'; },
  toast(e) { wx.showToast({ title: typeof e === 'string' ? e : this.message(e), icon: 'none', duration: 3000 }); },
  async loadRecords() {
    const scope = S.mode() + ':' + S.uid();
    if (this._recordScope !== scope) { this._recordScope = scope; this._confirmedWrites = {}; }
    const date = this.data.date, range = monthRange(date), request = (this._recordRequest || 0) + 1;
    this._recordRequest = request;
    const requests = [];
    for(let from = range.from; from < range.to; from = D.shiftDay(from,32)) requests.push(S.list(from, D.shiftDay(from,32) < range.to ? D.shiftDay(from,32) : range.to, from === range.from));
    const batches = await Promise.all(requests);
    if (this.data.date !== date || this._recordRequest !== request) return;
    const merged = new Map([].concat(...batches).map(r => [r._id, r]));
    Object.values(this._confirmedWrites || {}).forEach(r => { const remote = merged.get(r._id); if (remote && remote.version >= r.version) delete this._confirmedWrites[r._id]; else if (D.overlaps(r, D.dayStart(range.from), D.dayStart(range.to))) merged.set(r._id, r); });
    const records = Array.from(merged.values());
    this._loadedMonth = date.slice(0, 7);
    this._records = records; this._photos = this._photos || {}; this.render();
    if (!records.some(r => r.photos.length)) return;
    try { const photos = await S.photoUrls(records); if (this.data.date === date && this._recordRequest === request) { this._photos = photos; this.patchPhotos(); } } catch (_) { this.toast('照片暂未加载，刷新可重试'); }
  },
  patchPhotos() {
    const patch = {};
    ['mine','theirs'].forEach(key => (this.data[key] || []).forEach((r,i) => { const photo = r.photos[0] && this._photos[r.photos[0]] || ''; if (photo !== r.photo) patch[key+'['+i+'].photo'] = photo; }));
    if(Object.keys(patch).length) this.setData(patch); this.renderEvents();
    if(this.data.searchOpen) this.renderFeed();
  },
  render() {
    const date = this.data.date, from = D.dayStart(date), all = this._records || [];
    const map = r => Object.assign({}, r, { title: D.displayTitle(r), icon: icons[r.kind], photo: r.photos[0] && this._photos[r.photos[0]] || '', private: r.visibility === 'private' });
    const mine = D.layout(all.filter(r => r.owner === S.uid()), date).map(map), theirs = D.layout(all.filter(r => r.owner !== S.uid()), date).map(map);
    const weekday = new Date(from + 8 * 3600000).getUTCDay();
    this.setData({ mine, theirs, count: mine.length, empty: this.data.view === 'partner' ? !theirs.length : !mine.length && (this.data.view !== 'split' || !theirs.length), dateLabel: Number(date.slice(5, 7)) + '月' + Number(date.slice(8)) + '日  周' + '日一二三四五六'[weekday] });
    this.setData({ exportYear: date.slice(0, 4), isToday: date === D.dayKey(Date.now()), nowTop: (Date.now() - D.dayStart(D.dayKey(Date.now()))) / 60000 * 104 / 60 }); this.renderEvents(); this.renderMonth(); if(this.data.tab === 'stats') this.updateStats(); if(this.data.searchOpen) this.renderFeed();
  },
  renderFeed() {
    const result = buildFeed(this._records || [], { date: this.data.date, uid: S.uid(), partnerId: this.data.partner && this.data.partner.id, owner: this.data.feedOwner, kind: this.data.feedKind, query: this.data.feedQuery });
    result.groups.forEach(g => g.records.forEach(r => { r.icon = icons[r.kind]; r.ownerName = D.memberName(r.owner === S.uid() ? this.data.me : this.data.partner, r.owner === S.uid()); r.photo = r.photos[0] && (this._photos || {})[r.photos[0]] || ''; }));
    this.setData({ feedGroups: result.groups, feedCount: result.count });
  },
  openSearch() { this.setData({ searchOpen: true }); this.renderFeed(); },
  closeSearch() { this.setData({ searchOpen: false }); },
  toggleCalendarFilters() { this.setData({ calendarFiltersOpen: !this.data.calendarFiltersOpen }); },
  toggleAgenda() { this.setData({ agendaExpanded: !this.data.agendaExpanded }); this.renderMonth(); },
  toggleStats() { this.setData({ tab: this.data.tab === 'stats' ? 'calendar' : 'stats', calendarPanel: 'calendar', statsOpen: true }); this.updateStats(); },
  feedFilter(e) { this._feedScroll = 0; this.setData({ [e.currentTarget.dataset.field]: e.currentTarget.dataset.value, feedScroll: 0 }); this.renderFeed(); },
  pickFeedMonth(e) { this.changeDate(e.detail.value + '-01'); },
  feedSearch(e) { this._feedScroll = 0; this.setData({ feedQuery: e.detail.value, feedScroll: 0 }); this.renderFeed(); },
  resetFeed() { this._feedScroll = 0; this.setData({ feedOwner: 'all', feedKind: 'all', feedQuery: '', feedScroll: 0 }); this.renderFeed(); },
  feedScrolled(e) { this._feedScroll = e.detail.scrollTop; this.setData({ feedScroll: e.detail.scrollTop }); },
  async openDay(e) { if (await this.changeDate(e.currentTarget.dataset.date)) this.setData({ tab: 'timeline', searchOpen: false, scrollTop: this._scroll }); },
  renderMonth() {
    const result = buildCalendar(this._records || [], { date: this.data.date, uid: S.uid(), partnerId: this.data.partner && this.data.partner.id, owner: this.data.calendarOwner, kind: this.data.calendarKind, mode: this.data.calendarMode });
    result.agenda.forEach(r => { r.icon = icons[r.kind]; r.ownerName = D.memberName(r.own ? this.data.me : this.data.partner, r.own); r.photo = r.photos[0] && (this._photos || {})[r.photos[0]] || ''; });
    this.setData({ monthCells: result.cells, dayAgenda: result.agenda, agendaPreview: this.data.agendaExpanded ? result.agenda : result.agenda.slice(0, 3), dayCount: result.count, dayStudy: result.study, dayPhotos: result.photoCount, monthLabel: this.data.date.slice(0, 4) + '年' + Number(this.data.date.slice(5, 7)) + '月' });
  },
  calendarFilter(e) { this.setData({ [e.currentTarget.dataset.field]: e.currentTarget.dataset.value }); this.renderMonth(); this.updateStats(); },
  calendarPrevious() { if (this.data.tab === 'stats' && !this.data.periodView && this.data.statScope !== 'month') return this.changeDate(D.shiftDay(this.data.date, this.data.statScope === 'day' ? -1 : -7)); return this.data.calendarMode === 'week' && this.data.tab !== 'stats' ? this.changeDate(D.shiftDay(this.data.date, -7)) : this.monthPrevious(); },
  calendarNext() { if (this.data.tab === 'stats' && this.data.statScope !== 'month') return this.changeDate(D.shiftDay(this.data.date, this.data.statScope === 'day' ? 1 : 7)); return this.data.calendarMode === 'week' && this.data.tab !== 'stats' ? this.changeDate(D.shiftDay(this.data.date, 7)) : this.monthNext(); },
  calendarTouchStart(e) { this._calendarTouch = e.changedTouches[0]; },
  calendarTouchEnd(e) { const first = this._calendarTouch, last = e.changedTouches[0]; if (first && Math.abs(last.clientX - first.clientX) > 60 && Math.abs(last.clientY - first.clientY) < 50) { if (last.clientX < first.clientX) this.calendarNext(); else this.calendarPrevious(); } this._calendarTouch = null; },
  async loadPeriodStats() {
    const now=Date.now(), range=historyRange(this.data.date,now);
    const key=[S.mode(),S.uid(),this.data.partner&&this.data.partner.id,range.from,range.to].join(':');
    if(this._periodPending===key) return;
    if(!this._periodCache || this._periodCache.key!==key) {
      const request=this._periodRequest=(this._periodRequest||0)+1;
      this._periodPending=key;this.setData({periodBusy:true,periodError:'',periodStats:{groups:[]}});
      try {
        const records=await S.periodHistory(range.from,range.to);
        if(request!==this._periodRequest)return;
        this._periodCache={key,records};
      } catch(e) { if(request===this._periodRequest)this.setData({periodError:this.message(e)});return; }
      finally { if(request===this._periodRequest){this._periodPending='';this.setData({periodBusy:false});} }
    }
    if(!this.data.periodView)return;
    const currentRange=historyRange(this.data.date);
    if(currentRange.from!==range.from||currentRange.to!==range.to)return;
    const records=new Map(this._periodCache.records.map(r=>[r._id,r]));
    Object.values(this._confirmedWrites||{}).forEach(r=>records.set(r._id,r));
    const report=periodReport(Array.from(records.values()),{date:this.data.date,uid:S.uid(),partnerId:this.data.partner&&this.data.partner.id,owner:this.data.statsOwner});
    report.groups.forEach(g=>g.name=D.memberName(g.id===S.uid()?this.data.me:this.data.partner,g.id===S.uid()));
    this.setData({periodStats:report});
  },
  updateStats() {
    const periodView=this.data.statsKind==='body'&&this.data.bodyCategory==='经期';
    this.setData({periodView});
    if(periodView){this.loadPeriodStats();return;}
    const records = (this._records || []).slice(), timer = S.getTimer(), now = Date.now();
    if (timer) {
      const segments = (timer.segments || []).slice(), end = D.timerEnd(timer,now); if (timer.runningSince && end > timer.runningSince) segments.push([timer.runningSince, end]);
      if (segments.length) records.push({ _id: timer.id, owner: S.uid(), kind: 'study', category: timer.category, visibility: 'private', start: timer.start, end: segments[segments.length - 1][1], segments });
    }
    const options = { date: this.data.date, now, uid: S.uid(), partnerId: this.data.partner && this.data.partner.id, owner: this.data.statsOwner, kind: this.data.statsKind, bodyCategory: this.data.bodyCategory };
    const report = eventSummary(records, Object.assign({}, options, { scope: this.data.statScope }));
    report.members.forEach(m => { m.name = D.memberName(m.id === S.uid() ? this.data.me : this.data.partner, m.id === S.uid()); });
    const statCards = ['day', 'week', 'month'].map((scope, i) => { const r = scope === this.data.statScope ? report : eventSummary(records, Object.assign({}, options, { scope, compact: true })); return { scope, name: ['当天', '本周', '本月'][i], total: r.label, average: r.average }; });
    const statsVisual = presentStats(report, {...options,scope:this.data.statScope,selectedDate:this.data.statsSelectedDate});
    this.setData({ statsVisual, studyReport: report, statCards, total: report.label, subjects: report.subjects, statsName: this.data.statsLabel + '统计' });
  },
  statsKind(e) { const kind=e.currentTarget.dataset.kind; this.setData({statsKind:kind,statsLabel:kind==='body'?D.categoryLabel(this.data.bodyCategory):LABELS[kind] || '学习',statsDetail:kind==='body'?'sessions':'subjects'}); this.updateStats(); },
  bodyStats(e) { const bodyCategory=e.currentTarget.dataset.category; this.setData({bodyCategory,statsLabel:D.categoryLabel(bodyCategory),statsDetail:'sessions',heatDetail:''}); this.updateStats(); },
  toggleStatsHeat() { this.setData({statsHeatExpanded:!this.data.statsHeatExpanded,heatDetail:''}); },
  selectStatsDay(e) { this.setData({statsSelectedDate:e.currentTarget.dataset.date}); this.updateStats(); },
  statsMember(e) { this.setData({ statsOwner: e.currentTarget.dataset.owner }); this.updateStats(); },
  async trendDay(e) { if (await this.changeDate(e.currentTarget.dataset.date)) this.setData({ calendarMode: 'week' }); this.renderMonth(); },
  async loadWeather() {
    try {
      const result = await S.weather();
      const text = p => { if (!p) return '等待加入'; const w = result.items[p.city.location]; return !result.configured ? '天气未接入' : !w || w.error ? '天气暂不可用' : w.text + ' ' + w.temp + '°C' + (w.stale ? ' · 缓存' : ''); };
      const first = Object.values(result.items)[0]; this.setData({ meWeather: text(this.data.me), partnerWeather: text(this.data.partner), weatherSource: result.configured ? '天气数据：和风天气' + (first && first.observedAt ? ' · ' + first.observedAt.slice(11, 16) + '更新' : '') : '' });
    } catch (_) { this.setData({ meWeather: '天气暂不可用', partnerWeather: '天气暂不可用' }); }
  },
  avatarTap(e) {
    const side = e.currentTarget.dataset.side;
    if (side === 'partner' && !this.data.partner) { this.setData({ tab: 'us' }); return; }
    if(this.data.homeStyle==='events')return;
    const view = this.data.view === 'split' ? side : this.data.view === side ? side : 'split';
    if (view === this.data.view) return;
    clearTimeout(this._motionTimer);
    this.setData({ rippleActive: false, motionSide: side }, () => {
      this.setData({ view, rippleSide: side, rippleActive: true,
        empty: view === 'partner' ? !this.data.theirs.length : !this.data.mine.length && (view !== 'split' || !this.data.theirs.length) });
      this.renderEvents(); this._motionTimer = setTimeout(() => this.setData({ rippleActive: false, motionSide: '' }), 620);
    });
  },
  onScroll(e) { this._scroll = e.detail.scrollTop; }, changeTab(e) {
    const tab=e.currentTarget.dataset.tab==='me'?'us':e.currentTarget.dataset.tab;
    if(!this._returning && tab!==this.data.tab) {
      this._tabHistory=this._tabHistory||[];
      if(tab==='timeline') this._tabHistory=[];
      else { const index=this._tabHistory.indexOf(tab); if(index>=0)this._tabHistory=this._tabHistory.slice(0,index);else this._tabHistory.push(this.data.tab); }
    }
    this.setData({tab,calendarPanel:'calendar',scrollTop:this._scroll,feedScroll:this._feedScroll||0});if(tab==='stats')this.updateStats();
  },
  async changeDate(date) { if (this.data.busy) return false; if (this._loadedMonth === date.slice(0, 7) && !this.data.error) { this.setData({ date, agendaExpanded: false }); this.render(); return true; } this._feedScroll = 0; this._records = []; this._photos = {}; this.setData({ date, busy: true, error: '', feedScroll: 0, agendaExpanded: false }); this.render(); try { await this.loadRecords(); return true; } catch (e) { this.setData({ error: this.message(e) }); this.toast(e); return false; } finally { this.setData({ busy: false }); } },
  previous() { this.changeDate(D.shiftDay(this.data.date, -1)); }, next() { this.changeDate(D.shiftDay(this.data.date, 1)); }, async today() { if (await this.changeDate(D.dayKey(Date.now()))) this.scrollToTime(Date.now()); }, pickDate(e) { this.changeDate(e.detail.value); },
  monthPrevious() { return this.changeDate(D.shiftDay(this.data.date.slice(0, 7) + '-01', -1)); }, monthNext() { return this.changeDate(D.dayKey(D.dayStart(this.data.date.slice(0, 7) + '-01') + 32 * D.DAY).slice(0, 7) + '-01'); },
  chooseDay(e) { if (e.currentTarget.dataset.active) this.changeDate(e.currentTarget.dataset.date); }, scope(e) { this.setData({ statScope: e.currentTarget.dataset.scope }); this.updateStats(); },
  openCalendarAdd() { this.setData({ calendarAddOpen: true }); },
  closeCalendarAdd() { this.setData({ calendarAddOpen: false }); },
  add(e) { const kind = e.currentTarget.dataset.kind || 'activity', calendar = this.data.calendarAddOpen; if (kind === 'study' && !calendar) this.openStudy(); else this.openEditor(kind); },
  openStudy() { this.tick(); this.setData({ studyOpen: !this.data.timer, focusOpen: !!this.data.timer, studyCategory: this.data.timer ? this.data.timer.category : this.data.studyCategory }); },
  closeStudy() { this.setData({ studyOpen: false }); },
  minimizeFocus() { const pos = this._floatPosition; this.setData({ focusOpen: false, ...(pos ? { floatX: pos.x, floatY: pos.y } : {}) }); },
  chooseTimerMode(e) { this.setData({ timerMode: e.currentTarget.dataset.mode }); },
  focusPreset(e) { this.setData({ focusMinutes: Number(e.currentTarget.dataset.minutes) }); },
  startRest() { const t=S.getTimer(); if(!t || !t.completed || t.restUntil) return; t.restUntil=Date.now()+5*60000; S.setTimer(t); this.tick(); },
  async nextRound() { const t=S.getTimer(); if(!t || !t.completed) return; if(await this.finishTimer()) { this.setData({studyCategory:t.category,timerMode:'pomodoro',focusMinutes:t.goalMs/60000}); this.startTimer(); } },
  focusInput(e) { this.setData({ focusMinutes: e.detail.value }); },
  floatMoved(e) { if(e.detail.source === 'touch') { this._floatPosition = { x:e.detail.x,y:e.detail.y }; } },
  heatTap(e) { this.setData({ heatDetail: e.currentTarget.dataset.label }); },
  chooseStudy(e) { if (!S.getTimer()) this.setData({ studyCategory: e.currentTarget.dataset.subject }); },
  manualStudy() { this.openEditor('study'); },
  statsDetail(e) { this.setData({ statsDetail: e.currentTarget.dataset.detail }); },
  openEditor(kind, record) {
    if (this.data.editorRequest) return;
    this.setData({ studyOpen: false, calendarAddOpen: false, editorRequest: { kind, date: this.data.tab === 'calendar' && !this.data.searchOpen ? this.data.date : D.dayKey(Date.now()), record: record || null, photoUrls: this._photos || {} } });
  },
  async editorClosed(e) {
    this.setData({ editorRequest: null });
    if (!e.detail.saved) return;
    this._periodCache=null;this._periodRequest=(this._periodRequest||0)+1;this._periodPending='';
    this._recordRequest = (this._recordRequest || 0) + 1;
    if (e.detail.record) {
      const record = e.detail.record;
      this._confirmedWrites = this._confirmedWrites || {}; this._confirmedWrites[record._id] = record;
      this._records = (this._records || []).filter(r => r._id !== record._id).concat(record);
      this.setData(revealState(record, this.data.view, this.data.partner)); this.render(); this.scrollToTime(record.start);
      clearTimeout(this._focusTimer); this._focusTimer = setTimeout(() => this.setData({ focusedId: '' }), 2200);
    } else if (e.detail.deletedId) {
      this._records = (this._records || []).filter(r => r._id !== e.detail.deletedId);
      if (this._confirmedWrites) delete this._confirmedWrites[e.detail.deletedId]; this.render();
    }
    try { await this.loadRecords(); } catch (error) { this.setData({ error: this.message(error) }); }
  },
  switchHomeStyle(e) {
    const homeStyle=e.currentTarget.dataset.style;
    if(!['events','axis'].includes(homeStyle)||homeStyle===this.data.homeStyle)return;
    this._homeScroll=this._homeScroll||{};this._homeScroll[this.data.homeStyle]=this._scroll||0;
    const target=this._homeScroll[homeStyle]===undefined?(homeStyle==='axis'?scrollForTime(Date.now(),this.data.date,this._width||375):0):this._homeScroll[homeStyle];
    wx.setStorageSync('ourdays-home-style',homeStyle);this._scroll=target;
    this.setData({homeStyle,scrollTop:target,eventAnchor:''});this.renderEvents();
  },
  renderEvents() {
    const uploadedAt = record => Number(record.createdAt || record.updatedAt || record.start || 0);
    const all = this.data.mine.concat(this.data.theirs).sort((a,b)=>uploadedAt(b)-uploadedAt(a) || a._id.localeCompare(b._id));
    this.setData({events:all.map(r=>Object.assign({},r,{own:r.owner===S.uid(), ownerAvatar:(r.owner===S.uid()?this.data.me:this.data.partner||{}).avatarUrl || (r.owner===S.uid()?'/assets/avatar-me.svg':'/assets/avatar-partner.svg'), ownerName:D.memberName(r.owner===S.uid()?this.data.me:this.data.partner,r.owner===S.uid()), noteOpen:!!this.data.expandedNotes[r._id], noteExpandable:(r.note||'').length>40 || (r.note||'').includes('\n'), commentsOpen:!!this.data.expandedComments[r._id], commentCount:(r.comments||[]).length, commentTags:(this.data.expandedComments[r._id]?r.comments||[]:(r.comments||[]).slice(-2)).map(c=>Object.assign({},c,{name:c.author===S.uid()?this.data.meLabel:this.data.partnerLabel,replyName:c.replyTo?(c.replyAuthor===S.uid()?this.data.meLabel:this.data.partnerLabel):''})), thumbnails:(r.photos||[]).map(file=>({file,url:(this._photos||{})[file]||''}))}))});
  },
  scrollToTime(time) { if(this.data.homeStyle==='axis'){ const target=scrollForTime(time,this.data.date,this._width||375); this._scroll=target;this.setData({scrollTop:target,eventAnchor:''});return; } const r=(this.data.events||[]).find(r=>r._id===this.data.focusedId)||(this.data.events||[]).find(r=>r.start>=time); this.setData({eventAnchor:''},()=>this.setData({eventAnchor:r?'event-'+r._id:'',scrollTop:0})); },
  toggleNote(e) { const id=e.currentTarget.dataset.id; this.setData({['expandedNotes.'+id]:!this.data.expandedNotes[id]}); this.renderEvents(); },
  toggleComments(e) { const id=e.currentTarget.dataset.id; this.setData({['expandedComments.'+id]:!this.data.expandedComments[id]}); this.renderEvents(); },
  async previewEventPhotos(e) { const r=(this._records||[]).find(r=>r._id===e.currentTarget.dataset.id); if(!r)return; try { const map=await S.photoUrls([r]); const urls=r.photos.map(f=>map[f]).filter(Boolean); if(urls.length)wx.previewImage({urls,current:map[e.currentTarget.dataset.file]||urls[0]}); else this.toast('照片暂不可用，请刷新重试'); }catch(error){this.toast(error);} },
  openComment(e) { this._commentRequest=S.id(); this.setData({commentId:e.currentTarget.dataset.id,commentText:'',replyTo:'',replyName:'',replyText:''}); },
  replyComment(e) { const {id,comment}=e.currentTarget.dataset;const record=(this._records||[]).find(r=>r._id===id),parent=record&&(record.comments||[]).find(c=>c.id===comment);if(!parent)return;this._commentRequest=S.id();this.setData({commentId:id,commentText:'',replyTo:parent.id,replyName:parent.author===S.uid()?this.data.meLabel:this.data.partnerLabel,replyText:parent.text}); },
  closeComment() { if(!this.data.commentBusy)this.setData({commentId:'',commentText:'',replyTo:'',replyName:'',replyText:''}); },
  commentInput(e) { this.setData({commentText:e.detail.value}); },
  async sendComment() { if(this.data.commentBusy)return; this.setData({commentBusy:true}); try { const result=await S.comment(this.data.commentId,this.data.commentText,this._commentRequest,this.data.replyTo); const r=(this._records||[]).find(r=>r._id===this.data.commentId); if(r)r.comments=result.comments; if(this._confirmedWrites&&this._confirmedWrites[this.data.commentId])this._confirmedWrites[this.data.commentId].comments=result.comments; this.setData({commentId:'',commentText:''}); this.render(); this.toast('评论已发送'); }catch(e){this.toast(e);}finally{this.setData({commentBusy:false});} },
  subscribeNotifications() { const tmplId=this.data.notification.templateId; if(S.mode()!=='cloud')return this.toast('请先连接云端'); if(!tmplId)return this.toast('请先在云端配置订阅消息模板'); wx.requestSubscribeMessage({tmplIds:[tmplId],success:r=>this.toast(r[tmplId]==='accept'?'已订阅一次动态通知':'未开启通知，可再次点击订阅'),fail:e=>this.toast(e)}); },
  async recordTap(e) { const r = (this._records || []).concat(this._periodCache?this._periodCache.records:[]).find(r => r._id === e.currentTarget.dataset.id); if(!r)return; if(r.owner===S.uid())this.openEditor(r.kind,r); else { if(!await this.changeDate(D.dayKey(r.start)))return; this.setData({homeStyle:'events',view:'partner',tab:'timeline',searchOpen:false,focusedId:r._id}); this.render(); this.scrollToTime(r.start); } },
  tick() { const minute = Math.floor(Date.now() / 60000); if (minute !== this._nowMinute) { this._nowMinute = minute; this.setData({ isToday: this.data.date === D.dayKey(Date.now()), nowTop: (Date.now() - D.dayStart(D.dayKey(Date.now()))) / 60000 * 104 / 60 }); if (this.data.tab === 'stats') this.updateStats(); } let timer = S.getTimer();
    if (timer && timer.goalMs && timer.runningSince && D.timerElapsed(timer, Date.now()) >= timer.goalMs) {
      const left = Math.max(0, timer.goalMs - D.timerElapsed(Object.assign({},timer,{runningSince:null}),Date.now()));
      if(left) timer.segments.push([timer.runningSince,timer.runningSince+left]);
      timer.runningSince=null; timer.completed=true; S.setTimer(timer);
      if(wx.vibrateShort) wx.vibrateShort({type:'light'}); if(wx.showToast) wx.showToast({title:'本轮专注完成，可结束保存',icon:'none'});
    }
    if(timer && timer.restUntil && !timer.restCompleted && Date.now()>=timer.restUntil) { timer.restCompleted=true; S.setTimer(timer); if(wx.vibrateShort) wx.vibrateShort({type:'light'}); this.toast('休息结束'); }
    const restRemaining=timer && timer.restUntil ? timerClock(Math.max(0,timer.restUntil-Date.now())) : '';
    if(restRemaining!==this.data.restRemaining) this.setData({restRemaining});
    const spent=timer?D.timerElapsed(timer,Date.now()):0, elapsed = timer ? timerClock(spent) : '';
    const remaining=timer&&timer.goalMs?timerClock(Math.max(0,timer.goalMs-spent)):elapsed;
    const focusProgress=timer&&timer.goalMs?Math.min(100,spent/timer.goalMs*100):0; const key = JSON.stringify(timer); if (key !== this._timerKey || elapsed !== this.data.elapsed) { this._timerKey = key; this.setData({ timer, elapsed, remaining, focusProgress }); } },
  startTimer() {
    if (S.getTimer()) { this.openStudy(); return; }
    const category = this.data.studyCategory;
    if (!D.CATEGORIES.study.includes(category)) return this.toast('请选择科目');
    const minutes = Number(this.data.focusMinutes);
    if(this.data.timerMode === 'pomodoro' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 180)) return this.toast('专注时长请输入1至180分钟');
    try { const now = Date.now(); S.setTimer({ id: S.id(), category, start: now, runningSince: now, segments: [], goalMs: this.data.timerMode === 'pomodoro' ? minutes * 60000 : null }); this.tick(); this.setData({ studyOpen: false, focusOpen: true }); }
    catch (e) { this.toast(e); }
  },
  pauseTimer() {
    if (this._finishing) return;
    const t = S.getTimer(); if (!t) return;
    if (t.completed) return this.toast('本轮已完成，请结束并保存');
    const now = D.timerEnd(t, Date.now());
    if (t.runningSince) { if (now > t.runningSince) t.segments.push([t.runningSince, now]); t.runningSince = null; }
    else t.runningSince = now;
    if (t.goalMs && D.timerElapsed(t, now) >= t.goalMs) { t.runningSince = null; t.completed = true; }
    S.setTimer(t); this.tick();
  },
  async finishTimer() {
    const t = S.getTimer(); if (!t || this._finishing) return;
    this._finishing = true;
    let response; try { response = await wx.showModal({ title: '结束学习并保存？', content: t.category }); } catch (e) { this._finishing = false; this.toast(e); return; }
    if (!response.confirm) { this._finishing = false; return; }
    this.setData({ timerSaving: true });
    const now = D.timerEnd(t,Date.now()); if (t.runningSince && now > t.runningSince) t.segments.push([t.runningSince, now]); t.runningSince = null; S.setTimer(t); this.tick();
    if (!t.segments.length) { S.setTimer(null); this.tick(); this._finishing = false; this.setData({ timerSaving: false, focusOpen: false }); return; }
    this._finishing = true;
    try { const record = { kind: 'study', category: t.category, title: t.category, start: t.start, end: t.segments[t.segments.length - 1][1], segments: t.segments, note: '', photos: [], visibility: 'shared' }; const result = await S.save(record, t.id, 0, t.id); S.setTimer(null); this.tick(); this.setData({ studyOpen: false, focusOpen: false }); await this.editorClosed({ detail: { saved: true, record: Object.assign(record, { _id: result.id, clientId: t.id, owner: S.uid(), version: 1 }) } }); this.toast('学习记录已保存'); return true; }
    catch (e) { this.toast(e); } finally { this._finishing = false; this.setData({ timerSaving: false }); }
  },
  async connect() { if (this.data.busy) return; this.setData({ busy: true }); try { await S.connect(); this._loadedMonth = ''; this._records = []; this._photos = {}; this.setData({ view: 'me', invite: '' }); this.tick(); this.setData({ busy: false }); await this.refresh(); } catch (e) { this.setData({ error: this.message(e) }); this.toast(e); } finally { this.setData({ busy: false }); } },
  async demoMode() { S.useDemo(); this._loadedMonth = ''; this._records = []; this.setData({ view: 'me', invite: '' }); this.tick(); await this.refresh(); },
  async invite() { if (S.mode() === 'demo') return this.toast('请先连接云端再邀请真实成员'); try { const r = await S.call('invite'); this.setData({ invite: r.code }); } catch (e) { this.toast(e); } },
  copyInvite() { wx.setClipboardData({ data: this.data.invite }); }, joinInput(e) { this.setData({ joinCode: e.detail.value }); },
  async join() { if (S.mode() === 'demo') return this.toast('请先连接云端'); try { await S.call('join', { code: this.data.joinCode }); this.setData({ joinCode: '' }); await this.refresh(); this.toast('你们的空间已连接'); } catch (e) { this.toast(e); } },
  async unlink() { if (S.mode() === 'demo') return this.toast('演示成员无需解绑'); const r = await wx.showModal({ title: '解除双人绑定？', content: '双方保留自己的记录，停止通过应用分享。已下载的内容无法远程收回。' }); if (!r.confirm) return; try { await S.call('unlink'); this.setData({ view: 'me', invite: '' }); this._records = []; await this.refresh(); } catch (e) { this.toast(e); } },
  editProfile() { this.setData({ profileOpen: true, profile: Object.assign({}, this.data.me), cityIndex: Math.max(0, D.CITIES.findIndex(c => c.location === this.data.me.city.location)) }); },
  closeProfile() { this.setData({ profileOpen: false }); }, noop() {}, profileField(e) { this.setData({ ['profile.' + e.currentTarget.dataset.field]: e.detail.value }); },
  cityChange(e) { this.setData({ cityIndex: Number(e.detail.value), 'profile.city': D.CITIES[Number(e.detail.value)] }); },
  async avatarChoose(e) { try { const avatar = await S.upload(e.detail.avatarUrl, 'avatar'); this.setData({ 'profile.avatar': avatar, 'profile.avatarUrl': e.detail.avatarUrl }); } catch (error) { this.toast(error); } },
  async saveProfile() { try { await S.saveProfile(this.data.profile); this.closeProfile(); await this.refresh(); } catch (e) { this.toast(e); } },
  async exportData() {
    this.setData({ busy: true });
    try {
      const year = Number(this.data.date.slice(0, 4)); let records = [];
      for (let month = 1; month <= 12; month++) {
        const from = year + '-' + String(month).padStart(2, '0') + '-01', to = month === 12 ? (year + 1) + '-01-01' : year + '-' + String(month + 1).padStart(2, '0') + '-01';
        records = records.concat((await S.list(from, to)).filter(r => r.owner === S.uid()));
      }
      records = Array.from(new Map(records.map(r => [r._id, r])).values());
      const path = wx.env.USER_DATA_PATH + '/our-days-' + year + '.json';
      wx.getFileSystemManager().writeFileSync(path, JSON.stringify({ schemaVersion: 1, year, exportedAt: new Date().toISOString(), note: '本人记录；照片为引用，请在详情中另存照片文件。', records }, null, 2), 'utf8');
      if (wx.shareFileMessage) await wx.shareFileMessage({ filePath: path, fileName: 'our-days-' + year + '.json' }); else this.toast('请更新微信以分享导出文件');
    } catch (e) { this.toast(e); } finally { this.setData({ busy: false }); }
  },
  async cleanup() { if (S.mode() === 'demo') return this.toast('演示模式无需云端清理'); try { await S.call('cleanup'); this.toast('待删除照片已清理'); } catch (e) { this.toast(e); } }
});
