const test=require('node:test'),assert=require('node:assert/strict');
global.wx={getStorageSync:()=>'',setNavigationBarTitle:()=>{}};global.getApp=()=>({editingRecord:null});
const controller=require('../miniprogram/utils/editor-controller');
function editor(){return {...controller,data:JSON.parse(JSON.stringify(controller.data)),setData(patch){Object.assign(this.data,patch);}};}
test('New records of every kind default shared; reopening resets draft fields',()=>{
 const e=editor();for(const kind of ['meal','activity','study','body']){e.onLoad({kind,date:'2026-09-13',record:null});assert.equal(e.data.visibility,'shared');e.data.visibility='private';e.data.note='old draft';}
 e.onLoad({kind:'body',date:'2026-09-13',record:null});assert.equal(e.data.note,'');assert.equal(e.data.categories[0].label,'🩸');assert.equal(e.data.category,'经期');
});
test('Editing preserves existing private visibility and does not rename custom titles',()=>{
 const e=editor();e.onLoad({record:{clientId:'a',owner:'demo-me',kind:'body',category:'经期',title:'自定义',start:Date.now(),end:null,visibility:'private',photos:[],segments:[],flow:'未填写'},date:'2026-09-13'});assert.equal(e.data.visibility,'private');assert.equal(e.data.title,'自定义');assert.equal(e.data.readOnly,false);
});
test('Changing body category replaces the default emoji but preserves a custom title',()=>{
 const e=editor(),record={clientId:'a',owner:'demo-me',kind:'body',category:'经期',title:'🩸',start:Date.now(),end:null,visibility:'private',photos:[],segments:[],flow:'未填写'};
 e.onLoad({record});e.categoryTap({currentTarget:{dataset:{category:'排便'}}});assert.equal(e.data.title,'');assert.equal(e.data.categoryLabel,'💩');
 e.onLoad({record:{...record,title:'自定义标题'}});e.categoryTap({currentTarget:{dataset:{category:'排便'}}});assert.equal(e.data.title,'自定义标题');
});
