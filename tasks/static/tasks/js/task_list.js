/**
 * task.js — Taskly Task Management Page
 * ══════════════════════════════════════════════════════════
 *
 * Architecture: LocalStorage per-board task store
 * ─────────────────────────────────────────────────────────
 * Tasks are stored as: localStorage['taskly-tasks-{boardId}']
 * Boards are read from: localStorage['taskly-boards-db']
 *
 * Sections:
 *  A. Config & state
 *  B. Storage helpers (TaskDB)
 *  C. Toast & utils
 *  D. Theme & user
 *  E. Sidebar & header
 *  F. Board info loader
 *  G. Render engine (cards / list / kanban)
 *  H. Task card builder
 *  I. Task detail drawer
 *  J. Create / Edit modal
 *  K. Context menu
 *  L. Checkbox quick-toggle
 *  M. Drag & drop
 *  N. Search / filter / sort
 *  O. Keyboard shortcuts
 *  P. Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & STATE
   ════════════════════════════════════════════════════ */

const API_BASE = "/api";

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

function authHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),
    ...extra,
  };
}

const LS = {
  THEME: "taskly-theme",
  USERNAME: "taskly-username",
  BOARDS: "taskly-boards-db",
  TASKS: (boardId) => `taskly-tasks-${boardId}`,
};

// Lấy ID từ Django thay vì lấy từ URL
const BOARD_ID =
  typeof DJANGO_BOARD_ID !== "undefined" ? DJANGO_BOARD_ID : "default";

/** UI-only state */
const ui = {
  view: "cards", // cards | list | kanban
  sort: "created", // created | due_date | priority | title
  search: "",
  sidebarFilter: "all", // all | todo | in_progress | done | overdue | high | medium | low
  filterCategory: "",
  filterStatus: "",
  filterPriority: "",
  editingId: null, // task id being edited
  openDrawerId: null, // task id shown in drawer
  ctxTaskId: null, // task id for context menu
  boardColor: "#5b67f7",
  boardName: "Board",
  categories: [],
  tasks: []
};

function getColorCircle(hex) {
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
    return colorMap[hex] || '⚪';
}

/* ════════════════════════════════════════════════════
   B. TASK API — Giao tiếp với Django
   ════════════════════════════════════════════════════ */
const TaskAPI = {
  async get(id) {
    const res = await fetch(`${API_BASE}/tasks/${id}/`);
    if (!res.ok) throw new Error("Lỗi tải chi tiết task");
    return res.json();
  },

  async getAll(boardId) {
    const res = await fetch(`${API_BASE}/tasks/?board=${boardId}`);
    if (!res.ok) throw new Error("Lỗi tải tasks");
    return res.json();
  },
  async create(data) {
    // Ép kiểu dữ liệu để Django không bắt bẻ
    const payload = {
      ...data,
      board: BOARD_ID, // BOARD_ID lấy từ biến toàn cục đã có
    };

    const res = await fetch(`${API_BASE}/tasks/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorDetail = await res.json();
      console.error("Chi tiết lỗi từ Django:", errorDetail); // Xem lỗi ở tab Console F12
      throw new Error("Lỗi tạo task");
    }
    return res.json();
  },
  async update(id, data) {
    const res = await fetch(`${API_BASE}/tasks/${id}/`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async delete(id) {
    await fetch(`${API_BASE}/tasks/${id}/`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  },
};

/** Hàm Load dữ liệu từ server và vẽ lên màn hình */
async function fetchAndRenderTasks() {
  try {
    ui.tasks = await TaskAPI.getAll(BOARD_ID);
    renderTasks();
  } catch (err) {
    showToast("Không thể tải dữ liệu từ server", "error");
  }
}
/* ════════════════════════════════════════════════════
   B2. TASK DB BRIDGE (Cầu nối tương thích cho code cũ)
   ════════════════════════════════════════════════════ */
const TaskDB = {
  // Bất cứ hàm cũ nào gọi getAll(), ta trả về dữ liệu API đã tải
  getAll: () => ui.tasks || [],

  // Dành cho tính năng Kéo thả Kanban
  async update(id, data) {
    await TaskAPI.update(id, data);
    fetchAndRenderTasks();
  },

  // Dành cho nút "Nhân bản" ở menu 3 chấm
  async duplicate(id) {
    const src = ui.tasks.find((t) => t.id === id);
    if (!src) return;
    const copyData = {
      title: src.title + " (bản sao)",
      desc: src.desc,
      category: src.category,
      status: "todo",
      priority: src.priority,
      dueDate: src.dueDate,
      assignee: src.assignee,
    };
    await TaskAPI.create(copyData);
    showToast("Đã nhân bản task!", "success");
    await fetchAndRenderTasks();
  },

  // Phòng hờ các thao tác kéo thả vị trí thẻ (Tránh báo lỗi)
  save: () => {},

  // Phòng hờ nếu hàm xóa cũ chưa được cập nhật
  async delete(id) {
    await TaskAPI.delete(id);
    fetchAndRenderTasks();
  },
};

const CategoryAPI = {
  async getAll() {
    const res = await fetch(`${API_BASE}/categories/`);
    if (!res.ok) throw new Error("Lỗi tải danh mục");
    return res.json();
  }
};

async function fetchAndPopulateCategories() {
  try {
    const categories = await CategoryAPI.getAll();
    ui.categories = categories;

    const filterSelect = document.getElementById("filterCategory");
    const modalSelect = document.getElementById("taskCategory");

    if (filterSelect) {
      let filterHtml = '<option value="">Tất cả danh mục</option>';
      categories.forEach(cat => {
        filterHtml += `<option value="${cat.id}">${escHtml(cat.name)}</option>`;
      });
      filterSelect.innerHTML = filterHtml;
    }

    if (modalSelect) {
      let html = '<option value="" selected disabled>Chọn danh mục...</option>';
      
      html += categories.map(cat => {
        // Lấy hình tròn dựa trên mã màu từ DB
        const circle = getColorCircle(cat.color); 
        return `<option value="${cat.id}">${circle} ${escHtml(cat.name)}</option>`;
      }).join("");
      
      modalSelect.innerHTML = html;
    }
  } catch (err) {
    console.error("Lỗi khi đổ dữ liệu danh mục:", err);
    if (window.showToast) showToast("Không thể tải danh sách danh mục", "error");
  }
}

/* ════════════════════════════════════════════════════
   C. TOAST & UTILS
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
  _toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3800);
}

function escHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/** Format date string to DD/MM/YYYY */
function fmtDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns deadline status info for a task.
 * @returns {{ label, cls, icon, daysLeft }}
 */
function deadlineInfo(task) {
  if (!task.dueDate) return null;
  if (task.status === "done")
    return {
      label: "Hoàn thành",
      cls: "done",
      icon: "ph-check-circle",
      daysLeft: null,
    };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((due - today) / 86400000);

  if (daysLeft < 0)
    return {
      label: `Quá hạn ${Math.abs(daysLeft)} ngày`,
      cls: "overdue",
      icon: "ph-warning-circle",
      daysLeft,
    };
  if (daysLeft === 0)
    return {
      label: "Hết hạn hôm nay!",
      cls: "soon",
      icon: "ph-clock-countdown",
      daysLeft,
    };
  if (daysLeft <= 3)
    return {
      label: `Còn ${daysLeft} ngày`,
      cls: "soon",
      icon: "ph-clock",
      daysLeft,
    };
  return {
    label: `${fmtDate(task.dueDate)}`,
    cls: "ok",
    icon: "ph-calendar-blank",
    daysLeft,
  };
}

/* ════════════════════════════════════════════════════
   D. THEME & USER
   ════════════════════════════════════════════════════ */
const html = document.documentElement;

(function initTheme() {
  const saved = localStorage.getItem(LS.THEME);
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
  html.setAttribute("data-theme", saved ?? (sys ? "dark" : "light"));
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem(LS.THEME, next);
});

// (function loadUser() {
//   const username = localStorage.getItem(LS.USERNAME) || "user";
//   document.getElementById("userInitials").textContent = username
//     .substring(0, 2)
//     .toUpperCase();
//   document.getElementById("udName").textContent = username;
//   document.getElementById("udEmail").textContent = `${username}@taskly.vn`;
// })();

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
   Khởi tạo thông tin Header từ Profile API (Sửa lỗi)
   ════════════════════════════════════════════════════ */
async function initHeaderProfile() {
  try {
    // 1. Đường dẫn phải khớp với urls.py: /profile/api/me/
    const res = await fetch("/profile/api/me/"); 
    if (!res.ok) return;
    
    const data = await res.json();
    const profile = data.profile; // Lấy object profile từ response

    // 2. Cập nhật Text (Tên và Email)
    const udName = document.getElementById("udName");
    const udEmail = document.getElementById("udEmail");
    
    const displayName = profile.username || "Người dùng"; 
    const displayEmail = profile.email || "Chưa có email";

    // 3. Cập nhật Avatar (Ảnh hoặc Chữ cái đầu)
    const headerImg = document.getElementById("headerAvatarImg");
    const initials = document.getElementById("userInitials");

    if (profile.avatar_url && headerImg && initials) {
      headerImg.src = profile.avatar_url;
      headerImg.style.display = "block";
      initials.style.display = "none";
    } else if (initials) {
      headerImg.style.display = "none";
      initials.style.display = "block";
      const nameForInit = profile.full_name || profile.name || "User";
      initials.textContent = nameForInit.substring(0, 2).toUpperCase();
    }
  } catch (err) {
    console.error("Lỗi cập nhật header:", err);
  }
}

// Gọi hàm ngay khi load trang
document.addEventListener("DOMContentLoaded", initHeaderProfile);

/* ════════════════════════════════════════════════════
   E. SIDEBAR & HEADER
   ════════════════════════════════════════════════════ */
const sidebar = document.getElementById("sidebar");
const appLayout = document.getElementById("appLayout");
const overlay = document.getElementById("overlay");

// Toggle Sidebar (Desktop & Mobile)
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

// User dropdown logic
const userAvatarBtn = document.getElementById("userAvatarBtn");
const userDropdown = document.getElementById("userDropdown");
if (userAvatarBtn) {
  userAvatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("open");
  });
}
document.addEventListener("click", () => userDropdown.classList.remove("open"));

// Sidebar filter logic (All/Mine/Done...)
document.querySelectorAll(".sidebar__item[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".sidebar__item[data-view]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ui.sidebarFilter = btn.dataset.view;
    
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("show");
    renderTasks(); // Re-render dựa trên filter mới
  });
});

/**
 * Hàm phân quyền: Ẩn/Hiện nút dựa trên vai trò Owner/Member
 */
function applyPermissions(boardData) {
  const currentUser = window.TasklyConfig.username;
  const isOwner = boardData.owner === currentUser;

  console.log(`[Auth] User: ${currentUser} | Owner: ${boardData.owner} | isOwner: ${isOwner}`);

  // 1. Nút Thêm Task (Dùng flex để giữ layout icon + text)
  const addTaskBtn = document.getElementById("addNewTaskBtn");
  if (addTaskBtn) {
    addTaskBtn.style.display = isOwner ? "flex" : "none";
  }

  // 2. Nút Cài đặt Board
  const boardSettingsBtn = document.getElementById("boardSettingsBtn");
  if (boardSettingsBtn) {
    boardSettingsBtn.style.display = isOwner ? "block" : "none";
  }

  // 3. Nút Thêm thành viên
  const addMemberBtn = document.getElementById("addMemberBtn");
  if (addMemberBtn) {
    addMemberBtn.style.display = isOwner ? "block" : "none";
  }
}

/* ════════════════════════════════════════════════════
   F. BOARD INFO LOADER
   ════════════════════════════════════════════════════ */
async function loadBoardInfo() {
  try {
    // 1. Fetch dữ liệu thực từ API
    const response = await fetch(`${API_BASE}/boards/${BOARD_ID}/`, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });

    if (!response.ok) throw new Error("API response was not ok");
    const data = await response.json();

    // 2. Đồng bộ dữ liệu vào Object UI và tiêu đề
    ui.boardName = data.name;
    ui.boardColor = data.color || "#5b67f7";
    const desc = data.description || "Quản lý task cho board này";

    document.title = `${data.name} — Taskly`;
    document.getElementById("pageTitle").textContent = data.name;
    document.getElementById("pageSub").textContent = desc;
    document.getElementById("breadcrumbBoard").textContent = data.name;
    document.getElementById("boardDot").style.background = ui.boardColor;

    // 3. Cập nhật Sidebar Board Card
    const sidebarInfo = document.getElementById("sidebarBoardInfo");
    if (sidebarInfo) {
      sidebarInfo.innerHTML = `
        <div class="sidebar__board-card">
          <span class="sidebar__board-dot" style="background:${escHtml(ui.boardColor)}"></span>
          <span class="sidebar__board-name">${escHtml(data.name)}</span>
        </div>`;
    }

    // 4. KÍCH HOẠT PHÂN QUYỀN
    applyPermissions(data);

  } catch (err) {
    console.error("Lỗi nạp thông tin board:", err);
    
    // FALLBACK: Dùng dữ liệu nhúng từ Django Template nếu API lỗi
    const name = typeof DJANGO_BOARD_NAME !== "undefined" ? DJANGO_BOARD_NAME : `Board #${BOARD_ID}`;
    const color = typeof DJANGO_BOARD_COLOR !== "undefined" ? DJANGO_BOARD_COLOR : "#5b67f7";
    
    document.getElementById("pageTitle").textContent = name;
    document.getElementById("breadcrumbBoard").textContent = name;
    document.getElementById("boardDot").style.background = color;
  }
}

/* ════════════════════════════════════════════════════
   G. RENDER ENGINE
   ════════════════════════════════════════════════════ */
function renderTasks() {
  let tasks = [...ui.tasks];

  // ── Sidebar filter ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ui.sidebarFilter === "todo")
    tasks = tasks.filter((t) => t.status === "todo");
  else if (ui.sidebarFilter === "in_progress")
    tasks = tasks.filter((t) => t.status === "in_progress");
  else if (ui.sidebarFilter === "done")
    tasks = tasks.filter((t) => t.status === "done");
  else if (ui.sidebarFilter === "overdue")
    tasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "done",
    );
  else if (ui.sidebarFilter === "high")
    tasks = tasks.filter((t) => t.priority === "high");
  else if (ui.sidebarFilter === "medium")
    tasks = tasks.filter((t) => t.priority === "medium");
  else if (ui.sidebarFilter === "low")
    tasks = tasks.filter((t) => t.priority === "low");

  // ── Search ──
  if (ui.search.trim()) {
    const q = ui.search.trim().toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.desc || "").toLowerCase().includes(q),
    );
  }

  // ── Inline filters ──
  if (ui.filterCategory) {
    tasks = tasks.filter((t) => (t.categories || []).map(id => String(id)).includes(String(ui.filterCategory)));
  }
  if (ui.filterStatus)
    tasks = tasks.filter((t) => t.status === ui.filterStatus);
  if (ui.filterPriority)
    tasks = tasks.filter((t) => t.priority === ui.filterPriority);

  // ── Sort ──
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  tasks = [...tasks].sort((a, b) => {
    if (ui.sort === "due_date") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (ui.sort === "priority")
      return (
        (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
      );
    if (ui.sort === "title") return a.title.localeCompare(b.title, "vi");
    return b.createdAt - a.createdAt; // default: newest first
  });

  // ── Update sidebar badges ──
  updateBadges();

  // ── Update sidebar progress ──
  updateProgress();

  // ── Overdue banner ──
  updateOverdueBanner();

  // ── Render by view mode ──
  const taskGrid = document.getElementById("taskGrid");
  const kanbanBoard = document.getElementById("kanbanBoard");
  const emptyState = document.getElementById("emptyState");

  if (ui.view === "kanban") {
    taskGrid.style.display = "none";
    kanbanBoard.style.display = "";
    emptyState.style.display = "none";
    renderKanban();
    return;
  }

  kanbanBoard.style.display = "none";

  if (!tasks.length) {
    taskGrid.innerHTML = "";
    emptyState.style.display = "";
    // Contextual empty message
    if (
      ui.search ||
      ui.filterCategory ||
      ui.filterStatus ||
      ui.filterPriority
    ) {
      document.getElementById("emptyTitle").textContent =
        "Không tìm thấy task nào";
      document.getElementById("emptyDesc").textContent =
        "Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm.";
    } else {
      document.getElementById("emptyTitle").textContent = "Chưa có task nào";
      document.getElementById("emptyDesc").textContent =
        "Bắt đầu bằng cách tạo task đầu tiên cho board này.";
    }
    return;
  }

  emptyState.style.display = "none";
  taskGrid.className = `task-grid${ui.view === "list" ? " list-view" : ""}`;
  taskGrid.innerHTML = "";
  taskGrid.style.display = "";

  tasks.forEach((task, idx) => {
    const card = buildTaskCard(task, idx);
    taskGrid.appendChild(card);
  });

  attachCardDrag();
}

function updateBadges() {
  const all = TaskDB.getAll();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  document.getElementById("badgeAll").textContent = all.length;
  document.getElementById("badgeTodo").textContent = all.filter(
    (t) => t.status === "todo",
  ).length;
  document.getElementById("badgeProgress").textContent = all.filter(
    (t) => t.status === "in_progress",
  ).length;
  document.getElementById("badgeDone").textContent = all.filter(
    (t) => t.status === "done",
  ).length;
  const overdueCount = all.filter(
    (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "done",
  ).length;
  document.getElementById("badgeOverdue").textContent = overdueCount;
}

function updateProgress() {
  const all = ui.task || [];
  const done = all.filter((t) => t.status === "done").length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  document.getElementById("progressPct").textContent = `${pct}%`;
  document.getElementById("progressBar").style.width = `${pct}%`;
}

function updateOverdueBanner() {
  const existing = document.querySelector(".overdue-banner");
  if (existing) existing.remove();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = TaskDB.getAll().filter(
    (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "done",
  ).length;

  if (count === 0) return;
  const banner = document.createElement("div");
  banner.className = "overdue-banner";
  banner.innerHTML = `<i class="ph-bold ph-warning-circle"></i>
    Có <strong>${count} task quá hạn</strong> cần xử lý!
    <button class="btn btn--ghost" style="margin-left:auto;padding:4px 10px;font-size:.78rem"
      onclick="quickFilterOverdue()">Xem ngay</button>`;
  document
    .getElementById("main")
    .insertBefore(banner, document.getElementById("filterBar").nextSibling);
}
window.quickFilterOverdue = () => {
  document
    .querySelectorAll(".sidebar__item[data-view]")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector('.sidebar__item[data-view="overdue"]')
    ?.classList.add("active");
  ui.sidebarFilter = "overdue";
  renderTasks();
};

/* ════════════════════════════════════════════════════
   H. TASK CARD BUILDER
   ════════════════════════════════════════════════════ */
const PRIORITY_LABELS = { high: "Cao", medium: "Trung bình", low: "Thấp" };
const STATUS_LABELS = {
  todo: "Cần làm",
  in_progress: "Đang làm",
  done: "Hoàn thành",
};

function buildTaskCard(task, idx) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < today && task.status !== "done";
  const isDone = task.status === "done";
  const dl = deadlineInfo(task);

  const card = document.createElement("div");
  card.className = `task-card${isDone ? " done-card" : ""}${isOverdue ? " overdue-card" : ""}`;

  // LUÔN DÙNG ID TỪ DATABASE
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  card.draggable = true;
  card.style.animationDelay = `${Math.min(idx * 0.035, 0.4)}s`;

  // ══════════════════════════════════════════════════════════
  // FIX: Xử lý hiển thị Category cho quan hệ ManyToMany
  // ══════════════════════════════════════════════════════════
  const categoryHtml = (Array.isArray(task.categories) ? task.categories : [])
    .map(catId => {
      const found = (ui.categories || []).find(c => c.id == catId);
      if (!found) return ""; 

      const bgColor = found.color || 'var(--accent-light)';
      return `<span class="category-tag" style="background: ${bgColor}">${escHtml(found.name)}</span>`;
    })
    .join("");

  card.innerHTML = `
    <div class="task-card__actions">
      <button class="task-action-btn" data-action="edit" title="Chỉnh sửa">
        <i class="ph-bold ph-pencil-simple"></i>
      </button>
      <button class="task-action-btn task-action-btn--danger" data-action="delete" title="Xóa">
        <i class="ph-bold ph-trash"></i>
      </button>
    </div>

    <div class="task-card__top">
      <div class="task-checkbox${isDone ? " checked" : ""}" data-id="${escHtml(task.id)}" role="checkbox"
        aria-checked="${isDone}" tabindex="0">
        ${isDone ? '<i class="ph-bold ph-check"></i>' : ""}
      </div>
      <p class="task-card__title">${escHtml(task.title)}</p>
      <button class="task-card__menu" data-id="${escHtml(task.id)}">
        <i class="ph-bold ph-dots-three-vertical"></i>
      </button>
    </div>

    ${task.desc ? `<p class="task-card__desc">${escHtml(task.desc)}</p>` : ""}

    <div class="task-card__meta">
      <span class="priority-badge priority-badge--${escHtml(task.priority)}">
        ${task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢"}
        ${escHtml(PRIORITY_LABELS[task.priority] || task.priority)}
      </span>
      <span class="status-badge status-badge--${escHtml(task.status)}">
        ${task.status === "done" ? "✅" : task.status === "in_progress" ? "🔵" : "⬜"}
        ${escHtml(STATUS_LABELS[task.status] || task.status)}
      </span>
      ${categoryHtml} 
    </div>

    <div class="task-card__footer">
      <div class="task-card__assignee">
        ${
          task.assignee
            ? `<span class="assignee-av">${escHtml(task.assignee.substring(0, 2).toUpperCase())}</span>
               <span>${escHtml(task.assignee)}</span>`
            : `<span style="color:var(--text-light);font-size:.75rem">Chưa giao</span>`
        }
      </div>
      ${
        dl
          ? `
        <div class="task-card__due ${dl.cls === "overdue" ? "overdue" : dl.cls === "soon" ? "due-soon" : ""}">
          <i class="ph-bold ${dl.icon}"></i>
          <span>${escHtml(dl.label)}</span>
        </div>`
          : ""
      }
    </div>`;

  // ── Events (Sử dụng task.id chuẩn từ Database) ──
  card.addEventListener("click", (e) => {
    if (
      e.target.closest(".task-checkbox") ||
      e.target.closest(".task-card__menu") ||
      e.target.closest(".task-card__actions")
    )
      return;
    openDrawer(task.id);
  });

  card.querySelector(".task-checkbox").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDone(task.id);
  });

  card.querySelector(".task-card__menu").addEventListener("click", (e) => {
    e.stopPropagation();
    openContextMenu(e, task.id);
  });

  card.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openModal(task.id);
  });

  card
    .querySelector('[data-action="delete"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDelete(task.id);
    });

  return card;
}
/* ════════════════════════════════════════════════════
   I. TASK DETAIL DRAWER
   ════════════════════════════════════════════════════ */
const drawerBackdrop = document.getElementById("drawerBackdrop");
const drawer = document.getElementById("drawer");

async function openDrawer(taskId) {
  try {
    // 1. Lưu ID đang mở để các nút Sửa/Xóa hoạt động
    ui.openDrawerId = taskId;

    // 2. Gọi API lấy chi tiết
    const task = await TaskAPI.get(taskId);
    console.log("Dữ liệu Task nhận được:", task); // Debug để kiểm tra dữ liệu

    if (!task) return;

    const drawerBody = document.getElementById("drawerBody");
    
    // 3. Xử lý hiển thị danh mục (Dùng 'categories' vì to_representation đã đổi tên)
    const categoriesData = task.categories || task.category || [];
    const categoriesHtml = (Array.isArray(categoriesData) ? categoriesData : [])
      .map(id => {
        const found = (ui.categories || []).find(c => c.id == id);
        return found 
          ? `<span class="category-tag" style="background:${found.color || 'var(--accent-light)'}">${escHtml(found.name)}</span>`
          : "";
      })
      .join(" ");

    // 4. Đổ dữ liệu vào HTML (Sử dụng tên trường khớp với Serializer)
    drawerBody.innerHTML = `
      <div class="drawer-header-info">
        <h2 class="drawer-title">${escHtml(task.title || "Không có tiêu đề")}</h2>
      </div>

      <div class="drawer-section">
        <p class="drawer-section__label">Mô tả</p>
        <p class="drawer-section__value">${escHtml(task.desc || "Không có mô tả")}</p>
      </div>

      <div class="drawer-grid">
        <div class="drawer-section">
          <p class="drawer-section__label">Trạng thái</p>
          <span class="status-badge status-badge--${task.status}">
            ${(typeof STATUS_LABELS !== 'undefined' ? STATUS_LABELS[task.status] : task.status) || "N/A"}
          </span>
        </div>
        <div class="drawer-section">
          <p class="drawer-section__label">Ưu tiên</p>
          <span class="priority-badge priority-badge--${task.priority}">
            ${(typeof PRIORITY_LABELS !== 'undefined' ? PRIORITY_LABELS[task.priority] : task.priority) || "N/A"}
          </span>
        </div>
      </div>

      <div class="drawer-section">
        <p class="drawer-section__label">Danh mục</p>
        <div class="drawer-categories">
          ${categoriesHtml || '<span style="color:var(--text-light)">Chưa phân loại</span>'}
        </div>
      </div>

      <div class="drawer-section">
        <p class="drawer-section__label">Hạn chót</p>
        <p class="drawer-section__value">
          <i class="ph-bold ph-calendar"></i> 
          ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : "Không có"}
        </p>
      </div>

      <div class="drawer-section">
        <p class="drawer-section__label">Người thực hiện</p>
        <div class="drawer-assignee">
          <div class="assignee-av">${escHtml((task.assignee || "??").substring(0, 2).toUpperCase())}</div>
          <span>${escHtml(task.assignee || "Chưa giao")}</span>
        </div>
      </div>
    `;

    // 5. Hiển thị Drawer (Sửa ID cho khớp với HTML)
    const drawerEl = document.getElementById("drawer");
    const backdropEl = document.getElementById("drawerBackdrop");

    if (drawerEl) drawerEl.classList.add("open");
    if (backdropEl) backdropEl.classList.add("open");

  } catch (err) {
    console.error("Lỗi chi tiết Drawer:", err);
    showToast("Không thể tải chi tiết công việc", "error");
  }
}

function closeDrawer() {
  drawerBackdrop.classList.remove("open");
  drawerBackdrop.setAttribute("aria-hidden", "true");
  ui.openDrawerId = null;
}

document.getElementById("drawerClose").addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", (e) => {
  if (e.target === drawerBackdrop) closeDrawer();
});
drawer.addEventListener("click", (e) => e.stopPropagation());

document.getElementById("drawerEdit").addEventListener("click", () => {
  const id = ui.openDrawerId;
  closeDrawer();
  if (id) openModal(id);
});
document.getElementById("drawerDelete").addEventListener("click", () => {
  const id = ui.openDrawerId;
  closeDrawer();
  if (id) confirmDelete(id);
});

/* ════════════════════════════════════════════════════
   J. CREATE / EDIT MODAL
   ════════════════════════════════════════════════════ */
const modalBackdrop = document.getElementById("modalBackdrop");
const modalEl = document.getElementById("modal");
const modalTitleEl = document.getElementById("modalTitle");
const modalSubmit = document.getElementById("modalSubmit");
const taskTitleInput = document.getElementById("taskTitle");
const taskTitleErr = document.getElementById("taskTitleErr");
const taskTitleCount = document.getElementById("taskTitleCount");

function openModal(editId = null, prefillStatus = null) {
  ui.editingId = editId;
  const task = editId ? TaskDB.getAll().find((t) => t.id === editId) : null;

  // Populate form
  taskTitleInput.value = task?.title || "";
  document.getElementById("taskDesc").value = task?.desc || "";
  document.getElementById("taskCategory").value = task?.category || "other";
  document.getElementById("taskStatus").value =
    task?.status || prefillStatus || "todo";
  document.getElementById("taskPriority").value = task?.priority || "medium";
  document.getElementById("taskDueDate").value = task?.dueDate || "";
  document.getElementById("taskAssignee").value = task?.assignee || "";

  taskTitleErr.textContent = "";
  taskTitleInput.classList.remove("error");
  updateTitleCount();

  modalTitleEl.textContent = editId ? "Chỉnh sửa Task" : "Tạo Task mới";
  modalSubmit.innerHTML = editId
    ? '<i class="ph-bold ph-floppy-disk"></i> Lưu thay đổi'
    : '<i class="ph-bold ph-rocket-launch"></i> Tạo Task';

  modalBackdrop.classList.add("open");
  setTimeout(() => taskTitleInput.focus(), 80);
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  ui.editingId = null;
}

// Prevent bubble
modalEl.addEventListener("click", (e) => e.stopPropagation());
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

// Open triggers
["btnCreateTask", "fab", "emptyCreateBtn"].forEach((id) => {
  document.getElementById(id)?.addEventListener("click", () => openModal());
});
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalCancel").addEventListener("click", closeModal);

// Kanban "Add task" buttons
document.querySelectorAll(".kanban-add-btn").forEach((btn) => {
  btn.addEventListener("click", () => openModal(null, btn.dataset.status));
});

// Title validation
taskTitleInput.addEventListener("input", () => {
  updateTitleCount();
  validateTitle(false);
});
taskTitleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    modalSubmit.click();
  }
});

function updateTitleCount() {
  taskTitleCount.textContent = `${taskTitleInput.value.length} / 100`;
}
function validateTitle(force = true) {
  const val = taskTitleInput.value.trim();
  taskTitleErr.textContent = "";
  taskTitleInput.classList.remove("error");
  if (!val) {
    if (force) {
      taskTitleErr.textContent = "Tiêu đề không được để trống.";
      taskTitleInput.classList.add("error");
    }
    return false;
  }
  if (val.length > 100) {
    taskTitleErr.textContent = "Tiêu đề tối đa 100 ký tự.";
    taskTitleInput.classList.add("error");
    return false;
  }
  return true;
}

// Submit
modalSubmit.addEventListener("click", async () => {
  if (!validateTitle(true)) {
    taskTitleInput.focus();
    return;
  }

  const categorySelect = document.getElementById("taskCategory");
  const selectedCategories = categorySelect.value ? [categorySelect.value] : [];

  const data = {
    title: taskTitleInput.value.trim(),
    desc: document.getElementById("taskDesc").value.trim(),
    category: selectedCategories,
    status: document.getElementById("taskStatus").value,
    priority: document.getElementById("taskPriority").value,
    dueDate: document.getElementById("taskDueDate").value,
    assignee: document.getElementById("taskAssignee").value.trim(),
  };

  try {
    if (ui.editingId) {
      await TaskAPI.update(ui.editingId, data);
      showToast("Cập nhật thành công!", "success");
    } else {
      await TaskAPI.create(data);
      showToast("Tạo task thành công!", "success");
    }
    closeModal();
    await fetchAndRenderTasks();
  } catch {
    showToast("Có lỗi xảy ra khi lưu", "error");
  }
});

/* ════════════════════════════════════════════════════
   K. CONTEXT MENU
   ════════════════════════════════════════════════════ */
const contextMenu = document.getElementById("contextMenu");

function openContextMenu(e, taskId) {
  closeContextMenu();
  ui.ctxTaskId = taskId;

  const task = TaskDB.getAll().find((t) => t.id === taskId);
  if (!task) return;

  // Update "done" label
  document.getElementById("ctxDone").innerHTML =
    task.status === "done"
      ? '<i class="ph-bold ph-circle-dashed"></i> Đánh dấu chưa xong'
      : '<i class="ph-bold ph-check-circle"></i> Đánh dấu xong';

  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - 200);
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add("open");
}
function closeContextMenu() {
  contextMenu.classList.remove("open");
  ui.ctxTaskId = null;
}

contextMenu.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => closeContextMenu());

document.getElementById("ctxEdit").addEventListener("click", () => {
  const id = ui.ctxTaskId;
  closeContextMenu();
  if (id) openModal(id);
});
document.getElementById("ctxDone").addEventListener("click", () => {
  const id = ui.ctxTaskId;
  closeContextMenu();
  if (id) toggleDone(id);
});
document.getElementById("ctxDuplicate").addEventListener("click", () => {
  const id = ui.ctxTaskId;
  closeContextMenu();
  if (!id) return;
  const copy = TaskDB.duplicate(id);
  if (copy) {
    showToast(`"${copy.title}" đã được nhân bản!`, "info");
    renderTasks();
  }
});
document.getElementById("ctxDelete").addEventListener("click", () => {
  const id = ui.ctxTaskId;
  closeContextMenu();
  if (id) confirmDelete(id);
});

/* ════════════════════════════════════════════════════
   L. CHECKBOX QUICK-TOGGLE
   ════════════════════════════════════════════════════ */
async function toggleDone(taskId) {
  // 1. Tìm task trong bộ nhớ local (ui.tasks) để lấy trạng thái hiện tại
  const task = ui.tasks.find((t) => t.id === taskId);
  if (!task) return;

  // 2. Đảo ngược trạng thái
  const newStatus = task.status === "done" ? "todo" : "done";

  try {
    // 3. Gọi API Update của Django
    await TaskAPI.update(taskId, { status: newStatus });

    showToast(newStatus === "done" ? "✅ Đã xong!" : "🔄 Đã mở lại", "info");

    // 4. Quan trọng: Tải lại dữ liệu mới nhất từ Server để vẽ lại giao diện
    await fetchAndRenderTasks();
  } catch (err) {
    showToast("Không thể cập nhật trạng thái", "error");
  }
}

async function confirmDelete(taskId) {
  const task = ui.tasks.find((t) => t.id === taskId);
  if (!task || !confirm(`Xóa task "${task.title}"?`)) return;

  try {
    // Gọi API Delete của Django
    await TaskAPI.delete(taskId);

    showToast("Đã xóa task thành công", "error");

    // Đóng drawer nếu đang mở đúng task đó
    if (ui.openDrawerId === taskId) closeDrawer();

    // Tải lại danh sách
    await fetchAndRenderTasks();
  } catch (err) {
    showToast("Lỗi khi xóa task", "error");
  }
}

/* ════════════════════════════════════════════════════
   M. DRAG & DROP (cards view)
   ════════════════════════════════════════════════════ */
let _dragId = null;

function attachCardDrag() {
  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      _dragId = card.dataset.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () =>
      card.classList.remove("drag-over"),
    );
    card.addEventListener("dragend", () =>
      card.classList.remove("dragging", "drag-over"),
    );
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const dropId = card.dataset.id;
      if (!_dragId || _dragId === dropId) return;

      const tasks = TaskDB.getAll();
      const srcIdx = tasks.findIndex((t) => t.id === _dragId);
      const dropIdx = tasks.findIndex((t) => t.id === dropId);
      if (srcIdx === -1 || dropIdx === -1) return;
      const [moved] = tasks.splice(srcIdx, 1);
      tasks.splice(dropIdx, 0, moved);
      TaskDB.save(tasks);
      renderTasks();
    });
  });
}

/* ─── Kanban drag & drop ─────────────────────────────────────── */
function renderKanban() {
  const all = TaskDB.getAll();
  const cols = {
    todo: document.getElementById("kBodyTodo"),
    in_progress: document.getElementById("kBodyProgress"),
    done: document.getElementById("kBodyDone"),
  };
  const counts = {
    todo: document.getElementById("kColTodo"),
    in_progress: document.getElementById("kColProgress"),
    done: document.getElementById("kColDone"),
  };

  Object.entries(cols).forEach(([status, body]) => {
    body.innerHTML = "";
    const tasks = all.filter((t) => t.status === status);
    counts[status].textContent = tasks.length;
    tasks.forEach((task, idx) => {
      const card = buildTaskCard(task, idx);
      card.draggable = true;
      body.appendChild(card);
    });
  });

  // Kanban column drop zones
  document.querySelectorAll(".kanban-col").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      if (!_dragId) return;
      const newStatus = col.dataset.status;
      TaskDB.update(_dragId, { status: newStatus });
      showToast(
        `Task đã chuyển sang "${STATUS_LABELS[newStatus] || newStatus}".`,
        "info",
      );
      renderTasks();
    });
  });

  attachCardDrag();
}

/* ════════════════════════════════════════════════════
   N. SEARCH / FILTER / SORT
   ════════════════════════════════════════════════════ */

// Search (debounced)
let _searchTimer = null;
document.getElementById("searchInput").addEventListener("input", (e) => {
  ui.search = e.target.value;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(renderTasks, 250);
});

// Filter toggle
const filterBar = document.getElementById("filterBar");
const filterDot = document.getElementById("filterDot");
const filterChipsEl = document.getElementById("filterChips");

document.getElementById("filterToggleBtn").addEventListener("click", () => {
  const showing = filterBar.style.display !== "none";
  filterBar.style.display = showing ? "none" : "";
});

function updateFilterDot() {
  const active = ui.filterCategory || ui.filterStatus || ui.filterPriority;
  filterDot.style.display = active ? "block" : "none";
  renderFilterChips();
}
function renderFilterChips() {
  const chips = [];
  const CAT = {
    design: "Design",
    development: "Dev",
    marketing: "Marketing",
    research: "Research",
    other: "Khác",
  };
  const STA = { todo: "Cần làm", in_progress: "Đang làm", done: "Hoàn thành" };
  const PRI = { high: "Cao", medium: "Trung bình", low: "Thấp" };

  if (ui.filterCategory)
    chips.push({
      key: "filterCategory",
      label: `📁 ${CAT[ui.filterCategory] || ui.filterCategory}`,
    });
  if (ui.filterStatus)
    chips.push({
      key: "filterStatus",
      label: `⚡ ${STA[ui.filterStatus] || ui.filterStatus}`,
    });
  if (ui.filterPriority)
    chips.push({
      key: "filterPriority",
      label: `🎯 ${PRI[ui.filterPriority] || ui.filterPriority}`,
    });

  filterChipsEl.innerHTML = chips
    .map(
      (c) => `
    <div class="filter-chip">
      ${escHtml(c.label)}
      <span class="filter-chip__x" data-key="${c.key}" role="button" tabindex="0">×</span>
    </div>`,
    )
    .join("");

  filterChipsEl.querySelectorAll(".filter-chip__x").forEach((x) => {
    x.addEventListener("click", () => {
      ui[x.dataset.key] = "";
      document.getElementById(x.dataset.key).value = "";
      updateFilterDot();
      renderTasks();
    });
  });
}

document.getElementById("filterCategory").addEventListener("change", (e) => {
  ui.filterCategory = e.target.value;
  updateFilterDot();
  renderTasks();
});
document.getElementById("filterStatus").addEventListener("change", (e) => {
  ui.filterStatus = e.target.value;
  updateFilterDot();
  renderTasks();
});
document.getElementById("filterPriority").addEventListener("change", (e) => {
  ui.filterPriority = e.target.value;
  updateFilterDot();
  renderTasks();
});

document.getElementById("filterClear").addEventListener("click", () => {
  ui.filterCategory = ui.filterStatus = ui.filterPriority = "";
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterPriority").value = "";
  updateFilterDot();
  renderTasks();
});

// Sort dropdown
const sortBtn = document.getElementById("sortBtn");
const sortDropdown = document.getElementById("sortDropdown");
sortBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  sortDropdown.classList.toggle("open");
});
document.querySelectorAll(".sort-item").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.sort = btn.dataset.sort;
    document
      .querySelectorAll(".sort-item")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    sortDropdown.classList.remove("open");
    sortBtn.querySelector(".sort-label").textContent = btn.textContent.trim();
    renderTasks();
  });
});
document.addEventListener("click", () => sortDropdown.classList.remove("open"));

// View mode toggles
document.getElementById("viewCards").addEventListener("click", () => {
  ui.view = "cards";
  ["viewCards", "viewList", "viewKanban"].forEach((id) =>
    document.getElementById(id).classList.remove("active"),
  );
  document.getElementById("viewCards").classList.add("active");
  renderTasks();
});
document.getElementById("viewList").addEventListener("click", () => {
  ui.view = "list";
  ["viewCards", "viewList", "viewKanban"].forEach((id) =>
    document.getElementById(id).classList.remove("active"),
  );
  document.getElementById("viewList").classList.add("active");
  renderTasks();
});
document.getElementById("viewKanban").addEventListener("click", () => {
  ui.view = "kanban";
  ["viewCards", "viewList", "viewKanban"].forEach((id) =>
    document.getElementById(id).classList.remove("active"),
  );
  document.getElementById("viewKanban").classList.add("active");
  renderTasks();
});

/* ════════════════════════════════════════════════════
   O. KEYBOARD SHORTCUTS
   ════════════════════════════════════════════════════ */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeContextMenu();
    closeDrawer();
    sortDropdown.classList.remove("open");
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    if (!modalBackdrop.classList.contains("open")) openModal();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    const inp = document.getElementById("searchInput");
    inp.focus();
    inp.select();
  }
});

/* ════════════════════════════════════════════════════
   P. INIT
   ════════════════════════════════════════════════════ */
loadBoardInfo();
fetchAndPopulateCategories();
initHeaderProfile();
fetchAndRenderTasks().then(() => {
  // Greeting on first load
  if (!sessionStorage.getItem("taskly-task-greeted")) {
    sessionStorage.setItem("taskly-task-greeted", "1");
    setTimeout(
      () => showToast(`Board "${ui.boardName}" đã sẵn sàng! 🚀`, "success"),
      500,
    );
  }
});

// 3. Cập nhật lại thanh thời gian mỗi phút (không gọi lại server)
setInterval(() => {
  renderTasks();
}, 60000);
