var INFO = //{{{
<plugin name="pageinfo-SSL" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/pageinfo-SSL.js"
        summary="page info SSL"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            page info に SSL情報を 追加可能にする
        </description>
    </item>
</plugin>;
//}}}
buffer.addPageInfoSection("S", "SSL Status", function (verbose) {
    if (verbose) {
        function _ssl() {
            let ui = gBrowser.selectedBrowser.securityUI.QueryInterface(Ci.nsISSLStatusProvider);
            if (ui.SSLStatus) {
                for (let [, name] in Iterator(["keyLength"]))
                    yield [name, ui.SSLStatus[name]];

                let certNames = ["windowTitle", "nickName", "organization", "commonName", "emailAddress"]
                const cert = ui.SSLStatus.serverCert;
                for (let [, name] in Iterator(certNames)) {
                    yield [name, cert[name]];
                }

                let validityNames = ["notAfterGMT"];
                for (let [, name] in Iterator(validityNames)) {
                    yield [name, cert.validity[name]];
                }
            }
        }

        return ([name.replace(/[A-Z]+/g,
            function (c) " " + (c.length === 1 ? c.toLowerCase() : c)), value]
            for ([name, value] in _ssl()));
    }
});
