const test=require('node:test'),assert=require('node:assert/strict'),Back=require('../miniprogram/utils/back-navigation');
test('Back first closes the active surface and then returns to the preceding tab without stopping a timer',()=>{
 const page={data:{tab:'stats',editorRequest:{},focusOpen:true,timer:{id:'keep'}},_tabHistory:['timeline','calendar'],setData(p,cb){Object.assign(this.data,p);if(cb)cb();},minimizeFocus(){this.setData({focusOpen:false});},changeTab(e){this.setData({tab:e.currentTarget.dataset.tab});}};
 Back.install(page);page.setData({});assert.equal(page.data.backGuard,true);
 Back.goBack(page);assert.equal(page.data.editorRequest,null);assert.equal(page.data.tab,'stats');
 Back.goBack(page);assert.equal(page.data.focusOpen,false);assert.equal(page.data.timer.id,'keep');
 Back.goBack(page);assert.equal(page.data.tab,'calendar');Back.goBack(page);assert.equal(page.data.tab,'timeline');assert.equal(page.data.backGuard,false);
});
