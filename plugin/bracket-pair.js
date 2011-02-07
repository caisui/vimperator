// vim: set sw=4 ts=4 et fdm=marker:
var INFO = //{{{
<plugin name="liberator-overlay-ext" version="0.0.1"
    href="http://github.com/caisui/vimperator/blob/master/plugin/bracket-pair.js"
    summary="bracket pair"
    xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            括弧の対応先をハイライトします。
        </description>
    </item>
    <item>
        <spec>関数</spec>
        <description>
            <dl>
                <dt>jumpToMatchItem</dt>
                <dd>対応括弧にジャンプ</dd>
                <dt>show_highlight</dt>
                <dd>対応括弧をハイライトします</dd>
            </dl>
        </description>
    </item>
    <item>
        <spec>{"c_<C-5>"}</spec>
        <tags>{"c_<C-5>"}</tags>
        <description>
            対応括弧へジャンプします
        </description>
    </item>
    <item>
        <tags> g:show_cursor_bracket </tags>
        <spec> let g:show_cursor_bracket </spec>
        <description>
            true で 括弧の両方がハイライトされます。
        </description>
    </item>
</plugin>
; //}}}
(function (self) {
    const close2open = {
        ")": "(",
        "}": "{",
        "]": "[",
    };
    const matchTargets = /[(){}\[\]"'\/]/;
    const re_highlight = /^(js|javascript|echo)/;

    function getMatchRegExp(expression, start, index) //{{{
    {
        const re1 = /((?:[^\\(){}\[\]\/]|\\.)*)([(){}\[\]\/])/yg;
        const re2 = /(?:[^\\\]]|\\.)*\]/yg;
        const re3 = /((?:[^\\\}]|\\.)*)\}/yg;
        let m, c, mm;
        let stack = [];
        let isStart = start == index;
        if(isStart) {
            index = expression.length;
        }
        re1.lastIndex = start;
        while (m = re1.exec(expression)) {
            switch (c = m[2]) {
            case "/":
                if (isStart)
                    return {index: re1.lastIndex, valid: true};
                if (re1.lastIndex == index)
                    return {index: start, valid: true};
                else {
                    return {index: re1.lastIndex, valid: stack.length == 0, next: true};
                } break;
            case "(":
                let (goal = re1.lastIndex == index) {
                    stack.push({index: re1.lastIndex, goal: goal});
                    if (goal) index = expression.length;
                }
                break;
            case ")": {
                if (stack.length == 0) {
                    return {index: start, valid: false};
                }
                let b = stack.pop();
                
                if (b.goal)
                    return {index: re1.lastIndex, valid: true};
                else if (re1.lastIndex == index)
                    return {index: b.index, valid: true};
                } break;
            case "[":
                re2.lastIndex = re1.lastIndex;
                mm = re2.exec(expression);
                if (mm) {
                    if (re1.lastIndex == index)
                        return {index: re2.lastIndex, valid: true};
                    else if (re2.lastIndex == index)
                        return {index: re1.lastIndex, valid: true};
                    re1.lastIndex = re2.lastIndex;
                } else return;
                break;
            case "{":
                re3.lastIndex = re1.lastIndex;;
                mm = re3.exec(expression);
                if (mm) {
                    let valid = let(c = mm[1])
                        /\d/.test(c) && /^\d*,?\d*$/.test(c.replace(/\s/g,""));
                    if (re1.lastIndex == index)
                        return {index: re3.lastIndex, valid: valid};
                    else if (re3.lastIndex == index)
                        return {index: re1.lastIndex, valid: valid};
                    re1.lastIndex = re3.lastIndex;
                }
                break;
            case "]":
            case "}":
                return {index: stack.length ? stack.pop().index : start, valid: false};
            }
            if (re1.lastIndex > index) break;
        }
    } //}}}


    function getMatchPairMain(expression, index, start) //{{{
    {
        const re = /(?:[^"'(){}\[\]\/\\]|\\.)*(["'(){}\[\]\/])/gy;
        const reStr1 = /((?:[^"\\]|\\.)*)(")/gy;
        const reStr2 = /((?:[^'\\]|\\.)*)(')/gy;

        let m, c;
        let stack = [];
        let isString = false;
        re.lastIndex = start || 0;

        while (m = re.exec(expression)) {
            switch (c = m[1]) {
            case "(":
            case "{":
            case "[":
                stack.push({c: c, index: re.lastIndex});
                if (re.lastIndex == index) {
                    index = expression.length + 1;
                    stack[stack.length - 1].goal = true;
                } break;
            case ")":
            case "}":
            case "]":
                if (stack.length == 0) {
                    return {index: 1, valid: false};
                } else {
                    let b = stack.pop();
                    if (b.goal) {
                        return {index: re.lastIndex, valid: b.c == close2open[m[1]]};
                    } else if (re.lastIndex == index) {
                        return {index: b.index, valid: b.c == close2open[m[1]]};
                    }
                }
                break;
            case '"':
            case "'": {
                let re1 = m[1] == '"' ? reStr1 :reStr2;

                re1.lastIndex = re.lastIndex;
                let m1 = re1.exec(expression);
                if (!m1) return null;

                if (index == re1.lastIndex) {
                    return {index: re.lastIndex, valid: true};
                } else if (index == re.lastIndex) {
                    return {index: re1.lastIndex, valid: true};
                }
                re.lastIndex = re1.lastIndex;
                } break;
            case "/": {
                if (expression[re.lastIndex] == " ") break;
                else if (expression[re.lastIndex] == "*") {
                    let re_c = /.*\*\//gy;
                    re_c.lastIndex = re.lastIndex;
                    let m1 = re_c.exec(expression);
                    if (m1) {
                        if (re_c.lastIndex == index)
                            return {index:re.lastIndex, valid: true};
                        else if (re.lastIndex == index)
                            return {index:re_c.lastIndex, valid: true};
                        else
                            re.lastIndex = re_c.lastIndex;
                        break;
                    } else return;
                }
                let ret = getMatchRegExp(expression, re.lastIndex, index);
                if (!ret) return;
                else if (ret.next)
                    re.lastIndex = ret.index;
                else return ret;
                } break;
            }
            if (re.lastIndex > index) break;
        }
    } //}}}

    self.core = {
        getMatchPair: function _getMatchPair(inputField) {
            let i = inputField.selectionEnd;
            let c = inputField.value.substr(i - 1, 1);

            if (i == 0 || !matchTargets.test(c)) return [];

            let ret = getMatchPairMain(inputField.value, i);
            return [ret, i, c];
        },
        jumpToMatchItem: function jumpToMatchItem(inputField) {
            let [inf] = this.getMatchPair(inputField);
            if (inf) {
                if (inputField.selectionStart == inputField.selectionEnd) {
                    inputField.selectionEnd = inputField.selectionStart = inf.index;
                } else {
                    //todo: 選択範囲がある場合は、selectionStart を起点に選択範囲を更新できるようにする
                    inputField.selectionEnd = inputField.selectionStart = inf.index;
                }
            }
        },
        highlight: function highlight(inputField) {
            let [inf, i, c] = this.getMatchPair(inputField);

            let editor = inputField.editor;
            let selectionController = editor.selectionController;
            let aFind = selectionController.getSelection(Ci.nsISelectionController.SELECTION_FIND);
            let aSpell = selectionController.getSelection(Ci.nsISelectionController.SELECTION_SPELLCHECK);

            aFind.removeAllRanges();
            aSpell.removeAllRanges();

            if (!inf) return;


            let doc = editor.document;
            let range = doc.createRange();
            let text = editor.rootElement.childNodes[0];

            range.setStart(text, inf.index - 1);
            range.setEnd(text, inf.index);
            aFind.addRange(range);

            if (liberator.globalVariables.show_cursor_bracket) {
                range = doc.createRange();
                range.setStart(text, i);
                range.setEnd(text, i + 1);
                aFind.addRange(range);
            }

            if (!inf.valid) {
                let range = doc.createRange();
                if (inf.index > i) [i, inf.index] = [inf.index, i];
                range.setStart(text, inf.index);
                range.setEnd(text, i);

                aSpell.addRange(range);
            }
        }
    };
    self.jumpToMatchItem = function() {
        this.core.jumpToMatchItem(Editor.getEditor());
    };
    self.show_highlight = function() {
        this.core.highlight(Editor.getEditor());
    };

    function setup() {
        let inputField = commandline._commandWidget.inputField;
        function check() {
            let text = Editor.getEditor().value;
            if (re_highlight.test(text))
                self.show_highlight();
        }
        inputField.addEventListener("keyup", check, false);
        self.onUnload = function () {
            inputField.removeEventListener("keyup", check, false);
        };
        mappings.addUserMap([modes.COMMAND_LINE], ["<C-5>"], "", function() self.jumpToMatchItem());
    }
    setup();
})(this);
