/**
 * dashboard.js — Taskly Analytics Dashboard
 * ══════════════════════════════════════════════════════════
 *
 * Sections:
 *  A. Config & mock data
 *  B. Theme & shared UI (sidebar, header, toast)
 *  C. Scroll reveal
 *  D. KPI stat cards
 *  E. Productivity chart (bar / line toggle)
 *  F. Burn-down chart
 *  G. Progress list
 *  H. Category donut chart
 *  I. Mini calendar
 *  J. Insights & suggestions
 *  K. Period switch (week / month)
 *  L. Export PNG
 *  M. Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & MOCK DATA
   ════════════════════════════════════════════════════ */
const LS = {
  THEME: "taskly-theme",
  USERNAME: "taskly-username",
  BOARDS: "taskly-boards-db",
};

/* ── Weekly data ── */
const WEEKLY_DATA = {
  labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  values: [3, 7, 4, 6, 2, 1, 0], // tasks completed per day
  total: 23,
};

/* ── Monthly data ── */
const MONTHLY_DATA = {
  labels: [
    "T1",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "T8",
    "T9",
    "T10",
    "T11",
    "T12",
    "T13",
    "T14",
    "T15",
    "T16",
    "T17",
    "T18",
    "T19",
    "T20",
    "T21",
    "T22",
    "T23",
    "T24",
    "T25",
    "T26",
    "T27",
    "T28",
    "T29",
    "T30",
  ],
  values: [
    1, 2, 4, 3, 5, 2, 0, 1, 3, 4, 6, 5, 4, 2, 1, 3, 4, 7, 5, 4, 2, 1, 3, 4, 5,
    3, 2, 1, 0, 2,
  ],
  total: 83,
};

/* ── Burndown data ── */
const BURNDOWN_SPRINT = {
  labels: Array.from({ length: 10 }, (_, i) => `Ngày ${i + 1}`),
  ideal: [20, 18, 16, 14, 12, 10, 8, 6, 4, 0],
  actual: [20, 19, 17, 14, 12, 9, 7, 5, 3, 1],
};
const BURNDOWN_MONTH = {
  labels: Array.from({ length: 20 }, (_, i) => `Ngày ${i + 1}`),
  ideal: [
    45, 43, 41, 39, 37, 35, 33, 31, 28, 25, 22, 19, 16, 13, 10, 7, 5, 3, 1, 0,
  ],
  actual: [
    45, 44, 42, 39, 36, 33, 30, 27, 25, 22, 20, 17, 14, 11, 9, 7, 4, 3, 2, 0,
  ],
};

/* ── KPI stats ── */
const KPI = {
  done: 38,
  total: 45,
  overdue: 3,
  avgTime: 2.3, // hours
  score: 84, // percent
};

/* ── Board progress ── */
const BOARD_PROGRESS = [
  { name: "Website Redesign", done: 16, total: 24, color: "#5b67f7" },
  { name: "Marketing Q3", done: 9, total: 18, color: "#f59e0b" },
  { name: "DevOps Setup", done: 10, total: 12, color: "#22c55e" },
  { name: "Tuyển dụng 2025", done: 3, total: 8, color: "#ec4899" },
  { name: "Kế hoạch cá nhân", done: 7, total: 15, color: "#0ea5e9" },
];

/* ── Category data (for donut) ── */
const CATEGORIES = [
  { label: "Development", count: 18, color: "#5b67f7" },
  { label: "Design", count: 12, color: "#0ea5e9" },
  { label: "Marketing", count: 8, color: "#f59e0b" },
  { label: "Research", count: 5, color: "#22c55e" },
  { label: "Khác", count: 2, color: "#9ca3af" },
];

/* ── Calendar mock data: tasks per day this month ── */
function generateCalData() {
  const data = {};
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    // Simulate random completions (0–8)
    data[d] = Math.random() < 0.3 ? 0 : Math.floor(Math.random() * 8) + 1;
  }
  return data;
}
const CAL_DATA = generateCalData();

/* ── State ── */
const state = {
  period: "week", // week | month
  chartType: "bar", // bar | line
  bdPeriod: "sprint", // sprint | month
  calDate: new Date(),
};

/* ════════════════════════════════════════════════════
   B. THEME & SHARED UI
   ════════════════════════════════════════════════════ */
const html = document.documentElement;

(function initTheme() {
  const saved = localStorage.getItem(LS.THEME);
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (sys ? "dark" : "light");
  html.setAttribute("data-theme", theme);
  applyIconState(theme);
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem(LS.THEME, next);
  applyIconState(next);
  // Re-render all charts in new theme
  updateAllChartsTheme();
});

function applyIconState(theme) {
  const s = document.getElementById("iconSun");
  const m = document.getElementById("iconMoon");
  if (s && m) {
    s.style.display = theme === "dark" ? "none" : "";
    m.style.display = theme === "dark" ? "" : "none";
  }
}

/* User info */
(function loadUser() {
  const username = localStorage.getItem(LS.USERNAME) || "user";
  document.getElementById("userInitials").textContent = username
    .substring(0, 2)
    .toUpperCase();
  document.getElementById("udName").textContent = username;
  document.getElementById("udEmail").textContent = `${username}@taskly.vn`;
})();

/* Sidebar collapse */
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

/* User dropdown */
const avatarBtn = document.getElementById("userAvatarBtn");
const userDropdown = document.getElementById("userDropdown");
avatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = userDropdown.classList.toggle("open");
  avatarBtn.setAttribute("aria-expanded", String(isOpen));
});
document.addEventListener("click", (e) => {
  if (!document.getElementById("userMenuWrap").contains(e.target)) {
    userDropdown.classList.remove("open");
    avatarBtn.setAttribute("aria-expanded", "false");
  }
});

/* Logout */
document.getElementById("btnLogout").addEventListener("click", () => {
  showToast("Đã đăng xuất.", "info");
  setTimeout(() => {
    location.href = "login.html";
  }, 1000);
});

/* Toast */
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

/* ════════════════════════════════════════════════════
   C. SCROLL REVEAL
   ════════════════════════════════════════════════════ */
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((el) => {
      if (el.isIntersecting) {
        el.target.classList.add("visible");
        revealObs.unobserve(el.target);
      }
    });
  },
  { threshold: 0.1 },
);
document.querySelectorAll(".reveal").forEach((el) => revealObs.observe(el));

/* ════════════════════════════════════════════════════
   D. KPI STAT CARDS
   ════════════════════════════════════════════════════ */
function renderKPI() {
  animateCount("kpiDone", 0, KPI.done, 1200);
  animateCount("kpiOverdue", 0, KPI.overdue, 800);
  animateCount("kpiScore", 0, KPI.score, 1500, "%");

  // Average time
  const avgEl = document.getElementById("kpiAvgTime");
  let startTime = 0;
  const step = () => {
    startTime = Math.min(startTime + 0.1, KPI.avgTime);
    avgEl.textContent = startTime.toFixed(1) + "h";
    if (startTime < KPI.avgTime) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  // Sidebar score
  document.getElementById("sidebarScore").textContent = `${KPI.score}%`;
  document.getElementById("sidebarScoreBar").style.width = `${KPI.score}%`;
}

function animateCount(id, from, to, duration, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const run = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * ease) + suffix;
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

/* ════════════════════════════════════════════════════
   E. PRODUCTIVITY CHART
   ════════════════════════════════════════════════════ */
let prodChart = null;

function getChartColors() {
  const isDark = html.getAttribute("data-theme") === "dark";
  return {
    grid: isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)",
    text: isDark ? "#9095b3" : "#6b7280",
    accent: "#5b67f7",
    accentA: "rgba(91,103,247,.15)",
  };
}

function buildProductivityChart() {
  const data = state.period === "week" ? WEEKLY_DATA : MONTHLY_DATA;
  const colors = getChartColors();
  const ctx = document.getElementById("productivityChart").getContext("2d");

  if (prodChart) prodChart.destroy();

  // Find max day for highlight
  const maxIdx = data.values.indexOf(Math.max(...data.values));
  const bgColors = data.values.map((_, i) =>
    i === maxIdx ? colors.accent : colors.accentA,
  );
  const borderColors = data.values.map((_, i) =>
    i === maxIdx ? "#4454e8" : colors.accent,
  );

  prodChart = new Chart(ctx, {
    type: state.chartType,
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Tasks hoàn thành",
          data: data.values,
          backgroundColor:
            state.chartType === "bar" ? bgColors : colors.accentA,
          borderColor: state.chartType === "bar" ? borderColors : colors.accent,
          borderWidth: 2,
          borderRadius: state.chartType === "bar" ? 6 : 0,
          tension: 0.4,
          fill: state.chartType === "line",
          pointBackgroundColor: colors.accent,
          pointRadius: state.chartType === "line" ? 4 : 0,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(26,29,46,.95)",
          titleColor: "#fff",
          bodyColor: "#9095b3",
          borderColor: "#2e3147",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} tasks hoàn thành`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: colors.grid, drawTicks: false },
          ticks: { color: colors.text, font: { size: 11 } },
          border: { display: false },
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 11 }, precision: 0 },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  });

  // Update best day badge
  const days = [
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
    "Chủ Nhật",
  ];
  const bestLabel =
    state.period === "week"
      ? days[maxIdx] || data.labels[maxIdx]
      : data.labels[maxIdx];
  document.getElementById("bestDayText").textContent =
    `Năng suất cao nhất: ${bestLabel} (${Math.max(...data.values)} tasks)`;
  document.getElementById("prodSubtitle").textContent =
    state.period === "week"
      ? "Tasks hoàn thành mỗi ngày trong tuần"
      : `Tổng ${data.total} tasks hoàn thành trong tháng`;
}

/* ════════════════════════════════════════════════════
   F. BURN-DOWN CHART
   ════════════════════════════════════════════════════ */
let burnChart = null;

function buildBurndownChart() {
  const data = state.bdPeriod === "sprint" ? BURNDOWN_SPRINT : BURNDOWN_MONTH;
  const colors = getChartColors();
  const ctx = document.getElementById("burndownChart").getContext("2d");

  if (burnChart) burnChart.destroy();

  burnChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Lý tưởng",
          data: data.ideal,
          borderColor: colors.grid.replace(".08", ".5"),
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
        {
          label: "Thực tế",
          data: data.actual,
          borderColor: "#5b67f7",
          backgroundColor: "rgba(91,103,247,.1)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#5b67f7",
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: colors.text,
            font: { size: 11 },
            boxWidth: 12,
            boxHeight: 2,
            padding: 12,
          },
        },
        tooltip: {
          backgroundColor: "rgba(26,29,46,.95)",
          titleColor: "#fff",
          bodyColor: "#9095b3",
          borderColor: "#2e3147",
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text, font: { size: 10 }, maxTicksLimit: 8 },
          border: { display: false },
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 11 }, precision: 0 },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ════════════════════════════════════════════════════
   G. PROGRESS LIST
   ════════════════════════════════════════════════════ */
function renderProgressList() {
  const list = document.getElementById("progressList");
  list.innerHTML = "";

  BOARD_PROGRESS.forEach((board, idx) => {
    const pct = board.total ? Math.round((board.done / board.total) * 100) : 0;
    const item = document.createElement("div");
    item.className = "progress-item";
    item.style.animationDelay = `${idx * 0.06}s`;
    item.innerHTML = `
      <div class="progress-item__top">
        <span class="progress-item__name">${escHtml(board.name)}</span>
        <div class="progress-item__meta">
          <span class="progress-item__pct">${pct}%</span>
        </div>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill"
          style="width:0%;background:${escHtml(board.color)}"
          data-target="${pct}"></div>
      </div>`;
    list.appendChild(item);
  });

  // Animate bars after a short delay
  requestAnimationFrame(() => {
    document.querySelectorAll(".progress-bar-fill").forEach((bar) => {
      setTimeout(() => {
        bar.style.width = bar.dataset.target + "%";
      }, 200);
    });
  });
}

/* ════════════════════════════════════════════════════
   H. CATEGORY DONUT CHART
   ════════════════════════════════════════════════════ */
let donutChart = null;

function buildDonutChart() {
  const ctx = document.getElementById("categoryChart").getContext("2d");
  const total = CATEGORIES.reduce((s, c) => s + c.count, 0);
  const colors = getChartColors();

  document.getElementById("donutTotal").textContent = total;

  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: CATEGORIES.map((c) => c.label),
      datasets: [
        {
          data: CATEGORIES.map((c) => c.count),
          backgroundColor: CATEGORIES.map((c) => c.color),
          borderWidth: 3,
          borderColor:
            html.getAttribute("data-theme") === "dark" ? "#1a1d2e" : "#fff",
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      animation: { duration: 900 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(26,29,46,.95)",
          titleColor: "#fff",
          bodyColor: "#9095b3",
          borderColor: "#2e3147",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) =>
              ` ${ctx.label}: ${ctx.parsed} tasks (${Math.round((ctx.parsed / total) * 100)}%)`,
          },
        },
      },
    },
  });

  // Build legend
  const legend = document.getElementById("donutLegend");
  legend.innerHTML = "";
  CATEGORIES.forEach((c) => {
    const item = document.createElement("div");
    item.className = "donut-legend-item";
    item.innerHTML = `
      <span class="donut-legend-dot" style="background:${c.color}"></span>
      <span class="donut-legend-label">${escHtml(c.label)}</span>
      <span class="donut-legend-val">${c.count}</span>`;
    legend.appendChild(item);
  });
}

/* ════════════════════════════════════════════════════
   I. MINI CALENDAR
   ════════════════════════════════════════════════════ */
function renderCalendar() {
  const d = state.calDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const today = new Date();

  document.getElementById("calMonthLabel").textContent = d.toLocaleDateString(
    "vi-VN",
    { month: "long", year: "numeric" },
  );

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert Sunday=0 to Monday=0
  const startOffset = (firstDay + 6) % 7;

  const dayHeaders = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  let html_str = '<div class="cal-grid">';

  // Headers
  dayHeaders.forEach((h) => {
    html_str += `<div class="cal-day-header">${h}</div>`;
  });

  // Empty cells
  for (let i = 0; i < startOffset; i++) {
    html_str += `<div class="cal-day empty"></div>`;
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const tasks = CAL_DATA[day] || 0;
    const isToday =
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate();

    let cls = "cal-day";
    if (isToday) cls += " today";
    if (tasks >= 6) cls += " has-tasks-high";
    else if (tasks >= 3) cls += " has-tasks-mid";
    else if (tasks >= 1) cls += " has-tasks-low";

    const title = tasks ? `${day} — ${tasks} tasks` : day;
    html_str += `<div class="${cls}" title="${title}">${day}</div>`;
  }
  html_str += "</div>";
  document.getElementById("miniCalendar").innerHTML = html_str;
}

document.getElementById("calPrev").addEventListener("click", () => {
  state.calDate = new Date(
    state.calDate.getFullYear(),
    state.calDate.getMonth() - 1,
    1,
  );
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  state.calDate = new Date(
    state.calDate.getFullYear(),
    state.calDate.getMonth() + 1,
    1,
  );
  renderCalendar();
});

/* ════════════════════════════════════════════════════
   J. INSIGHTS & SUGGESTIONS
   ════════════════════════════════════════════════════ */
const INSIGHT_POOL = [
  // Observations
  {
    type: "info",
    icon: "ph-trophy",
    title: "Ngày năng suất nhất",
    desc: "Bạn hoàn thành nhiều task nhất vào Thứ Năm. Hãy tận dụng năng lượng đó!",
  },
  {
    type: "success",
    icon: "ph-trend-up",
    title: "Xu hướng tích cực",
    desc: "Thời gian hoàn thành trung bình đang giảm. Bạn đang làm việc hiệu quả hơn.",
  },
  {
    type: "warning",
    icon: "ph-warning-circle",
    title: "Task quá hạn",
    desc: `Bạn có ${KPI.overdue} task đang quá hạn. Hãy xử lý chúng sớm nhất có thể.`,
  },
  {
    type: "info",
    icon: "ph-chart-line-up",
    title: "Điểm năng suất",
    desc: `Điểm năng suất của bạn là ${KPI.score}% — cao hơn mức trung bình 68%.`,
  },
  {
    type: "success",
    icon: "ph-check-circle",
    title: "Hoàn thành board",
    desc: 'Board "DevOps Setup" đạt 83% tiến độ. Chỉ còn 2 task nữa là xong!',
  },
  {
    type: "warning",
    icon: "ph-clock-countdown",
    title: "Deadline gần",
    desc: "3 task trong board Marketing Q3 sẽ đến hạn trong 2 ngày tới.",
  },
  // Suggestions
  {
    type: "info",
    icon: "ph-lightbulb",
    title: "Lời khuyên",
    desc: "Hãy chia task lớn thành các task nhỏ hơn để dễ theo dõi tiến độ.",
  },
  {
    type: "success",
    icon: "ph-rocket-launch",
    title: "Gợi ý tăng năng suất",
    desc: "Tăng ưu tiên task gần deadline. Dùng Pomodoro 25 phút để duy trì tập trung.",
  },
  {
    type: "info",
    icon: "ph-calendar-check",
    title: "Lên kế hoạch ngày mai",
    desc: "Hãy chuẩn bị danh sách task vào cuối ngày hôm nay để bắt đầu sớm hơn.",
  },
];

function renderInsights() {
  const grid = document.getElementById("insightsGrid");
  grid.innerHTML = "";

  // Pick 6 random insights
  const shuffled = [...INSIGHT_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);

  shuffled.forEach((insight, idx) => {
    const card = document.createElement("div");
    card.className = `insight-card insight-card--${insight.type}`;
    card.style.animationDelay = `${idx * 0.07}s`;
    card.innerHTML = `
      <i class="ph-bold ${insight.icon} insight-card__icon"></i>
      <div class="insight-card__text">
        <p class="insight-card__title">${escHtml(insight.title)}</p>
        <p class="insight-card__desc">${escHtml(insight.desc)}</p>
      </div>`;
    grid.appendChild(card);
  });
}

document.getElementById("btnRefreshInsights").addEventListener("click", () => {
  renderInsights();
  showToast("Insights đã được cập nhật!", "info");
});

/* ════════════════════════════════════════════════════
   K. PERIOD SWITCH + CHART TYPE TOGGLE
   ════════════════════════════════════════════════════ */
// Period tabs (Week / Month)
document.querySelectorAll(".period-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.period = btn.dataset.period;
    document
      .querySelectorAll(".period-tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    buildProductivityChart();
  });
});

// Chart type toggle (Bar / Line)
document.getElementById("chartBar").addEventListener("click", () => {
  state.chartType = "bar";
  document.getElementById("chartBar").classList.add("active");
  document.getElementById("chartLine").classList.remove("active");
  buildProductivityChart();
});
document.getElementById("chartLine").addEventListener("click", () => {
  state.chartType = "line";
  document.getElementById("chartLine").classList.add("active");
  document.getElementById("chartBar").classList.remove("active");
  buildProductivityChart();
});

// Burndown period toggle
document.getElementById("bdSprint").addEventListener("click", () => {
  state.bdPeriod = "sprint";
  document.getElementById("bdSprint").classList.add("active");
  document.getElementById("bdMonth").classList.remove("active");
  buildBurndownChart();
});
document.getElementById("bdMonth").addEventListener("click", () => {
  state.bdPeriod = "month";
  document.getElementById("bdMonth").classList.add("active");
  document.getElementById("bdSprint").classList.remove("active");
  buildBurndownChart();
});

/* ════════════════════════════════════════════════════
   THEME: re-build all charts when theme changes
   ════════════════════════════════════════════════════ */
function updateAllChartsTheme() {
  buildProductivityChart();
  buildBurndownChart();
  buildDonutChart();
}

/* ════════════════════════════════════════════════════
   L. EXPORT PNG
   ════════════════════════════════════════════════════ */
async function exportDashboard() {
  showToast("Đang xuất báo cáo…", "info");
  try {
    // Export productivity chart as PNG
    const canvas = document.getElementById("productivityChart");
    const link = document.createElement("a");
    link.download = `taskly-dashboard-${new Date().toISOString().split("T")[0]}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Biểu đồ đã được xuất thành công!", "success");
  } catch (err) {
    showToast("Không thể xuất biểu đồ.", "error");
  }
}
window.exportDashboard = exportDashboard;
document.getElementById("btnExport").addEventListener("click", exportDashboard);

/* ════════════════════════════════════════════════════
   UTILITY
   ════════════════════════════════════════════════════ */
function escHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* ════════════════════════════════════════════════════
   M. INIT — render everything
   ════════════════════════════════════════════════════ */
(function init() {
  // Stagger renders slightly so charts don't compete for paint
  renderKPI();
  renderProgressList();
  renderCalendar();
  renderInsights();

  setTimeout(() => {
    buildProductivityChart();
    buildBurndownChart();
    buildDonutChart();
  }, 150);

  // Sidebar badge from boards DB
  try {
    const boards = JSON.parse(localStorage.getItem(LS.BOARDS) || "[]");
    document.getElementById("badgeAll").textContent = boards.filter(
      (b) => !b.is_archived,
    ).length;
  } catch {
    /* ignore */
  }

  // Welcome toast
  if (!sessionStorage.getItem("dash-greeted")) {
    sessionStorage.setItem("dash-greeted", "1");
    const u = localStorage.getItem(LS.USERNAME) || "bạn";
    setTimeout(
      () =>
        showToast(
          `Xin chào ${u}! Đây là dashboard phân tích của bạn 📊`,
          "success",
        ),
      700,
    );
  }
})();
