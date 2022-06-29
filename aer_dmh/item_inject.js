let MODULE_NAME = "aer_dmh/item_inject.js";

let script_id = "aer_dmh_item_script";

if(!document.getElementById(script_id)){
  let s = document.createElement("script");
  s.id = script_id;
  (document.head || document.documentElement).appendChild(s);


  s.onload = function(){
    debug_log("Page script injected");

    chrome.storage.sync.get((data) => {
      document.dispatchEvent(new CustomEvent('aer_dmh_item_injected', {detail: {settings: data}}));
    });

    chrome.storage.sync.onChanged.addListener((changes, areaName) => {
      document.dispatchEvent(new CustomEvent('aer_dmh_settings_changed', {
        detail: {
          changes: changes,
          areaName: areaName
        }
      }));
    });
  };

  s.src = chrome.runtime.getURL("item_page_script.js");
}

function debug_log(...data){
  chrome.storage.sync.get("debug_logging", (d) => {
    if(d.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  });
}
