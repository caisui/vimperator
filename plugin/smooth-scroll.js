// vim: set fdm=marker:
(function () {
    const prefix = "mozRequestAnimationFrame" in window;
    const requestAnimationFrame =
        prefix ? "mozRequestAnimationFrame" : "requestAnimationFrame";
    const cancelRequestAnimationFrame =
        prefix ? "mozCancelRequestAnimationFrame" : "CancelRequestAnimationFrame";

    const now = prefix ? Date.now.bind(Date) : performance.now.bind(performance);

    function SmoothScroller(elem, dir) {
        this.elem = Cu.getWeakReference(elem);
        this.dir = dir || "x";
        var [cur, max] = this.res[this.dir];
        this._start = this._pos = this._end = elem[cur];
        this.max = elem[max];
    }
    update(SmoothScroller.prototype, {
        startTime: 0,
        endTime: 0,
        res: {
            x: ["scrollLeft", "scrollLeftMax"],
            y: ["scrollTop",  "scrollTopMax"],
        },
        get duration() liberator.globalVariables.smooth_scroll_duration || 300,
        get pos() this._end,
        set pos(value) {
            if (this._end === value) {
                return;
            }

            this.startTime = now();
            this.endTime = this.startTime + this.duration;

            this._start = this._pos;
            this._end   = value;
        },
        update: function (tick) {
            var e = this.elem.get();

            if (!e) return true;

            var duration = this.endTime - this.startTime;
            var rate = (tick - this.startTime) / duration;

            if (rate > 1) rate = 1;

            var [attr] = this.res[this.dir];
            this._pos = (1 - rate) * this._start + rate * this._end;
            e[attr] = this._pos
            return rate === 1;
        },
    });
    function Manager() {
        this.x = new WeakMap;
        this.y = new WeakMap;
        this.array = [];
    }
    update(Manager.prototype, {
        get: function (e, dir) {
            var w = this[dir];
            var res = w.get(e);
            if (!res) {
                res = new SmoothScroller(e, dir);

                w.set(e, res);
                if (this.array.length === 0) {
                    this.update();
                }
                this.array[this.array.length] = res;
            }
            return res;
        },
        getX: function (e) this.get(e, "x"),
        getY: function (e) this.get(e, "y"),
        scrollTo: function (e, x, y) {
            if (x != null) {
                this.get(e, "x").pos = x;
            }
            if (y != null) {
                this.get(e, "y").pos = y;
            }
        },
        scrollBy: function (e, x, y) {
            if (x != null) {
                this.get(e, "x").pos += x;
            }
            if (y != null) {
                this.get(e, "y").pos += y;
            }
        },
        sample: function sample(tick) {
            var array = this.array;
            var value;
            for (var i = 0, j = array.length, k = 0; i < j; i++) {
                value = array[i];
                if (value.update(tick)) {
                    this[value.dir].delete(value.elem.get());
                } else {
                    array[k++] = array[i];
                }
            }

            if (k < i) {
                array.splice(k);
            }
            if (k > 0) {
                this.handle = window[requestAnimationFrame](this.sample.bind(this));
            } else {
                this.handle = 0;
                Cu.reportError("new");
            }
        },
        update: function () {
            if (!this.handle) {
                this.handle = window[requestAnimationFrame](this.sample.bind(this));
            }
        },
        reset: function reset() {
            this.array = [];
            this.x.clear();
            this.y.clear();
            if (this.handle) {
                window[cancelRequestAnimationFrame](this.handle);
                this.handle = 0;
            }
        },
    });

    const manager = this.manager = new Manager;

    function getWindowScrollNode(win) {
        var doc = win.document;
        return doc.compatMode === "CSS1Compat" ? doc.documentElement : doc.body || doc.documentElement;
    }
    function scrollTo(e, x, y) {
        try {
        manager.scrollTo(e, x, y);
        } catch (ex) {
            Cu.reportError(ex);
            liberator.echoerr(ex);
        }
    }
    function scrollBy(e, x, y) {
        try {
        manager.scrollBy(e, x, y);
        } catch (ex) {
            Cu.reportError(ex);
            liberator.echoerr(ex);
        }
    }

    update(buffer, {
        scrollStart: function () {
            var e = Buffer.findScrollable(-1, true);
            scrollTo(e, 0, null);
        },
        scrollEnd: function () {
            var e = Buffer.findScrollable(1, true);
            scrollTo(e, e.scrollLeftMax, null);
        },
        scrollTop: function () {
            e = Buffer.findScrollable(-1, false);
            scrollTo(e, null, 0);
        },
        scrollBottom: function () {
            e = Buffer.findScrollable(1, false);
            scrollTo(e, null, e.scrollTopMax);
        },
        scrollByScrollSize: function (direction, count) {
            direction = direction ? 1 : -1;
            count = count || 1;
            var e = Buffer.findScrollable(direction, false);

            Buffer.checkScrollYBounds(e, direction);

            if (options["scroll"] > 0)
                this.scrollLines(options["scroll"] * direction);
            else // scroll half a page down in pixels
                scrollBy(e, null, e.clientHeight / 2 * direction);
        },
    });
    const Region = Components.Constructor("@mozilla.org/gfx/region;1", Ci.nsIScriptableRegion, "init");
    update(Buffer, {
        scrollToPercent: function (x, y) {
            let win = Buffer.findScrollableWindow();
            var doc = win.document;

            marks.add("'", true);
            var e = getWindowScrollNode(win);

            if (x !== null) x = x * e.scrollLeftMax / 100;
            if (y !== null) y = y * e.scrollTopMax  / 100;

            scrollTo(e, x, y);
        },
        scrollVertical: function scrollVertical(elem, increment, number) {
            elem = elem || Buffer.findScrollable(number, false);
            let fontSize = parseInt(util.computedStyle(elem).fontSize);
            if (increment == "lines")
                increment = fontSize;
            else if (increment == "pages")
                increment = elem.clientHeight - fontSize;
            else
                throw Error()

            scrollBy(elem, null, number * increment);
        },
        scrollHorizontal: function scrollHorizontal(elem, increment, number) {
            elem = elem || Buffer.findScrollable(number, true);
            let fontSize = parseInt(util.computedStyle(elem).fontSize);
            if (increment == "columns")
                increment = fontSize; // Good enough, I suppose.
            else if (increment == "pages")
                increment = elem.clientWidth - fontSize;
            else
                throw Error()

            scrollBy(elem, number * increment);
        },
        findScrollable: function findScrollable(dir, horizontal) {
            let pos = "scrollTop", maxPos = "scrollTopMax", clientSize = "clientHeight";
            if (horizontal)
                pos = "scrollLeft", maxPos = "scrollLeftMax", clientSize = "clientWidth";

            function find(elem) {
                if (!(elem instanceof Element))
                    elem = elem.parentNode;
                var screen = Region()
                var clip = Region();

                ROOT: while (elem) {
                    var win = elem.ownerDocument.defaultView;
                    screen.setToRect(0, 0, win.innerWidth, win.innerHeight);

                    var f = win.frameElement;
                    while (f) {
                        r = f.getBoundingClientRect();
                        var w = f.ownerDocument.defaultView;
                        screen.intersectRect(-r.left, -r.top, w.innerWidth, w.innerHeight);
                        f = w.frameElement;
                    }

                    if (!screen.isEmpty()) {
                        for (; elem instanceof Element; elem = elem.parentNode) {
                            if (elem[clientSize] == 0)
                                continue;
                            if (dir <= 0 && elem[pos] > 0 || dir >= 0 && elem[pos] < elem[maxPos]) {
                                if (elem === win.document.documentElement || elem === win.document.body)
                                    break ROOT;
                                var rect = elem.getBoundingClientRect();
                                clip.setToRegion(screen);
                                clip.intersectRect(rect.left, rect.top, rect.width, rect.height);
                                if (!clip.isEmpty()) break ROOT;
                            }
                        }
                    }
                    elem = win.frameElement;
                }
                return elem;
            }

            let win = this.focusedWindow;
            if (win.getSelection().rangeCount)
                var elem = find(win.getSelection().getRangeAt(0).startContainer);
            if (!(elem instanceof Element)) {
                let doc = Buffer.findScrollableWindow().document;
                elem = find(doc.body || doc.getElementsByTagName("body")[0] ||
                            doc.documentElement);
            }
            // XXX: elem が null のとき エラーになったので適当に返す
            return elem || win.document.documentElement;
        },
        checkScrollYBounds: function checkScrollYBounds(e, direction) {
            // NOTE: it's possible to have scrollY > scrollMaxY - FF bug?
            var [pos, max] = e.nodeType === Node.ELEMENT_NODE
                ? ["scrollTop", "scrollTopMax"] : ["scrollY", "scrollMaxY"];
            if (direction > 0 && e[pos] >= e[max] || direction < 0 && e[pos] == 0)
                liberator.beep();
        },
    });

    for (let [name, pos] of [ ["gg", "Top"], ["G", "Bottom"]]) {
        let m = mappings.getDefault(modes.NORMAL, name);
        let action = "scroll" + pos;
        mappings.addUserMap(m.modes, m.names, m.description, function (count) {
            if (count) {
                var e = Buffer.findScrollable(0, false);
                scrollTo(e, null, e.scrollTopMax * count / 100);
            } else {
                buffer[action]();
            }
        }, {count: true});
    }

    if (!liberator.globalVariables.no_smooth_scroll_space_hack) {
        const query = ["button", ...[
            `input[type="${t}"]` for (t of [
                "button",
                "checkbox",
                "file",
                "image",
                "radio",
                "reset",
                "submit",
            ])]].join(",");
        config.ignoreKeys["<Space>"] &= ~modes.NORMAL;
        mappings.addUserMap([modes.NORMAL], ["<Space>"], "scroll page(override space map)", function (count) {
            var elem = liberator.focus;
            // TODO: screen out の場合も無視
            if (elem && elem.mozMatchesSelector(query)) {
                return;
            }

            buffer.scrollPages(count || 1);
        }, { count: true});
    }

    this.onUnload = function () {
        try {
            manager.reset();
        } catch (ex) {
            liberator.echcoerr(ex);
        }
    };

    this.scrollBy = scrollBy;
    this.scrollTop = scrollTo;
}).call(this);
