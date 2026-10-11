(function () {
  "use strict";

  if (!window.ThanhtamAuth || !ThanhtamAuth.getSession()) return;

  var PAGE_TITLES = {
    dashboard: "Tổng quan",
    supply: "Nguồn cung",
    price: "Tra cứu giá đất",
    staff: "Danh sách nhân viên",
    contracts: "Hợp đồng Kinh doanh"
  };

  var state = {
    page: "dashboard",
    mobileOpen: false,
    collapsed: false
  };

  function fold(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function syncSidebar() {
    var mobile = isMobile();
    var sidebar = document.getElementById("sidebar");
    var toggle = document.getElementById("sidebar-toggle");
    var expanded = mobile ? state.mobileOpen : !state.collapsed;

    sidebar.classList.toggle("is-open", mobile && state.mobileOpen);
    sidebar.classList.toggle("is-collapsed", !mobile && state.collapsed);
    document.getElementById("backdrop").classList.toggle("is-visible", mobile && state.mobileOpen);
    document.body.classList.toggle("menu-lock", mobile && state.mobileOpen);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", mobile
      ? (state.mobileOpen ? "Đóng menu" : "Mở menu")
      : (state.collapsed ? "Mở rộng menu" : "Thu gọn menu"));
    document.getElementById("icon-menu").classList.toggle("is-hidden", mobile && state.mobileOpen);
    document.getElementById("icon-close").classList.toggle("is-hidden", !(mobile && state.mobileOpen));
    document.querySelectorAll(".nav-link").forEach(function (link) {
      link.title = !mobile && state.collapsed ? link.dataset.label : "";
    });
  }

  function showPage(page) {
    if (!PAGE_TITLES[page]) return;
    state.page = page;
    document.querySelectorAll("[data-page]").forEach(function (section) {
      section.classList.toggle("is-hidden", section.dataset.page !== page);
    });
    document.querySelectorAll(".nav-link").forEach(function (link) {
      var active = link.dataset.go === page;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = PAGE_TITLES[page] + " · Thành Tâm Hà Tĩnh";
    state.mobileOpen = false;
    syncSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
    var heading = document.querySelector('[data-page="' + page + '"] h1');
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  function createFilter(options) {
    var type = "all";

    function apply() {
      var query = options.input ? options.input.value.trim() : "";
      var district = options.district ? options.district.value : "all";
      var visible = 0;
      document.querySelectorAll(options.rowSelector).forEach(function (row) {
        var typeOk = type === "all" || row.dataset.type === type;
        var districtOk = district === "all" || row.dataset.district === district;
        var queryOk = !query || fold(row.textContent).includes(fold(query));
        var show = typeOk && districtOk && queryOk;
        row.classList.toggle("is-hidden", !show);
        if (show) visible += 1;
      });
      if (options.table) options.table.classList.toggle("is-hidden", visible === 0);
      if (options.empty) options.empty.classList.toggle("is-hidden", visible !== 0);
      if (options.count) options.count.textContent = options.countLabel(visible);
    }

    if (options.live !== false && options.input) {
      options.input.addEventListener("input", apply);
    }
    if (options.chips) {
      options.chips.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-filter]");
        if (!chip || !options.chips.contains(chip)) return;
        type = chip.dataset.filter;
        options.chips.querySelectorAll(".chip").forEach(function (item) {
          item.classList.toggle("is-on", item === chip);
        });
        apply();
      });
    }

    return {
      apply: apply,
      resetType: function () { type = "all"; }
    };
  }

  function renderProfile() {
    var session = ThanhtamAuth.getSession();
    var nameNode = document.getElementById("topbarUserName");
    var emailNode = document.getElementById("topbarUserEmail");
    var welcome = document.getElementById("welcome-name");
    var logoutNode = document.getElementById("btnLogout");
    if (nameNode) nameNode.textContent = session.name;
    if (emailNode) emailNode.textContent = session.email;
    if (welcome) welcome.textContent = session.name;
    if (logoutNode) logoutNode.setAttribute("aria-label", "Đăng xuất " + session.name);
  }

  var supplyFilter = createFilter({
    rowSelector: "#supply-table tbody tr",
    input: document.getElementById("supply-search"),
    chips: document.getElementById("supply-chips"),
    table: document.getElementById("supply-table"),
    empty: document.getElementById("supply-empty"),
    count: document.getElementById("supply-count"),
    countLabel: function (n) { return n + " nguồn cung"; }
  });

  var priceFilter = createFilter({
    rowSelector: "#price-table tbody tr",
    input: document.getElementById("price-keyword"),
    district: document.getElementById("price-district"),
    table: document.getElementById("price-table"),
    empty: document.getElementById("price-empty"),
    count: document.getElementById("price-count"),
    countLabel: function (n) { return n + " kết quả"; },
    live: false
  });

  var staffFilter = createFilter({
    rowSelector: "#staff-list .staff-card",
    input: document.getElementById("staff-search"),
    empty: document.getElementById("staff-empty"),
    count: document.getElementById("staff-count"),
    countLabel: function (n) { return n + " nhân viên"; }
  });

  var contractFilter = createFilter({
    rowSelector: "#contract-table tbody tr",
    input: document.getElementById("contract-search"),
    chips: document.getElementById("contract-chips"),
    table: document.getElementById("contract-table"),
    empty: document.getElementById("contract-empty"),
    count: document.getElementById("contract-count"),
    countLabel: function (n) { return n + " hợp đồng"; }
  });

  document.getElementById("sidebar-toggle").addEventListener("click", function () {
    if (isMobile()) state.mobileOpen = !state.mobileOpen;
    else state.collapsed = !state.collapsed;
    syncSidebar();
  });

  document.getElementById("backdrop").addEventListener("click", function () {
    state.mobileOpen = false;
    syncSidebar();
  });

  var logoutButton = document.getElementById("btnLogout");
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      ThanhtamAuth.logout();
    });
  }

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-go]");
    if (!target || target.dataset.go === "supply") return;
    showPage(target.dataset.go);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.mobileOpen) {
      state.mobileOpen = false;
      syncSidebar();
      document.getElementById("sidebar-toggle").focus();
    }
  });

  window.addEventListener("resize", function () {
    if (!isMobile()) state.mobileOpen = false;
    syncSidebar();
  });

  document.getElementById("price-form").addEventListener("submit", function (event) {
    event.preventDefault();
    priceFilter.apply();
  });

  document.getElementById("price-reset").addEventListener("click", function () {
    document.getElementById("price-form").reset();
    priceFilter.apply();
  });

  var todayText = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  document.getElementById("today").textContent = todayText.charAt(0).toUpperCase() + todayText.slice(1);

  renderProfile();
  supplyFilter.apply();
  priceFilter.apply();
  staffFilter.apply();
  contractFilter.apply();
  syncSidebar();
})();
