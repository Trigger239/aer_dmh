(function(){
  const MODULE_NAME = "aer_dmh/item_page_script.js";
  
  let settings;
  let methods = [];
  let localization = {strings: {}};
  
  let loadingIconUrl;
  
  let request_id = 0;
  
  const freight_iframe_id = "aer_dmh_freight_iframe";
  const freight_iframe = new Promise((resolve, reject) => {
    window.addEventListener("message", (e) => {
      if(e.source === window && e.data && e.data.type){
        if(e.data.type === "aer_dmh_freight_iframe_loaded"){
          resolve(document.getElementById(freight_iframe_id));
        }
      }
    });
  });

  window.addEventListener("message", (e) => {
    if(e.source === window && e.data && e.data.type){
      if(e.data.type === "aer_dmh_item_injected")
        on_injected(e.data.detail);
      else if(e.data.type === "aer_dmh_settings_changed")
        on_settings_changed(e.data.detail);
    }
  });

  function on_settings_changed(data){
    const changes = data.changes;
    for(const [key, {oldValue, newValue}] of Object.entries(changes)){
      settings[key] = newValue;
      debug_log("Setting '" + key + "' changed: " + oldValue + " -> " + newValue);
      if(key === "enabled_item"){
        if(newValue){
          show_delivery_methods(methods);
        }
        else{
          remove_dom_elements();
        }
      }
      else if(key === "show_total_cost"){
        show_delivery_methods(methods);
      }
      else if(key === "request_method"){
        window.location.reload();
      }
    }
  }

  function on_injected(data){
    settings = data.settings;
    loadingIconUrl = data.loadingIconUrl;
    
    const freight_iframe = document.getElementById(freight_iframe_id);
    if(!freight_iframe){
      debug_log("No order iframe found, can't continue!");
      return;
    }

    if(typeof fetch_old === "undefined"){
      var aer_dmh_fetch_old = fetch;
      debug_log("Original fetch function saved into aer_dmh_fetch_old");
    }

    fetch = function(resource, init){
      return new Promise((resolve, reject) => {
        const req = JSON.parse(init.body);
        const resp = aer_dmh_fetch_old(resource, init);

        if(resource.search("aer-api/v1/product/detail/freight\\?product_id=") != -1){
          resp.then((e) => {
            process_freight_resp(e.clone(), req);
            resolve(e);
          }, reject);
        }

        resolve(resp);
      });
    }
    
    if(document.readyState == "loading"){
      document.addEventListener("DOMContentLoaded", (e) =>{
        //__AER_DATA__ is ready here
        get_localization();
      });
    }
    else{
      get_localization();
    }
  }
  
  function get_localization(){
    const aer_data = document.getElementById("__AER_DATA__");
    if(!aer_data){
      debug_log("No __AER_DATA__, can't get localization info!");
      return;
    }

    debug_log("Getting localization info from __AER_DATA__...");

    const data = find_keys(JSON.parse(aer_data.textContent), ["currencyProps", "shipToProps", "lang", "i18n"]);
    if(data.currencyProps !== undefined &&
       data.currencyProps.selected !== undefined &&
       data.currencyProps.selected.currencyType !== undefined){
      localization.currency = data.currencyProps.selected.currencyType;
      debug_log("currency found:", localization.currency);
    }
    if(data.shipToProps !== undefined &&
       data.shipToProps.selectedCountry !== undefined &&
       data.shipToProps.selectedCountry.value !== undefined){
      localization.country = data.shipToProps.selectedCountry.value;
      debug_log("country found:", localization.country);

      if(data.shipToProps.selectedRegion !== undefined &&
         data.shipToProps.selectedRegion.value !== undefined){
        localization.provinceCode = data.shipToProps.selectedRegion.value;
        debug_log("provinceCode found:", localization.provinceCode);
      }
      if(data.shipToProps.selectedCity !== undefined &&
         data.shipToProps.selectedCity.value !== undefined){
        localization.cityCode = data.shipToProps.selectedCity.value;
        debug_log("cityCode found:", localization.cityCode);
      }
    }
    if(data.lang !== undefined){
      localization.lang = data.lang;
      debug_log("lang found:", localization.lang);
    }
    if(data.i18n !== undefined){
      localization.strings.delivery = data.i18n.checkoutShippingMethod_delivery || "Delivery";
      localization.strings.self_pickup = data.i18n.checkoutShippingMethod_self_pick_up || "Self pick-up";
      localization.strings.rupost_self_pickup = data.i18n.checkoutShippingMethod_rupost_self_pick_up || "RU Post Self pick-up";
      localization.strings.delivery = String(localization.strings.delivery).replace("\u00A0"," ");
      localization.strings.self_pickup = String(localization.strings.self_pickup).replace("\u00A0"," ");
      localization.strings.rupost_self_pickup = String(localization.strings.rupost_self_pickup).replace("\u00A0"," ");
    }
  }

  function find_keys(obj, keys){
    const ret = {};
    JSON.stringify(obj, function(key, val){
      if(keys.indexOf(key) != -1){
        ret[key] = val;
      }
      return val;
    });
    return ret;
  }

  function create_dom_elements(){
    if(!document.getElementById("aer_dmh_item_div")){
      debug_log("Creating DOM elements...");

      const delivery_div = document.querySelector('div[class^="Product_Delivery__productShipping__"]');
      if(!delivery_div){
        return false;
      }
      const div = document.createElement("div");
      div.id = "aer_dmh_item_div";
      table = document.createElement("table");
      table.id = "aer_dmh_item_table";
      table.createTBody();
      
      const img = document.createElement("img");
      img.id = "aer_dmh_item_loading_icon";
      
      div.appendChild(table);
      div.appendChild(img);
      
      img.src = loadingIconUrl;
      
      delivery_div.appendChild(div);
    }
    return true;
  }

  function remove_dom_elements(){
    debug_log("Removing DOM elements...");

    const table = document.getElementById("aer_dmh_item_table");
    if(table)
      table.remove();
    const div = document.getElementById("aer_dmh_item_div");
    if(div)
      div.remove();
  }

  function query_delivery_methods(product_desc, localization){
    return new Promise((resolve, reject) => {	
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (e) => {
        channel.port1.close();
        if(!e.data || !e.data.status){
          console.error("No status in received message...");
          reject({status: "BAD_MESSAGE"});
        }
        else if(e.data.status === "SUCCESS"){
          resolve(e.data);
        }
        else{
          if(String(e.data.status).startsWith("FAILED_THROW")){
            console.error(e.data.status);
          }
          reject(e.data);
        }
      }
      
      freight_iframe.then((ifr) => {
        ifr.contentWindow.postMessage({
          type: "aer_dmh_freight_request",
          product_desc: product_desc,
          localization: localization
        }, "*", [channel.port2]);
      }, (e) => {
        console.error(e);
        reject({status: "NO_IFRAME"});
      });
    });
  }

  function process_freight_resp(resp, req){
    request_id += 1;
      
    if(resp.ok && resp.status == 200){
      let price = req.minPrice;
      if(price === undefined)
        price = req.maxPrice;

      let tradeCurrency = req.tradeCurrency;
      //try to get data from __AER_DATA__
      //useful on the first request after the page was loaded
      const keys = find_keys(__AER_DATA__, ["minActivityAmount", "maxActivityAmount"]);
      if(price === undefined){
        debug_log("No price found in request, trying __AER_DATA__...");
        try{
          price = keys.minActivityAmount.value;
        } catch{};
        if(price === undefined){
          try{
            price = keys.maxActivityAmount.value;
          } catch{};
        }
      }
      if(tradeCurrency === undefined){
        debug_log("No currency found in request, trying __AER_DATA__...");
        try{
          tradeCurrency = keys.minActivityAmount.currency ||
                          keys.maxActivityAmount.currency;
        } catch{};
      }
      if(tradeCurrency === undefined){
        tradeCurrency = localization.currency;
      }

      let count = req.count;
      if(count === undefined){
        debug_log("No count found in request, using 1 as default")
        count = 1;
      }
      
      let skuId;
      if(req.ext !== undefined){
        skuId = req.ext.p0;
        if(skuId === undefined){
          debug_log("No SKU ID found in request, trying URL params...");
          const params = new URLSearchParams(window.location.search);
          if(params){
            skuId = params.get("sku_id");
          }
        }
      }
      
      let price_format_example = "0.00 " + (tradeCurrency || "");
      try{
        price_format_example = keys.minActivityAmount.formatted ||
                               keys.maxActivityAmount.formatted;
      } catch{};      
      
      debug_log("price: " + price + 
                " count: " + count + 
                " tradeCurrency: " + tradeCurrency + 
                " skuId: " + skuId);
      if(settings.enabled_item){
        create_dom_elements();
        show_loading_icon();
      }
      
      const product_desc = {
        productId: req.productId,
        skuId: skuId,
        count: count,
        price: price,
        currency: tradeCurrency,
        shipFrom: req.sendGoodsCountry,
      };
      let loc = {};
      Object.assign(loc, localization);
      loc.priceFormatExample = price_format_example;
      
      let this_request_id = request_id;
      
      query_delivery_methods(product_desc, loc).then((data) => {
        if(this_request_id !== request_id){ //do nothing if more requests were sent
          debug_log("Late response with id " + this_request_id + ", current id " + request_id); 
          return;
        }
          
        hide_loading_icon();
        
        methods = data.methods;
        if(settings.enabled_item){
          show_delivery_methods(methods);
        }
      }, (e) => {
        if(this_request_id !== request_id)
          return;
        
        hide_loading_icon();
        show_delivery_methods([]);
        show_error(check_reason(e).status);
      });
    }
    else{
      hide_loading_icon();
      show_delivery_methods([]);
      show_error("HTTP_" + resp.status);
    }
  }
  
  function show_error(status){
    const table = document.getElementById("aer_dmh_item_table");
    if(!table)
      return;
    remove_children(table);
   
    const div = document.createElement("div");
    div.className = "aer_dmh_item_error";
    
    if(status === "NOT_LOGGED_IN")
      div.textContent = "Please login and reload the page to see delivery methods!";
    else if(status === "NO_DATA")
      div.textContent = "No data!";
    else
      div.textContent = "No data! (" + String(status) + ")";
      
    table.appendChild(div);
  }
  
  function show_loading_icon(){
    const loading_icon = document.getElementById("aer_dmh_item_loading_icon");
    if(loading_icon)
      loading_icon.classList.remove("aer_dmh_item_hidden");
    const table = document.getElementById("aer_dmh_item_table");
    if(table)
      table.classList.add("aer_dmh_item_hidden");
  }

  function hide_loading_icon(){
    const loading_icon = document.getElementById("aer_dmh_item_loading_icon");
    if(loading_icon)
      loading_icon.classList.add("aer_dmh_item_hidden");
    const table = document.getElementById("aer_dmh_item_table");
    if(table)
      table.classList.remove("aer_dmh_item_hidden");
  }

  function remove_children(parent){
    while(parent.firstChild)
      parent.removeChild(parent.lastChild);
  }

  function show_delivery_methods(methods){
    if(!settings.enabled_item)
      return;
    if(!create_dom_elements())
      return;
    
    hide_loading_icon();
    if(methods.length > 0){
      const table = document.getElementById("aer_dmh_item_table");
      remove_children(table);
      table.createTBody();
      const tbody = table.tBodies[0];

      methods.forEach((m) => {
        const row = document.createElement("tr");
        row.className = "aer_dmh_item_tr";

        const groupName = document.createElement("td");
        groupName.className = "aer_dmh_item_td_groupName";
        groupName.textContent = m.groupName;
        row.appendChild(groupName);

        const service = document.createElement("td");
        service.className = "aer_dmh_item_td_service";
        service.textContent = m.service;
        row.appendChild(service);

        const date = document.createElement("td");
        date.className = "aer_dmh_item_td_date";
        date.textContent = m.daysFormatted;
        row.appendChild(date);

        const price = document.createElement("td");
        price.className = "aer_dmh_item_td_price";
        if(m.isFree){
          price.innerHTML = '<b style="color:green">Free</b>';
        }
        else{
          price.textContent = m.priceFormatted;
        }
        row.appendChild(price);

        if(settings.show_total_cost && m.totalCost !== undefined){
          const totalCost = document.createElement("td");
          totalCost.className = "aer_dmh_item_td_totalCost";

          const b = document.createElement("b");
          b.textContent = m.totalCostFormatted;
          totalCost.appendChild(b);

          row.appendChild(totalCost);
        }
        tbody.appendChild(row);
      });
    }
    else{
      show_error("NO_DATA");
    }
  }
  
  function check_reason(reason){
    let msg = reason;
    if(!reason.status){
      console.error(reason);
      
      msg = {status: "FAILED_THROW"};
      if(reason.message)
        msg.status +=" [" + reason.message + "]";
    }
    return msg;
  }

  function debug_log(...data){
    if(settings.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  }
})();
