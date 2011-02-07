// vim:fdm=marker:et:
//
// used API(o=public API,x=not public API){{{
// o attachTabTo
// x collapseExpandAllSubtree
// o collapseExpandSubtree
// x getChildIndex
// o getChildTabs
// o getDescendantTabs
// o getFirstChildTab
// o getFirstTab
// o getLastChildTab
// o getLastTab
// o getNextSiblingTab
// o getParentTab
// o getPreviousSiblingTab
// o getRootTab
// o hasChildTabs
// x kACTION
// x moveTabSubTreeTo
// o partTab
// x performDrop
// o readyToOpenChildTab
// o rootTabs
// x showTabbar
// o stopToOpenChildTab}}}
//
// x _tPos
//

(function () {
  if(!("TreeStyleTabService" in window)) return;
  var mod = liberator.modules;
  var map = mod.mappings;
  var extra = {count: true};

  var setup = function (k, t, f) {
    map.remove(k, t);
    map.addUserMap([mod.modes.NORMAL], [k], t, function () {plugins.caisui.treeStyleTab[f].apply(this, arguments)}, extra);
  };

  //set mapping{{{
  setup("zn" , "tree style tab next parent tab" , "nextParentTab");
  setup("zN" , "tree style tab next root tab"   , "nextRootTab");
  setup("zj" , "tree style tab next tab"        , "nextTab");
  //setup("zp" , "tree style tab prev parent tab" , "prevParentTab");
  setup("zp" , "tree style tab prev parent tab" , "readyToOpenTabPaste");
  setup("zP" , "tree style tab prev root tab"   , "prevRootTab");
  setup("zk" , "tree style tab prev tab"        , "prevTab");
  setup("zd" , "remove tree tab"                , "removeTabSubTree");
  setup("zD" , "remove tree tab from top tree"  , "removeTabTreeAll");
  setup("zh" , "tree style tab parent tab"      , "parentTab");
  setup("zH" , "tree style tab root tab"        , "rootTab");
  setup("zl" , "tree style tab first child tab" , "firstChildTab");
  setup("zL" , "tree style tab first child tab" , "lastChildTab");
  setup("zu" , "move up"                        , "moveUp");
  setup("zU" , "move root"                      , "moveRoot");
  setup("d"  , "override remove tab"            , "removeTab");
  setup("zc" , "collapse subtree"               , "collapseSubtree");
  setup("zC" , "collapse subtree from root tab" , "collapseSubtreeFromRoot");
  setup("zm" , "collapse all subtree"           , "collapseAllSubtree");
  setup("zo" , "expand subtree"                 , "expandSubtree");
  setup("z^" , "goto first tab"                 , "firstTab");
  setup("z$" , "goto last tab"                  , "lastTab");
  setup("z@" , "ready to open child tab once"   , "readyToOpenChildTabOnce");
  setup("z'" , "ready to open child tab once"   , "readyToOpenTabOnce");
  setup("z[" , "ready to open child tab"        , "readyToOpenChildTab");
  setup("z]" , "stop to open child tab"         , "stopToOpenChildTab");
  setup("zg" , "show tabbar"                    , "showTabbar");
  setup("zx" , "mark tab"                       , "setMarkTab");
  setup("zv" , "move child tab"                 , "moveChildTab");
  setup("zV" , "show next tab"                  , "moveNextTab");
  setup("zt" , "open new tab child tab"         , "tabOpenChild");
  setup("zJ" , "move tab(direction:next)"       , "moveTabToNext");
  setup("zK" , "move tab(direction:previous)"   , "moveTabToPrebious");
  //}}}

  (plugins.caisui||(plugins.caisui = {}))
  .treeStyleTab = let(g = gBrowser, T = gBrowser.treeStyleTab,
  U1 = /*{{{*/{
    getLastRootTab: function () T.getRootTab(T.getLastTab(g)),
    gene_iterator: function (funcName, aTab, aLoop) {
      var action = T[funcName];
      while(1) yield aTab = action.call(T, aTab) || aLoop;
    },
    getNextTab: function (aTab, aCount) {
      var it = U1.gene_iterator("getNextSiblingTab", aTab, let(p = T.getParentTab(aTab)) p ? T.getFirstChildTab(p) : T.getFirstTab(g));
      while(aCount-->1) it.next();
      return it.next();
    },
    getPrevTab: function (aTab, aCount) {
      var it = U1.gene_iterator("getPreviousSiblingTab", aTab, let(p = T.getParentTab(aTab)) p ? T.getLastChildTab(p) : U1.getLastRootTab());
      while(aCount-->1) it.next();
      return it.next();
    },
    getParentTab: function (aTab, aCount) {
      let tab;
      for(let i = 0; i<aCount; ++i) {
        tab = T.getParentTab(aTab);
        if(tab) aTab = tab;
        else break;
      }return aTab;
    },
    performDrop: function (aTab, pTab, iTab) {
      if(!aTab) return;
      else if(pTab && T.getDescendantTabs(aTab).indexOf(pTab)>= 0) {
        liberator.echoerr("error:loop");
        return;
      }
      T.performDrop({
        action: (pTab ? T.kACTION_ATTACH : T.kACTION_PART) | T.kACTION_MOVE,
        parent: pTab,
        source: aTab,
        insertBefore: iTab,
        canDrop: true,
        //position: 0, //?
        //target: null,//?
      }, aTab);
    },
    getInsertBeforeTab: function (aTab) {
      var ret = null;
      for(let t = aTab; t; t = T.getParentTab(t)) {
        if(ret = T.getNextSiblingTab(t)) break;
      }
      return ret;
    },
    readyToOpenChildTabCore: function (aTab, aFlag) {
      T.readyToOpenChildTab(aTab, aFlag);
      var e = document.getElementById("liberator-statusline");
      e.setAttribute("style", "color:red;");
    },
    getMoveTabSubTreeToIndex: function (aTab, aCount, reverse) {
      let pTab = T.getParentTab(aTab);
      let tabs = pTab ? T.getChildTabs(pTab) : T.rootTabs;
      let src = T.getChildIndex(aTab, pTab);
      let dest = src + aCount;
      if(dest < 0) dest = 0;
      else if(dest >= tabs.length) dest = tabs.length - 1;
      if(src == dest) return -1;
      else if(src < dest) {
        dest = (function (aTab) {
          let t = T.getLastChildTab(aTab);
          return t ? arguments.callee.call(this, t) : aTab;
        })(tabs[dest])._tPos || -1;
      }else dest = tabs[dest]._tPos;
      return dest;
    },
    moveTabSubTreeToEx: function (aTab, aCount, reverse) {
      aCount = aCount || 1;
      if(aCount == -1) aCount = 1;
      if(reverse) aCount = -aCount;
      let index = U1.getMoveTabSubTreeToIndex(aTab, aCount);
      if(index >= 0) T.moveTabSubTreeTo(aTab, index);
    }
  }/*}}}*/
  ,
  U2 = /*{{{*/{
    nextTab: function (aCount) {
      g.selectedTab = U1.getNextTab(g.selectedTab, aCount);
    },
    nextParentTab: function (aCount) {
      g.selectedTab = U1.getNextTab(let(t = gBrowser.selectedTab) T.getParentTab(t) || T.getRootTab(t), aCount);
    },
    nextRootTab: function (aCount) {
      g.selectedTab = U1.getNextTab(T.getRootTab(g.selectedTab), aCount);
    },
    prevTab: function (aCount) {
      g.selectedTab = U1.getPrevTab(g.selectedTab, aCount);
    },
    prevParentTab: function (aCount) {
      g.selectedTab = U1.getPrevTab(let(t = g.selectedTab) T.getParentTab(t) || t, aCount);
    },
    prevRootTab: function (aCount) {
      g.selectedTab = U1.getPrevTab(T.getRootTab(g.selectedTab, aCount), aCount);
    },
    removeTab: function () {
      let t = g.selectedTab;
      if(!T.getNextSiblingTab(t) && !T.hasChildTabs(t)) {
        let p = T.getPreviousSiblingTab(t)||T.getParentTab(t);
        if(p) g.selectedTab = p;
      }
      g.removeTab(t);
    },
    parentTab: function (aCount) {
      g.selectedTab = U1.getParentTab(g.selectedTab, Math.max(aCount, 1));
    },
    rootTab: function () {
      g.selectedTab = T.getRootTab(g.selectedTab);
    },
    firstChildTab: function () {
      var t = T.getFirstChildTab(g.selectedTab);
      if(t) g.selectedTab = t;
    },
    lastChildTab: function () {
      var t = T.getLastChildTab(g.selectedTab);
      if(t) g.selectedTab = t;
    },
    removeTabSubTree: function (aCount) {
      if(aCount > 0) U2.parentTab(aCount);
      U2.collapseSubtree(0);
      let t = g.selectedTab;
      g.selectedTab = T.getNextSiblingTab(t) || T.getPreviousSiblingTab(t) || T.getParentTab(t) || t;
      g.removeTab(t);
    },
    removeTabTreeAll: function () {
      g.selectedTab = T.getRootTab(g.selectedTab);
      U2.removeTabSubTree(0);
    },
    collapseSubtree: function (aCount) {
      if(aCount > 0) U2.parentTab(aCount);
      T.collapseExpandSubtree(g.selectedTab, true);
    },
    collapseSubtreeFromRoot: function () {
      T.collapseExpandSubtree(T.getRootTab(g.selectedTab), true);
    },
    expandSubtree: function () {
      T.collapseExpandSubtree(g.selectedTab, false);
    },
    collapseAllSubtree: function () {
      T.collapseExpandAllSubtree(true);
    },
    firstTab: function () {
      g.selectedTab = let(t = g.selectedTab)
        let(p = T.getParentTab(t)) p ? T.getFirstChildTab(p)
        : T.getFirstTab(g);
    },
    lastTab: function () {
      g.selectedTab = let(t = g.selectedTab)
        let(p = T.getParentTab(t)) p ? T.getLastChildTab(p)
        : U1.getLastRootTab();
    },
    readyToOpenChildTabOnce: function () {
      U1.readyToOpenChildTabCore(g.selectedTab);
    },
    readyToOpenTabOnce: function () {
      U1.readyToOpenChildTabCore(let(t = g.selectedTab) T.getParentTab(t) || t);
    },
    readyToOpenTabPaste: function () {
      try{
      U1.readyToOpenChildTabCore(g.selectedTab, true);
      mappings.get(modes.NORMAL, "P").action();
      U2.stopToOpenChildTab();
      }catch(ex){liberator.echoerr(ex);}
    },
    readyToOpenChildTab: function () {
      U1.readyToOpenChildTabCore(g.selectedTab, true);
    },
    stopToOpenChildTab: function () {
      T.stopToOpenChildTab(g.selectedTab);
      var e = document.getElementById("liberator-statusline");
      e.removeAttribute("style");
    },
    showTabbar: function () {
      T.showTabbar();
    },
    setMarkTab: function () {
      markTab = g.selectedTab;
    },
    moveChildTab: function () {
      var t = g.selectedTab;
      if(markTab && T.getDescendantTabs(markTab).indexOf(t)>= 0) {
        liberator.echoerr("error:loop");
        return;
      }
      T.partTab(markTab);
      T.attachTabTo(markTab, t);
    },
    moveNextTab: function () {
      var t = gBrowser.selectedTab;
      U1.performDrop(markTab, T.getParentTab(t), U1.getInsertBeforeTab(t));
    },
    moveUp: function (aCount) {
      var t = g.selectedTab, p = U1.getParentTab(t, Math.max(aCount, 1));
      if(!p) return;
      U1.performDrop(t, T.getParentTab(p), U1.getInsertBeforeTab(p));
    },
    moveRoot: function () {
      var t = g.selectedTab, r = T.getRootTab(t);
      U1.performDrop(t, null, U1.getInsertBeforeTab(r));
    },
    tabOpenChild: function (aCount) {
      T.readyToOpenChildTab(U1.getParentTab(g.selectedTab, aCount), false);
      commandline.open(":", "tabopen ", liberator.modules.modes.EX);
    },
    moveTabToNext: function (aCount) {
      U1.moveTabSubTreeToEx(g.selectedTab, aCount);
    },
    moveTabToPrebious: function (aCount) {
      U1.moveTabSubTreeToEx(g.selectedTab, aCount, true);
    }
  }/*}}}*/) U2;

  //override reload map about:blank & treestyletab-group{{{
  (function (){
    let map = mappings.get(modes.NORMAL, "r");
    let f = map.action;
    if(f.original) f = f.original;

    map.action = function (){
      let url = content.window.document.documentURI;
      let m;
      if(url == "about:blank"){
        commandline.open(":", "open about:treestyletab-group?", modes.EX);
      }else if(m = /^(about:treestyletab-group\?)(.*)$/.exec(url)){
        commandline.open(":", <>open {m[1]}{decodeURI(m[2])}</>.toString(), modes.EX);
      }else f.apply(this, arguments);
    };
    map.action.original = f;
  })();//}}}
})();
