(function(){
  let nextMap = liberator.globalVariables.completerScropllNext || ["<C-n>"];
  let prevMap = liberator.globalVariables.completerScropllPrev || ["<C-p>"];

  function scrollCompleter(dir){
    let list = commandline._completionList;
    let comp = commandline._completions;
    if(list._selIndex>=0)
      list._getCompletion(list._selIndex).removeAttribute("selected");
    
    if(dir){
      var offset = list._endIndex - 1;
      var index  = offset - 1;
    }else{
      index = list._startIndex - 1;
      let count = list._endIndex - list._startIndex - 1;
      offset = Math.max(index - count,0);
    }
    list._fill(offset);
    list._selIndex = -1;
    comp.selected = index;
    comp.tab(false);
  }

  mappings.addUserMap([modes.COMMAND_LINE],nextMap,"scroll page",function(){ scrollCompleter(true); });
  mappings.addUserMap([modes.COMMAND_LINE],prevMap,"scroll page",function(){ scrollCompleter(false); });
})();
