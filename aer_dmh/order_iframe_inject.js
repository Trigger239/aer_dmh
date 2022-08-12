let MODULE_NAME = "aer_dmh/order_iframe_inject.js";

if(window.location !== window.parent.location){
  debug_log("In iframe");

  let script_id = "aer_dmh_order_script";

  if(!document.getElementById(script_id)){
    let s = document.createElement("script");
    s.id = script_id;
    (document.head || document.documentElement).appendChild(s);

    s.onload = function(){
      debug_log("Iframe script injected");
          chrome.storage.sync.get((data) => {
          
      window.postMessage({
          type: "aer_dmh_order_iframe_injected",
          detail: {settings: data},
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

    s.src = chrome.runtime.getURL("order_iframe_script.js");
  }
}
else{
  debug_log("Not in iframe, nothing to do");
}

function debug_log(...data){
  chrome.storage.sync.get("debug_logging", (d) => {
    if(d.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  });
}