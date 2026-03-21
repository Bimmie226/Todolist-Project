/**
 * register.js — Taskly Register Page
 * ─────────────────────────────────────────────────────
 * Features:
 *  1.  Dark / Light mode toggle  (localStorage)
 *  2.  Toggle show/hide for Password & Confirm Password
 *  3.  Real-time field validation (username, email, pw, confirm)
 *  4.  Password strength meter (4 levels)
 *  5.  Terms checkbox validation
 *  6.  Form submit: loading → validate → save to localStorage → redirect
 *  7.  Duplicate username / email check against stored users
 *  8.  Toast notification (success / error / info)
 *  9.  Shake animation on error
 */

/* ════════════════════════════════════════════════════
   1. DOM REFERENCES
   ════════════════════════════════════════════════════ */
const html = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

const registerForm = document.getElementById("registerForm");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const pwInput = document.getElementById("password");
const cfInput = document.getElementById("confirm");

const fieldUsername = document.getElementById("fieldUsername");
const fieldEmail = document.getElementById("fieldEmail");
const fieldPw = document.getElementById("fieldPassword");
const fieldCf = document.getElementById("fieldConfirm");

const usernameErr = document.getElementById("usernameErr");
const emailErr = document.getElementById("emailErr");
const pwErr = document.getElementById("pwErr");
const cfErr = document.getElementById("cfErr");
const termsErr = document.getElementById("termsErr");

const btnRegister = document.getElementById("btnRegister");
const eyeBtnPw = document.getElementById("eyeBtnPw");
const eyeBtnCf = document.getElementById("eyeBtnCf");
const termsCheckbox = document.getElementById("terms");
const toastEl = document.getElementById("toast");

// Strength meter
const strengthWrap = document.getElementById("strengthWrap");
const strengthLabel = document.getElementById("strengthLabel");

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
  void toastEl.offsetHeight; // force reflow
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3800);
}

window.showToast = showToast; // expose for inline onclick

/* ════════════════════════════════════════════════════
   4. TOGGLE SHOW / HIDE PASSWORD
   ════════════════════════════════════════════════════ */
function makeEyeToggle(btn, input, fieldEl) {
  btn.addEventListener("click", () => {
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    // The CSS uses .pw-visible on the button itself to swap icons
    btn.classList.toggle("pw-visible", !isVisible);
    btn.setAttribute("aria-label", isVisible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
  });
}

makeEyeToggle(eyeBtnPw, pwInput, fieldPw);
makeEyeToggle(eyeBtnCf, cfInput, fieldCf);

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

/** @returns {Array} array of stored users from localStorage */
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("taskly-users") || "[]");
  } catch {
    return [];
  }
}

/* ════════════════════════════════════════════════════
   6. INDIVIDUAL FIELD VALIDATORS
   ════════════════════════════════════════════════════ */

function validateUsername(showEmpty = false) {
  const val = usernameInput.value.trim();
  if (!val) {
    if (showEmpty)
      setError(fieldUsername, usernameErr, "Vui lòng nhập tên đăng nhập.");
    else clearState(fieldUsername, usernameErr);
    return false;
  }
  if (val.length < 3) {
    setError(fieldUsername, usernameErr, "Tối thiểu 3 ký tự.");
    return false;
  }
  if (val.length > 20) {
    setError(fieldUsername, usernameErr, "Tối đa 20 ký tự.");
    return false;
  }
  if (/\s/.test(val)) {
    setError(fieldUsername, usernameErr, "Không được chứa khoảng trắng.");
    return false;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(val)) {
    setError(fieldUsername, usernameErr, "Chỉ dùng chữ, số và dấu gạch dưới.");
    return false;
  }
  // Duplicate check
  const taken = getUsers().some(
    (u) => u.username.toLowerCase() === val.toLowerCase(),
  );
  if (taken) {
    setError(fieldUsername, usernameErr, "Tên đăng nhập đã được sử dụng.");
    return false;
  }
  setSuccess(fieldUsername, usernameErr);
  return true;
}

function validateEmail(showEmpty = false) {
  const val = emailInput.value.trim();
  if (!val) {
    if (showEmpty) setError(fieldEmail, emailErr, "Vui lòng nhập email.");
    else clearState(fieldEmail, emailErr);
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
    setError(fieldEmail, emailErr, "Email không đúng định dạng.");
    return false;
  }
  // Duplicate check
  const taken = getUsers().some(
    (u) => u.email.toLowerCase() === val.toLowerCase(),
  );
  if (taken) {
    setError(fieldEmail, emailErr, "Email này đã được đăng ký.");
    return false;
  }
  setSuccess(fieldEmail, emailErr);
  return true;
}

function validatePassword(showEmpty = false) {
  const val = pwInput.value;
  if (!val) {
    if (showEmpty) setError(fieldPw, pwErr, "Vui lòng nhập mật khẩu.");
    else clearState(fieldPw, pwErr);
    strengthWrap.classList.remove("visible");
    return false;
  }
  if (val.length < 6) {
    setError(fieldPw, pwErr, "Mật khẩu tối thiểu 6 ký tự.");
    return false;
  }
  setSuccess(fieldPw, pwErr);
  return true;
}

function validateConfirm(showEmpty = false) {
  const val = cfInput.value;
  if (!val) {
    if (showEmpty) setError(fieldCf, cfErr, "Vui lòng xác nhận mật khẩu.");
    else clearState(fieldCf, cfErr);
    return false;
  }
  if (val !== pwInput.value) {
    setError(fieldCf, cfErr, "Mật khẩu xác nhận không khớp.");
    return false;
  }
  setSuccess(fieldCf, cfErr);
  return true;
}

function validateTerms() {
  if (!termsCheckbox.checked) {
    termsErr.textContent = "Bạn phải đồng ý với điều khoản để tiếp tục.";
    termsErr.classList.add("show");
    return false;
  }
  termsErr.textContent = "";
  termsErr.classList.remove("show");
  return true;
}

/* ════════════════════════════════════════════════════
   7. PASSWORD STRENGTH METER
   Scoring:
     +1  length ≥ 6
     +1  length ≥ 10
     +1  contains number
     +1  contains symbol
   Levels: 1=Yếu  2=Trung bình  3=Khá  4=Mạnh
   ════════════════════════════════════════════════════ */
const STRENGTH_LABELS = ["", "Yếu", "Trung bình", "Khá mạnh", "Mạnh"];

function calcStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.max(1, score); // always at least 1 when non-empty
}

function updateStrength(pw) {
  if (!pw) {
    strengthWrap.classList.remove("visible");
    strengthWrap.removeAttribute("data-level");
    return;
  }
  const level = calcStrength(pw);
  strengthWrap.setAttribute("data-level", level);
  strengthLabel.textContent = STRENGTH_LABELS[level];
  strengthWrap.classList.add("visible");
}

/* ════════════════════════════════════════════════════
   8. REAL-TIME VALIDATION BINDINGS
   ════════════════════════════════════════════════════ */
let utTouched = false,
  emTouched = false,
  pwTouched = false,
  cfTouched = false;

// Username
usernameInput.addEventListener("blur", () => {
  utTouched = true;
  validateUsername(true);
});
usernameInput.addEventListener("input", () => {
  if (utTouched) validateUsername(false);
});
usernameInput.addEventListener("focus", () =>
  fieldUsername.classList.add("active"),
);
usernameInput.addEventListener("blur", () =>
  fieldUsername.classList.remove("active"),
);

// Email
emailInput.addEventListener("blur", () => {
  emTouched = true;
  validateEmail(true);
});
emailInput.addEventListener("input", () => {
  if (emTouched) validateEmail(false);
});
emailInput.addEventListener("focus", () => fieldEmail.classList.add("active"));
emailInput.addEventListener("blur", () =>
  fieldEmail.classList.remove("active"),
);

// Password + strength
pwInput.addEventListener("blur", () => {
  pwTouched = true;
  validatePassword(true);
});
pwInput.addEventListener("input", () => {
  updateStrength(pwInput.value);
  if (pwTouched) validatePassword(false);
  if (cfTouched) validateConfirm(false); // re-check confirm when pw changes
});
pwInput.addEventListener("focus", () => fieldPw.classList.add("active"));
pwInput.addEventListener("blur", () => fieldPw.classList.remove("active"));

// Confirm
cfInput.addEventListener("blur", () => {
  cfTouched = true;
  validateConfirm(true);
});
cfInput.addEventListener("input", () => {
  if (cfTouched) validateConfirm(false);
});
cfInput.addEventListener("focus", () => fieldCf.classList.add("active"));
cfInput.addEventListener("blur", () => fieldCf.classList.remove("active"));

// Terms — clear error on change
termsCheckbox.addEventListener("change", validateTerms);

/* ════════════════════════════════════════════════════
   9. FORM SUBMIT
   ════════════════════════════════════════════════════ */
registerForm.addEventListener("submit", async (e) => {
  // e.preventDefault();

  // Force-touch all fields
  utTouched = emTouched = pwTouched = cfTouched = true;

  const ok = [
    validateUsername(true),
    validateEmail(true),
    validatePassword(true),
    validateConfirm(true),
    validateTerms(),
  ].every(Boolean);

  if (!ok) {
    showToast("Vui lòng kiểm tra lại thông tin bên dưới.", "error");
    shakeForm();
    return;
  }

  // ── Loading state ──
  btnRegister.disabled = true;
  btnRegister.classList.add("loading");

  await delay(1600); // simulate API call

  // ── Save user to localStorage (mock DB) ──
  const newUser = {
    id: Date.now(),
    username: usernameInput.value.trim(),
    email: emailInput.value.trim().toLowerCase(),
    password: pwInput.value, // ⚠️ demo only — never store plaintext in prod
    createdAt: new Date().toISOString(),
  };

  const users = getUsers();
  users.push(newUser);
  // localStorage.setItem("taskly-users", JSON.stringify(users));

  // ── Success feedback ──
  showToast(
    `Chào mừng ${newUser.username}! Tài khoản đã được tạo thành công 🎉`,
    "success",
  );

  await delay(1200);
  // window.location.href = "/boards/";
});

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ════════════════════════════════════════════════════
   10. SHAKE ANIMATION
   ════════════════════════════════════════════════════ */
function shakeForm() {
  registerForm.style.animation = "none";
  void registerForm.offsetHeight;
  registerForm.style.animation = "shake .4s var(--ease)";
}

const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{ transform:translateX(0); }
    20%    { transform:translateX(-7px); }
    40%    { transform:translateX(7px); }
    60%    { transform:translateX(-4px); }
    80%    { transform:translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);
