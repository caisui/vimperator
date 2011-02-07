// vim: et :
(function(){
  function hintList(bang) [
    [mode,hint.prompt] for([mode,hint] in Iterator(hints._hintModes))
      if(bang || mode.length > 1)
  ];
  
  commands.addUserCommand(["hint"],"exec hint.show",function(args){
    let arg=args[0];
    if(!arg){
      commandline.echo(template.table("hints",hintList(args.bang)), commandline.HL_NORMAL, commandline.FORCE_MULTILINE);
    }else if(arg in hints._hintModes) hints.show(arg);
    else liberator.echoerr(<>{arg} is not exist!</>.toString());
  },{
    literal:1,
    bang:true,
    completer:function(context,args){ context.completions = hintList(args.bang); }
  },true);
})();
