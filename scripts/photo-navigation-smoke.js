const automator=require('miniprogram-automator'),jpeg=require('jpeg-js'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const token='photo_nav_'+Date.now();let fixture={ids:[],paths:[]},mini;
 try{
  const png={width:1600,height:1200,data:Buffer.alloc(1600*1200*4)};
  for(let y=0;y<1200;y++)for(let x=0;x<1600;x++){const i=(y*1600+x)*4;png.data[i]=x%256;png.data[i+1]=y%256;png.data[i+2]=(x+y)%256;png.data[i+3]=255;}
  const image=jpeg.encode(png,35).data;fs.writeFileSync('miniprogram/assets/'+token+'.jpg',image);
  mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});let page=await mini.currentPage();await page.waitFor(2500);page=await mini.currentPage();assert.equal(await page.data('mode'),'demo');
  fixture=await mini.evaluate(({token})=>{
   const d=wx.getStorageSync('ourdays-demo-v1'),ids=[],paths=[];
   for(let i=0;i<12;i++){
    const id=token+'_'+i,path='/assets/'+token+'.jpg';paths.push(path);ids.push(id);
    const start=new Date('2026-09-18T08:00:00+08:00').getTime()+Math.floor(i/2)*3600000;
    d.records.push({_id:id,clientId:id,version:1,owner:i%2?d.partner.id:d.me.id,kind:'activity',category:'阅读',title:'照片切换测试',note:token,start,end:start+50*60000,photos:[path],segments:[],visibility:'shared'});
   }
   wx.setStorageSync('ourdays-demo-v1',d);return {ids,paths};
  },{token});
  await page.callMethod('refresh');await page.callMethod('changeDate','2026-09-18');await page.callMethod('changeTab',{currentTarget:{dataset:{tab:'timeline'}}});await page.waitFor(200);
  assert.equal((await page.$$('.event-photo')).length,12);
  for(const [side,view] of [['partner','split'],['partner','partner'],['me','split'],['me','me']]){
   const avatar=await page.$(side==='me'?'.profile-half.self':'.profile-half.partner');assert.ok(avatar,'Avatar surface exists for '+side);await avatar.tap();await page.waitFor(650);assert.equal(await page.data('view'),view);assert.equal((await page.$$('.event-photo')).length,12);
  }
  await (await page.$('.tab[data-tab="calendar"]')).tap();await page.waitFor(200);assert.equal(await page.data('tab'),'calendar');
  await (await page.$('.tab[data-tab="timeline"]')).tap();await page.waitFor(200);assert.equal(await page.data('tab'),'timeline');assert.equal((await page.$$('.event-photo')).length,12);
  const report={ok:true,fixture:'12 image cards sharing a local 1600x1200 JPEG',checks:['Both-member transitions preserve image nodes','Calendar round trip preserves timeline images','Native avatar and tab taps work'],limitation:'Developer tools verification; real-device frame rates and cloud download latency are not measured'};
  fs.writeFileSync('output/photo-navigation-smoke.json',JSON.stringify(report,null,2));console.log(report);
 }finally{
  if(mini)await mini.evaluate(({fixture,token})=>{
   const d=wx.getStorageSync('ourdays-demo-v1');if(d){d.records=d.records.filter(r=>!fixture.ids.includes(r._id));wx.setStorageSync('ourdays-demo-v1',d);}
  },{fixture,token});if(mini){const page=await mini.currentPage();await page.callMethod('refresh');mini.disconnect();}
  const path='miniprogram/assets/'+token+'.jpg';if(fs.existsSync(path))fs.unlinkSync(path);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
