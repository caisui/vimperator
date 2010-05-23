//optionSelector.js
(function(){
	const autoShowComplete = 1;
	//Register.add("s",function(){ selectInput();return "";});
	//mappings.addUserMap([modes.INSERT],["<C-s>"],"select completer",function() selectInput());
  (function () {
    let map = mappings.get(modes.INSERT, "<C-i>");
    if(!map) return;

    let action = map.action;
    map.action = function () {
      if(is(liberator.focus, HTMLSelectElement)) selectInput(liberator.focus);
      else action.call(this, arguments);
    };
  })();
	
  function has(a,b) (b in a)
	function is(a,b) a instanceof b
	function selectInput(elem) {
		if(!elem) elem = liberator.focus;
		if(!is(elem,HTMLSelectElement)) return;
		commandline.input("select input:",function(arg){
			let selected = /^(\d+)/.exec(arg.trim())[1];
			if(!selected) return;

			elem.selectedIndex = selected;
			//let evt=events.create(elem.ownerDocument,"change");
			let evt = elem.ownerDocument.createEvent("HTMLEvents");
			evt.initEvent("change",true,true);
			elem.dispatchEvent(evt);
		},{
			completer:function(context){
        context.filter = context.filter.trim();
        if(has(window,"migemo")){
					let re = window.migemo.getRegExp(context.filter,"i");
					context.match = function(str) re.test(str); 
				}else{
          context.match = function(str) str.indexOf(this.filter)>=0;
        }
				context.completions = [[" ",""]].concat([ [<>{i}:{let(s=opt.parentNode.label) s? (s+"/"):""}{opt.text}</>,opt.value]
					for([i,opt] in Iterator(elem.options)) if(!opt.disabled && !opt.parentNode.disabled)
				]);
			},onCancel:function(){
				window.setTimeout(function() elem.focus(),0);
			}
		});
		autoShowComplete&&commandline._tabTimer.tell({shitKey:false});
	}
})();
