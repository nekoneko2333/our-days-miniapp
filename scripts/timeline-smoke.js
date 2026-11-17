const automator = require('miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('fs');
(async () => {
 const mini = await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 const waitRoute = async expected => { for(let i=0;i<40;i++){ const route=await mini.evaluate(()=>getCurrentPages().slice(-1)[0].route); if(route===expected)return;await new Promise(r=>setTimeout(r,250));} throw new Error('Navigation timeout: '+expected); };
 const errors=[];mini.on('exception',e=>errors.push(e.message));
 try {
  let page=await mini.currentPage();
  if(page.path!=='pages/index/index') { await mini.callWxMethod('reLaunch', {url:'/pages/index/index'}); await new Promise(r=>setTimeout(r,1500)); page=await mini.currentPage(); }
  await page.waitFor(1200);
  await page.callMethod('refresh');console.log('Loaded');
  const original = {date:await page.data('date'),tab:await page.data('tab'),view:await page.data('view')};
  await (await page.$('[data-tab="timeline"]')).tap();await page.waitFor(650);
  assert.equal(await page.data('tab'),'timeline');
  await page.callMethod('openSearch');await page.waitFor(150);
  assert.ok(await page.$('.feed-search'));
  await (await page.$('.feed-search')).input('不存在的记录_验证');await page.waitFor(250);
  assert.equal(await page.data('feedCount'),0);
  await (await page.$('.feed-empty .secondary')).tap();await page.waitFor(250);
  assert.equal(await page.data('feedQuery'),'');
  await page.callMethod('monthPrevious');await page.waitFor(300);
  assert.notEqual((await page.data('date')).slice(0,7),original.date.slice(0,7));
  await page.callMethod('changeDate',original.date);
  fs.mkdirSync('output',{recursive:true});
  await mini.screenshot({path:'output/timeline-current.png'});
  console.log('Filters checked');const rows = await page.$$('.feed-record');
  if(rows.length){await rows[0].tap();await page.waitFor(150);assert.ok(await page.data('editorRequest'));await mini.evaluate(()=>getCurrentPages().slice(-1)[0].selectComponent('#recordEditor').closeEditor());await page.waitFor(150);assert.equal(await page.data('tab'),'timeline');}
  await page.callMethod('closeSearch');console.log('Detail checked');await (await page.$('[data-tab="timeline"]')).tap();await page.waitFor(300);
  if(await page.data('partner')){
   await page.setData({view:'me'});await (await page.$('[data-side="partner"]')).tap();await page.waitFor(650);
   assert.equal(await page.data('view'),'split');
   const mine=await (await page.$('.mine-column')).size(),partner=await (await page.$('.partner-column')).size();assert.ok(Math.abs(mine.width-partner.width)<2);
   await mini.screenshot({path:'output/split-current.png'});
   await (await page.$('[data-side="partner"]')).tap();await page.waitFor(650);assert.equal(await page.data('view'),'partner');assert.equal((await (await page.$('.mine-column')).size()).width,0);
  }
  await page.setData({...original,tab:'timeline'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('output/timeline-smoke.json',JSON.stringify({ok:true,checks:['timeline tab','search and reset','month navigation','detail and return','animated equal columns','hidden column width','no runtime exceptions']},null,2));
  console.log('Timeline UI checks passed');
 } finally { mini.disconnect(); }
})().catch(e=>{console.error(e);process.exitCode=1});
