/**
 * reset_password.js — Taskly Reset Password Page
 * ══════════════════════════════════════════════════════════
 * Sections:
 *  A. Config & constants
 *  B. Theme
 *  C. Toast
 *  D. Password strength calculator
 *  E. Requirements checklist
 *  F. Real-time validation
 *  G. Eye (show/hide password) toggles
 *  H. Submit handler
 *  I. Success state
 *  J. Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & CONSTANTS
   ════════════════════════════════════════════════════ */
const REDIRECT_URL = "/accounts/login/";

const REDIRECT_DELAY = 3000;
const MIN_LEN = 6; // Nên để 8 cho bảo mật nhưng để 6 cho trùng với html

/** Mask email: nguyen@gmail.com → ng***@gmail.com */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

// CHÈN VÀO ĐÂY: Lấy email trực tiếp từ thuộc tính data- của HTML
const emailElement = document.getElementById("maskedEmail");
const EMAIL_PARAM = emailElement
  ? emailElement.getAttribute("data-full-email")
  : "user@gmail.com";

/** Sau khi thành công, chuyển về trang Login của Django */

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
   D. PASSWORD STRENGTH CALCULATOR
   ════════════════════════════════════════════════════
   Returns { score: 0-4, label, colorClass }
   Score:
     0 = empty
     1 = weak    (< 6 chars)
     2 = weak    (6+ chars only)
     3 = medium  (6+ with upper OR digit OR special)
     4 = strong  (6+ with upper AND digit AND special)
   ════════════════════════════════════════════════════ */
function calcStrength(pwd) {
  if (!pwd) return { score: 0, label: "—", colorClass: "" };

  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const isLong = pwd.length >= MIN_LEN;

  let score = 0;
  if (isLong) score++;
  if (hasUpper) score++;
  if (hasDigit) score++;
  if (hasSpecial) score++;

  if (score <= 1) return { score, label: "Weak", colorClass: "weak" };
  if (score === 2) return { score, label: "Medium", colorClass: "medium" };
  if (score === 3) return { score, label: "Strong", colorClass: "strong" };
  return { score, label: "Very Strong", colorClass: "strong" };
}

/* ════════════════════════════════════════════════════
   E. REQUIREMENTS CHECKLIST
   ════════════════════════════════════════════════════ */
const REQS = [
  {
    id: "reqLen",
    test: (pwd) => pwd.length >= MIN_LEN,
    icon: "ph-check-circle",
  },
  { id: "reqUpper", test: (pwd) => /[A-Z]/.test(pwd), icon: "ph-check-circle" },
  { id: "reqNum", test: (pwd) => /[0-9]/.test(pwd), icon: "ph-check-circle" },
  {
    id: "reqSpecial",
    test: (pwd) => /[^A-Za-z0-9]/.test(pwd),
    icon: "ph-check-circle",
  },
];

function updateReqList(pwd) {
  REQS.forEach((req) => {
    const li = document.getElementById(req.id);
    if (!li) return;

    const icon = li.querySelector(".req-icon");
    const met = req.test(pwd);

    // 1. Thêm/Xóa class 'done' cho thẻ <li>
    if (met) {
      li.classList.add("done");
    } else {
      li.classList.remove("done");
    }

    // 2. Cập nhật Icon (ph-check-circle là có tick, ph-circle là rỗng)
    if (icon) {
      icon.className = met
        ? "ph-bold ph-check-circle req-icon"
        : "ph-bold ph-circle req-icon";
    }
  });
}

/* Update strength bar + label */
function updateStrengthBar(pwd) {
  const segs = [0, 1, 2, 3].map((i) => document.getElementById(`seg${i}`));
  const labelEl = document.getElementById("strengthLabel");
  const { score, label, colorClass } = calcStrength(pwd);

  segs.forEach((seg, i) => {
    seg.className = "strength-seg";
    if (i < score) seg.classList.add(colorClass);
  });

  labelEl.textContent = label;
  labelEl.style.color =
    colorClass === "weak"
      ? "var(--red)"
      : colorClass === "medium"
        ? "var(--amber)"
        : colorClass === "strong"
          ? "var(--green)"
          : "var(--text-light)";

  // Sync panel dots
  const dots = document.querySelectorAll(".str-dot");
  dots.forEach((d) => (d.className = "str-dot"));
  if (score >= 1) dots[0].classList.add(`active-${colorClass}`);
  if (score >= 2) dots[1].classList.add(`active-${colorClass}`);
  if (score >= 3) dots[2].classList.add(`active-${colorClass}`);
  if (score >= 4) dots[3].classList.add(`active-${colorClass}`);

  // Sync lock icon color
  const lvCore = document.getElementById("lvCore");
  if (lvCore) {
    lvCore.style.background =
      score === 0
        ? "linear-gradient(135deg,var(--accent),#a78bfa)"
        : colorClass === "weak"
          ? "linear-gradient(135deg,var(--red),#fb923c)"
          : colorClass === "medium"
            ? "linear-gradient(135deg,var(--amber),#fbbf24)"
            : "linear-gradient(135deg,var(--green),#34d399)";
  }
}

/* ════════════════════════════════════════════════════
   F. REAL-TIME VALIDATION
   ════════════════════════════════════════════════════ */
const newPassInput = document.getElementById("newPass");
const confirmInput = document.getElementById("confirmPass");
const newPassErr = document.getElementById("newPassErr");
const confirmErr = document.getElementById("confirmErr");
const matchHint = document.getElementById("matchHint");
const btnReset = document.getElementById("btnReset");

let newTouched = false;
let confirmTouched = false;

/* Validate new password */
function validateNew(force = true) {
  const val = newPassInput.value;

  updateStrengthBar(val);
  updateReqList(val);

  newPassErr.textContent = "";
  newPassErr.classList.remove("show");
  newPassInput.classList.remove("error", "valid");

  if (!val) {
    if (force) {
      newPassErr.textContent = "Vui lòng nhập mật khẩu mới.";
      newPassErr.classList.add("show");
      newPassInput.classList.add("error");
    }
    return false;
  }
  if (val.length < MIN_LEN) {
    if (force) {
      newPassErr.textContent = `Password must be at least ${MIN_LEN} characters.`;
      newPassErr.classList.add("show");
      newPassInput.classList.add("error");
    }
    return false;
  }

  newPassInput.classList.add("valid");
  return true;
}

/* Validate confirm password */
function validateConfirm(force = true) {
  const val = confirmInput.value;
  const newVal = newPassInput.value;

  confirmErr.textContent = "";
  confirmErr.classList.remove("show");
  confirmInput.classList.remove("error", "valid");
  matchHint.className = "match-hint";

  if (!val) {
    if (force) {
      confirmErr.textContent = "Vui lòng xác nhận mật khẩu.";
      confirmErr.classList.add("show");
      confirmInput.classList.add("error");
    }
    return false;
  }

  if (val !== newVal) {
    if (force) {
      confirmErr.textContent = "Passwords do not match.";
      confirmErr.classList.add("show");
      confirmInput.classList.add("error");
    }
    // Match hint (always show once user types in confirm)
    matchHint.textContent = "✕ Mật khẩu không khớp";
    matchHint.classList.add("show", "no-match");
    return false;
  }

  confirmInput.classList.add("valid");
  matchHint.textContent = "✓ Mật khẩu khớp";
  matchHint.classList.add("show", "match");
  return true;
}

/* Sync submit button */
function syncBtn() {
  const newOk = newPassInput.value.length >= MIN_LEN;
  const confirmOk =
    confirmInput.value === newPassInput.value && confirmInput.value.length > 0;
  btnReset.disabled = !(newOk && confirmOk);
}

/* Events */
newPassInput.addEventListener("input", () => {
  if (newTouched) validateNew(true);
  else validateNew(false);
  if (confirmTouched) validateConfirm(true);
  syncBtn();
  updateStrengthBar(newPassInput.value);
});
newPassInput.addEventListener("blur", () => {
  newTouched = true;
  validateNew(true);
  syncBtn();
});

confirmInput.addEventListener("input", () => {
  if (confirmTouched) validateConfirm(true);
  else validateConfirm(false);
  syncBtn();
});
confirmInput.addEventListener("blur", () => {
  confirmTouched = true;
  validateConfirm(true);
  syncBtn();
});

/* Enter key submits */
[newPassInput, confirmInput].forEach((inp) => {
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !btnReset.disabled) handleSubmit();
  });
});

/* ════════════════════════════════════════════════════
   G. EYE (SHOW/HIDE PASSWORD) TOGGLES
   ════════════════════════════════════════════════════ */
function makeEyeToggle(btnId, inputEl, iconId) {
  document.getElementById(btnId).addEventListener("click", () => {
    const isHidden = inputEl.type === "password";
    inputEl.type = isHidden ? "text" : "password";
    document.getElementById(iconId).className =
      `ph-bold ${isHidden ? "ph-eye-slash" : "ph-eye"}`;
  });
}

makeEyeToggle("eyeNew", newPassInput, "eyeNewIcon");
makeEyeToggle("eyeConfirm", confirmInput, "eyeConfirmIcon");

/* ════════════════════════════════════════════════════
   H. SUBMIT HANDLER (Updated for Django)
   ════════════════════════════════════════════════════ */
btnReset.addEventListener("click", handleSubmit);

async function handleSubmit() {
  newTouched = confirmTouched = true;

  const newOk = validateNew(true);
  const confirmOk = validateConfirm(true);

  if (!newOk || !confirmOk) return;

  btnReset.classList.add("loading");
  btnReset.disabled = true;

  // Lấy CSRF Token từ thẻ input của Django
  const csrfEl = document.querySelector("[name=csrfmiddlewaretoken]");
  if (!csrfEl) {
    showToast("Lỗi bảo mật (Missing CSRF)", "error");
    return;
  }
  const csrftoken = csrfEl.value;
  const newPassword = newPassInput.value;

  try {
    // Đường dẫn API đặt lại mật khẩu trong urls.py
    const response = await fetch("/accounts/reset-password/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await response.json();

    if (data.success) {
      showToast("Mật khẩu đã được thay đổi!", "success");
      showSuccess(); // Hiện thanh progress bar chạy 3s
    } else {
      btnReset.classList.remove("loading");
      btnReset.disabled = false;
      showToast(data.message || "Không thể đặt lại mật khẩu.", "error");
    }
  } catch (error) {
    btnReset.classList.remove("loading");
    btnReset.disabled = false;
    showToast("Lỗi kết nối server!", "error");
  }
}

/* ════════════════════════════════════════════════════
   I. SUCCESS STATE
   ════════════════════════════════════════════════════ */
function showSuccess() {
  const formWrap = document.getElementById("formWrap");
  const successState = document.getElementById("successState");
  const bar = document.getElementById("successBar");

  formWrap.style.display = "none";
  successState.style.display = "";

  // Animate progress bar to 100% over REDIRECT_DELAY
  setTimeout(() => {
    bar.style.transition = `width ${REDIRECT_DELAY}ms linear`;
    bar.style.width = "100%";
  }, 50);

  // Update form icon (in success state it stays hidden, but update lock icon color)
  const formIcon = document.getElementById("formIcon");
  if (formIcon) {
    formIcon.style.background = "linear-gradient(135deg, #dcfce7, #bbf7d0)";
    formIcon.style.color = "var(--green)";
    formIcon.innerHTML = '<i class="ph-bold ph-check-circle"></i>';
  }

  // Redirect
  setTimeout(() => {
    location.href = REDIRECT_URL;
  }, REDIRECT_DELAY);
}

/* ════════════════════════════════════════════════════
   J. INIT
   ════════════════════════════════════════════════════ */
(function init() {
  // Xóa bỏ đếm ngược và masked email vì đây là trang Reset Password
  updateStrengthBar("");
  updateReqList("");

  // Focus vào ô mật khẩu mới thay vì otpInputs[0]
  const newPassInput = document.getElementById("newPass");
  if (newPassInput) {
    setTimeout(() => newPassInput.focus(), 400);
  }
})();
