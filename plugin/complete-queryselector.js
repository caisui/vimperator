// vim: set sw=4 ts=4 et :
var INFO = //{{{
xml`<plugin name="complete-queryselector" version="0.0.2"
        href="http://github.com/caisui/vimperator/blob/master/plugin/complete-queryselector.js"
        summary="complete queryselector"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <description>
            <p>query selector で 補完ができるようになります</p>

            Command の completer として利用例
            <code><![CDATA[
                commands.addUserCommand(["test"], "test", function (arg){}, {
                    literal: 0,
                    completer: function (context) plugins.completeQueryselector.complete(context, content.document)
                }, true);
            ]]></code>
        </description>
    </item>
</plugin>`;
//}}}
let JavaScript = javascript.__class__;
JavaScript.completers["querySelector"] = javascriptCompleterQuerySelector;
JavaScript.completers["querySelectorAll"] = javascriptCompleterQuerySelector;

function javascriptCompleterQuerySelector (context, func, obj, args) {
    context = context.fork("base", 0);
    context._filter = context.parent._filter;
    complete(context, obj);
}

let listPseudo = [
    "link",
    "visited",
    "active",
    "hover",
    "focus",
    "lang",
    "not",
    "root",
    "nth-child",
    "nth-last-child",
    "nth-of-type",
    "nth-last-of-type",
    "first-child",
    "last-child",
    "first-of-type",
    "last-of-type",
    "only-of-type",
    "empty",
    "target",
    "checked",
    "enabled",
    "default",
    "disabled",
    "indeterminate",
    "invalid",
    "optional",
    "required",
    "valid",
    "-moz-any"
];

let listStyles = (function () {
    let csssd = CSSStyleDeclaration.prototype;
    return Object.getOwnPropertyNames(csssd)
    .filter(function (css) csssd.__lookupGetter__(css))
    .map(function (css) css.replace(/[A-Z]/g, function (s) "-" + s.toLocaleLowerCase()));
})();

// { xxx:...
//  ^<- offset pos
function parseStyle(offset, str) {
    let i = offset, skip = true, type = ";";
    for (let c = str[i]; c; c = str[++i]) {
        switch (c) {
        case "{":
            return [-2, "err", offset, i];
        case ";":
            skip = true;
            type = c;
            offset = i + 1;
            break;
        case ":":
            skip = false;
            type = c;
            iFilter = i;
            break;
        case "}":
            return [];
        case " ":
            if (skip)
                offset = i + 1;
            break;
        default:
            skip = false;
            break;
        }
    }
    return [i, type/*, begin, end*/, offset];
}

function completeStyle(context) {
    let [, type, offset] = parseStyle(0, context.filter);

    context.title = ["css style"];
    context.anchored = false;

    //debug
    //log(context.filter, type, offset, context.offset);
    context.advance(offset);
    //context.offset += offset;
    if (type === ";") {
        context.completions = listStyles.map(function (c) [c, ""]);
    }
}

function parseAttribute(offset, str) {
    let filter = offset, skip = true, i = offset, type, word = "";
    for (let c = str[i]; c; c = str[++i]) {
        switch (c) {
        case "[":
            if (offset !== i) {
               return [str.length, "err", offset, i - offset];
            }
            type = "[";
            filter = i + 1;
            break;
        case " ":
            if (skip)
                filter = i + 1;
            break;
        case "]":
            return skip
                ? [str.length , "err" , offset , i - offset]
                : [i, c, i, i];
        case "*":
        case "|":
        case "~":
        case "^":
        case "$":
            c = str[++i];
            if (!c) break;
            if (c !== "=")
               return [str.length, "err", offset, i - offset];
            skip = true;
            type = "=";
            offset = i - 1;
            filter = i + 1;

            break;
        case "=":
            if (skip)
                return [str.length, "err", offset, i - offset + 1];
            skip = true;
            type = "=";
            filter = i + 1;
            offset = i;
            break;
        default:
            skip = false;
            break;
        }
    }
    //i, type, sEnd, sFilter
    return [i, type, /*begin,*/ offset - 1, filter];
}

function parsePseudo(offset, str) {
    let i = offset + 1, open = false, type = ":";
    for (let c = str[i]; c; c = str[++i]) {
        switch (c) {
        case "(":
            if (open)
                return [-2, "err", i, 1];
            open = true;
            type = c;
            break;
        case ")":
            if (!open)
                return [-2, "err", i, 1];
            return [i, ")", i, i + 1];
        case "[":
            return [--i, "", i, i];
        case " ":
            if (!open)
                return [--i, "", i, i];
        }
    }
    return [i, type, /*begin,*/ offset, offset];
}

function parseSelector(offset, str) {
    let i = offset, type = " ", sStart = 0, sEnd = -1, sFilter = 0, extra;
    for (let c = str[i]; c; c = str[++i]) {
        switch(c) {
        case ":":
            type = c;
            [i, type, sEnd, sFilter] = parsePseudo(i, str);
            break;
        case ",":
            sStart = i + 1;
            sFilter = i + 1;
            break;
        case "]":
        case "=":
            return [i, "err", i, 1];
            break;
        case "[":
            extra = i + 1;// start attribute name
            [i, type, sEnd, sFilter] = parseAttribute(i, str);
            break;
        case ".":
            sEnd = i - 1;
            sFilter = i;
            type = ".";
            break;
        case ">":
        case "+":
        case "~":
        case " ":
            sFilter = i + 1;
            type = c;
            sEnd = i;
            break;
        }
    }
    return [i, type, sStart, sEnd, sFilter, extra];
}

function complete(context, obj) {
    context.anchored = false;
    obj = obj || content.document;
    let str = context.filter;
    let sEnd = -1, sStart = 0, sFilter = 0, sLast, type = " ";
    let i = 0, sub;
    let selector = "";
    let attr;
    let separator = [" ", "+", "~", ">"];
    var extra;

    [, type, sStart, sEnd, sFilter, extra] = parseSelector(0, context.filter);

    if (type === "err") {
        context.highlight(sEnd, sFilter, "SPELLCHECK");
        return;
    }

    selector = str.substring(sStart, sEnd + 1).trimLeft() || "";

    //debug
    //log("s", sStart, sEnd, selector.quote(), type.quote(), str.substr(sFilter + 1).quote());

    if (type === "=") {
        selector += "]";
        extra = context.filter.substring(sEnd + 1, extra).trim();
    }
    else if (type === "[") {
        if (selector === "") selector = "*";
        if (separator.indexOf(selector.substr(-1)) >= 0)
            selector += "*";
    }
    else if (type === ".") {
        if (separator.indexOf(selector.substr(-1)) >= 0)
            selector += "*";
    }
    else if (type !== "]" && type !== ")" && type !== ":")
        selector += " *";
    if (!selector) selector = "*";

    context.advance(sFilter);

    let tags = [];
    attr = [];
    let clas = [];
    let ids = [];

    //debug
    //log("query", selector.quote());

    if (type === "=") {
        let val = [];
        let cache = context.getCache("prevValue", Object);

        if (cache.node === obj && cache.selector === selector) {
            val = cache.list;
        }
        else {
            for (let [, node] in Iterator(obj.querySelectorAll(selector))) {
                val.push(node.getAttribute(extra));
            }
            val = util.Array.uniq(val);

            cache.node = obj;
            cache.selector = selector;
            cache.list = val;
        }

        context.fork("value", 0, this, function (context) {
            context.title = ["value"];
            let c = "";
            if (/^['"]/.test(context.filter)) {
                c = context.filter[0];
                context.quote = null;
            }
            context.completions = val.map(function (v) [c + v + c, ""]);
        });
        return;
    }
    else if (type === ":") {
        context.fork("pseudo", 0, this, function (context) {
            context.title = ["pseudo"];
            context.completions = listPseudo.map(function (p) [":" + p, ""]);
        });
        return;
    }
    else if (type === "(") {
        //no implementation
        return;
    }

    let cache = context.getCache("prevFull", Object);

    if (cache.node === obj && cache.selector === selector) {
        [tags, attr, clas, ids] = cache.list;
    }
    else {
        try {
            Array.forEach(obj.querySelectorAll(selector), function (node) {
                tags.push(node.tagName.toLowerCase());
                Array.prototype.push.apply(attr, Array.map(node.attributes, function (a) a.name));
                //Fx3.6 NG classList
                Array.prototype.push.apply(clas, Array.slice(node.classList || []));
                if (node.id) ids.push(node.id);
            });
        } catch (ex) {
            Cu.reportError(ex);
            return;
        }

        tags = util.Array.uniq(tags);
        attr = util.Array.uniq(attr);
        clas = util.Array.uniq(clas);

        cache.node = obj;
        cache.selector = selector;
        cache.list = [tags, attr, clas, ids];
    }


    if (type === "[") {
        context.fork("attr", 0, this, function (context) {
            context.title = ["attribute"];
            context.completions = attr.map(function (a) [a, ""]);
        });
    }
    else if (type === "]" || type === ".") {
        context.fork("class", 0, this, function (context) {
            context.title = ["class"];
            context.completions = clas.map(function (c) ["." + c, ""]);
        });
    }
    else if (separator.indexOf(type) >= 0) {
        context.fork("tag", 0, this, function (context) {
            context.anchored = true;
            context.title = ["tag"];
            context.completions = tags.map(function (n) [n, ""]);
        });
        context.fork("id", 0, this, function (context) {
            context.title = ["id"];
            context.completions = ids.map(function (id) ["#" + id, ""]);
        });
        context.fork("class", 0, this, function (context) {
            context.title = ["class"];
            context.completions = clas.map(function (c) ["." + c, ""]);
        });
    }
}
