/**
 * otp.js — Taskly OTP Verification Page
 * ══════════════════════════════════════════════════════════
 * Sections:
 *  A. Config & constants
 *  B. Theme
 *  C. Toast
 *  D. OTP input logic (focus, navigate, paste, fill-style)
 *  E. Countdown timer
 *  F. Verify handler
 *  G. Resend handler
 *  H. Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & CONSTANTS
   ════════════════════════════════════════════════════ */

/** Mock OTP — in production this comes from the server */
const MOCK_OTP = "123456";

/** Redirect after successful verification */
const REDIRECT_URL = "/accounts/reset-password/";

/** Countdown seconds */
const COUNTDOWN_SEC = 30;

/** Mask email: nguyen@gmail.com → ng***@gmail.com */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/* Read email from URL param or localStorage */
const EMAIL_PARAM =
  new URLSearchParams(location.search).get("email") ||
  localStorage.getItem("taskly-otp-email") ||
  "user@gmail.com";

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
  _toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3800);
}

/* ════════════════════════════════════════════════════
   D. OTP INPUT LOGIC
   ════════════════════════════════════════════════════ */
const otpInputs = Array.from(document.querySelectorAll(".otp-box"));
const otpWrapper = document.getElementById("otpInputs");
const otpErrorEl = document.getElementById("otpError");
const btnVerify = document.getElementById("btnVerify");

/** Get the assembled 6-digit string */
const getOTPValue = () => otpInputs.map((i) => i.value).join("");

/** Update verify button enabled state */
function syncVerifyBtn() {
  const val = getOTPValue();
  btnVerify.disabled = val.length < 6;
}

/** Clear error state */
function clearError() {
  otpInputs.forEach((i) => i.classList.remove("error-box"));
  otpErrorEl.textContent = "";
  otpErrorEl.classList.remove("show");
}

/** Show error state + shake */
function showError(msg) {
  otpInputs.forEach((i) => i.classList.add("error-box"));
  otpErrorEl.textContent = msg;
  otpErrorEl.classList.add("show");

  // Shake
  otpWrapper.classList.remove("shake");
  void otpWrapper.offsetHeight; // reflow to restart animation
  otpWrapper.classList.add("shake");
  otpWrapper.addEventListener(
    "animationend",
    () => {
      otpWrapper.classList.remove("shake");
    },
    { once: true },
  );
}

/** Mark a box as filled (green border) */
function updateFillStyle(box) {
  box.classList.toggle("filled", box.value.length === 1);
}

/* ── Per-box events ── */
otpInputs.forEach((box, idx) => {
  /* Keydown: navigate with arrow keys, delete, backspace */
  box.addEventListener("keydown", (e) => {
    clearError();

    if (e.key === "ArrowRight" || e.key === "Tab") {
      e.preventDefault();
      otpInputs[Math.min(idx + 1, 5)]?.focus();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      otpInputs[Math.max(idx - 1, 0)]?.focus();
      return;
    }
    if (e.key === "Backspace") {
      if (box.value) {
        box.value = "";
        updateFillStyle(box);
      } else {
        // Move to previous box and clear it
        const prev = otpInputs[idx - 1];
        if (prev) {
          prev.value = "";
          updateFillStyle(prev);
          prev.focus();
        }
      }
      syncVerifyBtn();
    }
  });

  /* Input: only allow digits, auto-advance */
  box.addEventListener("input", (e) => {
    clearError();
    const raw = e.target.value;

    // Strip non-digits and keep only last character
    const digit = raw.replace(/\D/g, "").slice(-1);
    box.value = digit;
    updateFillStyle(box);
    syncVerifyBtn();

    if (digit && idx < 5) {
      otpInputs[idx + 1].focus();
    }
  });

  /* Paste: spread digits across boxes */
  box.addEventListener("paste", (e) => {
    e.preventDefault();
    clearError();

    const pasted = (e.clipboardData || window.clipboardData)
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    pasted.split("").forEach((digit, i) => {
      if (otpInputs[i]) {
        otpInputs[i].value = digit;
        updateFillStyle(otpInputs[i]);
      }
    });

    // Focus the box after the last filled
    const nextFocus = Math.min(pasted.length, 5);
    otpInputs[nextFocus].focus();
    syncVerifyBtn();
  });

  /* Click: select existing value for easy re-type */
  box.addEventListener("click", () => {
    box.select();
    clearError();
  });

  /* Focus: select for easy re-entry */
  box.addEventListener("focus", () => box.select());
});

/* ════════════════════════════════════════════════════
   E. COUNTDOWN TIMER
   ════════════════════════════════════════════════════ */
const countdownEl = document.getElementById("resendCountdown");
const countNumEl = document.getElementById("countdownNum");
const btnResend = document.getElementById("btnResend");

let _cdTimer = null;
let _cdRemain = COUNTDOWN_SEC;
let _cdRunning = false;

function startCountdown() {
  _cdRemain = COUNTDOWN_SEC;
  _cdRunning = true;

  // Show countdown, hide button
  countdownEl.style.display = "";
  btnResend.style.display = "none";
  countNumEl.textContent = _cdRemain;

  clearInterval(_cdTimer);
  _cdTimer = setInterval(() => {
    _cdRemain--;
    countNumEl.textContent = _cdRemain;

    if (_cdRemain <= 0) {
      clearInterval(_cdTimer);
      _cdRunning = false;
      countdownEl.style.display = "none";
      btnResend.style.display = "";
    }
  }, 1000);
}

/* ════════════════════════════════════════════════════
   F. VERIFY HANDLER
   ════════════════════════════════════════════════════ */
btnVerify.addEventListener("click", handleVerify);

/* Also allow Enter key from any OTP box */
otpInputs.forEach((box) => {
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && getOTPValue().length === 6) handleVerify();
  });
});

function handleVerify() {
  const val = getOTPValue();
  if (val.length < 6) return;

  btnVerify.classList.add("loading");
  btnVerify.disabled = true;

  const csrftoken = document.querySelector("[name=csrfmiddlewaretoken]").value;

  // Gửi đến URL /accounts/verify-otp/ (là cái view vừa gộp)
  fetch("/accounts/verify-otp/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken,
      "X-Requested-With": "XMLHttpRequest", // Giúp Django nhận biết đây là AJAX
    },
    body: JSON.stringify({ otp: val }),
  })
    .then((response) => response.json())
    .then((data) => {
      btnVerify.classList.remove("loading");
      if (data.success) {
        handleSuccess(); // Hàm này của bạn sẽ chuyển hướng đến dashboard
      } else {
        handleFailure();
        // Nếu backend báo session hết hạn, ta có thể đổi màu toast khác
        const errorMsg = data.message || "Mã không đúng";
        showToast(errorMsg, "error");

        if (errorMsg.includes("Phiên làm việc")) {
          setTimeout(() => (location.href = "/forgot-password/"), 2000);
        }
      }
    })
    .catch((err) => {
      btnVerify.classList.remove("loading");
      showToast("Lỗi kết nối server", "error");
    });
}

function handleSuccess() {
  // Shield turns green
  document.querySelector(".form-wrap").classList.add("success");
  const formIcon = document.getElementById("formIcon");
  formIcon.innerHTML = '<i class="ph-bold ph-check-circle"></i>';

  showToast("OTP xác thực thành công! Đang chuyển hướng…", "success");

  // Mark boxes as green
  otpInputs.forEach((box) => {
    box.classList.remove("error-box");
    box.classList.add("filled");
  });

  // Redirect after 1.5s
  setTimeout(() => {
    location.href = REDIRECT_URL;
  }, 1500);
}

function handleFailure() {
  showError("Invalid OTP. Please try again.");
  showToast("Mã OTP không hợp lệ!", "error");

  // Clear inputs, focus first box
  otpInputs.forEach((box) => {
    box.value = "";
    box.classList.remove("filled");
  });
  otpInputs[0].focus();
  syncVerifyBtn();
}

/* ════════════════════════════════════════════════════
   G. RESEND HANDLER
   ════════════════════════════════════════════════════ */
btnResend.addEventListener("click", async () => {
  btnResend.disabled = true;
  const originalText = btnResend.innerHTML;
  btnResend.innerHTML = "Đang gửi...";

  // LẤY CSRF TOKEN Ở ĐÂY (Quan trọng)
  const csrftoken = document.querySelector("[name=csrfmiddlewaretoken]").value;

  try {
    // Đảm bảo đường dẫn khớp với urls.py (thường là /accounts/resend-otp/)
    const response = await fetch("/accounts/resend-otp/", {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const data = await response.json();

    if (data.success) {
      showToast("Mã OTP mới đã được gửi!", "success");

      // Xóa các ô nhập cũ và focus ô đầu
      otpInputs.forEach((box) => {
        box.value = "";
        box.classList.remove("filled", "error-box");
      });
      otpInputs[0].focus();

      startCountdown(); // Chạy lại đếm ngược 30s
    } else {
      showToast(data.message || "Không thể gửi lại mã.", "error");
      btnResend.innerHTML = originalText;
      btnResend.disabled = false;
    }
  } catch (error) {
    showToast("Lỗi kết nối server", "error");
    btnResend.innerHTML = originalText;
    btnResend.disabled = false;
  }
});

/* ════════════════════════════════════════════════════
   H. INIT
   ════════════════════════════════════════════════════ */
(function init() {
  // Display masked email
  document.getElementById("maskedEmail").textContent = maskEmail(EMAIL_PARAM);

  // Start countdown immediately
  startCountdown();

  // Auto-focus first box (small delay for CSS animation)
  setTimeout(() => otpInputs[0].focus(), 400);
})();
