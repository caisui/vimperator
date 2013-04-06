// vim: set sw=4 ts=4 fdm=marker et :
var INFO = //{{{
xml`<plugin name="coffee-script" version="0.0.1"
        href="http://github.com/caisui/vimperator/blob/master/plugin/coffee-script.js"
        summary="CoffeeScript"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <description>
            let's coffee

            <note>
                <link xmlns=${XHTML} target="_blank" href="https://github.com/jashkenas/coffee-script">jashkenas/coffee-script - GitHub</link>
                の extra/coffee-script.js が必要です。
            </note>
        </description>
    </item>
</plugin>`;
//}}}

var defaultPath = "~/vimperator/coffee-script.js";

this.__defineGetter__("CoffeeScript", function () {
    delete this.CoffeeScript;
    services.get("subscriptLoader").loadSubScript(
        services.get("io").newFileURI(File(liberator.globalVariables.coffeescript || defaultPath)).spec,
        this);
    return this.CoffeeScript;
});


function compile(expression, options) CoffeeScript.compile(expression, options)

function execute(expression, context, options) {
    var result = liberator.eval(compile(expression, options), context || userContext);
    return result;
}

function loadScript(uri, context) {
    //CoffeeScript.load(spec, context);
    execute(util.httpGet(uri).responseText, context || userContext, {filename: uri, bare: !!context});
}

function loadFile(path, context) {
    loadScript(services.get("io").newFileURI(File(path)).spec, context);
}
// File completer 付与
completion.setFunctionCompleter([loadFile], [completion.file]);

{
    let extra = {
        literal: 0,
        argCount: 1,
        completer: completion.javascript,
        hereDoc: true,
        options: [
            [["--test", "-t"], commands.OPTION_NOARG],
            [["--echo", "-e"], commands.OPTION_NOARG],
            [["--bare", "-b"], commands.OPTION_NOARG],
        ],
    };

    commands.addUserCommand(["cof[fee]", "cf"], "Run a CoffeeScript command through eval()", function (args) {
        try {
            var expression = args[0];
            var options = {
                bare: args["--bare"],
            };
            if (args["--test"])
                liberator.echo(xml`<pre>${compile(expression, options)}</pre>`);
            else if (args["--echo"])
                execute("liberator.echo (CommandLine.echoArgumentToString (" + expression + "), true)", userContext, options);
            else
                var x = execute(expression);
        } catch (ex) {
            liberator.echoerr(ex);
        }
    }, extra, true);
}

var dispose = [];
dispose.__defineSetter__("$push", function (v) this.push(v));

{
    let patch = function (obj, name, callback, context) {
        let code = obj[name].toString();
        obj[name] = liberator.eval("(" + callback(code) + ")", context || obj[name]);
        dispose.$push = function () delete obj[name];
    };

    let src = "else if (/\\.css$/.test(filename)) {";
    patch(io, "source", function (s) s.replace(src, `
        else if (/\.coffee$/.test(filename)) {
            plugins.coffeeScript.loadScript(uri.spec, Script(file));
        ` + src));

    patch(liberator, "loadPlugins", function (s) s
        .replace("js|vimp", "js|vimp|coffee")
        .replace("{js,vimp}", "{js,vimp,coffee}", "g"));

    window.setTimeout(function () liberator.loadPlugins(), 0);
}
delete dispose.$push;

function onUnload() {
    var f;
    while (f = dispose.pop()) f();
}
