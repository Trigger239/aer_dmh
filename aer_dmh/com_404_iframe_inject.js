let MODULE_NAME = "aer_dmh/com_404_iframe_inject.js";

if(window.location !== window.parent.location){
  debug_log("In iframe");
  
  window.stop();

  let script_id = "aer_dmh_com_404_script";

  if(!document.getElementById(script_id)){
    let s = document.createElement("script");
    s.id = script_id;
    (document.documentElement || document.head).appendChild(s);

    s.onload = function(){
      debug_log("Iframe script injected");
          chrome.storage.sync.get((data) => {
          
      window.postMessage({
          type: "aer_dmh_com_404_iframe_injected",
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
      
      window.parent.postMessage({
        type: "aer_dmh_com_404_iframe_loaded",
      }, "https://aliexpress.ru");
    };

    s.src = chrome.runtime.getURL("com_404_iframe_script.js");
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