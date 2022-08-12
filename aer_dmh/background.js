let MODULE_NAME = "aer_dmh/background.js";

let default_settings = {
  enabled_item: true,
  enabled_wholesale: true,
  show_total_cost: true,
  wholesale_popup_timeout: 300,
  debug_logging: false,
  request_method: "com_404",
};

function restore_default_settings(cb){
  chrome.storage.sync.set(default_settings, function(){
    debug_log("Default settings saved in storage");
    if(cb)
      cb();
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get((data) => {
    let wrong_or_missing_values = {};
    for(let [key, val] of Object.entries(data)){
      if(default_settings.hasOwnProperty(key)){
        if((typeof val) != (typeof default_settings[key])){
          //different type
          wrong_or_missing_values[key] = default_settings[key];
        }
      }
      else{
        //no such key in default_settings
        chrome.storage.sync.remove(key);
      }
    }

    for(let [key, val] of Object.entries(default_settings)){
      if(!data.hasOwnProperty(key)){
        wrong_or_missing_values[key] = default_settings[key];
      }
    }
    chrome.storage.sync.set(wrong_or_missing_values);
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  if(request.type === "restore_defaults"){
    restore_default_settings(function(){
      sendResponse();
    });
    return true;
  }
});

function debug_log(...data){
  chrome.storage.sync.get("debug_logging", (d) => {
    if(d.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  });
}
