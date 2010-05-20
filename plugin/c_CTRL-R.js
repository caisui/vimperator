// vim: set fdm=marker  et :
(function(self){
  //const key = self.PATH.toLowerCase();
  const key = self.NAME;

  //{{{ Register Class
  function Register(){
    const noname = '"';
    var stack = new Array(10);
    var obj = {};
    var map = {};
    map[noname] = "";
    for(let x in util.range(0, stack.length)){
      let i = x;
      stack[i] = "";
      map.__defineGetter__(i, function() stack[i]);
    }
    var active = false;
    var cmd = "";
    return {
      registers : function(){
        for(let [attr, val] in Iterator(map)){
          if(attr === "<Tab>") continue;
          if(typeof val === "function")
            val = val();
          if(val) yield [attr, val];
        }
      },
      swap10 : function(val){
        [stack[0], stack[1], stack[2], stack[3], stack[4], stack[5], stack[6], stack[7], stack[8], stack[9],]
          =[val, stack[0], stack[1], stack[2], stack[3], stack[4], stack[5], stack[6], stack[7], stack[8],];
        map[noname] = val;
      },
      add : function(maps, val){
        if(!isarray(maps)) maps = [maps];
        if(typeof(val) === "number") val.toString();
        for(let m in util.Array.itervalues(maps)){
          map[m] = val;
        }
        return this;
      },
      yank : function(arg){
        var isLower = /^[a-z]$/.test(arg);
        var isUpper = /^[A-Z]$/.test(arg);
        if(isLower || isUpper){
          if(isUpper) arg = arg.toLowerCase();
          if(typeof(map[arg]) == "function"){
            liberator.echoerr(new Error(<>{arg} is funtion reserbed.</>));
            return;
          }
          let sel;
          if(modes.extended & modes.TEXTAREA){
            let e=Editor.getEditor();
            let [start,end] = [e.selectionStart,e.selectionEnd];
            sel = e.value.substring(start,end);
          }else{
            sel = getWord(content.window);
          }
          liberator.assert(sel);
          if(isUpper)      map[noname] = map[arg] += sel;
          else if(isLower) map[noname] = map[arg]  = sel;
        }
      },
      remove:function(arg){map[arg] = "";},
      expand : function(arg){
        if(arg in map){
          let val = map[arg];
          if(typeof val === "function"){
            val = val();
          }
          return val;
        }
        return "";
      },
      append:function(arg){
        let val = this.expand(arg);
        if(!val) return;
        let e = Editor.getEditor();
        e.editor.QueryInterface(Ci.nsIPlaintextEditor).insertText(val);
      }
    };
  }
  //}}}

  var conf = userContext[key] || (userContext[key]={
    copyToClipboard: util.copyToClipboard,
    reg: new Register(),
  });

  modules.__defineGetter__("Register",function() userContext[key].reg);

  //{{{ hack paste action
  const src = "clipboardHelper.copyString(str);";

  var code = conf.copyToClipboard.toSource().replace(src, src + <>
    try{"{"}
    modules.userContext["{key}"].reg.swap10(str);
    {"}"}catch(ex){"{"}
      liberator.echoerr(ex);
    {"}"}
  </>);

  util.copyToClipboard = liberator.eval(<>(function() {code})()</>.toString(),util.copyToClipboard);
  //}}}

  function dateFormat(fmt) new Date().toLocaleFormat(fmt)
  function getWord(win){
    if(/(about|mailto):/.test(win.location)) return "";
    var sel = win.getSelection().toString();
    if(sel) return sel;
    for(let w in util.Array.itervalues(win.frames)){ 
      sel = getWord(w);
      if(sel) break;
    }
    return sel;
  }
  function lastString(name){
    let history = storage[name];

    return let(len = history.length) len ?
      history.get(history.length-1).value : "";
  }

  function scrollIntoView(e, left, top){
    [e.scrollLeft ,e.scrollTop] = [left||0, top||0];
    let(editor=e.editor||e.QueryInterface(Ci.nsIDOMNSEditableElement).editor){
      let ctrl = editor.selectionController;
      ctrl.getSelection(Ci.nsISelectionController.SELECTION_NORMAL)
        .QueryInterface(Ci.nsISelection2)
        .scrollIntoView(Ci.nsISelectionController.SELECTION_ANCHOR_REGION, true, -1, -1);
    }
  }

  function commandlineInput(extra){
    const modules = liberator.modules;
    if(modules.modes._modeStack.length > 0) return "";

    let isCommand = liberator.mode & liberator.modules.modes.COMMAND_LINE;
    let elem = Editor.getEditor();
    let [start,end, text, prompt] = [elem.selectionStart, elem.selectionEnd, elem.value,
      commandline._currentPrompt];
    commandline.input(extra.prompt || "",function(arg){
      try{
        commandline._completionList.hide();
        let val = extra.action(arg);
        if(isCommand){
          commandline.open(prompt, text, modes.EX);
          elem.selectionStart = start;
          elem.selectionEnd   = end;
        }
        
        elem.editor.QueryInterface(Ci.nsIPlaintextEditor).insertText(val);
      }catch(ex){
        liberator.echoerr(ex);
      }
    },{
      completer: function(context) extra.completer(context),
      onCancel: function (arg) {
        commandline._completionList.hide();
        if(isCommand){
          commandline.open(prompt, text, modes.EX);
          elem.selectionStart = start;
          elem.selectionEnd   = end;

          scrollIntoView(elem);
          throw new Error("stop escape event");
        }
      },
    });
    return "";
  }
  function expressionRegister() commandlineInput({
    prompt: "=",
    action:function(arg) liberator.eval(arg).toString(),
    completer: function(context) completion.javascript(context),
  })
  function completeRegister() commandlineInput({
    prompt: "reg:",
    action:function(arg) reg.expand(arg),
    completer:function(context){
      try{
      context.completions = [item for(item in reg.registers())];
      }catch(ex){liberator.echoerr(ex);}
    },
  })

  var reg = conf.reg;

  //{{{entry action
  reg
    .add("%"       , function() content.document.location.href)
    .add(["*","+"] , function() util.readFromClipboard())
    .add(":"       , function() lastString("history-command"))
    .add("/"       , function() lastString("history-search"))
    .add("<C-w>"   , function() getWord(content.window))
    .add("="       , expressionRegister)
    //
    .add("<Tab>"   , completeRegister)
    .add("h"       , function(){
      //@see mappings.get(modes.NORMAL,"gU").action
      var uri = content.document.location;
      return (/(about|mailto):/.test(uri.protocol))
        ? "" : uri.host;
    })
    .add("d"       , function() dateFormat("%Y/%m/%d"))
    .add("t"       , function() dateFormat("%H:%M"))
    .add("n"       , function() dateFormat("%Y/%m/%d %H:%M"))
  ;
  //}}}

  mappings.addUserMap([modes.COMMAND_LINE,modes.INSERT],["<C-r>"],"", function(arg){
    reg.append(arg);
  },{arg:true});

  mappings.addUserMap([modes.NORMAL,modes.VISUAL], ['"'], "copy ext",function(arg){
    reg.yank(arg);
  },{arg:true});
})(this);
