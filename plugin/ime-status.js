(function(self){
  if(!window.gIMEController) return;
  const status_id="liberator-statusline";
  const id=status_id + "-field-ime";
  const o_id = "@"+self.NAME;
  const eventName = "input";//"keypress";

  let(obj=userContext[o_id]){
    obj && obj.uninstall && obj.uninstall();
  }

  //あ,3042,ア,30a2,Ａ,ff21,ｱ,ff71
  const res ={
    ALPHANUMERIC_HALF      : "-A",
    JAPANESE_HIRAGANA      : "\u3042",//あ
    JAPANESE_KATAKANA_FULL : "\u30a2",//ア
    ALPHANUMERIC_FULL      : "\uff21",//Ａ
    JAPANESE_KATAKANA_HALF : "-\uff71",//-ｱ
    UNKNOWN                : "??",
    KOREAN                 : "KR",
    CHINESE                : "CN",
  };
  let elm = document.createElement("label");
  elm.setAttribute("id", id);
  elm.setAttribute("class", "plain");
  document.getElementById(status_id).appendChild(elm);

  let obj = {
    install:function(){
      function update_imestatus(event){
        elm.setAttribute("value", gIMEController.enabled
          ? "[" + res[gIMEController.conversion] + "]" : "[--]");
      }
      window.addEventListener(eventName, update_imestatus, true);
      this.uninstall=function(){
        elm.parentNode.removeChild(elm);
        window.removeEventListener(eventName, update_imestatus, true);
        liberator.echo("uninstall");
      };
      update_imestatus();
      return this;
    }
  };
  userContext[o_id] = obj.install();
})(this);
