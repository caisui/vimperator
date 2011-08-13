// vim: set fdm=marker :
var INFO = //{{{
<plugin name="selection-scroll" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/selection-scroll.js"
        summary="Selction Scroll"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            選択範囲(caret)のスクロール を行います。<br/>
        </description>
        <description>
            標準 map
            <dl>
                <dt>zt</dt><dd>垂直 top に移動</dd>
                <dt>zb</dt><dd>垂直 bottom  に移動</dd>
                <dt>zz</dt><dd>垂直 center に移動</dd>
                <dt>zs</dt><dd>水平 top に移動</dd>
                <dt>z;</dt><dd>水平 bottom  に移動</dd>
                <dt>ze</dt><dd>水平 center に移動</dd>
            </dl>
            mapping sample
            <code>
                :nmap zz :js plugin.selectionScroll.scroll(50, -1){"<"}CR{">"}
            </code>
        </description>
    </item>
    <item>
        <tags> g:disabled_selection_scroll_map</tags>
        <spec> let g:disabled_selection_scroll_map </spec>
        <type>boolean</type>
        <default>false</default>
        <description>
              標準 割り当てmap を 利用しない場合 true にして下さい
        </description>
    </item>
</plugin>;
//}}}
(function(){
    //{{{ config
    var aModes = [
        modes.NORMAL,
        modes.CARET,
        modes.VISUAL
    ];

    var aData = {
        zb  : [100, -1 , true],
        zz  : [50 , -1],
        zt  : [0  , -1],
        zs  : [-1 , 0] ,
        ze  : [-1 , 100, true],
        "z;": [-1 , 50],
    };
    //}}}

    function selectionScroll(aVPercent, aHPercent, isFocus){
        var win = Buffer.focusedWindow;
        var doc = win.document;
        var selection = win.getSelection();
        isFocus = isFocus === true;

        if(!selection) return;
        if(!selection.anchorNode || !selection.focusNode) return;

        //{{{ 指定範囲の方向判定
        if(selection.anchorNode !== selection.focusNode){
            var r1, r2;
            r1 = doc.createRange();
            r1.setStart(selection.anchorNode,0);
            r2 = doc.createRange();
            r2.setStart(selection.focusNode,0);
            if(r1.compareBoundaryPoints(Range.START_TOSTART, r2) > 0){
                isFocus = !isFocus;
            }
        }//}}}

        selection.QueryInterface(Ci.nsISelection2 || Ci.nsISelectionPrivate)
            .scrollIntoView(
                isFocus
                ? Ci.nsISelectionController.SELECTION_FOCUS_REGION
                : Ci.nsISelectionController.SELECTION_ANCHOR_REGION
                ,true , aVPercent, aHPercent);
    }

    if (!liberator.globalVariables.disabled_selection_scroll_map)
        for (let [cmd, data] in Iterator(aData)) {
            mappings.addUserMap(aModes, [cmd], "scroll", (function(a) function () {
                selectionScroll.apply(this, a);
            })(data));
        }

    this.scroll = selectionScroll;
}).call(this);
