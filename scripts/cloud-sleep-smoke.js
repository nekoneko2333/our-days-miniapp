const a=require('miniprogram-automator');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});try{console.log(await m.evaluate(async()=>{
 const env='YOUR_CLOUDBASE_ENV_ID',call=async(action,args={})=>{const r=await wx.cloud.callFunction({name:'couple',config:{env},data:{action,...args}});if(!r.result.ok)throw Error(r.result.message);return r.result.data;};
 const now=Date.now(),id='sleep_cloud_test_'+now;let saved;
 try{saved=await call('save',{id,requestId:id,version:0,record:{kind:'sleep',category:'夜间睡眠',title:'睡眠联调（自动清理）',start:now-8*3600000,end:now-60000,visibility:'private',segments:[],photos:[],note:''}});const day=t=>new Date(t+8*3600000).toISOString().slice(0,10);const rows=await call('list',{from:day(now-86400000),to:day(now+86400000)});if(!rows.some(r=>r._id===saved.id&&r.kind==='sleep'))throw Error('Sleep missing from cloud list');return 'Cloud sleep create/read passed';}finally{if(saved)await call('remove',{id:saved.id});}
}));}finally{m.disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
