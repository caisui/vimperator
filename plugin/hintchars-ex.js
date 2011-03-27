// vim: set fdm=marker  et ts=4 sw=4:
var INFO = //{{{
<plugin name="hintchars-ex" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/hintchars-ex.js"
        summary="Hint Chars Ex"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" />
    <item>
        <description>
            hintchars の 一文字目の利用頻度を他と同等にします。
        </description>
    </item>
</plugin>; //}}}

(function () {
    hints._chars2num = function(chars) {
        const self = this;
        let hintchars = options.hintchars;
        let base = hintchars.length;
        let num = Array.reduce(chars, function(n, c) n * base + hintchars.indexOf(c), 0);
        let digit = 1;

        for (var i = 1, j = chars.length; i < j; ++i)
            num += (digit *= base);

        return num + 1;
    };
    hints._num2chars = function(num) {
        --num;
        let hintchars = options.hintchars;
        let base = hintchars.length;
        let digit = 1;
        for (let i = base; num >= i; ++digit, i *= base) {
            num -= i;
        }
        let chars = "";
        do {
            chars = hintchars[num % base] + chars;
            num = Math.floor(num / base);
            --digit;
        } while (num > 0);
        return Array(digit + 1).join(hintchars[0]) + chars;
    };
    hints._checkUnique = function () {
        let num = this._hintNumber;
        let vnum = this._validHints.length;
        if (num == 0)
            return;
        liberator.assert(num <= vnum);

        let maxnum = this._chars2num(this._num2chars(num) + options.hintchars[0]);

        if (num > 0 &&  maxnum <= vnum) {
            let timeout = options["hinttimeout"];
            if (timeout > 0)
                this._activeTimeout = this.setTimeout(function () { this._processHints(true); }, timeout);
        }
        else
            this._processHints(true);
    };

    this.onUnload = function () {
        delete this.onUnload;
        ["_chars2num", "_num2chars", "_checkUnique"]
            .forEach(function (name) delete hints[name]);
    };
}).call(this);
