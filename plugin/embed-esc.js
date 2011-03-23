// vim:set sw=4 ts=4 fdm=marker:
var INFO = //{{{
<plugin name="embed-esc" version="0.0.3"
        href="http://github.com/caisui/vimperator/blob/master/plugin/embed-esc.js"
        summary="Embed Esc"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.3"/>
    <item>
        <description>
            <p>
                modes.EMBED から {"<Esc>"}<key name="<Esc>"/> で modes.NORMAL に 戻れるっぽくします。
            </p>
        </description>
    </item>
    <item>
        <tags> g:embed_esc_key </tags>
        <spec> let g:embed_esc_key </spec>
        <type>number</type>
        <default>VK_ESCAPE(0x1b)</default>
        <description>
          監視キーコードを指定
        </description>
    </item>
    <item>
        <tags> g:embed_esc_interval </tags>
        <spec> let g:embed_esc_interval </spec>
        <type>number</type>
        <default>200</default>
        <description>
            監視間隔を指定します(msec)
        </description>
    </item>
    <item>
        <tags> g:embed_esc_disabled_inactive_check </tags>
        <spec> let g:embed_esc_disabled_inactive_check </spec>
        <type>boolean</type>
        <default>false</default>
        <description>
           true で inactive の check を 行なわないようにします
           <br/>
           <warning>Firefox 3.6x は常にtrue 扱い </warning>
        </description>
    </item>
</plugin>; //}}}
(function () {
    let scope = {};
    Cu.import("resource://gre/modules/ctypes.jsm", scope);
    const ctypes = scope.ctypes;

    const INT32 = ctypes.int32_t;
    const SHORT = ctypes.short || ctypes.int16_t;
    const WINAPI  = ctypes.winapi_abi || ctypes.default_abi;
    const VK_ESCAPE = KeyEvent.DOM_VK_ESCAPE;
    const VK_RCONTROL = 0xA3;

    const interval = liberator.globalVariables.embed_esc_interval || 200;
    const inactive_check = ctypes.winapi_abi && !liberator.globalVariables.embed_esc_disabled_inactive_check;

    let lib = ctypes.open("user32.dll");
    //http://msdn.microsoft.com/ja-jp/library/cc364676.aspx
    const GetKeyState = lib.declare("GetKeyState", WINAPI, SHORT, INT32);

    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

    function getObserveKey() liberator.globalVariables.embed_esc_key || VK_ESCAPE

    let embedTimer = {
        observe: function () {
            if (inactive_check) {
                if (document.documentElement.mozMatchesSelector(":-moz-window-inactive")) {
                    if (!(modes._extended & modes.MENU)) {
                        modes._extended |= modes.MENU;
                        modes.show();
                    }
                    return;
                }
                if (modes._extended & modes.MENU) {
                    modes._extended &= ~modes.MENU;
                    modes.show();
                }
            }
            let state = GetKeyState(getObserveKey());
            if (state < 0) {
                let embed = liberator.focus;
                if (embed)
                    embed.blur();
                else
                    modes.reset();
            }
        }
    };

    function embedObserve([oldMain], [newMain]) {
        if (newMain === modes.EMBED) {
            timer.init(embedTimer, interval, Ci.nsITimer.TYPE_REPEATING_SLACK);
        }
        else if (oldMain === modes.EMBED) {
            timer.cancel();
        }
    }
    liberator.registerObserver("modeChange", embedObserve);

    this.onUnload = function _onUnload() {
        delete this.onUnload;
        timer.cancel();
        timer = null;
        lib.close();
        lib = null;
        liberator.unregisterObserver("modeChange", embedObserve);
    };
}).call(this);
