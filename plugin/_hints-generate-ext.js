// vim: set sw=4 ts=4 et :
var INFO =
<plugin name="hints._generate.ext" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/_hints-generate-ext.js"
        summary="Hints.prototype._generate extension"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" />
    <item>
        <description>
            Hints で 配列や Generator() で 対象指定可能にする。
            <code>
            hints.addMode(prompt, description, action, tags)
            </code>を拡張

            <ul>
              <li>tags の 引数に win を追加</li>
              <li>返り値として配列を利用可<code>function (win) win.document.querySelectorAll("a.l")</code></li>
              <li>返り値としてGeneratorを利用可
                <code><![CDATA[
                    function (win) {
                        for (let [, e] in Iterator(win.document.querySelectorAll("a.l"))) {
                            //何かフィルター処理
                            yield e;
                        }
                    }
              ]]></code></li>
            </ul>
        </description>
    </item>
</plugin>
;
(function () {
    function patch(obj, attr, func) {
        let backup = "__patch__" + attr;
        let target = (backup in obj) ? obj[backup] : obj[attr];
        obj[attr] = liberator.eval("(function ()" + func(target) + ")()", obj[attr]);
        obj[backup] = target;
    }
    patch(Hints.prototype, "_generate", function (code) {
        code = code.toString()
        .replace(
            <>var res = util.evaluateXPath(this._hintMode.tags(), doc, null, true);</>,
            <><![CDATA[
            let res = this._hintMode.tags(win);

            function _normal_generator(tags) {
                res = util.evaluateXPath(tags, doc, null, true);
                let elem;
                while(elem = res.iterateNext()) yield elem;
            }
            if (typeof(res) === "string") {
                res = _normal_generator(res);
            } else if ("length" in res) {
                res = util.Array.itervalues(res);
            } else if ("__iterator__" in res) {
                // no work
            } else {
                res = _normal_generator(res);
            }
        ]]></>)
        .replace(
            <>while ((elem = res.iterateNext()))</>,
            <>for (elem in res)</>
        );
        return code;
    });
})();
