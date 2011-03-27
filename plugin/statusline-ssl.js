(function () {
    highlight.loadCSS(<![CDATA[
        StatusLineBroken    color: black; background: #FFa0a0 /* light-red */
        StatusLineSecure    color: black; background: #a0a0FF /* light-blue */
        StatusLineExtended  color: black; background: #a0FFa0 /* light-green */
    ]]>.toString());

    //let statusLine = document.getElementById("liberator-statusline");
    let statusLine = document.getElementById("liberator-status");

    let SSLProgressListener = {
        onSecurityChange: function _onSecurityChange(webProgress, request, state) {
            if (this._state === (this._state = state)) return;

            const wpl = Ci.nsIWebProgressListener;
            const wpl_security_bits = wpl.STATE_IS_SECURE | wpl.STATE_IS_BROKEN | wpl.STATE_IS_INSECURE | wpl.STATE_SECURE_HIGH | wpl.STATE_SECURE_MED | wpl.STATE_SECURE_LOW;
            let level;
            switch (this._state & wpl_security_bits) {
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH:
                level = "Secure";
                break;
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_MED:
              case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_LOW:
                level = "Extended";
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
