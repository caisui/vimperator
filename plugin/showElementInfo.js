// vim: set fdm=marker :
var INFO = //{{{
<plugin name="showElementInfo" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/showElementInfo.js"
        summary="Show Element Infomation"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="2.0"/>
    <item>
        <description>
            showElementInfo を showPageInfo のように拡張します。
        </description>
        <description>
            <dl>
                <dt>e</dt><dd>original 情報</dd>
                <dt>s</dt><dd>selector 情報</dd>
            </dl>
        </description>
    </item>
    <item>
        <tags> g:show_element_info_option</tags>
        <spec> let g:show_element_info_option </spec>
        <type>string</type>
        <default>es</default>
        <description>
            element info を 設定
        </description>
    </item>
</plugin>;
//}}}
(function () {
	const attr = "showElementInfo";
	let orignal = buffer.hasOwnProperty(attr) ? buffer[attr]: null;

	buffer[attr] = function (elem, extra) {
		const self = this;
		if (!extra) extra = liberator.globalVariables.show_element_info_option || "es";

		let info = buffer.elementInfo;

		liberator.echo(Array.reduce(extra, function (xml, section) {
			let i = self.elementInfo[section];
			if (i) {
				if (i[0])
					xml += <div highlight="Title">{i[0]}:</div>;
				xml += i[1](elem);
				xml += <br/>;
			}
			return xml;
		}, <></>), commandline.FORCE_MULTILINE);
	};

	if (!buffer.hasOwnProperty("elementInfo"))
		buffer.elementInfo = {};

	buffer.addElementInfoSection = function (option, title, func) {
		this.elementInfo[option] = [title, func];
	};

	buffer.addElementInfoSection("e", "Element", function (elem) <>{util.objectToString(elem, true)}</>);
	buffer.addElementInfoSection("s", "selector", function (elem) {
		let selector = [];

		for (let e = elem; e && e instanceof Element; e = e.parentNode) {
			let inf = <></>;
			if (e.prefix)
				inf += <span style="color:red">{e.prefix}|</span>;
			inf += <span style="color:red">{e.localName}</span>;
			if (e.id)
				inf += <span style="color:blue">#{e.id}</span>;
			inf += <span style="color:green">{Array.map(e.classList, function (c)"."+c).join("")}</span>;
			selector.push(inf);
		}
		return selector.reduceRight(function (xml, a, i) {
			xml.* += a;
			if (i) xml.* += <span style="color:gray"> &gt; </span>;
			return xml;
		}, <span style="white-space:normal;"/>);
	});
	this.onUnload = function () {
		if (orignal)
			buffer[attr] = orignal;
		else
			delete buffer[attr];
		delete buffer.addElementInfoSection;
	};
}).call(this);
