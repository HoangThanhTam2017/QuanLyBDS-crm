(function () {
  "use strict";

 // Tự động lấy tên miền hiện tại (Bao gồm cả localhost hoặc tên miền thật)
  var API_ORIGIN = window.location.origin;
  
  // Nếu Frontend và Backend chạy khác cổng trên localhost (vd Frontend 5500, Backend 8000), 
  // anh có thể dùng đoạn if này để nắn lại. Nếu không, chỉ cần dòng var API_ORIGIN ở trên là đủ.
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      API_ORIGIN = "http://localhost:8000";
  }
  var API_URL = API_ORIGIN + "/api/properties";
  var addressTimer = null;
  var feedRequest = 0;
  var STATUS_CLASS = {
    "Chưa bán": "bg-green-100 text-green-700",
    "Dừng bán": "bg-yellow-100 text-yellow-800",
    "Đã bán": "bg-gray-100 text-gray-800"
  };

  function showNotice(message, icon) {
    var kind = icon || "info";
    Swal.fire({
      icon: kind,
      title: kind === "success" ? "Thành công" : kind === "error" ? "Không thành công" : "Thông báo",
      text: message || "",
      confirmButtonColor: "#3085d6",
      confirmButtonText: "Đồng ý"
    });
  }

  function expireSession() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_phone");
    window.location.replace("index.html");
  }

  var sessionUserId = "";

  function currentUserId() {
    if (sessionUserId) return sessionUserId;
    var stored = localStorage.getItem("user_id");
    if (stored) return String(stored);
    var payload = decodeJwtPayload(localStorage.getItem("accessToken") || "");
    return payload && payload.uid != null ? String(payload.uid) : "";
  }

  async function ensureCurrentUserId() {
    var known = currentUserId();
    if (known) {
      sessionUserId = known;
      return known;
    }
    var token = localStorage.getItem("accessToken");
    if (!token) return "";
    try {
      var response = await fetch(API_ORIGIN + "/api/me", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) return "";
      var data = await response.json();
      sessionUserId = data.id == null ? "" : String(data.id);
      if (sessionUserId) localStorage.setItem("user_id", sessionUserId);
      return sessionUserId;
    } catch (error) {
      console.error("GET /api/me lỗi:", error);
      return "";
    }
  }

  var POST_TEMPLATE = [
    "1. Tiêu đề: ",
    "2. Đối tượng: ",
    "3. Diện tích: ",
    "4. Tiện ích: ",
    "5. Pháp lý: ",
    "6. Quy hoạch: ",
    "7. Phong thuỷ: ",
    "8. Giá bán: ",
    "9. Hoa hồng: ",
    "10. Thông tin khác: ",
    "11. Link vị trí: "
  ].join("\n");

  function lineValue(text, number, label) {
    var pattern = new RegExp("^\\s*" + number + "\\.\\s*" + label + "\\s*:\\s*(.*)$", "im");
    var match = String(text || "").match(pattern);
    return match ? match[1].trim() : "";
  }

  function fillPropertyComposer() {
    var field = document.getElementById("property-content");
    if (!field || field.value.trim()) return;
    field.value = POST_TEMPLATE;
    var caret = "1. Tiêu đề: ".length;
    field.focus();
    if (field.setSelectionRange) field.setSelectionRange(caret, caret);
  }

  function parseViAmount(raw) {
    var text = String(raw || "").trim();
    if (!text) return null;
    var value;
    if (text.indexOf(",") !== -1) {
      value = parseFloat(text.replace(/\./g, "").replace(",", "."));
    } else if ((text.match(/\./g) || []).length > 1 || /^\d+\.\d{3}$/.test(text)) {
      value = parseFloat(text.replace(/\./g, ""));
    } else {
      value = parseFloat(text);
    }
    return isFinite(value) ? value : null;
  }

  function parsePriceToVnd(fragment) {
    var text = String(fragment || "").toLowerCase();
    var match = text.match(/(\d[\d.,]*)\s*(tỷ|ty|triệu|trieu)?/i);
    if (!match) return null;
    var amount = parseViAmount(match[1]);
    if (amount == null) return null;
    var unit = (match[2] || "").toLowerCase();
    if (unit === "tỷ" || unit === "ty") return Math.round(amount * 1000000000);
    if (unit === "triệu" || unit === "trieu") return Math.round(amount * 1000000);
    return Math.round(amount);
  }

  function parseArea(fragment) {
    var match = String(fragment || "").match(/(\d[\d.,]*)/);
    if (!match) return null;
    return parseViAmount(match[1]);
  }

  function parseDirection(text) {
    var line = String(text || "").match(/7\.\s*Phong\s*th(?:ủy|uỷ|uy)\s*[:-]?\s*([^\n]*)/i);
    if (!line) return "";
    var rest = line[1];
    var pointed = rest.match(/hướng\s+/i);
    var source = pointed ? rest.slice(pointed.index + pointed[0].length) : rest;
    var facing = /(Đông\s*Nam|Đông\s*Bắc|Tây\s*Nam|Tây\s*Bắc|Đông|Tây|Nam|Bắc)/i;
    var match = source.match(facing) || rest.match(facing);
    if (!match) return "";
    var names = {
      "đông nam": "Đông Nam",
      "đông bắc": "Đông Bắc",
      "tây nam": "Tây Nam",
      "tây bắc": "Tây Bắc",
      "đông": "Đông",
      "tây": "Tây",
      "nam": "Nam",
      "bắc": "Bắc"
    };
    return names[match[1].replace(/\s+/g, " ").trim().toLowerCase()] || "";
  }

  function parsePropertyData(text) {
    var priceText = lineValue(text, 8, "Giá bán");
    var areaText = lineValue(text, 3, "Diện tích");
    return {
      price: priceText ? parsePriceToVnd(priceText) : null,
      area: areaText ? parseArea(areaText) : null,
      location: lineValue(text, 2, "Đối tượng"),
      direction: parseDirection(text)
    };
  }

  function feedParams() {
    var params = new URLSearchParams();
    var address = document.getElementById("filter-address");
    var staff = document.getElementById("filter-user");
    var price = document.getElementById("filter-price");
    var direction = document.getElementById("filter-direction");
    var status = document.getElementById("filter-status");
    var addressText = address ? address.value.trim() : "";
    var staffId = staff ? staff.value : "";
    var priceValue = price ? price.value : "";
    var directionText = direction ? direction.value.trim() : "";
    var statusText = status ? status.value.trim() : "";
    var soThuaField = document.getElementById("filterSoThua");
    var soToField = document.getElementById("filterSoTo");
    var soThua = soThuaField && soThuaField.value ? soThuaField.value.trim() : "";
    var soTo = soToField && soToField.value ? soToField.value.trim() : "";
    var bounds = priceValue.split("-");
    if (addressText) params.set("address", addressText);
    if (soThua) params.set("so_thua", soThua);
    if (soTo) params.set("so_to", soTo);
    if (staffId) params.set("user_id", staffId);
    if (bounds.length === 2 && bounds[0] !== "" && bounds[1] !== "") {
      params.set("min_price", bounds[0]);
      params.set("max_price", bounds[1]);
    }
    if (directionText) params.set("direction", directionText);
    if (statusText) params.set("status", statusText);
    return params;
  }

  async function loadFilterUsers() {
    var select = document.getElementById("filter-user");
    if (!select || select.dataset.loaded === "1") return;
    var token = localStorage.getItem("accessToken");
    if (!token) return;
    select.dataset.loaded = "1";
    try {
      var response = await fetch(API_ORIGIN + "/api/users/list", {
        headers: { Authorization: "Bearer " + token }
      });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) {
        select.dataset.loaded = "";
        return;
      }
      var users = await response.json();
      var current = select.value;
      while (select.options.length > 1) select.remove(1);
      (Array.isArray(users) ? users : []).forEach(function (user) {
        if (!user || user.id == null) return;
        var option = document.createElement("option");
        option.value = String(user.id);
        option.textContent = user.full_name || "Nhân viên";
        select.appendChild(option);
      });
      if (current) select.value = current;
    } catch (error) {
      select.dataset.loaded = "";
      console.error("GET /api/users/list lỗi:", error);
    }
  }

  function formatVnd(value) {
    if (typeof value === "number" && isFinite(value)) {
      return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(value)) + " đ";
    }
    var text = String(value == null ? "" : value).trim();
    if (!text) return "";
    var amount = NaN;
    var tyMatch = text.match(/([\d][\d.,]*)\s*tỷ/i);
    if (tyMatch) {
      var raw = tyMatch[1];
      if (raw.indexOf(",") !== -1) {
        amount = parseFloat(raw.replace(/\./g, "").replace(",", ".")) * 1000000000;
      } else if (/^\d+\.\d{1,2}$/.test(raw)) {
        amount = parseFloat(raw) * 1000000000;
      } else {
        amount = parseFloat(raw.replace(/\./g, "")) * 1000000000;
      }
    } else {
      var digits = text.replace(/[^\d]/g, "");
      if (digits) amount = Number(digits);
    }
    if (!isFinite(amount)) return text;
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(amount)) + " đ";
  }

  function timeAgo(value) {
    var then = new Date(value);
    if (isNaN(then.getTime())) return "";
    var seconds = Math.round((Date.now() - then.getTime()) / 1000);
    if (seconds < 60) return "Vừa xong";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + " phút trước";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + " giờ trước";
    var days = Math.round(hours / 24);
    if (days < 7) return days + " ngày trước";
    return then.toLocaleDateString("vi-VN");
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "NV";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderContent(text) {
    var safeContent = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    safeContent = safeContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    safeContent = safeContent.replace(
      /11\.\s*Link\s*vị\s*trí:\s*(https?:\/\/[^\s<]+)/i,
      '<a href="$1" target="_blank" class="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1"><i class="fas fa-map-marked-alt"></i> Xem trên bản đồ</a>'
    );
    safeContent = safeContent.replace(/\n/g, "<br>");
    return safeContent;
  }

  function mediaSrc(url) {
    var value = String(url || "");
    if (/^https?:\/\//i.test(value)) return value;
    return API_ORIGIN + (value.charAt(0) === "/" ? value : "/" + value);
  }

  function renderMedia(urls) {
    var list = (Array.isArray(urls) ? urls : []).filter(Boolean);
    if (!list.length) return null;
    var shown = list.slice(0, 4);
    var frame = el("div", "mt-3 overflow-hidden rounded-lg bg-gray-100 " + (list.length < 3 ? "h-48" : "h-96"));
    var gridClass = "grid h-full gap-1 ";
    if (shown.length === 1) gridClass += "grid-cols-1";
    else if (shown.length === 3) gridClass += "grid-cols-2 grid-rows-2";
    else gridClass += "grid-cols-2" + (shown.length > 2 ? " grid-rows-2" : "");
    var grid = el("div", gridClass);
    shown.forEach(function (url, index) {
      var cell = el("div", "relative h-full min-h-0 overflow-hidden" + (shown.length === 3 && index === 0 ? " row-span-2" : ""));
      var src = mediaSrc(url);
      if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
        var video = document.createElement("video");
        video.className = "h-full w-full bg-black object-contain";
        video.controls = true;
        video.preload = "metadata";
        video.src = src;
        cell.appendChild(video);
      } else {
        var image = document.createElement("img");
        image.className = "js-feed-photo h-full w-full cursor-zoom-in object-cover";
        image.alt = "Ảnh nguồn cung";
        image.src = src;
        cell.appendChild(image);
      }
      if (index === shown.length - 1 && list.length > shown.length) {
        cell.appendChild(el("span", "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white", "+" + (list.length - shown.length)));
      }
      grid.appendChild(cell);
    });
    frame.appendChild(grid);
    return frame;
  }

  function renderVideoBlock(url) {
    var frame = el("div", "mt-3 overflow-hidden rounded-lg bg-black h-48");
    var video = document.createElement("video");
    video.className = "h-full w-full object-contain";
    video.controls = true;
    video.preload = "metadata";
    video.src = mediaSrc(url);
    frame.appendChild(video);
    return frame;
  }

  var selectedMedia = [];

  function sameFile(left, right) {
    return left.name === right.name && left.size === right.size && left.lastModified === right.lastModified;
  }

  function isVideoFile(file) {
    return !!file && String(file.type || "").indexOf("video/") === 0;
  }

  function isImageFile(file) {
    return !!file && String(file.type || "").indexOf("image/") === 0;
  }

  function syncSelectedMedia() {
    var input = document.getElementById("media_upload");
    if (!input) return;
    try {
      var transfer = new DataTransfer();
      selectedMedia.forEach(function (file) { transfer.items.add(file); });
      input.files = transfer.files;
    } catch (error) {
      console.error("Không cập nhật được danh sách file:", error);
    }
  }

  function renderSelectedMedia() {
    var preview = document.getElementById("media-preview");
    if (!preview) return;
    preview.querySelectorAll("[data-object-url]").forEach(function (node) {
      URL.revokeObjectURL(node.getAttribute("data-object-url"));
    });
    preview.textContent = "";
    selectedMedia.forEach(function (file, index) {
      var objectUrl = URL.createObjectURL(file);
      var tile = el("div", "relative h-20 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5");
      var node;
      if (isVideoFile(file)) {
        node = document.createElement("video");
        node.muted = true;
        node.preload = "metadata";
        node.className = "h-full w-full bg-black object-contain";
      } else {
        node = document.createElement("img");
        node.alt = file.name;
        node.className = "h-full w-full object-cover";
      }
      node.src = objectUrl;
      node.setAttribute("data-object-url", objectUrl);
      tile.appendChild(node);
      var remove = el("button", "js-remove-selected absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm text-white hover:bg-black");
      remove.type = "button";
      remove.setAttribute("data-index", String(index));
      remove.setAttribute("aria-label", isVideoFile(file) ? "Bỏ video này" : "Bỏ ảnh này");
      var icon = document.createElement("i");
      icon.className = "fa-solid fa-xmark";
      icon.setAttribute("aria-hidden", "true");
      remove.appendChild(icon);
      tile.appendChild(remove);
      preview.appendChild(tile);
    });
  }

  function addSelectedMedia(fileList) {
    var hasVideo = selectedMedia.some(isVideoFile);
    var skippedExtraVideo = false;
    Array.prototype.forEach.call(fileList || [], function (file) {
      if (!isImageFile(file) && !isVideoFile(file)) return;
      if (isVideoFile(file)) {
        if (hasVideo) {
          skippedExtraVideo = true;
          return;
        }
        hasVideo = true;
      }
      var exists = selectedMedia.some(function (item) { return sameFile(item, file); });
      if (!exists) selectedMedia.push(file);
    });
    if (skippedExtraVideo) showToast("Chỉ lấy video đầu tiên.");
    syncSelectedMedia();
    renderSelectedMedia();
  }

  function clearMediaPreview() {
    selectedMedia = [];
    var input = document.getElementById("media_upload");
    if (input) input.value = "";
    var preview = document.getElementById("media-preview");
    if (!preview) return;
    preview.querySelectorAll("[data-object-url]").forEach(function (node) {
      URL.revokeObjectURL(node.getAttribute("data-object-url"));
    });
    preview.textContent = "";
  }

  function actionButton(iconClass, label, extraClass) {
    var button = el("button", "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight text-gray-600 hover:bg-gray-100 sm:flex-row sm:gap-2 sm:px-2 sm:text-sm " + (extraClass || ""));
    button.type = "button";
    var icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
    button.appendChild(el("span", "", label));
    return button;
  }

  function createCard(item) {
    var name = item.author_name || "Nhân viên";
    var status = item.status || "Chưa bán";
    var article = el("article", "rounded-lg bg-white shadow-sm ring-1 ring-black/5");
    article.dataset.id = item.id == null ? "" : String(item.id);
    article.dataset.status = status;
    article.dataset.media = JSON.stringify(Array.isArray(item.media_urls) ? item.media_urls : []);
    article.dataset.video = item.video_url || "";

    var header = el("header", "flex items-start gap-3 p-4 pb-2");
    header.appendChild(el("span", "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8e0b2c]/10 text-sm font-bold text-[#8e0b2c]", initials(name)));
    var who = el("div", "min-w-0 flex-1");
    who.appendChild(el("p", "font-bold text-gray-900", name));
    var meta = [timeAgo(item.created_at), item.location].filter(Boolean).join(" · ");
    who.appendChild(el("p", "text-sm text-gray-500", meta));
    header.appendChild(who);
    header.appendChild(el("span", "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold " + (STATUS_CLASS[status] || "bg-gray-100 text-gray-800"), status));
    article.appendChild(header);

    var body = el("div", "px-4 pb-3");
    var areaText = item.area == null || item.area === "" ? "" : String(item.area).replace(/\.0$/, "") + " m²";
    var priceNumber = Number(item.price);
    var areaNumber = Number(item.area);
    var unitPriceText = "";
    if (priceNumber > 0 && areaNumber > 0) {
      var unitPrice = priceNumber / areaNumber;
      var pricePerSqm = parseFloat((unitPrice / 1000000).toFixed(1));
      unitPriceText = "• (~ " + pricePerSqm + " triệu/m²)";
    }
    var facts = [formatVnd(item.price), areaText].filter(Boolean).join(" • ");
    if (facts && unitPriceText) facts += " " + unitPriceText;
    if (facts) body.appendChild(el("p", "mb-1 text-sm font-semibold text-[#8e0b2c]", facts));
    var post = el("p", "post-text line-clamp-2 text-[15px] leading-relaxed text-gray-800");
    post.setAttribute("data-raw", item.content || "");
    post.innerHTML = renderContent(item.content || "");
    body.appendChild(post);
    body.appendChild(el("span", "js-see-more mt-1 inline-block cursor-pointer text-sm font-semibold text-[#155cc0]", "Xem thêm"));
    var album = renderMedia(item.media_urls);
    if (album) body.appendChild(album);
    if (item.video_url) body.appendChild(renderVideoBlock(item.video_url));
    article.appendChild(body);

    var footer = el("footer", "flex justify-between gap-1 border-t border-gray-100 p-1");
    footer.appendChild(actionButton("fa-solid fa-share-nodes", "Chuẩn bị đăng bài", "js-prepare"));
    var edit = actionButton("fa-solid fa-pen-to-square", "Chỉnh sửa", "js-edit");
    var remove = actionButton("fa-solid fa-trash", "Xóa bài", "js-delete");
    var ownsPost = String(item.user_id == null ? "" : item.user_id) === currentUserId();
    if (!ownsPost) {
      edit.style.display = "none";
      remove.style.display = "none";
    }
    footer.appendChild(edit);
    footer.appendChild(remove);
    var comment = actionButton("fa-regular fa-comment", "Bình luận", "js-comments");
    comment.setAttribute("aria-expanded", "false");
    footer.appendChild(comment);
    article.appendChild(footer);

    var panel = el("div", "js-comment-panel comment-panel is-hidden");
    panel.appendChild(el("p", "comment-title", "Bình luận / Ghi chú"));
    panel.appendChild(el("div", "js-comment-list comment-list"));
    var form = el("form", "js-comment-form comment-form");
    var input = document.createElement("textarea");
    input.className = "comment-input";
    input.rows = 2;
    input.maxLength = 2000;
    input.placeholder = "Viết bình luận...";
    input.setAttribute("aria-label", "Viết bình luận");
    var send = document.createElement("button");
    send.type = "submit";
    send.className = "btn btn-primary comment-send";
    send.textContent = "Gửi bình luận";
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(form);
    article.appendChild(panel);
    return article;
  }

  function renderComments(list, items) {
    list.textContent = "";
    if (!items.length) {
      list.appendChild(el("p", "comment-empty", "Chưa có bình luận."));
      return;
    }
    items.forEach(function (item) {
      var row = el("div", "comment-row");
      row.appendChild(el("span", "comment-avatar", initials(item.author_name)));
      var body = el("div", "min-w-0");
      var bubble = el("div", "comment-bubble");
      bubble.appendChild(el("p", "comment-name", item.author_name || "Nhân viên"));
      bubble.appendChild(el("p", "comment-body", item.content || ""));
      body.appendChild(bubble);
      body.appendChild(el("p", "comment-time", timeAgo(item.created_at)));
      row.appendChild(body);
      list.appendChild(row);
    });
  }

  function commentDetail(data) {
    if (!data) return "";
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]) return data.detail[0].msg || "";
    return "";
  }

  async function loadComments(article) {
    var list = article.querySelector(".js-comment-list");
    var propertyId = article.dataset.id;
    if (!list || !propertyId) return;
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    list.textContent = "";
    list.appendChild(el("p", "comment-empty", "Đang tải bình luận..."));
    try {
      var response = await fetch(API_URL + "/" + encodeURIComponent(propertyId) + "/comments", {
        headers: { Authorization: "Bearer " + token }
      });
      if (response.status === 401 || response.status === 403) {
        expireSession();
        return;
      }
      if (!response.ok) {
        list.textContent = "";
        list.appendChild(el("p", "comment-empty", "Không tải được bình luận."));
        return;
      }
      renderComments(list, await response.json());
    } catch (error) {
      console.error("GET comments lỗi:", error);
      list.textContent = "";
      list.appendChild(el("p", "comment-empty", "Không kết nối được máy chủ."));
    }
  }

  async function submitComment(form) {
    var article = form.closest("article");
    var input = form.querySelector("textarea");
    var content = input ? input.value.trim() : "";
    if (!article || !content) return;
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var button = form.querySelector("button");
    if (button) button.disabled = true;
    try {
      var response = await fetch(API_URL + "/" + encodeURIComponent(article.dataset.id) + "/comments", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: content })
      });
      var data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
      if (response.status === 401 || response.status === 403) {
        expireSession();
        return;
      }
      if (!response.ok) {
        showToast(commentDetail(data) || "Không gửi được bình luận.");
        return;
      }
      if (input) input.value = "";
      await loadComments(article);
    } catch (error) {
      console.error("POST comments lỗi:", error);
      showToast("Không kết nối được máy chủ.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function updateFeedStats(items) {
    var list = Array.isArray(items) ? items : [];
    function statusOf(item) {
      return String(item && item.status || "").trim();
    }
    var total = list.length;
    var available = list.filter(function (item) {
      var status = statusOf(item);
      return status === "Đang bán" || status === "Chưa bán";
    }).length;
    var sold = list.filter(function (item) {
      return statusOf(item) === "Đã bán";
    }).length;
    var paused = list.filter(function (item) {
      var status = statusOf(item);
      return status === "Dừng bán" || status === "Tạm ngưng";
    }).length;
    var totalNode = document.getElementById("stat-total");
    var availableNode = document.getElementById("stat-available");
    var soldNode = document.getElementById("stat-sold");
    var pausedNode = document.getElementById("stat-paused");
    if (totalNode) totalNode.innerText = String(total);
    if (availableNode) availableNode.innerText = String(available);
    if (soldNode) soldNode.innerText = String(sold);
    if (pausedNode) pausedNode.innerText = String(paused);
  }

  function renderFeed(feed, items, filtered) {
    updateFeedStats(items);
    feed.textContent = "";
    if (!items.length) {
      feed.appendChild(el("p", "rounded-lg bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5", filtered ? "Không có nguồn cung khớp bộ lọc." : "Chưa có nguồn cung."));
      return;
    }
    items.forEach(function (item) {
      feed.appendChild(createCard(item));
    });
  }

  function readError(data) {
    if (!data) return "Không đăng được tin.";
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map(function (item) { return item.msg || ""; }).filter(Boolean).join("\n") || "Không đăng được tin.";
    }
    return "Không đăng được tin.";
  }

  async function loadPropertyFeed() {
    var feed = document.getElementById("feed");
    if (!feed) return;
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var params = feedParams();
    var url = params.toString() ? API_URL + "?" + params.toString() : API_URL;
    var requestId = ++feedRequest;
    var staffFilter = document.getElementById("filter-user");
    if (!staffFilter || staffFilter.dataset.loaded !== "1") await loadFilterUsers();
    if (requestId !== feedRequest) return;
    var heldHeight = feed.offsetHeight;
    if (heldHeight > 48) feed.style.minHeight = heldHeight + "px";
    feed.replaceChildren(el("p", "rounded-lg bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5", "Đang tải nguồn cung..."));
    try {
      var response = await fetch(url, {
        headers: { Authorization: "Bearer " + token }
      });
      if (requestId !== feedRequest) return;
      if (response.status === 401 || response.status === 403) {
        console.error("GET /api/properties bị từ chối:", response.status);
        expireSession();
        return;
      }
      if (!response.ok) {
        var failText = await response.text();
        console.error("GET /api/properties thất bại:", response.status, failText);
        feed.textContent = "";
        feed.appendChild(el("p", "rounded-lg bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5", "Không tải được danh sách nguồn cung."));
        return;
      }
      var data = await response.json();
      if (requestId !== feedRequest) return;
      await ensureCurrentUserId();
      if (requestId !== feedRequest) return;
      renderFeed(feed, Array.isArray(data) ? data : [], params.toString() !== "");
    } catch (error) {
      if (requestId !== feedRequest) return;
      console.error("GET /api/properties lỗi:", error);
      feed.replaceChildren(el("p", "rounded-lg bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5", "Không kết nối được máy chủ."));
    } finally {
      if (requestId === feedRequest) feed.style.minHeight = "";
    }
  }

  var duplicateTimer = null;
  var duplicateRequest = 0;
  var duplicateBlocked = false;

  function setDuplicateState(blocked, message) {
    var box = document.getElementById("duplicate-warning");
    var button = document.getElementById("submit-property");
    duplicateBlocked = blocked;
    if (box) {
      box.textContent = blocked ? message : "";
      box.classList.toggle("is-hidden", !blocked);
    }
    if (button) button.disabled = blocked;
  }

  function scheduleDuplicateCheck() {
    window.clearTimeout(duplicateTimer);
    duplicateTimer = window.setTimeout(checkDuplicateParcel, 400);
  }

  async function checkDuplicateParcel() {
    var sheetField = document.getElementById("property-so-to");
    var plotField = document.getElementById("property-so-thua");
    var sheet = sheetField ? sheetField.value.trim() : "";
    var plot = plotField ? plotField.value.trim() : "";
    var requestId = ++duplicateRequest;
    if (!sheet || !plot) {
      setDuplicateState(false, "");
      return;
    }
    var token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      var params = new URLSearchParams({ so_to: sheet, so_thua: plot });
      var response = await fetch(API_ORIGIN + "/api/properties/check-duplicate?" + params.toString(), {
        headers: { Authorization: "Bearer " + token }
      });
      if (requestId !== duplicateRequest) return;
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) {
        setDuplicateState(false, "");
        return;
      }
      var data = await response.json();
      if (requestId !== duplicateRequest) return;
      var latestSheet = sheetField ? sheetField.value.trim() : "";
      var latestPlot = plotField ? plotField.value.trim() : "";
      if (latestSheet !== sheet || latestPlot !== plot) return;
      if (data && data.author_name) {
        setDuplicateState(
          true,
          "⚠️ Cảnh báo: Bất động sản này (Thửa đất số " + plot + ", Tờ bản đồ số " + sheet + ") đã được đăng bởi nhân viên " + data.author_name + ". Không thể tạo mới!"
        );
        return;
      }
      setDuplicateState(false, "");
    } catch (error) {
      console.error("GET /api/properties/check-duplicate lỗi:", error);
      if (requestId === duplicateRequest) setDuplicateState(false, "");
    }
  }

  async function submitProperty(form) {
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var submitButton = form.querySelector('button[type="submit"]');
    var contentField = form.querySelector("#property-content");
    var content = contentField ? contentField.value.trim() : "";
    if (!content) {
      showNotice("Hãy dán nội dung bài viết.", "warning");
      return;
    }
    var parsed;
    try {
      parsed = parsePropertyData(content);
    } catch (error) {
      console.error("parsePropertyData lỗi:", error);
      showNotice("Không đọc được nội dung bài viết.", "error");
      return;
    }
    if (parsed.price == null) console.warn("Không tách được giá bán từ bài viết.");
    if (parsed.area == null) console.warn("Không tách được diện tích từ bài viết.");
    window.clearTimeout(duplicateTimer);
    await checkDuplicateParcel();
    if (duplicateBlocked) return;
    
    // --- KHÓA NÚT SUBMIT & BẮT ĐẦU UPLOAD LÊN CLOUDFLARE R2 ---
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải ảnh...';
    }

    let finalImageUrls = "";
    if (selectedMedia && selectedMedia.length > 0) {
        // Gọi hàm upload R2 anh vừa thêm
        finalImageUrls = await uploadToCloudflareR2(selectedMedia); 
    }
    
    if (submitButton) {
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang lưu bài viết...';
    }
    // -------------------------------------------------------------

    var sheetField = document.getElementById("property-so-to");
    var plotField = document.getElementById("property-so-thua");
    
    var payload = new FormData();
    payload.append("content", content);
    if (parsed.price != null) payload.append("price", String(parsed.price));
    if (parsed.area != null) payload.append("area", String(parsed.area));
    payload.append("location", (parsed.location || "").slice(0, 255));
    payload.append("direction", parsed.direction || "");
    payload.append("so_to", sheetField ? sheetField.value.trim() : "");
    payload.append("so_thua", plotField ? plotField.value.trim() : "");
    payload.append("status", "Chưa bán");
    
    // THAY ĐỔI QUAN TRỌNG: Gửi chuỗi link R2 thay vì gửi nguyên file vật lý
    if (finalImageUrls) {
        payload.append("r2_urls", finalImageUrls);
    }

    try {
      var response = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: payload
      });
      if (response.status === 401 || response.status === 403) {
        console.error("POST /api/properties bị từ chối:", response.status);
        expireSession();
        return;
      }
      if (!response.ok) {
        var failBody = null;
        try {
          failBody = await response.json();
        } catch (parseError) {
          console.error("Không đọc được lỗi đăng tin:", parseError);
        }
        console.error("POST /api/properties thất bại:", response.status, failBody);
        showNotice(readError(failBody), "error");
        return;
      }
      var modal = document.getElementById("property-modal");
      if (modal) modal.classList.add("is-hidden");
      form.reset();
      clearMediaPreview();
      setDuplicateState(false, "");
      showNotice("Đăng thành công", "success");
      await loadPropertyFeed();
    } catch (error) {
      console.error("POST /api/properties lỗi:", error);
      showNotice("Không kết nối được máy chủ.", "error");
    } finally {
      if (submitButton) {
          submitButton.disabled = duplicateBlocked;
          submitButton.innerHTML = 'Đăng tin'; // Trả lại text ban đầu
      }
    }
  }

  function closeEditModal() {
    var modal = document.getElementById("edit-modal");
    if (modal) modal.classList.add("is-hidden");
  }

  function clearPreview(preview) {
    if (!preview) return;
    preview.querySelectorAll("[data-object-url]").forEach(function (node) {
      URL.revokeObjectURL(node.getAttribute("data-object-url"));
    });
    preview.textContent = "";
  }

  function previewFiles(files, preview) {
    clearPreview(preview);
    Array.prototype.forEach.call(files || [], function (file) {
      var objectUrl = URL.createObjectURL(file);
      var tile = el("div", "relative h-20 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5");
      var node;
      if (file.type.indexOf("video/") === 0) {
        node = document.createElement("video");
        node.muted = true;
        node.preload = "metadata";
        node.className = "h-full w-full bg-black object-contain";
      } else {
        node = document.createElement("img");
        node.alt = file.name;
        node.className = "h-full w-full object-cover";
      }
      node.src = objectUrl;
      node.setAttribute("data-object-url", objectUrl);
      tile.appendChild(node);
      preview.appendChild(tile);
    });
  }

  function mediaTile(url, removable) {
    var tile = el("div", "relative h-20 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5");
    tile.setAttribute("data-url", url);
    tile.dataset.kind = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image";
    var node;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      node = document.createElement("video");
      node.muted = true;
      node.className = "h-full w-full bg-black object-cover";
    } else {
      node = document.createElement("img");
      node.alt = "Ảnh nguồn cung";
      node.className = "h-full w-full object-cover";
    }
    node.src = mediaSrc(url);
    tile.appendChild(node);
    if (removable) {
      var remove = el("button", "js-remove-media absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-black");
      remove.type = "button";
      remove.setAttribute("aria-label", "Xóa ảnh");
      var icon = document.createElement("i");
      icon.className = "fa-solid fa-xmark";
      icon.setAttribute("aria-hidden", "true");
      remove.appendChild(icon);
      tile.appendChild(remove);
    }
    return tile;
  }

  var editClearVideo = false;

  function openEditModal(article) {
    var modal = document.getElementById("edit-modal");
    var content = document.getElementById("edit-content");
    var select = document.getElementById("edit-status");
    var form = document.getElementById("edit-form");
    var currentMedia = document.getElementById("edit-media");
    var upload = document.getElementById("edit_media_upload");
    if (!modal || !content || !select || !form || !article) return;
    var raw = article.querySelector(".post-text");
    content.value = raw ? (raw.getAttribute("data-raw") || "") : "";
    select.value = article.dataset.status || "Chưa bán";
    form.dataset.id = article.dataset.id || "";
    if (currentMedia) {
      currentMedia.textContent = "";
      var urls = [];
      try {
        urls = JSON.parse(article.dataset.media || "[]");
      } catch (error) {
        console.error("Không đọc được danh sách ảnh:", error);
      }
      (Array.isArray(urls) ? urls : []).forEach(function (url) {
        if (url) currentMedia.appendChild(mediaTile(url, true));
      });
      if (article.dataset.video) currentMedia.appendChild(mediaTile(article.dataset.video, true));
    }
    if (upload) upload.value = "";
    clearPreview(document.getElementById("edit-upload-preview"));
    editClearVideo = false;
    modal.classList.remove("is-hidden");
    content.focus();
  }

  async function submitEdit(form) {
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var propertyId = form.dataset.id;
    var contentField = document.getElementById("edit-content");
    var select = document.getElementById("edit-status");
    var content = contentField ? contentField.value.trim() : "";
    if (!propertyId || !content) {
      showNotice("Hãy nhập nội dung bài viết.", "warning");
      return;
    }
    var parsed;
    try {
      parsed = parsePropertyData(content);
    } catch (error) {
      console.error("parsePropertyData lỗi:", error);
      showNotice("Không đọc được nội dung bài viết.", "error");
      return;
    }
    var payload = new FormData();
    payload.append("content", content);
    payload.append("status", select ? select.value.trim() : "Chưa bán");
    payload.append("price", parsed.price == null ? "" : String(parsed.price));
    payload.append("area", parsed.area == null ? "" : String(parsed.area));
    payload.append("location", (parsed.location || "").slice(0, 255));
    payload.append("direction", parsed.direction || "");
    form.querySelectorAll("#edit-media [data-url]").forEach(function (tile) {
      if (tile.dataset.kind === "video") return;
      payload.append("keep_media", tile.getAttribute("data-url"));
    });
    var upload = document.getElementById("edit_media_upload");
    var files = upload && upload.files ? upload.files : [];
    for (var i = 0; i < files.length; i++) payload.append("media_files", files[i]);
    if (editClearVideo && !Array.prototype.some.call(files, function (file) { return String(file.type || "").indexOf("video/") === 0; })) {
      payload.append("clear_video", "1");
    }
    var submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      var response = await fetch(API_URL + "/" + propertyId, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: payload
      });
      if (response.status === 401) {
        console.error("PUT /api/properties bị từ chối:", response.status);
        expireSession();
        return;
      }
      if (response.status === 403) {
        var denied = null;
        try {
          denied = await response.json();
        } catch (parseDenied) {
          denied = null;
        }
        showToast(readError(denied) || "Bạn không có quyền sửa/xóa bài viết của người khác", "error");
        return;
      }
      if (!response.ok) {
        var failBody = null;
        try {
          failBody = await response.json();
        } catch (parseError) {
          console.error("Không đọc được lỗi cập nhật bài viết:", parseError);
        }
        console.error("PUT /api/properties thất bại:", response.status, failBody);
        showNotice(readError(failBody), "error");
        return;
      }
      closeEditModal();
      await loadPropertyFeed();
    } catch (error) {
      console.error("PUT /api/properties lỗi:", error);
      showNotice("Không kết nối được máy chủ.", "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  var lightboxAlbum = [];
  var lightboxIndex = 0;
  var lightboxTouch = null;
  var lightboxIgnoreClick = false;

  function postImageUrls(article) {
    if (!article) return [];
    var raw = [];
    try {
      raw = JSON.parse(article.dataset.media || "[]");
    } catch (error) {
      raw = [];
    }
    if (!Array.isArray(raw)) raw = [];
    return raw.filter(function (url) {
      return url && !/\.(mp4|webm|mov)(\?|$)/i.test(String(url));
    }).map(mediaSrc);
  }

  function lightboxIndexOf(urls, src) {
    var target = String(src || "");
    var plain = target.split("?")[0];
    for (var i = 0; i < urls.length; i += 1) {
      var item = String(urls[i] || "");
      if (item === target || item.split("?")[0] === plain) return i;
    }
    return -1;
  }

  function renderLightbox() {
    var image = document.getElementById("lightbox-image");
    var counter = document.getElementById("lightbox-counter");
    var prev = document.getElementById("lightbox-prev");
    var next = document.getElementById("lightbox-next");
    var thumbs = document.getElementById("lightbox-thumbs");
    var total = lightboxAlbum.length;
    if (!image || !total) return;
    if (lightboxIndex < 0) lightboxIndex = 0;
    if (lightboxIndex >= total) lightboxIndex = total - 1;
    image.src = lightboxAlbum[lightboxIndex];
    if (counter) counter.textContent = (lightboxIndex + 1) + " / " + total;
    var single = total < 2;
    if (prev) prev.hidden = single;
    if (next) next.hidden = single;
    if (!thumbs) return;
    thumbs.replaceChildren();
    lightboxAlbum.forEach(function (url, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "lightbox-thumb" + (index === lightboxIndex ? " is-active" : "");
      button.setAttribute("aria-label", "Ảnh " + (index + 1));
      if (index === lightboxIndex) button.setAttribute("aria-current", "true");
      var thumb = document.createElement("img");
      thumb.src = url;
      thumb.alt = "";
      button.appendChild(thumb);
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        lightboxIndex = index;
        renderLightbox();
      });
      thumbs.appendChild(button);
    });
    var active = thumbs.querySelector(".is-active");
    if (active) {
      var left = active.offsetLeft - (thumbs.clientWidth - active.offsetWidth) / 2;
      thumbs.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }

  function stepLightbox(delta) {
    var total = lightboxAlbum.length;
    if (total < 2) return;
    lightboxIndex = (lightboxIndex + delta + total) % total;
    renderLightbox();
  }

  function openLightbox(src, alt, urls) {
    var modal = document.getElementById("lightbox");
    var image = document.getElementById("lightbox-image");
    if (!modal || !image || !src) return;
    var album = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!album.length) album = [src];
    var index = lightboxIndexOf(album, src);
    if (index < 0) {
      album.unshift(src);
      index = 0;
    }
    lightboxAlbum = album;
    lightboxIndex = index;
    image.alt = alt || "Ảnh phóng to";
    renderLightbox();
    modal.classList.remove("is-hidden");
    document.body.classList.add("lightbox-lock");
  }

  function closeLightbox() {
    var modal = document.getElementById("lightbox");
    var image = document.getElementById("lightbox-image");
    var thumbs = document.getElementById("lightbox-thumbs");
    lightboxAlbum = [];
    lightboxIndex = 0;
    lightboxTouch = null;
    if (image) image.removeAttribute("src");
    if (thumbs) thumbs.replaceChildren();
    if (modal) modal.classList.add("is-hidden");
    document.body.classList.remove("lightbox-lock");
  }
// Hàm chuyên dụng để đẩy file lên R2 và trả về chuỗi các đường link
async function uploadToCloudflareR2(files) {
    let uploadedUrls = [];
    for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        try {
            const response = await fetch(API_ORIGIN + "/api/upload-image", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            if (response.ok && data.success) {
                uploadedUrls.push(data.url);
            }
        } catch (error) {
            console.error("Lỗi upload:", error);
        }
    }
    // Trả về chuỗi chứa các link R2, cách nhau bằng dấu phẩy
    return uploadedUrls.join(','); 
}
  async function downloadLightboxImage(button) {
    var image = document.getElementById("lightbox-image");
    var src = image ? (image.currentSrc || image.src) : "";
    if (!src) return;
    if (button) button.disabled = true;
    try {
      var response = await fetch(src);
      if (!response.ok) throw new Error("Không tải được hình ảnh");
      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      var extension = (String(src).split("?")[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1] || "jpg";
      link.download = "ThanhTam_BDS_" + (lightboxIndex + 1) + "." + extension;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (error) {
      console.error("Không tải được ảnh lightbox:", error);
      showToast("Không tải được hình ảnh", "error");
    } finally {
      if (button) button.disabled = false;
    }
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
      toast.style.zIndex = "100000";
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

  var COPY_HASHTAGS = "#BDSThanhTam #NhaDatHaTinh";

  function plainCopyText(value) {
    var text = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
    text = text.replace(/<[^>]*>/g, "");
    text = text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'");
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return "";
    if (text.indexOf(COPY_HASHTAGS) === -1) text += "\n\n" + COPY_HASHTAGS;
    return text;
  }

  function copyWithSelection(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.width = "2em";
    area.style.height = "2em";
    area.style.padding = "0";
    area.style.border = "none";
    area.style.outline = "none";
    area.style.boxShadow = "none";
    area.style.background = "transparent";
    area.style.fontSize = "16px";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function writeClipboard(text) {
    var copied = copyWithSelection(text);
    if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        if (copied) return;
        return copyWithSelection(text) ? undefined : Promise.reject(new Error("copy"));
      });
    }
    if (copied) return Promise.resolve();
    return Promise.reject(new Error("copy"));
  }

  function imageUrlsFromArticle(article) {
    var list = [];
    try {
      list = JSON.parse(article.dataset.media || "[]");
    } catch (error) {
      console.error("Lỗi khi tải ảnh:", error);
    }
    if (!Array.isArray(list)) return [];
    return list.filter(function (url) {
      return url && !/\.(mp4|webm|mov)(\?|$)/i.test(String(url));
    }).map(mediaSrc);
  }

  function triggerImageDownload(blob, filename) {
    var blobUrl = window.URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 1500);
  }

  async function fetchImageBlobs(mediaUrls) {
    var blobs = [];
    for (var index = 0; index < mediaUrls.length; index++) {
      try {
        var response = await fetch(mediaUrls[index]);
        if (!response.ok) throw new Error("HTTP " + response.status);
        blobs.push(await response.blob());
      } catch (error) {
        console.error("Lỗi khi tải ảnh:", error);
      }
    }
    if (!blobs.length) throw new Error("Không tải được hình ảnh");
    return blobs;
  }

  function imageFilesFromBlobs(blobs) {
    return blobs.map(function (blob, index) {
      return new File([blob], "anh_" + (index + 1) + ".jpg", { type: blob.type || "image/jpeg" });
    });
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error("Không tải được hình ảnh"));
      };
      script.onerror = function () {
        reject(new Error("Không tải được hình ảnh"));
      };
      document.head.appendChild(script);
    });
  }

  async function downloadImageZip(files) {
    var JSZipLib = await loadJSZip();
    var zip = new JSZipLib();
    files.forEach(function (file) {
      zip.file(file.name, file);
    });
    var blob = await zip.generateAsync({ type: "blob" });
    triggerImageDownload(blob, "HinhAnh_BDS.zip");
  }

  async function deliverImages(mediaUrls) {
    var files = imageFilesFromBlobs(await fetchImageBlobs(mediaUrls));
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare && navigator.share) {
      try {
        await navigator.share({ files: files });
        return;
      } catch (error) {
        if (error && error.name === "AbortError") throw error;
        console.error("Lỗi khi chia sẻ ảnh:", error);
      }
    }
    await downloadImageZip(files);
  }

  function setPrepareBusy(button, busy) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.label) button.dataset.label = button.textContent;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Đang xử lý ảnh...";
      return;
    }
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.label) button.textContent = button.dataset.label;
  }

  var prepareMediaUrls = [];
  var prepareVideoUrl = "";
  var SALE_CONTACT_KEY = "saleContact";

  function decodeJwtPayload(token) {
    var part = String(token || "").split(".")[1];
    if (!part) return {};
    try {
      var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return JSON.parse(new TextDecoder("utf-8").decode(bytes));
    } catch (error) {
      return {};
    }
  }

  function loadSaleProfile() {
    var tokenName = decodeJwtPayload(localStorage.getItem("accessToken")).name || "";
    var storedName = localStorage.getItem("user_name") || "";
    var phone = localStorage.getItem("user_phone") || "";
    if (!phone) {
      try {
        var older = JSON.parse(localStorage.getItem(SALE_CONTACT_KEY) || "null");
        if (older && older.phone) phone = older.phone;
      } catch (error) {
        phone = "";
      }
    }
    return { name: storedName || tokenName || "", phone: phone };
  }

  function saveSaleProfile(name, phone) {
    var cleanPhone = phone || "";
    if (cleanPhone === "[Điền số điện thoại của bạn vào đây]") cleanPhone = "";
    if (name) localStorage.setItem("user_name", name);
    localStorage.setItem("user_phone", cleanPhone);
    return cleanPhone;
  }

  async function loadAccountProfile() {
    var profile = loadSaleProfile();
    var token = localStorage.getItem("accessToken");
    if (!token) return profile;
    try {
      var response = await fetch(API_ORIGIN + "/api/me", {
        headers: { Authorization: "Bearer " + token }
      });
      if (response.status === 401) {
        expireSession();
        return profile;
      }
      if (!response.ok) return profile;
      var data = await response.json();
      if (data && data.full_name) profile.name = data.full_name;
      if (data && data.phone) profile.phone = data.phone;
      saveSaleProfile(profile.name, profile.phone);
    } catch (error) {
      console.error("Không đọc được hồ sơ đăng nhập:", error);
    }
    return profile;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function itemValue(text, number, labels) {
    var list = Array.isArray(labels) ? labels : [labels];
    var index;
    for (index = 0; index < list.length; index++) {
      var labeled = lineValue(text, number, list[index]);
      if (labeled) return labeled;
    }
    var loose = String(text || "").match(new RegExp("^\\s*" + number + "\\.\\s*(.*)$", "im"));
    if (!loose) return "";
    var value = loose[1].trim();
    for (index = 0; index < list.length; index++) {
      var prefix = new RegExp("^" + escapeRegExp(list[index]) + "\\s*:\\s*", "i");
      if (prefix.test(value)) return value.replace(prefix, "").trim();
    }
    if (/^[^:]{1,40}:\s+/.test(value)) return value.replace(/^[^:]+:\s*/, "").trim();
    return value;
  }

  function listingHeadline(title, place) {
    var text = String(title || "").replace(/\s+/g, " ").trim();
    var where = String(place || "").replace(/\s+/g, " ").trim();
    var probe = (text + " " + where).toLowerCase();
    var kind = "BẤT ĐỘNG SẢN";
    if (/căn hộ|can ho/.test(probe)) kind = "CĂN HỘ";
    else if (/biệt thự|biet thu/.test(probe)) kind = "BIỆT THỰ";
    else if (/nhà phố|nha pho|nhà /.test(probe)) kind = "NHÀ";
    else if (/đất|dat/.test(probe)) kind = "ĐẤT";
    if (text && where && text.toLowerCase().indexOf(where.toLowerCase()) === -1) {
      return "🔥 " + text + " — " + kind + " TẠI " + where.toUpperCase();
    }
    if (text) return "🔥 " + text;
    if (where) return "🔥 CHÍNH CHỦ GỬI BÁN " + kind + " TẠI " + where.toUpperCase();
    return "🔥 CƠ HỘI SỞ HỮU " + kind + " TẠI HÀ TĨNH";
  }

  function contactBlock(name, phone) {
    var who = String(name || "").trim() || "Nhân viên";
    var number = String(phone || "").trim();
    if (number === "[Điền số điện thoại của bạn vào đây]") number = "";
    if (number) return "Nhân viên tư vấn: " + who + " - SĐT: " + number;
    return "Nhân viên tư vấn: " + who;
  }

  function applyContact(text, name, phone) {
    var line = contactBlock(name, phone);
    var source = String(text || "");
    source = source.replace(/^☎️ Liên hệ chính chủ\/Môi giới:.*$/gm, "");
    source = source.replace(/^Nhân viên tư vấn\s*\n[^\n]*\n[^\n]*/m, "");
    source = source.replace(/^Nhân viên tư vấn:.*$/gm, "");
    source = source.replace(/\n{3,}/g, "\n\n").trim();
    return source + "\n\n" + line;
  }

  function buildListingPost(raw, name, phone) {
    var title = itemValue(raw, 1, "Tiêu đề");
    var place = itemValue(raw, 2, "Đối tượng");
    var rows = [
      ["📍", "Vị trí", place],
      ["📐", "Diện tích", itemValue(raw, 3, "Diện tích")],
      ["🌳", "Tiện ích", itemValue(raw, 4, "Tiện ích")],
      ["📜", "Pháp lý", itemValue(raw, 5, "Pháp lý")],
      ["🗺️", "Quy hoạch", itemValue(raw, 6, "Quy hoạch")],
      ["🧭", "Phong thủy", itemValue(raw, 7, ["Phong thuỷ", "Phong thủy"])]
    ];
    var lines = [listingHeadline(title, place), ""];
    rows.forEach(function (row) {
      if (row[2]) lines.push(row[0] + " " + row[1] + ": " + row[2]);
    });
    lines.push("");
    lines.push(contactBlock(name, phone));
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function closePrepareModal() {
    var modal = document.getElementById("prepare-modal");
    if (modal) modal.classList.add("is-hidden");
  }

  function openPrepareModal(article) {
    var modal = document.getElementById("prepare-modal");
    var field = document.getElementById("prepare-content");
    if (!modal || !field || !article) return;
    var postText = article.querySelector(".post-text");
    var raw = postText ? (postText.getAttribute("data-raw") || "") : "";
    if (!raw && postText) raw = postText.innerText || postText.textContent || "";
    if (!String(raw).trim()) {
      showToast("Bài viết này chưa có nội dung");
      return;
    }
    var profile = loadSaleProfile();
    prepareVideoUrl = article.dataset.video || "";
    prepareMediaUrls = imageUrlsFromArticle(article);
    field.value = buildListingPost(raw, profile.name, profile.phone);
    modal.classList.remove("is-hidden");
    field.focus();
    field.setSelectionRange(0, 0);
    field.scrollTop = 0;
    var draft = field.value;
    loadAccountProfile().then(function (fresh) {
      if (modal.classList.contains("is-hidden")) return;
      var current = document.getElementById("prepare-content");
      if (!current || current.value !== draft) return;
      current.value = applyContact(current.value, fresh.name, fresh.phone);
    });
  }

  async function composeWithAi(button) {
    var field = document.getElementById("prepare-content");
    var styleField = document.getElementById("post-writing-style");
    var content = field ? field.value.trim() : "";
    if (!content) {
      showToast("Bài viết này chưa có nội dung");
      return;
    }
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    var allowed = { auto: true, urgent: true, invest: true, living: true };
    var style = styleField && allowed[styleField.value] ? styleField.value : "auto";
    var previous = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Đang viết...";
    try {
      var response = await fetch(API_ORIGIN + "/api/generate-content", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: content, style: style })
      });
      if (response.status === 401) {
        expireSession();
        return;
      }
      var data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
      if (!response.ok || !data || !data.content) {
        var detail = data && typeof data.detail === "string" ? data.detail : "AI chưa viết được bài.";
        showToast(detail, "error");
        return;
      }
      field.value = data.content;
      showToast("Đã tạo nội dung theo style đã chọn", "success");
    } catch (error) {
      console.error("POST /api/generate-content lỗi:", error);
      showToast("Không kết nối được máy chủ.", "error");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = previous;
    }
  }

  function pendingImagePaths(urls) {
    var seen = {};
    var paths = [];
    (urls || []).forEach(function (url) {
      var absolute = mediaSrc(url);
      var path = "";
      try {
        path = new URL(absolute).pathname;
      } catch (error) {
        path = "";
      }
      if (path.indexOf("/static/") !== 0 || seen[path]) return;
      seen[path] = true;
      paths.push(path);
    });
    return paths;
  }

  async function submitPendingPost(content, images, videoUrl) {
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      throw new Error("auth");
    }
    var profile = await loadAccountProfile();
    var videoPath = "";
    if (videoUrl) {
      var paths = pendingImagePaths([videoUrl]);
      videoPath = paths[0] || "";
    }
    var response = await fetch(API_ORIGIN + "/api/pending-posts", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: content,
        images: pendingImagePaths(images),
        video_url: videoPath,
        employee_name: profile.name || "",
        status: "pending"
      })
    });
    if (response.status === 401) {
      expireSession();
      throw new Error("auth");
    }
    if (!response.ok) throw new Error("pending");
  }

  async function confirmPrepare(button) {
    var field = document.getElementById("prepare-content");
    var text = field ? field.value : "";
    var urls = prepareMediaUrls.slice();
    setPrepareBusy(button, true);
    try {
      await writeClipboard(text);
      if (urls.length) await deliverImages(urls);
      await submitPendingPost(text, urls, prepareVideoUrl);
      closePrepareModal();
      showToast("Đã copy nội dung. Vui lòng kiểm tra thư viện ảnh hoặc thư mục tải xuống!", "success");
    } catch (error) {
      if (error && error.message === "auth") return;
      if (error && error.name === "AbortError") {
        try {
          await submitPendingPost(text, urls, prepareVideoUrl);
          closePrepareModal();
          showToast("Đã copy nội dung. Vui lòng kiểm tra thư viện ảnh hoặc thư mục tải xuống!", "success");
        } catch (pendingError) {
          if (!(pendingError && pendingError.message === "auth")) {
            showToast("Đã copy nội dung nhưng chưa gửi được bài chờ duyệt.", "error");
          }
        }
        return;
      }
      console.error("Không chuẩn bị được bài đăng:", error);
      if (error && error.message === "pending") {
        showToast("Đã copy nội dung nhưng chưa gửi được bài chờ duyệt.", "error");
        return;
      }
      var failedImages = String(error && error.message || "").indexOf("ảnh") !== -1;
      showToast(failedImages ? "Không tải được hình ảnh" : "Không sao chép được nội dung", "error");
    } finally {
      setPrepareBusy(button, false);
    }
  }

  function scheduleAddressFilter() {
    window.clearTimeout(addressTimer);
    addressTimer = window.setTimeout(function () {
      loadPropertyFeed();
    }, 500);
  }

  function clearFilters() {
    window.clearTimeout(addressTimer);
    ["filter-address", "filter-user", "filter-price", "filter-direction", "filter-status", "filterSoThua", "filterSoTo"].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = "";
    });
    loadPropertyFeed();
    setFilterDrawer(false);
  }

  function setFilterDrawer(open) {
    var drawer = document.getElementById("filter-drawer");
    var button = document.getElementById("open-filters");
    if (!drawer) return;
    drawer.classList.toggle("is-open", open);
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  async function deleteProperty(button) {
    var article = button.closest("article");
    var propertyId = article ? article.dataset.id : "";
    if (!article || !propertyId) return;
    var accepted = await Swal.fire({
      title: "Xác nhận?",
      text: "Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Đồng ý",
      cancelButtonText: "Hủy"
    });
    if (!accepted.isConfirmed) return;
    var token = localStorage.getItem("accessToken");
    if (!token) {
      expireSession();
      return;
    }
    button.disabled = true;
    try {
      var response = await fetch(API_URL + "/" + encodeURIComponent(propertyId), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        var denied = null;
        try {
          denied = await response.json();
        } catch (error) {
          denied = null;
        }
        showToast((denied && typeof denied.detail === "string" && denied.detail) || "Bạn không có quyền sửa/xóa bài viết của người khác", "error");
        return;
      }
      if (!response.ok) {
        showToast("Không xóa được bài viết.", "error");
        return;
      }
      article.remove();
      showToast("Đã xóa bài viết", "success");
    } catch (error) {
      console.error("DELETE /api/properties lỗi:", error);
      showToast("Không kết nối được máy chủ.", "error");
    } finally {
      if (article.isConnected) button.disabled = false;
    }
  }

  document.addEventListener("keydown", function (event) {
    var modal = document.getElementById("lightbox");
    if (!modal || modal.classList.contains("is-hidden")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
    }
  });

  document.addEventListener("touchstart", function (event) {
    var modal = document.getElementById("lightbox");
    if (!modal || modal.classList.contains("is-hidden")) return;
    if (!event.target.closest("#lightbox-stage")) return;
    var touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    lightboxTouch = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  document.addEventListener("touchend", function (event) {
    if (!lightboxTouch) return;
    var start = lightboxTouch;
    lightboxTouch = null;
    var modal = document.getElementById("lightbox");
    if (!modal || modal.classList.contains("is-hidden")) return;
    var touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    var dx = touch.clientX - start.x;
    var dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    lightboxIgnoreClick = true;
    setTimeout(function () { lightboxIgnoreClick = false; }, 350);
    stepLightbox(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener("click", function (event) {
    if (event.target.closest("#open-filters")) {
      var drawer = document.getElementById("filter-drawer");
      setFilterDrawer(!(drawer && drawer.classList.contains("is-open")));
      return;
    }
    if (event.target.closest("#clear-filters")) {
      clearFilters();
      return;
    }
    var downloadLightbox = event.target.closest("#download-lightbox");
    if (downloadLightbox) {
      downloadLightboxImage(downloadLightbox);
      return;
    }
    if (lightboxIgnoreClick && event.target.closest("#lightbox")) return;
    if (event.target.closest("#lightbox-prev")) {
      stepLightbox(-1);
      return;
    }
    if (event.target.closest("#lightbox-next")) {
      stepLightbox(1);
      return;
    }
    if (event.target.closest("#close-lightbox") || event.target.id === "lightbox" || event.target.id === "lightbox-stage") {
      closeLightbox();
      return;
    }
    if (event.target.closest("#lightbox-thumbs") || event.target.closest("#lightbox-toolbar") || event.target.id === "lightbox-image") return;
    var photo = event.target.closest(".js-feed-photo");
    if (photo) {
      var article = photo.closest("article");
      openLightbox(photo.currentSrc || photo.src, photo.alt, postImageUrls(article));
      return;
    }
    var selectedRemove = event.target.closest(".js-remove-selected");
    if (selectedRemove) {
      event.preventDefault();
      var removeIndex = Number(selectedRemove.getAttribute("data-index"));
      if (removeIndex >= 0 && removeIndex < selectedMedia.length) {
        selectedMedia.splice(removeIndex, 1);
        syncSelectedMedia();
        renderSelectedMedia();
      }
      return;
    }
    var removeButton = event.target.closest(".js-remove-media");
    if (removeButton) {
      var tile = removeButton.closest("[data-url]");
      if (tile && tile.dataset.kind === "video") editClearVideo = true;
      if (tile) tile.remove();
      return;
    }
    if (event.target.closest("#cancel-prepare, #close-prepare, #prepare-backdrop")) {
      closePrepareModal();
      return;
    }
    var commentButton = event.target.closest(".js-comments");
    if (commentButton) {
      var commentCard = commentButton.closest("article");
      var commentPanel = commentCard ? commentCard.querySelector(".js-comment-panel") : null;
      if (!commentPanel) return;
      var commentOpen = commentPanel.classList.contains("is-hidden");
      commentPanel.classList.toggle("is-hidden", !commentOpen);
      commentButton.setAttribute("aria-expanded", commentOpen ? "true" : "false");
      if (commentOpen) {
        loadComments(commentCard);
        var commentField = commentPanel.querySelector("textarea");
        if (commentField) commentField.focus();
      }
      return;
    }
    var aiComposeButton = event.target.closest("#ai-compose");
    if (aiComposeButton) {
      composeWithAi(aiComposeButton);
      return;
    }
    var confirmPrepareButton = event.target.closest("#confirm-prepare");
    if (confirmPrepareButton) {
      confirmPrepare(confirmPrepareButton);
      return;
    }
    var prepareButton = event.target.closest(".js-prepare");
    if (prepareButton) {
      openPrepareModal(prepareButton.closest("article"));
      return;
    }
    var deleteButton = event.target.closest(".js-delete");
    if (deleteButton) {
      deleteProperty(deleteButton);
      return;
    }
    var editButton = event.target.closest(".js-edit");
    if (!editButton) return;
    var article = editButton.closest("article");
    if (!article) return;
    openEditModal(article);
  });

  document.addEventListener("input", function (event) {
    if (!event.target) return;
    if (event.target.id === "filter-address" || event.target.id === "filterSoThua" || event.target.id === "filterSoTo") {
      scheduleAddressFilter();
      return;
    }
    if (event.target.id === "property-so-to" || event.target.id === "property-so-thua") {
      scheduleDuplicateCheck();
    }
  });

  document.addEventListener("focusout", function (event) {
    if (!event.target) return;
    if (event.target.id === "property-so-to" || event.target.id === "property-so-thua") {
      window.clearTimeout(duplicateTimer);
      checkDuplicateParcel();
    }
  });

  document.addEventListener("search", function (event) {
    if (!event.target || event.target.id !== "filter-address") return;
    scheduleAddressFilter();
  });

  document.addEventListener("change", function (event) {
    if (!event.target) return;
    if (event.target.id === "filter-user" || event.target.id === "filter-price" || event.target.id === "filter-direction" || event.target.id === "filter-status") {
      loadPropertyFeed();
      return;
    }
    if (event.target.id === "media_upload") {
      addSelectedMedia(event.target.files);
      return;
    }
    if (event.target.id === "edit_media_upload") {
      previewFiles(event.target.files, document.getElementById("edit-upload-preview"));
    }
  });

  document.addEventListener("submit", function (event) {
    if (!event.target) return;
    if (event.target.classList && event.target.classList.contains("js-comment-form")) {
      event.preventDefault();
      submitComment(event.target);
      return;
    }
    if (event.target.id === "filter-form") {
      event.preventDefault();
      setFilterDrawer(false);
      loadPropertyFeed();
      return;
    }
    if (event.target.id === "edit-form") {
      event.preventDefault();
      submitEdit(event.target);
      return;
    }
    if (event.target.id !== "property-form") return;
    event.preventDefault();
    submitProperty(event.target);
  });
	
  window.parsePropertyData = parsePropertyData;
  window.fillPropertyComposer = fillPropertyComposer;
  window.loadPropertyFeed = loadPropertyFeed;
  window.closeLightbox = closeLightbox;
  if (document.getElementById("feed")) loadPropertyFeed();
})();
