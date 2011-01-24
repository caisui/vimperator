// vim: set sw=4 ts=4 et :
var INFO = //{{{
<plugin name="profile-javascript" version="0.0.1"
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
</plugin>;
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

    let xml = <table/>;
    xml.* += <style><![CDATA[
        tr:nth-child(odd) {
            background-color: #eee;
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
            left:1px;
            padding: 0.5em;
            border: 1px solid black;
            -moz-border-radius: 4px;
        }
        .a:hover .i {
            display: block;
        }
    ]]></style>;
    xml.* += <thead><tr class="h">
        <th>functionName         </th>
        <th>callCount            </th>
        <th>maxOwnExecutionTime  </th>
        <th>average own Time</th>
        <th>totalOwnExecutionTime</th>
        <th>totalExecutionTime   </th>
        <th>inf</th>
    </tr></thead>;
    for(let [,script] in Iterator(list))
        xml.* += <tr>
            <td>{script.functionName}</td>
            <td>{script.callCount}</td>
            <td>{script.maxOwnExecutionTime}</td>
            <td>{script.totalOwnExecutionTime/script.callCount}</td>
            <td>{script.totalOwnExecutionTime}</td>
            <td>{script.totalExecutionTime}</td>
            <td class="a"><div class="i">
            <span>{script.fileName}:{script.line}</span>
            <pre>{script.functionSource}</pre>
            </div></td>
        </tr>;
    liberator.echo(xml);
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
}, true);
