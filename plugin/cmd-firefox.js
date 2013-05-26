// vim: set et sw=4 ts=4 :
(function() {
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

            let file = propertiesFile.CurProcD;
            if (file.leafName === "browser") {
                file = file.parent;
            }

            file.appendRelativePath("firefox.exe");

            if (!file || !file.exists()) {
                liberator.echoerr(`not found firefox.exe!`);
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
        [f.leafName, f.path] for(f in iter(dir.directoryEntries))
            if(f.QueryInterface(Ci.nsIFile) && f.isDirectory())
      ];
    }

    const op_fx = [
        [["-console", "-c"],       commands.OPTION_NOARG],
        [["--private-mode", "-p"], commands.OPTION_NOARG],
    ];

    commands.addUserCommand(["firefox", "fx"], "run firefox", exec_firefox, { argCount: "1",
        literal: 0,
        completer: completer_profile,
        options: [
            [["-console", "-c"] , commands.OPTION_NOARG, null],
            [["--private-mode", "-p"] , commands.OPTION_NOARG, null],
            [["--no-plugin"   , "-np"], commands.OPTION_NOARG, null],
        ]
    }, true);
})();
