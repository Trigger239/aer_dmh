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
  let localization = {};

  let popup_timeout;

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

    let data = find_keys(JSON.parse(aer_data.innerText), ["currencyProps", "shipToProps"]);
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

  document.addEventListener("aer_dmh_settings_changed", (e) => {
    let changes = e.detail.changes;
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
    }
  });

  document.addEventListener("aer_dmh_wholesale_injected", (e) => {
    settings = e.detail.settings;
    iconUrl = e.detail.iconUrl;
    loadingIconUrl = e.detail.loadingIconUrl;

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

    document.addEventListener("DOMContentLoaded", (e) =>{
      //__AER_DATA__ is ready here
      get_products_from_dom();
      get_localization();
      set_mutation_observer();
    });
  });

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
          <img id="aer_dmh_wholesale_loading_icon" src="' + loadingIconUrl + '">\
        </div> \
      ';

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

  function freight_request(product, localization){
    return fetch(freight_url + "?product_id=" + product.productId,
    {
      headers: {"Content-type": "application/json"},
      method: "POST",
      body: JSON.stringify(
      {
        productId: Number(product.productId),
        country: to_string_if_defined(localization.country),
        cityCode: to_string_if_defined(localization.cityCode),
        provinceCode: to_string_if_defined(localization.provinceCode),
        count: 1,
        displayMultipleFreight: true,
        minPrice: product.price,
        maxPrice: product.price,
        tradeCurrency: to_string_if_defined(localization.currency),
        ext:
        {
          cookieCna: getCookie("cna"),
          hideShipFrom: "false", //yes, it should be a string!
          p0: to_string_if_defined(product.skuId),
          p1: to_string_if_defined(product.price),
          p3: to_string_if_defined(localization.currency),
          p4: "-1", //I don't know what does this mean, sometimes it is -1
          p5: "0", //Another strange thing... Some "random" numbers appear here sometimes
          p7: "{}"
        }
      })
    });
  }

  function process_freight_resp(resp, product){
    return new Promise((resolve, reject) => {
      if(resp.ok && resp.status == 200){
        resp.json().then((e) => {
          if(e.methods && (e.methods instanceof Array)){
            let price = product.price;
            let currency = localization.currency;

            debug_log("price: " + price + " currency: " + currency);

            let methods = [];
            e.methods.forEach((m) => {
              debug_log(m.groupName + " " + m.service + " " + m.amount.formatted);

              let totalCost = undefined;
              if(price !== undefined &&
                 currency !== undefined &&
                 m.amount.currency !== undefined &&
                 currency == m.amount.currency){
                totalCost = price + m.amount.value;
              }
              methods.push({
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

            let shipFrom;
            if(e.from)
              shipFrom = e.from.countryName;
            resolve({methods: methods, shipFrom: shipFrom});
          }
          else{
            reject();
          }
        }, reject);
      }
      else{
        reject();
      }
    });
  }

  function show_delivery_methods(index){
    let div = document.getElementById("aer_dmh_wholesale_div");
    if(div){
      if(!products[index]){
        debug_log("No product with index " + index);
        return;
      }

      let loading_icon = document.getElementById("aer_dmh_wholesale_loading_icon");
      if(loading_icon)
        loading_icon.classList.remove("aer_dmh_wholesale_hidden");

      freight_request(products[index], localization).then((resp) => {
        process_freight_resp(resp, products[index]).then((data) => {
          if(loading_icon)
            loading_icon.classList.add("aer_dmh_wholesale_hidden");

          let ship_from_p = document.getElementById("aer_dmh_wholesale_ship_from");
          if(ship_from_p){
            let ship_from_string = data.shipFrom || "?";
            ship_from_p.innerHTML = 'Ship from: <b>' + ship_from_string + '</b>';
          }
          else{
            debug_log("No aer_dmh_wholesale_ship_from found!");
          }

          make_delivery_methods_table(data.methods);
        }, () => {
          if(loading_icon)
            loading_icon.classList.add("aer_dmh_wholesale_hidden");
          debug_log("process_freight_resp() failed");
          make_delivery_methods_table([]);
        })
      }, () => {
        if(loading_icon)
          loading_icon.classList.add("aer_dmh_wholesale_hidden");
        debug_log("freight_request() failed");
        make_delivery_methods_table([]);
      });
    }
  }

  function make_delivery_methods_table(methods){
    let table = document.getElementById("aer_dmh_wholesale_table");
    if(!table){
      debug_log("No aer_dmh_wholesale_table found!");
      return;
    }
    if(methods.length > 0){
      let tbody = "<tody>";
      methods.forEach((m) => {
        let row = '<tr class="aer_dmh_wholesale_tr">';
        row += '<td class="aer_dmh_wholesale_td_groupName">' + m.groupName + "</td>";
        row += '<td class="aer_dmh_wholesale_td_service">' + m.service + "</td>";
        //row += '<td class="aer_dmh_wholesale_td_date">' + m.dateString + "</td>";
        if(m.isFree){
          row +=  '<td class="aer_dmh_wholesale_td_price"> <b style="color:green">Free</b> </td>';
        }
        else{
          row += '<td class="aer_dmh_wholesale_td_price">' + format_price(m.price, m.priceString) + "</td>";
        }
        if(settings.show_total_cost && m.totalCost !== undefined){
          row += '<td class="aer_dmh_wholesale_td_totalCost"> <b>' + format_price(m.totalCost, m.priceString) + "</b> </td>";
        }
        row += "</tr>"
        tbody += row;
      });
      tbody += "</tbody>";
      table.innerHTML = tbody;
      table.innerHTML = table.innerHTML.replaceAll("&nbsp;", " ");
    }
    else{
      table.innerHTML = '<div class="aer_dmh_wholesale_no_data"><b>No data!</b></div>';
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

    let old_value_str = example.substr(begin, end - begin);

    let sep = ".";
    let decimal_places = 2;
    let sep_pos = old_value_str.lastIndexOf(",");
    if(sep_pos != -1)
      sep = ",";
    sep_pos = old_value_str.lastIndexOf(sep);
    if(sep_pos != -1)
      decimal_places = old_value_str.length - 1 - sep_pos;

    return price.toFixed(decimal_places).replace(".", sep);
  }

  function update_delivery_methods(){
    let div = document.getElementById("aer_dmh_wholesale_div");
    if(div){
      let index = div.getAttribute("data-aer-dmh-index");
      if(index === undefined || index === null){
        debug_log("data-aer-dmh-index undefined!");
      }
    show_delivery_methods(index);
    }
  }

  function debug_log(...data){
    if(settings.debug_logging){
      console.log(MODULE_NAME + ": ", ...data);
    }
  }
})();
