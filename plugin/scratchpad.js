// vim: set ft=javascript fdm=marker:
var INFO = //{{{
<plugin name="scratchpad" version="0.0.3"
        href="http://github.com/caisui/vimperator/blob/master/plugin/scratchpad.js"
        summary="Scratchpad Command"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <spec>:scratchpad <oa>-c|r|w</oa> <oa>-ft type</oa> <oa>subcommand</oa></spec>
        <description>
            Scratchpad を 開きます。
        </description>
    </item>
</plugin>;
//}}}

var fileType = [
    ["js", "javascript"],
    ["java", "java"],
    ["html", "html"],
    ["xml", "xml"],
    ["css", "Style Sheet"],
];

function installLiberatorEnv(win) {
    var doc = win.document;
    const ID = "sp-menu-liberator";

    if (doc.getElementById(ID)) return;

    var e = doc.createElement("menuitem");
    e.setAttribute("label", "Liberator");
    e.setAttribute("type", "radio");
    e.id = ID;
    doc.getElementById("sp-menu-environment").appendChild(e);

    var Scratchpad = win.Scratchpad;
    Scratchpad.setLiberatorContext = function setLiberatorContext() {
        if (this.executionContext == SCRATCHPAD_CONTEXT_LIBERATOR) { return; }
        this.executionContext = SCRATCHPAD_CONTEXT_LIBERATOR;
        var notify = this.notificationBox
        notify.appendNotification(
            "liberator mode", SCRATCHPAD_CONTEXT_LIBERATOR, null, notify.PRIORITY_WARNING_HIGH + 1, null);
        this.resetContext();
    };
    e.addEventListener("command", Scratchpad.setLiberatorContext.bind(Scratchpad), false);

    const SCRATCHPAD_CONTEXT_CONTENT = 0;
    const SCRATCHPAD_CONTEXT_BROWSER = 1;
    const SCRATCHPAD_CONTEXT_LIBERATOR = 2;
    Scratchpad.evalForContext = function (aString) {
        var res;
        if (this.executionContext === SCRATCHPAD_CONTEXT_CONTENT)
            res = this.evalInContentSandbox(aString);
        else if (this.executionContext === SCRATCHPAD_CONTEXT_BROWSER)
            res = this.evalInChromeSandbox(aString);
        else
            res = this.evalInLiberatorSandbox(aString);

        return res;
    };
    Scratchpad.evalInLiberatorSandbox = function evalInLiberatorSandbox(aString) {
        var error, result;
        try {
            //result = Cu.evalInSandbox(aString, this.chromeSandbox, "1.8", "Scratchpad", 1);
            result = liberator.eval(aString, Object.create(modules.userContext));
        } catch (ex) {
            error = ex;
        }

        return [error, result];
    };
}

function installAllWindow() {
    for(w in iter(services.get("windowMediator").getEnumerator("devtools:scratchpad"))) {
        installLiberatorEnv(w);
    }
}

function domEvent1(dom, name, callback, capture) {
    dom.addEventListener(name, function _once(e) {
        dom.removeEventListener(name, _once, capture);
        callback.call(this, e);
    }, capture);
}

function tabopen(callback) {
    var tab = gBrowser.addTab("chrome://browser/content/scratchpad.xul");
    domEvent1(tab.linkedBrowser, "load", function () {
        var win = this.contentWindow;
        var Scratchpad = this.contentWindow.Scratchpad;
        domEvent1(Scratchpad.editor._iframe, "load", function () {
            if (Scratchpad.editor._view) {
                callback(win);
                gBrowser.selectedTab = tab;
                return;
            }
            var TextView = Scratchpad.editor._iframe.contentWindow.wrappedJSObject.orion.textview.TextView;

            //xxx: document.write(xx) -> document.documentElement.innerHTML = xx;
            var _init = TextView.prototype._init.toString()
            .replace(<![CDATA[html.push("<!DOCTYPE html>");]]>.toString()  , '')
            .replace(<![CDATA[html.push("<html>");]]>.toString()           , '')
            .replace(<![CDATA[html.push("</html>");]]>.toString()          , '')
            .replace(<![CDATA[document.open();]]>.toString()               , '')
            .replace(<![CDATA[document.write(html.join(""));]]>.toString() , '')
            .replace(<![CDATA[document.close();]]>.toString(),
                <![CDATA[document.documentElement.innerHTML = html.join("");]]>.toString());

            //xxx: compatMode 変更方法が分からないので
            var src = TextView.prototype._getFrameHeight.toString().replace("documentElement", "body");

            liberator.eval("this.prototype._init = " + _init + ";"
                + "this.prototype._getFrameHeight = " + src + ";"
                , TextView);
            Scratchpad.editor._onLoad(function () {
                Scratchpad.onEditorLoad.apply(Scratchpad, arguments);
                callback(win);
                gBrowser.selectedTab = tab;
            });
        }, true);
    }, true);
}

function callScratchPad(args, callback) {
    function action(win) {
        var Scratchpad = win.Scratchpad;

        if (args["-ft"]) Scratchpad.editor.setMode(args["-ft"]);
        if (args["-c"]) {
            Scratchpad.setBrowserContext();
            if (Scratchpad.editor.getMode() == "js") {
                let scanner = Scratchpad.editor._styler._scanner;
                let keywords = scanner.keywords;
                if (keywords.indexOf("let") == -1) {
                    scanner.keywords = keywords.concat("let");
                }
            }
        } else if (args["-v"]) {
            Scratchpad.setBrowserContext();
            if (Scratchpad.editor.getMode() == "js") {
                let scanner = Scratchpad.editor._styler._scanner;
                let keywords = scanner.keywords;
                if (keywords.indexOf("let") == -1) {
                    scanner.keywords = keywords.concat("let");
                }
            }
        }

        let readOnly = args["-r"];
        Scratchpad.filename = "";
        if (Scratchpad.editor.readOnly != readOnly)
            Scratchpad.editor.readOnly = readOnly;

        installLiberatorEnv(win);
        callback.call(Scratchpad, args);
        Scratchpad.editor._undoStack.reset();
    }

    function onLoad(win) {
        if (win.Scratchpad.addObserver)
            win.Scratchpad.addObserver({
                onReady: function () { action(win); },
            });
        else action(win);
    }

    if (args["-w"]) {
        var win = services.get("windowMediator").getEnumerator("devtools:scratchpad").getNext();

        if (win) {
            win.focus();
            action(win);
            return;
        }
    } else if (args["-t"]) {
        tabopen(action);
        return;
    }
    win = Scratchpad.openScratchpad();
    domEvent1(win, "load", function() onLoad(win), false);
}

commands.addUserCommand(["scratchpad"], "show Scratchpad", function (args) {
    callScratchPad(args, function () {
        let url = args[0];
        if (url) this.setText(util.httpGet(url).responseText);
    });
}, {
    options: [
        [["-w", "--window"], commands.OPTION_NOARG],
        [["-t", "--tab"],    commands.OPTION_NOARG],
        [["-c", "--chrome"], commands.OPTION_NOARG],
        [["-v", "--vimperator"], commands.OPTION_NOARG],
        [["-r", "--read"],   commands.OPTION_NOARG],
        [["-ft", "--filetype"], commands.OPTION_STRING, null, fileType],
    ],
    completer: function (context, args) { },
    subCommands: [
        Command(["javascript", "js"], "show execute javascript result", function (args) {
            callScratchPad(args, function (Scratchpad) {
                let text = String(liberator.eval(args[0]));
                this.setText(text);
            });
        }, {
            literal: 0,
            completer: completion.javascript
        }),
        Command(["f[ile]"], "show file", function (args) {
            callScratchPad(args, function () {
                let file = File(args[0]);
                this.filename = file.path;
                this.setText(file.read());
            });
        }, {
            literal: 0,
            completer: completion.file
        }),
        Command(["script"], "show script tag code", function (args) {
            callScratchPad(args, function() {
                let doc = args["-c"] ? document : content.document;
                var isAll = args["-a"] || args.length == 0, isSrc = args["-src"];
                var array =  Array.reduce(doc.getElementsByTagName("script"), function (array, node, i) {
                    let src = node.src || node.getAttribute("src");
                    i = i.toString();

                    if (src) {
                        if (isSrc || args.indexOf(src) >= 0 || args.indexOf(i) >= 0) {
                            array.push("//{{{" + src);
                            array.push(util.httpGet(src).responseText);
                            array.push("//" + src + "}}}");
                        }
                    } else if (isAll || args.indexOf(i) >= 0) {
                        array.push("//{{{ script[" + i + "]");
                        array.push(node.innerHTML);
                        array.push("//}}}");
                    }

                    return array;
                }, []);

                this.setText(array.join("\n"));
            });
        }, {
            options: [[["-a"], commands.OPTION_NOARG], [["-src"], commands.OPTION_NOARG], [["-c", "--chrome"], commands.OPTION_NOARG]],
            completer: function (context, args) {
                let doc = args["-c"] ? document : content.document;

                function compValue(dom, i) {
                    let src = dom.getAttribute("src");
                    return src ? [dom.src || src, ""] : [i.toString(), dom.innerHTML];
                }
                function uniq(val) args.indexOf(val[0]) == -1

                context.compare = null;
                context.anchored = false;
                context.filter = context.filter.trimLeft();
                context.completions = Array.map(doc.getElementsByTagName("script"),compValue).filter(uniq);
            }
        }),
        Command(["edit"], "edit", function (args) {
            let expression = args[0];
            let dom = expression ? liberator.eval(expression) : content.document.body;
            liberator.assert(dom instanceof Node, ";-)");
            callScratchPad({__proto__: args, "-ft": "html"}, function() {
                this.setText(dom.innerHTML);
                this.saveFile = function () {
                    dom.innerHTML = this.getText();
                };
            });
        }, {
            literal: 0,
            completer: completion.javascript,
        })
    ]
}, true);
