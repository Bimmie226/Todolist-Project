/**
 * login.js — Taskly Login Page
 * ─────────────────────────────────────────────────────
 * Features:
 *  1. Dark / Light mode toggle  (localStorage)
 *  2. Toggle show / hide password
 *  3. Real-time field validation (username + password)
 *  4. Form submit: loading state → validate → redirect / error
 *  5. "Remember me" → persist username in localStorage
 *  6. Toast notification (success / error / info)
 *  7. Auto-fill remembered username on page load
 *  8. Input focus → active icon colour
 */

/* ════════════════════════════════════════════════════
   0. DEMO CREDENTIALS  (replace with real API later)
   ════════════════════════════════════════════════════ */
const DEMO_USERS = [
  { username: "demo", password: "demo123" },
  { username: "admin", password: "admin123" },
];

/* ════════════════════════════════════════════════════
   1. DOM REFERENCES
   ════════════════════════════════════════════════════ */
const html = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const pwInput = document.getElementById("password");
const fieldUsername = document.getElementById("fieldUsername");
const fieldPw = document.getElementById("fieldPassword");
const usernameErr = document.getElementById("usernameErr");
const pwErr = document.getElementById("pwErr");
const btnLogin = document.getElementById("btnLogin");

const eyeBtn = document.getElementById("eyeBtn");
const rememberMe = document.getElementById("rememberMe");
const toastEl = document.getElementById("toast");

/* ════════════════════════════════════════════════════
   2. DARK MODE
   ════════════════════════════════════════════════════ */
(function initTheme() {
  const saved = localStorage.getItem("taskly-theme");
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  html.setAttribute("data-theme", saved ?? (sysDark ? "dark" : "light"));
})();

themeToggle.addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("taskly-theme", next);
});

/* ════════════════════════════════════════════════════
   3. TOAST SYSTEM
   ════════════════════════════════════════════════════ */
let toastTimer = null;

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toastEl.className = `toast toast--${type}`;
  toastEl.querySelector(".toast__icon").textContent = icons[type] ?? "•";
  toastEl.querySelector(".toast__msg").textContent = message;
  void toastEl.offsetHeight;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3600);
}
window.showToast = showToast;

/* ════════════════════════════════════════════════════
   4. TOGGLE SHOW / HIDE PASSWORD
   ════════════════════════════════════════════════════ */
eyeBtn.addEventListener("click", () => {
  const isVisible = pwInput.type === "text";
  pwInput.type = isVisible ? "password" : "text";
  fieldPw.classList.toggle("pw-visible", !isVisible);
  eyeBtn.setAttribute(
    "aria-label",
    isVisible ? "Hiện mật khẩu" : "Ẩn mật khẩu",
  );
});

/* ════════════════════════════════════════════════════
   5. VALIDATION HELPERS
   ════════════════════════════════════════════════════ */
function setError(fieldEl, errEl, message) {
  fieldEl.classList.remove("success");
  fieldEl.classList.add("error");
  const status = fieldEl.querySelector(".field__status");
  if (status) status.textContent = "✕";
  errEl.textContent = message;
  errEl.classList.add("show");
}

function setSuccess(fieldEl, errEl) {
  fieldEl.classList.remove("error");
  fieldEl.classList.add("success");
  const status = fieldEl.querySelector(".field__status");
  if (status) status.textContent = "✓";
  errEl.textContent = "";
  errEl.classList.remove("show");
}

function clearState(fieldEl, errEl) {
  fieldEl.classList.remove("error", "success");
  const status = fieldEl.querySelector(".field__status");
  if (status) status.textContent = "";
  errEl.textContent = "";
  errEl.classList.remove("show");
}

/* ════════════════════════════════════════════════════
   6. REAL-TIME VALIDATION
   ════════════════════════════════════════════════════ */

/** Validate username: không để trống, tối thiểu 3 ký tự, không chứa khoảng trắng */
function validateUsername(showEmpty = false) {
  const val = usernameInput.value.trim();
  if (!val) {
    if (showEmpty)
      setError(fieldUsername, usernameErr, "Vui lòng nhập tên đăng nhập.");
    else clearState(fieldUsername, usernameErr);
    return false;
  }
  if (val.length < 3) {
    setError(fieldUsername, usernameErr, "Tên đăng nhập tối thiểu 3 ký tự.");
    return false;
  }
  if (/\s/.test(val)) {
    setError(
      fieldUsername,
      usernameErr,
      "Tên đăng nhập không được chứa khoảng trắng.",
    );
    return false;
  }
  setSuccess(fieldUsername, usernameErr);
  return true;
}

/** Validate password: không để trống, tối thiểu 6 ký tự */
function validatePassword(showEmpty = false) {
  const val = pwInput.value;
  if (!val) {
    if (showEmpty) setError(fieldPw, pwErr, "Vui lòng nhập mật khẩu.");
    else clearState(fieldPw, pwErr);
    return false;
  }
  if (val.length < 6) {
    setError(fieldPw, pwErr, "Mật khẩu tối thiểu 6 ký tự.");
    return false;
  }
  setSuccess(fieldPw, pwErr);
  return true;
}

// Track first-touch
let usernameTouched = false;
let pwTouched = false;

usernameInput.addEventListener("blur", () => {
  usernameTouched = true;
  validateUsername(true);
});
usernameInput.addEventListener("input", () => {
  if (usernameTouched) validateUsername(false);
});

pwInput.addEventListener("blur", () => {
  pwTouched = true;
  validatePassword(true);
});
pwInput.addEventListener("input", () => {
  if (pwTouched) validatePassword(false);
});

// Active icon tint on focus
usernameInput.addEventListener("focus", () =>
  fieldUsername.classList.add("active"),
);
usernameInput.addEventListener("blur", () =>
  fieldUsername.classList.remove("active"),
);
pwInput.addEventListener("focus", () => fieldPw.classList.add("active"));
pwInput.addEventListener("blur", () => fieldPw.classList.remove("active"));

/* ════════════════════════════════════════════════════
   7. AUTO-FILL REMEMBERED USERNAME
   ════════════════════════════════════════════════════ */
(function restoreRemembered() {
  const saved = localStorage.getItem("taskly-remembered-username");
  if (saved) {
    usernameInput.value = saved;
    rememberMe.checked = true;
    usernameTouched = true;
    validateUsername(false);
  }
})();

/* ════════════════════════════════════════════════════
   8. FORM SUBMIT
   ════════════════════════════════════════════════════ */
loginForm.addEventListener("submit", async (e) => {
  // e.preventDefault();

  usernameTouched = true;
  pwTouched = true;
  const unOk = validateUsername(true);
  const pwOk = validatePassword(true);

  if (!unOk || !pwOk) {
    showToast("Vui lòng kiểm tra lại thông tin.", "error");
    return;
  }

  // Loading state
  btnLogin.disabled = true;
  btnLogin.classList.add("loading");

  await delay(1500);

  const username = usernameInput.value.trim().toLowerCase();
  // const password = pwInput.value;

  // const match = DEMO_USERS.find(
  //   (u) => u.username === username && u.password === password,
  // );

  // if (!match) {
  //   btnLogin.disabled = false;
  //   btnLogin.classList.remove("loading");
  //   setError(fieldUsername, usernameErr, " ");
  //   setError(fieldPw, pwErr, "Tên đăng nhập hoặc mật khẩu không chính xác.");
  //   showToast("Thông tin đăng nhập không đúng. Vui lòng thử lại.", "error");
  //   loginForm.style.animation = "none";
  //   void loginForm.offsetHeight;
  //   loginForm.style.animation = "shake .4s var(--ease)";
  //   return;
  // }

  // Success
  if (rememberMe.checked) {
    localStorage.setItem("taskly-remembered-username", username);
  } else {
    localStorage.removeItem("taskly-remembered-username");
  }
  // localStorage.setItem("taskly-logged-in", "true");
  // localStorage.setItem("taskly-username", username);

  // showToast("Đăng nhập thành công! Đang chuyển hướng…", "success");
  // await delay(900);
  // window.location.href = "/boards/";
});

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ════════════════════════════════════════════════════
   9. SHAKE ANIMATION
   ════════════════════════════════════════════════════ */
const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{ transform: translateX(0); }
    20%    { transform: translateX(-6px); }
    40%    { transform: translateX(6px); }
    60%    { transform: translateX(-4px); }
    80%    { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);
