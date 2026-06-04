import { player as playerApi, auth } from '../utils/api.js';
import { navigate, showToast } from '../main.js';
import { renderReports } from './reports.js';
import { renderEditor } from './editor.js';

let playerData = {};

function getMoodEmoji(m) {
  return {
    terrible: '😫',
    miserable: '😢',
    bad: '🙁',
    unpleasant: '😒',
    okay: '😐',
    fine: '🙂',
    good: '😊',
    great: '😁',
    excellent: '🤩',
    fantastic: '🥳'
  }[m] || '😐';
}

export async function renderSettings(container) {
  container.innerHTML = `
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-bar__inner">
        <div class="status-bar__player">
          <span class="status-bar__name" id="sb-name">Hero</span>
          <span class="status-bar__level" id="sb-level">Lv 1</span>
        </div>

        <div class="status-bar__bars">
          <div class="status-bar__bar-group">
            <div class="status-bar__bar-label">
              <span>❤️ HP</span><span id="sb-hp-text">0/0</span>
            </div>
            <div class="progress-bar progress-bar--sm">
              <div class="progress-bar__fill progress-bar__fill--hp" id="sb-hp-bar" style="width:0%"></div>
            </div>
          </div>
          <div class="status-bar__bar-group">
            <div class="status-bar__bar-label">
              <span>🍏 Health Lv <span id="sb-health-level">1</span></span><span id="sb-health-xp-text">0/0</span>
            </div>
            <div class="progress-bar progress-bar--sm">
              <div class="progress-bar__fill" id="sb-health-xp-bar" style="background:#10b981; width:0%"></div>
            </div>
          </div>
          <div class="status-bar__bar-group">
            <div class="status-bar__bar-label">
              <span>⚡ XP</span><span id="sb-xp-text">0/0</span>
            </div>
            <div class="progress-bar progress-bar--sm">
              <div class="progress-bar__fill progress-bar__fill--xp" id="sb-xp-bar" style="width:0%"></div>
            </div>
          </div>
        </div>

        <div class="status-bar__gold" id="sb-gold">💰 0</div>
        <div class="status-bar__mood" id="sb-mood">😐</div>

        <div class="status-bar__actions">
          <button class="btn btn--ghost btn--sm" id="btn-admin-hub" title="Admin Hub">⚔️ Admin Hub</button>
          <button class="btn btn--ghost btn--sm" id="btn-public" title="Public View">🌍 Public</button>
          <button class="btn btn--ghost btn--sm" id="btn-logout" title="Logout">🚪</button>
        </div>
      </div>
    </div>

    <!-- Settings Main Layout -->
    <div class="admin-content">
      <div class="section">
        <div class="settings-tabs" style="display:flex; border-bottom:1px solid #ddd; margin-bottom:16px; flex-wrap:wrap; gap:4px;">
          <button class="settings-tab settings-tab--active" data-tab="general" style="background:none; border:none; padding:8px 16px; font-weight:600; cursor:pointer; font-size:13px; border-bottom:2px solid #333;">⚙️ General</button>
          <button class="settings-tab" data-tab="analytics" style="background:none; border:none; padding:8px 16px; font-weight:600; cursor:pointer; font-size:13px; color:#666; border-bottom:2px solid transparent;">📊 Analytics</button>
          <button class="settings-tab" data-tab="editor" style="background:none; border:none; padding:8px 16px; font-weight:600; cursor:pointer; font-size:13px; color:#666; border-bottom:2px solid transparent;">📝 Data Editor</button>
        </div>

        <div class="settings-panes">
          <!-- General Pane -->
          <div class="settings-pane" id="pane-general">
            <h2 class="section__title" style="margin-bottom:12px;">Browser Reminders</h2>
            <form id="general-settings-form" style="display:flex; flex-direction:column; gap:16px; max-width:400px; background:#fafafa; padding:16px; border:1px solid #eee;">
              <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="settings-notifications" style="width:16px; height:16px; cursor:pointer;" />
                <label for="settings-notifications" style="font-weight:600; cursor:pointer; user-select:none;">Enable browser check-in notifications</label>
              </div>

              <div class="form-group" id="group-notification-interval" style="display:flex; flex-direction:column; gap:4px;">
                <label class="form-label" style="font-weight:600;">Reminder Interval</label>
                <select class="form-select" id="settings-interval" style="padding:6px; border:1px solid #ddd; background:#fff;">
                  <option value="1h">Every 1 hour</option>
                  <option value="2h">Every 2 hours</option>
                  <option value="3h">Every 3 hours</option>
                  <option value="4h">Every 4 hours</option>
                  <option value="daily">Daily at specific times</option>
                </select>
              </div>

              <div class="form-group" id="group-notification-time" style="display:flex; flex-direction:column; gap:4px; display:none;">
                <label class="form-label" style="font-weight:600;">Daily Times (comma-separated, 24h HH:MM format)</label>
                <input class="form-input" type="text" id="settings-time" placeholder="09:00, 13:00, 18:00, 21:00" style="padding:6px; border:1px solid #ddd;" />
                <span style="font-size:11px; color:#888; line-height:1.3;">List the times of day you want alerts to appear, separated by commas (e.g. 09:00, 12:30, 18:00).</span>
              </div>

              <button class="btn btn--primary" type="submit" style="align-self:flex-start; padding:6px 16px; cursor:pointer;">Save Settings</button>
            </form>

            <h2 class="section__title" style="margin-top:24px; margin-bottom:8px;">Background Color</h2>
            <div id="bg-color-picker" style="display:flex; flex-wrap:wrap; gap:6px; max-width:400px; background:#fafafa; padding:12px; border:1px solid #eee;"></div>
          </div>

          <!-- Analytics Pane -->
          <div class="settings-pane" id="pane-analytics" style="display:none;">
            <div id="settings-analytics-container"></div>
          </div>

          <!-- Editor Pane -->
          <div class="settings-pane" id="pane-editor" style="display:none;">
            <div id="settings-editor-container"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Navigation Listeners
  document.getElementById('btn-admin-hub')?.addEventListener('click', () => navigate('#admin'));
  document.getElementById('btn-public')?.addEventListener('click', () => navigate('#dashboard'));
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await auth.logout(); } catch (_) {}
    navigate('#login');
  });

  // Attach Tab switcher logic
  const tabs = document.querySelectorAll('.settings-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => {
        t.classList.remove('settings-tab--active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = '#666';
      });
      tab.classList.add('settings-tab--active');
      tab.style.borderBottomColor = '#333';
      tab.style.color = '#000';

      const target = tab.dataset.tab;
      document.querySelectorAll('.settings-pane').forEach(p => p.style.display = 'none');
      document.getElementById(`pane-${target}`).style.display = 'block';

      if (target === 'analytics') {
        const analyticsContainer = document.getElementById('settings-analytics-container');
        analyticsContainer.innerHTML = '<span style="opacity:0.5">Loading reports...</span>';
        await renderReports(analyticsContainer);
      } else if (target === 'editor') {
        const editorContainer = document.getElementById('settings-editor-container');
        editorContainer.innerHTML = '<span style="opacity:0.5">Loading data editor...</span>';
        await renderEditor(editorContainer);
      }
    });
  });

  // Toggle specific times input
  const intervalSelect = document.getElementById('settings-interval');
  const timeGroup = document.getElementById('group-notification-time');
  intervalSelect.addEventListener('change', () => {
    if (intervalSelect.value === 'daily') {
      timeGroup.style.display = 'flex';
    } else {
      timeGroup.style.display = 'none';
    }
  });

  // Load player settings data
  await loadPlayerSettings();

  // Save General settings form handler
  document.getElementById('general-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = document.getElementById('settings-notifications').checked;
    const interval = document.getElementById('settings-interval').value;
    let times = document.getElementById('settings-time').value.trim();

    // Time validation if daily is selected
    if (enabled && interval === 'daily') {
      if (!times) {
        showToast('Please specify at least one time slot for daily reminders.', 'warning');
        return;
      }
      // Simple regex check for comma-separated list of HH:MM
      const parts = times.split(',').map(s => s.trim());
      const isValid = parts.every(p => /^([01]\d|2[0-3]):[0-5]\d$/.test(p));
      if (!isValid) {
        showToast('Invalid time format. Please use HH:MM (e.g. 09:00, 18:30).', 'error');
        return;
      }
      times = parts.join(', ');
    }

    // Request permissions
    if (enabled && ('Notification' in window)) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast('Reminder permission denied. Please check browser settings.', 'warning');
        }
      }
    }

    try {
      const updated = await playerApi.update({
        notifications_enabled: enabled ? 1 : 0,
        notification_interval: interval,
        notification_time: times
      });
      playerData = updated;
      showToast('Settings saved successfully!', 'success');
      // Reset local notification trigger history
      localStorage.removeItem('last_notification_sent');
      localStorage.removeItem('last_daily_notification_slot');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    }
  });

  // ─── Background Color Picker ──────────────────────────────────────
  const BG_COLORS = [
    { value: '#ffffff', label: 'White' },
    { value: '#fafafa', label: 'Snow' },
    { value: '#f5f5f5', label: 'Smoke' },
    { value: '#f0f4f8', label: 'Mist' },
    { value: '#eef2ff', label: 'Lavender' },
    { value: '#eff6ff', label: 'Ice' },
    { value: '#f0fdf4', label: 'Mint' },
    { value: '#fefce8', label: 'Cream' },
    { value: '#fff7ed', label: 'Peach' },
    { value: '#fdf2f8', label: 'Blush' },
    { value: '#f5f3ff', label: 'Lilac' },
    { value: '#ecfeff', label: 'Frost' },
  ];

  const pickerEl = document.getElementById('bg-color-picker');
  const savedBg = localStorage.getItem('battalion_bg_color') || '#ffffff';

  if (pickerEl) {
    pickerEl.innerHTML = BG_COLORS.map(c => {
      const isActive = c.value === savedBg;
      return `<button type="button" class="bg-swatch" data-bg="${c.value}" title="${c.label}" style="
        width:36px; height:36px; border-radius:4px; cursor:pointer;
        border:2px solid ${isActive ? '#333' : '#ccc'};
        background:${c.value};
        display:flex; align-items:center; justify-content:center;
        font-size:14px; transition: border-color 0.15s;
      ">${isActive ? '✓' : ''}</button>`;
    }).join('');

    pickerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.bg-swatch');
      if (!btn) return;
      const color = btn.dataset.bg;
      localStorage.setItem('battalion_bg_color', color);
      document.body.style.backgroundColor = color;
      // Update swatch visuals
      pickerEl.querySelectorAll('.bg-swatch').forEach(s => {
        const active = s.dataset.bg === color;
        s.style.borderColor = active ? '#333' : '#ccc';
        s.textContent = active ? '✓' : '';
      });
      showToast(`Background set to ${btn.title}`, 'info');
    });
  }

  // Apply saved bg color
  document.body.style.backgroundColor = savedBg;
}

async function loadPlayerSettings() {
  try {
    playerData = await playerApi.get();
    
    // Fill General Form
    const notifyInput = document.getElementById('settings-notifications');
    const intervalSelect = document.getElementById('settings-interval');
    const timeInput = document.getElementById('settings-time');
    const timeGroup = document.getElementById('group-notification-time');

    if (notifyInput) notifyInput.checked = !!playerData.notifications_enabled;
    if (intervalSelect) intervalSelect.value = playerData.notification_interval || '2h';
    if (timeInput) timeInput.value = playerData.notification_time || '09:00';

    if (intervalSelect && intervalSelect.value === 'daily') {
      if (timeGroup) timeGroup.style.display = 'flex';
    }

    updateStatusBar();
  } catch (err) {
    showToast('Failed to retrieve settings: ' + err.message, 'error');
  }
}

function updateStatusBar() {
  const p = playerData;

  const nameEl = document.getElementById('sb-name');
  const levelEl = document.getElementById('sb-level');
  const goldEl = document.getElementById('sb-gold');
  const moodEl = document.getElementById('sb-mood');

  if (nameEl) nameEl.textContent = p.username || 'Hero';
  if (levelEl) levelEl.textContent = `Lv ${p.level || 1}`;
  if (goldEl) goldEl.textContent = `💰 ${p.gold || 0}`;
  if (moodEl) moodEl.textContent = getMoodEmoji(p.current_mood);

  // HP
  const hp = p.hp || 0, maxHp = p.max_hp || 100;
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  const hpBar = document.getElementById('sb-hp-bar');
  const hpText = document.getElementById('sb-hp-text');
  if (hpBar) {
    hpBar.style.width = `${hpPct}%`;
    if (hpPct <= 25) hpBar.classList.add('progress-bar__fill--hp-low');
    else hpBar.classList.remove('progress-bar__fill--hp-low');
  }
  if (hpText) hpText.textContent = `${hp}/${maxHp}`;

  // Health Level
  const healthLevel = p.health_level || 1;
  const healthXp = p.health_xp || 0;
  const healthXpNext = p.health_xp_to_next || 100;
  const healthPct = Math.min(100, Math.round((healthXp / healthXpNext) * 100));
  const healthLvlText = document.getElementById('sb-health-level');
  const healthXpText = document.getElementById('sb-health-xp-text');
  const healthXpBar = document.getElementById('sb-health-xp-bar');
  if (healthLvlText) healthLvlText.textContent = healthLevel;
  if (healthXpText) healthXpText.textContent = `${healthXp}/${healthXpNext}`;
  if (healthXpBar) healthXpBar.style.width = `${healthPct}%`;

  // XP
  const xp = p.xp || 0, xpNext = p.xp_to_next || 100;
  const xpPct = Math.min(100, Math.round((xp / xpNext) * 100));
  const xpBar = document.getElementById('sb-xp-bar');
  const xpText = document.getElementById('sb-xp-text');
  if (xpBar) xpBar.style.width = `${xpPct}%`;
  if (xpText) xpText.textContent = `${xp}/${xpNext}`;
}
