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

const state = {
  period: "week",
  chartType: "bar",
  bdPeriod: "sprint",
  calDate: new Date(),
  currentData: null, // Lưu trữ dữ liệu từ API để dùng chung
};

/* dashboard.js - Section A */
function getColorEmoji(hex) {
    if (!hex) return '❌';
    // Ép kiểu về viết thường và xóa khoảng trắng thừa
    const cleanHex = String(hex).toLowerCase().trim(); 
    
    const colorMap = {
        '#6366f1': '🟣', // Công việc
        '#0ea5e9': '🔵', // Học tập
        '#10b981': '🟢', // Sức khỏe
        '#ec4899': '🌸', // Gia đình
        '#f59e0b': '🟡', // Tài chính
        '#8b5cf6': '💜', // Việc nhà
        '#f43f5e': '🔴', // Giải trí
        '#64748b': '⚪', // Quản trị
        '#94a3b8': '🔘'  // Khác
    };
    return colorMap[cleanHex] || '❌';
}
/* ════════════════════════════════════════════════════
   B. THEME & SHARED UI
   ════════════════════════════════════════════════════ */
//  dùng để điều chỉnh sáng tối cho ứng dựng
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
    s.style.display = theme === "dark" ? "none" : "block"; 
    m.style.display = theme === "dark" ? "block" : "none";
  }
}

/* User info */
(function loadUser() {
  const username = window.TasklyConfig ? window.TasklyConfig.username : "User";
  const email = window.TasklyConfig
    ? window.TasklyConfig.email
    : "user@taskly.vn";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl) {
    initialsEl.textContent = username.substring(0, 2).toUpperCase();
  }
  if (document.getElementById("udName"))
    document.getElementById("udName").textContent = username;
  if (document.getElementById("udEmail"))
    document.getElementById("udEmail").textContent = email;
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
    location.href = "/logout/";
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
// Sửa hàm để nhận tham số 'stats' từ API thay vì dùng biến KPI giả
function renderKPI(stats) {
  if (!stats) return;

  // 1. Hiển thị số task hoàn thành (completed_tasks)
  animateCount("kpiDone", 0, stats.completed_tasks, 1200);

  // 2. Hiển thị số task quá hạn (overdue_tasks)
  animateCount("kpiOverdue", 0, stats.overdue_tasks, 800);

  // 3. Hiển thị điểm năng suất (productivity_score)
  animateCount("kpiScore", 0, stats.productivity_score, 1500, "%");

  // 4. Xử lý thời gian trung bình (Tạm thời fix 2.3h hoặc bạn có thể bổ sung vào API)
  const avgTime = 2.3;
  const avgEl = document.getElementById("kpiAvgTime");
  if (avgEl) {
    let startTime = 0;
    const step = () => {
      startTime = Math.min(startTime + 0.1, avgTime);
      avgEl.textContent = startTime.toFixed(1) + "h";
      if (startTime < avgTime) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // 5. Cập nhật thanh tiến độ ở Sidebar (sidebarScore)
  const sidebarScoreEl = document.getElementById("sidebarScore");
  const sidebarScoreBar = document.getElementById("sidebarScoreBar");

  if (sidebarScoreEl)
    sidebarScoreEl.textContent = `${stats.productivity_score}%`;
  if (sidebarScoreBar)
    sidebarScoreBar.style.width = `${stats.productivity_score}%`;
}

/* ════════════════════════════════════════════════════
   E. PRODUCTIVITY CHART
   ════════════════════════════════════════════════════ */
// Biến toàn cục để quản lý instance của biểu đồ
let prodChart = null;

function getChartColors() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  return {
    grid: isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)",
    text: isDark ? "#9095b3" : "#6b7280",
    accent: "#5b67f7",
    accentA: "rgba(91,103,247,.15)",
  };
}

// SỬA: Thêm tham số 'apiData' để nhận dữ liệu từ Backend
function buildProductivityChart(apiData) {
  // Nếu không có dữ liệu từ API, thoát hàm để tránh lỗi
  if (!apiData || apiData.length === 0) return;

  const colors = getChartColors();
  const ctx = document.getElementById("productivityChart").getContext("2d");

  // Xóa biểu đồ cũ trước khi vẽ mới để tránh bị đè dữ liệu
  if (prodChart) prodChart.destroy();

  // Chuyển đổi dữ liệu từ API sang định dạng Chart.js
  const labels = apiData.map(item => item.day); // ['T2', 'T3', ...]
  const values = apiData.map(item => item.completed); // [3, 7, ...]

  // Tìm chỉ số (index) của ngày có năng suất cao nhất
  const maxVal = Math.max(...values);
  const maxIdx = values.indexOf(maxVal);

  // Thiết lập màu sắc: Ngày cao nhất sẽ có màu đậm (accent), các ngày khác màu nhạt (accentA)
  const bgColors = values.map((_, i) => (i === maxIdx ? colors.accent : colors.accentA));

  prodChart = new Chart(ctx, {
    type: state.chartType, // Lấy từ biến state (bar hoặc line)
    data: {
      labels: labels,
      datasets: [{
          label: "Tasks hoàn thành",
          data: values,
          backgroundColor: state.chartType === "bar" ? bgColors : colors.accentA,
          borderColor: colors.accent,
          borderWidth: 2,
          tension: 0.4,
          fill: state.chartType === "line",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(26,29,46,.95)",
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} tasks hoàn thành`,
          },
        },
      },
      scales: {
        x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
        y: { 
            grid: { color: colors.grid }, 
            ticks: { color: colors.text, precision: 0 }, 
            beginAtZero: true 
        },
      },
    },
  });

  // Cập nhật nội dung badge "Năng suất cao nhất"
  const bestDayText = document.getElementById("bestDayText");
  if (bestDayText) {
    bestDayText.textContent = maxVal > 0 
        ? `Năng suất cao nhất: ${labels[maxIdx]} (${maxVal} tasks)` 
        : "Chưa có dữ liệu hoàn thành";
  }

  // Cập nhật phụ đề
  const subTitle = document.getElementById("prodSubtitle");
  if (subTitle) {
      subTitle.textContent = state.period === "week" 
        ? "Tasks hoàn thành mỗi ngày trong tuần" 
        : "Tasks hoàn thành trong tháng";
  }
}
/* ════════════════════════════════════════════════════
   F. BURN-DOWN CHART (REAL DATA)
   ════════════════════════════════════════════════════ */
let burnChart = null;

function buildBurndownChart(apiBurndownData) {
  // Kiểm tra nếu không có dữ liệu từ API thì không vẽ
  if (!apiBurndownData) return;

  const colors = getChartColors(); // Lấy màu sắc theo theme hiện tại
  const canvas = document.getElementById("burndownChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Hủy biểu đồ cũ nếu đã tồn tại để tránh lỗi ghi đè
  if (burnChart) burnChart.destroy();

  burnChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: apiBurndownData.labels, // ["01/05", "02/05", ...] từ Backend
      datasets: [
        {
          label: "Lý tưởng",
          data: apiBurndownData.ideal, // Đường thẳng giảm dần lý tưởng
          borderColor: colors.grid.replace(".08", ".5"),
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
        {
          label: "Thực tế",
          data: apiBurndownData.actual, // Số lượng task thực tế còn lại
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
          },
        },
        tooltip: {
          backgroundColor: "rgba(26,29,46,.95)",
          padding: 10,
          callbacks: {
            label: (context) => ` Còn lại: ${context.parsed.y} tasks`
          }
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text, font: { size: 10 }, maxTicksLimit: 8 },
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 11 }, precision: 0 },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ════════════════════════════════════════════════════
   G. PROGRESS LIST (DỮ LIỆU THẬT)
   ════════════════════════════════════════════════════ */
function renderProgressList(boards) {
  const list = document.getElementById("progressList");
  if (!list || !boards) return;

  // 1. Làm trống danh sách hiện tại
  list.innerHTML = "";

  // 2. Lặp qua danh sách Board từ API trả về
  boards.forEach((board, idx) => {
    // Backend đã tính sẵn giá trị 'progress'
    const pct = board.progress || 0; 
    const item = document.createElement("div");
    item.className = "progress-item";
    
    // Tạo độ trễ hiệu ứng cho từng dòng
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
          style="width: 0%; background: ${escHtml(board.color)}"
          data-target="${pct}"></div>
      </div>`;
    list.appendChild(item);
  });

  // 3. Kích hoạt hiệu ứng chạy thanh tiến độ
  requestAnimationFrame(() => {
    document.querySelectorAll(".progress-bar-fill").forEach((bar) => {
      setTimeout(() => {
        bar.style.width = bar.dataset.target + "%";
      }, 200);
    });
  });
}

/* ════════════════════════════════════════════════════
   H. CATEGORY DONUT CHART (DỮ LIỆU THẬT)
   ════════════════════════════════════════════════════ */
let donutChart = null;

function buildDonutChart(apiCategories) {
  const canvas = document.getElementById("categoryChart");
  const totalEl = document.getElementById("donutTotal"); 
  const legendEl = document.getElementById("donutLegend");

  if (!canvas || !apiCategories) return;

  const ctx = canvas.getContext("2d");
  const total = apiCategories.reduce((s, c) => s + (c.count || 0), 0);
  
  if (totalEl) totalEl.textContent = total;

  const bgColors = apiCategories.map(c => c.color || '#5b67f7');

  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: apiCategories.map(c => c.label),
      datasets: [{
        data: apiCategories.map(c => c.count),
        backgroundColor: bgColors,
        borderWidth: 3,
        borderColor: document.documentElement.getAttribute("data-theme") === "dark" ? "#1a1d2e" : "#fff",
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} tasks`
          }
        }
      }
    }
  });

  // Đổ dữ liệu Legend kèm Emoji vào HTML
  if (legendEl) {
    legendEl.innerHTML = apiCategories.map(c => {
      const emoji = getColorEmoji(c.color); 
      return `
        <div class="donut-legend-item">
          <span class="donut-legend-emoji">${emoji}</span>
          <span class="donut-legend-label">${escHtml(c.label)}</span>
          <span class="donut-legend-val">${c.count}</span>
        </div>
      `;
    }).join("");
  }
}

/* ════════════════════════════════════════════════════
   I. MINI CALENDAR (DỮ LIỆU THẬT)
   ════════════════════════════════════════════════════ */
function renderCalendar(calData) {
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
  const startOffset = (firstDay + 6) % 7; // Chuyển Chủ Nhật (0) thành Thứ Hai (0)

  const dayHeaders = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  let html_str = '<div class="cal-grid">';

  dayHeaders.forEach((h) => {
    html_str += `<div class="cal-day-header">${h}</div>`;
  });

  for (let i = 0; i < startOffset; i++) {
    html_str += `<div class="cal-day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    // SỬA: Lấy dữ liệu từ calData truyền vào thay vì CAL_DATA giả
    const tasks = calData ? (calData[day] || 0) : 0; 
    
    const isToday =
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate();

    let cls = "cal-day";
    if (isToday) cls += " today";
    
    // Gắn class màu sắc dựa trên số lượng thực tế từ DB
    if (tasks >= 6) cls += " has-tasks-high";
    else if (tasks >= 3) cls += " has-tasks-mid";
    else if (tasks >= 1) cls += " has-tasks-low";

    const title = tasks ? `${day} — ${tasks} tasks` : day;
    html_str += `<div class="${cls}" title="${title}">${day}</div>`;
  }
  html_str += "</div>";
  document.getElementById("miniCalendar").innerHTML = html_str;
}

/* ════════════════════════════════════════════════════
   J. INSIGHTS & SUGGESTIONS (LOGIC THỰC TẾ)
   ════════════════════════════════════════════════════ */

// Kho lưu trữ các lời khuyên chung (Suggestions)
const SUGGESTION_POOL = [
  {
    type: "info",
    icon: "ph-lightbulb",
    title: "Lời khuyên",
    desc: "Hãy chia task lớn thành các task nhỏ hơn để dễ dàng theo dõi tiến độ và không bị ngợp.",
  },
  {
    type: "success",
    icon: "ph-rocket-launch",
    title: "Tăng năng suất",
    desc: "Thử áp dụng phương pháp Pomodoro (25 phút làm, 5 phút nghỉ) để duy trì sự tập trung cao độ.",
  },
  {
    type: "info",
    icon: "ph-calendar-check",
    title: "Lên kế hoạch",
    desc: "Dành 5 phút cuối ngày để liệt kê các đầu việc cho ngày mai giúp bạn bắt đầu buổi sáng hiệu quả hơn.",
  },
  {
    type: "info",
    icon: "ph-brain",
    title: "Sức khỏe tinh thần",
    desc: "Đừng quên nghỉ ngơi và uống nước đầy đủ. Một trí tuệ minh mẫn sẽ giải quyết task nhanh hơn.",
  }
];

/**
 * Hàm render Insights dựa trên dữ liệu thật từ Backend
 * @param {Object} stats - Đối tượng chứa completed_tasks, overdue_tasks, productivity_score...
 */
function renderInsights(stats) {
  const grid = document.getElementById("insightsGrid");
  if (!grid) return;
  
  grid.innerHTML = "";
  const displayList = [];

  // --- 1. TẠO CÁC INSIGHTS DỰA TRÊN DỮ LIỆU THỰC (OBSERVATIONS) ---

  // Cảnh báo task quá hạn
  if (stats && stats.overdue_tasks > 0) {
    displayList.push({
      type: "warning",
      icon: "ph-warning-circle",
      title: "Task quá hạn",
      desc: `Bạn đang có ${stats.overdue_tasks} task đã quá hạn chót. Hãy ưu tiên xử lý chúng ngay để đảm bảo tiến độ dự án.`,
    });
  }

  // Khen ngợi nếu điểm năng suất cao
  if (stats && stats.productivity_score >= 80) {
    displayList.push({
      type: "success",
      icon: "ph-trophy",
      title: "Hiệu suất tuyệt vời",
      desc: `Điểm năng suất của bạn đạt ${stats.productivity_score}%. Bạn đang quản lý công việc cực kỳ hiệu quả!`,
    });
  } 
  // Khuyến khích nếu điểm năng suất thấp
  else if (stats && stats.productivity_score < 50 && stats.total_tasks > 0) {
    displayList.push({
      type: "info",
      icon: "ph-chart-line-up",
      title: "Cố gắng lên!",
      desc: `Tỷ lệ hoàn thành hiện tại là ${stats.productivity_score}%. Hãy tập trung xử lý các task nhỏ để tăng điểm năng suất nhé.`,
    });
  }

  // Thông báo về xu hướng (Ví dụ: Dựa trên số lượng hoàn thành)
  if (stats && stats.completed_tasks > 0) {
    displayList.push({
      type: "success",
      icon: "ph-trend-up",
      title: "Xu hướng tích cực",
      desc: `Bạn đã hoàn thành tổng cộng ${stats.completed_tasks} công việc. Một con số rất đáng khích lệ!`,
    });
  }

  // --- 2. TRỘN THÊM CÁC LỜI KHUYÊN NGẪU NHIÊN ĐỂ ĐỦ 6 THẺ ---
  
  // Trộn danh sách lời khuyên chung
  const randomSuggestions = [...SUGGESTION_POOL].sort(() => Math.random() - 0.5);
  
  // Thêm vào danh sách hiển thị cho đến khi đủ 6 (hoặc hết pool)
  while (displayList.length < 6 && randomSuggestions.length > 0) {
    displayList.push(randomSuggestions.pop());
  }

  // --- 3. VẼ CÁC THẺ LÊN GIAO DIỆN ---
  displayList.forEach((insight, idx) => {
    const card = document.createElement("div");
    card.className = `insight-card insight-card--${insight.type}`;
    card.style.animationDelay = `${idx * 0.07}s`; // Hiệu ứng xuất hiện so le
    
    card.innerHTML = `
      <i class="ph-bold ${insight.icon} insight-card__icon"></i>
      <div class="insight-card__text">
        <p class="insight-card__title">${escHtml(insight.title)}</p>
        <p class="insight-card__desc">${escHtml(insight.desc)}</p>
      </div>`;
    grid.appendChild(card);
  });
}

// Sự kiện nút "Làm mới" Insights
const btnRefresh = document.getElementById("btnRefreshInsights");
if (btnRefresh) {
  btnRefresh.addEventListener("click", () => {
    // Gọi lại hàm render với dữ liệu stats hiện tại đang lưu trong state
    if (window.state && window.state.currentData) {
      renderInsights(window.state.currentData.stats);
      if (window.showToast) window.showToast("Insights đã được cập nhật!", "info");
    }
  });
}

/* ════════════════════════════════════════════════════
    K. PERIOD SWITCH + CHART TYPE TOGGLE (REAL DATA)
   ════════════════════════════════════════════════════ */

// 1. Chuyển đổi Tuần / Tháng
document.querySelectorAll(".period-tab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    state.period = btn.dataset.period; // Cập nhật trạng thái 'week' hoặc 'month'
    
    // Cập nhật giao diện nút
    document.querySelectorAll(".period-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // LƯU Ý: Khi đổi sang Tháng, bạn nên gọi lại API để lấy dữ liệu 30 ngày
    // Nếu chưa sửa Backend lấy 30 ngày, hàm này sẽ vẽ lại dữ liệu 7 ngày hiện có
    if (state.currentData) {
        buildProductivityChart(state.currentData.weekly_productivity);
    }
  });
});

// 2. Chuyển đổi Bar / Line
document.getElementById("chartBar")?.addEventListener("click", () => {
  state.chartType = "bar";
  updateToggleUI("chartBar", "chartLine");
  if (state.currentData) buildProductivityChart(state.currentData.weekly_productivity);
});

document.getElementById("chartLine")?.addEventListener("click", () => {
  state.chartType = "line";
  updateToggleUI("chartLine", "chartBar");
  if (state.currentData) buildProductivityChart(state.currentData.weekly_productivity);
});

// 3. Chuyển đổi Burndown Sprint / Month
document.getElementById("bdSprint")?.addEventListener("click", () => {
  state.bdPeriod = "sprint";
  updateToggleUI("bdSprint", "bdMonth");
  if (state.currentData) buildBurndownChart(state.currentData.burndown);
});

document.getElementById("bdMonth")?.addEventListener("click", () => {
  state.bdPeriod = "month";
  updateToggleUI("bdMonth", "bdSprint");
  if (state.currentData) buildBurndownChart(state.currentData.burndown);
});

// Hàm bổ trợ để cập nhật Class Active cho gọn code
function updateToggleUI(activeId, inactiveId) {
    document.getElementById(activeId)?.classList.add("active");
    document.getElementById(inactiveId)?.classList.remove("active");
}

document.getElementById("calPrev")?.addEventListener("click", () => {
  state.calDate.setMonth(state.calDate.getMonth() - 1);
  initDashboard(); // Tải lại dữ liệu cho tháng trước đó
});

document.getElementById("calNext")?.addEventListener("click", () => {
  state.calDate.setMonth(state.calDate.getMonth() + 1);
  initDashboard(); // Tải lại dữ liệu cho tháng kế tiếp
});

/* ════════════════════════════════════════════════════
   THEME: Vẽ lại toàn bộ biểu đồ khi đổi giao diện (REAL DATA)
   ════════════════════════════════════════════════════ */
function updateAllChartsTheme() {
  // Kiểm tra xem đã có dữ liệu từ Database chưa
  if (!state.currentData) return;

  // Lấy dữ liệu đã lưu trong state để vẽ lại
  const { weekly_productivity, burndown, category_distribution } = state.currentData;

  // Gọi lại các hàm vẽ với dữ liệu thật
  buildProductivityChart(weekly_productivity);
  buildBurndownChart(burndown);
  buildDonutChart(category_distribution);
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
   UTILITY (Bổ sung hàm bị thiếu)
   ════════════════════════════════════════════════════ */
function animateCount(id, from, to, duration, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const run = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // Hiệu ứng Out-Cubic mượt mà
    el.textContent = Math.round(from + (to - from) * ease) + suffix;
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}
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
   M. INIT — KHỞI CHẠY HỆ THỐNG (BẢN DỮ LIỆU THẬT)
   ════════════════════════════════════════════════════ */

async function initDashboard() {
  // 1. Lấy ID board từ URL nếu người dùng đang xem board cụ thể
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get('board');
  
  // URL khớp với cấu trúc trong urls.py của bạn
  let apiUrl = boardId ? `/charts/api/boards/${boardId}/` : "/charts/api/dashboard/";

  try {
    // 2. Gọi API để lấy dữ liệu từ Database
    const response = await fetch(apiUrl, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (!response.ok) throw new Error("Lỗi kết nối server");
    
    const data = await response.json();
    state.currentData = data; // Lưu dữ liệu vào state để dùng cho đổi Theme/Period

    // 3. Render các thành phần giao diện tĩnh
    document.querySelector(".page-title").textContent = data.board_name;
    renderKPI(data.stats);
    renderProgressList(data.board_progress);
    renderCalendar(data.calendar_data);
    renderInsights(data.stats); // Truyền stats vào để lọc lời khuyên thông minh

    // 4. Vẽ các biểu đồ (Vẽ sau một chút để đảm bảo UI mượt mà)
    setTimeout(() => {
      buildProductivityChart(data.weekly_productivity);
      buildBurndownChart(data.burndown);
      buildDonutChart(data.category_distribution);
    }, 150);

    // 5. Cập nhật Badge số lượng Board ở Sidebar từ dữ liệu thật
    const badgeAll = document.getElementById("badgeAll");
    if (badgeAll) {
      badgeAll.textContent = data.stats.total_boards || "0";
    }

    // 6. Thông báo chào mừng (Lấy tên thật từ window.TasklyConfig)
    if (!sessionStorage.getItem("dash-greeted")) {
      sessionStorage.setItem("dash-greeted", "1");
      const username = window.TasklyConfig ? window.TasklyConfig.username : "bạn";
      setTimeout(() => {
        showToast(`Xin chào ${username}! Dashboard đã sẵn sàng 📊`, "success");
      }, 700);
    }

  } catch (error) {
    console.error("Init Error:", error);
    showToast("Không thể tải dữ liệu phân tích từ database!", "error");
  }
}

// Thay thế IIFE cũ bằng sự kiện DOMContentLoaded để đảm bảo an toàn
document.addEventListener("DOMContentLoaded", initDashboard);
