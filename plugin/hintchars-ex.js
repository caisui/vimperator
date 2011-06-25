// vim: set fdm=marker  et ts=4 sw=4:
var INFO = //{{{
<plugin name="hintchars-ex" version="0.0.3"
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

    this.onUnload = function () {
        delete this.onUnload;
        ["_chars2num", "_num2chars", "_checkUnique"]
            .forEach(function (name) delete hints[name]);
    };
}).call(this);
