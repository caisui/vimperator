// vim: set sw=4 ts=4 fdm=marker et :
//"use strict";
var INFO = //{{{
<plugin name="hints-ext" version="0.0.3"
        href="http://github.com/caisui/vimperator/blob/master/plugin/hints-ext.js"
        summary="Hints Ext"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
    <description>
        Hint です
    </description>
    </item>
    <item>
        <spec>let use_hintchars_ex=1 or 2</spec>
        <description>
        1 で、hintchars の 最初の一文字目の出現頻度を同等にします。
        </description>
        <description>
        2 で、hintchars の 桁数を同一にします。
        </description>
    </item>

    <item>
    <spec>:let use_hints_ext_hinttags=1</spec>
    <description>
        <o>hinttags</o> をクエリーセレクタ版で上書きします
    </description>
    </item>

    <item>
    <spec>:let use_hints_ext_caret="[a-zA-Z]"</spec>
    <description>
        caret mode 開始位置を選択 する Hint を 追加
    </description>
    </item>

    <item>
    <spec>:let use_hints_ext_visual="[a-zA-Z]"</spec>
    <description>
        visual mode 開始位置を選択 する Hint を 追加
    </description>
    </item>

    <item>
    <spec>:let use_hints_ext_extendedhinttags=1</spec>
    <description>
        <o>extendedhinttags</o> をクエリーセレクタ版で上書きします
    </description>
    </item>

    <item>
    <spec>:js hints.addSimpleMap(<a>key</a>, <a>callback</a>)</spec>
    <description>
        Hints に 1キーストーロクのmapを割り当てします。

        <p>
            <k name="C-f"/>でpage 送り
            <code><![CDATA[
                hints.addSimpleMap("<C-f>", function () {
                    this.hide();
                    buffer.scrollPages(1);
                    this.show(this._submode, "", content.window);
                });
            ]]></code>
        </p>
        <p>
            <k name="C-l"/>でhint の 重なりを整理
            <code><![CDATA[
                hints.addSimpleMap("<C-l>", function () {this.relocation(); });
            ]]></code>
        </p>
    </description>
    </item>

    <item>
    <spec>:js hints.addModeEx(<a>mode</a>, <a>prompt</a>, <a>active</a>, <a>generate</a>)</spec>
    <description>
        <p>
            Hint "z" に window を 4分割 する
            <code><![CDATA[
                hints.addModeEx("z", "test", function (val) {
                    alert(val);
                }, function (win, screen) {
                    let w = screen.right  - screen.left;
                    let h = screen.bottom - screen.top;
                    let l = screen.left;
                    let t = screen.top;
                    return [
                        {value: 1 , rect: [plugins.hintsExt.Rect(l       , t       , l + w/2 , t + h/2)], text: "msg 1", showText: true},
                        {value: 2 , rect: [plugins.hintsExt.Rect(l + w/2 , t       , l + w   , t + h/2)], text: "msg 2", showText: true},
                        {value: 3 , rect: [plugins.hintsExt.Rect(l       , t + h/2 , l + w/2 , t + h  )], text: "msg 3", showText: true},
                        {value: 4 , rect: [plugins.hintsExt.Rect(l + w/2 , t + h/2 , l + w   , t + h  )], text: "msg 4", showText: true},
                    ];
                });
            ]]></code>
        </p>
    </description>
    </item>
</plugin>;
//}}}

(function () {
if (parseFloat(Application.version) < 4) return;

var original = modules.hints;
this.onUnload = function onUnload() {
    delete this.onUnload;
    modules.hints = original;
};

function HintsExt() {
    this.init();
}

function getUtils(win) win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils)

if (!highlight.get("HintExtElem")) {
highlight.loadCSS(<![CDATA[
    HintExtElem,,*  {
        border: 1px solid rgba(128,128,128,.5);
        -moz-border-radius: 2px;
        background-color: rgba(255,255,128, .1);
        -moz-box-sizing: border-box;
    }
    HintExtActive,,*  {background-color: rgba(128,255,128,.3);}
    HintExt,,* {font-size: 12px;color:white;background-color:red;font-weight: bold;text-transform: uppercase;-moz-border-radius: 2px; padding: 0 2px;}
    HintExtActive>span,,*  {background-color: blue;}
HintExtActive,,*  {background-color: rgba(128,255,128,.3);}
HintExtActive>*,,*  {background-color: blue;}
HintExt::before,,* { /* no style */ }
]]>.toString());

styles.addSheet(true, "HintExtStyle", "*", <><![CDATA[
[liberator|highlight~='HintExtElem'] {
    position: absolute!important;
    margin: 0!important;
}
[liberator|highlight~='HintExt'] {
    position: absolute!important;
    z-index:65535!important;
    line-height: 100%!important;
    white-space: nowrap;
}
[liberator|highlight~='HintExt']::before {
    content: attr(num);
}
]]></>.toString(), true);
}

HintsExt.prototype = {
init: function (hints) {
    this._hintModes = {
        __proto__: original._hintModes,
        __iterator__: function iterator() {
            var seen = {};
            var names = Object.getOwnPropertyNames(this);
            for (let [, name] in Iterator(names)) {
                if (name === "__iterator__") continue;
                yield [name, this[name]];
                seen[name] = 1;
            }
            for (let name in this.__proto__) {
                if (seen[name]) continue;
                yield [name, this[name]];
            }
        },
    };
    this.simpleMaps = [];
    this._reset();
},
get previnput() this._prevInput,
_reset: function () {
    statusline.updateInputBuffer("");
    this._hintString = "";
    this._hintNumber = 0;
    this._usedTabKey = false;
    this._prevInput = "";
    this._pageHints = [];
    this._validHints = [];
    this._canUpdate = false;
    this._docs = [];
    hints.escNumbers = false;
    if (this._activeTimeout) {
        clearTimeout(this._activeTimeout);
    }
    this._activeTimeout = null;
},
show: function _show(minor, filter, win) {
    try {
    let time = Date.now();
    const self = this;
    this._pageHints = [];
    this._hintMode = this._hintModes[minor];
    liberator.assert(this._hintMode);

    var isSelector = this._hintMode.hasOwnProperty(minor);

    commandline.input((isSelector ? "ex:" : "") + this._hintMode.prompt, null, {
        onChange: function(e) { self._hintString != commandline.command && self._onInput(e); },
        onCancel: function () { self._removeHints(); },
    });
    modes.extended = modes.HINTS;

    this._oldHintString = void 0;
    this._submode = minor;
    this._hintString = filter || "";
    this._hintNumber = 0;
    this._usedTabKey = false;
    this._prevInput = "";
    this._canUpdate = false;

    if (!win) win = content.window;

    //gBrowser.selectedBrowser.docShell.isActive = false;

    this._generate(win);

    // get all keys from the input queue
    liberator.threadYield(true);

    this._canUpdate = true;
    this._showHints();

    if (this._validHints.length == 0) {
        liberator.beep();
        modes.reset();
    }
    else if (this._validHints.length == 1)
        this._processHints(false);
    else // Ticket #185
        this._checkUnique();
    //gBrowser.selectedBrowser.docShell.isActive = true;
    liberator.log(<>hints show: {Date.now() - time}ms</>.toString());
    } catch (ex) {
        Cu.reportError(ex);
    }
},
_showHints: function () {
    let pageHints = this._pageHints;
    let hintString = this._hintString;

    this._docs.forEach(function (e) e.root.style.display = "none");
    this._showActiveHint(null, this._hintNumber || 1);

    if (this._prevInput != "number") {
        let validHints = this._validHints = [];
        let test = hints._hintMatcher(hintString);

        for (let i = 0, j = pageHints.length; i < j; ++i) {
            let item = pageHints[i];
            if (test(item.text)) {
                kNum = validHints.length;
                validHints[kNum] = item;
                //item.hint.firstChild.setAttribute("number", hints._num2chars(kNum + 1));
                item.hint.style.display = ""
            } else {
                item.chars = "";
                item.hint.style.display = "none"
            }
        }

        for (let i = 0, j = validHints.length; i < j; ++i) {
            let item = validHints[i];
            item.chars = item.showText ? hints._num2chars(i + 1, j) + ":" + item.text : hints._num2chars(i + 1, j);
            let node = item.hint.firstChild;
            node.removeAttribute("num");
            node.textContent = item.chars;
        }
    } else {
        let num = this._hintNumber == 0 ? "" : this._hintNumberStr;
        let len = num.length;
        let validHints = this._validHints;

        for (let i = 0, j = validHints.length; i < j; ++i) {
            let item = validHints[i];
            let show = item.chars.substr(0, len) === num;
            item.hint.style.display = show ? "" : "none";
            let node = item.hint.firstChild;
            if (show) {
                node.setAttribute("num", num);
                node.textContent = item.chars.substr(len);
            }
        }
    }

    this._docs.forEach(function (e) e.root.style.display = "");
    this._showActiveHint(this._hintNumber || 1);
},
_iterTags: function (win, screen) {
    const doc = win.document;
    let winUtils = getUtils(win);
    let nodeList = Array.slice(winUtils.nodesFromRect(
        screen.left, screen.top, 0, screen.right, screen.bottom, 0, true, true
    ));

    { // sort
        let b = [], item;
        for (let i = 0, j = nodeList.length, k = 0; i < j; ++i) {
            item = nodeList[i];
            if (item.nodeType == Node.ELEMENT_NODE)
                b[k++] = item;
        }

        //xxx: HTMLAreaElement が 含まれないため
        let c = Array.slice(doc.getElementsByTagName("area"));
        if (c.length > 0) Array.splice.apply(null, [b, b.length, 0].concat(c));

        b.sort(function (a, b) a.compareDocumentPosition(b) & 0x2);
        nodeList = b;
    }
    let selector = this._hintMode.tags(win, screen);
    var matcher;
    function makeMatcher(array) {
        let pos = 0;
        return function _matcher(node) {
            let index = array.indexOf(node, pos);
            return index != -1 ? (pos = index + 1) : false;
        };
    }
    if (typeof(selector) == "string") {
        if (selector[0] == "/") { // xpath
            let e, list = [];
            let res = util.evaluateXPath(selector, doc, null, true);
            while(e = res.iterateNext()) list[list.length] = e;
            matcher = makeMatcher(list);
        } else { // selector
            matcher = function (node) node.mozMatchesSelector(selector);
        }
    } else if ("length" in selector) { // Array like
        if (Array.isArray && !Array.isArray(selector))
            selector = Array.slice(selector);
        matcher = makeMatcher(selector);
    } else { //generator
        let list = [];
        for (let e in selector) list[list.length] = e;
        matcher = makeMatcher(list);
    }

    let prev = void 0;
    let toString = Object.prototype.toString;

    for (let i = 0, j = nodeList.length; i < j; ++i) {
        let showText = false;
        let text;
        let node = nodeList[i];
        if (node.nodeType != Node.ELEMENT_NODE) continue;
        if (!matcher(node)) continue;
        else if (prev == (prev =  node)) continue;

        let rects = node.getClientRects();
        if (rects.length === 0) continue;

        let objectName = toString.call(node);
        if (objectName === "[object HTMLInputElement]"
         || objectName === "[object HTMLSelectElement]"
         || objectName === "[object HTMLTextAreaElement]") {
            [text, showText] = this._getInputHint(node, doc);
        //} else if (objectName === "[object HTMLAreaElement]") {
        } else {
            text = node.textContent.toLowerCase();

            //if (!text.trim()) {
            //    let img = node.querySelector("img");
            //    if (img) {
            //        text = img.getAttribute("alt");
            //        let isInline = win.getComputedStyle(node, null).display.substring(0, 6) === "inline"
            //        if (isInline) {
            //            // xxx: Image
            //            let r = doc.createRange();
            //            r.selectNodeContents(node);
            //            rects = r.getClientRects();
            //            r.detach();
            //        }
            //    }
            //}
        }

        if (objectName === "[object HTMLAreaElement]") {
            rects = [this._getAreaOffset(node, rects[0])];
        }

        yield {
            value: node,
            rect: rects,
            text: text,
            showText: showText,
        };
    }
},
_getAreaOffset: function (elem, rect) {
    try {
        let coords = elem.getAttribute("coords").split(/\s*[;,]\s*/g).map(Number);
        let shape  = elem.getAttribute("shape").toLowerCase();

        let x1, y1, x2, y2;
        if ((shape === "rect" || shape === "rectangle") && coords.length === 4) {
            [x1, y1, x2, y2] = coords;
        } else if (shape === "circle" && coords.length === 3) {
            let [x, y, r] = coords;
            [x1, y1, x2, y2] = [x -r, y -r, x + r, y + r];
        } else if ((shape == "poly" || shape == "polygon") && coords.length % 2 == 0) {
            let [x, y] = [coords[0], coords[1]];
            [x1, y1, x2, y2] = [x, y, x, y];
            for (let i = 2, j = coords.length; i < j; i += 2) {
                [x, y] = [coords[i], coords[i + 1]];
                if (x < x1) x1 = x;
                else if (x > x2) x2 = x;
                if (y < y1) y1 = y;
                else if (y > y2) y2 = y;
            }
        } else {
            return rect;
        }
        return HintsExt.Rect(rect.left + x1, rect.top + y1, rect.left + x2, rect.top + y2);
    } catch (ex) {
        return rect;
    }
},
_generate: function _generate(win, screen) {
    if (!win) win = config.browser.contentWindow;
    const doc = win.document;
    if (!screen)
        screen = {top: 0, left: 0, bottom: win.innerHeight, right: win.innerWidth};

    if (screen.right <= 0 || screen.bottom <= 0) return;

    const hintMode = this._hintMode;
    if (hintMode.generate) {
        var obj = hintMode.generate(win, screen);
        if (obj.toString() === "[object Generator]");
        else if ("length" in obj)
            obj = (function _arrayLike(a) {for(let i = 0, j = a.length; i < j; i++) yield a[i];})(obj);
    } else {
        obj = this._iterTags(win, screen);
    }

    let pageHints = this._pageHints;
    let start = pageHints.length;
    let baseNode = util.xmlToDom(
        <div highlight="HintExtElem"><span highlight="HintExt"/></div>,
        doc);
    let root = doc.createElementNS(XHTML, "div");
    root.setAttributeNS(NS, "highlight", "hints");

    root.style.cssText = <>
    z-index: 65535!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    text-align: left!important;
    margin: 0 !important;
    display: none;
</>;
    root.style.display = "none";

    for (let item in obj) {
        let value = item.value;
        let rects = item.rect;
        for (let ri = 0, rj = rects.length; ri < rj; ++ri) {
            let rect = rects[ri];

            let top  = rect.top  > screen.top  ? rect.top  : screen.top;
            let left = rect.left > screen.left ? rect.left : screen.left;
            let width  = rect.right  - left;
            let height = rect.bottom - top;

            if ((width < 0) || (height < 0) || (top > screen.bottom) || (left > screen.right))
                continue;

            let style = "top:" + top + "px;left:" + left + "px;width:" + (width) + "px;height:" + (height) + "px;";
            let num = pageHints.length;
            let e = baseNode.cloneNode(true);
            e.setAttribute("style", style);
            //e.firstChild.setAttribute("number", this._num2chars(num + 1));
            root.appendChild(e);

            pageHints[num] = {
                hint: e,
                elem: value,
                text: item.text || "",
                showText: item.showText || false,
                left: left,
                top:  top,
            };
        }
    }

    let body = doc.body || doc.querySelector("body") || doc.documentElement;
    body.appendChild(root);
    this._docs.push({ doc: doc, start: start, end: pageHints.length - 1, root: root });

    let frames = Array.slice(win.frames);
    for (let i = 0, j = frames.length; i < j; ++i) {
        let frame = frames[i];

        let rect = frame.frameElement.getBoundingClientRect();
        if (rect.top > screen.bottom || rect.left > screen.right) continue;
        let aScreen = {
            top:  Math.max(0, - rect.top),
            left: Math.max(0, - rect.left),
        };
        aScreen.right  = Math.min(screen.right,  rect.right) - rect.left;
        aScreen.bottom = Math.min(screen.bottom, rect.bottom) - rect.top;

        this._generate(frame, aScreen);
    }
},
onEvent: function onEvent(event) {
        let key = events.toString(event);
        let followFirst = false;

        // clear any timeout which might be active after pressing a number
        if (this._activeTimeout) {
            clearTimeout(this._activeTimeout);
            this._activeTimeout = null;
        }

        switch (key) {
        case "<Return>":
            followFirst = true;
            break;

        case "<Tab>":
        case "<S-Tab>":
            this._usedTabKey = true;
            if (this._hintNumber == 0)
                this._hintNumber = 1;

            let oldId = this._hintNumber;

            let length = this._validHints.length;
            let [num, dir] = key == "<Tab>" ? [oldId, 1] : [oldId + length - 2, -1];
            for (let i = 0; i < length; ++i) {
                let offset = (num + dir * i) % length;
                if (!this._validHints[offset].hint.style.display) {
                    this._hintNumber = offset + 1;
                    break;
                }
            }
            this._hintNumberStr = this._num2chars(this._hintNumber, this._validHints.length);

            this._showActiveHint(this._hintNumber, oldId);
            this._updateStatusline();
            return;

        case "<BS>": {
            const self = this;

            if (this._hintNumber > 0 && !this._usedTabKey) {
                this._showActiveHint(null, this._hintNumber);
                let str = this._hintNumberStr;
                str = str.substr(0, str.length - 1);
                this._hintNumberStr = str;
                this._hintNumber = str ? this._chars2num(str) : 0;
                this._showHints();
                if (this._hintNumber == 0)
                    this._prevInput = "text";
            }
            else {
                this._usedTabKey = false;
                let oldId = this._hintNumber;
                let str = this._hintNumberStr;
                str = str.substr(0, str.length - 1);
                this._hintNumberStr = str;
                this._hintNumber = str ? this._chars2num(str) : 0;
                this._showActiveHint(this._hintNumber, oldId);
                liberator.beep();
                return;
            }
            } break;

       case mappings.getMapLeader():
           hints.escNumbers = !hints.escNumbers;
           if (hints.escNumbers && this._usedTabKey) // this._hintNumber not used normally, but someone may wants to toggle
               this._hintNumber = 0;            // <tab>s ? this._reset. Prevent to show numbers not entered.

           this._updateStatusline();
           return;

        default:
            if (key in this.simpleMaps) {
                this.simpleMaps[key].call(this, key);
            } else if (this._isHintNumber(key)) {
                this._prevInput = "number";

                let oldHintNumber = this._hintNumber;
                if (this._hintNumber == 0 || this._usedTabKey) {
                    this._usedTabKey = false;
                    this._hintNumber = this._chars2num(key);
                    this._hintNumberStr = key;
                }
                else {
                    this._hintNumberStr += key;
                    this._hintNumber = this._chars2num(this._hintNumberStr);
                }

                //this._updateStatusline();

                if (!this._canUpdate)
                    return;

                //if (this._docs.length == 0) {
                //    this._generate();
                //    this._showHints();
                //}
                this._showActiveHint(this._hintNumber, oldHintNumber || 1);

                this._showHints();
                liberator.assert(this._hintNumber != 0);

                this._checkUnique();
            }
        }

        this._updateStatusline();

        if (this._canUpdate) {
            if (this._docs.length == 0 && this._hintString.length > 0)
                this._generate();

            //this._showHints();
            this._processHints(followFirst);
        }
	},
    _removeHints: function (num) {
        if (num) {
            this.setTimeout(function() this._removeHints(), num);
            return;
        }
        this._showActiveHint(-1, this._hintNumber);

        this._docs.forEach(function (root) {
            let doc = root.doc;
            let result = util.evaluateXPath("//*[@liberator:highlight='hints']", doc, null, true);
            let hints = [], e;
            while (e = result.iterateNext())
                hints.push(e);
            while (e = hints.pop())
                e.parentNode.removeChild(e);
        });

        this._reset();
    },
    _showActiveHint: function (newId, oldId) {
        let oldElem = this._validHints[oldId - 1];
        if (oldElem) {
            oldElem.hint.setAttributeNS(NS.uri, "highlight", "HintExtElem");
        }

        let newElem = this._validHints[newId - 1];
        if (newElem) {
            newElem.hint.setAttributeNS(NS.uri, "highlight", "HintExtElem HintExtActive");
        }
    },
    _isHintNumber: function (key) options.hintchars.indexOf(key) >= 0 || (key in this.simpleMaps),
    addSimpleMap: function _addSimpleMap(key, callback) {
        const map = this.simpleMaps;
        Array.concat(key).forEach(function (key) {
            map[events.canonicalKeys(key)] = callback;
        });
    },
    removeSimpleMap: function (key) delete this.simpleMaps[key],
    relocation: function _relocation() {
        let time = Date.now();
        function sort(a, b) {
            return (a.left - b.left) || (a.top - b.top);
        }

        const self = this;
        const pageHints = self._pageHints;
        self._docs.forEach(function (root) {
            const doc = root.doc;
            const win = doc.defaultView;
            const size = parseFloat(win.getComputedStyle(self._pageHints[root.start].hint.firstChild, null).fontSize) + 2;
            const lines = [];

            for (let i = root.start, j = root.end; i <= j; i++) {
                let item = pageHints[i];
                let index = Math.floor(item.top / size + .5);
                if (!(index in lines)) lines[index] = [];
                lines[index].push(item);
            };

            // xxx: debug
            if (0) {
                let kE = doc.createElement("div");
                kE.style.position = "absolute";
                kE.style.height  = size + "px";
                kE.style.padding = "0";
                kE.style.width = win.innerWidth + "px";
                for (let i in util.range(0, lines.length)) {
                    let top = i * size;
                    let kE2 = kE.cloneNode(true);
                    kE2.style.top = top + "px";
                    if (i & 1) kE2.style.backgroundColor = "rgba(128,128,128,.3)";
                    root.root.appendChild(kE2);
                }
            }

            lines.forEach(function (line, i) {
                let top = i * size;
                line.sort(sort);

                let left = 0;
                line.forEach(function (item) {
                    let elem = item.hint.firstChild;
                    let w1 = elem.getBoundingClientRect().width;
                    let w2 = item.left - left;
                    if (w1 > w2) {
                        left += w1 + 1;
                        w1 = w2;
                    } else left = item.left + 1;
                    elem.style.left = -w1 + "px";
                    elem.style.top =  (top - item.top) + "px";
                });
            });
        });
        liberator.log(<>relocation:{Date.now() - time} ms</>.toString());
    },
    addModeEx: function (mode, prompt, action, generate) {
        let hintMode = Hints.Mode(prompt, action);
        hintMode.generate = generate;
        this._hintModes[mode] = hintMode;
    }
};
this.Rect = HintsExt.Rect = function (left, top, right, bottom) ({
    left: left,
    top: top,
    right: right,
    bottom: bottom,
});

let src = Hints.prototype._processHints.toSource()
    .replace("this._validHints[activeIndex];", "this._validHints[activeIndex].elem;")
    .replace("e.getAttribute", "e.elem.getAttribute")
    //.replace("_validHints[0]", "_validHints[0].elem")
    .replace("let firstHref = this._validHints[0]", "let firstHref = let(e = this._validHints[0].elem) !e.getAttribute ? null : e")
;

HintsExt.prototype._processHints = liberator.eval("(function() " + src + ")()");

["_num2chars", "_chars2num", "_checkUnique", "_onInput", "_hintMatcher", "_isHintNumber1", "hide", "setTimeout", "addMode", "_updateStatusline", "_getInputHint"]
.forEach(function (a) HintsExt.prototype[a] = Hints.prototype[a]);

////input[not(@type='hidden')] | //xhtml:input[not(@type='hidden')] | //a | //xhtml:a | //area | //xhtml:area | //iframe | //xhtml:iframe | //textarea | //xhtml:textarea | //button | //xhtml:button | //select | //xhtml:select | //*[@onclick or @onmouseover or @onmousedown or @onmouseup or @oncommand or @role='link']
let hinttags = HintsExt.prototype.hinttags
= ["input:not([type='hidden'])", "a", "area", "iframe", "textarea", "button", "select"].concat(
["onclick", "onmouseover", "onmousedown", "onmouseup", "oncommand", "tabindex"].map(function (s) "[" + s + "]"),
['link' ,'button' ,'checkbox' ,'combobox' ,'listbox' ,'listitem' ,'menuitem' ,'menuitemcheckbox' ,
    'menuitemradio' ,'option' ,'radio' ,'scrollbar' ,'slider' ,'spinbutton' ,'tab' ,'textbox' ,'treeitem'].map(function (s) "[role='"+s+"']")
).join(",");

let h = new HintsExt();

modules.hints = h;
hints.addModeEx("f", "Focus Frame", function(win) Buffer.focusedWindow = win, function (win, screen) [{rect: [screen], value: win}]);

if (liberator.globalVariables["use_hints_ext_hinttags"]) {
    options.hinttags = hinttags;
}
if (liberator.globalVariables["use_hints_ext_extendedhinttags"]) {
    options.extendedhinttags = hinttags;
}

{
    let c = liberator.globalVariables["use_hints_ext_caret"];
    let v = liberator.globalVariables["use_hints_ext_visual"];

    if (c || v) {
        let extra = {
            action: function ([elm, line], link) {
                let doc = elm.ownerDocument;
                let win = doc.defaultView;
                let r = doc.createRange();
                let selection = win.getSelection();

                r.setStart(elm, 0);
                selection.removeAllRanges();
                selection.addRange(r);

                Buffer.focusedWindow = win;
                if (line > 0) {
                    for (; line > 0; line--)
                        selection.modify("move", "right", "line");
                    selection.modify("move", "left", "lineboundary");
                }
                options.setPref("accessibility.browsewithcaret", true);
                if (this.prompt === "visual")
                    modes.set(modes.VISUAL, modes.CARET);
            },
            generate: function (win, screen) {
                let nodes = getUtils(win).nodesFromRect(
                    screen.left, screen.top, 0, screen.right, screen.bottom, 0, true, true);
                nodes = Array.slice(nodes);
                {
                    let a = [];
                    for (let i = 0, j = nodes.length; i < j; i++) {
                        let e = nodes[i];
                        if (e.nodeType === Node.TEXT_NODE)
                            a[a.length] = e;
                    }
                    a.sort(function (a, b) a.compareDocumentPosition(b) & 0x2);
                    nodes = a;
                }
                var q;
                var r = win.document.createRange();
                nodes = nodes.filter(function (a) q !== (q = a));
                for (let i = 0, j = nodes.length; i < j; i++) {
                    let e = nodes[i];
                    r.selectNode(e);
                    let rects = r.getClientRects();
                    for (let ri = 0, rj = rects.length; ri < rj; ri++) {
                        yield {
                            rect: [rects[ri]],
                            value: [e, ri],
                            text: e.data,
                        };
                    }
                }
                r.detach();
            }
        };

        if (c) hints.addModeEx(c, "caret",  extra.action, extra.generate);
        if (v) hints.addModeEx(v, "visual", extra.action, extra.generate);
    }
}

switch (liberator.globalVariables["use_hintchars_ex"]) {
// hintchars-ex.js の 移植 {{{
case 1: {
    let cache = {};

    function getProgression(r, n) {
        let table = cache[r] || (cache[r] = {});
        return table[n] || (table[n] = (Math.pow(r, n) - 1) / (r - 1));
    }
    function iterProgression(r) {
        let cur = 1, pre;
        for (let i = 2;; i++) {
            pre = cur;
            cur = getProgression(r, i);
            yield [i, pre, cur];
        }
    }

    let logBase = {};
    function Log(base, num) {
        base = logBase[base] || (logBase[base] = Math.log(base));
        return Math.log(num) / base;
    }

    hints._chars2num = function(chars) {
        const self = this;
        let hintchars = options.hintchars;
        let base = hintchars.length;
        let num = Array.reduce(chars, function(n, c) n * base + hintchars.indexOf(c), 0);

        num += getProgression(base, chars.length);

        return num;
    };
    hints._num2chars = function(num) {
        let hintchars = options.hintchars;
        let base = hintchars.length;
        let digit;
        for (let [i, j, k] in iterProgression(base))
            if (num < k) {
                num -= j;
                digit = i;
                break;
            }

        let chars = "";
        while (num > 0) {
            chars = hintchars[num % base] + chars;
            num = Math.floor(num / base);
            --digit;
        }
        return Array(digit).join(hintchars[0]) + chars;
    };
    hints._checkUnique = function () {
        if (this._hintNumber == 0)
            return;
        liberator.assert(this._hintNumber <= this._validHints.length);

        if (this._hintNumber * options["hintchars"].length < this._validHints.length) {
            let timeout = options["hinttimeout"];
            if (timeout > 0)
                this._activeTimeout = this.setTimeout(function () { this._processHints(true); }, timeout);
        }
        else // we have a unique hint
            this._processHints(true);
    };
} break; //}}}
case 2: {
    hints._chars2num = function(chars) {
        let hintchars = options.hintchars;
        let base = hintchars.length;
        var num = 0;
        for (let i = 0, j = chars.length; i < j; ++i) {
            num = num * base + hintchars.indexOf(chars[i]);
        }
        return num + 1;
    };
    hints._num2chars = function (num, base) {
        let chars = options.hintchars;
        let len = chars.length;
        var s = "";
        num--;
        do {
            s = chars[num % len] + s;
            num = Math.floor(num / len);
        } while (num > 0)
        if (base) {
            let len = chars.length;
            let count = 1;
            for (let x = len; x < base; count++) x *= len;
            for (let i = count - s.length; i > 0; --i)
                s = chars[0] + s;
        }
        return s;
    };
    hints._checkUnique = function () {
        if (this._hintNumber == 0)
            return;
        let vlen = this._validHints.length
        let num = this._num2chars(vlen).length;
        let minNum = (this._hintNumber - 1) * Math.pow(options.hintchars.length, num - this._hintNumberStr.length);

        if (vlen <= minNum) {
            let oldId = this._hintNumber;
            let str = this._hintNumberStr;
            str = str.substr(0, str.length - 1);
            this._hintNumberStr = str;
            this._hintNumber = str ? this._chars2num(str) : 0;
            this._showHints();
            if (this._hintNumber == 0)
                this._prevInput = "text";
            this._showActiveHint(null, oldId);
            liberator.beep();
        }

        if (this._hintNumberStr.length < this._num2chars(this._validHints.length).length) {
            let timeout = options["hinttimeout"];
            if (timeout > 0)
                this._activeTimeout = this.setTimeout(function () { this._processHints(true); }, timeout);
        }
        else // we have a unique hint
            this._processHints(true);
    };
}break;
}
}).call(this);
