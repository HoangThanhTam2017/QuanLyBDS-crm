(function (global) {
  "use strict";

  function authHeaders(extra) {
    var headers = Object.assign({
      Accept: "application/json",
      "Content-Type": "application/json"
    }, extra || {});
    var session = global.ThanhtamAuth && ThanhtamAuth.getSession();
    if (session && session.email) {
      headers.Authorization = "Bearer " + session.email;
    }
    return headers;
  }

  var API = {
    baseUrl: global.THANHTAM_API_BASE || "http://127.0.0.1:8000",

    request: async function (path, options) {
      var config = options || {};
      var response = await fetch(this.baseUrl + path, {
        method: config.method || "GET",
        headers: authHeaders(config.headers),
        body: config.body ? JSON.stringify(config.body) : undefined
      });

      if (response.status === 401 && global.ThanhtamAuth) {
        ThanhtamAuth.logout();
        return null;
      }
      if (!response.ok) {
        throw new Error("Máy chủ phản hồi mã " + response.status);
      }
      if (response.status === 204) return null;
      return response.json();
    },

    getSupply: function () {
      return this.request("/api/supply");
    },

    getLandPrices: function (params) {
      var query = new URLSearchParams(params || {}).toString();
      return this.request("/api/land-prices" + (query ? "?" + query : ""));
    },

    getStaff: function () {
      return this.request("/api/staff");
    },

    getContracts: function () {
      return this.request("/api/contracts");
    }
  };

  global.ThanhtamAPI = API;
})(window);
