// vim:set fdm=marker et sw=4 ts=4:
var INFO = //{{{
<plugin name="treeStyleTab" version="0.0.2"
        href="http://github.com/caisui/vimperator/blob/master/plugin/treeStyleTab.js"
        summary="Tree Stye Tab"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            Tree Style Tab を 操作 するためのpluginです<br/>

            <li>2011.03.09 Firefox 4.0b13pre で 動作確認</li>
        </description>
    </item>
    <item>
        <tags> g:disabled_tree_style_tab_default_map </tags>
        <spec> let g:disabled_tree_style_tab_default_map </spec>
        <type>boolean</type>
        <default>false</default>
        <description>
            plugin 標準 map の 定義 を しない
        </description>
    </item>
    <item>
        <tags> g:disabled_tree_style_tab_reload_action </tags>
        <spec> let g:disabled_tree_style_tab_reload_action </spec>
        <type>boolean</type>
        <default>false</default>
        <description>
            about:blank に対して <k name="r"/> で about:treestyletab-group に 置換する機能を利用しない
        </description>
    </item>
</plugin>; //}}}

(function () {
    if(!("TreeStyleTabService" in window)) return;
    const self = this;

    var extra = {count: true};

    var setup = function (key, desc, f) {
        mappings.remove([modes.NORMAL], key);
        mappings.addUserMap([modes.NORMAL], [key], desc, function () self.control[f].apply(this, arguments), extra);
    };

    if (!liberator.globalVariables.disabled_tree_style_tab_default_map) //set mapping{{{
    {
        setup("zn"   , "tree style tab next parent tab" , "nextParentTab");
        setup("zN"   , "tree style tab next root tab"   , "nextRootTab");
        setup("zj"   , "tree style tab next tab"        , "nextTab");
        setup("zp"   , "tree style tab prev parent tab" , "prevParentTab");
        setup("zP"   , "tree style tab prev root tab"   , "prevRootTab");
        setup("zk"   , "tree style tab prev tab"        , "prevTab");
        setup("zd"   , "remove tree tab"                , "removeTabSubTree");
        setup("zD"   , "remove tree tab from top tree"  , "removeTabTreeAll");
        setup("zh"   , "tree style tab parent tab"      , "parentTab");
        setup("zH"   , "tree style tab root tab"        , "rootTab");
        setup("zl"   , "tree style tab first child tab" , "firstChildTab");
        setup("zL"   , "tree style tab first child tab" , "lastChildTab");
        setup("zu"   , "move up"                        , "moveUp");
        setup("zU"   , "move root"                      , "moveRoot");
        setup("d"    , "override remove tab"            , "removeTab");
        setup("zc"   , "collapse subtree"               , "collapseSubtree");
        setup("zC"   , "collapse subtree from root tab" , "collapseSubtreeFromRoot");
        setup("zm"   , "collapse all subtree"           , "collapseAllSubtree");
        setup("zo"   , "expand subtree"                 , "expandSubtree");
        setup("z^"   , "goto first tab"                 , "firstTab");
        setup("z$"   , "goto last tab"                  , "lastTab");
        setup("z@"   , "ready to open child tab once"   , "readyToOpenChildTabOnce");
        setup("z'"   , "ready to open child tab once"   , "readyToOpenTabOnce");
        setup("z["   , "ready to open child tab"        , "readyToOpenChildTab");
        setup("z]"   , "stop to open child tab"         , "stopToOpenChildTab");
        setup("zg"   , "show tabbar"                    , "showTabbar");
        setup("zx"   , "mark tab"                       , "setMarkTab");
        setup("zv"   , "move child tab"                 , "moveChildTab");
        setup("zV"   , "show next tab"                  , "moveNextTab");
        setup("zt"   , "open new tab child tab"         , "tabOpenChild");
        setup("zJ"   , "move tab(direction:next)"       , "moveTabToNext");
        setup("zK"   , "move tab(direction:previous)"   , "moveTabToPrebious");
    }
    //}}}

    const g = gBrowser;
    const T = gBrowser.treeStyleTab;

    function repeat(aCount, func) {
        for (let i = 0; i < aCount; ++i) {
            if (func(i) === false) break;
        }
    }

    let U1 = this.helper = //{{{
    {
        getLastRootTab: function () T.getRootTab(T.getLastTab(g)),
        gene_iterator: function (funcName, aTab, aLoop) {
            var action = T[funcName];
            while (1) yield aTab = action.call(T, aTab) || aLoop;
        },
        getNextTab: function (aTab, aCount) {
            var it = U1.gene_iterator("getNextSiblingTab", aTab, let(p = T.getParentTab(aTab)) p ? T.getFirstChildTab(p) : T.getFirstTab(g));
            while (aCount-->1) it.next();
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
            else if (dest >= tabs.length) dest = tabs.length - 1;
            if (src == dest) return -1;
            else if (src < dest) {
                dest = (function (aTab) {
                    let t = T.getLastChildTab(aTab);
                    return t ? arguments.callee.call(this, t) : aTab;
                })(tabs[dest])._tPos || -1;
            } else dest = tabs[dest]._tPos;
            return dest;
        },
        moveTabSubTreeToEx: function (aTab, aCount, reverse) {
            aCount = aCount || 1;
            if (aCount == -1) aCount = 1;
            if (reverse) aCount = -aCount;
            let index = U1.getMoveTabSubTreeToIndex(aTab, aCount);
            if (index >= 0) T.moveTabSubTreeTo(aTab, index);
        }
    };//}}}

    let U2 = this.control = //{{{
    {
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
            this.markTab = g.selectedTab;
        },
        moveChildTab: function () {
            var t = g.selectedTab;
            if(this.markTab && T.getDescendantTabs(this.markTab).indexOf(t)>= 0) {
                liberator.echoerr("error:loop");
                return;
            }
            T.partTab(this.markTab);
            T.attachTabTo(this.markTab, t);
        },
        moveNextTab: function () {
            var t = gBrowser.selectedTab;
            U1.performDrop(markTab, T.getParentTab(t), U1.getInsertBeforeTab(t));
        },
        moveUp: function (aCount) {
            repeat(Math.max(aCount, 1), function () T.promoteCurrentTab());
        },
        moveRoot: function () {
            let aTab = g.selectedTab;
            let aRoot = T.getRootTab(aTab);
            let aNext = T.getNextSiblingTab(aRoot);
            if (aNext)
                g.moveTabTo(aTab, aNext._tPos -1);
            else
                g.moveTabToEnd();
            T.partTab(aTab);
        },
        moveDown: function (aCount) {
            repeat(Math.max(aCount, 1), function () T.demoteCurrentTab());
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
    };//}}}

    //override reload map about:blank & treestyletab-group{{{
    if (!liberator.globalVariables.disabled_tree_style_tab_reload_action) {
        let map = mappings.get(modes.NORMAL, "r");
        const aURI = "about:treestyletab-group";
        mappings.addUserMap([modes.NORMAL], ["r"], map.description + " (treeStyleTab.js mode)", function () {
            let uri = content.document.location.href;
            if (uri === "about:blank")
                commandline.open(":", <>open {aURI}?</>.toString(), modes.EX);
            else if (uri.substr(0, aURI.length) === aURI)
                commandline.open("", "open " + util.losslessDecodeURI(uri), modes.EX);
            else
                tabs.reload(config.browser.mCurrentTab, false);
        });
    }//}}}
}).call(this);
