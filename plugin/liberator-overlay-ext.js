// vim:set sw=4 ts=4 et:
var INFO = //{{{
<plugin name="liberator-overlay-ext-2" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/liberator-overlay-ext.js"
        summary="liberator overlay 2"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            <p>
                liberator.echo と completer の 表示方法を変更します。

                また、表示 box には、userStyle Sheet で 利用できるよう class 属性 に "liberator-overlay"が 付与しています。
                Firefox 4b7 以上推奨
            </p>
        </description>
    </item>
    <item>
      <tags> g:overlayStyle </tags>
      <spec> let g:overlayStyle </spec>
      <description>
        box の style を設定
      </description>
    </item>
</plugin>; //}}}
(function (self) {
    let style = document.createElementNS(XHTML, "style");
    style.innerHTML = <><![CDATA[
        .liberator-overlay {
            position: fixed;
            width: 100%;
            max-height: 80%;
        }
        .liberator-overlay > iframe {
            height: 100%;
            width: 100%;
        } ]]>
        .liberator-overlay {"{"}
            {liberator.globalVariables.overlayStyle || <>
                /*border-top: 1px dotted gray;*/
                opacity: 0.8;
                -moz-transition: all 0.25s;
            </>}
        {"}"}
    </>;
    document.documentElement.appendChild(style);

    function watchHeight(id, oldVal, newVal) {
        this.style.height = /^[0-9.]+$/.test(newVal) ? newVal + "px" : newVal;
        return newVal;
    }
    function watchCollapsed(id, oldVal, newVal) {
        if (newVal === true) {
            this.style.height = "0px";
        } else {
            let e = document.getElementById("addon-bar") || document.getElementById("status-bar");
            this.style.bottom = (document.documentElement.boxObject.height - e.boxObject.y) + "px";
        }
        return newVal;
    }

    const liberatorMultilineOutput = "liberator-multiline-output";
    const liberatorCompletions     = "liberator-completions";

    watchEvent(liberatorCompletions);
    watchEvent(liberatorMultilineOutput);
    
    function watchEvent (id) {
        let vbox = document.getElementById(id).parentNode;
        vbox.classList.add("liberator-overlay");
        vbox.watch("height", watchHeight);
        vbox.watch("collapsed", watchCollapsed);
    }

    function unwatchEvent (id) {
        let vbox = document.getElementById(id).parentNode;
        vbox.classList.remove("liberator-overlay");
        vbox.unwatch("height");
        vbox.unwatch("collapsed");
    }

    self.onUnload = function () {
        document.documentElement.removeChild(style);
        unwatchEvent(liberatorCompletions);
        unwatchEvent(liberatorMultilineOutput);
    }
})(this);
