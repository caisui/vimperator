// vim:noexpandtab:
(function(){
  const global_attr1 = "user_caret_target_tags";
  const global_attr2 = "user_caret_mapping_key";
  const default_tags = ["div","li","td","h1","h2","h3","h4","h5","h6","p","pre","dt"];
  var target ,xpath;
  var mappingKey = liberator.globalVariables[global_attr2] || "c";

  function createXpath(t){
    target = (t && [x.replace(/\s/g,"") for each(x in t.toLowerCase().split(","))])
      || default_tags;
    xpath = "//*[@@cond1][descendant-or-self::text()][count(@@cond2)=0]"
      .replace(/@@cond1/ ,["name(.)='"+t.toLowerCase()+"'" for each(t in target)].join(" or "))
      .replace(/@@cond2/ ,[".//"+t for each(t in target)].join("|"))
    ;
  }

  function watchValue(id, oldval, newval){
    if(oldval !== newval){
      createXpath(newval);
    }
    return newval;
  }

  liberator.globalVariables.unwatch(global_attr1, watchValue);
  liberator.globalVariables.watch(global_attr1, watchValue);

  createXpath(liberator.globalVariables[global_attr1]);

  function action(e){
    try{
      let doc = e.ownerDocument;
      let win = doc.defaultView;
      var sel = win.getSelection();
      var range = doc.createRange();
      var e1, e2, offset = 0;
      let(it = doc.evaluate(".//text()", e, null, 5, null)){
        let t;
        while(t = it.iterateNext()){
          if(t.parentNode&&t.parentNode.offsetParent){
            if(!e1) e1 = t;
            if((offset=t.textContent.search(/[^\s\n]/))>=0){
              e2 = t;
              break;
            }
          }
        }
      }
      e = e2 || e1 || e;
      if(offset == -1) offset=0;

      if(e){
        range.setStart(e, offset);
        sel.removeAllRanges();
        sel.addRange(range);
        if ("focusedWindow" in Buffer) Buffer.focusedWindow = win;
        else win.focus();
        options.setPref("accessibility.browsewithcaret", true);
      }else{
        liberator.echoerr("cannot found text node!!");
      }
    }catch(ex){
      liberator.echoerr(ex);
    }
  }

  hints.addMode(mappingKey, "caret position", action, function() xpath);
})();
