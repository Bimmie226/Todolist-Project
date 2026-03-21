/**
 * script.js — Taskly Landing Page
 * Features:
 *  - Page loader
 *  - Sticky header on scroll
 *  - Mobile hamburger menu
 *  - Dark / Light mode toggle (persisted in localStorage)
 *  - Scroll-reveal animations (IntersectionObserver)
 *  - Active nav link on scroll
 *  - Animated counters (stats section)
 *  - Contact form with toast notification
 *  - Smooth scroll for anchor links
 */

/* ════════════════════════════════════════════════════
   1. PAGE LOADER
   ════════════════════════════════════════════════════ */
const loader = document.getElementById("loader");

window.addEventListener("load", () => {
  // Hide loader after a brief delay so fonts/icons can settle
  setTimeout(() => {
    loader.classList.add("hidden");
  }, 900);
});

/* ════════════════════════════════════════════════════
   2. STICKY HEADER
   ════════════════════════════════════════════════════ */
const header = document.getElementById("header");

const onScroll = () => {
  header.classList.toggle("scrolled", window.scrollY > 40);
  updateActiveNav();
};

window.addEventListener("scroll", onScroll, { passive: true });

/* ════════════════════════════════════════════════════
   3. HAMBURGER / MOBILE MENU
   ════════════════════════════════════════════════════ */
const hamburger = document.getElementById("hamburger");
const navMenu = document.getElementById("navMenu");

hamburger.addEventListener("click", () => {
  const isOpen = navMenu.classList.toggle("open");
  hamburger.classList.toggle("open", isOpen);
  hamburger.setAttribute("aria-expanded", String(isOpen));
  // Prevent body scroll when menu is open
  document.body.style.overflow = isOpen ? "hidden" : "";
});

// Close menu when a nav link is clicked
navMenu.querySelectorAll(".nav__link").forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  });
});

// Close menu on outside click
document.addEventListener("click", (e) => {
  if (!header.contains(e.target) && navMenu.classList.contains("open")) {
    navMenu.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
});

/* ════════════════════════════════════════════════════
   4. DARK MODE TOGGLE
   ════════════════════════════════════════════════════ */
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;

// Load saved preference or detect system preference
const savedTheme = localStorage.getItem("taskly-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initTheme = savedTheme || (prefersDark ? "dark" : "light");

html.setAttribute("data-theme", initTheme);

themeToggle.addEventListener("click", () => {
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("taskly-theme", next);
});

/* ════════════════════════════════════════════════════
   5. SCROLL REVEAL (IntersectionObserver)
   ════════════════════════════════════════════════════ */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        // Trigger counter if inside stats section
        const counter = entry.target.querySelector("[data-target]");
        if (counter) animateCounter(counter);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);

document
  .querySelectorAll(".reveal")
  .forEach((el) => revealObserver.observe(el));

/* ════════════════════════════════════════════════════
   6. ACTIVE NAV LINK ON SCROLL
   ════════════════════════════════════════════════════ */
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav__link");

function updateActiveNav() {
  let currentId = "";
  const scrollY = window.scrollY;

  sections.forEach((section) => {
    const sectionTop = section.offsetTop - 100;
    if (scrollY >= sectionTop) {
      currentId = section.getAttribute("id");
    }
  });

  navLinks.forEach((link) => {
    const href = link.getAttribute("href")?.replace("#", "");
    link.classList.toggle("active", href === currentId);
  });
}

/* ════════════════════════════════════════════════════
   7. ANIMATED COUNTERS
   ════════════════════════════════════════════════════ */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800; // ms
  const start = performance.now();

  const step = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(eased * target);

    // Format large numbers with locale separating commas
    el.textContent = value.toLocaleString("vi-VN");

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target.toLocaleString("vi-VN");
    }
  };

  requestAnimationFrame(step);
}

// Also observe each stat individually (counter lives inside .stat.reveal)
document.querySelectorAll(".stat").forEach((stat) => {
  const statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const counter = entry.target.querySelector("[data-target]");
          if (counter) animateCounter(counter);
          statObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );
  statObserver.observe(stat);
});

/* ════════════════════════════════════════════════════
   8. SMOOTH SCROLL FOR ANCHOR LINKS
   ════════════════════════════════════════════════════ */
document.querySelectorAll('a.smooth-scroll, a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  });
});

/* ════════════════════════════════════════════════════
   9. CONTACT FORM + TOAST
   ════════════════════════════════════════════════════ */

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const icon = type === "success" ? "✓" : "✕";
  const color = type === "success" ? "var(--green)" : "var(--red)";

  toast.innerHTML = `<span style="color:${color};font-size:1.1rem;margin-right:8px">${icon}</span>${message}`;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 3500);
}

/**
 * Handle contact form submission
 * @param {SubmitEvent} e
 */
function handleContact(e) {
  e.preventDefault();

  const name = document.getElementById("cName").value.trim();
  const email = document.getElementById("cEmail").value.trim();
  const message = document.getElementById("cMsg").value.trim();

  // Basic validation
  if (!name || !email || !message) {
    showToast("Vui lòng điền đầy đủ thông tin.", "error");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Email không hợp lệ.", "error");
    return;
  }

  // Simulate sending (replace with real API call)
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner"></i> Đang gửi…';

  setTimeout(() => {
    showToast(`Cảm ơn ${name}! Chúng tôi sẽ phản hồi sớm nhất có thể. 🚀`);
    e.target.reset();
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Gửi tin nhắn';
  }, 1400);
}

// Expose globally for inline onsubmit attribute
window.handleContact = handleContact;

/* ════════════════════════════════════════════════════
   10. HOVER PARALLAX ON HERO BLOBS (subtle depth)
   ════════════════════════════════════════════════════ */
const hero = document.querySelector(".hero");
const blobs = document.querySelectorAll(".blob--1, .blob--2, .blob--3");

if (hero && window.matchMedia("(pointer: fine)").matches) {
  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 → 0.5
    const cy = (e.clientY - rect.top) / rect.height - 0.5;

    blobs.forEach((blob, i) => {
      const strength = (i + 1) * 14;
      blob.style.transform = `translate(${cx * strength}px, ${cy * strength}px)`;
    });
  });

  hero.addEventListener("mouseleave", () => {
    blobs.forEach((blob) => {
      blob.style.transform = "";
    });
  });
}

/* ════════════════════════════════════════════════════
   11. PROGRESS BAR ANIMATION (hero card)
   ════════════════════════════════════════════════════ */
const progressFill = document.querySelector(".progress-bar__fill");

if (progressFill) {
  // Wait for hero to be visible, then animate
  const progressObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Already set via inline style; trigger CSS transition
          requestAnimationFrame(() => {
            progressFill.style.width = "68%";
          });
          progressObserver.disconnect();
        }
      });
    },
    { threshold: 0.5 },
  );
  progressObserver.observe(progressFill);
}

/* ════════════════════════════════════════════════════
   12. DONUT CHART ANIMATION (about section)
   ════════════════════════════════════════════════════ */
const donutArc = document.querySelector(".donut-arc");

if (donutArc) {
  donutArc.style.strokeDasharray = "0 314";

  const donutObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            donutArc.style.strokeDasharray = "220 94";
          }, 300);
          donutObserver.disconnect();
        }
      });
    },
    { threshold: 0.5 },
  );

  donutObserver.observe(donutArc);
}

/* ════════════════════════════════════════════════════
   13. PAGE NAVIGATION (Login / Register / Dashboard)
   ════════════════════════════════════════════════════ */
// Handled via plain <a href="…"> tags in HTML.
// No extra JS needed unless you want SPA-style transitions.
