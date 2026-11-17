const test=require('node:test'),assert=require('node:assert/strict');
const storage=new Map();let calls=0;
global.wx={getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),cloud:{callFunction:async({data})=>{
 if(data.action==='bootstrap')return {result:{ok:true,data:{me:{id:'alice'},partner:null}}};
 calls++;return {result:{ok:true,data:{photo:'https://example.invalid/photo-'+calls}}};
}}};
const S=require('../miniprogram/utils/service');
test('Photo links reuse unexpired results and fetch again before signed URLs expire',async()=>{
 storage.set('ourdays-mode','cloud');await S.bootstrap();const before=Date.now,now=before();
 try{
  Date.now=()=>now;assert.equal((await S.photoUrls([{_id:'r',photos:['photo']}])).photo,'https://example.invalid/photo-1');
  await S.photoUrls([{_id:'r',photos:['photo']}]);assert.equal(calls,1);
  Date.now=()=>now+9*60000;await S.photoUrls([{_id:'r',photos:['photo']}]);assert.equal(calls,2);
 }finally{Date.now=before;}
});
test('Merchant labels deduplicate, remove cleanly and stay isolated between modes',()=>{
 S.rememberMerchant('  食堂 ');S.rememberMerchant('面馆');S.rememberMerchant('食堂');assert.deepEqual(S.getMerchants(),['食堂','面馆']);
 S.forgetMerchant('面馆');assert.deepEqual(S.getMerchants(),['食堂']);storage.set('ourdays-mode','demo');assert.deepEqual(S.getMerchants(),[]);
});
