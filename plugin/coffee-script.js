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

var {File} = io;
var defaultPath = "~/vimperator/coffee-script.js";

this.__defineGetter__("CoffeeScript", function () {
    delete this.CoffeeScript;
    services.get("scriptloader").loadSubScript(
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
