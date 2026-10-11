(function () {
  "use strict";

  var API_ORIGIN = "http://localhost:8000";
  var listRequest = 0;
  var pendingDrafts = {};

  function expireSession() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_phone");
    window.location.replace("index.html");
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

  function authHeaders() {
    return { Authorization: "Bearer " + localStorage.getItem("accessToken") };
  }

  function formatTime(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function safeImageUrl(url) {
    var value = String(url || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (value.charAt(0) === "/") return API_ORIGIN + value;
    return "";
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "AD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function setState(which) {
    var loading = document.getElementById("pending-loading");
    var empty = document.getElementById("pending-empty");
    var error = document.getElementById("pending-error");
    if (loading) loading.classList.toggle("is-hidden", which !== "loading");
    if (empty) empty.classList.toggle("is-hidden", which !== "empty");
    if (error) error.classList.toggle("is-hidden", which !== "error");
  }

  function renderCard(item) {
    var template = document.getElementById("pending-card-template");
    if (!template) return null;
    var card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = String(item.id);
    var employee = card.querySelector(".pending-employee");
    var time = card.querySelector(".pending-time");
    var content = card.querySelector(".pending-content");
    var images = card.querySelector(".pending-images");
    if (employee) employee.textContent = item.employee_name || "Nhân viên";
    if (time) time.textContent = formatTime(item.created_at);
    if (content) content.textContent = item.content || "";
    var originals = (Array.isArray(item.images) ? item.images : []).map(function (url) {
      return String(url || "").trim();
    }).filter(Boolean);
    var videoUrl = String(item.video_url || "").trim();
    pendingDrafts[String(item.id)] = originals;
    card.querySelectorAll(".pending-choice").forEach(function (input) {
      input.name = "media-choice-" + item.id;
    });
    if (images) renderPendingGallery(images, originals);
    var videoBox = card.querySelector(".pending-video");
    if (videoBox && videoUrl) {
      var video = document.createElement("video");
      video.className = "mt-3 h-48 w-full rounded-lg bg-black object-contain";
      video.controls = true;
      video.preload = "metadata";
      video.src = safeImageUrl(videoUrl);
      videoBox.appendChild(video);
    }
    return card;
  }

  function renderPendingGallery(container, urls) {
    var list = (Array.isArray(urls) ? urls : []).filter(Boolean);
    var noImages = container.parentElement ? container.parentElement.querySelector(".pending-no-images") : null;
    if (!list.length) {
      container.innerHTML = "";
      container.classList.add("is-hidden");
      if (noImages) noImages.classList.remove("is-hidden");
      return;
    }
    container.classList.remove("is-hidden");
    if (noImages) noImages.classList.add("is-hidden");
    var shown = list.slice(0, 4);
    var frame = document.createElement("div");
    frame.className = "mt-3 overflow-hidden rounded-lg bg-gray-100 " + (list.length < 3 ? "h-48" : "h-96");
    var grid = document.createElement("div");
    var gridClass = "grid h-full gap-1 ";
    if (shown.length === 1) gridClass += "grid-cols-1";
    else if (shown.length === 3) gridClass += "grid-cols-2 grid-rows-2";
    else gridClass += "grid-cols-2" + (shown.length > 2 ? " grid-rows-2" : "");
    grid.className = gridClass;
    shown.forEach(function (url, index) {
      var cell = document.createElement("div");
      cell.className = "relative h-full min-h-0 overflow-hidden" + (shown.length === 3 && index === 0 ? " row-span-2" : "");
      var src = safeImageUrl(url);
      if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
        var video = document.createElement("video");
        video.className = "h-full w-full bg-black object-contain";
        video.controls = true;
        video.preload = "metadata";
        video.src = src;
        cell.appendChild(video);
      } else {
        var image = document.createElement("img");
        image.className = "h-full w-full object-cover";
        image.alt = "Ảnh bài chờ duyệt";
        image.src = src;
        cell.appendChild(image);
      }
      if (index === shown.length - 1 && list.length > shown.length) {
        var more = document.createElement("span");
        more.className = "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white";
        more.textContent = "+" + (list.length - shown.length);
        cell.appendChild(more);
      }
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "pending-remove-image absolute top-1 right-1 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-red-600 opacity-80 hover:opacity-100";
      remove.dataset.index = String(index);
      remove.setAttribute("aria-label", "Xóa ảnh");
      remove.textContent = "✖";
      cell.appendChild(remove);
      grid.appendChild(cell);
    });
    frame.appendChild(grid);
    container.appendChild(frame);
  }

  async function readError(response) {
    try {
      var data = await response.json();
      if (data && typeof data.detail === "string") return data.detail;
    } catch (error) {
      return "";
    }
    return "";
  }

  async function loadPendingPosts() {
    var list = document.getElementById("pending-list");
    if (!list) return;
    if (!window.isSystemAdmin || !window.isSystemAdmin()) {
      window.location.replace("dashboard.html");
      return;
    }
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var requestId = ++listRequest;
    pendingDrafts = {};
    list.innerHTML = "";
    setState("loading");
    try {
      var me = await fetch(API_ORIGIN + "/api/me", { headers: authHeaders() });
      if (me.status === 401) {
        expireSession();
        return;
      }
      if (me.ok) {
        var account = await me.json();
        var nameNode = document.getElementById("topbarUserName");
        if (nameNode && account.full_name) nameNode.textContent = account.full_name;
      }
      var response = await fetch(API_ORIGIN + "/api/pending-posts", { headers: authHeaders() });
      if (requestId !== listRequest) return;
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        setState("error");
        var forbidden = document.getElementById("pending-error");
        if (forbidden) forbidden.textContent = "Chỉ quản trị viên được xem và duyệt bài chờ.";
        return;
      }
      if (!response.ok) {
        setState("error");
        var failed = document.getElementById("pending-error");
        if (failed) failed.textContent = (await readError(response)) || "Không tải được danh sách bài chờ duyệt.";
        return;
      }
      var rows = await response.json();
      if (requestId !== listRequest) return;
      if (!Array.isArray(rows) || !rows.length) {
        setState("empty");
        return;
      }
      setState("");
      rows.forEach(function (item) {
        var card = renderCard(item);
        if (card) list.appendChild(card);
      });
    } catch (error) {
      if (requestId !== listRequest) return;
      console.error("GET /api/pending-posts lỗi:", error);
      setState("error");
      var node = document.getElementById("pending-error");
      if (node) node.textContent = "Không kết nối được máy chủ.";
    }
  }

  async function decidePost(card, path, successMessage, payload, method, notify) {
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var buttons = card.querySelectorAll("button");
    buttons.forEach(function (button) {
      button.disabled = true;
    });
    try {
      var headers = authHeaders();
      var options = { method: method || "POST", headers: headers };
      if (payload) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
      }
      var response = await fetch(API_ORIGIN + path, options);
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) {
        showToast((await readError(response)) || "Không xử lý được bài viết.", "error");
        buttons.forEach(function (button) {
          button.disabled = false;
        });
        return false;
      }
      card.remove();
      delete pendingDrafts[card.dataset.id];
      var list = document.getElementById("pending-list");
      if (list && !list.children.length) setState("empty");
      if (notify === "alert") {
        Swal.fire({
          icon: "success",
          title: "Thành công",
          text: successMessage,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Đồng ý"
        });
      } else showToast(successMessage, "success");
      return true;
    } catch (error) {
      console.error(path, error);
      showToast("Không kết nối được máy chủ.", "error");
      buttons.forEach(function (button) {
        button.disabled = false;
      });
      return false;
    }
  }

  document.addEventListener("click", function (event) {
    var removeImage = event.target.closest(".pending-remove-image");
    if (removeImage) {
      var imageCard = removeImage.closest(".pending-card");
      var container = imageCard ? imageCard.querySelector(".pending-images") : null;
      if (!imageCard || !container || !imageCard.dataset.id) return;
      var id = imageCard.dataset.id;
      var index = Number(removeImage.dataset.index);
      var images = (pendingDrafts[id] || []).slice();
      if (index >= 0 && index < images.length) images.splice(index, 1);
      pendingDrafts[id] = images;
      container.innerHTML = "";
      renderPendingGallery(container, images);
      return;
    }
    var approve = event.target.closest(".pending-approve");
    var reject = event.target.closest(".pending-reject");
    if (!approve && !reject) return;
    var card = event.target.closest(".pending-card");
    if (!card || !card.dataset.id) return;
    if (approve) {
      Swal.fire({
        title: "Xác nhận?",
        text: "Duyệt bài này và chuyển sang hàng đăng Fanpage?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Đồng ý",
        cancelButtonText: "Hủy"
      }).then(function (result) {
        if (!result.isConfirmed) return;
        if (!approve.dataset.label) approve.dataset.label = approve.innerHTML;
        approve.disabled = true;
        approve.setAttribute("aria-busy", "true");
        approve.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Đang đăng...';
        var selectedChoice = card.querySelector(".pending-choice:checked");
        var mediaChoice = selectedChoice && selectedChoice.value === "video" ? "video" : "image";
        decidePost(
          card,
          "/api/approve-post/" + card.dataset.id,
          "Đăng Fanpage thành công!",
          {
            images: (pendingDrafts[card.dataset.id] || []).slice(),
            media_choice: mediaChoice
          },
          "POST",
          "alert"
        ).then(function (ok) {
          if (ok || !approve.isConnected) return;
          approve.disabled = false;
          approve.removeAttribute("aria-busy");
          approve.innerHTML = approve.dataset.label;
        });
      });
      return;
    }
    Swal.fire({
      title: "Xác nhận?",
      text: "Bạn chắc chắn từ chối bài viết này không?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Đồng ý",
      cancelButtonText: "Hủy"
    }).then(function (result) {
      if (!result.isConfirmed) return;
      decidePost(card, "/api/pending-posts/" + card.dataset.id, "Đã từ chối và xóa bài viết.", null, "DELETE");
    });
  });

  window.loadPendingPosts = loadPendingPosts;
  if (document.getElementById("pending-list")) loadPendingPosts();
})();
