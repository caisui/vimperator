// vim: set sw=4 ts=4 fdm=marker et:
var INFO = //{{{
<plugin name="liberator-overlay-ext" version="0.0.1"
    href="http://github.com/caisui/vimperator/blob/master/plugin/reload-image.js"
    summary="liberator overlay"
    xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            <p>
                liberator.echo と completer の 表示方法を変更します。

                また、表示用panel には、userStyle Sheet で 利用できるよう class 属性 に "liberator-overlay-container"が 付与しています。
            </p>
        </description>
    </item>
    <item>
        <tags> g:overlayStyle </tags>
        <spec> let g:overlayStyle </spec>
        <description>
            panel の style を設定
        </description>
    </item>
    <item>
        <tags> g:overlayIframeStyle </tags>
        <spec> let g:overlayIframeStyle </spec>
        <description>
            表示用 iframe の style を設定
        </description>
    </item>
</plugin>
; //}}}
(function() {
    const isVimp = liberator._class_ ? false : true;
    const PANEL_MODE = {
        MULTILINE : 1,
        COMPLETE  : 2,
        BOTH      : 3
    };
    const useOpacity  = 1;
    const standard    = 0;
    const pMode       = PANEL_MODE.BOTH;
    const minHeight   = "1em";
    const delayResize = 100;
    const res = {
        sid:       isVimp ? "liberator-statusline"               : "dactyl-statusline-field-status",
        className: isVimp ? "liberator-overlay-container"        : "dactyl-overlay-container",
        eval:      isVimp ? "eval"                               : "usereval",
        mow:       isVimp ? "liberator-multiline-output"         : "dactyl-multiline-output",
        mowBody:   isVimp ? "liberator-multiline-output-content" : "dactyl-multiline-output-content",
        comp:      isVimp ? "liberator-completions"              : "dactyl-completions"
    };

    //{{{ style sheet
    const fboxStyle = liberator.globalVariables.overlayStyle
        || <>
        -moz-appearance:none;
        background:rgba(0, 0, 0, 0.2);
        -moz-border-radius: 8px;
        padding:0.5em;
        border:none;
    </>;
    // WinGlass
    //<>
    //  background: transparent;
    //  -moz-appearance: -moz-win-glass;
    //  -moz-border-radius: 8px;
    //  padding:0.5em;
    //  border:none;
    //</>
    const iframeStyle = liberator.globalVariables.overlayIframeStyle
        || <>
            {useOpacity ? <>opacity:0.85;</>:""}
            border:none;
            min-height:{minHeight};
        </>;
    //}}}

    CommandLine.prototype.__defineGetter__("_maxHeight", function () {
        let rect = document.getElementById(res.sid).getBoundingClientRect();
        let screen = window.screen;
        let height = window.screenY + rect.top + window.outerHeight - window.innerHeight;
        return Math.max(height, screen.height - height) - rect.height;
    });

    function patch(obj, attr, func) {
        obj[attr] = liberator[res.eval]("(function ()" + func(obj[attr]) + ")()", obj[attr]);
    }

    patch(CommandLine.prototype, "updateOutputHeight", function (func) {
        let code = func.toString().split("\n");
        code[10] = <>this._outputContainer.height = Math.min(doc.height, availableHeight, commandline._maxHeight);</>;
        return code.join("");
    });
    if (isVimp) {
        patch(ItemList.prototype, "_autoSize", function (func) {
            let code = func.toString().split("\n");
            code[4] = <>this._minHeight = Math.min(commandline._maxHeight, Math.max(this._minHeight, this._divNodes.completions.getBoundingClientRect().bottom));</>;
            return code.join("");
        });
    }

    function oneEventListenr(obj, event, usecapture, func) {
        let args = [event, function() {
            this.removeEventListener.apply(this, args);
            func.apply(this, arguments);
        }, usecapture];
        obj.addEventListener.apply(obj, args);  
    }

    function OverlayPanel(id, initFunc) {
        let iframe = document.getElementById(id);
        let vbox = iframe.parentNode;
        let fbox;

        if (standard) fbox = document.querySelector(<>.{res.className}</>);
        if (!fbox) {
            fbox = document.createElement("panel");

            fbox.setAttribute("noautohide", true);
            fbox.setAttribute("style", fboxStyle);
            fbox.classList.add(res.className);
            fbox.addEventListener("popupshown", function() {
                modes.remove(modes.MENU);
            }, false);

            vbox.parentNode.insertBefore(fbox, vbox);
        }

        vbox.removeChild(iframe);

        const url = iframe.getAttribute("src");
        const onclick = iframe.getAttribute("onclick");
        iframe = document.createElement("iframe");
        iframe.setAttribute("id", id);
        iframe.setAttribute("style", iframeStyle);
        iframe.setAttribute("flex", 1);
        iframe.setAttribute("onclick", <>
            var e = liberator.focus;
            if(e {"&&"} e.ownerDocument === this.contentDocument) e.blur();
            if(event.target instanceof HTMLAnchorElement) {onclick};
        </>);

        vbox.appendChild(iframe);
        fbox.appendChild(vbox);

        let activeTimer = 0;
        function updateCollapsed(newValue) {
            try {
            if (newValue) fbox.hidePopup();
            else {
                if (fbox.state === "open") return;
                activeTimer && window.clearTimeout(activeTimer);
                activeTimer = window.setTimeout(function() {
                    activeTimer = 0;
                    fbox.sizeTo(window.innerWidth, -1);
                    fbox.openPopup(document.getElementById(res.sid), "before_start", 0, -12, false, false);
                }, 0);
            }
            }catch(ex) {liberator.echoerr(ex);}
            return newValue;
        }
        vbox.watch("collapsed", function(id, oldValue, newValue) updateCollapsed(newValue));

        oneEventListenr(iframe, "load", true, function() {
            initFunc(id, fbox, vbox, iframe);
        });

        oneEventListenr(fbox, "popupshown", false, function() {
            this.hidePopup();
        });
        fbox.openPopupAtScreen(0, 0, false);

        if (delayResize >= 0) {
            if (!("activeTimer" in fbox)) fbox.activeTimer = 0;
            window.addEventListener("resize", function resize(event) {
                if (vbox.collapsed) return;
                fbox.activeTimer && window.clearTimeout(fbox.activeTimer);
                fbox.activeTimer = window.setTimeout(function() {
                    fbox.activeTimer = 0;
                    if (fbox.width == window.innerWidth) return;
                    vbox.collapsed = true;
                    vbox.collapsed = false;
                }, delayResize);
            }, false);
        }
        iframe.setAttribute("src", url);
    }

    if (pMode & PANEL_MODE.MULTILINE)
        OverlayPanel(res.mow, function(id, fbox, vbox, iframe) {
            if (isVimp) {
                commandline._multilineOutputWidget = iframe;
            } else {
                commandline.widgets.multilineOutput = iframe;
            }
            commandline._outputContainer = vbox;
            iframe.contentDocument.body.setAttribute("id", res.mowBody);

            fbox.addEventListener("popupshown", function () {
                commandline.updateMorePrompt();
            }, false);
            let timer = 0;
            iframe.addEventListener("resize", function (event) {
                timer && window.clearTimeout(timer);
                timer = window.setTimeout(function () {
                    timer = 0;
                    commandline.updateOutputHeight();
                    commandline.updateMorePrompt();
                }, 200);
            }, false);
        });
    if(pMode & PANEL_MODE.COMPLETE)
        OverlayPanel(res.comp, function(id, fbox, vbox, iframe) {
            commandline._completionList = ItemList(id);
        });
})(this);
