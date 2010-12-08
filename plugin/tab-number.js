// vim: set sw=4 ts=4 et:
let INFO =
<plugin name="tab-number" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/tab-number.js"
        summary="for tab number"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <item>
        <description>
            tab に pos 属性 を付与し、content: attr(pos) 的な 利用 を 支援します。
        </description>
    </item>
</plugin>;
(function (self) {
    function addEvent(elem, eventName, func, capture) {
        elem.addEventListener(eventName, func, capture);
        return function () {
            elem.removeEventListener(eventName, func, capture);
        };
    }

    if (!/^3/.test(Application.version)) return;

    function watchtPos(id, oldVal, newVal) {
        this.setAttribute("pos", newVal + 1);
        return newVal;
    }

    function updatePosition(evt) {
        let tab = evt.target;
        tab.setAttribute("pos", tab._tPos + 1);
        tab.watch("_tPos", watchtPos);
    }
    let container = gBrowser.tabContainer;

    let handle = [];
    handle.push(addEvent(container, "TabOpen",  updatePosition, false));

    Array.prototype.forEach.call(gBrowser.mTabs, function (t) updatePosition({target: t}));

    self.onUnload = function () {
        handle.forEach(function (e) e());
        Array.prototype.forEach.call(gBrowser.mTabs, function (t) t.unwatch("_tPos", watchtPos));
        delete self.onUnload;
    };
})(this);
