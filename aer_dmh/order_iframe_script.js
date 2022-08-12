(function(){
  let MODULE_NAME = "aer_dmh/order_iframe_script.js";
  
  let settings;
  
  function check_null_undef(val){
    return (undefined == val || null == val) ? void 0 : val;
  }
  
  //product_desc = {
  //  productId,
  //  skuId, //optional
  //  count,
  //  price,
  //  currency,
  //  shipFrom, //optional
  //  pickupPoint, //optional
  //  ruPostPickupPoint //optional
  //}
  //localization = {
  //  country, //optional
  //  provinceCode, //optional
  //  cityCode, //optional
  //  lang, //optional
  //  priceformatExample,
  //  strings: { //optional
  //    delivery, 
  //    self_pickup, 
  //    rupost_self_pickup
  //  }
  //}  
  //returns: Array of methods
  //method = {
  //  service,
  //  price,
  //  priceCurrency,
  //  priceFormatted,
  //  isFree,
  //  totalCost, //optional
  //  totalCostFormatted, //optional
  //  days,
  //  daysFormatted,
  //  originalData,
  //  groupName, //optional
  //  shipFrom, //optional
  //  shipFromFullName //optional
  //}
  function mtop_freight_request(product_desc, localization){
    debug_log("Sending Mtop Freight Request...");
    return window.lib.mtop.request({
      api: "mtop.aliexpress.logistics.freight.calculateFreight",
      v: "1.0",
      type: "GET",
      dataType: "jsonp",
      timeout: 15e3,
      data: {
        city: check_null_undef(localization.cityCode),
        country: check_null_undef(localization.country),
        lang: check_null_undef(localization.lang),
        locale: check_null_undef(localization.lang),
        maxPrice: product_desc.price,
        minPrice: product_desc.price,
        productId: product_desc.productId,
        productIdAndCount: "".concat(product_desc.productId, ":").concat(product_desc.count),
        province: check_null_undef(localization.provinceCode),
        quantity: String(product_desc.count),
        sendGoodsCountry: check_null_undef(product_desc.shipFrom),
        switchon: "true",
        //displayMultipleFreight: true,
        tradeCurrency: product_desc.currency,
        userScene: "PC_ORDER_CONFIRM_SHIPPING_PANEL",
        _currency: product_desc.currency,
        _lang: check_null_undef(localization.lang),
        selectPickupPoint: product_desc.pickupPoint ? "true" : void 0,
        selectRuPostPickupPoint: product_desc.ruPostPickupPoint ? "true" : void 0,
        ext: JSON.stringify({ //original AliExpress code
            cookieCna: (M = "cna",
            N = void 0,
            N = document.cookie.match(new RegExp("(?:^|; )" + M.replace(/([.$?*|{}()\[\]\\\/+^])/g, "\\$1") + "=([^;]*)")),
            N ? decodeURIComponent(N[1]) : void 0)
        })
      }
    }).then((resp) => {
      return process_mtop_freight_response(resp, product_desc, localization);
    }, (e) => {
      debug_log("Mtop Freight Request failed", e);
      throw {status: "FAILED_MTOP"};
    });
  }
  
  function process_mtop_freight_response(resp, product_desc, localization){
    debug_log("Mtop Freight Response received");
    if(resp && resp.ret && (resp.ret instanceof Array) && (typeof resp.ret[0] === "string")){
      status = resp.ret[0];
      const  pos = status.search(":");
      if(pos != -1)
        status = status.substr(0, pos);
      debug_log("Status: " + status);
      
      if(status !== "SUCCESS")
        throw {status: status};
      
      let data = resp.data;
          
      if(data && data.freightResult && (data.freightResult instanceof Array)){
        let methods = [];
        for(m of data.freightResult){
          let new_m = {};
          
          new_m.service = String(m.company).replace("\u00A0"," ");
          new_m.price = m.freightAmount.value;
          new_m.priceCurrency = String(m.freightAmount.currency).replace("\u00A0"," ");
          
          const format_str = String(localization.priceFormatExample).replace("\u00A0"," ");
          new_m.priceFormatted = format_price(new_m.price, format_str);
          
          new_m.isFree = (m.discount == 100 || m.freightAmount.value == 0);
   
          if(product_desc.price !== undefined &&
             product_desc.count !== undefined &&
             product_desc.currency !== undefined &&
             m.freightAmount.currency !== undefined &&
             product_desc.currency == m.freightAmount.currency){
            new_m.totalCost = product_desc.price * product_desc.count + m.freightAmount.value;
            new_m.totalCostFormatted = format_price(new_m.totalCost, format_str);      
          }
          
          new_m.days = m.time;
          new_m.daysFormatted = format_date(m.time, localization);
          
          new_m.groupName = product_desc.groupName;
          
          new_m.shipFrom = m.sendGoodsCountry;
          new_m.shipFromFullName = m.sendGoodsCountryFullName || new_m.shipFrom;
          
          new_m.originalData = m;
          
          debug_log(new_m.groupName + " " + new_m.service + " " + new_m.price + " " + new_m.priceCurrency);
          
          methods.push(new_m);
        }
        return {status: "SUCCESS", methods: methods};
      }
      else{
        debug_log("Bad response format");
        throw {status: "BAD_RESP"};
      }
    }
    else{
      debug_log("Bad response format");
      throw {status: "BAD_RESP"};
    }
  }
  
  function format_price(price, example){
    let begin = -1;
    let end = -1;
    for(let i = 0; i < 9; i++){
      let j = example.indexOf(String(i));
      if(j != -1 && (j < begin || begin == -1))
        begin = j;
      j = example.lastIndexOf(String(i));
      if(j != -1 && (j + 1 > end || end == -1))
        end = j + 1;
    }
    if(begin == -1)
      begin = 0;
    if(end == -1)
      end = example.length;

    const old_value_str = example.substr(begin, end - begin);

    let sep = ".";
    let decimal_places = 2;
    let sep_pos = old_value_str.lastIndexOf(",");
    if(sep_pos != -1)
      sep = ",";
    sep_pos = old_value_str.lastIndexOf(sep);
    if(sep_pos != -1)
      decimal_places = old_value_str.length - 1 - sep_pos;

    return price.toFixed(decimal_places).replace(".", sep) + example.substr(end);
  }
  
  function format_date(days, localization){
    if(typeof days !== "string"){
      debug_log("Wrong days (time) type");
      return "?";
    }
    const [min_s, max_s] = days.split("-");
    const min = Number.parseInt(min_s);
    const max = Number.parseInt(max_s);
    
    const day_ms = 86400000;
    
    const now = Math.ceil(Date.now() / day_ms) * day_ms;
    let date_min, date_max;
    
    if(Number.isNaN(min)){
      debug_log("Bad first number in days (time): " + min_s);
      return "?";
    }
    else{
      const date_ts_min = now + day_ms * min;
      date_min = new Date(date_ts_min);
    }
    if(Number.isNaN(max)){
      debug_log("Bad second number in days (time): " + max_s);
    }
    else{
      const date_ts_max = now + day_ms * max;
      date_max = new Date(date_ts_max);
    }
    
    const months_ru = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const months_en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const months = (localization.lang === "ru_RU") ? months_ru : months_en;
    let str = String(date_min.getDate()).padStart(2, "0") + " " + months[date_min.getMonth()];
    if(date_max !== undefined && date_max != date_min){
      str += "-" + String(date_max.getDate()).padStart(2, "0") + " " + months[date_max.getMonth()];
    }
    
    return str;
  }
  
  window.addEventListener("message", (e) => {
    if(e.source === window && e.data && e.data.type){
      if(e.data.type === "aer_dmh_order_iframe_injected")
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
          let product_desc = e.data.product_desc;
          let localization = e.data.localization;
          if(localization.strings === undefined)
            localization.strings = {};

          const groups = [
            {
              name: localization.strings.delivery,
              pickupPoint: false,
              ruPostPickupPoint: false
            },
            {
              name: localization.strings.self_pickup,
              pickupPoint: true,
              ruPostPickupPoint: false
            },
            {
              name: localization.strings.rupost_self_pickup,
              pickupPoint: false,
              ruPostPickupPoint: true
            }
          ];
          
          let requests = [];
          for(group of groups){
            let pr_desc = {};
            Object.assign(pr_desc, product_desc);
            pr_desc.groupName = group.name;
            pr_desc.pickupPoint = group.pickupPoint;
            pr_desc.ruPostPickupPoint = group.ruPostPickupPoint;
            
            requests.push(mtop_freight_request(pr_desc, localization));
          }
          
          return Promise.all(requests).then((data_arr) => {
            let methods = [];
            for(data of data_arr){
              methods.push(...data.methods);  
            }
            e.ports[0].postMessage({status: "SUCCESS", methods: methods});
          }, (resp) => {
            e.ports[0].postMessage(check_reason(resp));
          });     
        }
      }
    });
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