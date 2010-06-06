// vim: set sw=4 ts=4 et :
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
