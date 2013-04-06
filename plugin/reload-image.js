// vim:set sw=4 ts=4 fdm=marker:
var INFO = //{{{
xml`<plugin name="reload-image" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/reload-image.js"
        summary="reload image"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <tags>:ri :reloadimage</tags>
        <spec>:reloadimage <oa>option</oa></spec>
        <description>
            <p>
                読込に失敗した画像を再読込します。
            </p>
            <a>args</a>
            <dl>
                <dt>status, st</dt>  <dd>アクティブタブの再読込状況を表示</dd>
            </dl>
        </description>
    </item>
    <item>
        <tags>g:reloadImageTimeToWait</tags>
        <spec>g:reloadImageTimeToWait</spec>
        <type>number</type>
        <default> 30000 </default>
        <description>
            リロード時のタイムアウト時間を設定(msec)
        </description>
    </item>
    <item>
        <tags>g:reloadImagelimitRetryCount</tags>
        <spec>g:reloadImagelimitRetryCount</spec>
        <type>number</type>
        <default> 0 </default>
        <description>
            タイムアウト時のリトライ回数を設定
        </description>
    </item>
</plugin>`
; //}}}
(function () {
    const ios = services.get("io");
    const NS_ERROR_SAVE_LINK_AS_TIMEOUT = 2153578528; //0x805D0020
    const NS_ERROR_USER_STOP_REQUEST    = 2152398850; //0x804B0002
    const NS_ERROR_DISCONNECT           = 2152398868; //0x804B0014

    function callbacks() {}
    callbacks.prototype = {
      getInterface: function sLA_callbacks_getInterface(aIID) {
        if (aIID.equals(Ci.nsIAuthPrompt) || aIID.equals(Ci.nsIAuthPrompt2)) {
          var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                   getService(Ci.nsIPromptFactory);
          return ww.getPrompt(doc.defaultView, aIID);
        }
        throw Cr.NS_ERROR_NO_INTERFACE;
      }
    }

    function toByte(val) {
        if (val === undefined) return "unknown";

        let unit = "";
        const num = 1024;

        for ([,unit] in Iterator(["", "K", "M", "G", "T"])) {
            if (val < num * num / 100) break;
            val /= num;
        }

        val = unit ? val.toFixed(2) : val.toString();
        while (val !== (val = val.replace(/^(\d+)(\d{3})/,"$1,$2")));
        return val + unit;
    }

    function reloadImageLog(src) {
        this.src = src;
        this.limitRetryCount = liberator.globalVariables.reloadImagelimitRetryCount || 0;
    }
    reloadImageLog.prototype = {
        type: "",
        status: "",
        text: "wait for connect...",
        offset: 0,
        retry: 0,

        get message() xml`<tr>
            <td>
            ${this.retry && this.limitRetryCount ? `[${this.retry}/${this.limitRetryCount}]` : ""}
            </td>
            <td>${this.status} [${this.text}]</td>
            <td>${this.type}</td>
            <td>(${toByte(this.offset)} / ${toByte(this.length)})</td>
            <td><a href=${this.src}>${this.src}</a></td>
        </tr>`,
        update: function (aRequest, offset) {
            aRequest instanceof Ci.nsIHttpChannel;
            this.type   = aRequest.contentType;
            this.status = aRequest.responseStatus;
            this.text   = aRequest.responseStatusText;
            this.length = aRequest.contentLength;
            this.offset = offset;
        },
        cancel: function (msg) {
            this.text = `cancel: ${msg}`;
        }
    };

    function reloadImage(elem, loadGroup)
        _reloadImage(elem, loadGroup, new reloadImageLog(elem.src))
    function _reloadImage(elem, loadGroup, log) {
        if (!(elem instanceof Ci.nsIImageLoadingContent)) return;

        let url = elem.src;

        let channel = ios.newChannelFromURI(ios.newURI(url, null, null));
        channel.notificationCallbacks = new callbacks();
        channel.loadFlags = channel.LOAD_BYPASS_CACHE | channel.LOAD_CALL_CONTENT_SNIFFERS;
        let url = elem.ownerDocument.location.href;

        if (channel instanceof Ci.nsIHttpChannel) {
            channel.referrer = ios.newURI(url, null, null);
            if (channel instanceof Ci.nsIHttpChannelInternal) {
                channel.forceAllowThirdPartyCookie = true;
                channel.documentURI = elem.ownerDocument.documentURIObject;
            }
        }

        if (loadGroup)
            channel.loadGroup = loadGroup;

        let timeToWait = liberator.globalVariables.reloadImageTimeToWait || 30 * 1000;

        let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        timer.initWithCallback({
            notify: function (aTimer) {
                channel.cancel(NS_ERROR_SAVE_LINK_AS_TIMEOUT);
                return;
            }
        }, timeToWait, timer.TYPE_ONE_SHOT);

        function __reload() {
            if (log.retry < log.limitRetryCount) {
                log.retry++;
                _reloadImage(elem, loadGroup, log);
            } else {
                log.cancel("timeout");
            }
        }

        channel.asyncOpen({
            onStartRequest: function (aRequest, aContext) {
                if (aRequest.status == NS_ERROR_SAVE_LINK_AS_TIMEOUT) {
                  return;
                }

                timer.cancel();
                if (!Components.isSuccessCode(aRequest.status))
                    return;

                log.update(aRequest, 0);

                this.extListener = elem.loadImageWithChannel(aRequest);
                if (this.extListener)
                    this.extListener.onStartRequest(aRequest, aContext);
            },
            onDataAvailable: function (aRequest, aContext, aInputStream, aOffset, aCount) {
                log.update(aRequest, aOffset);
                if (this.extListener)
                    this.extListener.onDataAvailable(aRequest, aContext, aInputStream, aOffset, aCount);
            },
            onStopRequest: function (aRequest, aContext, aStatusCode) {
                if (!Components.isSuccessCode(aRequest.status)) {
                    if (aRequest.status === NS_ERROR_USER_STOP_REQUEST)
                        log.cancel("user cancel");
                    else if (aRequest.status === NS_ERROR_SAVE_LINK_AS_TIMEOUT
                        || aRequest.status === NS_ERROR_DISCONNECT
                    ) __reload();
                    return;
                }
                log.update(aRequest, aRequest.contentLength);
                if (this.extListener)
                    this.extListener.onStopRequest(aRequest, aContext, aStatusCode);
            }
        }, null);

        return log;
    }

    function failImages(win) {
        if (!win) win = content.window;
        let stack = [win];

        while (win = stack.pop()) {
            for (let img in util.Array.itervalues(win.document.images)) {
                if (img instanceof Ci.nsIImageLoadingContent) {
                    let req = img.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
                    if(req.imageStatus & req.STATUS_LOAD_COMPLETE) continue;
                    yield img;
                }
            }
            Array.prototype.push.apply(stack, [w for (w in util.Array.itervalues(win.frames))]);
        }
    }

    commands.addUserCommand(["reloadimage", "ri"], "reload images", function (args) {
        if (args.status) {
            let (list = content.document.reloadImageCache) {
                if (list && list.length) {
                    liberator.echo(xml`<table><tbody>${
                            template.map(list, function (inf) inf.message)
                        }</tbody></table>`);
                }
                else liberator.echo("no reload images");
            }
        }
        else {
            let list = [];

            for (let img in failImages()) {
                list.push(
                    reloadImage(img, gBrowser.selectedBrowser.webNavigation.loadGroup)
                );
            }
            liberator.echo(`${list.length} images reloading...`);
            content.document.reloadImageCache = list;
        }
    }, {
        argCount: "0",
        options: [
            [["status", "st"], commands.OPTION_NOARG]
        ]
    }, true);
})(this);
