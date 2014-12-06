// vim: set sw=4 ts=4 fdm=marker et :
//"use strict";
var INFO = //{{{
xml`<plugin name="hints-ext" version="0.0.3"
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
    <spec>:let use_hints_ext_tranform=1</spec>
    <description>
        css transform を 考慮して表示します。
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
        <p>
            <k name="C-h"/>で入力済み char を 削除(=<k name="BS"/>の動作をmap)
            <code><![CDATA[
                hints.addSimpleMap(["<C-h>"], function () {
                    this.onEvent({liberatorString: "<BS>"});
                });
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
</plugin>`;
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
function getCache(obj, key, fn) {
    return obj[key] || (obj[key] = (fn || Object)());
}

if (!highlight.get("HintExtElem")) {
highlight.loadCSS(`
    HintExtElem,,*  {
        border: 1px solid rgba(128,128,128,.5);
        border-radius: 2px;
        background-color: rgba(255,255,128, .1);
        -moz-box-sizing: border-box;
    }
    HintExtActive,,*  {background-color: rgba(128,255,128,.3);}
    HintExt,,* {font-size: 12px;color:white;background-color:red;font-weight: bold;text-transform: uppercase;border-radius: 2px; padding: 0 2px;}
    HintExtActive>span,,*  {background-color: blue;}
HintExtActive,,*  {background-color: rgba(128,255,128,.3);}
HintExtActive>*,,*  {background-color: blue;}
HintExt::before,,* { /* no style */ }
`);

styles.addSheet(true, "HintExtStyle", "*", `
[liberator|highlight~='HintExtElem'] {
    position: absolute;
    margin: 0;
    overflow: visible;
}
[liberator|highlight~='HintExt'] {
    position: absolute;
    white-space: nowrap;
    overflow: visible;
    z-index: 1;
}
[liberator|highlight~='HintExt']::before {
    content: attr(num);
}
[liberator|highlight~='HintExtActive'] {
    z-index: 2;
}
[liberator|highlight~='HintExtRootElem'] {
    z-index:65536;
    position: fixed;
    top: 0;
    left: 0;
}
[liberator|highlight~='HintExtFrameElem'] {
    z-index:65536;
    position: absolute;
    overflow: hidden;
}
`, true);
}

HintsExt.prototype = {
get original() original,
init: function (hints) {
    this._reset();
},
get _hintModes() getCache(userContext, "hints._hintModes@cache", function () {
    var dest = {};
    var src = original._hintModes;
    for (var a in src) {
        dest[a] = src[a];
    }
    return dest;
}),
get simpleMaps() getCache(userContext,"hints.simpleMaps@cache", Array),
get previnput() this._prevInput,
_reset: function () {
    statusline.updateField("input", "");
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
show: function show(minor, filter, win) {
    this._show({ minor: minor, filter: filter, win: win,});
},
_show: function _show(kwargs) {
    try {
    var minor = kwargs.minor;
    var filter = kwargs.filter;
    var win = kwargs.win;
    var adj = ("adj" in kwargs) ? kwargs.adj : !liberator.globalVariables.disable_adj_inline;

    let time = Date.now();
    const self = this;
    this._pageHints = [];
    this._hintMode = this._hintModes[minor];
    liberator.assert(this._hintMode);

    var isSelector = this._hintMode.hasOwnProperty(minor);

    commandline.input((isSelector ? "ex:" : "") + this._hintMode.prompt, null, {
        default: filter,
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
    this._adjInline = adj;

    if (!win) win = content.window;
    this._window = Cu.getWeakReference(win);

    this._generate(win);

    // get all keys from the input queue
    liberator.threadYield(false);

    this._canUpdate = true;

    if (liberator.globalVariables.use_hints_ext_tranform)
        this.relocation_transform();

    this._showHints();

    if (this._validHints.length == 0) {
        liberator.beep();
        modes.reset();
    }
    else if (this._validHints.length == 1)
        this._processHints(false);
    else // Ticket #185
        this._checkUnique();

    liberator.log(`hints show: ${Date.now() - time}ms`);
    } catch (ex) {
        Cu.reportError(ex);
        this._reset();
    }
},
_showHints: function () {
    let pageHints = this._pageHints;
    let hintString = this._hintString;
    var dummy = let (nop=function(){}) ({
        style: {},
        setAttribute: nop,
        setAttributeNS: nop,
        removeAttribute: nop,
        removeAttributeNS: nop,
    });

    this._hintRoot.style.display = "none";
    this._docs.forEach(function (e) {
        if (Cu.isDeadWrapper(e.root)) {
            var items = pageHints;

            e.root = dummy;
            for (var i = e.start; i <= e.end; i++) {
                var item = pageHints[i];
                item.hint = dummy;
                item.label = dummy;
                item.rect_list = [];
            }
        }
    });
    this._showActiveHint(null, this._hintNumber || 1);

    if (this._prevInput != "number") {
        let validHints = this._validHints = [];
        let test = hints._hintMatcher(hintString);

        for (let i = 0, j = pageHints.length; i < j; ++i) {
            let item = pageHints[i];

            if (test(item.text)) {
                kNum = validHints.length;
                validHints[kNum] = item;
                var display = "";
            } else {
                item.chars = "";
                var display = "none";
            }
            var ri, rj = item.rect_list.length;
            for (ri = 0; ri < rj; ri++)
                item.rect_list[ri].style.display = display;
            item.label.style.display = display;
        }

        //XXX: _num2chars が validHints.length 依存のため
        for (let i = 0, j = validHints.length; i < j; ++i) {
            let item = validHints[i];
            item.chars = item.showText ? hints._num2chars(i + 1, j) + ":" + item.text : hints._num2chars(i + 1, j);
            let node = item.label;
            node.removeAttribute("num");
            node.textContent = item.chars;
        }
    } else {
        let num = this._hintNumber == 0 ? "" : this._hintNumberStr;
        let len = num.length;
        let validHints = this._validHints;

        for (let i = 0, j = validHints.length; i < j; ++i) {
            let item = validHints[i];
            let show = item.chars.lastIndexOf(num, 0) === 0;
            let style_display = show ? "" : "none";
            item.label.style.display = style_display;
            for (var ri = 0, rj = item.rect_list.length; ri < rj; ri++)
                item.rect_list[ri].style.display = style_display;

            let node = item.label;
            if (show) {
                node.setAttribute("num", num);
                node.textContent = item.chars.substr(len);
            }
        }
    }

    this._showActiveHint(this._hintNumber || 1);
    this._hintRoot.style.display = "";
},
_getOnscreenElements1: function (win, screen) {
    var doc = win.document;
    let winUtils = getUtils(win);
    let nodeList = Array.slice(winUtils.nodesFromRect(
        screen.left, screen.top, 0, screen.right, screen.bottom, 0, true, true
    ));

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
    return b;
},
_getOnscreenElements2: function (win, screen) {
    var doc = win.document;
    let winUtils = getUtils(win);
    let nodeList = Array.slice(winUtils.nodesFromRect(
        screen.left, screen.top, 0, screen.right, screen.bottom, 0, true, true
    ));

    let b = [], item, p;
    var uniq = new Set, nodeType;
    for (let i = 0, j = nodeList.length, k = 0; i < j; ++i) {
        item = nodeList[i];
        nodeType = item.nodeType;
        if (nodeType === Node.TEXT_NODE)
            item = item.parentNode;
        if (item.nodeType == Node.ELEMENT_NODE) {
            for (; !uniq.has(item) && item; item = item.parentElement) {
                uniq.add(item);
            }
        }
    }

    //xxx: HTMLAreaElement が 含まれないため
    //let c = Array.slice(doc.getElementsByTagName("area"));
    b = [...uniq, ...doc.getElementsByTagName("area")];
    //if (c.length > 0) Array.splice.apply(null, [uniq, uniq.size, 0].concat(c));

    b.sort(function (a, b) a.compareDocumentPosition(b) & 0x2);
    return b;
},
fixRect0: true,
_iterTags: function iterTag(win, screen) {
    const doc = win.document;
    var nodeList = this["_getOnscreenElements" + (this.fixRect0 ? 2 : 1)](win, screen);

    let selector = this._hintMode.tags(win, screen);
    var matcher;
    function makeMatcher(array) {
        const src = new Set(array);
        return function _matcher(node) {
            return src.has(node);
        };
    }
    if (typeof(selector) == "string") {
        if (selector[0] == "/") { // xpath
            matcher = makeMatcher((e for(e in util.evaluateXPath(selector, doc, null, true))));
        } else { // selector
            matcher = function (node) node.mozMatchesSelector(selector);
        }
    } else if (selector instanceof Function) {
        matcher = selector;
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
            if (this._adjInline && !node.clientHeight) {
                for (var c of node.getElementsByTagName("*")) {
                    if (c.clientHeight) {
                        let r = doc.createRange();
                        r.selectNodeContents(c.parentNode);
                        rects = r.getClientRects();
                        r.detach();
                        // merge
                        if (rects.length > 1) {
                            let prev = {}; // dummy
                            let res = [];
                            for (r of rects) {
                                if (r.top === r.bottom || r.left === r.right) {
                                } else if (r.top === prev.top && r.bottom === prev.bottom) {
                                    prev.right = r.right;
                                } else {
                                    prev = HintsExt.Rect(r.left, r.top, r.right, r.bottom);
                                    res[res.length] = prev;
                                }
                            }

                            if (res.length) {
                                rects = res;
                            }
                        }
                        break;
                    }
                }
            }

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
createRootElement: function getRootElement(win) {
    var stack = [];
    var doc = win.document;
    var stack = [];
    var du = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
    var e = doc;
    while (e = du.getParentForNode(e, true)) {
        stack.push(e);
        doc = e = e.ownerDocument;
    }
    var root = doc.createElementNS(XHTML, "div");
    root.setAttributeNS(NS, "highlight", "HintExtRootElem");

    var cur = root;
    while (e = stack.pop()) {
        var box = e.ownerDocument.createElementNS(XHTML, "div");
        box.setAttributeNS(NS, "highlight", "HintExtFrameElem");
        var rect = e.getBoundingClientRect();
        box.style.cssText =`
            left:   ${rect.left}px;
            top:    ${rect.top}px;
            width:  ${rect.width}px;
            height: ${rect.height}px;
        `;
        cur.appendChild(box);
        cur = box;
    }
    root.style.display = "none";
    (doc.body || doc.documentElement || doc.querySelector("body")).appendChild(root);
    this._hintRoot = root;
    return [root, cur];
},
_generate: function _generate(win, screen) {
    if (!win) win = config.browser.contentWindow;
    const doc = win.document;
    if (!screen)
        screen = {top: 0, left: 0, bottom: win.innerHeight, right: win.innerWidth, root: this.createRootElement(win)};
    else if (!screen.root) {
        screen.root = this.createRootElement(win);
    }

    if (screen.right <= 0 || screen.bottom <= 0) return;

    const hintMode = this._hintMode;
    if (hintMode.generate) {
        var obj = hintMode.generate(win, screen);
        if (obj.toString() === "[object Generator]");
        else if ("length" in obj)
            obj = (function _arrayLike(a) {var i; for(i = 0, j = a.length; i < j; i++) yield a[i];})(obj);
    } else {
        obj = this._iterTags(win, screen);
    }

    var pageHints = this._pageHints;
    var start = pageHints.length;
    var baseNode = util.xmlToDom(
        xml`<div highlight="HintExtElem"><span highlight="HintExt"/></div>`,
        screen.root[1].ownerDocument);
    var root = screen.root[1];

    var appended;
    var item, value, rects;
    var top, left, width, height, rect, num, e, style;
    var ri, rj;
    for (item in obj) {
        value = item.value;
        rects = item.rect;
        appended = false;
        for (ri = 0, rj = rects.length; ri < rj; ++ri) {
            rect = rects[ri];

            top  = rect.top  > screen.top  ? rect.top  : screen.top;
            left = rect.left > screen.left ? rect.left : screen.left;
            width  = rect.right  - left;
            height = rect.bottom - top;

            if ((width < 0) || (height < 0) || (top > screen.bottom) || (left > screen.right))
                continue;

            style = "top:" + top + "px;left:" + left + "px;width:" + (width) + "px;height:" + (height) + "px;";

            num = pageHints.length;
            e = baseNode.cloneNode(true);
            e.setAttribute("style", style);
            //e.firstChild.setAttribute("number", this._num2chars(num + 1));
            root.appendChild(e);

            if (!appended) {
                pageHints[num] = {
                    hint: e,
                    label: e.firstChild,
                    elem: value,
                    text: item.text || "",
                    showText: item.showText || false,
                    left: left,
                    top:  top,
                    rect_list: [e],
                };
                appended = true;
            } else {
                var rect_list = pageHints[num -1].rect_list;
                rect_list[rect_list.length] = e;
            }
        }
    }

    this._docs.push({ doc: doc, start: start, end: pageHints.length - 1, root: root });

    var frames = Array.slice(win.frames);
    var aScreen, frame;
    for (var i = 0, j = frames.length; i < j; ++i) {
        frame = frames[i];

        if (!frame.frameElement)
            continue;

        rect = frame.frameElement.getBoundingClientRect();
        if (rect.top > screen.bottom || rect.left > screen.right) continue;
        var box = root.ownerDocument.createElementNS(XHTML, "div");
        box.setAttributeNS(NS, "highlight", "HintExtFrameElem");
        box.style.cssText = `left:${rect.left}px; top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
        root.appendChild(box);
        aScreen = {
            top:  Math.max(0, - rect.top),
            left: Math.max(0, - rect.left),
            root: [screen.root[0], box],
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

            if (this._prevInput === "text") {
                editor.executeCommand("cmd_deleteCharBackward", 1);
                break;
            }

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
        if (this._hintRoot) {
            this._hintRoot.parentNode.removeChild(this._hintRoot)
            this._hintRoot = null;
        }

        this._reset();
    },
    _showActiveHint: function (newId, oldId) {
        let oldElem = this._validHints[oldId - 1];
        if (oldElem) {
            oldElem.rect_list.forEach(function (e) {
                e.setAttributeNS(NS.uri, "highlight", "HintExtElem");
            });
        }

        let newElem = this._validHints[newId - 1];
        if (newElem) {
            newElem.rect_list.forEach(function (e) {
                e.setAttributeNS(NS.uri, "highlight", "HintExtElem HintExtActive");
            });
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
    redraw: function () {
        var minor = this._submode;
        var filter = this._hintString;
        var win = this._window.get();
        this.hide();
        this.show(minor, filter, win);
    },
    toggleInlineAdj: function () {
        var minor = this._submode;
        var filter = this._hintString;
        var win = this._window.get();
        this.hide();
        this._show({
            minor: minor,
            filter: filter,
            win: this._window.get(),
            adj: !this._adjInline,
        });
    },
    moveActiveHint: function moveActiveHint(count) {
        if (!count) count = 10;
        var startTime = Date.now();
        var items = [i for(i of this._validHints) if (i.label.style.display === "")];
        var last = items.length - 1;
        var oldNumber = this._hintNumber || 1;

        var index = items.indexOf(this._validHints[oldNumber - 1]);
        if (index === -1) index = 0;

        if (index === 0 && count < 0) {
            index = last;
        } else if (count > 0 && index === last) {
            index = 0;
        } else {
            index = Math.max(0, Math.min(index + count, last));
        }
        this._hintNumber = this._validHints.indexOf(items[index]) + 1;
        this._showActiveHint(this._hintNumber, oldNumber);
        Cu.reportError(Date.now() - startTime);
    },
    relocation: function _relocation() {
        let time = Date.now();
        function sort(a, b) {
            return (a.left - b.left) || (a.top - b.top);
        }

        const self = this;
        const pageHints = self._pageHints;

        for (var item of pageHints) {
            item.r = item.label.getBoundingClientRect();
        }

        self._docs.forEach(function (root) {
            const doc = root.doc;
            const win = doc.defaultView;

            if (root.start > root.end) {
                return;
            }

            const size = parseFloat(win.getComputedStyle(self._pageHints[root.start].label, null).fontSize) + 2;
            const lines = [];

            var items = pageHints.slice(root.start, root.end);
            items.sort(function (a, b) a.top - b.top);

            var item, top = 0, a, bottom = -Infinity;

            for (var item of items) {
                if (item.top > bottom) {
                    a = lines[lines.length] = [item];
                    bottom = item.top + size;
                } else {
                    a[a.length] = item;
                }
            }

            lines.forEach(function (line, i) {
                let top = line[0].top;
                line.sort(sort);

                let left = 0;
                line.forEach(function (item) {
                    let elem = item.label;
                    let w1 = item.r.width;
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
        liberator.log(`relocation: ${Date.now() - time}ms`);
    },
    relocation_transform: function relocation_transform() {
        if (this._pageHints.transform) return;

        var tick = Date.now();
        const self = this;
        const pageHints = self._pageHints;
        if (pageHints[0].elem instanceof Node) aMode = 0;
        else if (pageHints[0].elem[0] instanceof Text) aMode = 1;
        else {
            Cu.reportError("do not support type");
            return;
        }
        const mode = aMode;
        const isTrans = "transform" in CSSStyleDeclaration.prototype;
        const _Moz_ = isTrans ? "" : "-moz-";
        const Moz = isTrans ? "" : "Moz";
        const [transform, transformOrigin, transformStyle] = isTrans
            ? ["transform", "transformOrigin", "transformStyle"]
            : ["MozTransform", "MozTransformOrigin", "MozTransformStyle"]
        self._docs.forEach(function (root) {
            const doc = root.doc;
            const win = doc.defaultView;
            const wm = new WeakMap;
            const rootElement = root.root;
            const body = rootElement.parentNode;
            var fragment = doc.createDocumentFragment();
            if (mode === 1) var fragment_label = doc.createDocumentFragment();

            body.removeChild(rootElement);
            var offset_list = [];

            var range = doc.createRange();
            function getOffsetPosition(node) {
                var left = node.offsetLeft;
                var top = node.offsetTop;
                var parent = node.parentNode;

                if (parent) return ({left: left, top: top});
                var res = getOffsetPosition(parent);
                res.top += top;
                res.left += left;
                return res;
            }

            for (let i = root.start, j = root.end; i <= j; i++) {
                var item = pageHints[i];

                var parent = mode === 0 ? item.elem : item.elem[0].parentNode;
                var prev = null, base = null, count = 0, node1;
                node1 = parent;
                while (parent) {
                    var node = wm.get(parent);
                    if (node) {
                        if (!base) base = node;
                        if (prev) node.appendChild(prev);
                        break;
                    }

                    node = doc.createElement("div");
                    var s = win.getComputedStyle(parent, null);

                    if (s[transform] !== "none") node.setAttribute("trans", true);

                    node.style.cssText = `
                        position: absolute!important;
                        ${_Moz_}transform: ${s[transform]}!important;
                        ${_Moz_}transform-origin: ${s[transformOrigin]}!important;
                        ${_Moz_}transform-style:  ${s[transformStyle]}!important;
                        top:       ${parent.offsetTop}px!important;
                        left:      ${parent.offsetLeft}px!important;
                        height:    ${parent.offsetHeight}px!important;
                        width:     ${parent.offsetWidth}px!important;
                    `;
                    node.setAttributeNS(NS, "highlight", "hints");
                    if (prev) node.appendChild(prev);
                    else base = node;

                    wm.set(parent, node);

                    prev = node;
                    parent = parent.offsetParent;
                }
                if (!node.parentNode)
                    fragment.appendChild(node);

                if (!base.mozMatchesSelector("[trans], [trans] *")) continue;
                node = item.hint;

                range.selectNode(node1);
                var rect = range.getBoundingClientRect();
                var label = item.label;
                if (mode === 0) {
                    var rect_list = item.rect_list;
                    var rects = range.getClientRects();
                    for (var ri = 0, rj = rect_list.length; ri < rj; ri++) {
                        node = rect_list[ri];
                        rect = rects[ri];
                        node.style.cssText = `
                            top:        ${rect.top - rects[0].top}px;
                            left:       ${rect.left - rects[0].left}px;
                            width:      ${rect.width}px;
                            height:     ${rect.height}px;
                        `;
                        base.appendChild(node);
                    }
                    label.style.cssText = `
                        top:  ${item.top}px;
                        left: ${item.left}px;
                    `;
                    rootElement.appendChild(label);
                } else if (mode === 1) {
                    // caret(visible) mode
                    node.style.cssText = `
                        top:        ${item.top  - rect.top}px;
                        left:       ${item.left - rect.left}px;
                        width:      ${node.style.width};
                        height:     ${node.style.height};
                    `;
                    base.appendChild(node);
                    fragment_label.appendChild(label);
                    item.label = label;
                }
            }

            body.appendChild(rootElement);
            body.appendChild(fragment);

            if (fragment_label) {
                for (let i = root.start, j = root.end; i <= j; i++) {
                    var item = pageHints[i];
                    if (!item.label) continue;
                    rect = item.hint.getBoundingClientRect();
                    item.label.style.cssText = `
                        top:    ${rect.top > 0 ? rect.top : 0}px;
                        left:   ${rect.left > 0 ? rect.left: 0}px;
                    `;
                }
                rootElement.appendChild(fragment_label);
            }
            range.detach();
        });
        liberator.log(`transform relocation: ${Date.now() - tick}ms`);
        this._pageHints.transform = true;
    },
    addModeEx: function (mode, prompt, action, generate) {
        let hintMode = Hints.Mode(prompt, action);
        hintMode.generate = generate;
        this._hintModes[mode] = hintMode;
    },
    nodesFromRect: function nodesFromRect(win, screen) {
        if (!screen) {
            screen = {
                left: 0,
                top: 0,
                right: win.innerWidth,
                bottom: win.innerHeight,
            };
        }
        return getUtils(win).nodesFromRect(
            screen.left, screen.top, 0, screen.right, screen.bottom, 0, true, true);
    },
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

["_num2chars", "_chars2num", "_checkUnique", "_onInput", "_hintMatcher", "_isHintNumber1", "hide", "setTimeout", "addMode", "_updateStatusline", "_getInputHint", "startExtendedHint"]
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

if (liberator.globalVariables["use_hints_ext_hinttags"] && !options.get("het")) {
    options.add(["hintexttags", "het"],
        "XPath or query string of hintable elements activated by 'f' and 'F'",
        "string", hinttags, { scope: Option.SCOPE_BOTH });
    let defalutTags = Hints.Mode().tags.toString();
    let queryTags = function () options.hintexttags;
    for (let [a, obj] in Iterator(h._hintModes)) {
        if (obj.tags == defalutTags && !obj.generate) {
            h._hintModes[a] = Hints.Mode(obj[0], obj[1], queryTags);
        }
    }
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
            generate: function textnode_generate(win, screen) {
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
