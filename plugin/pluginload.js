(function () {
	commands.addUserCommand(["pluginload"], "plugin load",
		function (args) { io.source(args[0]); },
		{
			literal: 1,
			completer: function (context, args){
				context.completions = 
					[[f.path.replace(/\\/g,"/"), ""] for([,f] in Iterator(io.getRuntimeDirectories("plugin")))]
					.concat([ [services.get("directory").get("ProfD", Ci.nsIFile).path.replace(/\\/g, "/"), ""]]);

				context.fork("file", 0, this, function (context) {
					completion.file(context, true);
					context.filters.push(function ({item:f}) f.isDirectory() || f.isFile() && /\.js$/.test(f.leafName));
				});
			}
		}, true);
})();
