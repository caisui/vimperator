// vim: set fdm=marker :
var INFO = //{{{
<plugin name="piyo-ui" version="0.0.0"
        href="http://github.com/caisui/vimperator/blob/master/plugin/inspectorUI.js"
        summary="Inspector UI"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <description>
        </description>
    </item>
</plugin>;
//}}}
(function () {
    if (!has(window, "InspectorUI")) return;
    function has(a, b) b in a

    this.commands =  Commands();
    var chromeMode = "chrome-mode";

    commands.add(["dom"], "append node", function (args) {
        var dom = IUI.selection || IUI.defaultSelection;
        let method = args["--position"] || "beforeend";
        let text = args[0] || "";

        if (args["--scratchpad"]) {
            plugins.scratchpad.callScratchPad({"-ft": "html"}, function () {
                this.setText(text);
                this.saveFile = function () {
                    append(this.getText());
                    method = "replace";
                    dom = iui.node;
                };
                window.focus();
            });
        } else append(text);
        function append(text) {
            liberator.assert(dom, "dom in null");
            var doc = dom.ownerDocument;
            var win = doc.defaultView;
            var r = doc.createRange();
            r.selectNode(dom);
            var e = r.createContextualFragment(text);
            var e1 = e.querySelector("*");

            switch (method) {
            case "replace":
                dom.parentNode.replaceChild(e, dom);
                break;
            case "beforebegin":
                dom.parentNode.insertBefore(e, dom);
                break;
            case "afterbegin":
                dom.insertBefore(e, dom.firstElementChild);
                break;
            case "beforeend":
                dom.appendChild(e);
                break;
            case "afterend":
                dom.parentNode.insertBefore(e, dom.nextElementSibling);
                break;
            }
            IUI.inspectNode(e1, false);
        }
    }, {
        options: [
            [["--scratchpad"], commands.OPTION_NOARG],
            [["--position", "-p"], commands.OPTION_STRING, null, function (context) {
                context.compare = null;
                return [
                    ["replace",     "Replaces one child node of the specified element with another"],
                    ["beforebegin", "Before the element itself"],
                    ["afterbegin",  "Just inside the element, before its first child"],
                    ["beforeend",   "Just inside the element, after its last child (default)"],
                    ["afeterend",   "After the element itself"],
                ];
            }],
        ],
        argCount: "?",
        literal : 0,
    });
    commands.add("sty[le]", "update style", function (args) {
        let dom = selection;
        args[0].split(";").forEach(function (s) {
            let i = s.indexOf(":");
            let [a, b] = [s.substring(0, i).trim(), s.substring(i + 1).trim()];
            dom.style[a.replace(/-./g, function (c) c[1].toUpperCase())] = b;
        });
    }, {
        argCount: 1,
        literal: 0,
        completer: function (context) {
            context.title = ["attribute style"];
            let dom = selection;
            let skip = context.filter.lastIndexOf(";") + 1;
            if (skip) {
                skip += context.filter.substr(skip).match(/^\s*/)[0].length;
                context.advance(skip);
            }
            context.anchored = false;
            context.completions = context.getCache("attr", function () dom.style.cssText.split(";")
                .map(function (s) {
                    let i = s.indexOf(":");
                    return [s.substring(0, i).trim(), s.substring(i + 1).trim()];
                }));
            context.fork("style", 0, this, function (context) {
                context.title = ["computed style"];
                context.completions = context.getCache("computed", function() {
                    let win = dom.ownerDocument.defaultView;
                    let style = win.getComputedStyle(dom, null);
                    return Array.map(style, function (n1, i) {
                        var n2 = n1.replace(/-./g, function (s) s[1].toUpperCase());
                        return [n1, style[n2]];
                    });
                });
            });
        },
    });
    ["js", "echo"].forEach(function (cmd)
        commands._exCommands.push(liberator.modules.commands.get(cmd)));

    this.__defineGetter__("selection", function () IUI.selection || IUI.defaultSelection);

    var dispose = [];
    var IUI = InspectorUI;
    function on(dom, name, callback, capture) {
        dom.addEventListener(name, callback, capture);
        return function off() dom.removeEventListener(name, callback, capture);
    }
    function lazyGetter(obj, name, callback) {
        obj.__defineGetter__(name, function () {
            delete this[name];
            return this[name] = callback.call(this);
        });
    }
    function lazyFunction(obj, name, callback) {
        var local = new Object();
        lazyGetter(local, name, function () callback.call(obj));
        obj[name] = function _lazyFunction() local[name].apply(this, arguments);
    }

    this.iui = {
        _tabList: null,
        get selection() IUI.selection || IUI.defaultSelection,
        get node() this.selection,
        get caret() targetter(),
        get position()      getPosition(this.caret),
        set position(value) setPosition(this.caret, value),
        get isChrome() IUI.highlighter.highlighterContainer.classList.contains(chromeMode),
        get window() this.isChrome ? window : content.window,

        escape: function () {
            if (commandline._modeWidget && commandline.message) commandline._echoLine("");
            else IUI.closeInspectorUI();
        },
        toggleOpacity: function opacity() {
            let e = InspectorUI.highlighter.veilContainer;
            if (e.style.opacity) e.style.opacity = ""
            else e.style.opacity = .3;
        },
        yank: function (node) {
            if (!node) node = this.node;
            let doc = node.ownerDocument;
            let encoder = Cc["@mozilla.org/layout/documentEncoder;1?type=text/xml"].getService(Ci.nsIDocumentEncoder);
            encoder.init(doc, 'text/xml', encoder.OutputFormatted);

            encoder.setNode(node);
            util.copyToClipboard(encoder.encodeToString(), true);
        },
        commandline: //{{{
        {
            input: function input() {
                commandline.input("", function () {execute.apply(null, arguments); keepMode();}, {
                    completer: ex,
                    onCancel: keepMode,
                });
            },
            echo: function echo() {
                keepMode();
                liberator.echo.apply(liberator, arguments);
            },
            echoE4x: function echoE4x(xml) {
                var doc = commandline._multilineOutputWidget.contentDocument;
                doc.body.innerHTML = "";
                var r = doc.createRange();
                r.selectNode(doc.body);
                //doc.body.insertAdjacentHTML("afterbegin", xml.toXMLString());
                doc.body.appendChild(r.createContextualFragment(xml.toXMLString()));
                commandline.updateOutputHeight(true);
                modes.set(modes.COMMAND_LINE, modes.OUTPUT_MULTILINE);
                keepMode();
            },
        }, //}}}
    };

    //lazyGetter(this, "ex", function () {
    lazyFunction(this, "ex", function () {
        var scope = Object.create(this);
        scope.commands = commands;
        var f = liberator.eval(completion.command.toSource(), this);
        return liberator.eval(liberator.modules.completion.ex.toSource(), {
            get completion() ({get command() f}),
            //get commands() commands,
            commands: commands,
            Commands: Commands
        });
    });
    //lazyGetter(this, "execute", function () {
    lazyFunction(this, "execute", function () {
        var scope = Object.create(this);
        scope.commands = commands;
        return liberator.eval(liberator.execute.toSource(), scope);
    });
    lazyGetter(this, "domUtil", function () Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils));

    function iterCSSStyleRules(dom) {
        let r = domUtil.getCSSStyleRules(dom);

        for (let i = 0, j = r.Count(); i < j; ++i)
            yield r.GetElementAt(i);
    }

    function echoRules(dom) {
        var xml = <></>;
        for (rule in iterCSSStyleRules(dom)) {
            let style = rule.style.cssText.split(";");
            let tr = <></>;
            if (rule.parentStyleSheet) {
                let ss = rule.parentStyleSheet;
                tr += <tr class="ss"><td colspan="0">{ss.href}:{domUtil.getRuleLine(rule)}</td></tr>;
            }
            tr += <tr class="selector"><td colspan="0">{rule.selectorText}</td></tr>;
            for (let i = 0, j = style.length - 1; i < j; ++i) {
                //let prop = style[i];
                //tr += <tr><td>{prop}</td><td>{style[prop.replace(/-./g, function (c) c[1].toUpperCase())]}</td></tr>;
                let s = style[i];
                let index = s.indexOf(":");
                tr += <tr><td class="indent"/><td class="nwp">{s.substring(0, index)}</td><td class="w100">{s.substring(index)}</td></tr>;
            }
            xml += tr;
        }
        var s = <style><![CDATA[
            table {
                width: 100%;
            }
            .ss { color: green;}
            .selector {
                color: blue;
                white-space: normal;
            }
            .indent {
                width: 1em;
            }
            tr:nth-child(odd) {
                background-color: #eee;
            }
            .w100 {
                width: 100%;
            }
            .nwp {
                white-wrap: nowrap;
            }
        ]]></style>;
        iui.commandline.echo(<table>{s}{xml}</table>);
    }
    function wrappedReset (callback) {
        var f = modes.reset;
        modes.reset = function () {
            modes.reset = f;
            modes.reset();
            callback();
        };
    }
    function keepMode() {
        wrappedReset(function() {
            if (modes._main === modes.NORMAL)
                modes.set(modes.InspectorUI);
            else
                keepMode();
        });
    }

    function moveBreadcrumbs(dir) {
        let b = IUI.breadcrumbs;
        let n = b.nodeHierarchy;
        let index = b.currentIndex + dir;
        index = dir > 0 ? Math.min(n.length - 1, index) : Math.max(0, index);
        let node = n[index];
        IUI.inspectNode(node.node, false);
    }

    function targetter() {
        let box = IUI.highlighter.highlighterContainer.childNodes[1];
        let doc = box.ownerDocument;
        let node = box.querySelector(".target");
        if (!node) {
            node = doc.createElementNS(XUL, "box");
            box.appendChild(node);
            node.classList.add("target");

            node.style.cssText = <![CDATA[
                position:absolute;
                top: 0px;
                left:0px;
                width: 16px;
                height:16px;
                background: rgba(255, 255, 255, .3);
                border: 1px solid rgba(0, 0, 0, .5);
                -moz-border-radius: 2px;
                -moz-box-sizing: border-box;
                -moz-transition: all .1s;
            ]]>;
        }
        return node;
    }

    function echoXML() {
        function make(nodes, depth) {
            var xml = <></>;
            if (!("length" in nodes))
                nodes = [nodes];
            if (!depth) depth = 0;

            let style = <>padding-left:{depth}em;</>.toString();

            Array.forEach(nodes, function (node) {
                switch(node.nodeType) {
                case Node.TEXT_NODE:
                    xml += <div style={style} class="text">{node.nodeName}:<span class="ib">{node.nodeValue}</span></div>;
                    break;
                case Node.ATTRIBUTE_NODE:
                    xml += <><span class="attr">{node.nodeName}</span>="<span class="value">{node.nodeValue}</span>"</>;
                    break;
                case Node.ELEMENT_NODE:
                    var hasChild = node.childNodes.length > 0;
                    xml += <div style={style}>{"<"}<span class="tag">{node.tagName}</span>{make(node.attributes)}{hasChild ? ">" : "/>"}</div>;
                    if (hasChild) {
                        xml += make(node.childNodes, depth + 1);
                        xml += <div style={style}>{"</"}<span class="tag">{node.tagName}{">"}</span></div>;
                    }
                    break;
                default:
                    xml += <div style={style} class="text">{node.nodeName}:{node.nodeValue}</div>;
                    break;
                }
            });
            return xml;
        }
        let xml = make([selection]);
        xml += <style><![CDATA[
            .attr  { color: red; padding-left: 1ex;}
            .tag   { color:blue;}
            .text  { color:green; white-space: pre-wrap;}
            .value { color: blue;}
            .ib    { 
                display: inline-block; 
                /*margin: 1px;
                padding: 3px;
                border: 1px solid gray;
                border-radius: 2px;
                background-color: rgba(255,255,255,.5);*/
            }
            body>div                { background-color: rgba(222,222,222,.9);}
            body>div:nth-child(odd) { background-color: rgba(255,255,255,.9);}
            body * {white-space: normal;}
        ]]></style>;

        iui.commandline.echoE4x(xml);
    }

    function showMaps() {
        iui.commandline.echo(template.table("Mappings",
            [[item.name || item.names[0], item.description]
                for ([,item] in Iterator(mappings._main[modes.InspectorUI].concat(mappings._user[modes.InspectorUI])))]));
    }

    function scrollIntoView(node, aVPercent, aHPercent) {
        let doc = node.ownerDocument;
        let win = doc.defaultView;
        let selection = win.getSelection();
        let ranges = [selection.getRangeAt(i) for (i in util.range(0, selection.rangeCount))];
        let range = doc.createRange();
        range.selectNode(node);

        selection.addRange(range);
        selection.QueryInterface(Ci.nsISelection2 || Ci.nsISelectionPrivate)
            //.scrollIntoView(Ci.nsISelectionController.SELECTION_FOCUS_REGION, true, aVPercent, aHPercent);
            .scrollIntoView(Ci.nsISelectionController.SELECTION_ANCHOR_REGION, true, aVPercent, aHPercent);

        selection.removeAllRanges();
        ranges.forEach(function (r) selection.addRange(r));
    }

    function openChromeMode() {
        let highlighter = IUI.highlighter;
        if (IUI.inspecting)
            highlighter.detachInspectListeners();
        highlighter.browser = window;
        if (IUI.inspecting)
            highlighter.attachInspectListeners();

        highlighter.highlighterContainer.classList.add(chromeMode)
    }
    function closeChromeMode() {
        let highlighter = IUI.highlighter;
        if (IUI.inspecting)
            highlighter.detachInspectListeners();
        highlighter.browser = IUI.browser;
        if (IUI.inspecting)
            highlighter.attachInspectListeners();

        highlighter.highlighterContainer.classList.remove(chromeMode)
    }
    function toggleChromeMode() {
        if (iui.isChrome)
            closeChromeMode();
        else
            openChromeMode();
    }

    function observe(obj, topic, weak) {
        services.get("observer").addObserver(obj, topic, weak);
        return function remove() services.get("observer").removeObserver(obj, topic, weak);
    }
    dispose.__defineSetter__("$push", function (v) this.push(v));
    {
        let style = document.createElementNS(XHTML, "style");
        document.documentElement.appendChild(style);
        style.appendChild(document.createTextNode(<![CDATA[
            #highlighter-container.chrome-mode {
                position: fixed;
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                z-index: 65535;
            }
            #highlighter-container.chrome-mode #highlighter-veil-container {
                width: 100%;
                height: 100%;
                position: absolute;
            }
            #highlighter-container.chrome-mode #highlighter-veil-container > * {
                display: block;
            }
            #highlighter-container.chrome-mode #ghlighter-veil-topbox {
                width: 100%;
            }
            #highlighter-container.chrome-mode #highlighter-veil-middlebox {
                position: relative;
            }
            #highlighter-container.chrome-mode #highlighter-veil-middlebox box {
                height: 100%;
                display: inline-block;
            }
            #highlighter-container.chrome-mode #highlighter-veil-middlebox #highlighter-veil-rightbox {
                position: absolute;
                width: 100%;
            }
            #highlighter-container.chrome-mode #highlighter-veil-bottombox {
                height: 100%;
            }
        ]]>));
        dispose.$push = function() {let p = style.parentNode; p && p.removeChild(style);};
    }

    this.onUnload = function () {
        var f;
        while (f = dispose.pop()) f();
    };

    if (!modes.hasOwnProperty("InspectorUI")) {
        modes.addMode("InspectorUI");
    }

    let dirToFunc = {
        "left": "parentElement",
        "up": "previousElementSibling",
        "down": "nextElementSibling",
        "right": "firstElementChild",
    };
    function getUtils(win) win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils)
    var tabList = null;

    function toggleScreen(tab) {
        let cur = selection;
        let nodeList = tabList;
        if (!tabList) {
            let box = iui.caret;
            let win = iui.window;
            let pt = getPosition(box, win);
            //範囲内 Element の 抽出
            nodeList = nodesFromRectRec(win, {x: pt.x, y:pt.y, width: pt.s, height: pt.s});
            nodeList = nodeList.reduce(function (a, val) {
                let e = val[0];
                if (e.nodeType === Node.ELEMENT_NODE) {
                    let r = e.getBoundingClientRect();
                    a.push({e: e, s: r.width * r.height});
                }
                return a;
            }, []);
            nodeList.sort(function (a, b) a.s - b.s);
            var q;
            nodeList = nodeList.reduce(function (a, val) {
                if (q !== (q = val.e)) a.push(val.e);
                return a;
            }, []);

            let index = nodeList.indexOf(cur);
            if (index > 0) {
                nodeList.splice(index, 1);
                nodeList.splice(0, 0, cur);
            }
            tabList = nodeList;
        }

        let index = nodeList.indexOf(cur);
        let length = nodeList.length;
        if (tab) cur = nodeList[(index + 1) % length];
        else     cur = nodeList[(length + index - 1) % length];
        if (cur)
            IUI.inspectNode(cur, false);
    }
    function getWindowOffset(win) {
        let pt = {x: 0, y: 0};
        while (win && win.frameElement) {
            let r = win.frameElement.getBoundingClientRect();
            pt.x += r.left;
            pt.y += r.top;
            win = win.frameElement.ownerDocument.defaultView;
        }
        return pt;
    }
    function setPosition(box, pos, win) {
        let av = {
            x: "left",
            y: "top",
            s: "width",
        };
        let pt = getWindowOffset(win);
        if (has(pos, "x")) box.style.left  = (pos.x + pt.x) + "px";
        if (has(pos, "y")) box.style.top   = (pos.y + pt.y) + "px";
        if (has(pos, "s")) box.style.width = box.style.height = (pos.s) + "px";
        tabList = null;
    }
    function getPosition(box, win) {
        let pt = getWindowOffset(win);
        return {
            x: parseFloat(box.style.left) - pt.x,
            y: parseFloat(box.style.top)  - pt.y,
            s: parseFloat(box.style.width),
        };
    }
    function elementFromPoint(x, y) {
        let doc = iui.window.document;
        let next;
        next = doc.elementFromPoint(x, y);
        while (next && ("contentDocument" in next)) {
            // xxx: chrome 時に InspectorUI.highlighter が上手く座標計算できないので
            if (next.mozMatchesSelector("#content browser")
                || next.mozMatchesSelector("#content")) break;

            let r = next.getBoundingClientRect();
            x -= r.left;
            y -= r.top;
            next = next.contentDocument.elementFromPoint(x, y);
        }
        return next || IUI.defaultSelection;
    }
    function screenWalk(dir, count) {
        if (!count) count = 1;

        let e = selection;
        let rect = e.getBoundingClientRect();
        let box = targetter();
        let pt1 = getPosition(box);
        let pt2 = {};

        switch (dir) {
        case "left":  pt2.x = pt1.x - count * pt1.s / 2; break;
        case "right": pt2.x = pt1.x + count * pt1.s / 2; break;
        case "up":    pt2.y = pt1.y - count * pt1.s / 2; break;
        case "down":  pt2.y = pt1.y + count * pt1.s / 2; break;
        }
        setPosition(box, pt2);
        pt1 = getPosition(box);
        let e2 = elementFromPoint(pt1.x, pt1.y);
        if (e !== e2) IUI.inspectNode(e2, false);
    }
    function treeWalk(dir) {
        var dom = IUI.selection;
        if (!dom) dom = IUI.defaultSelection;
        else if (("contentDocument" in dom) && dir === "right")
            dom = dom.contentDocument.documentElement;
        else if (dir === "left" && !dom.parentElement && dom.ownerDocument.defaultView.frameElement)
            dom = dom.ownerDocument.defaultView.frameElement;
        else dom = dom[dirToFunc[dir]];

        if (dom)
            IUI.inspectNode(dom, false);
    }

    function moveBox10 (dir, count) {
        let a1, a2;
        switch (dir) {
        case "left":  [a1, a2, i] = ["innerWidth",  "x", -1]; break;
        case "right": [a1, a2, i] = ["innerWidth",  "x",  1]; break;
        case "up":    [a1, a2, i] = ["innerHeight", "y", -1]; break;
        case "down":  [a1, a2, i] = ["innerHeight", "y",  1]; break;
        }
        let box = iui.caret;
        let pt = getPosition(box);

        let win = iui.window;
        let w = win[a1] / 10;
        let i = ((pt[a2] / w) ^ 0) + i * count;
        pt[a2] = i * w + 1;
        setPosition(box, pt);
        let e = elementFromPoint(pt.x, pt.y);
        if (e) IUI.inspectNode(e, false);
    }

    function nodesFromRectRec(win, rect) {
        if (!rect) rect = {top: 0, left: 0, width: win.innerWidth, height: win.innerHeight};
        else if (rect.width <= 0 || rect.height <= 0) return [];

        let nodes = Array.slice(getUtils(win).nodesFromRect(rect.x, rect.y, 0, rect.width, rect.height, 0, true, true));
        let list = [];
        for (let i = 0, j = nodes.length; i < j; i++)
            list[i] = [nodes[i], rect];

        let wins = win.frames;
        for (let i = 0, j = wins.length; i < j; i++) {
            let w = wins[i];
            let e = w.frameElement;
            if (!e) continue;

            let r1 = w.frameElement.getBoundingClientRect();
            let r2 = {
                x: rect.x - r1.left,
                y: rect.y - r1.top,
                width:  Math.min(rect.x + rect.width,  r1.right)  - rect.x,
                height: Math.min(rect.y + rect.height, r1.bottom) - rect.y,
            };
            list = list.concat(nodesFromRectRec(w, r2));
        }
        return list;
    }

    function moveBoxNode(dir, count) {
        var x, y, lr, inc;
        var box = iui.caret;
        var pt = getPosition(box);
        var s = pt.s;
        var win = iui.window;
        var [w, h] = [win.innerWidth, win.innerHeight];
        switch (dir) {
        case "left":  [x , y , w , h , lr , inc] = [0    , pt.y , pt.x     , s        , 1 ,-1]; break;
        case "right": [x , y , w , h , lr , inc] = [pt.x , pt.y , w - pt.x , s        , 1 , 1]; break;
        case "down":  [x , y , w , h , lr , inc] = [pt.x , pt.y , s        , h - pt.y , 0 , 1]; break;
        case "up":    [x , y , w , h , lr , inc] = [pt.x , 0    , s        , pt.y     , 0 ,-1]; break;
        }
        let list1 = nodesFromRectRec(win, {x: x, y: y, width: w, height: h});
        let [a1, a2, b] = lr ? ["left", "right", "x"] : ["top", "bottom", "y"];

        //filter
        let list = [];
        let v = lr ? x : y;
        for (let i = 0, j = list1.length; i < j; i++) {
            let a = list1[i];
            if (a[0].nodeType !== Node.ELEMENT_NODE) continue;
            let r = a[0].getBoundingClientRect();
            list.push({e: a[0], v: (r[a1] - a[1][b] + v) ^ 0});
            list.push({e: a[0], v: (r[a2] - a[1][b] + v) ^ 0});
        }
        list.sort(function (a, b) inc * (a.v - b.v));
        var q;
        v = (pt[b] ^ 0) + inc;
        let xx = list.length;
        list = list.filter(function (a) (q !== (q = a.v)) && (inc * (a.v - v) > 0));

        if (list.length) {
            let val = list[Math.min(count, list.length - 1)];
            let p = ({});
            //p[b] = val.v - pt.s / 2;
            p[b] = val.v;
            setPosition(box, p);
            IUI.inspectNode(val.e, false);
        }
    }

    function selectNode(aVPercent, aHPercent, win) {
        if (!win) win = content.window;
        let rect = win.document.documentElement.getBoundingClientRect();
        let h = Math.min(win.innerHeight, rect.height) * aVPercent / 100;
        let w = Math.min(win.innerWidth,  rect.width)  * aHPercent / 100;
        let node = win.document.elementFromPoint(w, h);

        if ("contentWindow" in node) {
            let r = node.getBoundingClientRect();
            selectNode((h - r.top) / r.height * 100, (w - r.left) / r.width * 100, node.contentWindow);
        } else
            IUI.inspectNode(node, false);
    }

    [
        [["<Esc>"], "Escape", function () { iui.escape();}],
        [["<S-h>"], "move left breadcrumbs",  function (count) moveBreadcrumbs(-(count || 1)), {count: true}],
        [["<S-l>"], "move right breadcrumbs", function (count) moveBreadcrumbs(+(count || 1)), {count: true}],
        [["<S-j>"], "move previous element sibling", function () treeWalk("down")],
        [["<S-k>"], "move next element sibling", function () treeWalk("up")],
        //[["<S-h>"],  "", function () treeWalk("left")],
        //[["<S-l>"],  "", function () treeWalk("right")],
        [["h"],  "move caret(left)",   function (count) screenWalk("left" , count || 1), {count: true}],
        [["j"],  "move caret(bottom)", function (count) screenWalk("down" , count || 1), {count: true}],
        [["k"],  "move caret(top)",    function (count) screenWalk("up"   , count || 1), {count: true}],
        [["l"],  "move caret(right)",  function (count) screenWalk("right", count || 1), {count: true}],
        [["zt"], "scroll selection(top)",    function () scrollIntoView(IUI.selection,  0, -1)],
        [["zz"], "scroll selection(center)", function () scrollIntoView(IUI.selection, 50, -1)],
        [["zb"], "scroll selection(bottom)", function () scrollIntoView(IUI.selection,100, -1)],
        [["i"], "open DOM Inscpector(need DOM Inspector", function () inspectDOMNode(IUI.selection)],
        [["o"], "open Object Inspector(need DOM Inspector)", function () inspectObject(IUI.selection)],
        //[["f"], "", function () selectNode(50, 50)],
        [["<C-g>"], "toggle opacity", function () iui.toggleOpacity()],
        [[":"], "entery EX mode", function () iui.commandline.input()],
        [["e"], "echo selection XML", function () echoXML()],
        //[["t"], "", function () targetter()],
        [["<Tab>"],   "switch DOM", function () toggleScreen(true)],
        [["<S-Tab>"], "switch DOM", function () toggleScreen(false)],

        [["gh", "b"], "move DOM border(left)",  function (count) moveBoxNode("left" , count), {count: true}],
        [["gl", "w"], "move DOM border(right)", function (count) moveBoxNode("right", count),{count: true}],
        [["gk"],      "move DOM border(top)",   function (count) moveBoxNode("up"   , count),   {count: true}],
        [["gj"],      "move DOM border(bottom)",function (count) moveBoxNode("down", count),{count: true}],

        [["gc"], "toggle chrome mode", function () toggleChromeMode()],
        [["r"], "echo selection's CSS style Rules", function () echoRules(selection)],
        [["gg"],     "move window top", function () setPosition(targetter(), {y:0})],
        [["^"],      "move window left", function ()  setPosition(targetter(), {x:0})],
        [["<S-g>"] , "move window bottom" , function () let (b = targetter()) setPosition(b, {y: iui.window.innerHeight - getPosition(b).s})] ,
        [["$"],  "move window right" , function () let (b = targetter()) setPosition(b, {x: iui.window.innerWidth - getPosition(b).s})] ,
        [["zo"], "expand caret" , function () let (b = targetter()) setPosition(b, {s: getPosition(b).s + 8})],
        [["zi"], "shrink caret" , function () let (b = targetter()) setPosition(b, {s: getPosition(b).s - 8})],
        [["y"],  "yank selection node xml" , function () iui.yank()],
        [["d"],  "delete selection node" , function () let(e = iui.node) e.parentNode.removeChild(e)],
        [["?"],  "show mappings" , function () showMaps()],
    ].forEach(function (args) {
        mappings.addUserMap.apply(mappings, [[modes.InspectorUI]].concat(args));
    });

    dispose.$push = observe({
        observe: function (aSubject, aTopic, aData ){
            modes.set(modes.InspectorUI);
            //IUI.stopInspecting();
        },
    }, IUI.INSPECTOR_NOTIFICATIONS.OPENED, false);
    dispose.$push = observe({
        observe: function (aSubject, aTopic, aData ){
            modes.reset();
        },
    }, IUI.INSPECTOR_NOTIFICATIONS.CLOSED, false);
}).call(this);
