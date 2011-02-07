(function () {
  let hintMode = liberator.globalVariables.zoomNode || "z";
  let dataschema = "data:text/css,";
  let list = ["div", "iframe", "table", "textarea", "ul", "ol", "pre"];
  const vimpZoomAttr = "vimp-zoom";
  const vimpZoomScreenAttr = vimpZoomAttr + "-screen";

  let zoomNodeStyle = <><![CDATA[
    [@attr] {
      position: fixed !important;
      left: 1em !important;
      right: 1em !important;
      top: 1em !important;
      bottom: 1em !important;
      min-width: 95% !important;
      min-height: 95% !important;
      max-height: 100% !important;
      max-width: 100% !important;
      width: auto !important;
      height: auto !important;
      z-index: 60001 !important;
      -moz-box-shadow:5px 5px 10px #333;
      overflow: auto !important;
    }
    [@attr='1'],
    [@attr='2'] {
      padding: 0 !important;
      margin: 0 !important;
    }

    [@attr='1'] {
      background-color: white;
    }
    [@attr='2'] {
      background-color: black;
    }
    [@attr='3'] {
      background-color: white;
    }
    [@attr='4'] {
      background-color: black;
    }
    [@attr]>tbody {
      overflow: auto;
      width: 100%;
      height: 100%;
    }
    [@attrb] {
      position: fixed !important;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      background-color: rgba(255,255,255, 0.8);
      z-index: 60000;
    }
  ]]></>.toString()
    .replace(/@attrb/g, vimpZoomScreenAttr)
    .replace(/@attr/g, vimpZoomAttr)
  ;

  hints.addMode(hintMode, "zoom", function (elem, href, count) {
      try{
    let doc = elem.ownerDocument;
    let lastElem = doc.querySelector("["+ vimpZoomAttr + "]");

    if (lastElem)
      lastElem.removeAttribute(vimpZoomAttr);

    if (lastElem === elem && !count) {
      elem.removeAttribute(vimpZoomAttr);
      elem = doc.querySelector(<>[{vimpZoomScreenAttr}]</>);
      elem.parentNode.removeChild(elem);
    } else {
      if (!lastElem) {
        let div = elem.ownerDocument.createElement("div");
        div.setAttribute(vimpZoomScreenAttr, "");
        elem.ownerDocument.body.appendChild(div);
      }

      let selection = doc.defaultView.getSelection();
      let range = doc.createRange();
      range.setStart(elem, 0);
      selection.removeAllRanges();
      selection.addRange(range);
      elem.setAttribute(vimpZoomAttr, count || 1);
    }
      }catch(ex){liberator.echoerr(ex);}
  },
  hints._generate.toString().indexOf("__iterator__") < 0 ?
  function () util.makeXPath(list)
    :
  function (win) {
    try{
    let doc = win.document;
    let selector;
    let elem;
    let attr = <>[{vimpZoomAttr}] </>.toString();
    if (win.document.querySelector(attr)) {
      selector = attr + "," + [attr + v for([, v] in Iterator(list))].join(",");
    } else {
      selector = list.join(",");
    }
    return doc.querySelectorAll(selector);
    }catch(ex){liberator.echoerr(ex);$d.log(ex);}
  }
  );
  
  styles.addSheet(false, "zoom-node", "*", zoomNodeStyle);
})();
