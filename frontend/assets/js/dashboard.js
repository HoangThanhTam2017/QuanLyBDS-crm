(function () {
  var API_ORIGIN = "http://localhost:8000";

  if (!localStorage.getItem("accessToken")) {
    window.location.replace("index.html");
    return;
  }

  function authHeaders() {
    return {
      Authorization: "Bearer " + localStorage.getItem("accessToken"),
      "Content-Type": "application/json"
    };
  }

  function showToast(message, tone) {
    var background = "#111827";
    if (tone === "error") background = "#b91c1c";
    if (tone === "success") background = "#15803d";
    var toast = document.getElementById("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      toast.setAttribute("role", "status");
      toast.style.position = "fixed";
      toast.style.left = "50%";
      toast.style.bottom = "1.5rem";
      toast.style.transform = "translateX(-50%)";
      toast.style.zIndex = "90";
      toast.style.maxWidth = "90vw";
      toast.style.padding = "0.75rem 1rem";
      toast.style.borderRadius = "999px";
      toast.style.background = background;
      toast.style.color = "#fff";
      toast.style.fontSize = "0.875rem";
      toast.style.fontWeight = "600";
      toast.style.textAlign = "center";
      toast.style.boxShadow = "0 10px 24px rgba(0,0,0,.25)";
      document.body.appendChild(toast);
    }
    toast.style.background = background;
    toast.textContent = message;
    toast.classList.remove("is-hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.add("is-hidden");
    }, 3200);
  }

  function setProfileCardVisible(visible) {
    var card = document.getElementById("profile-card");
    if (!card) return;
    card.classList.toggle("is-hidden", !visible);
  }

  function applyAccount(data) {
    var name = data.full_name || "";
    var phone = data.phone || "";
    localStorage.setItem("user_name", name);
    localStorage.setItem("user_phone", phone);
    if (data.id != null) localStorage.setItem("user_id", String(data.id));
    var accountRole = String(data.role || "").trim().toLowerCase();
    var accountTitle = String(data.chuc_vu || "").trim().toLowerCase();
    localStorage.setItem("user_role", (accountRole === "admin" || accountTitle === "admin") ? "Admin" : (data.chuc_vu || "nhân viên"));
    try {
      var stored = JSON.parse(localStorage.getItem("user") || "{}");
      stored.role = data.role || stored.role || "user";
      stored.chuc_vu = data.chuc_vu || stored.chuc_vu || "nhân viên";
      stored.nhom = data.nhom || stored.nhom || "";
      localStorage.setItem("user", JSON.stringify(stored));
    } catch (error) {
      localStorage.setItem("user", JSON.stringify({
        id: data.id,
        full_name: name,
        role: data.role || "user",
        nhom: data.nhom || "",
        chuc_vu: data.chuc_vu || "nhân viên"
      }));
    }
    if (window.hideAdminOnlyModules) window.hideAdminOnlyModules();
    var nameNode = document.getElementById("topbarUserName");
    var welcome = document.getElementById("welcome-name");
    var emailNode = document.getElementById("topbarUserEmail");
    if (nameNode && name) nameNode.textContent = name;
    if (welcome && name) welcome.textContent = name;
    if (emailNode && data.email) emailNode.textContent = data.email;
    ["profile-name", "account-name"].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = name;
    });
    ["profile-phone", "account-phone"].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = phone;
    });
    setProfileCardVisible(!phone.trim());
  }

  function clearPasswordFields() {
    var form = document.getElementById("change-password-form");
    if (form) form.reset();
  }

  function closePhoneModal() {
    clearPasswordFields();
    var modal = document.getElementById("phone-modal");
    if (modal) modal.classList.add("is-hidden");
  }

  function openPhoneModal() {
    var modal = document.getElementById("phone-modal");
    var nameField = document.getElementById("account-name");
    var phoneField = document.getElementById("account-phone");
    if (nameField && !nameField.value) nameField.value = localStorage.getItem("user_name") || "";
    if (phoneField) phoneField.value = localStorage.getItem("user_phone") || "";
    if (modal) modal.classList.remove("is-hidden");
    if (phoneField) phoneField.focus();
  }

  async function loadAccount() {
    var stored = localStorage.getItem("user_phone");
    if (stored !== null) setProfileCardVisible(!stored.trim());
    try {
      var response = await fetch(API_ORIGIN + "/api/me", { headers: authHeaders() });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user_id");
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_phone");
        window.location.replace("index.html");
        return;
      }
      if (!response.ok) return;
      applyAccount(await response.json());
    } catch (error) {
      console.error("GET /api/me lỗi:", error);
    }
  }

  async function savePhone(form) {
    var phoneInput = form.querySelector("input[type='tel']");
    var submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    try {
      var response = await fetch(API_ORIGIN + "/api/me", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ phone: phoneInput ? phoneInput.value.trim() : "" })
      });
      var data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("accessToken");
        window.location.replace("index.html");
        return;
      }
      if (!response.ok || !data) {
        showToast("Không lưu được số điện thoại.");
        return;
      }
      applyAccount(data);
      closePhoneModal();
      showToast("Cập nhật số điện thoại thành công!");
    } catch (error) {
      console.error("PATCH /api/me lỗi:", error);
      showToast("Không kết nối được máy chủ.");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  var logoutButton = document.getElementById("btnLogout");
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_id");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_phone");
      window.location.replace("index.html");
    });
  }

  async function savePassword(form) {
    var submit = form.querySelector("button[type='submit']");
    var current = document.getElementById("current-password");
    var next = document.getElementById("new-password");
    var confirm = document.getElementById("confirm-password");
    if (submit) submit.disabled = true;
    try {
      var response = await fetch(API_ORIGIN + "/api/users/change-password", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          old_password: current ? current.value : "",
          new_password: next ? next.value : "",
          confirm_password: confirm ? confirm.value : ""
        })
      });
      var data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("accessToken");
        window.location.replace("index.html");
        return;
      }
      if (!response.ok) {
        var detail = data && typeof data.detail === "string" ? data.detail : "Không đổi được mật khẩu.";
        showToast(detail, "error");
        return;
      }
      clearPasswordFields();
      closePhoneModal();
      showToast("Đổi mật khẩu thành công!", "success");
    } catch (error) {
      console.error("POST /api/users/change-password lỗi:", error);
      showToast("Không kết nối được máy chủ.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  ["profile-form", "account-phone-form"].forEach(function (id) {
    var form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      savePhone(form);
    });
  });

  var passwordForm = document.getElementById("change-password-form");
  if (passwordForm) {
    passwordForm.addEventListener("submit", function (event) {
      event.preventDefault();
      savePassword(passwordForm);
    });
  }

  window.openPhoneSettings = openPhoneModal;
  var settingsButton = document.getElementById("btnSettings") || document.getElementById("open-phone-settings");
  if (settingsButton) {
    settingsButton.addEventListener("click", function (event) {
      event.preventDefault();
      openPhoneModal();
    });
  }
  if (location.hash === "#settings") {
    openPhoneModal();
    history.replaceState(null, "", location.pathname + location.search);
  }

  ["close-phone", "cancel-phone", "phone-backdrop"].forEach(function (id) {
    var node = document.getElementById(id);
    if (node) node.addEventListener("click", closePhoneModal);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var modal = document.getElementById("phone-modal");
    if (modal && !modal.classList.contains("is-hidden")) closePhoneModal();
  });

  loadAccount();
})();
