// vim: set et sw=4 ts=4:
"use strict";

var INFO =
xml`<plugin name="option selector" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/optionSelector.js"
        summary="option select"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator"/>
    <item>
        <description tag="i_<C-i>@select">
            <p>
                <k><![CDATA[i_<C-i>]]></k>を拡張
                select を 補完リストを使用して選択します。
            </p>
            <p>
                ヒント を 複数選択して、action を 実行します。

                絞り込み方法は、<o>hintmatching</o> で決定します。
            </p>
        </description>
    </item>
    <item>
        <tags>'optionselectautoshow'</tags>
        <spec>'optionselectautoshow'</spec>
        <type>boolean</type>
        <default>true</default>
        <description>
            call 時に 自動で 補完リストを開く
        </description>
    </item>
</plugin>`
;
(function(){
    const key = "optionselectautoshow";
    options.add([key], "select completer auto show", "boolean", true);

    mappings.addUserMap([modes.INSERT], ["<C-i>"], "", () => {
        if (is(liberator.focus, HTMLSelectElement))
            selectInput(liberator.focus);
        else
            events.feedkeys("<C-i>", true, true);
    });

    function has(a, b) (b in a)
    function is(a, b) a instanceof b
    function selectInput (elem) {
        if (!elem) elem = liberator.focus;
        if (!is(elem,HTMLSelectElement)) return;
        commandline.input((elem.name || "noname") + ":", function (arg) {
            let selected = /^(\d+)/.exec(arg.trim())[1];
            if (!selected) return;

            elem.selectedIndex = selected;
            //let evt=events.create(elem.ownerDocument,"change");
            let evt = elem.ownerDocument.createEvent("HTMLEvents");
            evt.initEvent("change",true,true);
            elem.dispatchEvent(evt);
        },
        {
            completer: function (context) {
                if (elem.options.length === 0) return;

                context.filter = context.filter.trim();
                context.anchored = false;

                let matcher = hints._hintMatcher(context.filter);
                context.match = matcher;
                context.compare = null;
                //context.filters = [CompletionContext.Filter.textAndDescription];

                let parent = elem;
                let aContext = context;
                let list = [["", ""]];

                let ic = 0;
                for (let opt of elem.options) {
                  if (parent !== (parent = opt.parentNode)) {
                        if (list.length) {
                            aContext.completions = list;
                        }
                        aContext = aContext.fork(ic++, 0);
                        let label = parent.label || "";
                        aContext.title[0] = label;
                        aContext.match = matcher(label) ? function() true : matcher;
                        list = [];
                  }
                  if (!parent.disabled && !opt.disabled)
                    list.push(_getItem(opt));
                }
                aContext.completions = list;

                function _getItem(opt) [opt.index + ": " + opt.text, opt.value]
            },
            onCancel: function () {
                window.setTimeout(function() elem.focus(), 0);
            }
        });
        options[key] && commandline._tabTimer.tell({shitKey: false});
    }
})();
