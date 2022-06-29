(function(){
  let MODULE_NAME = "aer_dmh/item_page_script.js";
  let settings;
  let methods = [];

  document.addEventListener("aer_dmh_settings_changed", (e) => {
    let changes = e.detail.changes;
    for(let [key, {oldValue, newValue}] of Object.entries(changes)){
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
    }
  });

  document.addEventListener("aer_dmh_item_injected", (e) => {
    settings = e.detail.settings;

    if(typeof fetch_old === "undefined"){
      var aer_dmh_fetch_old = fetch;
      debug_log("Original fetch function saved into aer_dmh_fetch_old");
    }

    fetch = function(resource, init){
      return new Promise((resolve, reject) => {
        let req = JSON.parse(init.body);
        let resp = aer_dmh_fetch_old(resource, init);

        if(resource.search("aer-api/v1/product/detail/freight\\?product_id=") != -1){
          resp.then((e) => {
            process_freight_resp(e.clone(), req);
            resolve(e);
          }, reject);
        }

        resolve(resp);
      });
    }
  });

  function create_dom_elements(){
    if(!document.getElementById("aer_dmh_item_div")){
      debug_log("Creating DOM elements...");

      let delivery_div = document.querySelector('div[class^="Product_Delivery__productShipping__"]');
      if(!delivery_div){
        return false;
      }
      let div = document.createElement("div");
      div.id = "aer_dmh_item_div";
      table = document.createElement("table");
      table.id = "aer_dmh_item_table";
      table.createTBody();
      div.appendChild(table);
      delivery_div.appendChild(div);
    }
    return true;
  }

  function remove_dom_elements(){
    debug_log("Removing DOM elements...");

    let table = document.getElementById("aer_dmh_item_table");
    if(table)
      table.remove();
    let div = document.getElementById("aer_dmh_item_div");
    if(div)
      div.remove();
  }

  function process_freight_resp(resp, req){
    if(resp.ok && resp.status == 200){
      resp.json().then((e) => {
        if(e.methods && (e.methods instanceof Array)){
          let price = req.minPrice;
          if(price === undefined)
            price = req.maxPrice;

          let tradeCurrency = req.tradeCurrency;
          //try to get data from __AER_DATA__
          //useful on the first request after the page was loaded
          if(price === undefined){
            debug_log("No price found in request, trying __AER_DATA__...");
            try{
              price = __AER_DATA__.widgets[0].props.price.minActivityAmount.value;
            } catch{};
            if(price === undefined){
              try{
                price = __AER_DATA__.widgets[0].props.price.maxActivityAmount.value;
              } catch{};
            }
          }
          if(tradeCurrency === undefined){
            debug_log("No currency found in request, trying __AER_DATA__...");
            try{
              tradeCurrency = __AER_DATA__.widgets[0].props.price.minActivityAmount.currency ||
                              __AER_DATA__.widgets[0].props.price.maxActivityAmount.currency;
            } catch{};
          }

          let count = req.count;
          if(count === undefined){
            debug_log("No count found in request, using 1 as default")
            count = 1;
          }

          debug_log("price: " + price + " count: " + count + " tradeCurrency: " + tradeCurrency);

          let my_methods = [];
          e.methods.forEach((m) => {
              debug_log(m.groupName + " " + m.service + " " + m.amount.formatted);

              let totalCost = undefined;
              if(price !== undefined &&
                 count !== undefined &&
                 tradeCurrency !== undefined &&
                 m.amount.currency !== undefined &&
                 tradeCurrency == m.amount.currency){
                totalCost = price * count + m.amount.value;
              }
              my_methods.push({
                groupName: m.groupName,
                service: m.service,
                price: m.amount.value,
                priceCurrency: m.amount.currency,
                priceString: m.amount.formatted,
                isFree: (m.discount == 100 || m.amount.value == 0),
                dateString: m.dateFormat,
                totalCost: totalCost
              });
            });
          methods = my_methods;
          if(settings.enabled_item){
            show_delivery_methods(my_methods);
          }
        }
        else{
          debug_log(".methods not found in response!");
        }
      },
      () => {
        debug_log(".json() failed on response");
      });
    }
  }

  function show_delivery_methods(methods){
    if(!settings.enabled_item)
      return;
    if(!create_dom_elements())
      return;
    if(!(methods instanceof Array) || methods.length === 0)
      return;
    let table = document.getElementById("aer_dmh_item_table");
    let tbody = "<tody>";
    methods.forEach((m) => {
      let row = '<tr class="aer_dmh_item_tr">';
      row += '<td class="aer_dmh_item_td_groupName">' + m.groupName + "</td>";
      row += '<td class="aer_dmh_item_td_service">' + m.service + "</td>";
      row += '<td class="aer_dmh_item_td_date">' + m.dateString + "</td>";
      if(m.isFree){
        row +=  '<td class="aer_dmh_item_td_price"> <b style="color:green">Free</b> </td>';
      }
      else{
        row += '<td class="aer_dmh_item_td_price">' + m.priceString + "</td>";
      }
      if(settings.show_total_cost && m.totalCost !== undefined){
        row += '<td class="aer_dmh_item_td_totalCost"> <b>' + replace_number(m.priceString, m.totalCost) + "</b> </td>";
      }
      row += "</tr>"
      tbody += row;
    });
    tbody += "</tbody>";
    table.innerHTML = tbody;
  }

  function replace_number(str, new_value){
    let begin = -1;
    let end = -1;
    for(let i = 0; i < 9; i++){
      let j = str.indexOf(String(i));
      if(j != -1 && (j < begin || begin == -1))
        begin = j;
      j = str.lastIndexOf(String(i));
      if(j != -1 && (j + 1 > end || end == -1))
        end = j + 1;
    }
    if(begin == -1)
      begin = 0;
    if(end == -1)
      end = str.length;

    let old_value_str = str.substr(begin, end - begin);

    let sep = ".";
    let decimal_places = 2;
    let sep_pos = old_value_str.lastIndexOf(",");
    if(sep_pos != -1)
      sep = ",";
    sep_pos = old_value_str.lastIndexOf(sep);
    if(sep_pos != -1)
      decimal_places = old_value_str.length - 1 - sep_pos;

    str = str.substr(0, begin) + new_value.toFixed(decimal_places).replace(".", sep) + str.substr(end);
    return str;
  }

  function debug_log(...data){
    if(settings.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  }
})();
