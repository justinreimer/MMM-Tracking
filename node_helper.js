const NodeHelper = require("node_helper");
const ping = require("puppeteer");

module.exports = NodeHelper.create({
  start: function() {
    console.log(this.name + " helper started ...");
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "MMM_TRACKING_GET_HTML_FOR_URL") {
      const self = this;

      puppeteer.launch()
      .then(function(browser) {
        return browser.newPage();
      })
      .then(function(page) {
        return page.goto(payload.url).then(function() {
          return page.content();
        });
      })
      .then(function(html) {
        self.sendSocketNotification(
          "MMM_TRACKING_GET_HTML_FOR_URL_SUCCEEDED",
          {
            html: html,
            carrier: payload.carrier
          }
        );
      })
      .catch(function(err) {
        self.sendSocketNotification(
          "MMM_TRACKING_GET_HTML_FOR_URL_FAILED",
          {
            carrier: payload.carrier
          }
        );
      });     
    }
  },
});
