// vim:set sw=4 ts=4 et:
var INFO = //{{{
<plugin name="liberator-overlay-ext" version="0.1.2"
        href="http://github.com/caisui/vimperator/blob/master/plugin/liberator-overlay-ext.js"
        summary="liberator overlay"
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
            <p>
                補完リストの背面を見る方法
            </p><p>
                vimperatorrc  に 以下コードを追加でトグル表示できます。
                <example><ex><![CDATA[
                    :js mappings.addUserMap([modes.COMMAND_LINE], ["<C-g>"], "", function () plugins.liberatorOverlayExt.toggleShowBackground());
                ]]></ex></example>
            </p>
        </description>
    </item>
    <item>
      <tags> overlayanimation oani </tags>
      <spec> set [no]overlayanimation </spec>
      <type>boolean</type>
      <default>false</default>
      <description>
        animation の ON/OFF
        <note> rc file には autocmd 経由で 設定する必要があります</note>
        <example>
        :autocmd VimperatorEnter ".*" set [no]overlayanimation
        </example>
      </description>
    </item>
</plugin>; //}}}
(function (self) {
    let style = document.createElementNS(XHTML, "style");
    style.innerHTML = <![CDATA[
        .liberator-overlay {
            position: fixed;
            width: 100%;
            height: 100%;
            max-height: 10px;
            min-height: 10px;
        }
        .liberator-overlay.animation[collapsed='true'] {
            opacity: 0;
            background-color: black;
            pointer-events: none;
            visibility: visible;
            max-height: 0px !important;
        }
        .liberator-overlay.showcontent:not([collapsed='true']) {
            opacity: .2;
            pointer-events: none;
        }

        #liberator-completions, #liberator-multiline-output {
            background-color: transparent;
        }

        .liberator-overlay > iframe {
            height: 100%;
            width: 100%;
        }
        .liberator-overlay.animation {
            -moz-transition: all .2s;
        }]]>;

    document.documentElement.appendChild(style);

    options.add(["overlayanimation", "oani"], "overlay animation", "boolean", false, {
        setter: function (newVal) {
            Array.forEach(document.querySelectorAll(".liberator-overlay"), function (e) {
                let nm = newVal ? "add" : "remove";
                e.classList[nm]("animation");
                if (commandline.updatePrompt)
                    e[nm + "EventListener"]("transitionend", updatePrompt, false);
            });
            return newVal;
        },
    });

    function updatePrompt(evt) {
        let elem = evt.target;
        if (!elem.collapsed) {
            commandline.updateMorePrompt();
        }
    }

    function watchHeight(id, oldVal, newVal) {
        let curHeight = parseInt(this.clientHeight);
        let newHeight = Math.min(parseInt(newVal), 0.8 * window.innerHeight);

        if (curHeight < newHeight) {
            this.style.maxHeight = newHeight + "px";
        }

        return newVal;
    }

    function watchCollapsed(id, oldVal, newVal) {
        if (newVal === true) {
            this.style.maxHeight = "1px";
            this.classList.remove("showcontent");
        } else {
            let e = document.getElementById("liberator-bottombar") || document.getElementById("status-bar");
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
        vbox.classList.remove("showcontent");
        vbox.unwatch("height");
        vbox.unwatch("collapsed");
        vbox.style.maxHeight = "";
    }

    self.toggleShowBackground = function _toggleBackground() {
        let box1 = document.getElementById(liberatorCompletions).parentNode;
        let box2 = document.getElementById(liberatorMultilineOutput).parentNode;

        if (!(box1.collapsed || box2.collapsed)) {
            if (!box1.classList.contains("showcontent"))
                box1.classList.add("showcontent");
            else if (!box2.classList.contains("showcontent"))
                box2.classList.add("showcontent");
            else {
                box1.classList.remove("showcontent");
                box2.classList.remove("showcontent");
            }
        } else if (!box1.collapsed)
            box1.classList.toggle("showcontent");
        else if (!box2.collapsed)
            box2.classList.toggle("showcontent");
    };
    self.onUnload = function () {
        options.overlayanimation = false;
        options.remove("oani");
        document.documentElement.removeChild(style);
        unwatchEvent(liberatorCompletions);
        unwatchEvent(liberatorMultilineOutput);
        delete self.onUnload;
    }
})(this);
