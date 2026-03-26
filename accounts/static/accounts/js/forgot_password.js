/**
 * forgot_password.js — Taskly Forgot Password Page
 * ══════════════════════════════════════════════════════════
 * Sections:
 *  A. Config & mock data
 *  B. Theme
 *  C. Toast
 *  D. Validation helpers
 *  E. Real-time validation
 *  F. Submit handler
 *  G. Success state
 *  H. Utilities (mask email)
 *  I. Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & MOCK DATA
   ════════════════════════════════════════════════════ */
/** URL trang OTP trong Django */
const OTP_URL = "/accounts/verify-otp/";

/** Delay chuyển hướng (ms) */
const REDIRECT_DELAY = 3000;

/** Mock user registry — in production this would be a server lookup */
const MOCK_USERS = [
  { username: "admin", email: "admin@gmail.com" },
  { username: "user", email: "user@taskly.vn" },
  { username: "nguyen_van_a", email: "nva@taskly.vn" },
  { username: "demo", email: "demo@taskly.vn" },
];

/* ════════════════════════════════════════════════════
   B. THEME
   ════════════════════════════════════════════════════ */
const html = document.documentElement;

(function initTheme() {
  const saved = localStorage.getItem("taskly-theme");
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (sys ? "dark" : "light");
  html.setAttribute("data-theme", theme);
  syncIcons(theme);
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("taskly-theme", next);
  syncIcons(next);
});

function syncIcons(theme) {
  const s = document.getElementById("iconSun");
  const m = document.getElementById("iconMoon");
  if (s && m) {
    s.style.display = theme === "dark" ? "none" : "";
    m.style.display = theme === "dark" ? "" : "none";
  }
}

/* ════════════════════════════════════════════════════
   C. TOAST
   ════════════════════════════════════════════════════ */
let _toastTimer = null;
const toastEl = document.getElementById("toast");

function showToast(msg, type = "success") {
  clearTimeout(_toastTimer);
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toastEl.className = `toast toast--${type} show`;
  toastEl.querySelector(".toast__icon").textContent = icons[type] ?? "•";
  toastEl.querySelector(".toast__msg").textContent = msg;
  _toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4000);
}

/* ════════════════════════════════════════════════════
   D. VALIDATION HELPERS
   ════════════════════════════════════════════════════ */
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_USERNAME = 3;

/** Show field error */
function showFieldError(inputEl, errEl, msg) {
  inputEl.classList.add("error");
  inputEl.classList.remove("valid");
  errEl.innerHTML = `<i class="ph-bold ph-warning-circle"></i> ${msg}`;
  errEl.classList.add("show");
}

/** Clear field error */
function clearFieldError(inputEl, errEl) {
  inputEl.classList.remove("error");
  errEl.textContent = "";
  errEl.classList.remove("show");
}

/** Mark field as valid */
function markValid(inputEl, errEl) {
  clearFieldError(inputEl, errEl);
  inputEl.classList.add("valid");
}

/* ════════════════════════════════════════════════════
   E. REAL-TIME VALIDATION
   ════════════════════════════════════════════════════ */
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const usernameErr = document.getElementById("usernameErr");
const emailErr = document.getElementById("emailErr");
const btnSend = document.getElementById("btnSend");

let usernameTouched = false;
let emailTouched = false;

/* ── Validate username ── */
function validateUsername(force = true) {
  const val = usernameInput.value.trim();

  if (!val) {
    if (force)
      showFieldError(usernameInput, usernameErr, "Username is required.");
    else clearFieldError(usernameInput, usernameErr);
    return false;
  }
  if (val.length < MIN_USERNAME) {
    if (force)
      showFieldError(
        usernameInput,
        usernameErr,
        `Username must be at least ${MIN_USERNAME} characters.`,
      );
    return false;
  }

  markValid(usernameInput, usernameErr);
  return true;
}

/* ── Validate email ── */
function validateEmail(force = true) {
  const val = emailInput.value.trim();

  if (!val) {
    if (force) showFieldError(emailInput, emailErr, "Email is required.");
    else clearFieldError(emailInput, emailErr);
    return false;
  }
  if (!RE_EMAIL.test(val)) {
    if (force) showFieldError(emailInput, emailErr, "Invalid email address.");
    return false;
  }

  markValid(emailInput, emailErr);
  return true;
}

/* ── Sync submit button ── */
function syncBtn() {
  const uOk = usernameInput.value.trim().length >= MIN_USERNAME;
  const eOk = RE_EMAIL.test(emailInput.value.trim());
  btnSend.disabled = !(uOk && eOk);
}

/* ── Events ── */
usernameInput.addEventListener("input", () => {
  if (usernameTouched) validateUsername(true);
  syncBtn();
});
usernameInput.addEventListener("blur", () => {
  usernameTouched = true;
  validateUsername(true);
  syncBtn();
});

emailInput.addEventListener("input", () => {
  if (emailTouched) validateEmail(true);
  syncBtn();
});
emailInput.addEventListener("blur", () => {
  emailTouched = true;
  validateEmail(true);
  syncBtn();
});

/* Enter submits */
[usernameInput, emailInput].forEach((inp) => {
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !btnSend.disabled) handleSubmit();
  });
});

/* ════════════════════════════════════════════════════
   F. SUBMIT HANDLER
   ════════════════════════════════════════════════════ */
btnSend.addEventListener("click", handleSubmit);

async function handleSubmit() {
  usernameTouched = emailTouched = true;

  const uOk = validateUsername(true);
  const eOk = validateEmail(true);
  if (!uOk || !eOk) return;

  // Loading state
  btnSend.classList.add("loading");
  btnSend.disabled = true;

  // Lấy CSRF Token từ thẻ input ẩn (Django render)
  const csrftoken = document.querySelector("[name=csrfmiddlewaretoken]").value;

  // Chuẩn bị dữ liệu gửi đi (khớp với request.POST trong views.py)
  const formData = new FormData();
  formData.append("username", usernameInput.value.trim());
  formData.append("email", emailInput.value.trim());

  try {
    const response = await fetch("/accounts/forgot-password/", {
      // URL trong urls.py
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData,
    });

    // Django trả về redirect sau khi gửi mail thành công
    if (response.redirected) {
      handleSuccess(emailInput.value.trim());
    } else {
      // Nếu không redirect, nghĩa là có lỗi (User không tồn tại...)
      btnSend.classList.remove("loading");
      btnSend.disabled = false;
      showFieldError(usernameInput, usernameErr, "Thông tin không chính xác.");
      showToast("Không tìm thấy tài khoản khớp với thông tin trên.", "error");
    }
  } catch (error) {
    btnSend.classList.remove("loading");
    btnSend.disabled = false;
    showToast("Lỗi kết nối server!", "error");
  }
}

/* ════════════════════════════════════════════════════
   G. SUCCESS / FAILURE
   ════════════════════════════════════════════════════ */
function handleSuccess(email) {
  // Lưu vào localStorage để các trang sau có thể dùng (như mask email)
  localStorage.setItem("taskly-otp-email", email);

  showToast(`OTP đã được gửi đến email của bạn!`, "success");

  // Hiệu ứng icon thành công
  const formIcon = document.getElementById("formIcon");
  if (formIcon) {
    formIcon.style.background = "linear-gradient(135deg, #dcfce7, #d1fae5)";
    formIcon.style.color = "var(--green)";
    formIcon.innerHTML = '<i class="ph-bold ph-check-circle"></i>';
  }

  showSuccessState(email);
}

function handleFailure(username, email) {
  // Determine which field to highlight
  const userFound = MOCK_USERS.some(
    (u) => u.username.toLowerCase() === username,
  );

  if (!userFound) {
    showFieldError(usernameInput, usernameErr, "Username not found.");
    usernameInput.focus();
  } else {
    showFieldError(emailInput, emailErr, "Email does not match this account.");
    emailInput.focus();
  }

  showToast("Thông tin không hợp lệ. Vui lòng kiểm tra lại.", "error");
  btnSend.disabled = false;
}

/* ════════════════════════════════════════════════════
   SHOW SUCCESS STATE
   ════════════════════════════════════════════════════ */
function showSuccessState(email) {
  document.getElementById("formWrap").style.display = "none";
  const successState = document.getElementById("successState");
  successState.style.display = "";

  document.getElementById("successEmail").textContent = maskEmail(email);

  // Progress bar
  const bar = document.getElementById("successBar");
  setTimeout(() => {
    bar.style.transition = `width ${REDIRECT_DELAY}ms linear`;
    bar.style.width = "100%";
  }, 60);

  // Redirect
  setTimeout(() => {
    location.href = `${OTP_URL}?email=${encodeURIComponent(email)}`;
  }, REDIRECT_DELAY);
}

/* ════════════════════════════════════════════════════
   H. UTILITIES
   ════════════════════════════════════════════════════ */

/** Mask email: nguyen@gmail.com → ng***@gmail.com */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/* ════════════════════════════════════════════════════
   I. INIT
   ════════════════════════════════════════════════════ */
(function init() {
  // Auto-focus username
  setTimeout(() => usernameInput.focus(), 400);
})();
