(function(){
  let mod=liberator.modules;
  let cmd=mod.commands;
  let n_style="display:inline-block;color:#20c;width:1em;text-align:right;font-weight:bold";
  let process=[
    function(item,text){ return <>
    <span style={n_style}>{item.item.index}</span>
    <span highlight="CompIcon">{item.icon ? <img src={item.icon}/> : <></>}</span>
    <span class="td-strut"/>{item.item.url ? item.item.desc : text}</>;
    },function(item,text){ return <>
      {item.item.url ? <a highlight="URL" href={item.item.url}>{item.item.url}</a> : <span>{text}</span>}
    </>;
    }
  ];
  let openURL = function(url){
    liberator.open(url, liberator.NEW_TAB);
  };
  let openURLs = ("TreeStyleTabService" in window) ?
    function (list) {
      if (plugins.syncOpen) {
        plugins.syncOpen({
          href:"about:blank",
          child:[
            {href: u,child:[]} for(u in util.Array.itervalues(list))
          ],
        },2);
      } else {
        TreeStyleTabService.readyToOpenNewTabGroup(gBrowser);
        gBrowser.loadTabs(["about:blank"].concat(list));
      }
    }
    : function (list) {
      for(let url in mod.util.Array.itervalues(list))
        liberator.open(url, liberator.NEW_BACKGROUND_TAB);
  };
  var Check = function () {
    this.rule = [];
  };
  Check.prototype = {
    addRule : function (msg) {
      let m = msg.match(/^(\d+)?(-)?(\d+)?$/);
      if (m[1]) {
        if (m[2]) {
          if (m[3]) this.addMinMax(m[1],m[3]);
          else this.addMin(m[1]);
        } else this.addIndex(m[1]);
      }else if (m[3]) this.addMax(m[3]);
    }
    ,addIndex: function(v) {this.rule.push(function (idx) idx == v);}
    ,addMin: function (v) {this.rule.push(function (idx) idx >= v);}
    ,addMax: function (v) {this.rule.push(function (idx) idx <= v);}
    ,addMinMax:function(v,w){this.rule.push(function (idx)(v <= idx) && (idx <= w));}
    ,check: function (idx) {
      for(var func in mod.util.Array.itervalues(this.rule))
        if(func(idx)) return true;
      return false;
    }
  };

  var TagOpen = {
  action: function (args) {
    let tags=args[0].match(/([^/]+)/g);
		if (!tags) {
			liberator.echoerr("no tag list!");
			return;
		}
    let c = new Check();
    let all = true, m, cnt=0;
    let lastTag = tags[tags.length - 1];
    if (/^[0-9-,]+$/.test(lastTag)) {
      tags = tags.slice(0,-1);
      for(let r in mod.util.Array.itervalues(lastTag.split(","))) {
        c.addRule(r);
      }
      all = false;
    }
    var list=[u.url for(u in mod.util.Array.itervalues(bookmarks.get("",tags))) if(all || c.check(cnt++))];
    if (list.length === 0) liberator.echoerr("no match bookmark");
    else if (list.length === 1) openURL(list[0]);
    else openURLs(list);
  },
  option: {
    argCount: "1"
    ,completer: function (context,args) {
      try {
        let q=context.filter.split("/");
        context.title = ["tag","description"];
        if (q.length < 3) {
          let p = [];

          let tags=PlacesUtils.tagging.allTags;

          for (let i=0,j=tags.length;i<j;++i) {
            p.push(["/"+tags[i],i]);
          }
          context.completions=p;
        } else {
          q = q.slice(1,-1);
          let tags = {};
          result=bookmarks.get("",q);
          let bm = [];
          let path="/"+q.join("/")+"/";
          let cnt = 0;
          for(let r in mod.util.Array.itervalues(result)){
            let t = r.tags;
            for (let t1 in mod.util.Array.itervalues(t)) {
              if(tags[t1]) ++tags[t1];
              else tags[t1] = 1;
            }
            bm.push({text: path + cnt, desc: r.title || "(Untitled)", ico:r .icon, index: cnt++, url: r.url});
          }
          for(let a in mod.util.Array.itervalues(q)) delete tags[a];

          context.process = process;
          context.keys = {
            text: "text", description: "desc", icon: "ico"
          };
          context.completions = [{text: path, desc: "current path", index: ""}]
            .concat([{text: path + a, desc: b, index: ""} for ([a, b] in Iterator(tags))]
            , bm);
        }
      } catch (ex) {
        liberator.echoerr(ex);
      }
    }
  }
  };

  //cmd.addUserCommand(["tagopen"], "open bookmark from tag", TagOpen.action, TagOpen.option, true);

	//var map = {
	//	modes: [liberator.modules.modes.NORMAL],
  //  keys: ["<C-t>"],
	//	desc: "open bookmark from tag",
	//	action: function open_cmd() {
	//		commandline.open("", ":tagopen /", liberator.modules.modes.EX);
	//	}
	//};
	//mappings.addUserMap(map.modes, map.keys, map.desc, map.action);

  function use_tagopen(args) args && args.length == 1 && args[0][0] == "/"

  var tabopen = commands.get("tabopen");

  if (!tabopen.org) {
    tabopen.org = { };
    tabopen.org.action = tabopen.action;
    tabopen.org.completer = tabopen.completer;
  }
  tabopen.action = function (args) {
    if (use_tagopen(args)) {
      TagOpen.action(args);
    } else {
      tabopen.org.action(args);
    }
  };
  tabopen.completer = function (context,args) {
    if (use_tagopen(args)) {
      TagOpen.option.completer(context, args);
    } else {
      tabopen.org.completer(context, args);
    }
  };
  tabopen.restore = function () {
    tabopen.action = tabopen.org.action;
    tabopen.completer = tabopen.org.completer;
    tabopen.org = null;
    tabopen.restore = null;
  }
})();
