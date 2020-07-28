
Module.register("MMM-Tracking", {
  // Default module config.
  defaults: {
    trackingNumbersUrl: "",
    updateInterval: 60 * 60 * 1000, // every hour
    tableClass: "medium",
    lang: config.language,
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500
  },

  // Define required scripts.
  getStyles: function() {
    return [ "MMM-Tracking.css" ];
  },

  // Define start sequence.
  start: function () {
    Log.info("Starting module: " + this.name);

    this.trackingResults = {
      fedex: {},
      ups: {},
      usps: {}
    };
    
    this.trackingNumbers = {
      fedex: [],
      ups: [],
      usps: []
    };

    this.trackingSourcesStatus = {
      fedex: "pending",
      ups: "pending",
      usps: "pending"
    };

    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  // Handle socket answer
  socketNotificationReceived: function(notification, payload) {
    // Care only own socket answers
    if (notification === "MMM_TRACKING_GET_HTML_FOR_URL_FAILED") {
      Log.error("could not fetch html for carrier: " + payload.carrier);
      Log.error(payload.err);
      this.trackingResults[payload.carrier]["Error: "] = "Could not get html for scraping.";
      this.trackingSourcesStatus[payload.carrier] = "failed";
    } else if (notification === "MMM_TRACKING_GET_HTML_FOR_URL_SUCCEEDED") {
      switch(payload.carrier) {
        case "ups":
          this.processUpsTrackingHtml(payload.html);
          brea;
        case "usps":
          this.processUspsTrackingHtml(payload.html);
          break;
        default:
          break;
      }
    }
  },

  resetTrackingResults: function() {
    for(key in this.trackingResults) {
      this.trackingResults[key] = {};
    }
  },

  resetTrackingSourcesStatus: function() {
    for(key in this.trackingSourcesStatus) {
      this.trackingSourcesStatus[key] = "pending";
    }
  },

  allTrackingSourcesCompleted: function() {
    for(key in this.trackingSourcesStatus) {
      if(this.trackingSourcesStatus[key] === "pending") {
        return false;
      }
    }

    return true;
  },

  allTrackingSourcesSucceeded: function() {
    for(key in this.trackingSourcesStatus) {
      if(this.trackingSourcesStatus[key] === "pending" || this.trackingSourcesStatus[key] === "failed") {
        return false;
      }
    }

    return true;
  },

  getOrdinalSuffix: function(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
  },

  dayLookup: {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "saturday"
  },

  monthLookup: {
    0: "January",
    1: "February",
    2: "March",
    3: "April",
    4: "May",
    5: "June",
    6: "July",
    7: "August",
    8: "September",
    9: "October",
    10: "November",
    11: "December"
  },

  getDeliveryStringFromDate: function(date) {
    var weekday = this.dayLookup[date.getDay()];
    var monthString = this.monthLookup[date.getMonth()];
    var dayNumber = this.getOrdinalSuffix(date.getDate());
    var year = date.getFullYear();

    return weekday + " " + monthString + " " + dayNumber + ", " + year;
  },
  
  getTableLine: function(table, cell1, cell2) {
    var tableRow = document.createElement("tr");

    if(!cell2) {
      if(cell1 === "None") {
        tableRow.className = "small";
      }

      var tableData = document.createElement("td");
      tableData.innerHTML = cell1;

      tableRow.appendChild(tableData);

      table.appendChild(tableRow);
    } else {
      tableRow.className = "small";

      var tableData1 = document.createElement("td");
      tableData1.innerHTML = cell1;

      tableRow.appendChild(tableData1);

      var tableData2 = document.createElement("td");
      tableData2.innerHTML = cell2;

      tableRow.appendChild(tableData2);

      table.appendChild(tableRow);
    }
  },

  getHtmlForCarrier: function(carrier, table) {
    var carrierName;

    switch(carrier) {
      case "fedex":
        carrierName = "Fedex";
        break;
      case "ups":
        carrierName = "UPS";
        break;
      case "usps":
        carrierName = "USPS";
        break;
      default:
        carrierName = carrier;
    }

    this.getTableLine(table, carrierName);

    if(Object.keys(this.trackingResults[carrier]).length === 0){
      this.getTableLine(table, "None");
    } else {
      for(key in this.trackingResults[carrier]) {
        this.getTableLine(table, key, this.trackingResults[carrier][key]);
      }
    }
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = this.config.tableClass;

    if (this.config.trackingNumbersUrl === "") {
      wrapper.innerHTML = "Please provide a URL to fetch tracking numbers from the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var table = document.createElement("table");
    wrapper.appendChild(table);

     //Fedex
    this.getHtmlForCarrier("fedex", table);

    //UPS
    this.getHtmlForCarrier("ups", table);

    //USPS
    this.getHtmlForCarrier("usps", table);

    return wrapper;
  },

  /* updateTrackingInfo(compliments)
   * Requests new tracking numbers and checks those tracking numbers
   * on Fedex, UPS, and USPS
   * Calls processTrackingInfo on succesfull response.
   */
  updateTrackingInfo: function () {
    if (this.config.trackingNumbersUrl === "") {
      Log.error("Tracking: trackingNumbersUrl not set!");
      return;
    }

    var proxyurl = "https://cors-anywhere.herokuapp.com/";
    var url = this.config.trackingNumbersUrl;
    var self = this;
    var retry = false;

    var trackingNumbersRequest = new XMLHttpRequest();
    trackingNumbersRequest.open("GET", proxyurl + url, true);
    trackingNumbersRequest.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    trackingNumbersRequest.onreadystatechange = function () {
      if (this.readyState === 4) {
        if (this.status === 200) {
          self.resetTrackingSourcesStatus();
          self.resetTrackingResults();
          self.processTrackingNumbers(JSON.parse(this.response));
        } else {
          self.scheduleUpdate(self.config.retryDelay);
          Log.error(self.name + ": Could not fetch tracking numbers.");
        }
      }
    };
    trackingNumbersRequest.send();
  },

  carrierProcessingFinishedCallback: function() {
    if(!this.allTrackingSourcesCompleted()) {
      return;
    }

    if(!this.allTrackingSourcesSucceeded) {
      self.scheduleUpdate(self.config.retryDelay);
    }

    this.show(this.config.animationSpeed, { lockString: this.identifier });
    this.loaded = true;
    this.scheduleUpdate();
    this.updateDom(this.config.animationSpeed);
  },

  processTrackingNumbers: function (data) {
    this.trackingNumbers = data;
    
    this.processUpsTrackingNumbers(data.ups);
    this.processUspsTrackingNumbers(data.usps, this.carrierProcessingFinishedCallback.bind(this));
    this.processFedexTrackingNumbers(data.fedex, this.carrierProcessingFinishedCallback.bind(this));
  },

  processFedexTrackingNumbers: function (trackingNumbers, callback) {
    if (trackingNumbers.length === 0) {
      this.trackingSourcesStatus.fedex = "succeeded";
      this.trackingResults.fedex = {};
      return;
    }

    var data = {
      TrackPackagesRequest:{
        appType:"WTRK",
        appDeviceType:"DESKTOP",
        supportHTML:true,
        supportCurrentLocation:true,
        uniqueKey:"",
        processingParameters:{

        },
        trackingInfoList:[]
      }
    };
    

    trackingNumbers.forEach(function(trackingNumber){
      data.TrackPackagesRequest.trackingInfoList.push({
        trackNumberInfo:{
            trackingNumber:"" + trackingNumber,
            trackingQualifier:"",
            trackingCarrier:""
          }
      });
    });

    var url = "https://www.fedex.com/trackingCal/track?action=trackpackages";
    url += "&data=" + JSON.stringify(data);

    var self = this;

    var fedexTrackingRequest = new XMLHttpRequest();
    fedexTrackingRequest.open("GET", url, true);
    fedexTrackingRequest.onreadystatechange = function () {
      if (this.readyState === 4) {
        if (this.status === 200) {
          var result = JSON.parse(this.response);
          result.TrackPackagesResponse.packageList.forEach(function(package) {
            if(package.keyStatus === "Delivered") {
              self.trackingResults.fedex[package.displayTrackingNbr] = "Delivered";
            } else if(package.keyStatus === "In transit") {
              self.trackingResults.fedex[package.displayTrackingNbr] = package.displayEstDeliveryDateTime;
            } else {
              self.trackingResults.fedex[package.displayTrackingNbr] = "Unhandled Status: " + package.keyStatus;
            }
          });
          self.trackingSourcesStatus.fedex = "succeeded";
        } else {
          self.trackingSourcesStatus.fedex = "failed";
          this.trackingResults.fedex["Error: "] = "Could not fetch tracking info.";
          Log.error(self.name + ": Could not fetch fedex tracking info.");
        }

        callback();
      }
    };
    fedexTrackingRequest.onerror = function() {
      trackingSourcesStatus.fedex = "failed";
      this.trackingResults.fedex["Error: "] = "XMLHttpRequest failed.";
      callback();
      Log.error(self.name + ": fedex XMLHttpRequest failed.");
    };
    fedexTrackingRequest.send();
  },

  processUspsTrackingHtml: function(responseText) {
    parser=new DOMParser();
    var dom = parser.parseFromString(responseText,"text/html");
    
    trackingResults = dom.getElementsByClassName("track-bar-container");

    var self = this;

    Array.from(trackingResults).forEach(function(node, i) {

      var trackingNumber;
      try{
        trackingNumber = node.getElementsByClassName("tracking-number")[0].textContent.trim();
      } catch(e) {
        trackingNumber = "Unknown" + i;
        Log.error("DOM structure for usps tracking numbers has changed. Could not obtain tracking number.");
      }

      if(node.getElementsByClassName("delivery_delivered").length) {
        self.trackingResults.usps[trackingNumber] = "Delivered";
        return;
      }

      try{
        var weekday = node.getElementsByClassName("day")[0].textContent;
        var dayNumber = node.getElementsByClassName("date")[0].textContent;
        dayNumber = self.getOrdinalSuffix(dayNumber);

        var monthYearNode = node.getElementsByClassName("month_year")[0];
        var monthNode = monthYearNode.getElementsByTagName("span")[0];

        var monthString = monthNode.textContent.trim();

        monthYearNode.removeChild(monthNode);

        var hintNode = monthYearNode.getElementsByClassName("hint")[0];
        monthYearNode.removeChild(hintNode);


        var year = monthYearNode.textContent.trim();

        var deliveryEstimateString = weekday + " " + monthString + " " + dayNumber + ", " + year;

        self.trackingResults.usps[trackingNumber] = deliveryEstimateString;
      } catch(e) {
        self.trackingResults.usps[trackingNumber] = "Unexpected Dom Format";
        Log.error("could not determine deliver date for usps tracking number " + trackingNumber + ". This is probably because of an an unexpected DOM format for usps numbers.")
      }
    });
  },

  processUspsTrackingNumbers: function(trackingNumbers, callback) {
    if (trackingNumbers.length === 0) {
      this.trackingSourcesStatus.usps = "succeeded";
      this.trackingResults.usps = {};
      return;
    }

    var proxyurl = "https://cors-anywhere.herokuapp.com/";
    var url = "https://tools.usps.com/go/TrackConfirmAction?tRef=fullpage&tLc=3&text28777=&tLabels=";
    
    trackingNumbers.forEach(function(trackingNumber) {
      url += trackingNumber + ","
    });

    var self = this;

    var uspsTrackingRequest = new XMLHttpRequest();
    uspsTrackingRequest.open("GET", proxyurl + url, true);
    uspsTrackingRequest.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    uspsTrackingRequest.onreadystatechange = function () {
      if (this.readyState === 4) {
        if (this.status === 200) {
          self.processUspsTrackingHtml(this.responseText);
          self.trackingSourcesStatus.usps = "succeeded";
        } else {
          self.trackingSourcesStatus.usps = "failed";
          this.trackingResults.usps["Error: "] = "Could not fetch usps tracking info.";
          Log.error(self.name + ": Could not fetch usps tracking info.");
        }

        callback();
      }
    };
    uspsTrackingRequest.onerror = function() {
      trackingSourcesStatus.usps = "failed";
      this.trackingResults.usps["Error: "] = "XMLHttpRequest failed.";
      callback();
      Log.error(self.name + ": usps XMLHttpRequest failed.");
    };
    uspsTrackingRequest.send();
  },

  processUpsTrackingHtml: function(responseText, callback) {
    if(this.trackingNumbers.ups.length > 1) {
      this.processMultipleUpsNumbersHtml(responseText);
    } else {
      this.processSingleUpsNumberHtml(responseText);
    }

    this.carrierProcessingFinishedCallback()
  },

  processMultipleUpsNumbersHtml: function(responseText) {
    parser=new DOMParser();
    var dom = parser.parseFromString(responseText,"text/html");
    
    trackingResults = dom.querySelectorAll( "li div.ups-card" );

    var self = this;

    Array.from(trackingResults).forEach(function(node, i) {
      var trackingNumber;
      try{
        trackingNumber = node.querySelector("a").textContent.trim()
      } catch(e) {
        this.trackingSourcesStatus.ups = "failed";
        trackingNumber = "Unknown" + i;
        Log.error("DOM structure for multiple ups tracking numbers has changed. Could not obtain tracking number.");
      }

      if(node.querySelector("#stApp_SummaryTracked_packageStatusDesciption_0").textContent.trim().toLowerCase === "delivered") {
        self.trackingResults.usps[trackingNumber] = "Delivered";
        return;
      }

      try{
        var dateNode = node.querySelectorAll(".row")[1].querySelector("div");
        var statusNode = dateNode.querySelector("strong");
        dateNode.removeChild(statusNode);

        var dateString = dateNode.textContent.trim();
                
        var now = new Date();

        var currentYear = new now.getFullYear();

        var deliveryDate = new Date(currentYear + "/" + dateString);

        //package will be delivered after December 31st, so we need to increment the date.
        if(deliveryDate < now) {
          deliveryDate = new Date((currentYear + 1) + "/" + dateString);
        }

        var deliveryEstimateString = self.getDeliveryStringFromDate(deliverDate);

        self.trackingResults.ups[trackingNumber] = deliveryEstimateString;
      } catch(e) {
        self.trackingSourcesStatus.ups = "failed";
        self.trackingResults.ups[trackingNumber] = "Unexpected Dom Format";
        Log.error("could not determine deliver date for usps tracking number " + trackingNumber + ". This is probably because of an an unexpected DOM format for mulitple ups numbers.")
      }
    });

    if(this.trackingSourcesStatus.ups === "pending") {
      this.trackingSourcesStatus.ups = "succeeded";
    }
  },
  
  processSingleUpsNumberHtml: function() {
    this.trackingSourcesStatus.ups = "succeeded";
  },

  processUpsTrackingNumbers: function(trackingNumbers) {
    if (trackingNumbers.length === 0) {
      this.trackingSourcesStatus.ups = "succeeded";
      this.trackingResults.ups = {};
      return;
    }
    
    var url = "https://www.ups.com/track?loc=en_US&tracknum=";

    for(var i = 0; i < trackingNumbers.length; i++) {
      if(i === length - 1) {
        url += trackingNumbers[i];
      } else {
        url += trackingNumbers[i] + "%20";
      }
    }

    url += "&requester=WT/tracksummary";

    this.sendSocketNotification("MMM_TRACKING_GET_HTML_FOR_URL", {
      url: url,
      carrier: "ups"
    });
  },

  /* scheduleUpdate()
   * Schedule next update.
   *
   * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
   */
  scheduleUpdate: function (delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function () {
      self.updateTrackingInfo();
    }, nextLoad);
  },
});
