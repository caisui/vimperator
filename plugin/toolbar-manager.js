// vim:set fdm=marker :
var INFO = //{{{
<plugin name="toolbar-manager.js" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/toolbar-manager.js"
        summary="Toolbar Manager"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <tags> :toolbar </tags>
        <spec> :toolbar [sub command]...</spec>
        <description>
            Toolbar を CustomizeToolbar と 同程度な 編集を command で実現
        </description>
    </item>
</plugin>; //}}}

function lazyGetter(obj, attr, func) {
    obj.__defineGetter__(attr, function () {
        delete obj[attr];
        return obj[attr] = func.call(obj);
    });
}

lazyGetter(this, "customizeToolbar", function () {
    let customizeToolbar = {
            document:{
            __proto__: document,
            getElementById: function (id) {
                function nop() void 0
                let dummy = {
                    stringBundle: {
                        getString: function () ""
                    },
                    "palette-box": {
                        appendChild: nop,
                        removeChild: nop,
                    }
                };
                return dummy[id] || {};
            }
        }
    };

    liberator.loadScript("chrome://global/content/customizeToolbar.js", customizeToolbar);

    customizeToolbar.gToolbox = gNavToolbox;
    customizeToolbar.gToolboxDocument = gNavToolbox.ownerDocument;

    return customizeToolbar;
});

function getToolbarByName(name) document.querySelector("toolbar[toolbarname='" + name + "']")
function getToolbarById(id) document.querySelector("toolbar#" + id)
function messageIsNotFound(id) id + " is not found."
function messageToolbarItem(item) {
    let msg;
    let attrs = ["tooltip", "tooltiptext", "title", "label"];
    for (let [,name] in Iterator(attrs)) {
        msg = item.getAttribute(name);
        if (msg) return msg;
    }
    return "";
}
function messageToolbar(item) item.tooltipText || item.toolbarName
function warn(cond, message) {
    if (!cond) liberator.echoerr(message);
    return !cond;
}
function uniqIdFilter(args) function ([id]) args.indexOf(id) === -1
function completeUniqToolbar (context, args, selector) {
    context.title = ["title"];
    context.anchored = false;
    context.completions = context.getCache("item", function ()
        Array.map($qa(selector), function (tb) [tb.id, messageToolbar(tb)]))
        .filter(uniqIdFilter(args));
    ;
}
function completeToolbarSpecialItem(context, args) {
    context.title = ["special item"];
    context.process = [];
    context.generate = function() completionSpecialItems;
}
let unsorted = null;

function createToolbarButtonItem(tb) {
    let style = tb.ownerDocument.defaultView.getComputedStyle(tb, null);
    let str = ["list-style-image", "-moz-image-region"].map(function (s) {
        let val = style[s.replace(/-./g, function (c) c[1].toUpperCase())];
        return s + ":" + val;
    }).join(";");

    if (tb.tagName === "toolbaritem") {
        let images = tb.querySelectorAll("image,toolbarbutton");
        if (images.length) {
            str = Array.map(images, function (image) {
                style = image.ownerDocument.defaultView.getComputedStyle(image, null);
                return ["list-style-image", "-moz-image-region"].map(function (s) {
                    let val = style[s.replace(/-./g, function (c) c[1].toUpperCase())];
                    return s + ":" + val;
                }).join(";");
            });
        }
    }

    return {
        0: tb.id,
        1: messageToolbarItem(tb),
        style: str
    }
}

function customizeToolbarFinish() {
    customizeToolbar.dispatchCustomizationEvent("beforecustomization");
    customizeToolbar.toolboxChanged();

    //
    Array.forEach($pqa(toolbarSpecialItemSelector), function (e) {
        e.parentNode.removeChild(e);
    });

    customizeToolbar.gToolboxChanged = true;
    customizeToolbar.persistCurrentSets();
    customizeToolbar.notifyParentComplete();
}

function getRootArgs(context) context.top.cache["args"]
function getParentArgs(context) context.parent.cache["args"]

//selector {{{
lazyGetter(this, "toolbarSpecialItems", function () ["toolbarspring", "toolbarspacer", "toolbarseparator"]);
lazyGetter(this, "toolbarSpecialItemSelector", function () toolbarSpecialItems.join(","));
lazyGetter(this, "allActiveToobarItem", function () "toolbar>*[id][removable='true']:not(:-moz-any(" + toolbarSpecialItemSelector + "))");
lazyGetter(this, "completionSpecialItems", function () toolbarSpecialItems.map(function (s) [s.substr(7), s]));

function getToolbarItemSelector(toolbarId) <>toolbar#{toolbarId} *[removable='true']</>.toString()
function getToolbarVisibleSelector(visible) [
    "toolbar[customizable]",
    visible ? "" : ":not(",
    ":-moz-any([collapsed='true'], [type=menubar][autohide='true'])",
    visible ? "" : ")"
].join("")
lazyGetter(this, "toolbarVisibleSelector", function () getToolbarVisibleSelector(true));
lazyGetter(this, "toolbarCollapsedSelector", function () getToolbarVisibleSelector(false));

function $bind(obj, name) let(f = obj[name]) f.bind.apply(f, [obj].concat(Array.slice(arguments, 2)))
lazyGetter(this, "$q",  function() $bind(document, "querySelector"));
lazyGetter(this, "$qa", function() $bind(document, "querySelectorAll"));
lazyGetter(this, "$id", function() $bind(document, "getElementById"));

lazyGetter(this, "$pq",  function() $bind(gNavToolbox.palette, "querySelector"));
lazyGetter(this, "$pqa", function() $bind(gNavToolbox.palette, "querySelectorAll"));
//}}}

lazyGetter(this, "toolbaritemProcess", function () [
    null, function _toolbaritemDesc(i, t) {
        let images = Array.concat(i.item.style).reduce(function (a, style) {
            a += <image xmlns={XUL.uri} style={style}/>;
            return a;
        }, <></>);
        return <><span style="display:inline-block;">{images}</span><span>{t}</span></>;
    }
]);

function updateToolbarVisisble(names, visible) {
    let func = visible === void(0)
        ? function (item, attr) item.setAttribute(attr, item.getAttribute(attr) === "true" ? false : true)
        : function (item, attr) item.setAttribute(attr, !visible)
    Array.forEach(names, function (name) {
        let item = getToolbarById(name);
        if (warn(item, messageIsNotFound(name)))
            return;
        func(item, item.getAttribute("type") === "menubar" ? "autohide" : "collapsed");
    });
}


lazyGetter(this, "subCmds", function () [
    Command(["add", "append"], "add button", function (args) {
        let id = args.parentArgs[0];
        let tb  = $q("toolbar#" + id);
        liberator.assert(tb, messageIsNotFound(id));

        let node = document.createDocumentFragment();
        args.forEach(function (name) {
            let item = toolbarSpecialItems.indexOf(name) === -1
                ? tb._getToolbarItem(name) : $pq("#" + name);
            if (!item && args["-all"]) item = $id(name)

            if (warn(item, messageIsNotFound(name))) return;

            //xxx:why?
            item.setAttribute("removable", true);
            node.appendChild(item);
        });
        
        let beforeId = args["-before"];
        if (beforeId) {
            let before = $id(beforeId);
            liberator.assert(before, messageIsNotFound(beforeId));
            tb.insertBefore(node, before);
        } else
            tb.appendChild(node);

        customizeToolbarFinish();
    },
    {//extra
        options: [
            [["-all", "-a"], commands.OPTION_NOARG],
            [["-before", "-b"], commands.OPTION_STRING, 
            null,
            function (context) {
                context.anchored = false;
                let id = getRootArgs(context)[0];
                let node = $id(id);
                liberator.assert(node, messageIsNotFound(id));
                context.process = toolbaritemProcess;
                context.completions = Array.map(node.childNodes, createToolbarButtonItem);
            }],
        ],
        completer: function (context, args) {
            context.anchored = false;
            context.process = toolbaritemProcess;
            context.completions = context.getCache("item", function ()
                Array.map(gNavToolbox.palette.childNodes, createToolbarButtonItem))
                    .filter(uniqIdFilter(args));

            completeToolbarSpecialItem(context.fork("special", 0));
            if (args["-all"])
                context.fork("other", 0, this, function (context) {
                    context.title = ["toobar's item"];
                    context.completions = context.getCache("item", function ()
                        Array.map($qa(allActiveToobarItem), createToolbarButtonItem))
                            .filter(uniqIdFilter(args));
                });
        }
    }),
    Command(["remove", "rm", "del[ete]"], "remove toolbar button", function (args) {
        args.forEach(function (id) {
            let item = $id(id);
            if (warn(item, messageIsNotFound(id))) return;
            if (!item.mozMatchesSelector(toolbarSpecialItemSelector))
                gNavToolbox.palette.appendChild(item);
            else
                item.parentNode.removeChild(item);
        });
        customizeToolbarFinish();
    }, {//extra
        completer: function (context, args) {
            context.anchored = false;
            let toolbarId = getRootArgs(context)[0];
            context.compare = unsorted;
            context.process = toolbaritemProcess;
            context.completions = context.getCache("item", function() Array.map(
                $qa(getToolbarItemSelector(toolbarId)), createToolbarButtonItem))
                .filter(uniqIdFilter(args));
        }
    }),
    Command(["se[t]"], "set all item", function (args) {
        let id = args.parentArgs[0];
        let toolbar = $id(id);
        liberator.assert(toolbar, messageIsNotFound(id));

        toolbar.currentSet = args.join(",");
        customizeToolbarFinish();
    }, {
        completer: function (context, args) {
            context.anchored = false;
            context.process = toolbaritemProcess;
            context.completions = context.getCache("item", function ()
                Array.map(gNavToolbox.palette.childNodes, createToolbarButtonItem))
                    .filter(uniqIdFilter(args));

            // todo: supprted other toolbar's item
            //context.fork("other", 0, this, function (context) {
            //    context.title = ["toobar's item"];
            //    context.completions = context.getCache("item", function ()
            //        Array.map($qa(allActiveToobarItem), createToolbarButtonItem))
            //            .filter(uniqIdFilter(args));
            //});

            completeToolbarSpecialItem(context.fork("special", 0));
        }
    }),
]);

let cmd = commands.addUserCommand(["toolbar", "tb"], "toolbar manager", function (args, modifiers) {
    if (args.length == 2) {
        let str = args.pop();
        let subArgs = commands.parseArgs(str, null, subCmds);
        subArgs.parentArgs = args;

        let cmd = subArgs.subCmd;
        liberator.trapErrors(cmd.action, cmd, subArgs, modifiers);
    }
},
{//extra
    literal: 1,
    completer: function (context, args) {
        if (args[0] === context.filter) {
            context.title = ["toolbar"];
            context.anchored = false;
            context.generate = function ()  Array.map($qa("toolbar[customizable]"),
            function (tb) [tb.id, messageToolbar(tb)]);
        }
        else {
            context.top.cache["args"] = args;
            completion.ex(context, subCmds);
        }
    },
}, true);

lazyGetter(cmd, "subCommands", function () [
    // {{{ toolbar ON/OFF
    Command(["sh[ow]"], "show toolbar", function (args) { updateToolbarVisisble(args, true); }, {
        //literal: 0,
        completer: function (context, args) completeUniqToolbar(context, args, toolbarVisibleSelector),
    }),
    Command(["hi[de]"], "hide toolbar", function (args) { updateToolbarVisisble(args, false); }, {
        //literal: 0,
        completer: function (context, args) completeUniqToolbar(context, args, toolbarCollapsedSelector),
    }),
    Command(["toggle"], "toggle toolbar", function (args) { updateToolbarVisisble(args); }, {
        //literal: 0,
        completer: function (context, args) completeUniqToolbar(context, args, "toolbar[customizable]"),
    }), //}}}
    Command(["remove", "rm", "del[ete]"], "remove toolbar", function (args) {
        let id = args[0];
        let tb = $id(id);
        liberator.assert(toolbar, messageIsNotFound(id));

        let index = tb.getAttribute("customindex");

        Array.forEach(tb.querySelectorAll("[removable='true']"), function (item) {
            if (item.mozMatchesSelector(toolbarSpecialItemSelector)) {
                item.parentNode.removeChild(item);
            } else {
                gNavToolbox.palette.appendChild(item);
            }
        });
        customizeToolbarFinish();
    }, {
        completer: function (context, args)
            completeUniqToolbar(context, args, "toolbar[customizable][customindex]:not([toolboxid])"),
    }),
    // {{{ simple customizeToolbar's command
    Command(["customize"], "toggle customize mode(preview)", function (args) {
        let attr = "customizing";
        let isCustomize = gNavToolbox[attr] = !gNavToolbox[attr];
        customizeToolbar.forEachCustomizableToolbar( isCustomize
            ? function (toolbar) toolbar.setAttribute(attr, true)
            : function (toolbar) toolbar.removeAttribute(attr));
    }, {
    }),
    Command(["reset"], "restore default toolbar", function () {
        customizeToolbar.restoreDefaultSet();
    }),
    Command(["new", "create"], "create new toolbar", function (args) {
        let name = args[0];
        liberator.assert(!$q("toolbar[toolbarname='$']".replace("$", name)), name + " is exist!");
            
        gNavToolbox.appendCustomToolbar(name, "");
    }, {
        literal: 0,
    }),
    Command(["mode"], "change toolbar mode",
        function (args) {
            if (args["-iconsize"])
                customizeToolbar.updateIconSize(args["-iconsize"]);
            if (args[0])
                customizeToolbar.updateToolbarMode(args[0]);
        }, {
        argCount: "?",
        options:[
            [["-iconsize"], commands.OPTION_STRING, null, ["small", "large"].map(function(n) [n, ""])],
        ],
        completer: function (context, args) {
            context.generate = function () ["text", "icons", "full"]
                .map(function (n) [n, ""]);
        },
    }),
    Command(["dialog", "dlg"], "show dialog", function () BrowserCustomizeToolbar(), {argCount:0}),
    //}}}
]);

delete this.cmd;

function onUnload() {
    commands.removeUserCommand("tb");
}
