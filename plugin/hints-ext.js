// vim: set sw=4 ts=4 fdm=marker et :
//"use strict";
var INFO = //{{{
<plugin name="hints-ext" version="0.0.1"
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
        <spec>let use_hintchars_ex=1</spec>
        <description>
        で、hintchars の 最初の一文字目の出現頻度を同等にします。
        </description>
    </item>

    <item>
    <spec>:let use_hints_ext_hinttags=1</spec>
    <description>
        <o>hinttags</o> をクエリーセレクタ版で上書きします
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
]]>.toString());

styles.addSheet(true, "HintExtStyle", "*", <><![CDATA[
[liberator|highlight~='HintExtElem'] {
    position: absolute!important;
    margin: 0!important;
}
[liberator|highlight~='HintExt'] {
    position: absolute!important;
    z-index:65535!important;
}
]]></>.toString(), true);
}

HintsExt.prototype = {
init: function (hints) {
    this._hintModes = {__proto__: original._hintModes};
    this.simpleMaps = [];
    this._reset();
},
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
                item.chars = item.hint.firstChild.textContent = hints._num2chars(kNum + 1);
                item.hint.style.display = ""
            } else {
                item.chars = "";
                item.hint.style.display = "none"
            }
        }
    } else {
        let num = this._hintNumber == 0 ? "" : this._num2chars(this._hintNumber);
        let len = num.length;
        let validHints = this._validHints;

        for (let i = 0, j = validHints.length; i < j; ++i) {
            let item = validHints[i];
            item.hint.style.display = item.chars.substr(0, len) == num ? "" : "none";
        }
    }

    this._docs.forEach(function (e) e.root.style.display = "");
    this._showActiveHint(this._hintNumber || 1);
},
_generate: function _generate(win, screen) {
    if (!win) win = config.browser.contentWindow;
    const doc = win.document;
    let winUtils = getUtils(win);
    if (!screen)
        screen = {top: 0, left: 0, bottom: win.innerHeight, right: win.innerWidth};

    if (screen.right <= 0 || screen.bottom <= 0) return;
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
        b.sort(function (a, b) a.compareDocumentPosition(b) & 0x2);
        nodeList = b;
    }

    let pageHints = this._pageHints;
    let prev;
    let baseNode = doc.createElementNS(XHTML, "div");
    baseNode.setAttributeNS(NS, "highlight", "HintExtElem");
    baseNode.appendChild(doc.createElementNS(XHTML, "span"));
    baseNode.firstChild.setAttributeNS(NS, "highlight", "HintExt");
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

    let frames = [];
    let selector = this._hintMode.tags(win);
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
    let start = pageHints.length;
    let range = doc.createRange();

    //for (let i = nodeList.length - 1; i >= 0; --i) {
    for (let i = 0, j = nodeList.length; i < j; ++i) {
        let node = nodeList[i];
        if (node.nodeType != Node.ELEMENT_NODE) continue;
        if ("contentWindow" in node) frames[frames.length] = node;
        if (!matcher(node)) continue;
        else if (prev == (prev =  node)) continue;

        let rects = node.getClientRects();

        //if (rects.length == 1) {
        //    rects = [node.getBoundingClientRect()];

        //if (rects.length == 1) {
        //    range.selectNodeContents(node);
        //    let rect1 = range.getBoundingClientRect();
        //    let rect2 = rects[0];
        //    if (rect1.height < (rect2.bottom - rect2.top))
        //        rects = [rect1];
        //}

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
            let text = node.textContent;
            let e = baseNode.cloneNode(true);
            e.setAttribute("style", style);
            //e.firstChild.setAttribute("number", this._num2chars(num + 1));
            root.appendChild(e);

            pageHints[num] = {
                hint: e,
                elem: node,
                text: text,
                left: left,
                top:  top,
            };
        }

    }

    let body = doc.body || doc.querySelector("body") || doc.documentElement;
    body.appendChild(root);
    this._docs.push({ doc: doc, start: start, end: pageHints.length - 1, root: root });

    for (let i = 0, j = frames.length; i < j; ++i) {
        let frame = frames[i];

        let rect = frame.getBoundingClientRect();
        let aScreen = {
            top:  Math.max(0, - rect.top),
            left: Math.max(0, - rect.left),
        };
        aScreen.right  = Math.min(screen.right,  rect.right  - rect.left);
        aScreen.bottom = Math.min(screen.bottom, rect.bottom - rect.top);

        this._generate(frame.contentWindow, aScreen);
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

            this._showActiveHint(this._hintNumber, oldId);
            this._updateStatusline();
            return;

        case "<BS>": {
            const self = this;
            function backChar(number) 
                self._chars2num(let (c=self._num2chars(self._hintNumber)) c.substr(0, c.length - 1));

            if (this._hintNumber > 0 && !this._usedTabKey) {
                this._showActiveHint(null, this._hintNumber);
                this._hintNumber = backChar(this._hintNumber);
                this._showHints();
                if (this._hintNumber == 0)
                    this._prevInput = "text";
            }
            else {
                this._usedTabKey = false;
                let oldId = this._hintNumber;
                this._hintNumber = oldId == 0 ? 1 : backChar(oldId);
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
                }
                else
                    this._hintNumber = this._chars2num(this._num2chars(this._hintNumber) + key);

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
    }
};

let src = Hints.prototype._processHints.toSource()
    .replace("this._validHints[activeIndex];", "this._validHints[activeIndex].elem;")
    .replace("e.getAttribute", "e.elem.getAttribute")
    .replace("_validHints[0]", "_validHints[0].elem")
;

HintsExt.prototype._processHints = liberator.eval("(function() " + src + ")()");


["_num2chars", "_chars2num", "_checkUnique", "_onInput", "_hintMatcher", "_isHintNumber1", "hide", "setTimeout", "addMode", "_updateStatusline"]
.forEach(function (a) HintsExt.prototype[a] = Hints.prototype[a]);

////input[not(@type='hidden')] | //xhtml:input[not(@type='hidden')] | //a | //xhtml:a | //area | //xhtml:area | //iframe | //xhtml:iframe | //textarea | //xhtml:textarea | //button | //xhtml:button | //select | //xhtml:select | //*[@onclick or @onmouseover or @onmousedown or @onmouseup or @oncommand or @role='link']
let hinttags = HintsExt.prototype.hinttags
= ["input:not([type='hidden'])", "a", "area", "iframe", "textarea", "button", "select"].concat(
["onclick", "onmouseover", "onmousedown", "onmouseup", "oncommand", "role='link'"].map(function (s) "[" + s + "]")
).join(",");

let h = new HintsExt();

modules.hints = h;
hints.addMode("f", "" , function(e) Buffer.focusedWindow = e.ownerDocument.defaultView, function () ":root");

if (liberator.globalVariables["use_hints_ext_hinttags"]) {
    options.hinttags = hinttags;
}
if (liberator.globalVariables["use_hints_ext_extendedhinttags"]) {
    options.extendedhinttags = hinttags;
}

// hintchars-ex.js の 移植 {{{

if (liberator.globalVariables["use_hintchars_ex"]) {
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

        // xxx: たぶんあってるが、まるめ誤差とMath.logのコストが心配なので
        //digit = Math.floor(Log(base, (base - 1) * num + 1));
        //num -= getProgression(base, digit++);

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
}
//}}}
}).call(this);
