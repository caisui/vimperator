// vim:set fdm=marker:
var INFO = //{{{
<plugin name="hints-caret" version="0.1.0"
        href="http://github.com/caisui/vimperator/blob/master/plugin/hints-caret.js"
        summary="caret mode"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" />
    <item>
        <description>
            選択ノードにcaret を 配置し modes.CARET に 切り替える。

            ToDo:
                絞り込みの文字列も行分割する
        </description>
    </item>
</plugin>; //}}}

var _pageHints = [];
var _validHints = [];
var _num;
var _str;

function getUtils(win) win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils)

function _removeHints(win) {
    let doc = win.document;
    let result = util.evaluateXPath("//*[@liberator:highlight='hints']", doc, null, true);
    let hints = [], e;
    while (e = result.iterateNext())
        hints.push(e);
    while (e = hints.pop())
        e.parentNode.removeChild(e);

    for (let[,frame] in Iterator(Array.slice(win.frames)))
        _removeHints(frame);
}

let boxStyle = <![CDATA[
    background-color: rgba(255,255,0,.3);
    position: absolute;
]]>.toString();

if (liberator.globalVariables.hintsCaretStyle)
    boxStyle += liberator.globalVariables.hintsCaretStyle;

function _generate(win, screen) {
    const minWidth = liberator.globalVariables.hintsCaretMimWidth || 10;
    const doc = win.document;
    let winUtils = getUtils(win);
    if (!screen)
        screen = {top: 0, left: 0, bottom: win.innerHeight, right: win.innerWidth};
    let range = doc.createRange();

    if (screen.right <= 0 || screen.bottom <= 0) return;
    let nodeList = Array.slice(winUtils.nodesFromRect(
        screen.left, screen.top, 0, screen.right, screen.bottom, 0, true, true
    ));

    let list = _pageHints;
    let prev;
    let baseNode = doc.createElementNS(XHTML, "div");
    //baseNode.setAttributeNS(NS, "highlight", "HintElem");
    baseNode.appendChild(doc.createElementNS(XHTML, "span"));
    baseNode.firstChild.setAttributeNS(NS, "highlight", "Hint");
    let root = doc.createElementNS(XHTML, "div");
    root.setAttributeNS(NS, "highlight", "hints");

    root.style.zIndex = 65535;
    //root.style.position = "absolute";
    //root.style.top = win.scrollY + "px";
    //root.style.left = win.scrollX + "px";
    //root.style.height = "100%";
    //root.style.width = "100%";
    //root.style.overflow = "hidden";

    root.style.position = "fixed";
    root.style.top  = 0;
    root.style.left = 0;
    root.style.textAlign = "left";

    let frames = [];

    try {
    for (let i = nodeList.length - 1; i >= 0; --i) {
        let node = nodeList[i];
        if (node.nodeType == Node.TEXT_NODE) {
            if (prev == (prev = node)) continue;
            range.selectNode(node);
            let rects = range.getClientRects();

            //ToDo: 折り返し状態を含む分割
            let text = range.toString();

            for (let ri = 0, rj = rects.length; ri < rj; ++ri) {
                let r = rects[ri];
                let top  = r.top  > screen.top  ? r.top  : screen.top;
                let left = r.left > screen.left ? r.left : screen.left;
                let width  = r.right  - left;
                let height = r.bottom - top;

                if ((width < minWidth) || (height < 0) || (top > screen.bottom) || (left > screen.right))
                    continue;

                let style = boxStyle + "top:" + top + "px;left:" + left + "px;width:"
                    + (width) + "px;height:" + (height) + "px;";
                let num = list.length;
                let e = baseNode.cloneNode(true);
                e.setAttribute("style", style);
                e.firstChild.setAttribute("number", hints._num2chars(num + 1));
                root.appendChild(e);
                list[num] = {
                    hint: e,
                    node: node,
                    line: ri,
                    text: text
                };
            }
        } else if ("contentWindow" in node) frames[frames.length] = node;
    }
    } catch (ex) {
        Cu.reportError(ex);
    }

    let body = doc.body || doc.querySelector("body");
    body.appendChild(root);

    for (let i = 0, j = frames.length; i < j; ++i) {
        let frame = frames[i];

        let rect = frame.getBoundingClientRect();
        let aScreen = {
            top:  Math.max(0, - rect.top),
            left: Math.max(0, - rect.left),
        };
        aScreen.right  = Math.min(screen.right,  rect.right  - rect.left);
        aScreen.bottom = Math.min(screen.bottom, rect.bottom - rect.top);

        _generate(frame.contentWindow, aScreen);
    }
}

function _showHint(win) {
    _pageHints  = [];
    _validHints = _pageHints;
    _num = "";
    _str = "";
    _removeHints(win);
    _generate(win);
}

function parseInput(value) {
    var num = "", str = "";

    for (let i = 0, j = value.length; i < j; ++i) {
        var c = value[i];
        if (hints._isHintNumber(c))
            num += c;
        else {
            str += c;
            num = "";
        }
    }
    return [num, str];
}

function showCaret()  {showHint(false);}
function showVisual() {showHint(true);}

function showHint(visual) {
    let gWin = content.window;
    _showHint(gWin);
    liberator.assert(_pageHints.length > 0, "not found hint")
    commandline.input(visual ? "visual" : "caret", function (value) {
        [value,] = parseInput(value);
        modes.reset();
        _removeHints(gWin);
        let num = hints._chars2num(value) || 1;
        let hint = _validHints[num - 1];
        liberator.assert(hint, "no hint");
        let doc = hint.node.ownerDocument;
        let win = doc.defaultView;
        let range = doc.createRange();
        range.setStart(hint.node, 0);
        let selection = win.getSelection();

        selection.removeAllRanges();
        selection.addRange(range);

        Buffer.focusedWindow = win;

        if (hint.line > 0) {
            for (let i = 0, j = hint.line; i < j; ++i) {
                selection.modify("move", "right", "line");
            }
            selection.modify("move", "left", "lineboundary");
        }

        selection.modify("extend", "right", "character");
        // check: subdocument position
        let minLeft = 0;
        for (let e = win.frameElement; e; e = e.ownerDocument.defaultView.frameElement) {
            let left = e.getBoundingClientRect().left;
            minLeft -= left < 0  ? left : 0;
        }
        while (selection.getRangeAt(0).getClientRects()[0].left < minLeft) {
            selection.modify("move", "right", "character");
        }
        selection.getRangeAt(0).collapse(true);
        options.setPref("accessibility.browsewithcaret", true);
        if (visual)
            modes.set(modes.VISUAL, modes.CARET);
    }, {
        onChange: function (value) {
            let [num, str] = parseInput(value);
            let len = num.length;

            if (str != _str) {
                _str = str;
                _validHints = [];
                var test = hints._hintMatcher(str);
                for (let i = 0, j = _pageHints.length; i < j; ++i) {
                    let item = _pageHints[i];
                    if (test(item.text)) {
                        kNum = _validHints.length;
                        _validHints[kNum] = item;
                        item.hint.firstChild.setAttribute("number", hints._num2chars(kNum + 1));
                    } else {
                        item.hint.style.display = "none"
                    }
                }
            }

            hints._checkUnique.call({
                _validHints: _validHints,
                _hintNumber: hints._chars2num(num),
                _processHints: function () {
                    commandline.triggerCallback("submit", commandline._currentExtendedMode, num);
                }
            });

            for (let i = 0, j = _validHints.length; i < j; ++i) {
                let item = _validHints[i];
                item.hint.style.display =
                    item.hint.firstChild.getAttribute("number").substr(0, len) == num ? "" : "none";
            }
        },
        onCancel: function () { _removeHints(gWin); }
    });
}

if (parseFloat(Application.version) >= 4) {
    mappings.addUserMap([modes.NORMAL], ["<S-c>"], "", function () showCaret());
    mappings.addUserMap([modes.NORMAL], ["<S-v>"], "", function () showVisual());
    hints.addMode("c", "", null, function() {commandline.close(); window.setTimeout(function () plugins.caretMode.showCaret(), 0); throw 0;});
    hints.addMode("v", "", null, function() {commandline.close(); window.setTimeout(function () plugins.caretMode.showVisual(), 0); throw 0;});
}
