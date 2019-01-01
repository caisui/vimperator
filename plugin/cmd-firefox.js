// vim: set et sw=4 ts=4 :
(function() {
    let {File} = io;
    var appName = Services.appinfo.name.toLowerCase();

    //https://developer.mozilla.org/index.php?title=Ja/Code_snippets/File_I%2F%2FO#section_3
    const list = [
        "ProfD",
        "DefProfRt",
        "UChrm",
        "DefRt",
        "PrfDef",
        "ProfDefNoLoc",
        "APlugns",
        "AChrom",
        "ComsD",
        "CurProcD",
        "Home",
        "TmpD",
        "ProfLD",
        //"resource:app ",
    ];
    let properties = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    let propertiesFile={};
    for (let [,attr] in Iterator(list)) {
        let id = attr;
        propertiesFile.__defineGetter__(id,function() properties.get(id,Ci.nsIFile).QueryInterface(Ci.nsILocalFile));
    }

    function exec_firefox(args) {
        let name = args[0];
        if (!name) return;

        try {
            let profile = propertiesFile.ProfD.parent;

            profile.append(name);

            let params = ["--no-remote", "-profile", profile.path];
            let vimparams = [];

            if (args["--private-mode"])
                params.push("-private");
            if (args["-console"])
                params.push("-console");

            if (args["--no-plugin"])
                vimparams.push("++noplugin");

            if (vimparams.length > 0)
                params.push("-vimperator", vimparams.join(" "));

            for(var i = 1, j = args.length; i < j; i++) {
                params.push(args[i]);
            }

            let file = propertiesFile.CurProcD;
            if (file.leafName === "browser") {
                file = file.parent;
            }

            file.appendRelativePath(appName + ".exe");

            if (!file || !file.exists()) {
                liberator.echoerr(`not found ${appName}.exe!`);
                return;
            }
            let proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
            liberator.log(params, 0);

            proc.init(file);
            proc.run(false, params, params.length);
        } catch (ex) {
            liberator.echoerr(ex);
        }
    }

    function completer_profile(context) {
      var dir = propertiesFile.ProfD.parent;
      let it = dir.directoryEntries;
      context.completions = [
        for(f of iter(dir.directoryEntries))
            if(f.QueryInterface(Ci.nsIFile) && f.isDirectory())
                [f.leafName, f.path]
      ];
    }

    function completer(context, args) {
        var {completeArg} = args;
        if (completeArg === 0) completer_profile(context);
        else {
            context.fork("lo", 0, this, context => {
                context.title = ["location"];
                context.completions = [[content.location.href, ""]];
            });
            completion.history(context.fork("his", 0, this));
        }
    }

    const op_fx = [
        [["-console", "-c"],       commands.OPTION_NOARG],
        [["--private-mode", "-p"], commands.OPTION_NOARG],
    ];

    commands.addUserCommand([appName, "fx"], "run firefox", exec_firefox, { argCount: "1+",
        completer,
        options: [
            [["-console", "-c"] , commands.OPTION_NOARG, null],
            [["--private-mode", "-p"] , commands.OPTION_NOARG, null],
            [["--no-plugin"   , "-np"], commands.OPTION_NOARG, null],
        ]
    }, true);
})();
