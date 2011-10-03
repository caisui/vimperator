// vim: set sw=4 ts=4 fdm=marker et :
//"use strict";
var INFO = //{{{
<plugin name="piyo-ui" version="0.2.2"
        href="http://github.com/caisui/vimperator/blob/master/plugin/piyo-ui.js"
        summary="piyo ui"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <description>
            以下の機能を提供する UIです。
            - 一覧の列挙
            - 列挙したものを絞り込む
            - 一覧から選択したものに対してコマンドを実行

<![CDATA[
ToDo:
- fold 機能
- 複数の sourceに 跨ぐ選択状態での command
- 折り返されずに文字が画面外にでる
- word ハイライト(not 絞り込み)
--> DOM
- view の 部分更新
- 個別 source 専用 stylesheet
-- 自source 以外には反映されない仕組み
- source を他 plugin から 拡張する手段
- 単一選択用/複数選択用 map/command を 認識できる手段
- 固有 map 一覧の確認方法
- item 生成用に 略記関数(wiki記法とか、zen codingのような)
- modes.reset への 対応策
- vim の quickfix のような表示方法
- normal,regex,migemo を mapで切り替え
- PiyoItem
-- property の 見直し

Test:
- stack 型多段 piyo
- Deferred っぽい仕組み


Bug:
- 高さ調整が上手くいかないパターンがある
-- 画像の読込による高さの変更
- 表示候補数0でmap, commandが 動かない


Done:
- 下部の余白に「~」
- source 固有map
- command
- 疑似非同期 item 列挙
- 絞り込み検索
- 否定検索

Test:
- iframe -> browser
-- setAttribute("type", "content-targetable") がないと isActive を利用できない
-- isActive で 描画の停止(速度面体感変化無し)
- nsIDOMWindowUtils
-- setDisplayPortForElement -> 意図しないタイミングでrepaintが走る
-- setCSSViewport -> がっつり透明になった
]]>
        </description>
    </item>
</plugin>;
//}}}

let interval = liberator.globalVariables.piyo_interval || 500;

/**
 * @param {Object}  cocnsole log
 */
function log() //{{{
{
    let msg = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    let stack = Components.stack.caller;
    //let category = "PIYO " + (new Date()).toLocaleFormat("%y.%m.%d-%H:%M:%S");
    //let category = "PIYO " + (new Date()).toLocaleFormat("%m%d %H:%M:%S");
    let category = "PIYO";
    let message = Array.concat((new Date()).toLocaleFormat("%m%d %H:%M:%S"), Array.splice(arguments, 0));
    msg.init(message, stack.filename, stack.sourceLine, stack.lineNumber, null, 0, category);
    services.get("console").logMessage(msg);
}//}}}

function lazyGetter(obj, name, func) {
    obj.__defineGetter__(name, function () {
        delete this[name];
        return this[name] = func.call(obj);
    });
}

function lazyGetterSrvc(obj, name, classID, interface) {
    obj.__defineGetter__(name, function() {
        delete this[name];
        return this[name] = Cc[classID].getService(interface);
    });
}

/**
 * @param {Object}
 * @param {Object}
 */
function nullOr(value, defaultValue) value === null ? defaultValue : value

let stopWatch = {
    start: function () this.t = Date.now(),
    end: function () log(Array.concat(Date.now() - this.t, Array.splice(arguments, 0)))
};

let fx3 = Application.version[0] === "3";
let disabledFixed = liberator.globalVariables.piyo_disabled_fixed;
let piyo = this;

function DelayTimer(self, minInterval, callback) //{{{
{
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    return {
        notify: function (aTimer) {
            timer.cancel();
            this.doneAt = Date.now();
            callback.apply(self, this.args);
        },
        tell:function () {
            if (this.doneAt === -1)
                timer.cancel();

            this.args = Array.splice(arguments, 0);

            timer.initWithCallback(this, minInterval, timer.TYPE_ONE_SHOT);
            this.doneAt = -1;
        },
        reset: function () {
            timer.cancel();
            this.doneAt = 0;
        },
        flush: function () {
            if (this.doneAt === -1) {
                this.args = Array.splice(arguments, 0);
                this.notify();
            }
        }
    };
}//}}}


let (self = this) lazyGetter(userContext, "Deferred", function () self.Deferred);
lazyGetter(this, "Deferred", function () //{{{
{
    // 参考: https://github.com/cho45/jsdeferred/
    var uuid = 0;
    function Deferred(func) {
        if (this instanceof Deferred) {
            this.init(func);
            this.uuid = ++uuid;
        } else
            return new Deferred(func);
    };
    var D = Deferred;

    D.prototype = {
        init: function (canceller) {
            this._canceller = canceller;
            this._callbacks = [];
            this._state = 0;
            this._parent = null;
            this._nest = null;
            this._result = null;
            this._msg = "ok";
            return this;
        },

        next:  function (callback) this._post({ok:callback}),
        error: function (callback) this._post({ng:callback}),
        both:  function (callback) this._post({ok:callback, ng:callback}),
        local: function (callback) {callback.call(this); return this;},
        scope: function (callback) {
            return this.next(function (val) { return callback.call(this, val);});
        },

        call: function (value) {
            this._msg = "ok";
            return this._fire(value)
        },
        fail: function (value) {
            this._msg = "ng";
            return this._fire(value);
        },

        // xxx: debug
        //get _msg ()  this.__msg,
        //set _msg (v) {
        //    this.__msg = v;
        //},

        _post: function (obj) {
            //if (this._nest) throw "it's runngin. cannot push action";
            this._callbacks.push(obj);

            if (this._state == Deferred.DONE) {
                var self = this.init();
                Deferred.next(function () self);
            }
            return this;
        },

        fire: function (value) {
            return this._fire(value);
        },

        // debug
        get _depth() {
            let count = 0, p = this;
            while (p = p._parent) count++;
            return count;
        },
        _fire: function (value) {
            var callbacks = this._callbacks;
            var callback;

            while (callback = callbacks.shift()) {
                try {
                    var f = callback[this._msg];
                    if (!f) continue;
                    var result = f.call(this, value);

                    if (this._breaker) {
                        var breaker = this._breaker;
                        this._breaker = null;
                        Deferred.lazyCall(breaker);
                        return;
                    }

                    if (result instanceof Deferred) {
                        this._nest = result;
                        result._msg = this._msg;
                        result._parent = this;
                        // xxx: return this; //?
                        return;
                    } else
                        value = result;
                } catch (ex) {
                    this._msg = "ng";
                    Cu.reportError(ex);
                    this._result = value = ex;
                }
            }

            var parent = this._parent;
            if (parent) {
                this._parent = parent._nest= null;
                parent._msg = this._msg;
                return parent._fire(value);
            } else
                return this;
        },

        cancel: function () {
            log("cancel");
            this._nest ? this._nest.cancel() : this._canceller && this._canceller();
            this.init();
        },
        cNext: function () {
            this.cancel();
            var d = new Deferred.wait(0);
            d._parent = this;
            this._nest = d;
            return this;
        },

        // 保留
        //pause:  function () this._nest ? this._nest.pause()  : this._breaker = Deferred.new(),
        //resume: function () this._nest ? this._nest.resume() : this._fire(this._result),

        Deferred: function _Deferred(funcname) {
            var args = Array.slice(arguments, 1);
            return this.next(function (val) Deferred[funcname].apply(Deferred, args));
        },
        closure: function (obj, name) {
            var args = Array.slice(arguments, 2);
            return this.next(function _closureNext() obj[name].apply(obj, args));
        }
    };

    D.PREPARE = {};
    D.RUNNING = {};
    D.DONE = {};

    D.next_image = function (callback) {
        var img = new Image();
        var d = Deferred.domEvent(img, "error");
        var t = Date.now();
        img.src = "data:image/png," + Math.random();
        return d
        //.next(function (){log("im", Date.now()-t);})
        .next(callback);
    };
    D.next_timeout = function (callback) {
        var id = setTimeout(function () {d.call()}, 0);
        var d = new Deferred(function () {clearTimeout(id);});
        var t = Date.now();
        return d
        //.next(function (){log("to", Date.now()-t);})
        .next(callback);
    };
    D.next_timer = function (callback) {
        var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        var d = new Deferred(function () { timer.cancel(); });
        var t = Date.now();
        timer.initWithCallback({ notify: function (){d.call();}}, 0, Ci.nsITimer.TYPE_ONE_SHOT);
        return d
        //.next(function (){log("tm", Date.now()-t);})
        .next(callback);
    };
    D.next = D.next_timer;

    //D.classID = D.prototype.classID = 0x5e7ab100c2e51;
    D.lazyCall = function (deferred, value)
        Deferred.wait(0).next(function () deferred.call(value));
    D.wait = function wait(msec) {
        var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        var d = new Deferred(function () { timer.cancel(); });
        timer.initWithCallback({ notify: function () d.call()}, msec, Ci.nsITimer.TYPE_ONE_SHOT);

        return d;
    };
    D.domEvent = function (dom, event, capture) {
        if (capture == void 0) capture = false;
        var d = new Deferred(cancel);
        d.name = "domEvent";
        dom.addEventListener(event, callback, capture);
        function cancel() {
            dom.removeEventListener(event, callback, capture);
        }
        function callback(e) {cancel(); d.fire(e); }
        return d;
    };
    D.xhr = function _xhr(extra) {
        var d = new Deferred(cancel);
        var xhr = new XMLHttpRequest();
        var time = Date.now();
        function callback() {
            //if (xhr.readyState == XMLHttpRequest.DONE) {
            if (xhr.readyState == 4) {
                xhr.onreadystatechange = xhr.onerror = null;
                log("recv data:", Date.now() - time, "ms");
                d.call(xhr);
            }
        }
        function cancel() {
            xhr.onreadystatechange = xhr.onerror = null;
            xhr.abort();
            log("xhr:cancel");
            alert("cancel!");
        }
        function error() {
            cancel();
            d.fail(xhr);
        }
        xhr.onreadystatechange = callback;
        xhr.onerror = error;

        log(extra.type || "GET", extra.url);
        xhr.open(extra.type || "GET", extra.url, true, extra.user || null, extra.password || null);
        xhr.send(extra.data || null);
        return d;
    };

    function objectToQuery(object) {
        let list = [];
        for (let a in object) {
            //list.push(a + "=" + encodeURIComponent(object[a]));
            list.push(a + "=" + object[a]);
        }
        return list.join("&");
    }
    D.httpPost = function (url, data) {
        return Deferred.xhr({
            type: "POST",
            url: url,
            data: data ? objectToQuery(data) : null
        });
    };
    D.httpGet = function (url, query) {
        if (query)
            url += (~url.indexOf("?") ? "&" : "?") + objectToQuery(query);
        return Deferred.xhr({ type: "GET", url: url, });
    };
    D.new = function (canceller) {
        var d = new Deferred(canceller);
        return d;
    };
    // 要検証
    D.parallel = function (callbacks) {
        if (arguments.length > 1) callbacks = Array.slice(arguments);
        var obj = {}, count = callbacks.length, results = new Array(count);
        var d = new Deferred(cancel);
        callbacks.forEach(function (callback, i) {
            if (typeof (callback) == "function") callback = Deferred.next(callback);
            callback.index = i;
            obj[i] = callback
                .both(deleteQueue)
                .next(success)
                .error(error);
        });
        function deleteQueue(val) {
            delete obj[this.index];
            return val;
        }
        function success(val) {
            results[i] = val;
            if (--count <= 0)
                d.call(results);
        }
        function error(ex) {
            cancel();
            d.fail(ex);
        }
        function cancel() {
            for (let a in obj)
                obj[a].cancel();
        }
        return d;
    };
    D.iter = function _iter(iter, callback, extra) {
        const self = this;
        var d1;
        var d = new Deferred(function () {
            if (iter.close) iter.close();
            extra && extra.onCancel && extra.onCancel();
            return d1.cancel();
        });
        function _iterator(array) {
            for (let i = 0, j = array.length; i < j; i++)
                yield array[i];
        }

        if (iter instanceof Function) iter = iter();
        else if ("length" in iter) iter = _iterator(iter);
        //else if (iter instanceof Iterator)

        function _error(ex) { d.fail(ex); }
        function _result(v) {
            param.result = v;
            if (isEnd) d.call(v);
            else _next();
        }
        function _next() { d1 = Deferred
            .next(_loop)
            .next(_result)
            .error(_error);
            d1.step = ++step;
        }
        let step = 0;
        let isEnd = false;
        function _loop(value) {
            try {
                param.value = iter.next();
                return callback.call(self, param);
            } catch (ex if ex instanceof StopIteration) {
                isEnd = true;
            } catch (ex) { throw ex; }
        }
        var param = {iter: iter};
        _next();
        return d;
    };
    D._loop = function _loop(param) {
        const self = this;
        const value = param.init ?  param.init.call(this, param) : ({});
        var d = new Deferred(function() { param.cancel && param.cancel(value); d1.cancel()});
        function _error(ex) {d.fail(ex); }
        function _next() { d1 = Deferred.next(function () param.callback.call(self, value)).error(_error); }
        value.next = _next;
        value.deferred = d;
        _next();
        return d;
    };
    D.generator = function (generator, callback) { return Deferred._loop({
        init: function () { return {iter: generator()}; },
        cancel: function (param) { param.iter.close(); },
        callback: function (param) {
            try {
                param.value = param.iter.next();
                callback.call(self, param);
                param.next();
            } catch (ex if ex instanceof StopIteration) {
                param.deferred.call();
            } catch (ex) { throw ex; }
        },
    });};
    D.generator = function _generator(generator, callback) //{{{
    {
        const self = this;
        var d = new Deferred(function () {param.iter.close(); d1.cancel();});
        var param = { iter: generator(), };
        function _error(ex) {d.fail(ex); }
        function _create() { d1 = Deferred.next(_loop).error(_error); }
        function _loop() {
            try {
                param.value = param.iter.next();
                callback.call(self, param);
                _create();
            } catch (ex if ex instanceof StopIteration) {
            } catch (ex) { throw ex; }
        }
        _create();
        return d;
    }; //}}}
    D.array = function _array(array, callback) {
        const self = this;
        var d = new Deferred(function () {d1.cancel();});
        var param = {
            value: array[0],
            num: -1,
            length: array.length,
            array: array,
        };
        function _error(ex) { d.fail(ex); }
        function _next(v) {
            if (++param.num < param.length) {
                param.value = array[param.num];
                d1 = Deferred.next(_loop).next(_next).error(_error);
            } else
                d.call(v);
        }
        function _loop() { return callback.call(self, param); }
        _next();
        return d;
    };
    D.while = function _while(callback) {
        const self = this;
        var d = new Deferred(function () {d1.cancel();});
        var param = {loop: true};
        function _error(ex) { d.fail(ex); }
        function _loop() { return callback.call(self, param); }
        function _next(v) {
            param.result = v;
            if (param.loop) d1 = Deferred.next(_loop).next(_next).error(_error);
            else d.call(v);
        }
        _next();
        return d;
    };

    // 割込処理
    D.interrupt = function _interrupt(deferred, value) {
        var d1 = new Deferred(function () d2.cancel());
        var d2 = Deferred.next(function () {
            // cancel の接続
            this._nest = deferred;
            deferred
                .next(function (v) d1.call(v))
                .error(function (ex) d1.fail(ex))
                .call(value);
        });
        return d1;
    };
    ["wait", "iter"].forEach(function (name) {
        D.prototype[name] = function () {
            let args = Array.slice(arguments);
            return this
                .next(function (preValue) D[name].apply(D, args).next(function (value) [value, preValue]));
        };
    });
    function echmsg(msg) { return function () {
        liberator.echo(msg);
        log(msg);
    };}
    return D;
}); //}}}

let PiyoCommands = Class("PiyoCommands", Commands, //{{{
{
    init: function (array) {
        if (array instanceof Array) {
            let ignore = [];
            this._exCommands = Array.concat(array).filter(function (c) {
                if (c instanceof PiyoGuardCommand) {
                    ignore.push(c);
                    return false;
                } else return !ignore.some(function (cmd) c.hasName(cmd.name));
            });
        } else this._exCommands = [];
    },
    completer: function (context) {
        if (Command.prototype.subCommands)
            completion.ex(context, this._exCommands)
        else
            this.ex.call({
                __proto__: completion,
                command: this.command
            }, context);
    },
    addGuadCommand: function (spec) this._addCommand(PiyoGuardCommand(spec))
}, {
    commonCommands: function (commands) {
        if (commands.length === 0) return PiyoCommands();
        else if(commands.length === 1) return commands[0]; // XXX: PiyoCommand(commands[0]._exCommands)?

        let exCommands = commands.map(function (c) c._exCommands);
        let top = exCommands.pop();
        let exCommand = top.filter(function (me) exCommands.some(function (other) other.hasName(me.name)));
        return PiyoCommands(exCommand);
    }
}); //}}}

let PiyoGuardCommand = Class("PiyoGuardCommand", //{{{
{
    init: Command.prototype.init,
    hasName: Command.prototype.hasName
}); //}}}

PiyoCommands.prototype.__defineGetter__("ex", function () {
    let func = liberator.eval(<![CDATA[(function() base)()]]>.toString()
        .replace("base", completion.ex.toString()), {commands: this});
    this.__defineGetter__("ex", function() func);
    return func;
});
PiyoCommands.prototype.__defineGetter__("command", function () {
    let func = liberator.eval(<![CDATA[(function() base)()]]>.toString()
        .replace("base", completion.command.toString()), {commands: this});
    this.__defineGetter__("command", function() func);
    return func;
});
PiyoCommands.prototype.__defineGetter__("execute", function () {
    let func = liberator.eval(<![CDATA[(function() base)()]]>.toString()
        .replace("base", liberator.execute.toString()), {commands: this});
    let exe = function (args, modifiers) {
        func(args, modifiers, true);
    }
    this.__defineGetter__("execute", function() exe);
    return exe;
});
let PMap = fx3 ? function () Map.apply(this, [[modes.PIYO]].concat(Array.slice(arguments))) : Map.bind(this, [modes.PIYO]);

let PiyoUI = Class("PiyoUI", //{{{
{
    init: function (iframe, editor) {
        this.iframe = iframe;
        this._aliases = [];
        this._sources = [];
        this._stack = [];
        this._contexts = [];
        this.keep = false;
        this.original = "";
        this._index = 0;
        this.editor = editor;
        this.items = [];
        this._filter = "";
        this._scripts = {};
        this._cache = {};
        this.async = true;
        this.statuspanel = this.box.firstChild;

        function NOP() void 0
        this.__defineGetter__("NOP", function() NOP);

        const self = this;

        this._resizer = new Timer(0, 300, function (force) {
            self.resize();
            log("resize");
        });
        this._scroller = new Timer(0, 300, function () {
            log("scroller");
            self.resize();
            self.scrollIntoView(-1, -1);
            self.updateScrollbar();
        });
    },
    get doc() this.iframe.contentDocument,
    get win() this.iframe.contentWindow,
    get box() this.iframe.parentNode,
    get filter() this.editor.value,
    get index() this._index,
    set index(value) {
        this._index = value;
        let item = this.items[value];
        if (!item) return;
        mappings._user[modes.PIYO] = item.source.maps;
    },
    get line() {
        let doc = this.doc;
        let fontSize = parseFloat(this.doc.defaultView.getComputedStyle(this.doc.body, null).fontSize);
        let line = Math.floor((window.innerHeight/fontSize) * 0.7);
        return line;
    },
    get selectedItem() this.items[this.index],
    get style() //{{{
        <![CDATA[
            * {
                margin: 0;
                padding: 0;
            }
            body * {
                padding: 1px 2px;
            }
            .item > * {
                min-height: 3ex;
            }
            .item {
                background: rgba(255,255,255,.9);
            }
            /*.item:nth-child(even) {
                background: rgba(244,244,244,.9);
            }*/
            .item.odd {
                background: rgba(244,244,244,.9);
            }
            /*xxx: [selected]?*/
            .item[selected] {
                background: rgba(255,236,139,.9);
            }
            .mark {
                padding-left: 1ex;
                min-width: 1ex;
                max-width: 1ex;
                font-weight: bold;
                color: blue;
            }
            span.mark {
                display: inline-block;
                min-height: 0ex;
            }
            .ib {
                display:inline-block;
            }
            .title {
                text-align: left;
                font-weight: bold;
                /*background: -moz-linear-gradient(19% 75% 90deg, #DBDBDB, #D9D9D9, #E7E7E7 100%);*/
                background: -moz-linear-gradient(19% 75% 90deg, rgba(219,219,219,.9), rgba(217,217,217,.9), rgba(231,231,231,.9) 100%);

                padding: 0.5ex;
                width: 100%;
            }
            .nw {
                white-space: nowrap;
            }
            .wwb {
                word-wrap:break-word;
            }
            #main {
                width: 100%;
                padding: 0;
                margin: 0;
            }
            #bottom {
                position: fixed;
                width: 100%;
                height: 100%;
                background-color: rgba(128,128,128,.5);
                color: blue;
                font-weight: bold;
            }

            #piyo-scrollbox {
                position: fixed;
                right: 0;
                top: 0;
                width: 4px;
                bottom: 0;
                background-color: rgba(200,200,200, .5);
                -moz-transition: .3s all;
            }
            #piyo-scrollbox:hover {
                width: 1em;
                background-color: rgba(200,200,200, .6);
                opacity: 1;
            }
            #piyo-scrollbox div {
                position: absolute;
                left: 1px;
                right: 1px;
                -moz-border-radius: 2px;
                -moz-transition: .5s;
            }
            #piyo-scrollbox .bar1 {
                background-color: #999;
            }
            #piyo-scrollbox .bar2 {
                background-color: #eee;
            }

        ]]> + (liberator.globalVariables.piyo_style || ""), //}}}
    list: function (input, source) {
        log("list function is renamed input");
        this.input(input, source);
    },
    push: function (input, source, modifiers) {
        const self = this;
        this._stack.push(
        ["_filter", "_source", "_cache", "_contexts", "index", "items", "_begin", "_end"
        ].reduce(function (obj, name) {
            obj[name] = self[name];
            return obj;
        }, {y: this.win.scrollY}));
        // cache の クリア
        this._cache = {};
        this.input(input, source, modifiers);
    },
    pop: function () {
        const self = this;
        let data = this._stack.pop();
        let y = data.y;
        delete data.y;
        for (let[name, value] in Iterator(data))
            this[name] = value;
        this.editor.value = this._filter;
        //this.refresh()
        Deferred.next(function () {
            //self.select(index);
            self._fill(self._begin, self._end);
            self.win.scrollTo(0, y);
        });
    },
    showBox: function () {
        let iframe = this.iframe;
        let box = this.box;

        if (box.collapsed == true && !disabledFixed) {
            let (r = commandline._commandlineWidget.parentNode.getBoundingClientRect()) {
                box.style.bottom = r.height + "px";
            }
            this.box.collapsed = false;
        }
    },
    resize: function () {
        let box = this.box;
        //if (force || box.style.height !== "0pt") {
            var docHeight = Math.min(this.doc.documentElement.scrollHeight, 0.7 * window.innerHeight);
            var maxHeight = parseFloat(box.style.maxHeight) || 0;
            if (maxHeight < docHeight) {
                //box.style.height = self.doc.height + "px";
                box.style.maxHeight = docHeight + "px";
            }
            this.updateScrollbar();
        //}
    },
    initUI: function () {
        // init ui
        let doc = this.doc;
        let style = doc.createElement("style");
        let main = doc.createElement("div");
        let bottom = doc.createElement("pre");
        let scrollbox = doc.createElement("div");
        let bar1 = doc.createElement("div");
        let bar2 = doc.createElement("div");
        style.innerHTML = this.style;

        scrollbox.id = "piyo-scrollbox";
        bar1.classList.add("bar1");
        bar2.classList.add("bar2");
        scrollbox.appendChild(bar1);
        bar1.appendChild(bar2);

        main.id = "main";
        bottom.id = "bottom";
        bottom.appendChild(doc.createTextNode((new Array(100)).join("~\n")));
        doc.body.id = "liberator-piyo-body";

        doc.body.appendChild(style);
        doc.body.appendChild(scrollbox);
        doc.body.appendChild(main);
        doc.body.appendChild(bottom);

        const self = this;
        // image の 読込による高さの変更
        doc.addEventListener("load", function (e) {
            let item = self.selectedItem;
            if (!item) return;
            let elem = item.dom;
            if (elem.compareDocumentPosition(e.target) & Node.DOCUMENT_POSITION_PRECEDING)
                self._scroller.tell();
            else self._resizer.tell();
        }, true);
        doc.addEventListener("scroll", function (e) {
            self.updateScrollbar();
        }, false);
        this.box.addEventListener("transitionend", function (e) {
            self.updateScrollbar();
        }, false);
    },
    hide: function () {
        this.box.collapsed = true
        this.box.style.maxHeight = 0;
    },
    quit: function () {
        if (ui._deferred) ui._deferred.cancel();
        this._resizer.reset();
        this.modifiers = {};
        this._cache = {};
        const self = this;
        modes.reset();
        this.hide();
    },
    createContext: function (source, offset, proto) {
        if (typeof(source) === "string")
            source = this._sources[source];
        let context = source();
        if (proto) {
            update(context, proto);
        }
        context.filter = this.filter.substr(offset);
        context.ui = this;
        context.createItem(this);
        this._contexts.push(context);
        return context;
    },
    createSource: function (name, base, prop) {
        if (!prop) [base, prop] = [PiyoSource, base];
        else if (typeof(base) === "string") {
            let baseProto = this._sources[base];
            if (!baseProto) {
                liberator.echoerr(<>{base} is not found!</>);
                return;
            }
            base = baseProto;
        }
        let prop1 = {abstract: prop.abstract || false};
        delete prop.abstract;

        if (prop.commands) {
            if (prop.commands instanceof Function) {
                let commands = PiyoCommands();
                prop.commands(commands);
                prop.commands = commands;
            } else if (prop.commands instanceof Array) {
                prop.commands = PiyoCommands(prop.commands);
            } else {
                liberator.echoerr(name);
            }
        }

        return Class(name, base, prop, prop1);
    },
    registerSource: function (name, base, prop) {
        this._sources[name] = this.createSource(name, base, prop);
    },
    unregisterSource: function (name) {
        delete this._sources[name];
    },
    scroll: function (index, relative) {
        if (this.index === -1) return;
        if (relative) {
            let item = this.selectedItem;
            let rect = item.dom.getBoundingClientRect();
            if (index < 0 && rect.top < 0) {
                this.doc.defaultView.scrollByLines(-1);
                return;
            } else if (index > 0 && this.doc.defaultView.innerHeight < Math.floor(rect.bottom)) {
                this.doc.defaultView.scrollByLines(1);
                return;
            }
            index += this.index;
        }
        else if (index < 0) index = this.items.length + index;
        else index = index - 1;
        index = Math.max(0, Math.min(this.items.length - 1, index));

        let item = this.selectedItem;
        if (!item) return;
        item.unselect();

        this.select(index);

        if (liberator.mode === modes.PIYO)
            modes.show();
    },
    select: function (index) {
        //this.lock();

        let line = this.line;
        if (this.index >= 0)
            this.items[this.index].unselect();

        const self = this;

        // top
        if ((index < this._begin) || this._begin == -1) {
            this.fill(index, index - line, index + line, true);
        } // bottom
        else if (this._end <= index) {
            this.fill(index, index - line, index + line, false);
        } else {
            this.index = index;
            this.items[index].select();
            this.scrollIntoView(-1, -1);
        }

        this.showBox();
        this._resizer.tell();
        this.updateStatus();
        //this.unlock();
    },
    _fill: function _fill(begin, end) {
        var doc = this.doc;
        var frag = doc.createDocumentFragment();
        var range = doc.createRange();
        var main = doc.getElementById("main");

        begin = this._begin = Math.max(begin, 0);
        end =   this._end   = Math.min(end, this.items.length);

        log("fill", begin, end);

        let src = null;
        for (let i = begin; i < end; ++i) {
            let item = this.items[i];
            if (src != (src = item.source)) {
                var root = util.xmlToDom(item.source.createRoot(), doc);
                var node = root.querySelector(".content") || root;
                node.classList.add("content");
                frag.appendChild(root);
            }
            let dom = item.dom;
            dom.classList[i % 2 ? "add" : "remove"]("odd");
            node.appendChild(item.dom);
        }
        range.selectNodeContents(main);
        range.deleteContents();
        range.insertNode(frag);

        this._begin = begin;
        this._end   = end;
    },
    fill: function (index, begin, end, isTop) {
        if (this.index >= 0)
            this.selectedItem.unselect();

        if (index < 0) index = 0;
        else {
            let len = this.items.length - 1;
            if (index > len)
                index = len;
        }

        this._fill(begin, end);

        this.index  = index;

        this.selectedItem.select();

        if (begin == index)
            this.doc.documentElement.scrollTop = 0;
        else
            this.items[index].dom.scrollIntoView(!!isTop);
        this.updateStatus();
    },
    fill2: function (index) {
        let doc = this.doc;
        let fontSize = parseFloat(this.doc.defaultView.getComputedStyle(this.doc.body, null).fontSize);
        let line = Math.floor((window.innerHeight/fontSize) * 0.7);
        let begin = Math.max(this.index - line, 0);
        let end   = Math.min(this.index + line, this.items.length);
        let aI, aJ, bI, bJ;
        let aRange, bRange, range;
        let main = doc.getElementById("main");
        aRange = doc.createRange();

        if (begin < this._begin) {
            aI = begin;
            aJ = this._begin;
            bI = end;
            bJ = this._end;
            aRange.selectNodeContents(main);
            bRange = aRange.cloneRange();
            aRange.collapse(true);
            bRange.collapse(false);
        } else {
            bI = begin;
            bJ = this._begin;
            aI = this._end;
            aJ = end;
            aRange.selectNodeContents(main);
            bRange = aRange.cloneRange();
            bRange.collapse(true);
            aRange.collapse(false);
        }

        var root = util.xmlToDom(this.items[aI].source.createRoot(), doc);
        var node = root.querySelector(".content") || root;
        node.classList.add("content");
        for (let i = aI; i < aJ; ++i) {
            let item = this.items[i];
            node.appendChild(item.dom);
        }
        if (bI < bJ) {
            bRange.selectNode(this.items[bJ - 1].dom);
            bRange.setStart(this.items[bI].dom, 0);
            bRange.deleteContents();
        }

        aRange.insertNode(root);
        this._begin = begin;
        this._end = end;
    },
    scrollByLines: function (dir) {
        let index = dir + this.index;

        if (index < 0) index = 0;
        else if (this.items.length <= index) index = this.items.length - 1;

        if (this._begin <= index && index < this._end) {
            let item = this.selectedItem;
            if (item) item.unselect();
            this.index = index;
            this.selectedItem.select();
            this.scrollIntoView(-1, -1);
            this.updateStatus();
        } else
            this.select(index);
    },
    scrollByPages: function (count) {
        if (this._begin == -1) {
        } else if (count > 0) {
            let doc = this.doc;
            let line = this.line;

            let bottom = this.doc.defaultView.innerHeight;
            let i, end;
            for (i = this.index, end = this._end; i < end; ++i) {
                let item = this.items[i];
                let rect = item.dom.getBoundingClientRect();
                if (bottom < rect.bottom)
                    break;
            }
            if (this.index == i)
                this.doc.defaultView.scrollByPages(1);
            else {
                this.fill(Math.min(i, this.items.length), i -line, i + line, true);
            }
        } else {
            let doc = this.doc;
            let line = this.line;

            let i, end;
            for (i = this.index; i >= 0; --i) {
                let item = this.items[i];
                let rect = item.dom.getBoundingClientRect();
                if (rect.top < 0)
                    break;
            }
            if (this.index == i)
                doc.defaultView.scrollByPages(-1);
            else
                this.fill(Math.max(i, 0), i -line, i + line, false);
        }
    },
    scrollIntoView: function scrollIntoView(aVPercent, aHPercent) {
        if (aVPercent == void 0) aVPercent = -1;
        if (aHPercent == void 0) aHPercent = -1;

        let dom = this.selectedItem;
        if (!dom) return;
        else dom = dom.dom;

        if (0 <= aVPercent && aVPercent <= 100) {
            let rect = dom.getBoundingClientRect();
            let win = this.doc.defaultView;
            let offset = win.innerHeight * aVPercent / 100;
            let move = rect.top - offset;// + rect.height/2

            // scroll で カバーできる範囲を越えている場合は、_fill
            if ((move > 0 && ((win.scrollMaxY - win.scrollY) < move) && (this._end < (this.items.length)))
                || (move < 0 && (win.scrollY + move < 0) && (this._begin > 0))
            ) {
                log("scrollIntoView", win.scrollY, win.scrollMaxY, offset, move);
                let index = this.index;
                let line = this.line;
                ui._fill(index - line, index + line);
                liberator.threadYield(false);
            }
        }

        if (aHPercent == -1 && (aVPercent == 0 || aVPercent == 100))
            dom.scrollIntoView(aVPercent == 0);
        else {
            util.nodeScrollIntoView(dom, aVPercent, aHPercent);
        }
    },
    addAlias: function (name, aliases) {
        this._aliases[name] = aliases;
    },
    getMarkedOrSelectedItem: function () {
        let source = this.selectedItem.source;
        let result = this.items.filter(function (i) i.source == source && i.mark);
        return result.length > 0 ? result : [this.selectedItem];
    },
    execute: function (command, modifiers) {
        if (!modifiers) modifiers = this.modifiers;
        let self = this;
        let executed = this._contexts.reduce(function (a, source) {
            modifiers.items= self.items.filter(function (i) i.source === source && i.mark);
            if (modifiers.items.length)
                source.execute(command, modifiers);
            return a || modifiers.items.length > 0;
        }, false);
        if (!executed) {
            let item = this.selectedItem;
            modifiers.items = [item];
            item.source.execute(command, modifiers);
        }

        if (!modifiers.noquit)
            this.quit();
        else {
            Deferred.next(function () modes.set(modes.PIYO));
            //commandline._setCommand(filter);
            //ui.refresh();
        }
    },
    showHelp: function () {
        //let source = this.selectedItem.source;
        //for (let attr in source.marks) {
        //    liberator.echo(attr);
        //}
        modes._prevMode = modes.PIYO;
        let item = this.selectedItem.item;
        if (item.item) item = item.item;
        liberator.echo(util.objectToString(item, true));
    },
    selectAll: function (isAll) {
        let mark = !this.items.some(function (i) i.mark);
        this.items.forEach(function (i) i.mark = mark);
    },
    selectReverse: function (isAll) {
        let source = this.selectedItem.source;
        (isAll ? this.items : this.items.filter(function (i) i.source === source))
            .forEach(function (i) i.toggleMark());
    },
    loadPiyo: function (file) {
        if (typeof(file) === "string") file = io.File(file);
        if (!/\.piyo$/.test(file.leafName) || !file.isFile()) return;
        let uri = services.get("io").newFileURI(file);
        let name = file.leafName;

        let script;
        try {
            if ((name in (this._scripts))) {
                if (this._scripts[name].hasOwnProperty("onUnload"))
                    this._scripts[name].onUnload();
            }

            script = {__proto__: piyo};
            log(<>load plugin: {file.leafName}</>);
            liberator.loadScript(uri.spec + "?" + file.lastModifiedTime, script);
            this._scripts[name] = script;
        } catch (ex) {
            Cu.reportError(ex);
            liberator.echoerr(ex);
        }
    },
    loadPiyos: function () {
        let dir = io.File(piyo.PATH).parent;
        dir.append("piyo");
        dir = io.File(dir);
        let self = this;
        let t = Date.now();
        log("plugin load start");
        if (dir.exists() && dir.isDirectory()) {
            dir.readDirectory().forEach(function(f) self.loadPiyo(f));
        }
        log("plugin load end " + (Date.now() - t) + "ms");
    },
    getCommands: function () {
        let items = ui.items;
        if (items.length == 0) return PiyoCommands.commonCommands([]);

        let commands = this._contexts.filter(function (c) {
                for(let i = c.offset, last = c.itemLength - c.offset; i < last; ++i) {
                    if (items[i].mark) return true;
                }
                return false;
            }).map(function (c) c._commands);
        return PiyoCommands.commonCommands(commands.length ? commands : [ui.selectedItem.source._commands]);
    },
    echo: function () {
        // required check modes.PIYO?
        modes._prevMode = modes.PIYO;
        liberator.echo.apply(liberator, arguments);
    },
    echoAsync:    function () let(args = Array.splice(arguments, 0)) this.setTimeout(function () liberator.echo.apply(liberator, args), 0),
    echoerr: function () let(args = Array.splice(arguments, 0)) this.setTimeout(function () liberator.echoerr.apply(liberator, args), 0),
    updateScrollbar: function () {
        var box = this.doc.getElementById("piyo-scrollbox");
        var bar1 = box.firstChild;
        var bar2 = bar1.firstChild;
        if (this.win.scrollMaxY === 0) {
            box.style.display = "none"
            return;
        } else
            box.style.display = ""
        var count = this.items.length;

        function $(v) v * 100
        bar1.style.cssText = <>top:{$(this._begin / count)}%;bottom:{$(1 - this._end / count)}%;</>;

        var height = this.win.scrollMaxY + this.win.innerHeight;
        bar2.style.cssText = <>top:{$(this.win.scrollY / height)}%;bottom:{$(1 - (this.win.scrollY + this.win.innerHeight) / height)}%;</>;
    },
    get rowStateE4X() <>[{this.index + 1}/{this.items.length}{this.build ? "*" : ""}]</>,
    updateStatus: function () {
        let item = this.selectedItem;
        if (item)
            this.statuspanel.label = item.source.title || "no name";

        if (liberator.mode == modes.PIYO) {
            modes.show();
        } else {
            commandline._setPrompt(this.rowStateE4X.toString());
        }
    },
    openAsync: function (source, value, modifiers) {
        this.dOpen(source, value, modifiers);
    },
    dOpen: function (source, value, modifiers) {
        const self = this;
        this._deferred = Deferred
            .next(function () {
                return self.dfOpen(source, value, modifiers);
            })
            .error(function(ex) {
                if (!ex) return;
                liberator.echoerr(ex);
                Cu.reportError(ex);
            });
    },
    dfOpen: function (source, value, modifiers) {
        if (typeof source == "string") {
            source = source.split(" ");
        }
        let contexts = [];
        function _createSource(self, names) {
            for (var [, name] in Iterator(names)) {
                if (self._aliases[name]) {
                    self._aliases[name].forEach(_createSource);
                    for (var source in _createSource(self, self._aliases[name]))
                        yield source;
                } else {
                    yield self._sources[name];
                }
            }
        }

        if (!value) value = "";
        this._contexts = [s(s.name, this) for (s in _createSource(this, source))];
        this._filter = value;
        this.editor.value = value;
        modes.set(modes.PIYO);
        this.modifiers = modifiers || {};
        return this.dfShow();
    },
    input: function (input, source) {
        this.dfInput(source, input);
    },
    dfInput: function (source, input) {
        if (fx3) modes.set(modes.PIYO);
        else
        modes._prevMode = modes.PIYO;
        this.editor.value = "";
        this._filter = input || "";
        this.modifiers = {};
        this._contexts = [this.createSource("anonymouse", source)("anonymouse", this)];
        return this._deferred = this.dfShow();
    },
    refresh: function() {
        return this._deferred = this.dfShow();
    },
    dfRefresFilter: function () {
        if (this._filter == this.editor.value) return;
        const self = this;
        this._deferred.cancel();
        this._deferred = Deferred.wait(300)
        .next(function () {
            let doc = self.doc;
            let main = doc.getElementById("main");
            let r = doc.createRange();
            r.selectNodeContents(main);
            r.deleteContents()
            self._filter = ui.editor.value;
        })
        .next(function () self.dfShow())
        .error(function (ex) alert(ex));
    },
    updateItem: function updateItem() {
        let length = this.items.length;
        if (this.noupdate || length == 0) return;
        else if (this.index == -1)
            this.select(0);
        // 動作確認方法検討中
        //else if (this.win.scrollMaxY == 0 && this._end < length) {
        else if (this._end < length && (this._end - this._begin) < this.line) {
        //else if (this._end < length && ((this._end - this.index) < this.line)) {
            log("call");
            let win = this.win;
            let top = win.scrollY;
            this._fill(this._begin, this.index + this.line);
            win.scrollY = top;
            this._resizer.tell();
        }
    },
    dfShow: function () //{{{
    {
        const self = this;
        const doc = self.doc;
        const main = doc.getElementById("main");
        let items = this.items = [];
        const nav = self.doc.defaultView
                .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIWebNavigation);
        var time = Date.now();
        return Deferred
        //.next(function () { userContext.jsd = new jsProfiler(); return userContext.jsd.deferredOn(); })
        .next(function () {
            self.index = -1;
            self._begin = self._end = -1;
            // クリアするとちらつく?
            let r = doc.createRange();
            r.selectNodeContents(main);
            r.deleteContents()

            self.updateStatus();
        }).Deferred("array", this._contexts, function (param) {
            const context = param.value;
            const doc = self.doc;
            const main = doc.getElementById("main");

            // items offset
            context.offset = items.length;

            context.filter = self._filter;
            context.items = [];
            const iter = context.generator(self);
            const highlighter = context.getHighlighter(self._filter);
            const list = items;
            const duration = 100;

            function updateItem() {
                self.updateItem();
                self.updateStatus();
                //if (fx3) return Deferred.wait(100);
            }

            function _createItem(param) {
                let item = param.value;
                for (let item = param.value, time = Date.now() + duration; Date.now() < time; item = param.iter.next()) {
                    context.items.push(item);
                    let hi = highlighter(item);
                    if (hi) {
                        hi.index = list.length;
                        list[hi.index] = PiyoItem2(item, hi, context);
                    }
                }
                updateItem();
            }

            return iter instanceof Deferred
                //xxx: PiyoSource.generator に callback を渡せば、Deferred.interrupt は不要
                ? Deferred.interrupt(iter, function (val) Deferred.iter(val, _createItem).next(updateItem))
                : Deferred.wait(0).iter(iter, _createItem).next(updateItem);
        })
        .next(function () {
            if (items.length == 0) {
                main.textContent = "empty";
                self.showBox();
                self._resizer.tell();
            }
        })
        .next(function (e) {
            log("end", Date.now() - time);
        })
        //.next(function () { userContext.jsd.off(); })
        .error(function (ex) {
            liberator.echoerr(ex);
            Cu.reportError(ex);
        })
        ;
    }, //}}}
    _lock: function _lock (isLock) {
        let win = this.doc.defaultView;
        let wUitl = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
        let [w, h] = !isLock ? [win.innerHeight, win.innerWidth] : [0, 0];
        //wUitl.setDisplayPortForElement(0, 0, h, w, win.document.documentElement);
        //wUitl.setCSSViewport(0, 0);
        //this.iframe.docShell.isActive = !isLock;
        //if (!isLock)
        //    wUitl.redraw();
        let baseWindow =  this.iframe.docShell.QueryInterface(Ci.nsIBaseWindow);
        baseWindow.setPosition(w, h);
    },
    lock: function lock() this._lock(true),
    unlock: function unlock() this._lock(false),
}, {
}); //}}}

let PiyoSource = Class("PiyoSource", //{{{
{
    init: function (name, ui) {
        this.items  = [];

        if (this.onLoad) this.onLoad();

        this._ui = ui;
        this._cache = ui._cache[name] || (ui._cache[name] = {});

        let stack = [];
        let self = this;
        while (self) {
            if (self.hasOwnProperty("commands")) {
                stack.push(self.commands._exCommands);
                if (self.commands.stop)
                    break;
            }
            self = self.__proto__;
        }
        this._commands = PiyoCommands(Array.concat.apply(0, stack));
    },
    //createRoot: function () <table style="border-collapse:collapse;"><caption class="title"/><tbody class="content">
    //<style><![CDATA[tr.item>td:last-child{width:100%;}]]></style>
    //</tbody></table>,
    //createRoot: function () <table style="border-collapse:collapse;"><style><![CDATA[tr>td:last-child{width:100%;}]]></style><caption class="title"/></table>,
    createRoot: function () <table style="border-collapse:collapse;"><style><![CDATA[tr.item>td:last-child{width:100%;}]]></style></table>,
    //createRoot: function () <table style="border-collapse:collapse;width:100%;"></table>,
    getHighlighter: function () {
        let filter = this.filter.trim();
        let keys = this.keys;
        if (keys.length === 0 || filter.length === 0)
            return function (item) {
                let val = {};
                keys.forEach(function (key) {
                    val[key] = let (x = item[key]) x instanceof Array ? x[0] : x;
                });
                return val;
            };
        // required [{pos,len},...]
        let matchers = filter.split(" ")
            .map(this.matcher || util.regexpMatcher2);
        let self = this;
        return function (item) {
            let hi_pos = {};
            let count = 0;

            function iterWords(item, keys) {
                let ret = {};
                let max = keys.length - 1;
                let stack = [];
                let top;

                function keyValueEach(index) {
                    let key = keys[index];
                    for (let [, val] in Iterator(Array.concat(item[key] || ""))) {
                        ret[key] = val;
                        yield 1;
                    }
                    yield 0;
                }

                top = keyValueEach(stack.length);
                while (1) {
                    if (stack.length === max) {
                        for(let r in top) if (r) yield ret;
                        if (stack.length === 0) break;
                        top = stack.pop();
                    } else {
                        if (top.next()) {
                            stack.push(top);
                            top = keyValueEach(stack.length);
                        }
                        else if (stack.length === 0) break;
                        else top = stack.pop();
                    }
                }
            }
            let proto = let(e=[]) keys.reduce(function (r, v) {r[v] = e; return r;}, {});
            for (let val in iterWords(item, keys)) {
                let ret = {__proto__: proto};
                let isMatch = !matchers.some(function (matcher) {
                    let isMatch = false;
                    for (let [attr, text] in Iterator(val)) {
                        if (matcher.exclude) {
                            if (matcher(text))
                                return true;
                            isMatch = true;
                        } else {
                            let pos = matcher(text);
                            if (pos.length > 0) {
                                ret[attr] = ret[attr].concat(pos);
                                isMatch = true;
                            }
                        }
                    }
                    return !isMatch;
                });
                if (isMatch) {
                    let hi = {};
                    for (let [attr, text] in Iterator(val)) {
                        let a = ret[attr];
                        a.sort(function (a, b) a.pos - b.pos || a.len - b.len);

                        //ハイライト範囲の重複除去
                        let b = [], offset = 0;
                        for (let i = 0, j = a.length; i < j; ++i) {
                            val = a[i];
                            if (offset <= val.pos) {
                                b[b.length] = val;
                                offset = val.pos + val.len;
                            } else {
                                let offset2 = val.pos + val.len;
                                if (offset < offset2) {
                                    b[b.length] = {pos: offset, len: offset2 -offset};
                                    offset = offset2;
                                }
                            }
                        }
                        a = b;
                        if (fx3) {
                            a = (function (a) {
                                for (let [, {pos: pos, len: len}] in Iterator(a)) yield [pos, len];
                            })(a);
                        }
                        hi[attr] = template.highlightSubstrings(text, a, template.filter);
                    }
                    return hi;
                }
            }
            return null;
        };
    },
    getCache: function (name, func) {
        return this._cache[name] || (this._cache[name] = (func || Object).call(this));
    },
    setCache: function (name, obj) this._cache[name] = obj,
    iterCache: function (name, iter) {
        let cache = this._cache[name];
        if (cache) {
            for (let [, obj] in Iterator(cache))
                yield obj;
        } else {
            let list = [];
            let result = iter.call(this);
            if (result instanceof Array)
                result = util.Array.itervalues(result);

            for (let obj in result) {
                yield obj;
                list[list.length] = obj; //list.push(obj);
            }
            // 全て列挙したときのみ
            this._cache[name] = list;
        }
    },
    clearCache: function (name) {
        delete this._cache[name];
    },
    execute: function (command, modifiers) {
        if (command === "default")
            command = this.default;
        this._commands.execute(command, modifiers);
    },
    maps: [],
    keys: [],
}, {
    getAttrValue: function (obj, attr, name) {
        while (obj) {
            if (obj.hasOwnProperty(attr)) {
                let prop = obj[attr];
                if (name in prop)
                    return prop[name] || null;
            }
            obj = obj.__proto__;
        }
        return null;
    },
    getAttrFlat: function (obj, attr) {
        let ret = {}, stack = [];
        while (obj) {
            if (obj.hasOwnProperty(attr))
                stack.push(obj[attr]);
            obj = obj.__proto__;
        }

        return stack.reduceRight(function (a, b) {
            for (let [attr, val] in Iterator(b))
                if (val === void 0)
                    delete a[attr];
                else
                    a[attr] = val;
            return a;
        }, {});
    }
}); //}}}

// XXX: add normal javascript command
PiyoSource.prototype.commands = PiyoCommands();
PiyoSource.prototype.commands._addCommand(commands.get("js"));

let PiyoItem = Class("PiyoItem", //{{{
{
    init: function init(item, view, context) {
        this.item = item;
        this.view = view;
        this.source = context;
        this.__defineGetter__("_mark", function () this.view.querySelector(".mark"));
    },
    select: function () { this.view.setAttribute("selected", true); },
    unselect: function () { this.view.removeAttribute("selected"); },
    get mark() {
        if (!this._dom) return false;
        let q = this._mark;
        return q && q.textContent
    },
    set mark(value) let (q = this._mark) q && (q.textContent = value ? "*" : ""),
    toggleMark: function (doc) this.mark = !this.mark,
});//}}}

let PiyoItem2 = Class("PiyoItem", PiyoItem, //{{{
{
    init: function init(item, highlight, context) {
        this.item = item;
        this.highlight = highlight;
        this.source = context;
        this._mark = "";
    },
    get mark() this._mark,
    set mark(value) {
        let dom = this._dom
        if (dom) {
            (dom.querySelector(".mark")||{}).textContent = value ? "*" : "";
        }
        this._mark = value;
    },
    get view() this.dom,
    get dom() {
        if (this._dom) return this._dom;

        let dom =  util.xmlToDom(this.source.createView(this.item, this.highlight), this.source._ui.doc);
        dom.classList.add("item");
        //if (this.highlight.index & 1) dom.classList.add("odd");
        this._dom = dom;
        if (this._mark) this.mark = this._mark;

        if (!fx3) Object.defineProperty(this, "dom", {value: dom});
        return dom;
    },
    clearDom: function () {
        delete this._dom;
        delete this.dom;
    },
});//}}}

let PiyoCache = Class("PiyoCache", //{{{
{
    init: function () {
        this.cache = {};
    },
    get: function (name, func) {
        var obj = this._get(name);
        return obj === void 0 ? obj : this._set(name, func());
    },
    iter: function (name, iterFunc) {
        var obj = this._get(name);
        if (obj === void 0) {
            let list = [];
            let res = iterFunc();
            if (res instanceof Array)
                res = util.Array.itervalues(res);
            for (let val in res) {
                list.push(val);
                yield val;
            }
            this._set(name, list);
        } else {
            for (let [, val] in Iterator(obj))
                yield val;
        }
    },
    _get: function (name) this.cache[name],
    _set: function (name, value) this.cache[name] = value,
    clear: function (name) { delete this.cache[name]; },
    clearAll: function () { this.cache = {};},

    deferred: function (name, callback) {
        const self  = this;
        const cache = this.cache;
        var d1 = new Deferred(function () d2.cancel()), d2;
        let val = this._get(name);
        if (val != void 0) {
            d2 = Deferred.next(function () d1.call(val));
        } else {
            d2 = Deferred.next(callback)
            .next(function (val) {
                self._set(name, val);
                d1.call(val);
            })
            .error(function (ex) d1.fail(ex));
        }
        return d1;
    }
});//}}}

let PiyoCacheTime = Class("PiyoCacheTime", PiyoCache, //{{{
{
    init: function (time) {
        this.cache = {};
        if (time) this.time = time;
    },
    time: 30 * 60 * 1000,
    _get: function (name) {
        if (name in this.cache) {
            let obj = this.cache[name];
            if (Date.now() < obj.time)
                return obj.data;
        }
        return void 0;
    },
    _set: function (name, value) {
        this.cache[name] = {
            time: Date.now() + this.time,
            data: value
        };
        return value;
    }
}); //}}}

let onUnload = (function () // {{{
{
    // defined function {{{
    function proxyClass(obj, proxy) {
        let original = proxy.__proto__ = obj.__proto__;
        obj.__proto__ = proxy;
        return function () {
            obj.__proto__ = original;
        };
    }
    function domAddEventListener(dom, eventName, func, useCaputre) {
        dom.addEventListener(eventName, func, useCaputre);
        return function () dom.removeEventListener(eventName, func, useCaputre);
    }
    // }}}

    //{{{ hacked liberator module
        let dispose = [];
        dispose.__defineSetter__("$push", function (v) this.push(v));

        let _box = document.createElementNS(XUL, "vbox");
        _box.id = "liberator-piyo";
        _box.collapsed = true;

        _box.classList.add("liberator-container");
        _box.classList.add("animate");

        if (!disabledFixed) {
            _box.classList.add("overlay");
        }

        dispose.$push = function () let (p = _box.parentNode) p && p.removeChild(_box);

        let bottom = document.getElementById("liberator-multiline-output").parentNode;
        let p = bottom.parentNode;
        p.insertBefore(_box, bottom);

        let iframe = document.createElementNS(XUL, "iframe");
        let statuspanel = document.createElementNS(XUL, "statuspanel");
        //let iframe = document.createElementNS(XUL, "browser");
        //iframe.setAttribute("type", "content-targetable");
        iframe.id = _box.id + "-iframe";
        iframe.flex = 1;

        self.iframe = iframe;

        _box.appendChild(statuspanel);
        _box.appendChild(iframe);

        let style = document.createElementNS(XHTML, "style");
        style.innerHTML = <![CDATA[
            #liberator-piyo {
                height: 100%;
                max-height: 10px;
                min-height: 10px;
                border-top: 1px solid rgba(128,128,128,.5);
                border-bottom: 1px solid rgba(128,128,128,.5);
                -moz-box-sizing: content-box;/*border-box;*/
            }
            #liberator-piyo.animate {
                -moz-transition: all .2s;
            }
            #liberator-piyo.overlay {
                position: fixed;
                left: 0;
                width: 100%;
            }
            #liberator-piyo-iframe {
                height: 100%;
                width: 100%;
                color: black;
            }
            #liberator-piyo.animate[collapsed='true'] {
                max-height: 0px !important;
                opacity: 0;
                background-color: black;
                pointer-events: none;
            }
            #liberator-piyo-iframe.deactive {
                background-color: rgba(0, 0, 0, .8);
            }
        ]]>;

        iframe.appendChild(style);

        let onceIframe = domAddEventListener(iframe, "load", function (e) {
            if (e.target !== this.contentDocument) return;

            iframe.contentDocument.documentElement.id = "piyohtml"
            iframe.contentDocument.body.id = "liberator-piyo-content";
            ui.initUI();
            onceIframe();
        }, true);
        let bufferURI = "chrome://liberator/content/buffer.xhtml";
        iframe.setAttribute("src", bufferURI);
        //iframe.loadURI(bufferURI);

        dispose.$push = proxyClass(modules.events, {
            onFocusChange: function (event) {
                if ([modes.PIYO, modes.PIYO_I].indexOf(liberator.mode) >= 0) {
                    return;
                }
                this.__proto__.__proto__.onFocusChange.apply(this, arguments);
            },
            //onKeyPress: function (event) {
            //    if (liberator.mode === modes.PIYO) {
            //        if (ui.onEvent(event)) {
            //            event.preventDefault();
            //            event.stopPropagation();
            //            return;
            //        }
            //    }
            //    this.__proto__.__proto__.onKeyPress.apply(this, arguments);
            //}
        });

        if (fx3) {
            template.filter = function (str) <span highlight="Filter">{str}</span>;
            modules.commandline.show = function () {
                this._commandlineWidget.collapsed = false;
                this._commandWidget.focus();
            };
        }
        dispose.$push = proxyClass(modules.commandline, {
            onEvent: function (event) {
                if ([modes.PIYO, modes.PIYO_I].indexOf(liberator.mode) >= 0) {
                    if (liberator.mode === modes.PIYO) {
                        if (event.type === "focus" && liberator.mode === modes.PIYO
                            && ui.editor.compareDocumentPosition(liberator.focus) & Node.DOCUMENT_POSITION_CONTAINED_BY)
                            modes.set(modes.PIYO_I, modes.NONE, true);
                        event.preventDefault();
                        event.stopPropagation();
                    } else {
                        if (ui._deferred) {
                          ui.dfRefresFilter();
                        }
                    }
                } else {
                    this.__proto__.__proto__.onEvent.apply(this, arguments);
                }
            },
        });

        function modeChange ([oldMode], [newMode]) {
            if (newMode === modes.COMMAND_LINE) {
                ui.iframe.classList.add("deactive");
            } else if (newMode === modes.PIYO) {
                ui.iframe.classList.remove("deactive");
            }
            // xxx: tabs._onTabSelect 対策
            else if (newMode === modes.NORMAL && oldMode === modes.PIYO) {
                liberator.threadYield(true);
                if (!ui.box.collapsed)
                    for (let s = arguments.callee.caller; s; s = s.caller) {
                        if (s === tabs._onTabSelect) {
                            log("keep piyo");
                            modes.set(modes.PIYO);
                            if (fx3) {
                                ui.box.collapsed = true;
                                ui.setTimeout(function () ui.box.collapsed = false, 0);
                            }
                            break;
                        }
                    }
            }
        }
        liberator.registerObserver("modeChange", modeChange);
        dispose.$push = function () liberator.unregisterObserver("modeChange", modeChange);
    //}}}

    // {{{ mapping
    // xxx: mode の 削除が困難なため、上書き想定で処理
    if (!modes.hasOwnProperty("PIYO")) {
        modes.addMode("PIYO", {char: "p"});
        modes.addMode("PIYO_I", {char: "pi", input: true, display: -1});
    }
    modes.getMode(modes.PIYO).display =
        function() <>{let (i=ui.selectedItem) i ? i.source.title || "no name": "PIYO"} #{ui.editor.value}# {ui.rowStateE4X}</>;

    modes.reset = function _reset(silent) {
        this._modeStack = [];
        if (this._prevMode) {
            this.set(this._prevMode, modes.NONE, silent);
            this._prevMode = null;
        } else if (config.isComposeWindow)
            this.set(modes.COMPOSE, modes.NONE, silent);
        else
            this.set(modes.NORMAL, modes.NONE, silent);
    };

    [ //mapping PIYO
        [["j", "<Down>", "<Tab>"], "down", function (count) ui.scrollByLines(count  ||  1), {count: true}],
        [["k", "<Up>", "<s-Tab>"], "up",   function (count) ui.scrollByLines(-count || -1), {count: true}],
        [["<C-f>", "<PageDown>"], "page scroll down", function (count) ui.scrollByPages(Math.max(count, 1)) ,{count:true}],
        [["<C-b>", "<PageUp>"],   "page scroll up",   function (count) ui.scrollByPages(-Math.max(count, 1)),{count:true}],
        [["<C-c>"], "stop search", function () {
            if (ui._deferred) ui._deferred.cancel();
        }],
        [["<Esc>"], "", function () {
            // <HEAD> で echoerr が 邪魔なので
            if (commandline._modeWidget && commandline.message) { commandline._echoLine(""); return; }
            ui.quit();
        }],
        [["i", "a"], "piyo insert mode", function () {
            modes.set(modes.PIYO_I, modes.NONE, true);
            commandline.show();
            ui.updateStatus();
        }],
        [["<Space>"], "mark mark", function () {
            ui.selectedItem.toggleMark();
            ui.scrollByLines(1);
        }],
        [["<C-a>"], "select all", function () ui.selectAll()],
        [["<S-Space>"], "toggle mark previous", function () {
            ui.selectedItem.toggleMark();
            ui.scrollByLines(-1);
        }],
        [["gs"], "", function () {
            if ("docShell" in ui.iframe) {
                ui.iframe.docShell.isActive = !ui.iframe.docShell.isActive;
            }
            //ui.lock(true);
        }],
        [["gg"], "", function(count) ui.select(count ? count -1 : 0),                  {count: true}],
        [["G"],  "", function(count) ui.select(count ? count -1 : ui.items.length -1), {count: true}],
        [["?"], "", function() ui.showHelp()],
        [[":"], "kill key_open_vimbar", function () {
            let filter = ui.filter;
            let commands = ui.getCommands();

            commandline.input(fx3 ? ":" : "", function (args) {
                ui.editor.value = filter;
                ui.execute(args);
            }, {
                completer: function (context) {
                    let cache = context.top.getCache("piyo", Object);
                    // todo: 暫定対応
                    cache.ui = ui;
                    commands.completer(context);
                },
                onCancel: function () {
                    commandline._setCommand(filter);
                    Deferred.next(function () {
                        modes.set(modes.PIYO);
                    })
                    .error(function(ex) {
                        alert(ex);
                    });
                }
            });
        }],
        //[["zt"], "top",    function () util.nodeScrollIntoView(ui.selectedItem.view, 0,   -1)],
        //[["zz"], "center", function () util.nodeScrollIntoView(ui.selectedItem.view, 50,  -1) || ui._resizer.tell()],
        //[["zb"], "bottom", function () util.nodeScrollIntoView(ui.selectedItem.view, 100, -1)],
        [["zt"], "top",    function () ui.scrollIntoView(0)],
        [["zz"], "center", function () ui.scrollIntoView(50)],
        [["zb"], "bottom", function () ui.scrollIntoView(100)],
        [["<Return>"], "execute default action", function () {
            ui.execute("default");
        }],
        [["y"], "copy selected text", function () {
            let selection = ui.doc.defaultView.getSelection();
            util.copyToClipboard(selection, true);
        }]
    ].forEach(function (m) {
        mappings.add.apply(mappings, [[modes.PIYO]].concat(m));
    });
    [ // mapping PIYO_I
        [["<C-n>"], "down", function () ui.scroll( 1, true)],
        [["<C-p>"], "up", function () ui.scroll(-1, true)],
        //[["<C-s>n"], "normal filter", function () ui.matcherType = "n"],
        //[["<C-s>m"], "migemo filter", function () ui.matcherType = "m"],
        //[["<C-s>r"], "regex filter",  function () ui.matcherType = "r"],
        [["<C-s>m"], "migemo filter", function () ui._contexts[0].matcher = util.migemoMatcher],
        [["<C-s>r"], "regexp filter", function () ui._contexts[0].matcher = util.regexpMatcher2],
        [["<Esc>", "<Return>"], "escape PIYO_I", function () {
            modes.set(modes.PIYO)
            commandline.hide();
            if (fx3) liberator.focus.blur();
        }],
        [["<C-Return>"], "execute", function () { ui.execute(); }],
    ].forEach(function (m) {
        mappings.add.apply(mappings, [[modes.PIYO_I]].concat(m));
    });
    // modes.INSERT から map の コピー
    // xxx: 意図してMap.modes に 登録してない
    let (maps = mappings._main[modes.PIYO_I])
        ["w", "u", "k", "a", "e", "h"].forEach(function (name) {
            maps.push(mappings.get(modes.INSERT, "<C-" + name + ">"));
        });
    // }}}


    let (name = "piyoNoScrollbar") {
        styles.addSheet(true, name, bufferURI, "html|html > xul|scrollbar { visibility: collapse !important; }", true);
        dispose.$push = function ()  styles.removeSheet(true, name);
    }

    delete dispose.$push;
    return function () {
        //delete this.onUnload;
        this.onUnload = null;
        dispose.forEach(function (f) f());

        [modes.PIYO, modes.PIYO_I].forEach(function (m) {
            mappings._main[m] = [];
            mappings.removeAll(m);
        });
    };
})(this); //}}}

var ui = PiyoUI(iframe, commandline._commandWidget);
let util = // {{{
{
    __proto__: modules.util,
    //setTarget(aNode) しないと使えない
    //getContextMenu: function (win) Object.create((win || window).nsContextMenu.prototype),
    getContextMenu: function (win) ({__proto__: (win || window).nsContextMenu.prototype}),
    nodeScrollIntoView: function nodeScrollIntoView(aNode, aVPercent, aHPercent) {
        if (!(aVPercent >= 0)) aVPercent = -1;
        if (!(aHPercent >= 0)) aHPercent = -1;
        var doc = aNode.ownerDocument;
        var win = doc.defaultView;
        if (!win) return;
        var selection = win.getSelection();

        selection.removeAllRanges();
        var r = doc.createRange();

        r.selectNode(aNode);
        selection.addRange(r);
        selection.QueryInterface(Ci.nsISelection2 || Ci.nsISelectionPrivate)
            .scrollIntoView(Ci.nsISelectionController.SELECTION_ANCHOR_REGION,
                    true, aVPercent, aHPercent);

        selection.removeAllRanges();
    },
    icon16: function (image) <img style="margin: 1px;max-height: 16px;" src={image}/>,
    normalMatcher: function (word) {
        return function (text) {
            let index = text.indexOf(word);
            return index >= 0 ? [{pos: index, len: word.length}] : [];
        };
    },
    regexpMatcher: function (word) {
        var re = new RegExp(word, "gi");
        return function (text) {
            re.lastIndex = 0;
            let list = [], m;
            while (m = re.exec(text)) {
                list.push({pos: m.index, len: m[0].length});
                if (m[0].length === 0) break;
            }
            return list;
        };
    },
    regexpMatcher2: function (word) {
        let isNot = word[0] === "-";
        if (isNot) {
            word = word.substr(1);
            if (word) {
                let re = new RegExp(word, "i");
                var f = function (text) re.test(text);
            } else
                f = function () false;

            f.exclude = true;
            return f;
        } else {
            return util.regexpMatcher(word);
        }
    },
    migemoMatcher: function (word) {
        var re = migemo.getRegExp(word, "gi");
        return function (text) {
            re.lastIndex = 0;
            let list = [], m;
            while (m = re.exec(text))
                list.push({pos: m.index, len: m[0].length});
            return list;
        };
    },
    createView: function (array, scope) {
        if (array.length === 0) return <></>;
        if (array[0] === "icon") {
        }
        array = array.map(function (a) {
            if (typeof(a) === "string") return "<td>{" + a + "}</td>";
            else {
                let text = a.text;
                delete a.text;
                let attrs = [];
                for (let attr in a) attrs.push(attr + '=\"' + a[attr].replace('"', '\\"', "g") + '"');
                return "<td " + attrs.join(" ") + ">{" + text + "}</td>";
            }
        });
        return liberator.eval(<![CDATA[(function () function (item, hi) xml)()]]>
            .toString().replace("xml", "<tr>" + array.join("") + "</tr>"), scope);
    },
    sqlquery: function sqlquery(db, query, params) {
        const fields = {
            "INTEGER": "getInt64",
            "TEXT": "getUTF8String",
        };
        try {
            var stmt = db.createStatement(query);
            var reader = [];

            if (stmt.executeStep()) {
                for (let i = 0, j = stmt.columnCount; i < j; ++i) {
                    let name = stmt.getColumnName(i);
                    let type = stmt.getColumnDecltype(i);
                    reader.push([name, fields[type]]);
                }
                do {
                    yield reader.reduce(function (obj, [n, t], i) {obj[n] = stmt[t](i); return obj;}, {});
                } while (stmt.executeStep());
            }
        } catch (ex) {
            Cu.reportError(ex);
        } finally {
            if (stmt)
                stmt.reset();
        }
    },
    lazyProto: function (base, parent) {
        let proto = new Object();

        if (parent)
            proto.__proto__ = parent;

        if (fx3)
        for (let name in base) {
            let getter = base.__lookupGetter__(name);
            if (getter) {
                proto.__defineGetter__(name, getter);
            } else
                proto[name] = base[name];
        } else
        Object.getOwnPropertyNames(base).forEach(function (name) {
            let getter = base.__lookupGetter__(name);
            if (getter) {
                proto.__defineGetter__(name, function () {
                    let value = getter.call(this);
                    Object.defineProperty(this, name, {
                        value: value,
                        writable: false,
                    });
                    return value;
                });
            } else
                proto[name] = base[name];
        });
        function constructor(item) {
            let obj = {__proto__: constructor.prototype, item: item};
            return obj;
        }
        constructor.prototype = proto;
        return constructor;
    },
    runnable: function (func, callback) {
        let generator = func(callback ? callback(generator) :function _callback(value) {generator.send(value);});
        generator.next();
    },
    http: {
        xhr: function (params) {
            try {
                let thread = services.get("threadManager").mainThread;
                let xhr = new XMLHttpRequest();
                let wait = true;
                xhr.mozBackgroundRequest = true;

                xhr.onreadystatechange = function () {
                    log("xhr-ready state:", xhr.readyState);
                    if (xhr.readyState == 4) {
                        wait = false;
                    }
                };
                url = params.url;
                if (params.query) {
                    let query = params.query;
                    url += "?" + util.names(query)
                        .map(function (n) [n, query[n]].map(function (v) encodeURIComponent(n)).join("="))
                        .join("&");
                }

                params.headers && params.headers.forEach(function ([name, value]) {
                    xhr.setHeader(name, value);
                });

                let t = Date.now();
                xhr.open(params.type, url, true, params.user || null, params.password || null);
                xhr.send(params.post || null);

                // todo: true or false
                while (wait && Date.now() < (t + 30 * 1000))
                    thread.processNextEvent(true);

                log(Date.now() - t, params.type, url);

                return xhr;
            } catch (ex) {
                Cu.reportError(ex);
                return null
            }
        },
        get: function (url, query) {
            return this.xhr({
                type: "GET",
                url: url,
                query: query
            });
        },
        post: function (url, query, postdata) {
            liberator.assert(null, "post is not implementation")
            if (!postdata)
                postdata = query;
            return this.xhr({
                type: "POST",
                url: url,
                query: query,
                post: postdata
            });
        }
    },
    openUrl: function (urls) Deferred.next(function () Deferred.array(
        Array.concat(arguments.length > 1 ? arguments : urls),
        function (param) {
            let tab = gBrowser.addTab();
            let browser = tab.linkedBrowser;
            browser.loadURI(param.value);
            return Deferred.domEvent(browser, "load", true);
        })),
    getFavicon: function (uri) {
        try {
            let favicon = services.get("favicon");
            return favicon.getFaviconImageForPage(makeURI(uri)).spec;
        } catch (ex) {}
    },
}; //}}}

/// fx3
if (fx3) {
lazyGetter(util, "names", function () function (obj) [a for(a in obj)]);
lazyGetter(util, "desc", function () function (obj) function(obj, name) {
    let result = {
        getter: obj.__lookupGetter__(name),
        setter: obj.__lookupSetter__(name)
    };
    result.value = (!result.setter && !result.getter) ? obj[name] : null;
    return result;
});
} else {
lazyGetter(util, "names", function () Object.getOwnPropertyNames.bind(Object));
lazyGetter(util, "desc", function () Object.getOwnPropertyDescriptor.bind(Object));
}

commands.addUserCommand(["pi[yo]"], "piyo command", function (args) {
    commandline.close();
    ui.openAsync(Array.join(args, " "), args["-input"] || "");
}, {
    options: [
        [["-input", "-i"], commands.OPTION_STRING],
        //[["-k", "-keep"],  commands.OPTION_NOARG],
    ],
    completer: function (context, args) {
        context.completions = [ [name, s.prototype.description || s.prototype.title || ""]
            for ([name, s] in Iterator(ui._sources)) if (!s.abstract)];
    },
}, true);

commands.addUserCommand(["loadpiyo"], "piyo load plugin", function (args) {
    if (args.length == 0) ui.loadPiyos();
    else ui.loadPiyo(args[0]);
}, {
    literal: 0,
    completer: function (context) completion.file(context, true)
}, true);

ui.iter = {
    tabs: function () (t for ([,t] in iter(gBrowser.mTabs))),
    vtabs: function () (t for ([,t] in Iterator(gBrowser.visibleTabs))),
    wins: function (type) iter(services.get("windowMediator").getEnumerator(type)),
};

function jsProfiler() {
    this.jsd = services.get("debugger");
}
jsProfiler.prototype = {
    on: function (callback) {
        var jsd = this.jsd;
        function action () {
            jsd.flags |= jsd.COLLECT_PROFILE_DATA;
            callback();
        }
        if (jsd.isOn)
            action();
        else if ("asyncOn" in jsd)
            jsd.asyncOn(action);
        else {
            jsd.on();
            action();
        }
    },
    deferredOn: function () {
        var d = new Deferred();
        this.on(function () {d.call()});
        return d;
    },
    off: function () {
        let list = [];
        var jsd = this.jsd;
        var targetProp = [
            "functionName",
            "callCount",
            "maxOwnExecutionTime",
            "totalExecutionTime",
            "totalOwnExecutionTime",
            "functionSource",
            "fileName",
            "lineExtent",];
        jsd.enumerateScripts({enumerateScript: function(script) {
            if (script.callCount) {
                try{
                list.push(targetProp.reduce(function (obj, attr) {
                    obj[attr] = script[attr];
                    return obj;
                }, {}));

                }catch(ex){liberator.echoerr(ex);}

                script.clearProfileData();
            }
        }});

        list.sort(function (a, b) b.totalOwnExecutionTime - a.totalOwnExecutionTime);
        jsd.flags &= ~jsd.COLLECT_PROFILE_DATA;
        jsd.off();
        this.result = list;
    },
    show: function () {
        let list = this.result;
        ui.input("", {
            title: "profile",
            keys: [],
            createRoot: function ()
<table style="border-collapse:collapse;">
<thead>
<tr style="background-color:black;color:white;">
<td class="mark"/>
<td>functionName</td>
<td>callCount</td>
<td>maxOwnExecutionTime</td>
<td>totalOwnExecutionTime/i.callCount</td>
<td>totalOwnExecutionTime</td>
<td>totalExecutionTime</td>
</tr>
</thead>
<tbody class="content"/>
</table>,
            createView: function (i, h)
<tr>
<td class="mark"/>
<td>{i.functionName}</td>
<td align="right">{i.callCount}</td>
<td align="right">{i.maxOwnExecutionTime}</td>
<td align="right">{i.totalOwnExecutionTime/i.callCount}</td>
<td align="right">{i.totalOwnExecutionTime}</td>
<td align="right">{i.totalExecutionTime}</td>
</tr>,
            generator: function () {
                for (let i = 0, j = list.length; i < j; ++i) {
                    yield list[i];
                }
            },
            commands: function (commands) {
                commands.add(["sort"], "sort column", function (args) {
                    let attr = args[0];
                    liberator.assert(targetProp.indexOf(attr));
                    list.sort(function (a, b) a[attr] < b[attr]);
                    ui.refresh();
                }, {
                    argCount: 1,
                    completer: function (context) {
                        context.completions = targetProp.map(function (n) [n, ""]);
                    },
                });
            },
            maps: [
                PMap(["p"], "show function", function () {
                    ui.echo(<pre>{ui.selectedItem.item.functionSource}</pre>);
                }),
            ],
        });
    },
};
jsProfiler.deferredOn = function (name) (function () {
    var jsd = new jsProfiler();
    userContext[name] = jsd;
    return jsd.deferredOn();
});
jsProfiler.deferredOff = function (name) (function () {
    userContext[name].off();
});

ui.loadPiyos();
