// vim: set sw=4 ts=4 et :
var INFO = //{{{
xml`<plugin name="profile-javascript" version="0.0.2"
        href="http://github.com/caisui/vimperator/blob/master/plugin/profile-js.js"
        summary="profile javascript"
        xmlns="http://vimperator.org/namespaces/liberator">
    <author href="http://d.hatena.ne.jp/caisui">caisui</author>
    <license href="http://www.opensource.org/licenses/bsd-license.php">New BSD License</license>
    <project name="Vimperator" minVersion="3.0"/>
    <item>
        <tags>:profilejs :pjs</tags>
        <description>
            <p>実行したjavascript の profile 結果を 表示</p>
        </description>
    </item>
</plugin>`;
//}}}
let jsd = services.get("debugger");

function print() {
    let list = [];

    jsd.enumerateScripts({enumerateScript: function(script) {
        if (script.callCount) {
            try{
            list.push({
                functionName:script.functionName,
                callCount:script.callCount,
                maxOwnExecutionTime:script.maxOwnExecutionTime,
                totalExecutionTime:script.totalExecutionTime,
                totalOwnExecutionTime:script.totalOwnExecutionTime,
                functionSource:script.functionSource,
                fileName: script.fileName,
                line: script.lineExtent
            });
            }catch(ex){liberator.echoerr(ex);}

            script.clearProfileData();
        }
    }});

    list.sort(function (a, b) b.totalOwnExecutionTime - a.totalOwnExecutionTime);

    style = xml`<style><![CDATA[
        tr {
            border-bottom: 1px solid gray;
            background-color: white;
        }
        tr:nth-child(odd) {
            background-color: #eee;
        }
        tr:hover {
            background-color: rgba(255,255, 222, .8);
        }
        thead tr.h {
            background-color: black;
            color: white;
            font-weight: bold;
        }
        .a {
            position: relative;
        }
        .i {
            display: none;
            position: absolute;
            background-color: rgba(255, 255, 240, .9);
            right:1px;
            padding: 0.5em;
            border: 1px solid black;
            -moz-border-radius: 4px;
        }
        .a:hover .i {
            display: block;
        }
        .a a {
            color: blue;
        }
    ]]></style>`;
    head = xml`<thead><tr class="h">
        <th>functionName         </th>
        <th>callCount            </th>
        <th>maxOwnExecutionTime  </th>
        <th>average own Time</th>
        <th>totalOwnExecutionTime</th>
        <th>totalExecutionTime   </th>
        <th colspan="0">inf</th>
    </tr></thead>`;
    function f(v) {
        v = v.toFixed(2);
        while (v !== (v = v.replace(/^(\d+)(\d{3})/, "$1,$2")));
        return v;
    }
    let body = template.map(list, function (script) xml`<tr>
            <td>${script.functionName}</td>
            <td align="right">${script.callCount}</td>
            <td align="right">${f(script.maxOwnExecutionTime)}</td>
            <td align="right">${f(script.totalOwnExecutionTime/script.callCount)}</td>
            <td align="right">${f(script.totalOwnExecutionTime)}</td>
            <td align="right">${f(script.totalExecutionTime)}</td>
            <td><a href=${script.fileName}>*</a></td>
            <td class="a">#<div class="i">
            <span><a href=${script.fileName}>${script.fileName}</a>:${script.line}</span>
            <pre>${script.functionSource}</pre>
            </div></td>
        </tr>`);

    let src = style + xml`<tablel>${head}<tbody>${body}</tbody></tablel>`;
    var doc = commandline._multilineOutputWidget.contentDocument;
    doc.body.innerHTML = "";
    var r = doc.createRange();
    r.selectNode(doc.body);
    //doc.body.insertAdjacentHTML("afterbegin", xml.toXMLString());
    doc.body.appendChild(r.createContextualFragment(src.toString()));
    commandline.updateOutputHeight(true);
    modes.set(modes.COMMAND_LINE, modes.OUTPUT_MULTILINE);
}

function executeProfile(str, off) {
    try {
        jsd.flags |= jsd.COLLECT_PROFILE_DATA;
        liberator.eval(str);
        jsd.flags &= ~jsd.COLLECT_PROFILE_DATA;

        print();
    } catch (ex) {
        liberator.echoerr(ex);
    } finally {
        if (off) jsd.off();
    }
}

commands.addUserCommand(["profilejs", "pjs"], "profile javascript", function (args) {
    let str = args[0];
    if ("-file" in args) {
        str = File(args["-file"]).read();
    }
    if (jsd.isOn)
        executeProfile(str);
    else if ("asyncOn" in jsd) {
        jsd.asyncOn({
            onDebuggerActivated: function () {
                executeProfile(str, true);
            }
        });
    } else {
        jsd.on();
        executeProfile(str, true);
    }
}, {
    literal: 0,
    completer: completion.javascript,
    options: [
        [["-file"], commands.OPTION_STRING, null, function (context) {
            context = context.fork("file", 0);
            completion.file(context);
            return [];
        }],
    ],
}, true);
