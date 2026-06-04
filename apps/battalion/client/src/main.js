// ─── Battalion SPA Router & Core ────────────────────────────────────

import { renderLogin } from './pages/login.js';
import { renderAdmin } from './pages/admin.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderEditor } from './pages/editor.js';
import { renderReports } from './pages/reports.js';
import { renderSettings } from './pages/settings.js';
import { auth, player as playerApi } from './utils/api.js';

const app = document.getElementById('app');

// ─── Toast System ───────────────────────────────────────────────────

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show an animated toast notification.
 * @param {string} message - Text to display
 * @param {'success'|'warning'|'error'|'info'|'levelup'} type
 */
export function showToast(message, type = 'info') {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
    levelup: '🎉'
  };

  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--exit');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─── Loading Spinner ────────────────────────────────────────────────

let loadingOverlay = null;

function ensureLoadingOverlay() {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring spinner-ring--inner"></div>
        <span class="spinner-icon">⚔️</span>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  }
  return loadingOverlay;
}

export function showLoading() {
  const overlay = ensureLoadingOverlay();
  overlay.classList.add('loading-overlay--visible');
}

export function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.remove('loading-overlay--visible');
  }
}

// ─── Router ─────────────────────────────────────────────────────────

export function navigate(hash) {
  window.location.hash = hash;
}

// Cleanup intervals on page switch
let activeIntervals = [];

export function registerInterval(id) {
  activeIntervals.push(id);
}

function clearActiveIntervals() {
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

async function route() {
  clearActiveIntervals();

  const hash = window.location.hash || '#dashboard';

  if (hash === '#login') {
    renderLogin(app);
    return;
  }

  if (hash === '#admin') {
    showLoading();
    try {
      const res = await auth.check();
      if (!res.authenticated) {
        throw new Error('Not authenticated');
      }
      hideLoading();
      renderAdmin(app);
    } catch (e) {
      hideLoading();
      navigate('#login');
    }
    return;
  }

  if (hash === '#editor') {
    showLoading();
    try {
      const res = await auth.check();
      if (!res.authenticated) {
        throw new Error('Not authenticated');
      }
      hideLoading();
      renderEditor(app);
    } catch (e) {
      hideLoading();
      navigate('#login');
    }
    return;
  }

  if (hash === '#reports') {
    showLoading();
    try {
      const res = await auth.check();
      if (!res.authenticated) {
        throw new Error('Not authenticated');
      }
      hideLoading();
      renderReports(app);
    } catch (e) {
      hideLoading();
      navigate('#login');
    }
    return;
  }

  if (hash === '#settings') {
    showLoading();
    try {
      const res = await auth.check();
      if (!res.authenticated) {
        throw new Error('Not authenticated');
      }
      hideLoading();
      renderSettings(app);
    } catch (e) {
      hideLoading();
      navigate('#login');
    }
    return;
  }

  // Default: public dashboard
  renderDashboard(app);
}

// Notification Scheduler
function startNotificationScheduler() {
  setInterval(async () => {
    try {
      const checkRes = await auth.check();
      if (!checkRes.authenticated) return;

      const p = await playerApi.get();
      if (!p.notifications_enabled) return;

      const now = Date.now();
      const interval = p.notification_interval || '2h';
      
      if (interval === 'daily') {
        const times = p.notification_time || '09:00';
        const parts = times.split(',').map(s => s.trim());
        const dateObj = new Date();
        const hrs = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        const currentSlot = `${hrs}:${mins}`;

        if (parts.includes(currentSlot)) {
          const dateStr = dateObj.toDateString();
          const lastSentSlotKey = `daily_sent_${dateStr}_${currentSlot}`;
          if (localStorage.getItem(lastSentSlotKey) !== 'true') {
            localStorage.setItem(lastSentSlotKey, 'true');
            triggerCheckInNotification();
          }
        }
      } else {
        const hrsNum = parseInt(interval) || 2;
        const intervalMs = hrsNum * 60 * 60 * 1000;
        const lastSentStr = localStorage.getItem('last_notification_sent');
        const lastSent = lastSentStr ? parseInt(lastSentStr) : 0;

        if (now - lastSent >= intervalMs) {
          localStorage.setItem('last_notification_sent', String(now));
          triggerCheckInNotification();
        }
      }
    } catch (e) {
      console.error('Notification scheduler error:', e);
    }
  }, 60000);
}

function triggerCheckInNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification("⚔️ Battalion Reminder", {
    body: "Time for a mood check-in! How are you feeling?",
    icon: "/favicon.ico"
  });
}

// ─── Init ───────────────────────────────────────────────────────────

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  // Apply saved background color
  const savedBg = localStorage.getItem('battalion_bg_color');
  if (savedBg) document.body.style.backgroundColor = savedBg;

  route();
  startNotificationScheduler();
});
