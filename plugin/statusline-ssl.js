// vim:set sw=4 ts=4 et:
var INFO = //{{{
xml`<plugin name="statusline-ssl" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/statusline-ssl.js"
        summary="status line SSL"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <description>
            <p>
                statusline を vimperator 2.x の ときのように SSL の状態で highlight が 変わるようにします。
            </p>

            <note> rc file には autocmd 経由で 設定する必要があります</note>
            <example>
                autocmd VimperatorEnter ".*" :highlight StatusLineSecure -append font-weight: bold;
            </example>
        </description>
    </item>
</plugin>`; //}}}

(function () {
    if (Application.version[0] === "3") return ;
    highlight.loadCSS(`
        StatusLineBroken    color: black; background: #FFa0a0 /* light-red */
        StatusLineWeak      color: black; background: #FFFFa0 /* light-yellow */
        StatusLineSecure    color: black; background: #a0a0FF /* light-blue */
        StatusLineExtended  color: black; background: #a0FFa0 /* light-green */
    `);

    //let statusLine = document.getElementById("liberator-statusline");
    let statusLine = document.getElementById("liberator-status");

    let SSLProgressListener = {
        onSecurityChange: function _onSecurityChange(webProgress, request, state) {
            if (this._state === (this._state = state)) return;

            const wpl = Ci.nsIWebProgressListener;
            const wpl_security_bits = wpl.STATE_IS_SECURE | wpl.STATE_IS_BROKEN | wpl.STATE_IS_INSECURE |
                                      wpl.STATE_SECURE_HIGH | wpl.STATE_SECURE_MED | wpl.STATE_SECURE_LOW |
                                      wpl.STATE_IDENTITY_EV_TOPLEVEL;
            let level;
            switch (this._state & wpl_security_bits) {
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH | wpl.STATE_IDENTITY_EV_TOPLEVEL:
                level = "Extended";
                break;
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH:
                level = "Secure";
                break;
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_MED:
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_LOW:
                level = "Weak";
                break;
              case wpl.STATE_IS_BROKEN:
                level = "Broken";
                break;
              default:
                level = "";
            }

            //statusLine.setAttributeNS(NS, "highlight", level ? ("StatusLine" + level) : "Normal");
            statusLine.setAttributeNS(NS, "highlight", "StatusLine" + level);
        }
    };

    gBrowser.addProgressListener(SSLProgressListener);

    this.onUnload = function () {
        gBrowser.removeProgressListener(SSLProgressListener);
        //statusLine.setAttributeNS(NS, "highlight", "Normal");
        statusLine.setAttributeNS(NS, "highlight", "StatusLine");
    };
}).call(this);
