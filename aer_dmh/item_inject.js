let MODULE_NAME = "aer_dmh/item_inject.js";

const script_id = "aer_dmh_item_script";
const iframe_id = "aer_dmh_freight_iframe";

if(!document.getElementById(script_id)){
  let s = document.createElement("script");
  s.id = script_id;
  (document.head || document.documentElement).appendChild(s);
  
  let ifr = document.createElement("iframe");
  ifr.style = "display: none";
  ifr.id = iframe_id;
  (document.head || document.documentElement).appendChild(ifr);

  s.onload = function(){
    debug_log("Page script injected");

    chrome.storage.sync.get((data) => {
      window.postMessage({
        type: "aer_dmh_item_injected",
        detail: {
          settings: data,
          loadingIconUrl: chrome.runtime.getURL("images/loading.svg")
        },
      }, window.origin);
    });

    chrome.storage.sync.onChanged.addListener((changes, areaName) => {
      window.postMessage({
        type: "aer_dmh_settings_changed",
        detail: {
          changes: changes,
          areaName: areaName
        },
      }, window.origin);
    });
  };
  s.src = chrome.runtime.getURL("item_page_script.js");
  
  function post_loaded_msg(){
    window.postMessage({
        type: "aer_dmh_freight_iframe_loaded",
      }, window.origin);
  }
  
  chrome.storage.sync.get("request_method", (data) => {
    switch(data.request_method){
    case "order":
      ifr.onload = post_loaded_msg;
      ifr.src = "https://shoppingcart.aliexpress.ru/orders.htm";
      break;
    
    case "com_404":
    default:
      //Use postMessage() because of window.stop() on com_404 page
      window.addEventListener("message", (e) => {
        if(e.source === ifr.contentWindow && e.data && e.data.type)
          if(e.data.type === "aer_dmh_com_404_iframe_loaded"){
            post_loaded_msg();
          }
      });
      ifr.src = "https://www.aliexpress.com/p/error/404.html"
    }
  });
}

function debug_log(...data){
  chrome.storage.sync.get("debug_logging", (d) => {
    if(d.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  });
}
