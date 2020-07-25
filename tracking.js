Skip to content
Why GitHub? 
Team
Enterprise
Explore 
Marketplace
Pricing 
Search

Sign in
Sign up
MichMich
/
MagicMirror
67212.5k3.2k
Code
Issues
6
Pull requests
3
Actions
Projects
Wiki
Security
Insights
Join GitHub today
GitHub is home to over 50 million developers working together to host and review code, manage projects, and build software together.

  
/* Magic Mirror
 * Module: CurrentWeather
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("tracking", {
  // Default module config.
  defaults: {
    trackingNumbersUrl: ""
  },

  // create a variable for the first upcoming calendar event. Used if no location is specified.
  firstEvent: false,

  // create a variable to hold the location name based on the API result.
  fetchedLocationName: "",

  // Define required scripts.
  getStyles: function () {
    return ["tracking.css"];
  },

  // Define start sequence.
  start: function () {
    Log.info("Starting module: " + this.name);

    // Set locale.
    moment.locale(config.language);

    this.trackingResults = {
      fedex: {}
    };

    this.trackingNumbers = {
      fedex: []
    };
    this.scheduleUpdate(this.config.initialLoadDelay);
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

    var large = document.createElement("div");
    large.className = "light";

    if (this.config.hideTemp === false) {
      var weatherIcon = document.createElement("span");
      weatherIcon.className = "wi weathericon " + this.weatherType;
      large.appendChild(weatherIcon);

      var temperature = document.createElement("span");
      temperature.className = "bright";
      temperature.innerHTML = " " + this.temperature.replace(".", this.config.decimalSymbol) + degreeLabel;
      large.appendChild(temperature);
    }

    if (this.config.showIndoorTemperature && this.indoorTemperature) {
      var indoorIcon = document.createElement("span");
      indoorIcon.className = "fa fa-home";
      large.appendChild(indoorIcon);

      var indoorTemperatureElem = document.createElement("span");
      indoorTemperatureElem.className = "bright";
      indoorTemperatureElem.innerHTML = " " + this.indoorTemperature.replace(".", this.config.decimalSymbol) + degreeLabel;
      large.appendChild(indoorTemperatureElem);
    }

    if (this.config.showIndoorHumidity && this.indoorHumidity) {
      var indoorHumidityIcon = document.createElement("span");
      indoorHumidityIcon.className = "fa fa-tint";
      large.appendChild(indoorHumidityIcon);

      var indoorHumidityElem = document.createElement("span");
      indoorHumidityElem.className = "bright";
      indoorHumidityElem.innerHTML = " " + this.indoorHumidity + "%";
      large.appendChild(indoorHumidityElem);
    }

    wrapper.appendChild(large);

    if (this.config.showFeelsLike && this.config.onlyTemp === false) {
      var small = document.createElement("div");
      small.className = "normal medium";

      var feelsLike = document.createElement("span");
      feelsLike.className = "dimmed";
      feelsLike.innerHTML = this.translate("FEELS") + " " + this.feelsLike + degreeLabel;
      small.appendChild(feelsLike);

      wrapper.appendChild(small);
    }

    return wrapper;
  },

  /* updateWeather(compliments)
   * Requests new data from openweather.org.
   * Calls processWeather on succesfull response.
   */
  updateWeather: function () {
    if (this.config.appid === "") {
      Log.error("CurrentWeather: APPID not set!");
      return;
    }

    var url = this.config.apiBase + this.config.apiVersion + "/" + this.config.weatherEndpoint + this.getParams();
    var self = this;
    var retry = true;

    var weatherRequest = new XMLHttpRequest();
    weatherRequest.open("GET", url, true);
    weatherRequest.onreadystatechange = function () {
      if (this.readyState === 4) {
        if (this.status === 200) {
          self.processWeather(JSON.parse(this.response));
        } else if (this.status === 401) {
          self.updateDom(self.config.animationSpeed);

          Log.error(self.name + ": Incorrect APPID.");
          retry = true;
        } else {
          Log.error(self.name + ": Could not load weather.");
        }

        if (retry) {
          self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
        }
      }
    };
    weatherRequest.send();
  },

  /* getParams(compliments)
   * Generates an url with api parameters based on the config.
   *
   * return String - URL params.
   */
  getParams: function () {
    var params = "?";
    if (this.config.locationID) {
      params += "id=" + this.config.locationID;
    } else if (this.config.location) {
      params += "q=" + this.config.location;
    } else if (this.firstEvent && this.firstEvent.geo) {
      params += "lat=" + this.firstEvent.geo.lat + "&lon=" + this.firstEvent.geo.lon;
    } else if (this.firstEvent && this.firstEvent.location) {
      params += "q=" + this.firstEvent.location;
    } else {
      this.hide(this.config.animationSpeed, { lockString: this.identifier });
      return;
    }

    params += "&units=" + this.config.units;
    params += "&lang=" + this.config.lang;
    params += "&APPID=" + this.config.appid;

    return params;
  },

  /* processWeather(data)
   * Uses the received data to set the various values.
   *
   * argument data object - Weather information received form openweather.org.
   */
  processWeather: function (data) {
    if (!data || !data.main || typeof data.main.temp === "undefined") {
      // Did not receive usable new data.
      // Maybe this needs a better check?
      return;
    }

    this.humidity = parseFloat(data.main.humidity);
    this.temperature = this.roundValue(data.main.temp);
    this.fetchedLocationName = data.name;
    this.feelsLike = 0;

    if (this.config.useBeaufort) {
      this.windSpeed = this.ms2Beaufort(this.roundValue(data.wind.speed));
    } else if (this.config.useKMPHwind) {
      this.windSpeed = parseFloat((data.wind.speed * 60 * 60) / 1000).toFixed(0);
    } else {
      this.windSpeed = parseFloat(data.wind.speed).toFixed(0);
    }

    // ONLY WORKS IF TEMP IN C //
    var windInMph = parseFloat(data.wind.speed * 2.23694);

    var tempInF = 0;
    switch (this.config.units) {
      case "metric":
        tempInF = 1.8 * this.temperature + 32;
        break;
      case "imperial":
        tempInF = this.temperature;
        break;
      case "default":
        tempInF = 1.8 * (this.temperature - 273.15) + 32;
        break;
    }

    if (windInMph > 3 && tempInF < 50) {
      // windchill
      var windChillInF = Math.round(35.74 + 0.6215 * tempInF - 35.75 * Math.pow(windInMph, 0.16) + 0.4275 * tempInF * Math.pow(windInMph, 0.16));
      var windChillInC = (windChillInF - 32) * (5 / 9);
      // this.feelsLike = windChillInC.toFixed(0);

      switch (this.config.units) {
        case "metric":
          this.feelsLike = windChillInC.toFixed(0);
          break;
        case "imperial":
          this.feelsLike = windChillInF.toFixed(0);
          break;
        case "default":
          this.feelsLike = (windChillInC + 273.15).toFixed(0);
          break;
      }
    } else if (tempInF > 80 && this.humidity > 40) {
      // heat index
      var Hindex =
        -42.379 +
        2.04901523 * tempInF +
        10.14333127 * this.humidity -
        0.22475541 * tempInF * this.humidity -
        6.83783 * Math.pow(10, -3) * tempInF * tempInF -
        5.481717 * Math.pow(10, -2) * this.humidity * this.humidity +
        1.22874 * Math.pow(10, -3) * tempInF * tempInF * this.humidity +
        8.5282 * Math.pow(10, -4) * tempInF * this.humidity * this.humidity -
        1.99 * Math.pow(10, -6) * tempInF * tempInF * this.humidity * this.humidity;

      switch (this.config.units) {
        case "metric":
          this.feelsLike = parseFloat((Hindex - 32) / 1.8).toFixed(0);
          break;
        case "imperial":
          this.feelsLike = Hindex.toFixed(0);
          break;
        case "default":
          var tc = parseFloat((Hindex - 32) / 1.8) + 273.15;
          this.feelsLike = tc.toFixed(0);
          break;
      }
    } else {
      this.feelsLike = parseFloat(this.temperature).toFixed(0);
    }

    this.windDirection = this.deg2Cardinal(data.wind.deg);
    this.windDeg = data.wind.deg;
    this.weatherType = this.config.iconTable[data.weather[0].icon];

    var now = new Date();
    var sunrise = new Date(data.sys.sunrise * 1000);
    var sunset = new Date(data.sys.sunset * 1000);

    // The moment().format('h') method has a bug on the Raspberry Pi.
    // So we need to generate the timestring manually.
    // See issue: https://github.com/MichMich/MagicMirror/issues/181
    var sunriseSunsetDateObject = sunrise < now && sunset > now ? sunset : sunrise;
    var timeString = moment(sunriseSunsetDateObject).format("HH:mm");
    if (this.config.timeFormat !== 24) {
      //var hours = sunriseSunsetDateObject.getHours() % 12 || 12;
      if (this.config.showPeriod) {
        if (this.config.showPeriodUpper) {
          //timeString = hours + moment(sunriseSunsetDateObject).format(':mm A');
          timeString = moment(sunriseSunsetDateObject).format("h:mm A");
        } else {
          //timeString = hours + moment(sunriseSunsetDateObject).format(':mm a');
          timeString = moment(sunriseSunsetDateObject).format("h:mm a");
        }
      } else {
        //timeString = hours + moment(sunriseSunsetDateObject).format(':mm');
        timeString = moment(sunriseSunsetDateObject).format("h:mm");
      }
    }

    this.sunriseSunsetTime = timeString;
    this.sunriseSunsetIcon = sunrise < now && sunset > now ? "wi-sunset" : "wi-sunrise";

    this.show(this.config.animationSpeed, { lockString: this.identifier });
    this.loaded = true;
    this.updateDom(this.config.animationSpeed);
    this.sendNotification("CURRENTWEATHER_DATA", { data: data });
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
      self.updateWeather();
    }, nextLoad);
  },

  /* ms2Beaufort(ms)
   * Converts m2 to beaufort (windspeed).
   *
   * see:
   *  https://www.spc.noaa.gov/faq/tornado/beaufort.html
   *  https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
   *
   * argument ms number - Windspeed in m/s.
   *
   * return number - Windspeed in beaufort.
   */
  ms2Beaufort: function (ms) {
    var kmh = (ms * 60 * 60) / 1000;
    var speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000];
    for (var beaufort in speeds) {
      var speed = speeds[beaufort];
      if (speed > kmh) {
        return beaufort;
      }
    }
    return 12;
  },

  deg2Cardinal: function (deg) {
    if (deg > 11.25 && deg <= 33.75) {
      return "NNE";
    } else if (deg > 33.75 && deg <= 56.25) {
      return "NE";
    } else if (deg > 56.25 && deg <= 78.75) {
      return "ENE";
    } else if (deg > 78.75 && deg <= 101.25) {
      return "E";
    } else if (deg > 101.25 && deg <= 123.75) {
      return "ESE";
    } else if (deg > 123.75 && deg <= 146.25) {
      return "SE";
    } else if (deg > 146.25 && deg <= 168.75) {
      return "SSE";
    } else if (deg > 168.75 && deg <= 191.25) {
      return "S";
    } else if (deg > 191.25 && deg <= 213.75) {
      return "SSW";
    } else if (deg > 213.75 && deg <= 236.25) {
      return "SW";
    } else if (deg > 236.25 && deg <= 258.75) {
      return "WSW";
    } else if (deg > 258.75 && deg <= 281.25) {
      return "W";
    } else if (deg > 281.25 && deg <= 303.75) {
      return "WNW";
    } else if (deg > 303.75 && deg <= 326.25) {
      return "NW";
    } else if (deg > 326.25 && deg <= 348.75) {
      return "NNW";
    } else {
      return "N";
    }
  },

  /* function(temperature)
   * Rounds a temperature to 1 decimal or integer (depending on config.roundTemp).
   *
   * argument temperature number - Temperature.
   *
   * return string - Rounded Temperature.
   */
  roundValue: function (temperature) {
    var decimals = this.config.roundTemp ? 0 : 1;
    return parseFloat(temperature).toFixed(decimals);
  }
});
