(function () {
	const name = "general.useragent.locale";
	const opName = name.replace(/\./g, "_");

	options.remove(opName);
	options.add([opName], "switch locale", "string", 
	options._loadPreference("general.useragent.locale", null, true),
	{
		completer: function (context) [["ja", "japan"], ["en-US", "english"]],
		getter: function () options.getPref(name),
		setter: function (value) {
			options.setPref(name, value);
			return value;
		}
	});
})();
