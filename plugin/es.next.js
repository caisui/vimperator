// vim: set sw=4 ts=4 fdm=marker et :
var INFO = //{{{
<plugin name="ES.next" version="0.0.3"
        href="http://github.com/caisui/vimperator/blob/master/plugin/es.next.js"
        summary="ES.next"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <description>
            let's ES.next

            <note>
                <link xmlns={XHTML} target="_blank" href="https://raw.github.com/Constellation/iv/master/misc/es.next.js">es.next.js</link>が必要です。
            </note>
        </description>
    </item>
</plugin>;
//}}}
(function () {
    //http://teramako.github.com/ECMAScript/ecma6th_syntax.html

    var defaultPath = "~/vimperator/es.next.js";
    function lazyGetter(obj, name, callback) {
        obj.__defineGetter__(name, function _callback() {
            delete this[name];
            return this[name] = callback.call(this);
        });
    }

    lazyGetter(this, "Parser", function () {
        let file = File(liberator.globalVariables.es_next_js || defaultPath);
        services.get("subscriptLoader").loadSubScript(
            services.get("io").newFileURI(file).spec + "?" + file.lastModifiedTime, this);
        return this.Parser;
    });
    lazyGetter(this, "_sealedFunc", function () {
        var _sealedFunc = (function sealedFunc(obj) {
            //var keys = Object.getOwnPropertyNames(obj);
            var keys = Object.keys(obj);
            var desc;
            for (var i = 0, j = keys.length; i < j; i++) {
                desc = Object.getOwnPropertyDescriptor(obj, keys[i]);
                desc.configurable = false;

                Object.defineProperty(obj, keys[i], desc);
            }
            return Object.preventExtensions(obj);
        }).toSource();
        return _sealedFunc;
    });
    lazyGetter(this, "_protoOperator", function () {
        var _protoOperator = (function _protoOperator(proto, obj) {
            var properties = {};
            while (obj) {
                Object.getOwnPropertyNames(obj).forEach(function (name) {
                    if (name in properties);
                    else {
                        properties[name] = Object.getOwnPropertyDescriptor(obj, name);
                    }
                });
                obj = obj.__proto__;
            }

            return Object.create(proto, properties);
        }).toSource();
        return _protoOperator;
    });
    lazyGetter(this, "_forOfStatement", function () {
        return (function _forOfStatement(obj){
            for (var i = 0, j = obj.length; i < j; i++) {
                yield obj[i];
            }
        }).toSource();
    });

    function $q(str) '"' + str + '"'
    function $br(str) '(' + str + ')'
    function $sealed(str) _sealedFunc + "(" + str + ")"
    function $protoOperator(proto, obj) _protoOperator + "(" + proto + "," + obj + ")"
    function $forOfStatement(enumerable) _forOfStatement + "(" + enumerable + ")"

    function compile(expression, context) {
        try {
            var ps = new Parser(expression);
            var stmt = ps.parse();
        } catch (ex) {
            ex.message += <>: value = "{ps.lexer.value}" next = "{ps.lexer.current.substring(0, 128)}"</>;
            throw ex;
        }
        return _compile(stmt);
    }

    function execute(expression, context) {
        return liberator.eval(compile(expression), context || userContext);
    }

    let extra = {
        literal: 0,
        argCount: "?",
        completer: completion.javascript,
        hereDoc: true,
    };

    let cmd = commands.addUserCommand(["ecmascript", "es"], "Run a ECMAScript  command through eval()", function (args) {
        try {
            if (args["--scratchpad"]) {
                plugins.scratchpad.callScratchPad({}, function () {
                    var notify = this.notificationBox;

                    // xxx: notificationbox 未実装なら勝手に追加
                    if (!notify) {
                        let box = this.editor._iframe.parentNode;
                        let doc = box.ownerDocument;
                        notify = doc.createElementNS(XUL, "notificationbox");
                        box.parentNode.insertBefore(notify, box);
                    }
                    this.run = function () {
                        var selection = this.selectedText || this.getText();
                        try {
                            var box = notify.getNotificationWithValue("ESParserError");
                            if (box) box.close();

                            selection = compile(selection);
                        } catch (ex) {
                            Cu.reportError(ex);
                            notify.appendNotification(ex, "ESParserError", null, notify.PRIORITY_CRITICAL_LOW);
                            return [selection, ex, null];
                        }
                        //liberator.echo(<pre>{selection}</pre>);
                        var [error, result] = this.evalForContext(selection);
                        this.deselect();
                        return [selection, error, result];
                    };
                    notify.appendNotification("ES.next Mode");
                });
                return;
            }
            var expression = args["--file"] ? File(args["--file"]).read() : args[0];

            if (args["--test"])
                liberator.echo(<pre>{compile(expression)}</pre>);
            else if (args["--ast"]) {
                liberator.echo(<pre>{JSON.stringify(new Parser(expression).parse(), null, "    ")}</pre>);
            } else {
                var t = Date.now();
                var scope = args["--bare"] ? userContext : ({__proto__: userContext});
                var result = execute(expression, scope);
                if (args["--echo"])
                    liberator.echo(CommandLine.echoArgumentToString(result, true));
                else if (args["--time"])
                    liberator.echo((Date.now() - t) / 1000 + " sec");
            }
        } catch (ex) {
            liberator.echoerr(ex);
        }
    }, extra, true);

    //completer 時に 組み込み
    lazyGetter(cmd, "options", function () {
        let options = [
            [["--ast",  "-a"], commands.OPTION_NOARG],
            [["--test", "-t"], commands.OPTION_NOARG],
            [["--echo", "-e"], commands.OPTION_NOARG],
            [["--bare", "-b"], commands.OPTION_NOARG],
            [["--time"],       commands.OPTION_NOARG],
            [["--file"],       commands.STRING, null, function(c) {completion.file(c.fork("file", 0)); return []}],
        ];
        if (plugins.scratchpad)
            options.push([["--scratchpad"], commands.OPTION_NOARG]);

        return options;
    });

    // {{{ BindingRestElement
    function getBindingRestElement(stmt) {
        switch (stmt.type) {
        case "ArrayBindingPattern":
        case "ObjectBindingPattern":
            for (var i = 0, j = stmt.patterns.length; i < j; i++) {
                var result = getBindingRestElement(stmt.patterns[i]);
                if (result) return result;
            }
            return null;
        case "BindingRestElement":
            return stmt;
        case "BindingProperty":
            return getBindingRestElement(stmt.val);
        case "Identifier":
        case "Elision":
            return null;
        default:
            throwStatement(stmt);
        }
    }
    function arrayBindingPatternMap(stmt, num) {
        switch (stmt.type) {
        case "Elision":
            return "";
        case "Identifier":
            return "obj[" + num + "]";
        case "BindingRestElement":
            return "Array.slice(obj, " + num + ")";
        default:
            return getRestHack(stmt, "obj[" + num + "]");
        }
    }

    function getRestHack(stmt, obj) {
        switch (stmt.type) {
        case "Elision":
            return "";
        case "Identifier":
            if (getBindingRestElement(stmt)) return obj;
            else return $q(stmt.value) + ": obj[" + $q(stmt.value) + "]";
        case "BindingProperty":
            return $q(stmt.key.value) + " : " + getRestHack(stmt.val, "obj[" + $q(stmt.key.value) + "]");
        case "ObjectBindingPattern":
            if (getBindingRestElement(stmt))
                return "(function (obj) { return { "
                    + stmt.patterns.map(getRestHack).join(", ")  + "};})(" + obj + ")";
            else _compile(stmt);
        case "ArrayBindingPattern":
            return "(function (obj) {"
                + "return [" + stmt.patterns.map(arrayBindingPatternMap).join(", ")  + "];})(" + obj + ")";
        }
    }
    //}}}

    // {{{ AST to JavaScript

    function throwStatement(stmt) {
        throw new Error(JSON.stringify(stmt, null, "    "));
    }
    var stack = []; // 括弧付与判定のため
    var post;
    function _compile(stmt, extra) {

        // ArrayHole?
        if (stmt === null) return "";
        var s = "";
        var s1, s2;
        var ts = "/*" + stmt.type + "*/ ";
        var EOL = ";\n";

        stack.push(stmt);
        switch(stmt.type) {
        case "global":
            s = stmt.body.map(_compile).join("\n");
            break;
        case "Declaration":
            var ex = {call: function (s) {return s;}};
            if (stmt.val)
                s = _compile(stmt.key, ex) + " = " + ex.call(_compile(stmt.val));
            else
                s = _compile(stmt.key, ex);
            break;
        case "Undefined":
            s = "undefined/*type*/";
            break;
        case "VariableStatement":
            s = "var " + stmt.body.map(_compile).join(" , ") + ";";
            break;
        case "LetDeclaration":
            s = "let " + stmt.body.map(_compile).join(" , ") + ";";
            break;
        case "ConstDeclaration":
            s = "const " + stmt.body.map(_compile).join(" , ") + ";";
            break;
        case "ExpressionStatement":
            s = _compile(stmt.expr) + ";";
            break;
        case "WithStatement":
            s = "with (" + _compile(stmt.expr) + ") " + _compile(stmt.body);
            break;
        case "TryStatement":
            s = "try " + _compile(stmt.block);
            if (stmt.catchBlock) {
                s += "catch (" + _compile(stmt.catchBlock.name) + ") " + _compile(stmt.catchBlock.block);
            }
            if (stmt.finallyBlock) {
                s += "finally " + _compile(stmt.finallyBlock.block);
            }
            break;
        case "ThrowStatement":
            s = "throw " + _compile(stmt.expr) + ";";
            break;
        case "DebuggerStatement":
            s = "debugger" + ";";
            break;
        case "Assignment":
        case "BinaryExpression":
            var op = stmt.op;

            //xxx: 代替手段がわからない
            switch (op) {
            case "is":
                op = "===";
                break;
            case "isnt":
                op = "!==";
                break;
            }
            s = _compile(stmt.left) + " " + op + " " + _compile(stmt.right);

            //括弧付与
            var pre = stack[stack.length -2];
            if ((pre && "op" in pre && pre.op !== ",")
                || (pre.type === "PropertyAccess"))
                    s = $br(s);
            break;
        case "PostfixExpression":
            s = _compile(stmt.expr) + stmt.op;
            break;
        case "UnaryExpression":
            s = stmt.op + " " + _compile(stmt.expr);
            break;
        case "String":
            s = $q(stmt.value);
            break;
        case "Number":
        case "Identifier":
            s = stmt.value;
            break;
        case "True":
            s = "true";
            break;
        case "False":
            s = "false";
            break;
        case "WhileStatement":
            s = "while (" + _compile(stmt.cond) + ")\n" + _compile(stmt.body);
            break;
        case "DoWhileStatement":
            s = "do " + _compile(stmt.body) + "while (" + _compile(stmt.cond) + ")";
            break;
        case "ForStatement":
            // xxx: ExpressionNoInopt でなくて ExpressionStatement が来る
            s = "for (" + _compile(stmt.init).replace(/;$/, "")
                + ";" + _compile(stmt.cond)
                + ";" + _compile(stmt.next).replace(/;$/, "") + ")\n"
                + _compile(stmt.body);
            break;
        case "ForInStatement":
            // xxx: LeftHandSideExpression でなくて ExpressionStatement が 来る
            s = "for (" + _compile(stmt.init).replace(/;$/, "")
                + " in " + _compile(stmt.enumerable) + ")\n"
                + _compile(stmt.body);
            break;
        case "ForOfStatement":
            // xxx: LeftHandSideExpression でなくて ExpressionStatement が 来る
            s = "for (" + _compile(stmt.init).replace(/;$/, "")
                + " in " + $forOfStatement(_compile(stmt.enumerable)) + ")\n"
                + _compile(stmt.body);
            break;
        case "SwitchStatement":
            s = "switch(" + _compile(stmt.expr) + ") {\n"
                + stmt.clauses.map(_compile).join("\n") + "\n}\n";
            break;
        case "Caluse":
            switch (stmt.kind) {
            case "case":
                s = stmt.kind + " " + _compile(stmt.expr) + ":\n"
                    + stmt.body.map(_compile).join("\n");
                break;
            case "default":
                s = stmt.kind + " " + ":\n"
                    + stmt.body.map(_compile).join("\n");
                break;
            default:
                throwStatement(stmt);
            }
            break;
        case "BreakStatement":
            s = "break" + (stmt.label ? " " + _compile(stmt.label) :  "") + ";";
            break;
        case "ContinueStatement":
            s = "continue" + (stmt.label ? " " + _compile(stmt.label) :  "") + ";";
            break;
        case "Block":
            s = "{\n" + stmt.body.map(_compile).join("\n") + "\n}\n";
            break;
        case "FunctionDeclaration":
            s = _compile(stmt.func);
            break;
        case "Function":
            switch (stmt.kind) {
            case "DECL":
            case "EXP":
                [s1, s2] = compileFunctionParameters(stmt.params);
                s = "function " + (stmt.name || "") + "(" + s1 + ") {\n";
                if (s2) s += s2 + ";\n";
                s += stmt.body.map(_compile).join("\n") + "\n}";

                var pre = stack[stack.length - 2];
                if (pre && stmt.kind === "EXP" && pre.type === "FuncCall") s = $br(s);
                break;
            default:
                throwStatement(stmt);
            }
            break;
        case "GeneratorExpression":
            switch (stmt.kind) {
            case "DECL":
            case "EXP":
                [s1, s2] = compileFunctionParameters(stmt.params);
                s = "function " + (stmt.name || "") + "(" + s1 + ") {\n";
                if (s2) s += s2 + ";\n";
                s += stmt.body.map(_compile).join("\n") + "\n}";

                var pre = stack[stack.length - 2];
                if (pre && stmt.kind === "EXP" && pre.type === "FuncCall") s = $br(s);
                break;
            default:
                throwStatement(stmt);
            }
            break;
        case "LabelledStatement":
            s = _compile(stmt.expr) + ":" + _compile(stmt.body);
            break;
        case "ReturnStatement":
            s = "return " + _compile(stmt.expr) + ";";
            break;
        case "FuncCall":
            s = _compile(stmt.target) + "(" + stmt.args.map(_compile).join(",") + ")";
            break;
        case "ConditionalExpression":
            s = _compile(stmt.cond) + " ? " + _compile(stmt.left) + " : " + _compile(stmt.right);
            break;
        case "IfStatement":
            s = "if (" + _compile(stmt.cond) + ")" + _compile(stmt.then);
            if (stmt.else) {
                s += "\nelse\n" + _compile(stmt.else);
            }
            break;
        case "EmptyStatement":
            s = ";"
            break;
        //Object
        case "Object":
            s = "({\n"
                + stmt.values.map(function (value) {
                    return value.key + ":" + _compile(value.val);
                }).join(",\n") + ","
                + stmt.accessors.map(_compile).join("\n")
            + "\n})";
            if (stmt.sealed) s = $sealed(s);
            break;
        case "Accessor":
            //xxx: ??
            switch (stmt.kind) {
            case "getter":
                s = "get " + stmt.name + _compile(stmt.func).replace("function");
                break;
            case "setter":
                s = "set " + stmt.name + _compile(stmt.func).replace("function");
                break;
            default:
                throwStatement(stmt);
            }
            break;
        case "PropertyAccess":
            // xxx: obj[xxx] と obj.xxx の 区別がつかないので
            if (stmt.key.type === "Identifier")
                s = _compile(stmt.target) + '.' + stmt.key.value;
            else
                s = _compile(stmt.target) + '[' + _compile(stmt.key) + "]";

            //xxx: Super
            if (post && post.type === "Super") {
                var pre = stack[stack.length -2];
                if (pre && pre.type === "FuncCall") {
                    //pre.args = [{type:"Identifier", value: "this"}].concat(pre.args);
                    //s += ".call";
                    s += ".bind(this)"
                }
            }
            break;
        case "This":
            s = "this";
            break;
        case "Super":
            s = "this.__proto__";
            break;
        case "Array":
            s = "[" + stmt.items.map(_compile).join(", ") + "]";
            if (stmt.sealed) s = $sealed(s);
            break;
        case "RegExp":
            s = "/" + stmt.value + "/" + stmt.flags;
            break;
        case "AssignmentPattern":
            s = _compile(stmt.pattern, extra);
            break;
        case "ArrayAssignmentPattern":
            s = "[" + stmt.patterns.map(_compile) + "]";
            break;
        case "ArrayBindingPattern":
            if (extra && getBindingRestElement(stmt)) {
                extra.call = function (s) {
                    return getRestHack(stmt, s);
                };
            }
            s = "[" + stmt.patterns.map(_compile) + "]";
            break;
        case "ArrayComprehension":
            s = "[" + _compile(stmt.expression) + " " + stmt.comprehensions.map(_compile).join(" ")
                + (stmt.filter ? " if (" + _compile(stmt.filter) + ")" : "") + "]";
            break;
        case "ComprehensionBlock":
            //xxx: of statement が 未実装のため
            //s = "for (" + _compile(stmt.left).replace(/;$/, "") + " of " + _compile(stmt.right).replace(/;$/, "") + ")";
            s = "for (" + _compile(stmt.left).replace(/;$/, "") + " in " + $forOfStatement(_compile(stmt.right)).replace(/;$/, "") + ")";
            break;
        case "Elision":
            s = "";
            break;
        case "ObjectBindingPattern":
            if (extra && getBindingRestElement(stmt)) {
                extra.call = function (s) {
                    return getRestHack(stmt, s);
                };
            }
            s = "{" + stmt.patterns.map(_compile) + "}";
            break;
        case "BindingProperty":
            s = _compile(stmt.key) + " : " + _compile(stmt.val);
            break;
        case "BindingRestElement":
            s = _compile(stmt.name);
            break;
        case "RestParameter":
            s = _compile(stmt.name);
            break;
        case "NewCall":
            s = "new " + _compile(stmt.target) + "(" + stmt.args.map(_compile).join(",") + ")";
            break;
        //http://wiki.ecmascript.org/doku.php?id=harmony:proto_operator
        case "ProtoLiteral":
            //xxx: ???
            s = $protoOperator(_compile(stmt.target), _compile(stmt.proto));
            break;
        default:
            throwStatement(stmt);
        }
        post = stack.pop();
        if (1) return s;
        else return "(" + ts + s + ")";
    }

    function getFarstIdentifier(stmt) {
        switch (stmt.type) {
        case "ArrayBindingPattern":
        break;
        }
        throwStatement(stmt);
    }

    function compileFunctionParameters(params) {
        var len = params.length;
        var p = [];
        var b = [];
        var stmt;
        var ex;
        function pass(s) {return s;}
        if (len === 0) return ["", ""];
        else if (params[len -1].type === "RestParameter") {
            len--;
            b.push("var " + _compile(params[len]) + " = Array.slice(arguments, " + len + ")");
        }
        for (var i = 0; i < len; i++) {
            stmt = params[i];
            if (stmt.type === "ArrayBindingPattern"
                || stmt.type === "ObjectBindingPattern") {
                var rest = getBindingRestElement(stmt);
                if (rest) {
                    var val = _compile(rest);
                    p.push(val);
                    ex = {call: pass};
                    b.push("var " + _compile(stmt) + " = " + getRestHack(stmt, val));
                } else {
                    p.push("[" + stmt.patterns.map(_compile) + "]");
                }
            } else {
                p.push(_compile(stmt));
            }
        }
        return [p.join(", "), b.join(";\n")];
    }
    //}}}
}).call(this);
