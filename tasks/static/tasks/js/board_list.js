/**
 * board_list.js — Taskly Board List
 * ════════════════════════════════════════════════════════
 *
 * Architecture: Django REST API backend
 * ─────────────────────────────────────
 *  User Action
 *     │
 *     ▼
 *  UI Layer (events, modal, render)
 *     │  fetch() + JWT token
 *     ▼
 *  BoardAPI service (centralized HTTP calls)
 *     │  POST /api/boards/   GET /api/boards/  PATCH ...
 *     ▼
 *  Django REST Framework (views.py)
 *     │
 *     ▼
 *  Database (SQLite / PostgreSQL)
 *     │  saved!
 *     ▼
 *  Response JSON → UI re-render from DB data
 *
 * Sections:
 *  A.  Config & constants
 *  B.  Token / Auth helpers
 *  C.  BoardAPI — HTTP service layer (all fetch calls here)
 *  D.  Toast notifications
 *  E.  Theme & user info
 *  F.  Sidebar & header
 *  G.  Render engine
 *  H.  Modal (create / edit)
 *  I.  Context menu
 *  J.  Quick preview
 *  K.  Drag & drop
 *  L.  Search / sort / view / filter
 *  M.  Keyboard shortcuts
 *  N.  Init
 */

"use strict";

/* ════════════════════════════════════════════════════
   A. CONFIG & CONSTANTS
   ════════════════════════════════════════════════════ */

/** Base URL của Django backend — đổi khi deploy */
const API_BASE = "http://127.0.0.1:8000/api";

/** localStorage keys */
const LS = {
  ACCESS: "taskly-access-token",
  REFRESH: "taskly-refresh-token",
  USERNAME: "taskly-username",
  THEME: "taskly-theme",
};

/** UI-only state (không lưu vào DB) */
const ui = {
  filter: "all", // all | favorites | archived | personal | team
  sort: "updated", // updated | created | alpha | tasks
  search: "",
  view: "grid", // grid | list
  editingId: null, // UUID của board đang edit (null = tạo mới)
  selectedColor: "#5b67f7",
  selectedType: "personal",
  boards: [], // cache boards từ DB
  isLoading: false,
};

/* ════════════════════════════════════════════════════
   B. TOKEN / AUTH HELPERS
   ════════════════════════════════════════════════════ */

/** Lấy access token từ localStorage */
const getToken = () => localStorage.getItem(LS.ACCESS);

/** Lưu tokens sau khi login / refresh */
function saveTokens({ access, refresh }) {
  if (access) localStorage.setItem(LS.ACCESS, access);
  if (refresh) localStorage.setItem(LS.REFRESH, refresh);
}

/** Xóa tokens & chuyển về login */
function logout(reason = "") {
  localStorage.removeItem(LS.ACCESS);
  localStorage.removeItem(LS.REFRESH);
  if (reason) showToast(reason, "error");
  setTimeout(() => {
    window.location.href = "/";
  }, 1200);
}

/**
 * Cố gắng refresh access token bằng refresh token.
 * Trả về access token mới hoặc null nếu thất bại.
 */
async function refreshAccessToken() {
  const refresh = localStorage.getItem(LS.REFRESH);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access) {
      localStorage.setItem(LS.ACCESS, data.access);
      return data.access;
    }
  } catch {
    /* network error */
  }
  return null;
}

// Hàm đọc CSRF cookie do Django tạo ra
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

/** Headers chuẩn cho API gọi bằng Cookie/Session */
function authHeaders(extra = {}) {
  const csrftoken = getCookie("csrftoken");
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": csrftoken, // Gửi kèm token để Django không chặn request
    ...extra,
  };
}

/* ════════════════════════════════════════════════════
   C. BOARD API — HTTP SERVICE LAYER
   ════════════════════════════════════════════════════
   Tất cả fetch() calls đều nằm ở đây.
   UI code không bao giờ gọi fetch() trực tiếp.
   Swap URL này với production domain mà không cần
   thay đổi bất kỳ dòng UI code nào.
   ════════════════════════════════════════════════════ */
const BoardAPI = {
  /**
   * Wrapper fetch với tự động refresh token nếu 401.
   * @param {string} path   — e.g. '/boards/'
   * @param {Object} options — fetch options
   */
  async _fetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    options.headers = options.headers || authHeaders();

    let res = await fetch(url, options);

    // Access token hết hạn → thử refresh
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        logout("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        throw new Error("UNAUTHORIZED");
      }
      options.headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, options); // retry với token mới
    }

    // Parse JSON
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: "Server trả về dữ liệu không hợp lệ." };
    }

    if (!res.ok) {
      const msg = data?.error || data?.detail || `Lỗi ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  /**
   * GET /api/boards/
   * Lấy danh sách boards có filter & search.
   * @param {Object} params — { search, type, favorite, archived, ordering }
   */
  async getAll(params = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.type) qs.set("type", params.type);
    if (params.favorite) qs.set("favorite", "true");
    if (params.archived !== undefined)
      qs.set("archived", params.archived ? "true" : "false");
    if (params.ordering) qs.set("ordering", params.ordering);
    qs.set(
      "archived",
      params.archived === true
        ? "true"
        : params.archived === "all"
          ? "all"
          : "false",
    );

    const query = qs.toString() ? `?${qs.toString()}` : "";
    const data = await this._fetch(`/boards/${query}`);
    // DRF pagination: { count, results } hoặc array thẳng
    return Array.isArray(data) ? data : data.results || [];
  },

  /**
   * POST /api/boards/
   * Tạo board mới, lưu vào DB, trả về board vừa tạo.
   * @param {Object} payload — { name, desc, color, board_type }
   */
  async create(payload) {
    return this._fetch("/boards/", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    // Response: { message, board }
  },

  /**
   * PATCH /api/boards/{id}/
   * Cập nhật một phần board.
   * @param {string} id
   * @param {Object} payload
   */
  async update(id, payload) {
    return this._fetch(`/boards/${id}/`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    // Response: { message, board }
  },

  /**
   * DELETE /api/boards/{id}/
   * Xóa board khỏi DB.
   */
  async delete(id) {
    return this._fetch(`/boards/${id}/`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    // Response: { message }
  },

  /**
   * PATCH /api/boards/{id}/toggle_favorite/
   */
  async toggleFavorite(id) {
    return this._fetch(`/boards/${id}/toggle_favorite/`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    // Response: { message, is_favorite }
  },

  /**
   * PATCH /api/boards/{id}/toggle_archive/
   */
  async toggleArchive(id) {
    return this._fetch(`/boards/${id}/toggle_archive/`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    // Response: { message, is_archived }
  },

  /**
   * GET /api/boards/stats/
   * Lấy số liệu thống kê cho sidebar badges.
   */
  async getStats() {
    return this._fetch("/boards/stats/");
    // Response: { total, active, favorites, archived, personal, team }
  },
};

/* ════════════════════════════════════════════════════
   D. TOAST
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

/* ════════════════════════════════════════════════════
   E. THEME & USER INFO
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

(function loadUser() {
  const username = localStorage.getItem(LS.USERNAME) || "user";
  const initials = username.substring(0, 2).toUpperCase();
  document.getElementById("userInitials").textContent = initials;
  document.getElementById("udName").textContent = username;
  document.getElementById("udEmail").textContent = `${username}@taskly.vn`;
})();

document.getElementById("btnLogout").addEventListener("click", () => {
  logout("Đã đăng xuất thành công.");
});

/* ════════════════════════════════════════════════════
   F. SIDEBAR & HEADER
   ════════════════════════════════════════════════════ */
const sidebar = document.getElementById("sidebar");
const appLayout = document.getElementById("appLayout");
const overlay = document.getElementById("overlay");

// Collapse (desktop)
document.getElementById("sidebarCollapse").addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  appLayout.classList.toggle("collapsed");
});

// Mobile hamburger
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
  userDropdown.classList.toggle("open");
});
document.addEventListener("click", () => userDropdown.classList.remove("open"));

/* ════════════════════════════════════════════════════
   G. RENDER ENGINE
   ════════════════════════════════════════════════════ */
const boardGrid = document.getElementById("boardGrid");
const emptyState = document.getElementById("emptyState");

/** Loading skeleton */
function showSkeleton() {
  emptyState.style.display = "none";
  boardGrid.innerHTML = Array.from({ length: 6 })
    .map(
      () => `
    <div class="board-card skeleton-card">
      <div class="skel skel--band"></div>
      <div class="card-body">
        <div class="skel skel--title"></div>
        <div class="skel skel--line"></div>
        <div class="skel skel--line skel--short"></div>
        <div class="skel skel--bar"></div>
      </div>
    </div>`,
    )
    .join("");
}

/**
 * Lấy boards từ DB và render lại toàn bộ grid.
 * Đây là hàm DUY NHẤT cập nhật giao diện — luôn lấy từ DB.
 */
async function fetchAndRender() {
  if (ui.isLoading) return;
  ui.isLoading = true;
  showSkeleton();

  try {
    // Xây dựng params theo filter hiện tại
    const params = { search: ui.search };

    if (ui.filter === "favorites") {
      params.favorite = true;
    } else if (ui.filter === "archived") {
      params.archived = true;
    } else if (ui.filter === "personal") {
      params.type = "personal";
    } else if (ui.filter === "team") {
      params.type = "team";
    }
    // 'all' → không cần filter thêm

    // Mapping sort → Django ordering param
    const ORDERING = {
      updated: "-updated_at",
      created: "-created_at",
      alpha: "name",
      tasks: "-total_tasks", // cần annotate trong view nếu dùng
    };
    params.ordering = ORDERING[ui.sort] || "-updated_at";

    // ── Gọi API ───────────────────────────────────────────
    const [boards, stats] = await Promise.all([
      BoardAPI.getAll(params),
      BoardAPI.getStats(),
    ]);

    ui.boards = boards; // cache để dùng cho preview / drag

    // Cập nhật badge sidebar
    document.getElementById("badgeAll").textContent = stats.active ?? 0;
    document.getElementById("badgeFav").textContent = stats.favorites ?? 0;
    document.getElementById("badgeArchived").textContent = stats.archived ?? 0;

    // Sắp xếp client-side bổ sung (server đã sort, nhưng fallback)
    let sorted = [...boards];
    if (ui.sort === "alpha") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    renderGrid(sorted);
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") {
      showToast(err.message || "Không thể tải danh sách board.", "error");
    }
    boardGrid.innerHTML = "";
    emptyState.style.display = "";
  } finally {
    ui.isLoading = false;
  }
}

function renderGrid(boards) {
  boardGrid.innerHTML = "";

  if (!boards.length) {
    emptyState.style.display = "";
    return;
  }
  emptyState.style.display = "none";
  boardGrid.className = `board-grid${ui.view === "list" ? " list-view" : ""}`;

  boards.forEach((board, idx) => {
    boardGrid.appendChild(buildCard(board, idx));
  });
  attachDragEvents();
}

function buildCard(board, idx) {
  // Dữ liệu từ Django serializer
  const pct = board.completion_pct ?? 0;
  const total = board.total_tasks ?? 0;
  const done = board.done_tasks ?? 0;
  const color = board.color || "#5b67f7";
  const members = board.members || [];
  let dateStr = "";
  try {
    dateStr = new Date(board.updated_at).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    dateStr = "";
  }

  const card = document.createElement("div");
  card.className = "board-card";
  card.dataset.id = board.id; // UUID string
  card.draggable = true;
  card.style.animationDelay = `${Math.min(idx * 0.04, 0.4)}s`;

  card.innerHTML = `
    <div class="card-band" style="background:${escHtml(color)}"></div>
    <div class="card-body">
      <div class="card-top">
        <p class="card-name">${escHtml(board.name)}</p>
        <button class="card-menu-btn" aria-label="Menu board">
          <i class="ph-bold ph-dots-three-vertical"></i>
        </button>
      </div>
      <div class="card-badges">
        <span class="card-badge" style="background:${escHtml(color)}22;color:${escHtml(color)}">
          <span class="card-badge--color" style="background:${escHtml(color)}"></span>
          ${board.board_type === "team" ? "Nhóm" : "Cá nhân"}
        </span>
        ${board.is_favorite ? '<span class="card-badge card-badge--fav">⭐ Yêu thích</span>' : ""}
        ${board.is_archived ? '<span class="card-badge" style="color:var(--text-light)">🗄 Archived</span>' : ""}
      </div>
      <div class="card-progress">
        <div class="card-progress__info">
          <span>${done} / ${total} tasks</span>
          <span>${pct}%</span>
        </div>
        <div class="card-progress__bar">
          <div class="card-progress__fill" style="width:${pct}%;background:${escHtml(color)}"></div>
        </div>
      </div>
      <div class="card-footer">
        <div class="card-members">
          ${members
            .slice(0, 4)
            .map(
              (m) => `
            <span class="card-member-av"
              style="background:${m.avatar ? `url(${m.avatar})` : "linear-gradient(135deg,#5b67f7,#a78bfa)"}"
              title="${escHtml(m.username)}">
              ${escHtml(m.initials || m.username.substring(0, 2).toUpperCase())}
            </span>`,
            )
            .join("")}
        </div>
        <div class="card-date">
          <i class="ph-bold ph-clock"></i>${dateStr}
        </div>
      </div>
    </div>`;

  card.addEventListener("click", (e) => {
    if (e.target.closest(".card-menu-btn")) return;
    // Navigate to task management page for this board
    window.location.href = `/boards/${board.id}/tasks/`;
  });

  card.querySelector(".card-menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openContextMenu(e, board.id);
  });

  card.addEventListener("mouseenter", (e) => schedulePreview(e, board));
  card.addEventListener("mouseleave", cancelPreview);
  card.addEventListener("mousemove", updatePreviewPos);

  return card;
}

/* ════════════════════════════════════════════════════
   H. MODAL — CREATE / EDIT
   ════════════════════════════════════════════════════ */
const modalBackdrop = document.getElementById("modalBackdrop");
const modalEl = document.getElementById("modal");
const modalTitleEl = document.getElementById("modalTitle");
const modalSubmit = document.getElementById("modalSubmit");
const boardNameInput = document.getElementById("boardName");
const boardDescInput = document.getElementById("boardDesc");
const boardNameErr = document.getElementById("boardNameErr");
const boardNameCount = document.getElementById("boardNameCount");

// ════ THÊM MỚI: biến lưu thành viên ════
let boardMembers = [];
// ════════════════════════════════════════

function openModal(editId = null) {
  ui.editingId = editId;

  let board = null;
  if (editId) {
    board = ui.boards.find((b) => b.id === editId) || null;
  }

  // 1. NẠP LẠI THÀNH VIÊN TỪ DB NẾU ĐANG EDIT
  if (board && board.members && board.members.length > 0) {
    // Backend trả về mảng object [{username: 'a'}, ...], ta tách lấy mảng chữ
    boardMembers = board.members.map((m) => m.username);
  } else {
    // Nếu tạo mới hoặc board trống thì reset
    boardMembers = [];
  }

  // 2. RENDER VÀ CẬP NHẬT SỐ LƯỢNG VÀO BADGE
  renderMembers();
  const badge = document.getElementById("memberCountBadge");
  if (badge) badge.textContent = boardMembers.length; // Hiển thị số lượng

  // ... (Phần code set boardNameInput, boardDescInput, UI picker... giữ nguyên như cũ)
  boardNameInput.value = board ? board.name : "";
  boardDescInput.value = board ? board.desc || "" : "";
  boardNameErr.textContent = "";
  boardNameInput.classList.remove("error");
  updateNameCount();

  ui.selectedColor = board ? board.color : "#5b67f7";
  ui.selectedType = board ? board.board_type : "personal";
  syncColorPicker();
  syncTypePicker();

  modalTitleEl.textContent = editId ? "Chỉnh sửa Board" : "Tạo Board mới";
  modalSubmit.innerHTML = editId
    ? '<i class="ph-bold ph-floppy-disk"></i> Lưu thay đổi'
    : '<i class="ph-bold ph-rocket-launch"></i> Tạo Board';

  modalBackdrop.classList.add("open");
  setTimeout(() => boardNameInput.focus(), 80);
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  ui.editingId = null;
  setModalLoading(false);
}

// Stop bubble so backdrop's click handler won't fire
modalEl.addEventListener("click", (e) => e.stopPropagation());
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

["btnCreateDesktop", "fab", "emptyCreateBtn"].forEach((id) => {
  document.getElementById(id)?.addEventListener("click", () => openModal());
});
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalCancel").addEventListener("click", closeModal);

// Name character counter
boardNameInput.addEventListener("input", () => {
  updateNameCount();
  validateName(false);
});
boardNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    modalSubmit.click();
  }
});

function updateNameCount() {
  boardNameCount.textContent = `${boardNameInput.value.length} / 50`;
}

function validateName(mustShow = true) {
  const val = boardNameInput.value.trim();
  boardNameErr.textContent = "";
  boardNameInput.classList.remove("error");

  if (!val) {
    if (mustShow) {
      boardNameErr.textContent = "Tên board không được để trống.";
      boardNameInput.classList.add("error");
    }
    return false;
  }
  if (val.length > 50) {
    boardNameErr.textContent = "Tên board tối đa 50 ký tự.";
    boardNameInput.classList.add("error");
    return false;
  }
  return true;
}

/** Đặt trạng thái loading cho nút Submit */
function setModalLoading(on) {
  modalSubmit.disabled = on;
  modalSubmit.innerHTML = on
    ? '<span class="btn-spinner"></span> Đang lưu…'
    : ui.editingId
      ? '<i class="ph-bold ph-floppy-disk"></i> Lưu thay đổi'
      : '<i class="ph-bold ph-rocket-launch"></i> Tạo Board';
}

/**
 * Submit handler — luôn lưu vào DB trước, rồi mới render.
 *
 * Flow:
 *  1. Client validate tên (không để trống, max 50 ký tự)
 *  2. Gọi BoardAPI.create() hoặc .update()  → Django lưu DB
 *  3. Django validate thêm (duplicate, auth…)
 *  4. Nếu OK → fetchAndRender() lấy dữ liệu mới từ DB
 *  5. Nếu lỗi → hiện thông báo, KHÔNG render
 */
modalSubmit.addEventListener("click", async () => {
  if (!validateName(true)) {
    boardNameInput.focus();
    return;
  }

  setModalLoading(true);

  const payload = {
    name: boardNameInput.value.trim(),
    desc: boardDescInput.value.trim(),
    color: ui.selectedColor,
    board_type: ui.selectedType,
    // ════ THÊM MỚI: gửi danh sách thành viên lên server ════
    members: boardMembers,
    // ═══════════════════════════════════════════════════════
  };

  try {
    if (ui.editingId) {
      const res = await BoardAPI.update(ui.editingId, payload);
      showToast(res.message || `Board đã được cập nhật!`, "success");
    } else {
      const res = await BoardAPI.create(payload);
      showToast(res.message || `Board đã được tạo thành công! 🎉`, "success");
    }
    closeModal();
    await fetchAndRender();
  } catch (err) {
    const msg = err.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
    boardNameErr.textContent = msg;
    boardNameInput.classList.add("error");
    setModalLoading(false);
  }
});

// ════════════════════════════════════════════════════
// THÊM MỚI: Color picker + Type picker + Member input
// ════════════════════════════════════════════════════

// Color picker
function syncColorPicker() {
  document.querySelectorAll(".color-swatch").forEach((sw) => {
    sw.classList.toggle("active", sw.dataset.color === ui.selectedColor);
  });
}
document.getElementById("colorPicker").addEventListener("click", (e) => {
  const sw = e.target.closest(".color-swatch");
  if (!sw) return;
  ui.selectedColor = sw.dataset.color;
  syncColorPicker();
});

// Type picker — khi chọn "Nhóm" thì hiện ô nhập thành viên
function syncTypePicker() {
  document.querySelectorAll('input[name="boardType"]').forEach((r) => {
    r.checked = r.value === ui.selectedType;
  });
  // Đồng bộ hiển thị member section theo loại hiện tại
  toggleMemberSection(ui.selectedType === "team");
}

document.getElementById("typePicker").addEventListener("change", (e) => {
  if (e.target.type !== "radio") return;
  ui.selectedType = e.target.value;
  toggleMemberSection(e.target.value === "team");
});

// Hiện / ẩn phần thêm thành viên
function toggleMemberSection(show) {
  const section = document.getElementById("memberSection");
  if (!section) return;
  section.classList.toggle("open", show);

  // Khi ẩn → reset toàn bộ
  if (!show) {
    boardMembers = [];
    renderMembers();
    const input = document.getElementById("memberInput");
    if (input) input.value = "";
    const badge = document.getElementById("memberCountBadge");
    if (badge) badge.textContent = "0";
    const errEl = document.getElementById("memberInputErr");
    if (errEl) errEl.textContent = "";
  }
}

// Nút "+" và phím Enter để thêm thành viên
document.getElementById("btnAddMember")?.addEventListener("click", addMember);

document.getElementById("memberInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addMember();
  }
});

function addMember() {
  const input = document.getElementById("memberInput");
  const errEl = document.getElementById("memberInputErr");
  const val = (input?.value || "").trim();

  if (errEl) errEl.textContent = "";

  if (!val) {
    if (errEl) errEl.textContent = "Vui lòng nhập username.";
    return;
  }
  if (boardMembers.includes(val)) {
    if (errEl) errEl.textContent = `"${val}" đã được thêm rồi.`;
    return;
  }

  boardMembers.push(val);
  if (input) input.value = "";
  renderMembers();

  // Cập nhật badge + animation
  const badge = document.getElementById("memberCountBadge");
  if (badge) {
    badge.textContent = boardMembers.length;
    badge.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.4)" },
        { transform: "scale(1)" },
      ],
      { duration: 300 },
    );
  }
}

function removeMember(username) {
  boardMembers = boardMembers.filter((u) => u !== username);
  const badge = document.getElementById("memberCountBadge");
  if (badge) badge.textContent = boardMembers.length;
  renderMembers();
}
window.removeMember = removeMember; // cần expose vì gọi từ innerHTML

function renderMembers() {
  const list = document.getElementById("memberList");
  if (!list) return;
  list.innerHTML = "";

  boardMembers.forEach((username) => {
    const chip = document.createElement("div");
    chip.className = "member-chip";
    chip.innerHTML = `
      <span class="member-chip__av">
        ${username.substring(0, 2).toUpperCase()}
      </span>
      <span class="member-chip__name">@${username}</span>
      <span class="member-chip__role">Thành viên</span>
      <button class="member-chip__remove"
        onclick="removeMember('${username}')"
        title="Xóa ${username}">
        <i class="ph-bold ph-x"></i>
      </button>`;
    list.appendChild(chip);
  });
}

/* ════════════════════════════════════════════════════
   I. CONTEXT MENU
   ════════════════════════════════════════════════════ */
const contextMenu = document.getElementById("contextMenu");
let ctxBoardId = null;

function openContextMenu(e, boardId) {
  closeContextMenu();
  ctxBoardId = boardId;

  const board = ui.boards.find((b) => b.id === boardId);
  if (!board) return;

  document.getElementById("ctxFav").innerHTML = board.is_favorite
    ? '<i class="ph-bold ph-star-fill" style="color:var(--amber)"></i> Bỏ yêu thích'
    : '<i class="ph-bold ph-star"></i> Thêm yêu thích';

  document.getElementById("ctxArchive").innerHTML = board.is_archived
    ? '<i class="ph-bold ph-archive-tray"></i> Khôi phục'
    : '<i class="ph-bold ph-archive"></i> Lưu trữ';

  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - 260);
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add("open");
}

function closeContextMenu() {
  contextMenu.classList.remove("open");
  ctxBoardId = null;
}

contextMenu.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => closeContextMenu());

// Edit
document.getElementById("ctxEdit").addEventListener("click", () => {
  const id = ctxBoardId;
  closeContextMenu();
  if (id) openModal(id);
});

// Favorite — PATCH DB → render
document.getElementById("ctxFav").addEventListener("click", async () => {
  const id = ctxBoardId;
  closeContextMenu();
  if (!id) return;
  try {
    const res = await BoardAPI.toggleFavorite(id);
    showToast(res.message, "info");
    await fetchAndRender();
  } catch (err) {
    showToast(err.message || "Không thể cập nhật yêu thích.", "error");
  }
});

// Share
document.getElementById("ctxShare").addEventListener("click", () => {
  closeContextMenu();
  showToast("Link chia sẻ đã được sao chép!", "success");
});

// Archive — PATCH DB → render
document.getElementById("ctxArchive").addEventListener("click", async () => {
  const id = ctxBoardId;
  closeContextMenu();
  if (!id) return;
  try {
    const res = await BoardAPI.toggleArchive(id);
    showToast(res.message, "info");
    await fetchAndRender();
  } catch (err) {
    showToast(err.message || "Không thể cập nhật lưu trữ.", "error");
  }
});

// Delete — DELETE DB → render
document.getElementById("ctxDelete").addEventListener("click", async () => {
  const id = ctxBoardId;
  const board = ui.boards.find((b) => b.id === id);
  if (!board) {
    closeContextMenu();
    return;
  }
  const name = board.name;
  closeContextMenu();

  if (!confirm(`Xóa board "${name}"?\nHành động này không thể hoàn tác.`))
    return;

  try {
    const res = await BoardAPI.delete(id);
    showToast(res.message || `Board "${name}" đã bị xóa.`, "error");
    await fetchAndRender();
  } catch (err) {
    showToast(err.message || "Không thể xóa board.", "error");
  }
});

/* ════════════════════════════════════════════════════
   J. QUICK PREVIEW
   ════════════════════════════════════════════════════ */
const quickPreview = document.getElementById("quickPreview");
let _previewTimer = null;
let _previewX = 0,
  _previewY = 0;

function schedulePreview(e, board) {
  _previewX = e.clientX;
  _previewY = e.clientY;
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => showPreview(board), 650);
}
function cancelPreview() {
  clearTimeout(_previewTimer);
  quickPreview.classList.remove("show");
}
function updatePreviewPos(e) {
  _previewX = e.clientX;
  _previewY = e.clientY;
  positionPreview();
}
function positionPreview() {
  let x = _previewX + 16,
    y = _previewY + 16;
  if (x + 290 > window.innerWidth - 10) x = _previewX - 300;
  if (y + 280 > window.innerHeight - 10) y = _previewY - 280;
  quickPreview.style.left = `${Math.max(10, x)}px`;
  quickPreview.style.top = `${Math.max(10, y)}px`;
}
function showPreview(board) {
  document.getElementById("qpDot").style.background = board.color;
  document.getElementById("qpName").textContent = board.name;
  document.getElementById("qpDesc").textContent =
    board.desc || "Không có mô tả.";

  document.getElementById("qpStats").innerHTML =
    `<div class="qp__stat"><i class="ph-bold ph-check-circle" style="color:var(--green)"></i>${board.done_tasks ?? 0} xong</div>
     <div class="qp__stat"><i class="ph-bold ph-clock"         style="color:var(--amber)"></i>${(board.total_tasks ?? 0) - (board.done_tasks ?? 0)} còn lại</div>
     <div class="qp__stat"><i class="ph-bold ph-users"         style="color:var(--info)"></i>${(board.members || []).length} thành viên</div>`;

  const tasks = board.preview_tasks || [];
  document.getElementById("qpTasks").innerHTML = tasks.length
    ? tasks
        .map(
          (t) =>
            `<div class="qp__task-item"><i class="ph-bold ph-check-circle"></i><span>${escHtml(t.title)}</span></div>`,
        )
        .join("")
    : '<p style="font-size:.78rem;color:var(--text-light)">Chưa có task nào.</p>';

  document.getElementById("qpOpen").onclick = () => {
    window.location.href = `/boards/${board.id}/tasks/`;
  };
  positionPreview();
  quickPreview.classList.add("show");
}

/* ════════════════════════════════════════════════════
   K. DRAG & DROP (client-side reorder)
   Chú ý: reorder chỉ là visual — không persist thứ tự vào DB
   (cần thêm endpoint PATCH /boards/{id}/reorder/ nếu muốn)
   ════════════════════════════════════════════════════ */
let _dragSrcId = null;

function attachDragEvents() {
  document.querySelectorAll(".board-card").forEach((card) => {
    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragover", onDragOver);
    card.addEventListener("drop", onDrop);
    card.addEventListener("dragend", onDragEnd);
    card.addEventListener("dragleave", (e) =>
      e.currentTarget.classList.remove("drag-over"),
    );
  });
}

function onDragStart(e) {
  _dragSrcId = this.dataset.id;
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}
function onDragOver(e) {
  e.preventDefault();
  this.classList.add("drag-over");
}
function onDragEnd() {
  this.classList.remove("dragging", "drag-over");
}
function onDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");
  const dropId = this.dataset.id;
  if (!_dragSrcId || _dragSrcId === dropId) return;

  // Reorder in-memory cache then re-render (no DB call)
  const srcIdx = ui.boards.findIndex((b) => b.id === _dragSrcId);
  const dropIdx = ui.boards.findIndex((b) => b.id === dropId);
  if (srcIdx === -1 || dropIdx === -1) return;
  const [moved] = ui.boards.splice(srcIdx, 1);
  ui.boards.splice(dropIdx, 0, moved);
  renderGrid(ui.boards);
}

/* ════════════════════════════════════════════════════
   L. SEARCH / SORT / VIEW / FILTER
   ════════════════════════════════════════════════════ */

// Search — debounced
let _searchTimer = null;
document.getElementById("searchInput").addEventListener("input", (e) => {
  ui.search = e.target.value;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => fetchAndRender(), 350);
});

// Sidebar filters
const PAGE_INFO = {
  all: { title: "Tất cả Board", sub: "Quản lý tất cả các dự án của bạn" },
  favorites: {
    title: "Board Yêu thích",
    sub: "Những board bạn đánh dấu yêu thích",
  },
  archived: { title: "Đã lưu trữ", sub: "Board đã được lưu trữ" },
  personal: { title: "Board Cá nhân", sub: "Board chỉ dành cho cá nhân bạn" },
  team: { title: "Board Nhóm", sub: "Board chia sẻ với nhóm" },
};

document.querySelectorAll(".sidebar__item[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    ui.filter = btn.dataset.filter;
    document
      .querySelectorAll(".sidebar__item")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const info = PAGE_INFO[ui.filter] || PAGE_INFO.all;
    document.getElementById("pageTitle").textContent = info.title;
    document.getElementById("pageSub").textContent = info.sub;
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("show");
    fetchAndRender();
  });
});

// Sort dropdown
const sortBtn = document.getElementById("sortBtn");
const sortDropdown = document.getElementById("sortDropdown");

sortBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  sortDropdown.classList.toggle("open");
});
document.addEventListener("click", () => sortDropdown.classList.remove("open"));

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
    fetchAndRender();
  });
});

// View toggle
document.getElementById("viewGrid").addEventListener("click", () => {
  ui.view = "grid";
  document.getElementById("viewGrid").classList.add("active");
  document.getElementById("viewList").classList.remove("active");
  renderGrid(ui.boards);
});
document.getElementById("viewList").addEventListener("click", () => {
  ui.view = "list";
  document.getElementById("viewList").classList.add("active");
  document.getElementById("viewGrid").classList.remove("active");
  renderGrid(ui.boards);
});

/* ════════════════════════════════════════════════════
   M. KEYBOARD SHORTCUTS
   ════════════════════════════════════════════════════ */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeContextMenu();
    cancelPreview();
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
   N. INIT
   ════════════════════════════════════════════════════ */

// Skeleton shimmer CSS (inject vào <head> để skeleton hoạt động)
const skeletonStyle = document.createElement("style");
skeletonStyle.textContent = `
  .skeleton-card { pointer-events:none; }
  .skel {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px;
  }
  .skel--band  { height: 5px; width: 100%; border-radius: 0; }
  .skel--title { height: 18px; width: 70%; margin: 16px 16px 10px; }
  .skel--line  { height: 12px; width: 90%; margin: 8px 16px; }
  .skel--short { width: 55%; }
  .skel--bar   { height: 5px; width: calc(100% - 32px); margin: 14px 16px; }
  @keyframes shimmer { to { background-position: -200% 0; } }

  .btn-spinner {
    display:inline-block; width:14px; height:14px;
    border:2px solid rgba(255,255,255,.4);
    border-top-color:#fff;
    border-radius:50%;
    animation: spin .7s linear infinite;
    vertical-align: middle; margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(skeletonStyle);

fetchAndRender().then(() => {
  if (!sessionStorage.getItem("taskly-greeted")) {
    sessionStorage.setItem("taskly-greeted", "1");
    // Lấy tạm username, sau này có thể truyền thẳng từ Django Template xuống
    const u = localStorage.getItem("taskly-username") || "bạn";
    showToast(`Chào mừng trở lại, ${u}! 👋`, "success");
  }
});
