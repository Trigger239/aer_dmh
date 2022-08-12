(function(){
  let MODULE_NAME = "aer_dmh/login_iframe_script.js";
  
  let settings;
  
  window.addEventListener("message", (e) => {
    if(e.source === window && e.data && e.data.type){
      if(e.data.type === "aer_dmh_login_iframe_injected")
        on_injected(e.data.detail);
      else if(e.data.type === "aer_dmh_settings_changed")
        on_settings_changed(e.data.detail);
    }
  });

  function on_settings_changed(data){
    let changes = data.changes;
    for(let [key, {oldValue, newValue}] of Object.entries(changes)){
      settings[key] = newValue;
    }
  }

  function on_injected(data){
    settings = data.settings;
  
    window.addEventListener("message", (e) => {
      if(e.source === window.parent && e.data && e.data.type){
        if(e.data.type === "aer_dmh_freight_request"){
          e.ports[0].postMessage({status: "NOT_LOGGED_IN"});
        }
      }
    });
  }
  
  function debug_log(...data){
    if(settings.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  }
})();