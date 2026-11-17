function canGoBack(data) {
  return !!(data.commentId || data.editorRequest || data.profileOpen || data.studyOpen || data.focusOpen || data.searchOpen || data.calendarAddOpen || data.tab !== 'timeline');
}
function install(page) {
  if(page._backInstalled) return;
  page._backInstalled=true;
  const setData=page.setData.bind(page);
  page.setData=function(patch,callback) {
    if(!this._backTransition) patch=Object.assign({},patch,{backGuard:canGoBack(Object.assign({},this.data,patch))});
    setData(patch,callback);
  };
}
function goBack(page) {
  if(page.data.commentId) page.closeComment();
  else if(page.data.editorRequest) {
    const editor=page.selectComponent && page.selectComponent('#recordEditor');
    if(editor && editor.data.busy) return;
    if(editor) editor.closeEditor(); else page.setData({editorRequest:null});
  } else if(page.data.profileOpen) page.closeProfile();
  else if(page.data.calendarAddOpen) page.closeCalendarAdd();
  else if(page.data.studyOpen) page.closeStudy();
  else if(page.data.focusOpen) page.minimizeFocus();
  else if(page.data.searchOpen) page.closeSearch();
  else if(page.data.tab!=='timeline') {
    const tab=(page._tabHistory||[]).pop()||'timeline';
    page._returning=true;page.changeTab({currentTarget:{dataset:{tab}}});page._returning=false;
  }
}
module.exports={install,canGoBack,goBack};
