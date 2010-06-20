// vim: set sw=4 ts=4 et fdm=marker:
var INFO = //{{{
<plugin name="multi-hints" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/multi-hints.js"
        summary="multi select hint"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <tags>:mh :multihint &lt;C-;&gt;</tags>
        <spec>:multihints <a>action</a> <oa>(xpath|selector)</oa></spec>
        <description>
            <p>
                ヒント を 複数選択して、action を 実行します。
            </p>
            <a>action</a>
            <dl>
                <dt>follow</dt>     <dd>buffer.followLink を call</dd>
                <dt>yank</dt>       <dd>href または、src を クリップボードにコピー</dd>
                <dt>remove</dt>     <dd>対象を削除</dd>
                <dt>check</dt>      <dd>checked を trueにする</dd>
                <dt>uncheck</dt>    <dd>checked を falseにする</dd>
                <dt>open</dt>       <dd>href を 新しいタブで開く</dd>
                <dt>javascript</dt> <dd>javascript を 実行 選択したものは elems に 配列で格納されている</dd>
                <dt>save</dt>       <dd><k>;s</k>の複数版 (src も 保存可)</dd>
            </dl>
            <note>
                一意に定まるまで記述されていれば、認識します。
                ex) yで 始まるものが yank のみなら <ex>:mh y</ex>で yankが実行できます。
            </note>

            <a>xpath(or selector)</a>
            <p>
                xpath は <em>/</em>から 始まると xpath それ以外は selectorと見なします。
                <note>
                    selector は、<link topic="http://github.com/caisui/vimperator/blob/master/plugin/_hints-generate-ext.js">_hints-generate-ext.js</link>が必要です。
                </note>
                過去に入力したクエリは、completer で 補完できます。
            </p>
            <dl>
                <dt>action の 追加</dt>
                <dd>
                    <code><![CDATA[
                        plugins.multiHints.add("name", {
                            desc: "description",
                            default: "default xpath",
                            action: function (elems) {},
                        });]]>
                    </code>
                </dd>
                <dt>action の 削除</dt>
                <dd><code><![CDATA[
                    plugins.multiHints.remove("name");
                ]]></code></dd>
            </dl>
        </description>
    </item>
    <item>
        <tags><![CDATA[<C-;><Tab>]]></tags>
        <description>
            <k><![CDATA[;<Tab>]]></k>っぽい動作をします
        </description>
    </item>
</plugin>
; //}}}

(function (self) {
    let global = liberator.globalVariables;
    const use_mapping  = has(global, "multiHintsMapping") ?  global.multiHintsMapping  === "true" : true;
    const use_register = has(global, "multiHintsRegister") ? global.multiHintsRegister === "true" : true;

    let _hintModes = {
        follow: {
            desc: "follow link",
            default: "//a",
            action: function (elems) elems.forEach(function (n) buffer.followLink(n, liberator.NEW_BACKGROUND_TAB))
        },
        yank: {
            desc: "yank locations",
            default: "//*[@href]",
            action: function (elems) {
                let list = [];
                elems.forEach(function (n) list.push(n.href || n.src));
                util.copyToClipboard(list.join("\n"));
            }
        },
        remove: {
            desc: "remove node",
            default: "//div",
            action: function (elems) elems.forEach(function (n) n.parentNode.removeChild(n))
        },
        check: {
            desc: "checked input",
            default: "//input[@type='checkbox']",
            action: function (elems) elems.forEach(function (n) n.checked = true)
        },
        uncheck: {
            desc: "checked input",
            default: "//input[@type='checkbox']",
            action: function (elems) elems.forEach(function (n) n.checked = false)
        },
        open: {
            desc: "open link new tab",
            default: "//a[@href]",
            action: function (elems) liberator.open([e.href for([, e] in Iterator(elems)) if (e.href)], liberator.NEW_BACKGROUND_TAB)
        },
        javascript: {
            desc: "execute javascript",
            default: "",
            action: function (elems) {
                function onEscape () {
                    commandline.updateMorePrompt();
                }
                let local = {
                    __proto__: userContext,
                    elems: elems
                };
                commandline.input("js:",
                    function (args) {
                        try {
                            liberator.eval(args, local);
                            onEscape();
                        } catch (ex) { liberator.echoerr(ex); }
                    },
                    {
                        completer: function(context) {
                            context.getCache("evalContext", function() local);
                            javascript.complete(context);
                        },
                        onCancel: onEscape
                    }
                );
            }
        },
        save: {
            desc: "save",
            default: "//*[@href]",
            action: function (elems) elems.forEach(function (n){
                if (!n.href) {
                    n = {
                        __proto__: n,
                        href: n.src
                    };
                }
                buffer.saveLink(n, true);
            })
        }
    };

    util.extend(self, {
        add: function (name, param) {
            _hintModes[name] = param;
        },
        remove: function (name) delete _hintModes[name]
    });

    function MulitHintMatcher (label) {
        this._matchers = [];
        let nums = <>[{options.hintchars || "0-9"}]+</>;
        let re = RegExp(<>({nums})?([-;])?({nums})?</>);
        for ([, val] in Iterator(label.split(" "))) {
            let [, lt, range, gt] = re.exec(val);
            if(lt) lt = this.chars2num(lt);
            if(gt) gt = this.chars2num(gt);
            this._matchers.push( range
                ? function (n) (!lt || lt <= n) && (!gt || n <= gt)
                : function (n) n == lt
            );
        }
    }

    const historyQuery = "history-query";
    storage.newArray(historyQuery, { store: true, privateData: true });

    util.extend(MulitHintMatcher.prototype, {
        chars2num: hints._chars2num ? function (n) hints._chars2num(n) : function (n) n,
        match: function (n) this._matchers.some(function (m) m(n))
    });

    function has(a, b) (b in a)
    function echoerr(msg) liberator.echoerr(msg.toString());

    commands.addUserCommand(["multihints", "mh"], "hints action",
    function ([name, selector]) {
        let mode = "multihint.action";

        if(!has(_hintModes, name)) {
            let(names = [attr for(attr in _hintModes) if (attr.indexOf(name) === 0)]) {
                if (names.length === 1) name = names[0];
                else {
                    if (names.length > 0)
                        echoerr(<>{name} is ambiguous. {names.join(" ")}</>);
                    else
                        echoerr(<>unknown command: {name}</>);
                    return;
                }
            }
        }
        let cmd = _hintModes[name];
        let action = cmd.action;
        selector = selector || cmd.default;

        hints.addMode(mode, selector, function (elem) {
        }, /^\//.test(selector)
            ? function () selector
            : function (win) win.document.querySelectorAll(selector)
        );

        hints.hide();
        hints._hintMode = hints._hintModes[mode];

        hints._generate();
        hints._showHints();

        function onEscape () {
            delete hints._hintModes[mode];
            hints.hide();

            commandline.updateMorePrompt();
        }

        commandline.input(<>[{selector}]:</>, function (arg){
            let args = [];
            let list = hints._pageHints;
            let matcher = new MulitHintMatcher(arg);
            for (let i in util.range(0, list.length)) {
                if (matcher.match(i + 1))
                    args.push(list[i].elem);
            }

            if (args.length > 0) {
                let history = storage[historyQuery];
                history.mutate("filter", function (line) (line.value || line) != selector);
                history.push({
                    value: selector,
                    host: content.location.host
                });
                action(args);
            }
            onEscape();
        },
        {
            onCancel: onEscape
        });
    },
    {
        literal: 1,
        completer: function (context, args) {
            if(args.length < 2)
                context.completions = [[name, e.desc] for([name, e] in Iterator(_hintModes))];
            else {
                let list = [[n.value, n.host] for([, n] in storage[historyQuery])];
                list.reverse();
                context.completions = list;
            }
        }
    }, true);

    if (use_mapping) //{{{
        mappings.addUserMap([modes.NORMAL, modes.CARET], ["<C-;>"], "multi hint",
        function (arg) {
            let space = " ";
            if (!has(_hintModes, arg)) {
                let names = [attr for(attr in _hintModes) if (attr.indexOf(arg) === 0)];
                if (arg === "<Tab>") {
                    commandline.input("mh:", function (arg) {
                        commandline.open(":", "multihints " + arg + " ", modes.EX)
                    },
                    {
                        completer: function (context) {
                            context.completions = [[name, e.desc] for([name, e] in Iterator(_hintModes))];
                        }
                    });
                    return;
                }
                else if (names.length === 1)
                    arg = names[0];
                else if(names.length)
                    space = "";
                else {
                    liberator.echoerr("no action");
                    return;
                }
            }
            commandline.open(":", "multihints " + arg + space, modes.EX)
        },
        {
            arg: true
        });
    //}}}

    if (Register && use_register) //{{{
    {
        const prompt = "builder.select.node";
        Register.add("q", function () {
            Register.inputEx({
                prompt: "query:",
                action: function (tag) {
                    let self = this;
                    tag = tag || "*";
                    tag = [ a.trim() for([, a] in Iterator(tag.split(",")))];

                    hints.addMode(prompt, "select node:", function () { }, function () util.makeXPath(tag));
                    hints._hintMode = hints._hintModes[prompt];
                    hints._generate();
                    hints._showHints();
                    commandline.input("query[2]:", function (arg) {
                        let elems = [];
                        let list = hints._pageHints;
                        let matcher = new MulitHintMatcher(arg);
                        for (let i in util.range(0, list.length)) {
                            if (matcher.match(i + 1))
                                elems.push(list[i].elem);
                        }
                        
                        if (elems.length === 0) {
                            self.cancel();
                            return;
                        }

                        function parent (elem) {
                            for (; elem; elem = elem.parentNode) yield elem
                        }

                        let parentId = [e.id for (e in parent(elems[0].parentNode)) if (e.id)];
                        let classList = [c for (c in util.Array.itervalues(elems[0].classList))];

                        for (let i in util.range(1, elems.length)) {
                            let elem = elems[i];

                            parentId = [e.id for (e in parent(elem.parentNode)) if (e.id)]
                                .filter(function(n) parentId.indexOf(n) >= 0);
                            classList = [c for (c in util.Array.itervalues(elem.classList))]
                                .filter(function(n) classList.indexOf(n) >= 0);
                        }

                        let res = "";
                        if (parentId.length)
                            res += <>#{parentId[0]} </>.toString();
                        res += classList.length
                            ? <>{tag[0]}.{classList.join(".")}</>
                            : tag[0];

                        hints.hide();
                        self.restore(res);
                    },
                    {
                        onCancel: function() hints.hide() || self.cancel()
                    });
                }
            });
        });
    }//}}}
})(this);
