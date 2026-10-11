(function () {
  "use strict";

  var API_ORIGIN = "http://localhost:8000";

  function applyCurrentUser(data) {
    var nameNode = document.getElementById("topbarUserName");
    var emailNode = document.getElementById("topbarUserEmail");
    var name = data && data.full_name ? String(data.full_name).trim() : "";
    var email = data && data.email ? String(data.email).trim() : "";
    if (nameNode && name) nameNode.textContent = name;
    if (emailNode && email) emailNode.textContent = email;
  }

  function loadCurrentUser() {
    if (!document.getElementById("topbarUserName") && !document.getElementById("topbarUserEmail")) return;
    var token = localStorage.getItem("accessToken");
    if (!token) return;
    fetch(API_ORIGIN + "/api/me", {
      headers: { Authorization: "Bearer " + token }
    }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (data) {
      if (data) applyCurrentUser(data);
    }).catch(function (error) {
      console.error("GET /api/me lỗi:", error);
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("#btnSettings");
    if (!button || !document.getElementById("phone-modal")) return;
    event.preventDefault();
    if (typeof window.openPhoneSettings === "function") window.openPhoneSettings();
  });

  function bindSidebarToggle() {
    if (window.__sidebarToggleBound) return;
    var toggle = document.getElementById("sidebar-toggle");
    var sidebar = document.getElementById("sidebar");
    var backdrop = document.getElementById("backdrop");
    if (!toggle || !sidebar) return;
    window.__sidebarToggleBound = true;

    var state = { mobileOpen: false, collapsed: false };

    function isMobile() {
      return window.matchMedia("(max-width: 767px)").matches;
    }

    function syncSidebar() {
      var mobile = isMobile();
      var menuIcon = document.getElementById("icon-menu");
      var closeIcon = document.getElementById("icon-close");
      sidebar.classList.toggle("is-open", mobile && state.mobileOpen);
      sidebar.classList.toggle("show", mobile && state.mobileOpen);
      sidebar.classList.toggle("is-collapsed", !mobile && state.collapsed);
      if (backdrop) backdrop.classList.toggle("is-visible", mobile && state.mobileOpen);
      document.body.classList.toggle("menu-lock", mobile && state.mobileOpen);
      toggle.setAttribute("aria-expanded", String(mobile ? state.mobileOpen : !state.collapsed));
      toggle.setAttribute("aria-label", mobile ? (state.mobileOpen ? "Đóng menu" : "Mở menu") : (state.collapsed ? "Mở rộng menu" : "Thu gọn menu"));
      if (menuIcon) menuIcon.classList.toggle("is-hidden", mobile && state.mobileOpen);
      if (closeIcon) closeIcon.classList.toggle("is-hidden", !(mobile && state.mobileOpen));
    }

    function closeMobileSidebar() {
      if (!state.mobileOpen) return;
      state.mobileOpen = false;
      syncSidebar();
    }

    window.closeMobileSidebar = closeMobileSidebar;

    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      if (isMobile()) state.mobileOpen = !state.mobileOpen;
      else state.collapsed = !state.collapsed;
      syncSidebar();
    });

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeMobileSidebar();
      });
    }

    sidebar.addEventListener("click", function (event) {
      if (isMobile() && event.target.closest(".nav-link")) closeMobileSidebar();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMobileSidebar();
    });

    window.addEventListener("resize", function () {
      if (!isMobile() && state.mobileOpen) {
        state.mobileOpen = false;
        syncSidebar();
      }
    });

    syncSidebar();
  }

  function boot() {
    loadCurrentUser();
    bindSidebarToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
