(function(){
  let MODULE_NAME = "aer_dmh/wholesale_page_script.js";

  let freight_url = "https://aliexpress.ru/aer-api/v1/product/detail/freight";

  let PRODUCT_CONTAINER_CLASS = "product-snippet_ProductSnippet__container__";
  let PRODUCT_CONTAINER = 'div[class^="' + PRODUCT_CONTAINER_CLASS + '"]';
  let PRODUCT_LINK = 'div[class^="product-snippet_ProductSnippet__description__"] > a';
  let PRODUCT_PRICE = 'div[class^="snow-price_SnowPrice__mainM__"]';
  let PRODUCT_PRICE_CONTAINER_CLASS = "snow-price_SnowPrice__container__";
  let PRODUCT_PRICE_CONTAINER = 'div[class^="' + PRODUCT_PRICE_CONTAINER_CLASS + '"]';
  let PRODUCT_PRICE_BLOCK_CLASS = "snow-price_SnowPrice__blockMain__";
  let PRODUCT_FEED = 'div[class^="SearchProductFeed_SearchProductFeed__productFeed__"]';

  let ICON_CLASS = "aer_dmh_wholesale_icon";

  let settings;
  let iconUrl, loadingIconUrl;
  let products = [];
  let localization = {strings: {}};

  let popup_timeout;
	
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

  function get_products_from_dom(){
    debug_log("Getting products from DOM elements...")
    let divs = document.querySelectorAll(PRODUCT_CONTAINER);
    debug_log(divs.length + " div(s) found");
    products = [];
    divs.forEach((d) => {
      let id = d.getAttribute("data-product-id");
      let link = d.querySelector(PRODUCT_LINK);
      let sku_id;
      if(link){
        let m = link.href.match(/sku_id=([0-9]+)/);
        if(m && m.length == 2)
          sku_id = m[1];
      }
      let price;
      let price_str;
      let price_div = d.querySelector(PRODUCT_PRICE);
      if(price_div){
        price_str = price_div.innerText;
        price = Number(extract_price(price_str, true, true));
      }
      products.push({
        productId: id,
        skuId: sku_id,
        price: price,
        priceString: price_str,
      });
    });
  }

  function extract_price(str, remove_spaces = false, replace_sep = false){
    let num = str.match(/[0-9]+([\s\u00A0][0-9]+)*([.,][0-9]+)?/);
    if(num){
      let ret = num[0];
      if(remove_spaces)
        ret = ret.replaceAll(/[\s\u00A0]/g, "");
      if(replace_sep)
        ret = ret.replace(",", ".");
      return ret;
    }
  }

  function get_localization(){
    let aer_data = document.getElementById("__AER_DATA__");
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
    let ret = {};
    JSON.stringify(obj, function(key, val){
      if(keys.indexOf(key) != -1){
        ret[key] = val;
      }
      return val;
    });
    return ret;
  }

  window.addEventListener("message", (e) => {
    if(e.source === window && e.data && e.data.type){
      if(e.data.type === "aer_dmh_wholesale_injected")
        on_injected(e.data.detail);
      else if(e.data.type === "aer_dmh_settings_changed")
        on_settings_changed(e.data.detail);
    }
  });

  function on_settings_changed(data){
    let changes = data.changes;
    for(let [key, {oldValue, newValue}] of Object.entries(changes)){
      settings[key] = newValue;
      debug_log("Setting '" + key + "' changed: " + oldValue + " -> " + newValue);
      if(key === "enabled_wholesale"){
        if(newValue){
          create_icons_all_products();
        }
        else{
          remove_delivery_popup();
          remove_icons();
        }
      }
      else if(key === "show_total_cost"){
        update_delivery_methods();
      }
      else if(key === "request_method"){
        window.location.reload();
      }
    }
  }

  function on_injected(data){
    settings = data.settings;
    iconUrl = data.iconUrl;
    loadingIconUrl = data.loadingIconUrl;

    if(typeof fetch_old === "undefined"){
      var aer_dmh_fetch_old = fetch;
      debug_log("Original fetch function saved into aer_dmh_fetch_old");
    }
    fetch = function(resource, init){
      return new Promise((resolve, reject) => {
        let req = JSON.parse(init.body);
        let resp = aer_dmh_fetch_old(resource, init);

        if(resource.search("aer-webapi/v1/search") != -1){
          resp.then((e) => {
            process_search_resp(e.clone(), req);
            resolve(e);
          }, reject);
        }

        resolve(resp);
      });
    }

    if(document.readyState == "loading"){
      document.addEventListener("DOMContentLoaded", (e) =>{
					//__AER_DATA__ is ready here
				get_products_from_dom();
				get_localization();
				set_mutation_observer();
      });
    }
    else{
      get_products_from_dom();
      get_localization();
      set_mutation_observer();
    }
  }

  function create_icon(price_container_div, index){
    if(!settings.enabled_wholesale)
      return;

    if(!price_container_div){
      debug_log("Bad price_container_div:", price_container_div);
      return;
    }

    //Remove icon div if it already exists
    for(let el of [...price_container_div.getElementsByClassName(ICON_CLASS)]){
      el.remove();
    }

    let icon_div = document.createElement("div");
    icon_div.className = ICON_CLASS;
    icon_div.setAttribute("data-aer-dmh-index", index);

    let icon = document.createElement("img");
    icon_div.appendChild(icon);

    price_container_div.classList.add("aer_dmh_wholesale_price");
    price_container_div.appendChild(icon_div);

    icon.src = iconUrl;

    icon_div.addEventListener("click", icon_click_listener);
  }

  function create_icons_all_products(){
    if(!settings.enabled_wholesale)
      return;

    let divs = document.querySelectorAll(PRODUCT_CONTAINER);
    debug_log("Creating icon(s) for " + divs.length + " product(s)...");
    divs.forEach((d, i) => {
      let price_container = d.querySelector(PRODUCT_PRICE_CONTAINER);
      create_icon(price_container, i);
    });
  }

  function remove_icons(){
    let elements = [...document.getElementsByClassName(ICON_CLASS)];
    debug_log("Removing " + elements.length + " icon(s)...");
    for(let el of elements){
      if(el.parentElement){
        el.parentElement.classList.remove("aer_dmh_wholesale_price");
      }
      el.remove();
    }
  }

  function find_ancestor_by_class(element, className){
    let curr_el = element;
    while(curr_el){
      if(curr_el.className.search(className) != -1)
        return curr_el;
      curr_el = curr_el.parentElement;
    }
  }

  function product_feed_mutation_cb(mutationsList, observer){
    for(let mutation of mutationsList){
      if(mutation.type === "childList" &&
         mutation.target.className.search(PRODUCT_PRICE_CONTAINER_CLASS) != -1){
        for(let node of mutation.addedNodes){
          if(node.className.search(PRODUCT_PRICE_BLOCK_CLASS) != -1 &&
             mutation.target.getElementsByClassName(ICON_CLASS).length == 0){
            let product_container = find_ancestor_by_class(mutation.target, PRODUCT_CONTAINER_CLASS);
            if(product_container && product_container.parentElement){
              let i = Array.prototype.indexOf.call(product_container.parentElement.children,
                                                   product_container);
              if(i != -1){
                create_icon(mutation.target, i);
              }
              else{
                debug_log("Can't determine product index for", product_container);
              }
            }
          }
        }
      }
    }
  }

  function set_mutation_observer(){
    let product_feed = document.querySelector(PRODUCT_FEED);
    if(product_feed){
      const observer = new MutationObserver(product_feed_mutation_cb);
      observer.observe(product_feed, {
        attributes: false,
        childList: true,
        subtree: true,
      });
    }
  }

  function icon_click_listener(e){
    e.stopPropagation();
    e.preventDefault();

    let target = e.currentTarget;

    let index = target.getAttribute("data-aer-dmh-index");
    if(index === undefined || index === null){
      debug_log("data-aer-dmh-index undefined!");
    }

    //Remove popup div if it already exists
    remove_delivery_popup();

    let rect = target.getBoundingClientRect();
    let dx = e.clientX - rect.left;
    let dy = e.clientY - rect.top;
    create_delivery_popup(target, dx, dy);

    show_delivery_methods(index);
  }

  function create_delivery_popup(parent, dx, dy){
    if(!document.getElementById("aer_dmh_wholesale_div")){
      let div = document.createElement("div");
      div.id = "aer_dmh_wholesale_div";
      div.style.left = (dx + 2) + "px";
      div.style.top = (dy + 8) + "px";

      div.innerHTML =
      ' \
        <div id="aer_dmh_wholesale_inner_div"> \
          <p id="aer_dmh_wholesale_ship_from"></p> \
          <table id="aer_dmh_wholesale_table"> \
            <tbody></tbody> \
          </table>  \
          <img id="aer_dmh_wholesale_loading_icon"> \
        </div> \
      ';

      div.querySelector("#aer_dmh_wholesale_loading_icon").src = loadingIconUrl;

      clearTimeout(popup_timeout);
      div.addEventListener("mouseenter", () => {
        clearTimeout(popup_timeout);
      });
      div.addEventListener("mouseleave", () => {
        popup_timeout = setTimeout(remove_delivery_popup, settings.wholesale_popup_timeout);
      });

      div.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      parent.appendChild(div);
    }
    return true;
  }

  function remove_delivery_popup(){
    let div = document.getElementById("aer_dmh_wholesale_div");
    if(div)
      div.remove();
    clearTimeout(popup_timeout);
  }

  function process_search_resp(resp, req){
    if(resp.ok && resp.status == 200){
      resp.json().then((e) => {
        debug_log("Getting products from search response...")
        if(e.data && e.data.productsFeed && e.data.productsFeed.products &&
           (e.data.productsFeed.products instanceof Array)){
          debug_log(e.data.productsFeed.products.length + " products(s) found in response");
          products = [];
          e.data.productsFeed.products.forEach((p) => {
            let id = p.id;
            let link = p.productUrl;
            let sku_id;
            if(link !== undefined){
              let m = String(link).match(/sku_id=([0-9]+)/);
              if(m && m.length == 2)
                sku_id = m[1];
            }
            let price;
            let price_str = p.finalPrice;
            if(price_str !== undefined){
              price = Number(extract_price(price_str, true, true));
            }
            products.push({
              productId: id,
              skuId: sku_id,
              price: price,
              priceString: price_str,
            });
          });

          update_delivery_methods();
        }
        else{
          debug_log(".data.productsFeed.products not found in response!");
        }
      },
      () => {
        debug_log(".json() failed on response");
      });
    }
  }

  //https://stackoverflow.com/questions/10730362/get-cookie-by-name
  function getCookie(name) {
      function escape(s) { return s.replace(/([.*+?\^$(){}|\[\]\/\\])/g, '\\$1'); }
      var match = document.cookie.match(RegExp('(?:^|;\\s*)' + escape(name) + '=([^;]*)'));
      return match ? match[1] : undefined;
  }

  function to_string_if_defined(val){
    if(val !== undefined)
      return String(val);
    else
      return val;
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

  function remove_children(parent){
    while(parent.firstChild)
      parent.removeChild(parent.lastChild);
  }

  function show_delivery_methods(index){
    let div = document.getElementById("aer_dmh_wholesale_div");
    if(div){
      if(!products[index]){
        debug_log("No product with index " + index);
        return;
      }

      show_loading_icon();
			
			const product = products[index];
			
			const product_desc = {
        productId: product.productId,
        skuId: product.skuId,
        count: 1,
        price: product.price,
        currency: localization.currency,
      };
      let loc = {};
      Object.assign(loc, localization);
      loc.priceFormatExample = product.priceString || ("0.00 " + (tradeCurrency || ""));

      request_id += 1;
      let this_request_id = request_id;
			
      query_delivery_methods(product_desc, loc).then((data) => {
        if(this_request_id !== request_id){ //do nothing if more requests were sent
          debug_log("Late response with id " + this_request_id + ", current id " + request_id); 
          return;
        }
          
        hide_loading_icon();
				
        show_ship_from(data.methods);
        make_delivery_methods_table(data.methods);
      }, (e) => {
        if(this_request_id !== request_id)
          return;
        
        hide_loading_icon();
        make_delivery_methods_table([]);
        show_error(check_reason(e).status);
      });
    }
  }  
	
	function show_error(status){
    const table = document.getElementById("aer_dmh_wholesale_table");
    if(!table)
      return;
    remove_children(table);
   
    const div = document.createElement("div");
    div.className = "aer_dmh_wholesale_error";
    
    if(status === "NOT_LOGGED_IN")
      div.textContent = "Please login and reload the page to see delivery methods!";
    else if(status === "NO_DATA")
      div.textContent = "No data!";
    else
      div.textContent = "No data! (" + String(status) + ")";
      
    table.appendChild(div);
  }

  function show_loading_icon(){
    const loading_icon = document.getElementById("aer_dmh_wholesale_loading_icon");
    if(loading_icon)
      loading_icon.classList.remove("aer_dmh_wholesale_hidden");
    const table = document.getElementById("aer_dmh_wholesale_table");
    if(table)
      table.classList.add("aer_dmh_wholesale_hidden");
  }

  function hide_loading_icon(){
    const loading_icon = document.getElementById("aer_dmh_wholesale_loading_icon");
    if(loading_icon)
      loading_icon.classList.add("aer_dmh_wholesale_hidden");
    const table = document.getElementById("aer_dmh_wholesale_table");
    if(table)
      table.classList.remove("aer_dmh_wholesale_hidden");
  }

  function make_delivery_methods_table(methods){
    const table = document.getElementById("aer_dmh_wholesale_table");
    if(!table){
      debug_log("No aer_dmh_wholesale_table found!");
      return;
    }
    if(methods.length > 0){
      if(!table.tBodies[0])
        table.createTBody();

      const tbody = table.tBodies[0];
      remove_children(tbody);

      methods.forEach((m) => {
        const row = document.createElement("tr");
        row.className = "aer_dmh_wholesale_tr";

        const groupName = document.createElement("td");
        groupName.className = "aer_dmh_wholesale_td_groupName";
        groupName.textContent = m.groupName;
        row.appendChild(groupName);

        const service = document.createElement("td");
        service.className = "aer_dmh_wholesale_td_service";
        service.textContent = m.service;
        row.appendChild(service);

    //    const date = document.createElement("td");
    //    date.className = "aer_dmh_wholesale_td_date";
    //    date.textContent = m.daysFormatted;
    //    row.appendChild(date);
		
        const price = document.createElement("td");
        price.className = "aer_dmh_wholesale_td_price";
        if(m.isFree){
          price.innerHTML = '<b style="color:green">Free</b>';
        }
        else{
          price.textContent = m.priceFormatted;
        }
        row.appendChild(price);

        if(settings.show_total_cost && m.totalCost !== undefined){
          const totalCost = document.createElement("td");
          totalCost.className = "aer_dmh_wholesale_td_totalCost";

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
	
	function show_ship_from(methods){
		const ship_from_p = document.getElementById("aer_dmh_wholesale_ship_from");
		if(!ship_from_p){
			debug_log("No aer_dmh_wholesale_ship_from found!");
			return;
		}
		
		const countries = new Set();
		for(m of methods){
		  if(m.shipFromFullName)
			  countries.add(m.shipFromFullName);
		}
		
		let ship_from_string = "?";
		if(countries.size > 0)
		  ship_from_string = Array(...countries).join(", ");

		remove_children(ship_from_p);
		ship_from_p.textContent = "Ship from: ";

		let b = document.createElement("b");
		b.textContent = ship_from_string;
		ship_from_p.appendChild(b);
	}

  function update_delivery_methods(){
    let div = document.getElementById("aer_dmh_wholesale_div");
    if(div && div.parentElement){
      let index = div.parentElement.getAttribute("data-aer-dmh-index");
      if(index === undefined || index === null){
        debug_log("data-aer-dmh-index undefined!");
      }
      show_delivery_methods(index);
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
