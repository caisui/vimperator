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

    function exec_firefox(name, isPrivate) {
        if (!name) return;

        try {
            let profile = propertiesFile.ProfD.parent;
            profile.append(name);

            let args = ["--no-remote", "-profile", profile.path];
            if (isPrivate)
                args = ["-private"].concat(args);

            let file = propertiesFile.CurProcD;
            file.appendRelativePath("firefox.exe");

            if (!file || !file.exists()) {
                liberator.echoerr(<>not found firefox.exe!</>.toString());
                return;
            }
            let proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

            proc.init(file);
            proc.run(false, args, args.length);
        } catch (ex) {
            liberator.echoerr(ex);
        }
    }

    function simpleEnumrator(enumlator) {
      while (enumlator.hasMoreElements()) {
            yield enumlator.getNext();
      }
    }

    function completer_profile(context) {
      var dir = propertiesFile.ProfD.parent;
      let it = dir.directoryEntries;
      context.completions = [
        [f.leafName, f.path] for(f in simpleEnumrator(dir.directoryEntries))
            if(f.QueryInterface(Ci.nsIFile) && f.isDirectory())
      ];
    }

    let option = {
        argCount: "1",
        completer: completer_profile
    };
    commands.addUserCommand(["private[fox]"], "run firefox", function () exec_firefox(arguments[0], true), option, true);
    commands.addUserCommand(["firefox","fx"], "run firefox", function () exec_firefox(arguments[0]), option ,true);
})();
