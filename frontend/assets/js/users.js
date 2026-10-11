(function () {
  "use strict";

  var API_ORIGIN = "http://localhost:8000";
  var DEFAULT_PASSWORD = "ThanhTam@123";

  function authHeaders(json) {
    var headers = { Authorization: "Bearer " + (localStorage.getItem("accessToken") || "") };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  function expireSession() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_phone");
    window.location.replace("index.html");
  }

  function showToast(message, ok) {
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
      toast.style.color = "#fff";
      toast.style.fontSize = "0.875rem";
      toast.style.fontWeight = "600";
      toast.style.textAlign = "center";
      toast.style.boxShadow = "0 10px 24px rgba(0,0,0,.25)";
      document.body.appendChild(toast);
    }
    toast.style.background = ok === false ? "#8e0b2c" : "#155cc0";
    toast.textContent = message;
    toast.classList.remove("is-hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.add("is-hidden");
    }, 2800);
  }

  function readError(data, fallback) {
    if (!data) return fallback;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail[0] && data.detail[0].msg) return data.detail[0].msg;
    return fallback;
  }

  function setModal(id, open) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.toggle("is-hidden", !open);
  }

  function titleLabel(value) {
    var text = String(value || "").trim();
    var key = text.toLowerCase();
    if (key === "trưởng nhóm") return "Trưởng nhóm";
    if (key === "nhân viên") return "Nhân viên";
    return text;
  }

  function fillTitleSelect(select, titles) {
    if (!select) return;
    var current = select.value;
    select.replaceChildren();
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Chọn chức vụ --";
    placeholder.defaultSelected = true;
    select.appendChild(placeholder);
    titles.forEach(function (title) {
      var option = document.createElement("option");
      option.value = title;
      option.textContent = titleLabel(title);
      select.appendChild(option);
    });
    if (current) ensureTitleOption(select, current);
  }

  function ensureTitleOption(select, value) {
    if (!select) return;
    var title = value || "";
    if (title && !Array.prototype.some.call(select.options, function (option) { return option.value === title; })) {
      var option = document.createElement("option");
      option.value = title;
      option.textContent = titleLabel(title);
      select.appendChild(option);
    }
    select.value = title;
  }

  async function loadTeams() {
    var addSelect = document.getElementById("add-nhom");
    var editSelect = document.getElementById("edit-nhom");
    if (!addSelect && !editSelect) return;
    try {
      var response = await fetch(API_ORIGIN + "/api/users/teams", { headers: authHeaders(false) });
      if (response.status === 401) {
        expireSession();
        return;
      }
      var data = await response.json().catch(function () { return []; });
      var teams = Array.isArray(data) ? data.filter(function (item) { return String(item || "").trim(); }) : [];
      fillTeamSelect(addSelect, teams);
      fillTeamSelect(editSelect, teams);
    } catch (error) {
      console.error("GET /api/users/teams lỗi:", error);
    }
  }

  function fillTeamSelect(select, teams) {
    if (!select) return;
    var current = select.value;
    select.replaceChildren();
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Chọn nhóm --";
    placeholder.defaultSelected = true;
    select.appendChild(placeholder);
    teams.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    if (current) ensureTitleOption(select, current);
  }

  async function loadRoles() {
    var addSelect = document.getElementById("add-chuc-vu");
    var editSelect = document.getElementById("edit-chuc-vu");
    if (!addSelect && !editSelect) return;
    try {
      var response = await fetch(API_ORIGIN + "/api/users/roles", { headers: authHeaders(false) });
      if (response.status === 401) {
        expireSession();
        return;
      }
      var data = await response.json().catch(function () { return []; });
      var titles = Array.isArray(data) ? data.filter(function (item) { return String(item || "").trim(); }) : [];
      fillTitleSelect(addSelect, titles);
      fillTitleSelect(editSelect, titles);
    } catch (error) {
      console.error("GET /api/users/roles lỗi:", error);
    }
  }

  function roleBadge(role) {
    var admin = String(role || "").toLowerCase() === "admin";
    var badge = document.createElement("span");
    badge.className = admin ? "badge badge-admin" : "badge badge-user";
    badge.textContent = admin ? "Admin" : "User";
    return badge;
  }

  function statusBadge(value) {
    var locked = value === "Nghỉ việc";
    var badge = document.createElement("span");
    badge.className = locked ? "badge bg-secondary" : "badge bg-success";
    badge.textContent = locked ? "Đã khóa" : "Đang làm";
    return badge;
  }

  function actionButton(className, label, icon) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    var mark = document.createElement("i");
    mark.className = icon;
    mark.setAttribute("aria-hidden", "true");
    button.appendChild(mark);
    return button;
  }

  async function loadUsers() {
    if (!window.isSystemAdmin || !window.isSystemAdmin()) {
      window.location.replace("dashboard.html");
      return;
    }
    loadRoles();
    loadTeams();
    var body = document.getElementById("user-table-body");
    var loading = document.getElementById("users-loading");
    var empty = document.getElementById("users-empty");
    var error = document.getElementById("users-error");
    var tableWrap = document.getElementById("users-table-wrap");
    if (!body) return;
    if (loading) loading.classList.remove("is-hidden");
    if (empty) empty.classList.add("is-hidden");
    if (error) error.classList.add("is-hidden");
    var filterNode = document.getElementById("user-status-filter");
    var scope = filterNode ? filterNode.value : "active";
    try {
      var response = await fetch(API_ORIGIN + "/api/users?trang_thai=" + encodeURIComponent(scope), { headers: authHeaders(false) });
      if (response.status === 401) {
        expireSession();
        return;
      }
      var data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }
      if (response.status === 403) {
        if (error) {
          error.textContent = readError(data, "Chỉ quản trị viên được quản lý nhân viên.");
          error.classList.remove("is-hidden");
        }
        if (tableWrap) tableWrap.classList.add("is-hidden");
        return;
      }
      if (!response.ok || !Array.isArray(data)) {
        if (error) {
          error.textContent = readError(data, "Không tải được danh sách nhân viên.");
          error.classList.remove("is-hidden");
        }
        return;
      }
      body.replaceChildren();
      var currentId = localStorage.getItem("user_id") || "";
      data.forEach(function (user, index) {
        var row = document.createElement("tr");
        row.dataset.userId = String(user.id);
        var indexCell = document.createElement("td");
        indexCell.textContent = String(index + 1);
        var nameCell = document.createElement("td");
        nameCell.textContent = user.full_name || "";
        nameCell.className = "font-semibold text-gray-900";
        var groupCell = document.createElement("td");
        groupCell.textContent = user.nhom || "-";
        var emailCell = document.createElement("td");
        emailCell.textContent = user.email || "";
        var roleCell = document.createElement("td");
        roleCell.appendChild(roleBadge(user.role));
        var titleCell = document.createElement("td");
        titleCell.textContent = titleLabel(user.chuc_vu);
        var statusCell = document.createElement("td");
        statusCell.appendChild(statusBadge(user.trang_thai));
        var actionCell = document.createElement("td");
        var actions = document.createElement("div");
        actions.className = "flex items-center gap-1";
        var edit = actionButton("js-edit-user inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#155cc0] hover:bg-[#155cc0]/10", "Sửa", "fa-solid fa-pencil");
        var reset = actionButton("js-reset-user inline-flex h-9 w-9 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50", "Đặt lại mật khẩu", "fa-solid fa-key");
        var remove = actionButton("js-lock-user inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40", "Khóa tài khoản", "fas fa-lock");
        edit.dataset.userId = String(user.id);
        edit.dataset.fullName = user.full_name || "";
        edit.dataset.email = user.email || "";
        edit.dataset.role = user.role || "User";
        edit.dataset.nhom = user.nhom || "";
        edit.dataset.chucVu = user.chuc_vu || "nhân viên";
        edit.dataset.trangThai = user.trang_thai || "Đang làm";
        reset.dataset.userId = String(user.id);
        reset.dataset.fullName = user.full_name || user.email || "";
        remove.dataset.userId = String(user.id);
        remove.dataset.fullName = user.full_name || user.email || "";
        if (String(user.id) === currentId || user.trang_thai === "Nghỉ việc") remove.disabled = true;
        actions.append(edit, reset, remove);
        actionCell.appendChild(actions);
        row.append(indexCell, nameCell, groupCell, emailCell, roleCell, titleCell, statusCell, actionCell);
        body.appendChild(row);
      });
      if (tableWrap) tableWrap.classList.remove("is-hidden");
      if (empty) {
        empty.textContent = scope === "locked" ? "Chưa có tài khoản bị khóa." : "Chưa có nhân viên.";
        empty.classList.toggle("is-hidden", data.length > 0);
      }
      if (tableWrap && data.length === 0) tableWrap.classList.add("is-hidden");
    } catch (error) {
      console.error("GET /api/users lỗi:", error);
      var errorNode = document.getElementById("users-error");
      if (errorNode) {
        errorNode.textContent = "Không tải được danh sách nhân viên.";
        errorNode.classList.remove("is-hidden");
      }
    } finally {
      if (loading) loading.classList.add("is-hidden");
    }
  }

  window.loadUsers = loadUsers;

  document.addEventListener("click", function (event) {
    if (event.target.closest("#open-add-user")) {
      var addForm = document.getElementById("user-add-form");
      if (addForm) addForm.reset();
      setModal("user-add-modal", true);
      var nameInput = document.getElementById("add-full-name");
      if (nameInput) nameInput.focus();
      return;
    }
    if (event.target.closest("#close-add-user, #cancel-add-user, #user-add-backdrop")) {
      setModal("user-add-modal", false);
      return;
    }
    if (event.target.closest("#close-edit-user, #cancel-edit-user, #user-edit-backdrop")) {
      setModal("user-edit-modal", false);
      return;
    }

    var edit = event.target.closest(".js-edit-user");
    if (edit) {
      var form = document.getElementById("user-edit-form");
      if (!form) return;
      form.dataset.userId = edit.dataset.userId || "";
      document.getElementById("edit-full-name").value = edit.dataset.fullName || "";
      document.getElementById("edit-email").value = edit.dataset.email || "";
      document.getElementById("edit-role").value = String(edit.dataset.role || "User").toLowerCase() === "admin" ? "Admin" : "User";
      ensureTitleOption(document.getElementById("edit-nhom"), edit.dataset.nhom || "");
      ensureTitleOption(document.getElementById("edit-chuc-vu"), edit.dataset.chucVu || "");
      var statusField = document.getElementById("edit-trang-thai");
      if (statusField) statusField.value = edit.dataset.trangThai === "Nghỉ việc" ? "Nghỉ việc" : "Đang làm";
      setModal("user-edit-modal", true);
      return;
    }

    var reset = event.target.closest(".js-reset-user");
    if (reset) {
      var resetName = reset.dataset.fullName || "nhân viên này";
      var resetId = reset.dataset.userId;
      Swal.fire({
        title: "Xác nhận?",
        text: "Đặt lại mật khẩu của " + resetName + " về mật khẩu mặc định?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Đồng ý",
        cancelButtonText: "Hủy"
      }).then(function (result) {
        if (!result.isConfirmed) return;
        fetch(API_ORIGIN + "/api/users/" + encodeURIComponent(resetId) + "/reset-password", {
          method: "POST",
          headers: authHeaders(false)
        }).then(function (response) {
          if (response.status === 401) {
            expireSession();
            return null;
          }
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        }).then(function (payload) {
          if (!payload) return;
          if (!payload.ok) {
            showToast(readError(payload.data, "Không đặt lại được mật khẩu."), false);
            return;
          }
          var password = (payload.data && payload.data.default_password) || DEFAULT_PASSWORD;
          Swal.fire({
            icon: "success",
            title: "Đã đặt lại mật khẩu",
            html: "Mật khẩu mặc định: <b></b><br>Hãy copy và gửi cho nhân viên.",
            confirmButtonColor: "#3085d6",
            confirmButtonText: "Đồng ý",
            didOpen: function (popup) {
              var strong = popup.querySelector("b");
              if (strong) strong.textContent = password;
            }
          });
        }).catch(function (error) {
          console.error(error);
          showToast("Không đặt lại được mật khẩu.", false);
        });
      });
      return;
    }

    var remove = event.target.closest(".js-lock-user");
    if (remove) {
      if (remove.disabled) return;
      var removeId = remove.dataset.userId;
      Swal.fire({
        title: "Khóa tài khoản?",
        text: "Bạn có chắc chắn muốn khóa tài khoản này? Người này sẽ không thể đăng nhập vào hệ thống, nhưng các dữ liệu bài viết/hợp đồng cũ vẫn được giữ lại.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Khóa tài khoản",
        cancelButtonText: "Hủy"
      }).then(function (result) {
        if (!result.isConfirmed) return;
        fetch(API_ORIGIN + "/api/users/" + encodeURIComponent(removeId), {
          method: "DELETE",
          headers: authHeaders(false)
        }).then(function (response) {
          if (response.status === 401) {
            expireSession();
            return null;
          }
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          }).catch(function () {
            return { ok: response.ok, data: null };
          });
        }).then(function (payload) {
          if (!payload) return;
          if (!payload.ok) {
            showToast(readError(payload.data, "Không khóa được tài khoản."), false);
            return;
          }
          showToast("Đã khóa tài khoản.");
          loadUsers();
        }).catch(function (error) {
          console.error(error);
          showToast("Không khóa được tài khoản.", false);
        });
      });
    }
  });

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (form.id !== "user-add-form" && form.id !== "user-edit-form") return;
    event.preventDefault();
    var editing = form.id === "user-edit-form";
    var payload = {
      full_name: form.querySelector("[name='full_name']").value.trim(),
      email: form.querySelector("[name='email']").value.trim(),
      role: form.querySelector("[name='role']").value,
      nhom: form.querySelector("[name='nhom']").value,
      chuc_vu: form.querySelector("[name='chuc_vu']").value,
      trang_thai: form.querySelector("[name='trang_thai']").value
    };
    if (!editing) payload.password = form.querySelector("[name='password']").value;
    var submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    var url = editing
      ? API_ORIGIN + "/api/users/" + encodeURIComponent(form.dataset.userId || "")
      : API_ORIGIN + "/api/users";
    fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: authHeaders(true),
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (response.status === 401) {
        expireSession();
        return null;
      }
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      }).catch(function () {
        return { ok: response.ok, data: null };
      });
    }).then(function (result) {
      if (!result) return;
      if (!result.ok) {
        showToast(readError(result.data, editing ? "Không cập nhật được nhân viên." : "Không thêm được nhân viên."), false);
        return;
      }
      setModal(editing ? "user-edit-modal" : "user-add-modal", false);
      form.reset();
      showToast(editing ? "Đã cập nhật nhân viên." : "Đã thêm nhân viên.");
      loadUsers();
    }).catch(function (error) {
      console.error(error);
      showToast(editing ? "Không cập nhật được nhân viên." : "Không thêm được nhân viên.", false);
    }).finally(function () {
      if (submit) submit.disabled = false;
    });
  });

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "user-status-filter") loadUsers();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    setModal("user-add-modal", false);
    setModal("user-edit-modal", false);
  });

  function boot() {
    if (document.getElementById("user-table-body")) loadUsers();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
