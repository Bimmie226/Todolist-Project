/**
 * profile.js — Taskly User Profile Page
 * ══════════════════════════════════════════════════════════
 *
 * Sections:
 *  A. Config & constants
 *  B. LocalStorage helpers (ProfileDB)
 *  C. Toast & utilities
 *  D. Theme system
 *  E. Sidebar & header shared logic
 *  F. Profile data loader (view mode)
 *  G. Profile completion calculator
 *  H. Stats loader (boards/tasks counts)
 *  I. Edit mode — open / close / populate
 *  J. Form validation (real-time + on-save)
 *  K. Avatar handling (file upload + URL)
 *  L. Auto-save
 *  M. Save handler
 *  N. Theme toggle (card + form switch)
 *  O. Keyboard shortcuts
 *  P. Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & CONSTANTS
   ════════════════════════════════════════════════════ */
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const authHeaders = {
  "X-CSRFToken": getCookie("csrftoken"),
};

const LS = {
  THEME: "taskly-theme",
  USERNAME: "taskly-username",
  PROFILE: "taskly-profile", // full profile object
  BOARDS: "taskly-boards-db",
  JOINED: "taskly-joined-date",
};

/** Default / empty profile */
const DEFAULT_PROFILE = {
  name: "",
  email: "",
  phone: "",
  address: "",
  birthDate: "",
  bio: "",
  avatar: "", // base64 or URL
};

/** Completion checklist items (field → label) */
const COMPLETION_ITEMS = [
  { key: "full_name", label: "Họ và tên" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Số điện thoại" },
  { key: "birth_date", label: "Ngày sinh" },
  { key: "address", label: "Địa chỉ" },
  { key: "bio", label: "Giới thiệu bản thân" },
  { key: "avatar_url", label: "Ảnh đại diện" },
];

/* ════════════════════════════════════════════════════
   B. PROFILE API — Thay thế ProfileDB cũ
   ════════════════════════════════════════════════════ */
const ProfileAPI = {
  // Tải dữ liệu từ Django
  async load() {
    try {
      const res = await fetch(API_PROFILE_ME);
      if (!res.ok) throw new Error("Không thể tải hồ sơ");
      const data = await res.json();
      return data.profile;
    } catch (err) {
      console.error(err);
      return DEFAULT_PROFILE;
    }
  },

  // Lưu dữ liệu lên Django (Sử dụng FormData để hỗ trợ upload ảnh)
  async save(formData) {
    try {
      const res = await fetch("/api/profile/update/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
          // Lưu ý: Không để Content-Type khi gửi FormData để trình duyệt tự xử lý boundary
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Lỗi cập nhật server");
      return await res.json();
    } catch (err) {
      showToast("Không thể lưu vào database.", "error");
      return null;
    }
  },
};

/* ════════════════════════════════════════════════════
   C. TOAST & UTILITIES
   ════════════════════════════════════════════════════ */
let _toastTimer = null;
const toastEl = document.getElementById("toast");
toastEl
  .querySelector(".toast__close")
  .addEventListener("click", () => toastEl.classList.remove("show"));

function showToast(msg, type = "success") {
  clearTimeout(_toastTimer);
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toastEl.className = `toast toast--${type}`;
  toastEl.querySelector(".toast__icon").textContent = icons[type] ?? "•";
  toastEl.querySelector(".toast__msg").textContent = msg;
  void toastEl.offsetHeight;
  toastEl.classList.add("show");
  _toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4000);
}
window.showToast = showToast;

function escHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/** Format ISO date → DD/MM/YYYY */
function fmtDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

/** Calculate age from YYYY-MM-DD */
function calcAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/* ════════════════════════════════════════════════════
   D. THEME SYSTEM
   ════════════════════════════════════════════════════ */
const html = document.documentElement;

function applyTheme(theme) {
  html.setAttribute("data-theme", theme);
  localStorage.setItem(LS.THEME, theme);

  // Sync icon state (fallback for browsers)
  const s = document.getElementById("iconSun");
  const m = document.getElementById("iconMoon");
  if (s && m) {
    s.style.display = theme === "dark" ? "none" : "";
    m.style.display = theme === "dark" ? "" : "none";
  }

  // Sync theme cards
  document.querySelectorAll(".theme-option").forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.theme === theme);
  });

  // Sync form toggle switch
  const fThemeDark = document.getElementById("fThemeDark");
  if (fThemeDark) fThemeDark.checked = theme === "dark";
  updateToggleLabel(theme);

  // Sync sidebar label
  const sidebarThemeLabel = document.getElementById("sidebarThemeLabel");
  if (sidebarThemeLabel)
    sidebarThemeLabel.textContent = theme === "dark" ? "Tối" : "Sáng";
}

function updateToggleLabel(theme) {
  const lbl = document.getElementById("toggleLabel");
  if (lbl) lbl.textContent = theme === "dark" ? "Chế độ Tối" : "Chế độ Sáng";
}

// Init theme on load
(function initTheme() {
  const saved =
    localStorage.getItem(LS.THEME) ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  applyTheme(saved);
})();

// Header theme toggle button
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

// Theme card buttons (in left column)
document.querySelectorAll(".theme-option").forEach((btn) => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
});

// Form toggle switch
document.getElementById("fThemeDark").addEventListener("change", (e) => {
  applyTheme(e.target.checked ? "dark" : "light");
});

// Sidebar theme button
document.getElementById("sidebarThemeBtn").addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

/* ════════════════════════════════════════════════════
   E. SIDEBAR & HEADER
   ════════════════════════════════════════════════════ */
const sidebar = document.getElementById("sidebar");
const appLayout = document.getElementById("appLayout");
const overlay = document.getElementById("overlay");

document.getElementById("sidebarCollapse").addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  appLayout.classList.toggle("collapsed");
});
document.getElementById("hamburger").addEventListener("click", () => {
  const open = sidebar.classList.toggle("mobile-open");
  overlay.classList.toggle("show", open);
});
overlay.addEventListener("click", () => {
  sidebar.classList.remove("mobile-open");
  overlay.classList.remove("show");
});

// User dropdown
const userAvatarBtn = document.getElementById("userAvatarBtn");
const userDropdown = document.getElementById("userDropdown");
userAvatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = userDropdown.classList.toggle("open");
  userAvatarBtn.setAttribute("aria-expanded", String(isOpen));
});
document.addEventListener("click", (e) => {
  if (!document.getElementById("userMenuWrap").contains(e.target)) {
    userDropdown.classList.remove("open");
    userAvatarBtn.setAttribute("aria-expanded", "false");
  }
});

const btnLogout = document.getElementById("btnLogout");

if (btnLogout) {
  btnLogout.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.clear();
    showToast("Đang đăng xuất...", "info");

    setTimeout(() => {
      // Gọi đến URL logout để Django xóa Session trên Server
      window.location.href = "/logout/";
    }, 800);
  });
}
/* ════════════════════════════════════════════════════
   F. PROFILE DATA LOADER — render VIEW mode
   ════════════════════════════════════════════════════ */
function renderProfile(profile) {
  // Nếu không có dữ liệu, dùng object trống để tránh lỗi
  if (!profile) profile = DEFAULT_PROFILE;

  const username = localStorage.getItem(LS.USERNAME) || "user";
  const displayName = profile.full_name || username;
  const displayEmail = profile.email || `${username}@taskly.vn`;

  // 1. Cập nhật thẻ Avatar Card bên trái
  document.getElementById("displayName").textContent = displayName;
  document.getElementById("displayEmail").textContent = displayEmail;

  // 2. Cập nhật Menu Dropdown trên Header
  const udName = document.getElementById("udName");
  if (udName) udName.textContent = displayName;
  const udEmail = document.getElementById("udEmail");
  if (udEmail) udEmail.textContent = displayEmail;

  // 3. Đổ dữ liệu vào các thẻ Thông tin cá nhân
  setInfoValue("infoName", profile.full_name);
  setInfoValue("infoEmail", profile.email);
  setInfoValue("infoPhone", profile.phone);
  setInfoValue("infoAddress", profile.address);
  setInfoValue("infoBio", profile.bio);

  // 4. Xử lý riêng phần Ngày sinh (Hiển thị định dạng VN + Tính tuổi)
  const birthEl = document.getElementById("infoBirthDate");
  if (profile.birth_date) {
    const age = calcAge(profile.birth_date);
    birthEl.textContent =
      fmtDate(profile.birth_date) + (age !== null ? ` (${age} tuổi)` : "");
    birthEl.classList.remove("empty");
  } else {
    birthEl.textContent = "Chưa cập nhật";
    birthEl.classList.add("empty");
  }

  // 5. Xử lý hiển thị Ảnh đại diện (Dùng URL từ Django)
  renderAvatar(profile.avatar_url, displayName);
}

/** Set info value with empty style */
function setInfoValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value && value.trim()) {
    el.textContent = value;
    el.classList.remove("empty");
  } else {
    el.textContent = "Chưa cập nhật";
    el.classList.add("empty");
  }
}

/** Render avatar in both header and profile card */
function renderAvatar(avatarUrl, name) {
  const avatarImg = document.getElementById("avatarImg");
  const avatarInitials = document.getElementById("avatarInitials");
  const headerImg = document.getElementById("headerAvatarImg");

  if (avatarUrl) {
    // Nếu có ảnh từ Database
    avatarImg.src = avatarUrl;
    avatarImg.style.display = "block";
    avatarInitials.style.display = "none";

    headerImg.src = avatarUrl;
    headerImg.style.display = "block";
    document.getElementById("userInitials").style.display = "none";
  } else {
    // Nếu không có ảnh, hiện chữ cái đầu
    const initials = name ? name.substring(0, 2).toUpperCase() : "TN";
    avatarImg.style.display = "none";
    avatarInitials.style.display = "grid";
    avatarInitials.textContent = initials;

    headerImg.style.display = "none";
    document.getElementById("userInitials").style.display = "block";
    document.getElementById("userInitials").textContent = initials;
  }
}

/* ════════════════════════════════════════════════════
   G. PROFILE COMPLETION CALCULATOR
   ════════════════════════════════════════════════════ */
function renderCompletion(profile) {
  if (!profile) return;

  let filled = 0;
  const list = document.getElementById("completionChecklist");
  
  // Xóa danh sách cũ nếu có
  if (list) list.innerHTML = "";

  COMPLETION_ITEMS.forEach((item) => {
    // Lấy giá trị từ profile dựa trên key (ví dụ: profile['full_name'])
    const value = profile[item.key];
    
    // Kiểm tra xem trường đó có dữ liệu thực sự hay không (không null, không rỗng)
    const done = !!(value && String(value).trim() && value !== "null");
    
    if (done) filled++;

    // Chỉ render danh sách nếu element tồn tại
    if (list) {
      const li = document.createElement("li");
      li.className = `cc-item ${done ? "cc-item--done" : "cc-item--todo"}`;
      li.innerHTML = `
        <i class="ph-bold ${done ? "ph-check-circle" : "ph-circle"}"></i>
        <span>${escHtml(item.label)}</span>`;
      list.appendChild(li);
    }
  });

  // Tính toán phần trăm
  const pct = Math.round((filled / COMPLETION_ITEMS.length) * 100);

  // Cập nhật các chỉ số hiển thị (Sử dụng Optional Chaining ?. để tránh lỗi nếu thiếu Element)
  const elements = {
    pctText: document.getElementById("completionPct"),
    bar: document.getElementById("completionBar"),
    sidebarText: document.getElementById("sidebarCompletion"),
    sidebarBar: document.getElementById("sidebarCompletionBar")
  };

  if (elements.pctText) elements.pctText.textContent = `${pct}%`;
  if (elements.bar) elements.bar.style.width = `${pct}%`;
  
  // Các element ở sidebar thường có thể không tồn tại ở mọi trang, nên cần check kỹ
  if (elements.sidebarText) elements.sidebarText.textContent = `${pct}%`;
  if (elements.sidebarBar) elements.sidebarBar.style.width = `${pct}%`;

  console.log(`[Profile] Completion: ${pct}% (${filled}/${COMPLETION_ITEMS.length})`);
}

/* ════════════════════════════════════════════════════
   H. STATS LOADER — Lấy dữ liệu thực từ API
   ════════════════════════════════════════════════════ */
async function loadStats() {
  try {
    // 1. Gọi đồng thời API Boards và Tasks để lấy số liệu tổng quát
    const [resBoards, resTasks] = await Promise.all([
        fetch('/api/boards/'),
        fetch('/api/tasks/')
    ]);

    if (!resBoards.ok || !resTasks.ok) throw new Error("Lỗi tải stats");

    const boards = await resBoards.json();
    const tasks = await resTasks.json();

    // 2. Lọc dữ liệu (Bỏ qua các board đã lưu trữ - archived)
    const activeBoards = boards.filter(b => !b.is_archived);
    const doneTasks = tasks.filter(t => t.status === "done").length;

    // 3. Đổ dữ liệu vào giao diện
    document.getElementById("statBoards").textContent = activeBoards.length;
    document.getElementById("statTasks").textContent = tasks.length;
    document.getElementById("statDone").textContent = doneTasks;

    // Cập nhật Badge trên Sidebar nếu có
    const badgeAll = document.getElementById("badgeAll");
    if (badgeAll) badgeAll.textContent = activeBoards.length;

    // Tính ngày tham gia (Streak) - Có thể lấy từ profile.date_joined nếu Backend trả về
    // Tạm thời giữ logic tính từ LocalStorage nếu chưa có API
    const joined = localStorage.getItem(LS.JOINED);
    const daysUsed = joined
      ? Math.min(Math.floor((Date.now() - new Date(joined)) / 86400000) + 1, 99)
      : 1;
    document.getElementById("statStreak").textContent = daysUsed;

  } catch (err) {
    console.error("Không thể tải thống kê từ API:", err);
    // Nếu lỗi, hiện số 0 thay vì để trống
    document.getElementById("statBoards").textContent = "0";
    document.getElementById("statTasks").textContent = "0";
  }
}

/* ════════════════════════════════════════════════════
   I. EDIT MODE — open / close / populate
   ════════════════════════════════════════════════════ */
let _isEditing = false;
let _avatarPreview = ""; // temp avatar before save

function openEditMode() {
  if (_isEditing) return;
  _isEditing = true;

  // 1. Hàm hỗ trợ lấy text từ giao diện View Mode (bỏ qua placeholder)
  const getText = (id) => {
    const el = document.getElementById(id);
    if (!el) return "";
    const text = el.textContent.trim();
    return text !== "Chưa cập nhật" && text !== "—" ? text : "";
  };

  // 2. Điền dữ liệu vào form
  document.getElementById("fName").value = getText("infoName");
  document.getElementById("fEmail").value = getText("infoEmail");
  document.getElementById("fPhone").value = getText("infoPhone");
  document.getElementById("fAddress").value = getText("infoAddress");
  document.getElementById("fBio").value = getText("infoBio");

  // 3. Xử lý Ngày sinh: Từ "21/03/1995 (31 tuổi)" -> "1995-03-21"
  const birthText = getText("infoBirthDate");
  if (birthText) {
    const datePart = birthText.split(" ")[0]; // Lấy phần "21/03/1995"
    const parts = datePart.split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      document.getElementById("fBirthDate").value = `${y}-${m}-${d}`;
    } else {
      document.getElementById("fBirthDate").value = "";
    }
  } else {
    document.getElementById("fBirthDate").value = "";
  }

  // 4. Lấy avatar hiện tại làm preview (nếu có ảnh)
  const avatarImg = document.getElementById("avatarImg");
  if (avatarImg && avatarImg.style.display !== "none") {
    _avatarPreview = avatarImg.src;
  } else {
    _avatarPreview = "";
  }

  // Cập nhật bộ đếm chữ Bio và Xóa lỗi cũ
  updateBioCount();
  clearAllErrors();

  // 5. Hiển thị form, ẩn view
  document.getElementById("viewMode").style.display = "none";
  document.getElementById("editMode").style.display = "";

  const btnEditToggle = document.getElementById("btnEditToggle");
  if (btnEditToggle) {
    btnEditToggle.innerHTML = '<i class="ph-bold ph-x"></i> Đóng';
  }

  // Thêm class để hiện nút Camera đổi ảnh trên Avatar
  document.body.classList.add("edit-active");

  // Đồng bộ nút gạt giao diện Sáng/Tối trong form
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const fThemeDark = document.getElementById("fThemeDark");
  if (fThemeDark) fThemeDark.checked = isDark;
  updateToggleLabel(isDark ? "dark" : "light");

  // Tự động cuộn mượt mà xuống khu vực form
  document
    .getElementById("editMode")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditMode() {
  if (!_isEditing) return;
  _isEditing = false;
  _avatarPreview = "";

  // Ẩn form, hiện lại view
  document.getElementById("editMode").style.display = "none";
  document.getElementById("viewMode").style.display = "";

  const btnEditToggle = document.getElementById("btnEditToggle");
  if (btnEditToggle) {
    btnEditToggle.innerHTML =
      '<i class="ph-bold ph-pencil-simple"></i> Chỉnh sửa';
  }

  // Tắt chế độ edit trên thẻ body
  document.body.classList.remove("edit-active");

  // Xóa vòng sáng preview của ảnh (nếu có)
  const avatarRing = document.getElementById("avatarRing");
  if (avatarRing) avatarRing.classList.remove("preview-ready");
}

// ── ĐĂNG KÝ CÁC SỰ KIỆN CHO NÚT BẤM ──

// Expose globally (để HTML có thể gọi được bằng onclick="")
window.openEditMode = openEditMode;
window.closeEditMode = closeEditMode;

// Lắng nghe sự kiện cho nút "Hủy" (Dòng e.preventDefault() giúp không bị load lại trang)
const btnCancel = document.getElementById("btnCancelEdit");
if (btnCancel) {
  btnCancel.addEventListener("click", (e) => {
    e.preventDefault();
    closeEditMode();
  });
}

// Lắng nghe sự kiện cho nút "Chỉnh sửa / Đóng" ở góc trên cùng
const btnToggle = document.getElementById("btnEditToggle");
if (btnToggle) {
  btnToggle.addEventListener("click", () => {
    _isEditing ? closeEditMode() : openEditMode();
  });
}

/* ════════════════════════════════════════════════════
   J. FORM VALIDATION
   ════════════════════════════════════════════════════ */
function showFieldError(fieldId, errId, msg) {
  const input = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (!input || !err) return;
  input.classList.add("error");
  err.textContent = msg;
}
function clearFieldError(fieldId, errId) {
  const input = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (!input || !err) return;
  input.classList.remove("error");
  err.textContent = "";
}
function clearAllErrors() {
  [
    ["fName", "fNameErr"],
    ["fEmail", "fEmailErr"],
    ["fPhone", "fPhoneErr"],
  ].forEach(([f, e]) => clearFieldError(f, e));
}

/** Validate all fields; returns true if valid */
function validateForm(forceShow = true) {
  let valid = true;

  // Name
  const name = document.getElementById("fName").value.trim();
  if (!name) {
    if (forceShow)
      showFieldError("fName", "fNameErr", "Họ và tên không được để trống.");
    valid = false;
  } else if (name.length < 2) {
    if (forceShow)
      showFieldError("fName", "fNameErr", "Tên tối thiểu 2 ký tự.");
    valid = false;
  } else {
    clearFieldError("fName", "fNameErr");
  }

  // Email
  const email = document.getElementById("fEmail").value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    if (forceShow)
      showFieldError("fEmail", "fEmailErr", "Email không đúng định dạng.");
    valid = false;
  } else {
    clearFieldError("fEmail", "fEmailErr");
  }

  // Phone (Vietnamese format or empty)
  const phone = document.getElementById("fPhone").value.trim();
  if (phone && !/^(\+84|0)[0-9]{9,10}$/.test(phone.replace(/\s/g, ""))) {
    if (forceShow)
      showFieldError("fPhone", "fPhoneErr", "Số điện thoại không hợp lệ.");
    valid = false;
  } else {
    clearFieldError("fPhone", "fPhoneErr");
  }

  return valid;
}

// Real-time validation
let _nameTouched = false,
  _emailTouched = false,
  _phoneTouched = false;
document.getElementById("fName").addEventListener("blur", () => {
  _nameTouched = true;
  validateForm(true);
});
document.getElementById("fName").addEventListener("input", () => {
  if (_nameTouched) validateForm(false);
});
document.getElementById("fEmail").addEventListener("blur", () => {
  _emailTouched = true;
  validateForm(true);
});
document.getElementById("fEmail").addEventListener("input", () => {
  if (_emailTouched) validateForm(false);
});
document.getElementById("fPhone").addEventListener("blur", () => {
  _phoneTouched = true;
  validateForm(true);
});
document.getElementById("fPhone").addEventListener("input", () => {
  if (_phoneTouched) validateForm(false);
});

// Bio char counter
document.getElementById("fBio").addEventListener("input", updateBioCount);
function updateBioCount() {
  const len = document.getElementById("fBio").value.length;
  document.getElementById("fBioCount").textContent = `${len} / 300`;
}

/* ════════════════════════════════════════════════════
   K. AVATAR HANDLING
   ════════════════════════════════════════════════════ */

/** Preview an avatar (url or base64) without saving */
function previewAvatar(src) {
  if (!src) return;
  _avatarPreview = src;

  const avatarImg = document.getElementById("avatarImg");
  const avatarInitials = document.getElementById("avatarInitials");
  const avatarRing = document.getElementById("avatarRing");

  avatarImg.src = src;
  avatarImg.style.display = "block";
  avatarInitials.style.display = "none";
  avatarRing.classList.add("preview-ready");
}

// File upload → FileReader → base64 → preview
document.getElementById("avatarFileInput").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Vui lòng chọn file ảnh.", "error");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast("Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    previewAvatar(ev.target.result);
    showToast('Ảnh đã được tải lên. Nhấn "Lưu" để xác nhận.', "info");
  };
  reader.readAsDataURL(file);
});

/* ════════════════════════════════════════════════════
   M. SAVE HANDLER (PHIÊN BẢN DEBUG)
   ════════════════════════════════════════════════════ */
const btnSave = document.getElementById("btnSaveProfile");
if (btnSave) {
  btnSave.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("👉 1. Đã nhận sự kiện click nút Lưu!");
    saveProfile(false);
  });
}

async function saveProfile(silent = false) {
  console.log("👉 2. Bắt đầu chạy hàm saveProfile...");

  if (!validateForm(true)) {
    console.error(
      "❌ LỖI: Form chưa điền đúng định dạng (validateForm trả về false)",
    );
    return;
  }

  console.log("👉 3. Form hợp lệ! Đang gom dữ liệu...");
  const formData = new FormData();
  formData.append("full_name", document.getElementById("fName").value.trim());
  formData.append("email", document.getElementById("fEmail").value.trim());
  formData.append("phone", document.getElementById("fPhone").value.trim());
  formData.append("address", document.getElementById("fAddress").value.trim());
  formData.append("birth_date", document.getElementById("fBirthDate").value);
  formData.append("bio", document.getElementById("fBio").value.trim());

  const fileInput = document.getElementById("avatarFileInput");
  if (fileInput.files[0]) {
    formData.append("avatar", fileInput.files[0]);
    console.log("👉 Đã đính kèm ảnh avatar.");
  }

  try {
    console.log("👉 4. Đang gửi POST request lên server...");

    // DÙNG TRỰC TIẾP URL ĐỂ TRÁNH LỖI BIẾN KHÔNG TỒN TẠI
    const response = await fetch("/profile/api/update/", {
      method: "POST",
      headers: {
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: formData,
    });

    console.log("👉 5. Server đã trả lời! HTTP Status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("👉 6. Dữ liệu server trả về:", data);

      if (!silent) showToast("Đã lưu thành công! ✨", "success");

      renderProfile(data.profile);
      renderCompletion(data.profile);
      closeEditMode();
    } else {
      console.error(
        "❌ LỖI: Server từ chối lưu (Status:",
        response.status,
        ")",
      );
      showToast("Server báo lỗi. Nhấn F12 xem Console.", "error");
    }
  } catch (error) {
    console.error("❌ LỖI JAVASCRIPT:", error);
    showToast("Mất kết nối với server. Nhấn F12 xem Console.", "error");
  }
}

/* ════════════════════════════════════════════════════
   N. THEME TOGGLE (already wired in section D)
      — nothing extra needed here
   ════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════
   O. KEYBOARD SHORTCUTS
   ════════════════════════════════════════════════════ */
document.addEventListener("keydown", (e) => {
  // Esc → cancel edit
  if (e.key === "Escape" && _isEditing) {
    closeEditMode();
    return;
  }
  // Ctrl/Cmd + E → open edit
  if ((e.ctrlKey || e.metaKey) && e.key === "e") {
    e.preventDefault();
    if (!_isEditing) openEditMode();
    return;
  }
  // Ctrl/Cmd + S → save while editing
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && _isEditing) {
    e.preventDefault();
    saveProfile(false);
  }
  // Ctrl/Cmd + F → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    const inp = document.getElementById("searchInput");
    inp?.focus();
    inp?.select();
  }
});

/* ════════════════════════════════════════════════════
   P. INIT — Khởi tạo trang với dữ liệu từ Database
   ════════════════════════════════════════════════════ */

async function initProfilePage() {
  try {
    // 1. Gọi API để lấy dữ liệu Profile từ Django
    // (Bạn cần định nghĩa ProfileAPI.load() như mình hướng dẫn ở bước trước)
    const profileData = await ProfileAPI.load();

    // 2. Đổ dữ liệu vào các thẻ HTML để hiển thị (View Mode)
    renderProfile(profileData);

    // 3. Tính toán và hiển thị độ hoàn thiện hồ sơ
    renderCompletion(profileData);

    // 4. Tải các chỉ số thống kê (Boards, Tasks)
    loadStats();

    // 5. Hiện thông báo chào mừng nếu là lần đầu trong phiên làm việc
    if (!sessionStorage.getItem("taskly-profile-visited")) {
      sessionStorage.setItem("taskly-profile-visited", "1");
      const name = profileData.full_name || "bạn";
      setTimeout(() => showToast(`Xin chào, ${name}! 👋`, "info"), 600);
    }
  } catch (error) {
    console.error("Lỗi khởi tạo hồ sơ:", error);
    showToast("Không thể tải thông tin hồ sơ từ máy chủ.", "error");
  }
}

// GỌI HÀM KHỞI TẠO NGAY KHI TRANG LOAD
initProfilePage();
