(function () {
    let hintMode = liberator.globalVariables.zoomNode || "z";
    let list = ["div", "iframe", "table", "textarea", "ul", "ol", "pre", "p", "main", "article"];
    const vimpZoomAttr = "vimp-zoom";
    const vimpZoomScreenAttr = vimpZoomAttr + "-screen";

    let zoomNodeStyle = `
    [@attr] {
        position: fixed !important;
        left: 1em !important;
        right: 1em !important;
        top: 1em !important;
        bottom: 1em !important;
        min-width: 95% !important;
        min-height: 95% !important;
        max-height: 100% !important;
        max-width: 100% !important;
        width: auto !important;
        height: auto !important;
        z-index: 60001 !important;
        box-shadow: 0 0 5em black;
        border: 1px solid gray;
        overflow: auto !important;
        padding: .5em!important;
    }
    table[@attr] {
        display: block!important;
    }
    [@attr='1'],
    [@attr='2'] {
        margin: 0 !important;
    }

    [@attr='1'] {
        background-color: white;
    }
    [@attr='2'] {
        background-color: black;
    }
    [@attr='3'] {
        background-color: white;
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
    `
    .replace(/@attrb/g, vimpZoomScreenAttr)
    .replace(/@attr/g, vimpZoomAttr)
    ;
    var frameSetMap = new WeakMap;

    hints.addMode(hintMode, "zoom", function (elem, href, count) {
        try {
            let doc = elem.ownerDocument;
            let value = count || 1;

            function isFrame(e) e instanceof HTMLFrameElement || e instanceof HTMLFrameSetElement

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
                    //elem.setAttributeNS(NS, "zoom-frame", value);
                    e.setAttribute(vimpZoomAttr, value);

                    //if (isFrame(e)) continue;
                    //let div = e.ownerDocument.createElement("div");
                    //div.setAttribute(vimpZoomScreenAttr, "");
                    //e.parentNode.appendChild(div);
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
                                    var frames = [e for(e of Array.slice(p.childNodes)) if (isFrame(e))];
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
                                        p[attr] = [
                                            ...[0 for(i of Array(index))],
                                            "*",
                                            ...[0 for(i of Array(frames.length - index - 1))],
                                        ];
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
    function (win) {
        if (!win) return util.makeXPath(list);
        try{
            let doc = win.document;
            let selector;
            let elem;
            let attr = `[${vimpZoomAttr}] `;
            if (win.document.querySelector(attr)) {
                selector = attr + "," + [attr + v for([, v] in Iterator(list))].join(",");
            } else {
                selector = list.join(",");
            }
            return doc.querySelectorAll(selector);
        } catch (ex) {
            liberator.echoerr(ex);
        }
    });

    styles.addSheet(false, "zoom-node", "*", zoomNodeStyle);
})();
