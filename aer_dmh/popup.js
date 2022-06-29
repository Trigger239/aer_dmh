let MODULE_NAME = "aer_dmh/popup.js";

let enabled_item_checkbox = document.getElementById("enabled_item");
let enabled_wholesale_checkbox = document.getElementById("enabled_wholesale");
let show_total_cost_checkbox = document.getElementById("show_total_cost");
let debug_logging_checkbox = document.getElementById("debug_logging");
let wholesale_popup_timeout_input = document.getElementById("wholesale_popup_timeout");
let restore_defaults_button = document.getElementById("restore_defaults");

//initialize elements
function init_from_storage(){
  chrome.storage.sync.get((data) => {
    enabled_item_checkbox.checked = data.enabled_item;
    enabled_wholesale_checkbox.checked = data.enabled_wholesale;
    show_total_cost.checked = data.show_total_cost;
    debug_logging_checkbox.checked = data.debug_logging;
    wholesale_popup_timeout_input.value = data.wholesale_popup_timeout;
  });
  debug_log("Initialized from storage");
}
init_from_storage();

//add event listeners
enabled_item_checkbox.addEventListener("change", on_checkbox_change);
enabled_wholesale_checkbox.addEventListener("change", on_checkbox_change);
show_total_cost_checkbox.addEventListener("change", on_checkbox_change);
debug_logging_checkbox.addEventListener("change", on_checkbox_change);
wholesale_popup_timeout_input.addEventListener("change", on_popup_timeout_change);

function on_checkbox_change(e){
  chrome.storage.sync.set(JSON.parse('{"' + e.target.id + '": ' + e.target.checked + '}'));
}

function on_popup_timeout_change(e){
  let val = wholesale_popup_timeout_input.value;
  let min = wholesale_popup_timeout_input.min;
  let max = wholesale_popup_timeout_input.max;

  if(val.match(/^[+-]?[0-9]+(.[0-9]+)?$/)){
    let n = Number.parseFloat(val);
    if(!Number.isNaN(val)){
      n = Math.round(n);
      if(n < min)
        n = min;
      if(n > max)
        n = max;

      wholesale_popup_timeout_input.value = n;
      chrome.storage.sync.set({wholesale_popup_timeout: n});
      return;
    }
  }
  chrome.storage.sync.get("wholesale_popup_timeout", (data) => {
    wholesale_popup_timeout_input.value = data.wholesale_popup_timeout;
  });
}

restore_defaults_button.addEventListener("click", function(){
  chrome.runtime.sendMessage({type: "restore_defaults"}, (resp) => {
    init_from_storage();
  });
});

function debug_log(...data){
  chrome.storage.sync.get("debug_logging", (d) => {
    if(d.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  });
}
