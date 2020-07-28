const NodeHelper = require("node_helper");
const puppeteer = require("puppeteer");

module.exports = NodeHelper.create({
  start: function() {
    console.log(this.name + " helper started ...");
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "MMM_TRACKING_GET_HTML_FOR_URL") {
      const self = this;
      
      var currentPage;

      puppeteer.launch({ executablePath: "/usr/bin/chromium-browser", headless: true })
      .then(function(browser) {
        return browser.newPage();
      })
      .then(function(page) {
        currentPage = page;
        return currentPage.goto(payload.url, {
            timeout: 0
        }).then(function() {
          return currentPage.content();
        });
      })
      .then(function(html) {
        currentPage.close();
        self.sendSocketNotification(
          "MMM_TRACKING_GET_HTML_FOR_URL_SUCCEEDED",
          {
            html: html,
            carrier: payload.carrier
          }
        );
      })
      .catch(function(err) {
        currentPage.close();
        self.sendSocketNotification(
          "MMM_TRACKING_GET_HTML_FOR_URL_FAILED",
          {
            carrier: payload.carrier,
            err: err
          }
        );
      });     
    }
  },
});
