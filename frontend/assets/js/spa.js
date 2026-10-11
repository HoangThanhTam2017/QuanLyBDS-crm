(function () {
  "use strict";

  function isSystemAdmin() {
    var label = String(localStorage.getItem("user_role") || "").trim().toLowerCase();
    if (label === "admin") return true;
    var user = null;
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
      user = null;
    }
    if (!user) return false;
    var role = String(user.role || "").trim().toLowerCase();
    var title = String(user.chuc_vu || "").trim().toLowerCase();
    return role === "admin" || title === "admin";
  }

  function hideAdminOnlyModules() {
    var hide = !isSystemAdmin();
    ["cardPendingPosts", "cardManageUsers", "navPendingPosts", "navManageUsers"].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      var next = hide ? "none" : "";
      if (node.style.display !== next) node.style.display = next;
    });
  }

  function bootSidebarOnce() {
    if (window.__sidebarBooted) return;
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    window.__sidebarBooted = true;
    hideAdminOnlyModules();
    sidebar.classList.add("is-ready");
  }

  window.isSystemAdmin = isSystemAdmin;
  window.hideAdminOnlyModules = hideAdminOnlyModules;
  window.bootSidebarOnce = bootSidebarOnce;
  bootSidebarOnce();

  function setActive(page, navBtn) {
    document.querySelectorAll("#sidebar .nav-link").forEach(function (link) {
      link.classList.remove("is-active", "active");
      link.removeAttribute("aria-current");
    });
    var current = document.querySelector('#sidebar .nav-link[data-go="' + page + '"]') || navBtn;
    if (!current) return;
    current.classList.add("is-active", "active");
    current.setAttribute("aria-current", "page");
  }

  function syncModal(doc, id) {
    var nextModal = doc.getElementById(id);
    var currentModal = document.getElementById(id);
    if (nextModal) {
      var copy = document.importNode(nextModal, true);
      if (currentModal) currentModal.replaceWith(copy);
      else document.body.appendChild(copy);
      return;
    }
    if (currentModal) currentModal.remove();
  }

  function renderPage(url, page, navBtn, push) {
    var slot = document.getElementById("main-content");
    if (!slot) return;

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("Không tải được trang");
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.getElementById("main-content");
        if (!next) return;
        slot.innerHTML = next.innerHTML;
        syncModal(doc, "property-modal");
        syncModal(doc, "edit-modal");
        syncModal(doc, "prepare-modal");
        syncModal(doc, "lightbox");
        syncModal(doc, "user-add-modal");
        syncModal(doc, "user-edit-modal");
        if (doc.title) document.title = doc.title;
        if (push !== false) history.pushState(null, "", url);
        setActive(page, navBtn);
        window.scrollTo(0, 0);
        hideAdminOnlyModules();
        if (url === "dashboard.html") {
          doc.querySelectorAll("script[data-dashboard-count]").forEach(function (script) {
            var next = document.createElement("script");
            next.textContent = script.textContent;
            document.body.appendChild(next);
          });
          if (window.bindDashboardPanels) window.bindDashboardPanels();
        }
        if (url === "properties.html" && window.loadPropertyFeed) window.loadPropertyFeed();
        if (url === "pending-posts.html" && window.loadPendingPosts) window.loadPendingPosts();
        if (url === "users.html" && window.loadUsers) window.loadUsers();
        if (url === "land-prices.html") {
          doc.querySelectorAll("script[data-land-prices]").forEach(function (script) {
            var next = document.createElement("script");
            next.textContent = script.textContent;
            document.body.appendChild(next);
          });
        }
        if (url === "contracts.html") {
          doc.querySelectorAll("script[data-contracts]").forEach(function (script) {
            var next = document.createElement("script");
            next.textContent = script.textContent;
            document.body.appendChild(next);
          });
        }
        if (url === "reports.html") {
          doc.querySelectorAll("script[data-reports]").forEach(function (script) {
            var next = document.createElement("script");
            next.textContent = script.textContent;
            document.body.appendChild(next);
          });
        }
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  document.addEventListener("click", function (e) {
    var navBtn = e.target.closest("[data-go]");
    if (!navBtn) return;

    e.preventDefault();

    var page = navBtn.getAttribute("data-go");
    if ((page === "pending" || page === "staff") && !isSystemAdmin()) {
      window.location.href = "dashboard.html";
      return;
    }
    var url = "";
    var inPage = page === "dashboard";
    if (inPage && window.showDashboardPage && document.querySelector("#main-content .main-inner > section[data-page='" + page + "']")) {
      window.showDashboardPage(page, e);
      setActive(page, navBtn);
      return;
    }
    if (page === "supply") url = "properties.html";
    else if (page === "dashboard") url = "dashboard.html";
    else if (page === "pending") url = "pending-posts.html";
    else if (page === "staff") url = "users.html";
    else if (page === "price") url = "land-prices.html";
    else if (page === "contracts") url = "contracts.html";
    else if (page === "reports") url = "reports.html";
    if (!url) return;

    renderPage(url, page, navBtn, true);
  });

  window.addEventListener("popstate", function () {
    var file = location.pathname.split("/").pop() || "";
    if ((file === "pending-posts.html" || file === "users.html") && !isSystemAdmin()) {
      window.location.replace("dashboard.html");
      return;
    }
    if (file === "properties.html") renderPage("properties.html", "supply", null, false);
    else if (file === "dashboard.html") renderPage("dashboard.html", "dashboard", null, false);
    else if (file === "pending-posts.html") renderPage("pending-posts.html", "pending", null, false);
    else if (file === "users.html") renderPage("users.html", "staff", null, false);
    else if (file === "land-prices.html") renderPage("land-prices.html", "price", null, false);
    else if (file === "contracts.html") renderPage("contracts.html", "contracts", null, false);
    else if (file === "reports.html") renderPage("reports.html", "reports", null, false);
  });

  document.addEventListener("click", function (event) {
    var more = event.target.closest(".js-see-more");
    if (more) {
      var text = more.previousElementSibling;
      if (!text) return;
      text.classList.toggle("line-clamp-2");
      more.textContent = text.classList.contains("line-clamp-2") ? "Xem thêm" : "Ẩn bớt";
      return;
    }

    if (event.target.closest("#open-composer")) {
      var modal = document.getElementById("property-modal");
      if (!modal) return;
      modal.classList.remove("is-hidden");
      if (window.fillPropertyComposer) window.fillPropertyComposer();
      return;
    }

    if (event.target.closest("#close-modal, #cancel-modal, #modal-backdrop")) {
      var openModal = document.getElementById("property-modal");
      if (openModal) openModal.classList.add("is-hidden");
    }
    if (event.target.closest("#close-edit, #cancel-edit, #edit-backdrop")) {
      var editModal = document.getElementById("edit-modal");
      if (editModal) editModal.classList.add("is-hidden");
    }
    if (event.target.closest("#cancel-prepare, #close-prepare, #prepare-backdrop")) {
      var prepareModal = document.getElementById("prepare-modal");
      if (prepareModal) prepareModal.classList.add("is-hidden");
    }
  });

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (form.id === "filter-form") {
      event.preventDefault();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var modal = document.getElementById("property-modal");
    if (modal && !modal.classList.contains("is-hidden")) modal.classList.add("is-hidden");
    var editModal = document.getElementById("edit-modal");
    if (editModal && !editModal.classList.contains("is-hidden")) editModal.classList.add("is-hidden");
    var prepareModal = document.getElementById("prepare-modal");
    if (prepareModal && !prepareModal.classList.contains("is-hidden")) prepareModal.classList.add("is-hidden");
    if (window.closeLightbox) window.closeLightbox();
  });
})();
