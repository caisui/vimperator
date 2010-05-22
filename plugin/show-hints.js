// vim:set fdm=marker:
(function(self){
	const info = (function(){
		var list = [];
		function setLayout(s1,s2){
			var a = [];
			for(let[i,v] in Iterator(s1)){
				a.push([v,s2[i]]);
			}
			list.push(a);
		}
		setLayout("1234567890-^\\","!\"#$%&'() =~|");
		setLayout("qwertyuiop@[","QWERTYUIOP`{");
		setLayout("asdfghjkl;:]","ASDFGHJKL+*}");
		setLayout("zxcvbnm,./\\","ZXCVBNM<>?_");
		return list;
	})();

	const style = (function() //{{{ style sheet
	{
		let b="{",e="}";
		return <style>
			#kb{b}
				font-size:3em;
			{e}
			ul{b}
				list-style-type:none;
				margin:0;
			{e}
			div.k{b}
				border: 1px solid gray;
				-moz-border-radius: 0.2em;
				float: left;
				margin: 1px 2px;
				padding: 0 2px;
				width:1em;
			{e}
			.c{b}
				clear:both;
			{e}
			span.e{b}
				color: rgba(0,0,0,1);
			{e}
			span.d{b}
				color: rgba(0,0,0,0.5);
			{e}
			span.tip{b}
				position:relative;
				display:none;
			{e}
			span.tip span{b}
				position:absolute;
				font-size:0.5em;
				background-color: rgba(255,255,255,0.7);
				border: 1px solid black;
				-moz-border-radius: 4px;
				top:-0.5em;
				color:black;
				padding: 2px 1em;
			{e}
			span.e:hover{b}
				color:blue;
			{e}
			span.e:hover span.tip{b}
				display:inline-block;
			{e}
			#kb ul:last-child div span.e:hover span.tip{b}
				top: -1em;
			{e}
		</style>;
	})();//}}}

	commands.addUserCommand(["showhints"],"show mapping",function(){
		const hintModes = hints._hintModes || liberator.eval("hintModes",hints.addMode);
		let xml = <ul id="kb"></ul>;
		function createSpan(char){
			let hint = hintModes[char];
			return <span class={hint ? "e":"d"}>{char}{hint ? <span class="tip"><span>{hint.prompt}</span></span>:<></>}</span>;
		}
		xml.* += style;
		for(let [i,charlist] in Iterator(info)){
			let style = <>padding-left:{i*0.5}em;</>;
			let li = <li style={style}></li>;
			for(let [,[c1,c2]] in Iterator(charlist)){
				li.* += <div class='k'>{createSpan(c1)}{createSpan(c2)}</div>;
			}
			li.* +=<li class="c"></li>;
			xml.* += <ul>{li}</ul>;
		}
		liberator.echo(xml);
	},null,true);
})(this)
;
