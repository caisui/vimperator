// vim:fdm=marker
(function(){
  //{{{ const define
  const styleSheetService = Cc['@mozilla.org/content/style-sheet-service;1']
    .getService(Ci.nsIStyleSheetService);
  const ioService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
  const datacss = "data:text/css,";
	const spAttr = "split";
  //}}}

  function getURIFromXML(aXml){
    return ioService.newURI(datacss+aXml.toString(), null, null);
  }

//{{{ build css
	function createSplitterCSS(){
		var begin="{",end="}";
		return getURIFromXML(<>
@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
#content>tabbox>tabpanels[{spAttr}]>*
{begin}
	visibility: collapse;
{end}
#content>tabbox>tabpanels[{spAttr}='v']
{begin}
	display: -moz-box;
{end}
#content>tabbox>tabpanels[{spAttr}='vr']
{begin}
	display: -moz-box;
	-moz-box-direction: reverse;
{end}
#content>tabbox>tabpanels[{spAttr}='h']
{begin}
	display: -moz-box;
	-moz-box-orient: vertical;
{end}
#content>tabbox>tabpanels[{spAttr}='hr']
{begin}
	display: -moz-box;
	-moz-box-orient: vertical;
	-moz-box-direction: reverse;
{end}
#content>tabbox>tabpanels[{spAttr}]>*[{spAttr}='os']
{begin}
	visibility: visible;
	border: 1px solid black;
{end}
#content>tabbox>tabpanels[{spAttr}]>*[{spAttr}='o']
{begin}
	visibility: visible;
	border: 1px solid transparent;
{end}
</>);
	}
//}}}

	var backupCss = createSplitterCSS();
  //{{{ Object
	function watchObject(obj,name,func){
		obj.watch(name, func);
		return {
			unwatch:function(){
				obj.unwatch(name, func);
			}
		}
	}
	function HookGetter(obj, name, geneFunc){
		var original = obj.__lookupGetter__(name);
		obj.__defineGetter__(name,geneFunc(original));
		return {
			unhook:function(){
				obj.__defineGetter__(name,original);
			}
		}
	}
	function EventListener(obj, name, func, flag){
		obj.addEventListener(name, func, flag);
		return {
			remove:function(){ 
				obj.removeEventListener(name, func, flag);
			}
		}
	}
  //}}}

  var T={
    //{{{ variable
		get tabpanels() gBrowser.mPanelContainer,
		get tabbox() gBrowser.mTabBox,
    get orientR() T.orient + "r",
    selectedTabs:[],
		index: 0,
		orient: "",
    names: ["vsp[lit]"],
    desc: "vertical splitter",
    //}}}
    action_vs:function(args) T.action_split("v", args[0]),
    action_hs:function(args) T.action_split("h", args[0]),
    action_split:function(mode, x){
			if(!x){
				if(mode == T.orient){
          T.stopSplit();
				}else if(T.orient){
					T.orient = mode;
					T.updatePanel();
				}else liberator.echoerr("no work...");
			}else{
        var m;
        if(m = /^([+-])?\d+$/.exec(x)){
          if(m[1]) x = parseInt(x) + gBrowser.selectedTab._tPos;
          else x = parseInt(x) - 1;

          if((0 <= x) && (x < gBrowser.mTabs.length)){
            T.register(backupCss);
            T.orient = mode;
            if(!T.select) T.select = new watchObject(gBrowser.mTabContainer,"selectedIndex",T.selectedIndex);
            if(!T.focus)  T.focus  = new EventListener(T.tabpanels, "click", T.click_event, true);
            T.selectedTabs = [gBrowser.selectedTab, gBrowser.mTabs[x]];
            T.index = 0;
            T.updatePanel();
            if(!T._TabClose) T._TabClose = new EventListener(gBrowser, "TabClose", T.tabCloseEvent, false);
          }
				}else{
					liberator.echoerr(x + " is not support");
				}
			}
    },
		action_sw:function(){
			T.index = (T.index+1) % T.selectedTabs.length;
			gBrowser.selectedTab = T.selectedTabs[T.index];
		},
    stopSplit:function(){
      T.unregister(backupCss);
      T.orient = null;
      if(T.select){
        T.select.unwatch();
        T.select = null;
      }
      if(T.tabCloseEvent){
        T._TabClose.remove();
        T._TabClose = null;
      }
      if(T.focus){
      	T.focus.remove();
      	T.focus = null;
      }
      T.tabpanels.removeAttribute(spAttr);
      liberator.echo("stop splitter");
    },
		action_r:function(){
			var aTab = T.selectedTabs.shift();
			T.selectedTabs.push(aTab);
			gBrowser.selectedTab = T.selectedTabs[T.index];
		},
		action_x:function(){
			var aTab = T.selectedTabs.shift();
			T.selectedTabs.push(aTab);
			T.action_sw();
			T.updatePanel();
		},
    map_split:function(mode){
      return function(){
        var aCount = (gBrowser.selectedTab._tPos + 1) % gBrowser.mTabs.length + 1;
        T.action_split(mode, aCount);
      }
    },
		updatePanel:function(){
			T.tabpanels.setAttribute(spAttr, T.isReverse(T.selectedTabs[0],T.selectedTabs[1]) ? T.orientR :T.orient);
			//T.tabpanels.setAttribute(spAttr, T.orient);
			for(let e in util.Array.itervalues(T.tabpanels.childNodes)){
				e.removeAttribute(spAttr);
			}
			for(let i=0,j=T.selectedTabs.length;i<j;++i){
				let p = T.selectedTabs[i].linkedBrowser.parentNode;

        if(p) p.setAttribute(spAttr, (i == T.index) ? "os" : "o");
        else liberator.echoerr("not found!!");
        //p.setAttribute(spAttr, "o" + i);
			}
		},
    isReverse:function(aTab1, aTab2){
      var nodes = gBrowser.mPanelContainer.childNodes;
      return Array.indexOf(nodes, aTab1.linkedBrowser.parentNode)
        > Array.indexOf(nodes, aTab2.linkedBrowser.parentNode);
    },
    //{{{ event
    selectedIndex:function(id,oldval,newval){
      T.selectedTabs[T.index] = gBrowser.mTabs[newval];
			T.updatePanel();
      return newval;
    },
    click_event:function(evt){
			var elm = evt.originalTarget;
      var aDocument = elm.ownerDocument;
      while(aDocument.defaultView.frameElement) aDocument = aDocument.defaultView.frameElement.ownerDocument;
      var index = gBrowser.getBrowserIndexForDocument(aDocument);
      if((index = Array.indexOf(T.selectedTabs, gBrowser.mTabs[index]))>=0){
        if(T.index != index){
          T.index = index;
          gBrowser.selectedTab = T.selectedTabs[T.index];
        }
      }
    },
    tabCloseEvent:function(evt){
      var tab = evt.originalTarget;
      var panel = tab.linkedBrowser.parentNode;
      if(panel){
        if(panel.hasAttribute(spAttr)){
          var val = panel.getAttribute(spAttr);
          if(val == "o"){
            T.stopSplit();
          }
        }
      }
    },
    //}}}
    //{{{ style sheet
    register:function(css){
      if(!styleSheetService.sheetRegistered(css, styleSheetService.USER_SHEET)){
        styleSheetService.loadAndRegisterSheet(css, styleSheetService.USER_SHEET);
      }
    },
    unregister:function(css){
      if(styleSheetService.sheetRegistered(css, styleSheetService.USER_SHEET)){
        styleSheetService.unregisterSheet(css, styleSheetService.USER_SHEET);
      }
    },
    toggleRegister:function(css){
      if(styleSheetService.sheetRegistered(css, styleSheetService.USER_SHEET)){
        styleSheetService.unregisterSheet(css, styleSheetService.USER_SHEET);
        liberator.echo("unloaded!!");
      }else{
        styleSheetService.loadAndRegisterSheet(css, styleSheetService.USER_SHEET);
      }
    },
    //}}}
  };

  //{{{ mapping
  var aModes = [modes.NORMAL];
  mappings.addUserMap(aModes, ["<C-w><C-w>","<C-w>w"], "move active panel", T.action_sw);
  mappings.addUserMap(aModes, ["<C-w>c"], "close tab panel", function(){T.action_sw(); T.stopSplit();});
  mappings.addUserMap(aModes, ["<C-w>o"], "close tab panel", T.stopSplit);
  mappings.addUserMap(aModes, ["<C-w>v","<C-w><C-v>"], "split vertical tab panel", T.map_split("v"));
  mappings.addUserMap(aModes, ["<C-w>s","<C-w><C-s>"], "split vertical tab panel", T.map_split("h"));
  mappings.addUserMap(aModes, ["<C-w>r","<C-w><C-r>"], "split tab panel",          T.action_r);
  mappings.addUserMap(aModes, ["<C-w>x","<C-w><C-x>"], "split tab panel",          T.action_x);
  //}}}

  //{{{ commands
  commands.addUserCommand(T.names      , T.desc , T.action_vs , null , true);
  commands.addUserCommand(["sp[lit]"]  , T.desc , T.action_hs , null , true);
  //}}}
})();
