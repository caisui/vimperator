// vim: set fdm=marker et sw=4 ts=4:
(function() {
    //{{{ config
    const cmd_name = ["grep"];
    const match_style = "color:red;font-weight:bold;";
    const abbr_style = "color:blue;font-weight:bold;";
    const grep_info_attr = "__vmp_grep_cmd";
    const use_hook_search_map = true;
    const use_show_echo = false;
    const use_clear_editor_range = true;
    const option_scroll = "grep_scroll_position";
    const option_grep = "grep_option";
    const option_highlight = "hlgrep";
    const scope = Option.SCOPE_GLOBAL || options.OPTION_SCOPE_GLOBAL;

    //{{{ options

    (function() {
        function options_remove(name) {
            if (!options.get || options.get(name))
                options.remove(name);
        }

        const position_list = {
            "top"    : [0   , -1], 
            "center" : [50  , -1], 
            "bottom" : [100 , -1], 
            "auto"   : [-1  , -1], 
        };

        const grep_groups= {
            "engine": {
                n: "normal search",
                r: "regex search",
                x: "xul/migemo search",
            },
            "flags": {
                i: "ignore case",
                m: "multiple lines",
            },
        };
        options_remove(option_scroll);
        options.add([option_scroll], "grep scroll postion",
        "string", "center",
        {
            scope: scope,
            completer:function(context) {
                context.completions = ([[x, ""] for (x in position_list)]);
            },
            validator:Option.validateCompleter,
        });
        options.get(option_scroll).__defineGetter__("vhPercent", function() position_list[this.value]||[-1, -1]);

        let defaultOp = ("migemo" in window) ? "imx" : "imr";
        options_remove(option_grep);
        options.add([option_grep], "grep option",
        "charlist", defaultOp,
        {
            scope: scope,
            setter:function(value) {
                let list = [];
                for (let [, c] in Iterator(value||[])) {
                    if (list.indexOf(c)===-1) list.push(c);
                }
                return list.join("");
            },
            completer:function(context) {
                for (let [grp_nm, grp_opt] in Iterator(grep_groups)) {
                    context.fork(grp_nm, 0, this, function(context) {
                        context.title[0] = grp_nm;
                        context.completions = [val for (val in Iterator(grp_opt))];
                    });
                }
            },
            validator:function(val) Option.validateCompleter.call(this, val)
                && [x for ([x, ] in grep_groups.engine)].some(function(n) val.indexOf(n) >= 0)
      ,
        });

        options_remove(option_highlight);
        options.add([option_highlight], "grep highlight",
        "boolean", false,
        {
            scope: scope,
            setter:function(value) {

                if (value) {
                    let info = get_cache();
                    if (info) show_highlight(info.list);
                }
                else clear_highlight();
                return value ? true : false;
            },
            completer:function()[
                [true , "show highlight"],
                [false, "hide highlight"],
            ],
        });

    })();
    //}}}

    //{{{core
    const vimp = !liberator._class_ ? "liberator-completions" : "dactyl-completions";
    let finder = Cc["@mozilla.org/embedcomp/rangefind;1"].getService(Ci.nsIFind);
    const option_list = "imxnr";
    const gFm = Cc["@mozilla.org/focus-manager;1"].getService(Ci.nsIFocusManager);
    //}}}
    //}}}

    function range2string(r, max) {
        let txt = r.toString();
        let so = r.startOffset;
        let eo = r.endOffset;
        let et = r.endContainer.textContent;
        let st = r.startContainer.textContent;
        let max = (arguments.callee.max/2-2) || 0;

        return {
            abbr : so > max,
            prev : (so > max ? st.substr(so - max, max) : st.substr(0, so)).replace(/\s+$/, "\xa0"),
            text : r.toString(),
            next : et.substr(eo, max*2).replace(/^\s+/, "\xa0"),
        };
    }

    function get_word_max() {
        let win = document.getElementById(vimp).contentWindow;
        let fontSize = win.getComputedStyle(win.document.body, '').fontSize.replace("px", "");
        return Math.floor(document.width / fontSize);
    }

    let process = [function(i, text) {
        let r = range2string(i.item.range);

        return <><div style="position:absolute;">
            {r.abbr ? <span style={abbr_style}>~~</span> : ""}
            {r.prev}
            <span style={match_style}>{r.text}</span>
            {r.next}
            </div>
        </>;
    },
        function() <span></span>];

    function iteratorFrame(win) {
        yield win;
        for (let f1 in util.Array.itervalues(win.frames)) {
            for (let f2 in arguments.callee(f1)) yield f2;
        }
    }

    function create_ranges(win) {
        let doc = win.document;
        let body = doc.body || doc.querySelector("body");
        let count = body.childNodes.length;

        let searchRange = doc.createRange();
        let startPt = doc.createRange();
        let endPt = doc.createRange();

        searchRange.setStart(body, 0);
        searchRange.setEnd(body, count);

        startPt.setStart(body, 0);
        startPt.collapse(true);
        endPt.setStart(body, count);
        endPt.collapse(true);
        return [searchRange, startPt, endPt];
    }

    function normal_find(win, word, option) {
        let doc = win.document;
        let list = [];
        let [whole, start, end] = create_ranges(win);

        while(result = finder.Find(word, whole, start, end)) {
            list.push(result);
            start = doc.createRange();
            start.setStart(result.endContainer, result.endOffset);
            start.collapse(true);
        }
        return list;
    }

    function normal_grep(word, option) {
        let result, ret=[];
        finder.caseSensitive = !/i/.test(option);
        for (let win in iteratorFrame(content.window)) {
            let list = [];
            let words = word.split(" ");

            //unique
            words = words.sort();
            let(prev) words = words.filter(function(n) prev !== (prev=n));

            for (let [, w] in Iterator(words)) {
                list = list.concat(normal_find(win, w));
            }
            list.sort(function(a, b) a.compareBoundaryPoints(Range.START_TOSTART, b));
            ret = ret.concat(list);
        }
        return ret;
    }

//{{{
    function regexp_grep_core(re) {
        let result, ret=[];
        finder.caseSensitive = true;
        for (let win in iteratorFrame(content.window)) {
            let list = [];
            let [whole, start, end] = create_ranges(win);
            let words = whole.toString().match(re)||[];

            //unique
            words = words.sort();
            let(prev) words = words.filter(function(n) prev !== (prev=n));

            for (let [, w] in Iterator(words)) {
                list = list.concat(normal_find(win, w));
            }
            list.sort(range_compare);
            ret = ret.concat(list);
        }
        return ret;
    }

    function regexp_grep(word, option) {
        return regexp_grep_core(RegExp(word, option));
    }

    function migemo_grep(word, option) {
        let re = new RegExp(window.migemo.query(word), option);
        return regexp_grep_core(re);
    }
    //}}}

    function range_compare(a, b)
        a.compareBoundaryPoints(Range.START_TO_START, b)
      || a.compareBoundaryPoints(Range.END_TO_END, b)

    function range_compare_d(win) {
    win = win || content.window;
    let list = [w.document for (w in iteratorFrame(win))];
    return function(a, b) {
      let n1 = a.startContainer.ownerDocument;
      let n2 = b.startContainer.ownerDocument;
      let ret=0;

      if (n1 === n2) return a.compareBoundaryPoints(Range.START_TO_START, b)
        || a.compareBoundaryPoints(Range.END_TO_END, b);
      for (let [, n] in Iterator(list)) {
        if (n===n1) return -1;
        else if (n===n2) return 1;
      }
    };
  }

    let mode_func = { };
    mode_func.n = normal_grep;
    mode_func.r = regexp_grep;
    mode_func.x = migemo_grep;

    //{{{ range cache
    function get_cache() {
        return content.document[grep_info_attr];
    }

    function clear_cache(event) {
        var br = event.currentTarget;
        br.contentWindow.document[grep_info_attr] = null;
        br.removeEventListener(event.type, arguments.callee, true);
    }

    function get_grep_info(arg) {
        let m, word, flags, mode, num;
        let re = new RegExp(
        <>^((\d*)([{option_list}]*)/)?([^/]+)(/([{option_list}]*))?$</>.toString()
        , "i");
        if (m=re.exec(arg)) {
            let s = "";
            word = m[4];
            num = m[2]||0;
            if (!m[1] && !m[5]) {
                s = options[option_grep];
            } else if (m[6]) {
                s = m[6];
            } else if (m[3]) {
                s = m[3];
            }
            flags = "";
            if (/i/.test(s)) flags += "i";
            if (/m/.test(s)) flags += "m";
            if (m=/.+([xnr])/.exec(options[option_grep]+s)) {
                mode = m[1];
            }
        }
        let option = <>{flags}{mode}</>.toString();
        let info = get_cache();
        if (info) {
            if (info.word === word && info.option === option) {
                info.index = num;
                info.enabled = false;
                return info;
            }
        } else {
            let br = gBrowser.getBrowserForDocument(content.document);
            br.addEventListener("unload", clear_cache, true);
        }

        let func = mode_func[mode];
        if (!func) {
            liberator.echoerr(<>{mode} is not support</>.toString());
            return;
        }

        let list = func(word, flags + "g");
        info = {list:list, index:num, word: word, option: option};
        content.document[grep_info_attr] = info;
        return info;
    }

    function getSelectionControllerFromWindow (view) {
        let selectionController = null;
        try {
        selectionController = view
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIWebNavigation)
            .QueryInterface(Ci.nsIDocShell)
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsISelectionDisplay)
            .QueryInterface(Ci.nsISelectionController);
        } catch (ex) {}

        return selectionController;
    }

    function checkEditableElement(node) {
        let ret = false;
        try {
            node.QueryInterface(Ci.nsIDOMNSEditableElement)
            ret = true;
        } catch (ex) {}
        return ret;
    }

    function getEditor(node) {
        while(node) {
            if (checkEditableElement(node)) {
                return node.editor;
            }
            node = node.parentNode;
        }
        return null;
    }

    function getSelectionControllerFromRange(aRange) {
        let node = aRange.startContainer;
        let editor = getEditor(node);
        return editor ? editor.selectionController
            : getSelectionControllerFromWindow(node.ownerDocument.defaultView);
    }

    function clearEditorAllSelections(win, aType) {
        win = win || content.window;
        aType = aType || Ci.nsISelectionController.SELECTION_NORMAL;
        for (let w in iteratorFrame(win)) {
            let list = w.document.getElementsByTagName("*");
            for (let [, n] in Iterator(list)) {
                if (checkEditableElement(n)) {
                    let editor = n.editor;
                    if (editor) {
                        let selection = editor.selectionController.getSelection(aType);
                        if (selection.rangeCount > 0) {
                            selection.removeAllRanges();
                        }
                    }
                }
            }
        }
    }

    function grep_jump(info) {
        if (info.list.length == 0) {
            liberator.echoerr(<>no match "{info.option}/{info.word}"</>.toString(), commandline.DISALLOW_MULTILINE);
            return;
        }
        let n = info.list[info.index];
        if (!n) {
            liberator.echoerr(<>index error "{info.index}"</>.toString(), commandline.DISALLOW_MULTILINE);
            return;
        }
        let win = n.startContainer.ownerDocument.defaultView;

        if (gFm.focusedWindow) {
            if (use_clear_editor_range) clearEditorAllSelections();
            gFm.focusedWindow.getSelection().removeAllRanges();
        }
        let selectionController = getSelectionControllerFromWindow(win);
        if (!selectionController) return;

        //{{{ editable element
        let editor = getEditor(n.startContainer);
        if (editor) {
            let selectionController = editor.selectionController;
            let selection = selectionController.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
            selection.removeAllRanges();
            selection.addRange(n);
            selectionController.setDisplaySelection(Ci.nsISelectionController.SELECTION_ATTENTION);
        }
        //}}}

        let selection = selectionController.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
        selection.removeAllRanges();

        selection.addRange(n);
        gFm.moveFocus(win, null, Ci.nsIFocusManager.MOVEFOCUS_CARET,
            Ci.nsIFocusManager.FLAG_NOSCROLL | Ci.nsIFocusManager.FLAG_NOSWITCHFRAME);

        selectionController.setDisplaySelection(Ci.nsISelectionController.SELECTION_ATTENTION);
        selectionController.repaintSelection(Ci.nsISelectionController.SELECTION_NORMAL);

        info.enabled = true;

        let(op=options.get(option_scroll).vhPercent)
        selection
            .QueryInterface(Ci.nsISelection2 || Ci.nsISelectionPrivate)
            .scrollIntoView(Ci.nsISelectionController.SELECTION_ANCHOR_REGION, true, op[0], op[1]);
        win.focus();// nsIFocusManager の focusedWindow を 更新

        if (use_show_echo) {
            range2string.max = get_word_max();
            liberator.echo(process[0]({item:{range:n}}, "").*, commandline.DISALLOW_MULTILINE);
        }
    }

    function bi_search(list, n, backword) {
        let lhs = 0, rhs = list.length, mid = 0, ret;
        let comp = range_compare_d(content.window);
        while(1) {
            if (mid === (mid = Math.floor((lhs + rhs) / 2))) {
                if (mid === 0 && ret < 0) return -1;
                else if (mid === list.length-1 && ret > 0 && !backword) return mid + 1;
                else return mid;
            }
            ret = comp(n, list[mid]);
            if (ret < 0) rhs = mid;
            else if (ret > 0) lhs = mid;
            else {
                return backword ? mid - 1 : mid;
            }
        }
    }

    function get_grep_list_index(info, isReverse) {
        info = info || get_cache();

        let win = gFm.focusedWindow;
        let selection = win.getSelection();
        let r;
        if (selection.rangeCount === 0) {
            r = win.document.createRange();
            r.setStart(win.document.body, 0);
        } else {
            r = selection.getRangeAt(0);
        }
        let index = bi_search(info.list, r, isReverse);

        return index;
    }

    function grep_next() {
        let info = get_cache();
        if (!info) return;
        info.index = get_grep_list_index(info);

        let show_msg = false;

        if (++info.index >= info.list.length) {
            info.index = 0;
            window.setTimeout(function() {
                liberator.echoerr("bottom!", commandline.DISALLOW_MULTILINE);
            }, 100);
        }
        grep_jump(info);

        return true;
    }

    function grep_prev() {
        let info = get_cache();
        if (!info) return;
        info.index = get_grep_list_index(info, true);
        if (info.index < 0) {
            info.index = info.list.length - 1;
            window.setTimeout(function() {
                liberator.echoerr("top!", commandline.DISALLOW_MULTILINE);
            }, 100);
        }
        grep_jump(info);

        return true;
    }
    //}}}

  //{{{ highlight
  function show_highlight(list) {
    for (let [, r] in Iterator(list)) {
      let selectionController, n;
            n = r.startContainer;
            let editor = getEditor(n);
            selectionController = editor
                ? editor.selectionController
                : getSelectionControllerFromWindow(n.ownerDocument.defaultView);

            if (selectionController) {
        let selection = selectionController.getSelection(Ci.nsISelectionController.SELECTION_FIND);
                selection.addRange(r);
            }
    }
  }

  function clear_selection_find(win) {
    win = win||content.window;
        let selectionController = getSelectionControllerFromWindow(win);
        if (selectionController) {
            let selection = selectionController.getSelection(Ci.nsISelectionController.SELECTION_FIND);
            selection.removeAllRanges();
        }
  }

  function clear_highlight() {
    for (let w in iteratorFrame(content.window)) {
      clear_selection_find(w);
    }
        clearEditorAllSelections(null, Ci.nsISelectionController.SELECTION_FIND);
  }
  //}}}

    let T = {
        name: cmd_name ,
        desc:"grep page",
        action: function (args) {
            let info = get_grep_info(args[0]);
            if (info) {
                if (options[option_highlight]) {
                    clear_highlight();
                    show_highlight(info.list);
                }
                grep_jump(info);
            }
        },
        option: { }
    };

    T.option.literal = 0;
    T.option.completer = function (context, args) {
        try {
            if (!args[0])
                return;
            let info = get_grep_info(args[0]);
            if (!info || info.list.length == 0) return;

            context.process = process;
            context.keys= {text: "text", description:"text"};
            context.match = function(str) { return true; };

            range2string.max = get_word_max();

            let query = info.query;
            context.completions = info.list.map(function(n, i) {
                return {
                    text: <>{i}{info.option}/{info.word}</>.toString(),
                    range: n
                }
            });
        } catch(ex) {liberator.echoerr(ex);}
    };
    commands.addUserCommand(T.name, T.desc, T.action, T.option, true);

    if (use_hook_search_map)//{{{
    {
        function hook_function(obj, attr, func) {
            const org = "__original";
            let original = obj[attr];
            if (org in original) original = original[org];
            let ret=function() {
                if (!(func.apply(this, arguments)===true)) {
                    original.apply(this, arguments);
                }
            };
            ret[org] = original;
            obj[attr] = ret;
        }

        let map = mappings.get(modes.NORMAL, "/");
        hook_function(map, "action", function() {
            let info = get_cache();
            if (info) info.enabled = false;
        });
        map = mappings.get(modes.NORMAL, "n");
        hook_function(map, "action", function() {
            if (grep_info_attr in content.document) {
                let info = get_cache();
                if (info&&info.enabled) {
                    grep_next();
                    return true;
                }
            }
        });
        map = mappings.get(modes.NORMAL, "N");
        hook_function(map, "action", function() {
            if (grep_info_attr in content.document) {
                let info = get_cache();
                if (info&&info.enabled) {
                    grep_prev();
                    return true;
                }
            }
        });
    } //}}}
})();
