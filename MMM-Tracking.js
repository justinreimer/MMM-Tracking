
Module.register("MMM-Tracking", {
  // Default module config.
  defaults: {
    trackingNumbersUrl: "",
    updateInterval: 60 * 60 * 1000, // every hour
    tableClass: "large",
    lang: config.language,
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500
  },

  // Define required scripts.
  getStyles: function () {
    return ["tracking.css"];
  },

  // Define start sequence.
  start: function () {
    Log.info("Starting module: " + this.name);

    //TODO: delete this if not needed
    //uncomment if Object.keys is not defined
    /*
    if (!Object.keys) {
      Object.keys = function (obj) {
        var keys = [];
        var k;

        for (k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            keys.push(k);
          }
        }

        return keys;
      };
    }
    */

    this.trackingResults = {
      fedex: {},
      ups: {},
      usps: {}
    };

    this.trackingSourcesStatus = {
      fedex: "pending",
      ups: "pending",
      usps: "pending"
    };

    this.scheduleUpdate(this.config.initialLoadDelay);
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

    getTableLine(table, carrierName);

    if(Object.keys(this.trackingResults[carrier]).length === 0){
      getTableLine(table, "None");
    } else {
      for(key in this.trackingResults[carrier]) {
        getTableLine(table, key, this.trackingResults[carrier][key]);
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
    getHtmlForCarrier("fedex", table);

    //UPS
    getHtmlForCarrier("ups", table);

    //USPS
    getHtmlForCarrier("usps", table);

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
    if(!allTrackingSourcesCompleted()) {
      return;
    }

    if(!allTrackingSourcesSucceeded) {
      self.scheduleUpdate(self.config.retryDelay);
      return;
    }

    this.show(this.config.animationSpeed, { lockString: this.identifier });
    this.loaded = true;
    self.scheduleUpdate();
    this.updateDom(this.config.animationSpeed);
  },

  processTrackingNumbers: function (data) {
    //TODO: implement UPS and USPS tracking here
    this.trackingSourcesStatus.ups = "succeeded";
    this.trackingSourcesStatus.usps = "succeeded";
    this.processFedexTrackingInfo(data.fedex, carrierProcessingFinishedCallback);
  },

  processFedexTrackingInfo: function (trackingNumbers, callback) {
    if (trackingNumbers.length === 0) {
      this.trackingSourcesStatus.fedex = true;
      this.trackingResults.fedex[package.displayTrackingNbr] = package.displayEstDeliveryDateTime;
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

    trackinNumbers.forEach(function(trackingNumber){
      data.trackingInfoList.push({
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
            this.trackingResults.fedex[package.displayTrackingNbr] = package.displayEstDeliveryDateTime;
          });
          trackingSourcesStatus.fedex = "succeeded";
        } else {
          trackingSourcesStatus.fedex = "failed";
          Log.error(self.name + ": Could not fetch fedex tracking info.");
        }

        callback();
      }
    };
    fedexTrackingRequest.onerror = function() {
      trackingSourcesStatus.fedex = "failed";
      Log.error(self.name + ": fedex XMLHttpRequest failed.");
    };
    fedexTrackingRequest.send();
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
