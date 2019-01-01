"use strict";

(function () {
    let self = this;
    let hintMode = liberator.globalVariables.zoomNode || "z";
    let list = ["div", "iframe", "table", "textarea", "ul", "ol", "pre", "p", "main", "article"];
    const vimpZoomAttr = "vimp-zoom";
    const vimpZoomScreenAttr = vimpZoomAttr + "-screen";
    const vimpZoomRootAttr = `${vimpZoomAttr}-root`;
    const longHintName = "zoomNode";

    let zoomNodeStyle = `
    [@attr] {
        position: fixed!important;
        left: 1ex !important;
        top: 1ex !important;
        max-height: 100% !important;
        max-width: 100% !important;
        width:  calc(100vw - 2ex) !important;
        height:  calc(100vh - 2ex) !important;
        z-index: 60001 !important;
        border:1px solid gray!important;
        outline: 1ex solid rgba(222, 222, 222, .7)!important;
        overflow: auto !important;
        padding: 0!important;
        margin: 0!important;
    }
    table[@attr] {
        display: block!important;
    }

    [@attr='1'] {
    }
    [@attr='2'] {
        background-color: rgba(0,0,0,.99)!important;
    }
    [@attr='3'] {
        background-color: white!important;
    }
    [@attr='4'] {
        background-color: black;
    }
    [@attrb] {
        position: fixed !important;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 60000;
    }
    [@attr_root] {
        position:fixed;
        top: 101vh!important;
    }
    `
    .replace(/@attrb/g, vimpZoomScreenAttr)
    .replace(/@attr_root/g, vimpZoomRootAttr)
    .replace(/@attr/g, vimpZoomAttr)
    ;
    var frameSetMap = new WeakMap;

    hints.addMode(longHintName, "zoom", function (elem, href, count) {
        try {
            let doc = elem.ownerDocument;
            let value = count || 1;

            function isFrame(e) { return e instanceof HTMLFrameElement || e instanceof HTMLFrameSetElement; }

            var query = `[${vimpZoomAttr}]`;
            if (elem.mozMatchesSelector(query)) {
                let stack = [doc.defaultView.top];
                let win;
                let name = count ? "setAttribute" : "removeAttribute";

                while (win = stack.pop()) {
                    stack.push.apply(stack, Array.slice(win.frames));
                    for (let e of win.document.querySelectorAll(query)) {
                        e[name](vimpZoomAttr, value);
                    }
                    if (!count) {
                        for (let e of win.document.querySelectorAll(`[${vimpZoomScreenAttr}]`)) {
                            e.parentNode.removeChild(e);
                        }
                        for (let e of win.document.querySelectorAll(`[${vimpZoomRootAttr}]`)) {
                            e.removeAttribute(vimpZoomRootAttr);
                        }
                        for (let e of win.document.querySelectorAll("frameset")) {
                            if (frameSetMap.has(e)) {
                                var obj = frameSetMap.get(e);
                                e.rows = obj.rows;
                                e.cols = obj.cols;
                            }
                        }
                    }
                }
            } else {
                for (var e = elem; e; e = e.ownerDocument.defaultView.frameElement) {
                    e.setAttribute(vimpZoomAttr, value);

                    if (e.ownerDocument.documentElement !== e) {
                        e.ownerDocument.documentElement.setAttribute(vimpZoomRootAttr, true);
                    }
                }

                let selection = doc.defaultView.getSelection();
                if (elem.contentWindow) {
                    Buffer.focusedWindow = elem.contentWindow;
                } else {
                    Buffer.focusedWindow = doc.defaultView;
                    selection.collapse(elem, 0);
                }

                // zoom frameset
                for (var e = elem; e; e = e.ownerDocument.defaultView.frameElement) {
                    if (e.mozMatchesSelector("frameset *")) {
                        var f = e;
                        while (f) {
                            var p = f.parentNode;
                            if (isFrame(f)) {
                                if (p instanceof HTMLFrameSetElement) {
                                    var frames = [];
                                    for(let e of Array.slice(p.childNodes))
                                        if (isFrame(e)) frames.push(e)
                                    var index = frames.indexOf(f);
                                    if (!frameSetMap.has(p)) {
                                        frameSetMap.set(p, {
                                            rows: p.rows, cols: p.cols
                                        });
                                    }
                                    if (p.rows && p.cols) {
                                        // do not support
                                        liberator.echoerr("do not support rows and cols");
                                    } else if (index >= 0) {
                                        var attr = p.rows ? "rows" : "cols";
                                        let aa = p[attr] = [];
                                        for(let i of Array(index)) aa.push(0);
                                        aa.push("*");
                                        for(let i of Array(frames.length - index - 1)) aa.push(0);
                                    }
                                }
                            }
                            f = p;
                        }
                    }
                }
            }
        } catch (ex) {
            liberator.echoerr(ex);
        }
    },
    function (win, screen) {
        if (!win) return util.makeXPath(list);
        try{
            var attr = `[${vimpZoomAttr}] `;
            var e = win.document.querySelector(attr);
            var ignore = !e;
            var array = hints.nodesFromRect(win, screen);
            array = Array.slice(array, 0, win.top === win ? -2 : array.length);
            var res = ignore ? [] : [e];
            var h = (screen.bottom - screen.top) / 2;
            var type = Node.ELEMENT_NODE;
            attr += "*";

            for (var e of array) {
                if (e.nodeType === type && (ignore || e.mozMatchesSelector(attr))
                    && (e.clientHeight > h || e.scrollTopMax || e.scrollLeftMax)) {
                    res[res.length] = e;
                }
            }
            res.sort((a, b) => a.compareDocumentPosition(b) & 0x2);
            return res;
        } catch (ex) {
            liberator.echoerr(ex);
        }
    });

    {
        let m = hints._hintModes;
        m[hintMode] = m[longHintName];
    }

    {
        let name = "zoom-node";
        styles.addSheet(false, "zoom-node", "*", zoomNodeStyle);
    }

    commands.addUserCommand(["noz[oomNode]"], "clear zoom node", function () {
        let attr = `[${vimpZoomAttr}] `;
        var e = content.document.querySelector(attr);
        e && hints._hintModes[longHintName].action(e);
    }, {
    }, true);
}).call(this);
