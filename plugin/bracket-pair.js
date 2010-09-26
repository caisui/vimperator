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
    const matchTargets = /[(){}\[\]"']/;
    const re_highlight = /^(js|javascript|echo)/;

    function getMatchPairMain(expression, index) {
        const chars = "(){}\\[\\]\\\"'";
        const re = new RegExp(<>([{chars}])(\s*)([^{chars}]*)</>, "g");
        const reStr1 = /((?:[^"\\]|\\.)*)(")/gy;
        const reStr2 = /((?:[^'\\]|\\.)*)(')/gy;

        let m;
        let stack = [];
        let isString = false;
        while (m = re.exec(expression)) {
            switch (m[1]) {
            case "(":
            case "{":
            case "[":
                stack.push({c: m[1], index: m.index});
                if (m.index == index) {
                    index= expression.length;
                    stack[stack.length - 1].goal = true;
                }
                break;
            case ")":
            case "}":
            case "]":
                if (stack.length == 0) {
                    return {index: 0, valid: false};
                } else {
                    let b = stack.pop();
                    if (b.goal) {
                        return {index: m.index, valid: b.c == close2open[m[1]]};
                    } else if (m.index == index) {
                        return {index: b.index, valid: b.c == close2open[m[1]]};
                    }
                }
                break;
            case '"':
            case "'": {
                let re1 = m[1] == '"' ? reStr1 :reStr2;

                re1.lastIndex = m.index + 1;
                let m1 = re1.exec(expression);
                if (!m1) return null;

                if (index == m.index) {
                    return {index: re1.lastIndex - 1, valid: true};
                } else if (index == re1.lastIndex - 1) {
                    return {index: m1.index - 1, valid: true};
                }
                re.lastIndex = re1.lastIndex;
                } break;
            }
            if (re.lastIndex > index) break;
        }
    }

    function event_keyup(evt) {
        const inputField = commandline._commandWidget.inputField;
        const editor = inputField.editor;
        const selectionController = editor.selectionController;
        const aFind = selectionController.getSelection(Ci.nsISelectionController.SELECTION_FIND);
        const aSpell = selectionController.getSelection(Ci.nsISelectionController.SELECTION_SPELLCHECK);

        aFind.removeAllRanges();
        aSpell.removeAllRanges();

        let i = inputField.selectionEnd - 1;
        let c = inputField.value.substr(i, 1);

        if (matchTargets.test(c)) {
            let ret, aType;
            ret = searchOpenBracket(inputField.value, i);

            if (!ret) return;
            let doc = editor.document;
            let range = doc.createRange();
            let elem = editor.rootElement.childNodes[0];

            range.setStart(elem, ret.index);
            range.setEnd(elem, ret.index + 1);
            aFind.addRange(range);

            range = doc.createRange();
            range.setStart(elem, i);
            range.setEnd(elem, i + 1);
            aFind.addRange(range);

            if (!ret.valid) {
                let range = doc.createRange();
                if (ret.index > i) [i, ret.index] = [ret.index, i];
                range.setStart(elem, ret.index);
                range.setEnd(elem, i);

                aSpell.addRange(range);
            }
        }
    }

    self.core = {
        getMatchPair: function _getMatchPair(inputField) {
            let i = inputField.selectionEnd - 1;
            let c = inputField.value.substr(i, 1);
            if (!matchTargets.test(c)) return [];

            return [getMatchPairMain(inputField.value, i), i, c];
        },
        jumpToMatchItem: function jumpToMatchItem(inputField) {
            let [inf] = this.getMatchPair(inputField);
            if (inf) {
                if (inputField.selectionStart == inputField.selectionEnd) {
                    inputField.selectionEnd = inputField.selectionStart = inf.index + 1;
                } else {
                    //todo: 選択範囲がある場合は、selectionStart を起点に選択範囲を更新できるようにする
                    inputField.selectionEnd = inputField.selectionStart = inf.index + 1;
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

            range.setStart(text, inf.index);
            range.setEnd(text, inf.index + 1);
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

    let(inputField = commandline._commandWidget.inputField) {
        const cache_key = "@cache-bracket-pair";
        const eventName = "keyup";
        userContext[cache_key] && inputField.removeEventListener(eventName, userContext[cache_key], false);
        userContext[cache_key] = function() {
            let text = Editor.getEditor().value;
            if (re_highlight.test(text))
                self.show_highlight();
        }
        inputField.addEventListener("keyup", userContext[cache_key], false);
    }
    mappings.addUserMap([modes.COMMAND_LINE], ["<C-5>"], "", function() self.jumpToMatchItem());
})(this);
