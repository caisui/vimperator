// vim: set fdm=marker:
if (parseFloat(Application.version) >= 4) {
    var INFO = //{{{
<plugin name="word-completer" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/word-completer.js"
        summary="word completer"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.4"/>
    <item>
    <description>
        page の 単語補完 用 plugin
    </description>
    </item>
    <item>
        <description>
            例
            <code><![CDATA[
                :js <<EOF
                // 入力状態から割込み 単語補完
                userContext.word_completer_maps = [
                    [[modes.COMMAND_LINE, modes.INSERT], ["<C-Space>"], {screen: true}],
                ];
                // 単語補完 後 指定 コマンドを実行
                userContext.word_completer_shortcut = {
                    modes: [modes.NORMAL],
                    maps: ["<C-t>"],
                    extra: {screen: true},
                    t: "tabopen",
                    o: "open",
                    e: "eijiro",
                    w: "tabopen wikipedia",
                };
                EOF
            ]]></code>

            末尾追加でない場合は、&gt;word&lt;を含めれば置換されます。

            <code><![CDATA[
            {
                t: "command <word> xxxx xxx",
            }
            ]]></code>
        </description>
    </item>
</plugin>;
//}}}

    let lazyGetter = function (obj, name, callback) {
        obj.__defineGetter__(name, function lazyFunc() {
            delete this[name];
            return this[name] = callback.call(this);
        });
    };
    lazyGetter(this, "kanji", function () {
        // http://ja.wikipedia.org/wiki/UNICODE#.E4.B8.80.E8.A6.A7
        var code = <![CDATA[
            U+2E80-2EFF
            -U+3000-303F #CJKの記号及び句読点
            U+31C0-31EF
            -U+3200-32FF #囲みCJK文字・月
            U+3300-33FF
            U+3400-4DBF
            U+4E00-9FFF
            U+F900-FAFF
            U+FE30-FE4F
            U+20000-2A6DF
            U+2A700-2B73F
            U+2B740-2B81F
            U+2F800-2FA1F
        ]]>.toString();
        var res = "[", match, re = /\sU\+([0-9A-F]+)-([0-9A-F]+)/g;
        while (match = re.exec(code)) {
            res += <>\u{match[1]}-\u{match[2]}</>.toString();
        }
        res += "]{2,}";
        delete this.kanji;
        return this.kanji = res;
    });
    lazyGetter(this, "source", function () {
        var name = "plugin_word_completer_patten";
        if (name in liberator.globalVariables) return liberator.globalVariables[name];

        return "(" + [
            <>(?:ht|t|f)tps?://[-a-zA-Z0-9%/.]+(?:\?.+)?</>, // url
            <>\d+/\d+/\d+</>,
            <![CDATA[[-a-zA-Z_0-9.]+[-a-zA-Z_0-9]]]>, // alphabet
            <![CDATA[[\u30a0-\u30ff]{2,}]]>, //カタカナ
            kanji,
        ].join("|") + ")";
    });

    function getUtils(win)
        win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils)
    function getSelectionControllerFromWindow (view) {
        let selectionController = null;
        try {
        selectionController = view
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIWebNavigation)
            .QueryInterface(Ci.nsIDocShell)
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsISelectionDisplay)
            .QueryInterface(Ci.nsISelectionController);
        } catch (ex) {}

        return selectionController;
    }
    let Rect = function Rect(x, y, w, h) ({x: x, y: y, width: w, height: h});

    function iterScreenText(win, extra) {
        if (!extra) extra = {};
        var rect = extra.rect || Rect(0, 0, win.innerWidth, win.innerHeight);
        var nodes = Array.slice(getUtils(win).nodesFromRect(rect.x, rect.y, 0, rect.width, rect.height, 0, true, true));
        var node;
        var selCon = getSelectionControllerFromWindow(win);
        var text;

        for (var i = 0, j = nodes.length; i < j; i++) {
            node = nodes[i];
            if (node.nodeType !== Node.TEXT_NODE) continue;
            text = node.data;
            //if (text.substring(0, 2) !== "\u200e\u200f" && !selCon.checkVisibility(node, 0, 0)) continue;
            yield node.data;
        }

        if (extra.subFrames !== false) {
            var frame, frameRect;
            for (var i = 0, j = win.frames.length; i < j; i++) {
                frame = win.frames[i];
                frameRect = frame.frameElement.getBoundingClientRect();
                var frameExtra = Object.create(extra);
                frameExtra.rect = Rect(
                    Math.min(0, frameRect.left),
                    Math.min(0, frameRect.top),
                    Math.min(rect.width - frameRect.left, frameRect.width),
                    Math.min(rect.height - frameRect.top, frameRect.height)
                );

                for (var text in iterScreenText(frame, frameExtra))
                    yield text;
            }
        }
    }

    function iterWindowText(win, extra) {
        if (!extra) extra = {};
        var encoder =
            Cc["@mozilla.org/layout/documentEncoder;1?type=text/plain"].createInstance(Ci.nsIDocumentEncoder);
        var doc, frames = [win ? win : content.window];
        var match, word, key;
        while (win = frames.shift()) {
            doc = win.document;
            encoder.init(doc, "text/plain", encoder.OutputBodyOnly | encoder.SkipInvisibleContent);
            encoder.setNode(doc.body);
            var str = encoder.encodeToString();

            yield str;

            if (extra.subFrames !== false)
                frames.push.apply(frames, Array.slice(doc.defaultView.frames));
        }
    }

    function getWords(win, extra) {
        if (!win) win = content.window;
        if (!extra) extra = {subFrames: true};

        var re = new RegExp(source, "g");
        var seen = {}, res = [];
        for (var str in extra.screen
                ? iterScreenText(win, extra) : iterWindowText(win, extra)) {

            while (match = re.exec(str)) {
                word = match[1];
                key = word.toLowerCase();
                if (key in seen) {
                    seen[key][1]++;
                } else {
                    res.push(seen[key] = [word, 1]);
                }
            }
        }

        return res;
    };

    function wordCompleter(context, extra) {
        context.anchored = false;
        context.compare = null;
        context.match = hints._hintMatcher(context.filter);

        var words = context.getCache("words", function () getWords(context.window, extra));
        context.completions = words;
    }

    function wordCompleterMulti(context, extra) {
        var index = context.filter.lastIndexOf(" ");
        if (index > 0)
            context.advance(index + 1);
        wordCompleter(context, extra);
    }

    let calledWordInput = false;

    function interruptPrompt(extra) {
        if (calledWordInput)
            throw "do not support recursion";
        else if (modes.extended === modes.HINTS)
            throw "do not support HINT";

        calledWordInput = true;
        var oldMode = liberator.mode;
        var extended = modes.extended;
        var restore;

        if (oldMode === modes.COMMAND_LINE) {
            var box = commandline._commandWidget;
            var editor = box.editor;
            let (comp = commandline._completions) comp && comp.previewClear();
            var str = box.value;
            var prompt = commandline._promptWidget.value;
            if (extended === modes.PROMPT) {
                var _input = commandline._input;
                restore = function () {
                    commandline.input(prompt, _input.submit, {
                        onChange: _input.change,
                        completer: _input.complete,
                        onCancel: _input.cancel,
                    });
                };
            } else
                restore = function (callback) {
                    commandline.open(prompt, str, modes.EX);
                };
        } else if (oldMode === modes.INSERT) {
            var box = liberator.focus;
            var editor = box.QueryInterface(Ci.nsIDOMNSEditableElement).editor;
            var restore = function (callback) {
                box.focus();
                modes.set(modes.INSERT, extended);
            }
        }

        var start = box.selectionStart;
        var end = box.selectionEnd;

        restore = let (func = restore) function wrap(callback) {
            //xxx: after commandline hide
            window.setTimeout(function () {
                box.selectionStart = start;
                box.selectionEnd = end;
                calledWordInput = false;
                func();
                callback && callback();
            }, 0);
        };

        commandline.input("word", function (args) {
            restore(function () {
                try {
                    editor.QueryInterface(Ci.nsIPlaintextEditor)
                    if (editor.deleteSelection.length === 2)
                        editor.deleteSelection(editor.eNone, editor.eStrip);
                    else
                        editor.deleteSelection(editor.eNone);
                    editor.insertText(args);
                } catch (ex) {
                    Cu.reportError(ex);
                }
            });
        }, {
            completer: function (context) wordCompleter(context, extra),
            onCancel: restore,
        });
    }

    if (userContext.word_completer_maps) {
        userContext.word_completer_maps.forEach(function ([modes, map, extra]) {
            mappings.addUserMap(modes, map, "word completer", function () {
                interruptPrompt(extra);
            });
        });
    }
    if (userContext.word_completer_shortcut) {
        let d = userContext.word_completer_shortcut;
        mappings.addUserMap(d.modes, d.maps, "page word's shortcut", function (arg) {
            if (arg in d) {
                commandline.input(d[arg] + " ", function (word) {
                    var str = d[arg];
                    if (str === (str = str.replace("<word>", word)))
                        str += " " + word;
                    liberator.execute(str);
                }, {
                    completer: function(context) wordCompleter(context, d.extra),
                });
            }
        }, { arg: true });
    }

    commands.addUserCommand(["wordcompl"], "", function (args) {
        util.copyToClipboard(args.string, true);
    }, {
        completer: function (context, args) {
            context.anchored = false;
            context.compare = null;
            context.generate = function () {
                return getWords(content.window);
            };
        }
    }, true);
}
