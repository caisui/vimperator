(function () {
    commands.addUserCommand(["plugin"], "plugin safely load/unload", function (args) {
        let path = io.expandPath(args[0]);
        let scope = plugins.contexts[path];

        if (scope) {
            delete plugins.contexts[path];
            for ([n, v] in Iterator(modules.plugins)) {
                if (v === scope) {
                    delete plugins[n];
                }
            }
            if (scope.onUnload) {
                scope.onUnload();
            }
        }
        if (args["-unload"]) return;

        io.source(path);
    }, {
        literal: 0,
        options:[
            [["-unload", "-u"], commands.OPTION_NOARG],
        ],
        completer: function (context) {
            context.anchored = false;
            context.completions = [[n, ""] for (n in plugins.contexts)];

            completion.file(context.fork("file", 0), false);
        }
    }, true);
}).call(this);
