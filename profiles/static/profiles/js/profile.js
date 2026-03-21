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
  { key: "name", label: "Họ và tên" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Số điện thoại" },
  { key: "birthDate", label: "Ngày sinh" },
  { key: "address", label: "Địa chỉ" },
  { key: "bio", label: "Giới thiệu bản thân" },
  { key: "avatar", label: "Ảnh đại diện" },
];

/* ════════════════════════════════════════════════════
   B. PROFILE DB — localStorage helper
   ════════════════════════════════════════════════════ */
const ProfileDB = {
  load() {
    try {
      const raw = localStorage.getItem(LS.PROFILE);
      return raw
        ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
        : { ...DEFAULT_PROFILE };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  },

  save(profile) {
    try {
      localStorage.setItem(LS.PROFILE, JSON.stringify(profile));
      return true;
    } catch {
      showToast("Không thể lưu dữ liệu.", "error");
      return false;
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

// Logout
document.getElementById("btnLogout").addEventListener("click", () => {
  localStorage.removeItem("taskly-access-token");
  showToast("Đã đăng xuất.", "info");
  setTimeout(() => {
    location.href = "login.html";
  }, 1000);
});

/* ════════════════════════════════════════════════════
   F. PROFILE DATA LOADER — render VIEW mode
   ════════════════════════════════════════════════════ */
function renderProfile() {
  const profile = ProfileDB.load();
  const username = localStorage.getItem(LS.USERNAME) || "user";

  // Use saved name or fallback to username
  const displayName = profile.name || username;
  const displayEmail = profile.email || `${username}@taskly.vn`;

  // ── Header avatar ──
  renderAvatar(profile.avatar, displayName);

  // ── Header user menu ──
  document.getElementById("userInitials").textContent = displayName
    .substring(0, 2)
    .toUpperCase();
  document.getElementById("udName").textContent = displayName;
  document.getElementById("udEmail").textContent = displayEmail;

  // ── Avatar card ──
  document.getElementById("displayName").textContent = displayName;
  document.getElementById("displayEmail").textContent = displayEmail;

  // Joined date
  let joined = localStorage.getItem(LS.JOINED);
  if (!joined) {
    joined = new Date().toISOString().split("T")[0];
    localStorage.setItem(LS.JOINED, joined);
  }
  document.getElementById("displayJoined").textContent =
    `Tham gia ${fmtDate(joined)}`;

  // ── Info grid ──
  setInfoValue("infoName", profile.name);
  setInfoValue("infoEmail", profile.email);
  setInfoValue("infoPhone", profile.phone);
  setInfoValue("infoAddress", profile.address);
  setInfoValue("infoBio", profile.bio);

  // Birth date with age
  if (profile.birthDate) {
    const age = calcAge(profile.birthDate);
    document.getElementById("infoBirthDate").textContent =
      fmtDate(profile.birthDate) + (age !== null ? ` (${age} tuổi)` : "");
    document.getElementById("infoBirthDate").classList.remove("empty");
  } else {
    document.getElementById("infoBirthDate").textContent = "Chưa cập nhật";
    document.getElementById("infoBirthDate").classList.add("empty");
  }

  // ── Completion ──
  renderCompletion(profile);
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
function renderAvatar(avatar, name) {
  const avatarImg = document.getElementById("avatarImg");
  const avatarInitials = document.getElementById("avatarInitials");
  const headerImg = document.getElementById("headerAvatarImg");
  const headerInitials = document.getElementById("userInitials");

  if (avatar) {
    // Show image
    avatarImg.src = avatar;
    avatarImg.style.display = "block";
    avatarInitials.style.display = "none";

    // Header avatar image
    headerImg.src = avatar;
    headerImg.style.display = "block";
    headerInitials.style.display = "none";
  } else {
    // Show initials
    const initials = name ? name.substring(0, 2).toUpperCase() : "TN";
    avatarImg.style.display = "none";
    avatarInitials.style.display = "grid";
    avatarInitials.textContent = initials;

    headerImg.style.display = "none";
    headerInitials.style.display = "";
    headerInitials.textContent = initials;
  }
}

/* ════════════════════════════════════════════════════
   G. PROFILE COMPLETION CALCULATOR
   ════════════════════════════════════════════════════ */
function renderCompletion(profile) {
  let filled = 0;
  const list = document.getElementById("completionChecklist");
  list.innerHTML = "";

  COMPLETION_ITEMS.forEach((item) => {
    const done = !!(profile[item.key] && String(profile[item.key]).trim());
    if (done) filled++;
    const li = document.createElement("li");
    li.className = `cc-item ${done ? "cc-item--done" : "cc-item--todo"}`;
    li.innerHTML = `
      <i class="ph-bold ${done ? "ph-check-circle" : "ph-circle"}"></i>
      <span>${escHtml(item.label)}</span>`;
    list.appendChild(li);
  });

  const pct = Math.round((filled / COMPLETION_ITEMS.length) * 100);

  // Update all completion indicators
  document.getElementById("completionPct").textContent = `${pct}%`;
  document.getElementById("completionBar").style.width = `${pct}%`;
  document.getElementById("sidebarCompletion").textContent = `${pct}%`;
  document.getElementById("sidebarCompletionBar").style.width = `${pct}%`;
}

/* ════════════════════════════════════════════════════
   H. STATS LOADER
   ════════════════════════════════════════════════════ */
function loadStats() {
  try {
    const boards = JSON.parse(localStorage.getItem(LS.BOARDS) || "[]");
    const activeBoards = boards.filter((b) => !b.is_archived);

    let totalTasks = 0,
      doneTasks = 0;
    activeBoards.forEach((board) => {
      const key = `taskly-tasks-${board.id}`;
      const tasks = JSON.parse(localStorage.getItem(key) || "[]");
      totalTasks += tasks.length;
      doneTasks += tasks.filter((t) => t.status === "done").length;
    });

    document.getElementById("statBoards").textContent = activeBoards.length;
    document.getElementById("statTasks").textContent = totalTasks;
    document.getElementById("statDone").textContent = doneTasks;

    // Sidebar badge
    document.getElementById("badgeAll").textContent = activeBoards.length;

    // Streak (simple: number of days since joined, capped at 7 for demo)
    const joined = localStorage.getItem(LS.JOINED);
    const daysUsed = joined
      ? Math.min(Math.floor((Date.now() - new Date(joined)) / 86400000) + 1, 99)
      : 1;
    document.getElementById("statStreak").textContent = daysUsed;
  } catch {
    // Fail silently — stats are non-critical
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

  const profile = ProfileDB.load();
  _avatarPreview = profile.avatar || "";

  // Populate form
  document.getElementById("fAvatarUrl").value =
    profile.avatar && !profile.avatar.startsWith("data:") ? profile.avatar : "";
  document.getElementById("fName").value = profile.name || "";
  document.getElementById("fEmail").value = profile.email || "";
  document.getElementById("fPhone").value = profile.phone || "";
  document.getElementById("fBirthDate").value = profile.birthDate || "";
  document.getElementById("fAddress").value = profile.address || "";
  document.getElementById("fBio").value = profile.bio || "";
  updateBioCount();

  // Clear errors
  clearAllErrors();

  // Toggle views with animation
  document.getElementById("viewMode").style.display = "none";
  document.getElementById("editMode").style.display = "";
  document.getElementById("btnEditToggle").innerHTML =
    '<i class="ph-bold ph-x"></i> Đóng';

  // Add body class for avatar overlay
  document.body.classList.add("edit-active");

  // Set theme toggle
  const isDark = html.getAttribute("data-theme") === "dark";
  document.getElementById("fThemeDark").checked = isDark;
  updateToggleLabel(isDark ? "dark" : "light");

  // Scroll to form
  document
    .getElementById("editMode")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditMode() {
  if (!_isEditing) return;
  _isEditing = false;
  _avatarPreview = "";

  document.getElementById("editMode").style.display = "none";
  document.getElementById("viewMode").style.display = "";
  document.getElementById("btnEditToggle").innerHTML =
    '<i class="ph-bold ph-pencil-simple"></i> Chỉnh sửa';

  document.body.classList.remove("edit-active");

  // Remove preview ring
  document.getElementById("avatarRing").classList.remove("preview-ready");
}

// Expose globally (called from HTML onclick)
window.openEditMode = openEditMode;
window.closeEditMode = closeEditMode;

document
  .getElementById("btnCancelEdit")
  .addEventListener("click", closeEditMode);
document.getElementById("btnEditToggle").addEventListener("click", () => {
  _isEditing ? closeEditMode() : openEditMode();
});

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

// Avatar URL live preview
document.getElementById("fAvatarUrl").addEventListener("input", (e) => {
  const url = e.target.value.trim();
  if (url) previewAvatar(url);
});

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
    document.getElementById("fAvatarUrl").value = ""; // clear URL field
    showToast('Ảnh đã được tải lên. Nhấn "Lưu" để xác nhận.', "info");
  };
  reader.readAsDataURL(file);
});

/* ════════════════════════════════════════════════════
   L. AUTO-SAVE
   ════════════════════════════════════════════════════ */
let _autoSaveTimer = null;

function triggerAutoSave() {
  const checked = document.getElementById("autoSaveCheck").checked;
  if (!checked) return;

  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    if (_isEditing && validateForm(false)) {
      saveProfile(true); // silent = true
    }
  }, 2500);
}

// Attach auto-save to all form inputs
[
  "fName",
  "fEmail",
  "fPhone",
  "fAddress",
  "fBirthDate",
  "fBio",
  "fAvatarUrl",
].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", triggerAutoSave);
});

/* ════════════════════════════════════════════════════
   M. SAVE HANDLER
   ════════════════════════════════════════════════════ */
document
  .getElementById("btnSaveProfile")
  .addEventListener("click", () => saveProfile(false));

/**
 * Save profile to localStorage.
 * @param {boolean} silent — if true, skip success toast (auto-save mode)
 */
function saveProfile(silent = false) {
  _nameTouched = _emailTouched = _phoneTouched = true;
  if (!validateForm(true)) {
    showToast("Vui lòng kiểm tra lại thông tin.", "error");
    document.getElementById("fName").focus();
    return;
  }

  const profile = {
    name: document.getElementById("fName").value.trim(),
    email: document.getElementById("fEmail").value.trim(),
    phone: document.getElementById("fPhone").value.trim(),
    address: document.getElementById("fAddress").value.trim(),
    birthDate: document.getElementById("fBirthDate").value,
    bio: document.getElementById("fBio").value.trim(),
    avatar: _avatarPreview || ProfileDB.load().avatar || "",
  };

  // Update username key as well (for other pages)
  if (profile.name)
    localStorage.setItem(LS.USERNAME, profile.name.split(" ")[0]);

  if (ProfileDB.save(profile)) {
    if (!silent) {
      showToast("Hồ sơ đã được lưu thành công! ✨", "success");
      closeEditMode();
    } else {
      showToast("Tự động lưu…", "info");
    }
    renderProfile(); // Re-render view with new data
    loadStats();
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
   P. INIT
   ════════════════════════════════════════════════════ */

// Set joined date if first visit
if (!localStorage.getItem(LS.JOINED)) {
  localStorage.setItem(LS.JOINED, new Date().toISOString().split("T")[0]);
}

// Seed default profile from username if blank
(function seedDefaultProfile() {
  const profile = ProfileDB.load();
  const username = localStorage.getItem(LS.USERNAME) || "";
  if (!profile.name && username) {
    profile.name = username;
    ProfileDB.save(profile);
  }
  if (!profile.email && username) {
    profile.email = `${username}@taskly.vn`;
    ProfileDB.save(profile);
  }
})();

// Initial render
renderProfile();
loadStats();

// Welcome toast
if (!sessionStorage.getItem("taskly-profile-visited")) {
  sessionStorage.setItem("taskly-profile-visited", "1");
  const name =
    ProfileDB.load().name || localStorage.getItem(LS.USERNAME) || "bạn";
  setTimeout(
    () =>
      showToast(`Xin chào, ${name}! Hãy hoàn thiện hồ sơ của bạn. 👤`, "info"),
    600,
  );
}
