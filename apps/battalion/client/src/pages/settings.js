import { player as playerApi, auth, template as templateApi } from '../utils/api.js';
import { navigate, showToast, showLoading, hideLoading } from '../main.js';
import { renderReports } from './reports.js';
import { renderEditor } from './editor.js';

let playerData = {};
let isOwner = false;

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
          <button class="btn btn--ghost btn--sm" id="btn-admin-hub" title="Dashboard">⚔️ Dashboard</button>
          <button class="btn btn--ghost btn--sm" id="btn-public" title="Public View">🌍 Public</button>
          <button class="btn btn--ghost btn--sm" id="btn-logout" title="Sign Out">Sign Out</button>
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
          <button class="settings-tab" data-tab="template" id="tab-btn-template" style="background:none; border:none; padding:8px 16px; font-weight:600; cursor:pointer; font-size:13px; color:#7e22ce; border-bottom:2px solid transparent; display:none;">⚙️ Master Template</button>
        </div>

        <div class="settings-panes">
          <!-- General Pane -->
          <div class="settings-pane" id="pane-general">
            <!-- Public Share Link Card -->
            <h2 class="section__title" style="margin-bottom:12px;">🌍 Public Profile & Share Link</h2>
            <div style="background:#fafafa; padding:16px; border:1px solid #eee; margin-bottom:24px; max-width:540px; display:flex; flex-direction:column; gap:12px;">
              <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="settings-is-public" style="width:16px; height:16px; cursor:pointer;" />
                <label for="settings-is-public" style="font-weight:600; cursor:pointer; user-select:none;">Public Profile Enabled (Shareable via unique link)</label>
              </div>

              <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
                <label class="form-label" style="font-weight:600; font-size:12px;">Your Public Share URL</label>
                <div style="display:flex; gap:6px;">
                  <input class="form-input" type="text" id="settings-share-url" readonly style="padding:6px; border:1px solid #ddd; background:#fff; flex:1; font-family:monospace; font-size:12px;" />
                  <button class="btn btn--secondary btn--sm" type="button" id="btn-copy-share-url" style="cursor:pointer;">📋 Copy</button>
                  <button class="btn btn--ghost btn--sm" type="button" id="btn-open-share-url" style="cursor:pointer;">↗ Open</button>
                </div>
                <span style="font-size:11px; color:#666;">Anyone with this link can view your active quest completions and habit streaks in read-only mode.</span>
              </div>

              <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
                <label class="form-label" style="font-weight:600; font-size:12px;">Profile Vanity Slug</label>
                <div style="display:flex; gap:6px;">
                  <input class="form-input" type="text" id="settings-slug" placeholder="e.g. wm" style="padding:6px; border:1px solid #ddd; background:#fff; flex:1;" />
                  <button class="btn btn--primary btn--sm" type="button" id="btn-save-slug" style="cursor:pointer;">Save Slug</button>
                </div>
              </div>
            </div>

            <!-- Reminders Card -->
            <h2 class="section__title" style="margin-bottom:12px;">⏰ Browser Reminders</h2>
            <form id="general-settings-form" style="display:flex; flex-direction:column; gap:16px; max-width:540px; background:#fafafa; padding:16px; border:1px solid #eee; margin-bottom:24px;">
              <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="settings-notifications" style="width:16px; height:16px; cursor:pointer;" />
                <label for="settings-notifications" style="font-weight:600; cursor:pointer; user-select:none;">Enable browser check-in notifications</label>
              </div>

              <div class="form-group" id="group-notification-interval" style="display:flex; flex-direction:column; gap:4px;">
                <label class="form-label" style="font-weight:600; font-size:12px;">Reminder Interval</label>
                <select class="form-select" id="settings-interval" style="padding:6px; border:1px solid #ddd; background:#fff;">
                  <option value="1h">Every 1 hour</option>
                  <option value="2h">Every 2 hours</option>
                  <option value="3h">Every 3 hours</option>
                  <option value="4h">Every 4 hours</option>
                  <option value="daily">Daily at specific times</option>
                </select>
              </div>

              <div class="form-group" id="group-notification-time" style="display:flex; flex-direction:column; gap:4px; display:none;">
                <label class="form-label" style="font-weight:600; font-size:12px;">Daily Times (comma-separated, 24h HH:MM format)</label>
                <input class="form-input" type="text" id="settings-time" placeholder="09:00, 13:00, 18:00, 21:00" style="padding:6px; border:1px solid #ddd;" />
                <span style="font-size:11px; color:#888; line-height:1.3;">List the times of day you want alerts to appear, separated by commas (e.g. 09:00, 12:30, 18:00).</span>
              </div>

              <button class="btn btn--primary" type="submit" style="align-self:flex-start; padding:6px 16px; cursor:pointer;">Save Reminders</button>
            </form>

            <h2 class="section__title" style="margin-bottom:8px;">🎨 Background Color</h2>
            <div id="bg-color-picker" style="display:flex; flex-wrap:wrap; gap:6px; max-width:540px; background:#fafafa; padding:12px; border:1px solid #eee;"></div>
          </div>

          <!-- Analytics Pane -->
          <div class="settings-pane" id="pane-analytics" style="display:none;">
            <div id="settings-analytics-container"></div>
          </div>

          <!-- Editor Pane -->
          <div class="settings-pane" id="pane-editor" style="display:none;">
            <div id="settings-editor-container"></div>
          </div>

          <!-- Master Template Pane (Owner Only) -->
          <div class="settings-pane" id="pane-template" style="display:none;">
            <div id="settings-template-container"></div>
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

  // Check auth level for Owner tab
  try {
    const authCheck = await auth.check();
    if (authCheck?.isOwner) {
      isOwner = true;
      const tTab = document.getElementById('tab-btn-template');
      if (tTab) tTab.style.display = 'inline-block';
    }
  } catch (_) {}

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
      } else if (target === 'template') {
        const templateContainer = document.getElementById('settings-template-container');
        await renderTemplateManager(templateContainer);
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

  // Public Profile Handlers
  const isPublicToggle = document.getElementById('settings-is-public');
  if (isPublicToggle) {
    isPublicToggle.addEventListener('change', async () => {
      try {
        const val = isPublicToggle.checked ? 1 : 0;
        await playerApi.update({ is_public: val });
        showToast(`Profile visibility: ${val ? 'Public' : 'Private'}`, 'success');
      } catch (err) {
        showToast('Failed to update visibility: ' + err.message, 'error');
      }
    });
  }

  const copyShareBtn = document.getElementById('btn-copy-share-url');
  if (copyShareBtn) {
    copyShareBtn.addEventListener('click', () => {
      const input = document.getElementById('settings-share-url');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('Public share link copied to clipboard! 📋', 'success');
      }
    });
  }

  const openShareBtn = document.getElementById('btn-open-share-url');
  if (openShareBtn) {
    openShareBtn.addEventListener('click', () => {
      const input = document.getElementById('settings-share-url');
      if (input && input.value) {
        window.open(input.value, '_blank');
      }
    });
  }

  const saveSlugBtn = document.getElementById('btn-save-slug');
  if (saveSlugBtn) {
    saveSlugBtn.addEventListener('click', async () => {
      const slugVal = document.getElementById('settings-slug')?.value.trim();
      if (!slugVal) {
        showToast('Please enter a vanity slug', 'warning');
        return;
      }
      try {
        const updated = await playerApi.update({ slug: slugVal });
        playerData = updated;
        updateShareUrl();
        showToast('Custom vanity slug saved!', 'success');
      } catch (err) {
        showToast('Failed to save slug: ' + err.message, 'error');
      }
    });
  }

  // Save General settings form handler
  document.getElementById('general-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = document.getElementById('settings-notifications').checked;
    const interval = document.getElementById('settings-interval').value;
    let times = document.getElementById('settings-time').value.trim();

    if (enabled && interval === 'daily') {
      if (!times) {
        showToast('Please specify at least one time slot for daily reminders.', 'warning');
        return;
      }
      const parts = times.split(',').map(s => s.trim());
      const isValid = parts.every(p => /^([01]\d|2[0-3]):[0-5]\d$/.test(p));
      if (!isValid) {
        showToast('Invalid time format. Please use HH:MM (e.g. 09:00, 18:30).', 'error');
        return;
      }
      times = parts.join(', ');
    }

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
      localStorage.removeItem('last_notification_sent');
      localStorage.removeItem('last_daily_notification_slot');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    }
  });

  // Background Color Picker
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
      pickerEl.querySelectorAll('.bg-swatch').forEach(s => {
        const active = s.dataset.bg === color;
        s.style.borderColor = active ? '#333' : '#ccc';
        s.textContent = active ? '✓' : '';
      });
      showToast(`Background set to ${btn.title}`, 'info');
    });
  }

  document.body.style.backgroundColor = savedBg;
}

function updateShareUrl() {
  const input = document.getElementById('settings-share-url');
  if (!input) return;
  const slug = playerData.slug || playerData.username || 'wm';
  const url = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(slug)}#dashboard`;
  input.value = url;
}

async function loadPlayerSettings() {
  try {
    playerData = await playerApi.get();

    const notifyInput = document.getElementById('settings-notifications');
    const intervalSelect = document.getElementById('settings-interval');
    const timeInput = document.getElementById('settings-time');
    const timeGroup = document.getElementById('group-notification-time');
    const publicInput = document.getElementById('settings-is-public');
    const slugInput = document.getElementById('settings-slug');

    if (notifyInput) notifyInput.checked = !!playerData.notifications_enabled;
    if (intervalSelect) intervalSelect.value = playerData.notification_interval || '2h';
    if (timeInput) timeInput.value = playerData.notification_time || '09:00';
    if (publicInput) publicInput.checked = playerData.is_public !== 0;
    if (slugInput) slugInput.value = playerData.slug || '';

    updateShareUrl();

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

  const xp = p.xp || 0, xpNext = p.xp_to_next || 100;
  const xpPct = Math.min(100, Math.round((xp / xpNext) * 100));
  const xpBar = document.getElementById('sb-xp-bar');
  const xpText = document.getElementById('sb-xp-text');
  if (xpBar) xpBar.style.width = `${xpPct}%`;
  if (xpText) xpText.textContent = `${xp}/${xpNext}`;
}

// ─── Master Startup Template Manager (Owner) ──────────────

async function renderTemplateManager(container) {
  container.innerHTML = '<div style="padding:20px; opacity:0.6;">Loading Master Startup Template data...</div>';

  try {
    const data = await templateApi.get();
    const templatePlayer = data.template.player;
    let templateTasks = [...data.template.tasks];
    let templateHabits = [...data.template.habits];
    const changelog = data.changelog || [];

    function renderContent() {
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:12px; margin-bottom:16px;">
          <div>
            <h2 class="section__title" style="margin:0 0 4px 0;">⚙️ Master Startup Template Manager</h2>
            <p style="margin:0; font-size:12px; color:#666;">
              This startup account template is cloned for all newly provisioned users. Your personal owner data (wm) is preserved separately.
            </p>
          </div>
          <button class="btn btn--secondary btn--sm" id="btn-export-template-json" style="cursor:pointer; display:flex; align-items:center; gap:4px;">
            ⬇ Export Template JSON
          </button>
        </div>

        <!-- 1. Baseline Starting Stats -->
        <div style="background:#fafafa; border:1px solid #eee; padding:16px; margin-bottom:20px;">
          <h3 style="margin-top:0; font-size:14px;">1. Baseline Starting Stats</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px;">
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">💰 Starting Gold</label>
              <input type="number" id="tmpl-gold" value="${templatePlayer.gold ?? 50}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">❤️ Max HP</label>
              <input type="number" id="tmpl-max-hp" value="${templatePlayer.max_hp ?? 100}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">⚡ Energy (0-100)</label>
              <input type="number" id="tmpl-energy" value="${templatePlayer.stat_energy ?? 50}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">😰 Stress (0-100)</label>
              <input type="number" id="tmpl-stress" value="${templatePlayer.stat_stress ?? 30}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">💪 Health (0-100)</label>
              <input type="number" id="tmpl-health" value="${templatePlayer.stat_health ?? 50}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">🧼 Hygiene (0-100)</label>
              <input type="number" id="tmpl-hygiene" value="${templatePlayer.stat_hygiene ?? 50}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">🤝 Social (0-100)</label>
              <input type="number" id="tmpl-social" value="${templatePlayer.stat_social ?? 20}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">🎮 Fun (0-100)</label>
              <input type="number" id="tmpl-fun" value="${templatePlayer.stat_fun ?? 20}" class="form-input" style="padding:4px;" />
            </div>
            <div>
              <label style="font-size:11px; font-weight:600; color:#555;">🎯 Discipline (0-100)</label>
              <input type="number" id="tmpl-discipline" value="${templatePlayer.stat_discipline ?? 20}" class="form-input" style="padding:4px;" />
            </div>
          </div>
        </div>

        <!-- 2. Starter Quests (Tasks) -->
        <div style="background:#fafafa; border:1px solid #eee; padding:16px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="margin:0; font-size:14px;">2. Starter Quests (${templateTasks.length})</h3>
            <button class="btn btn--sm btn--ghost" id="btn-add-tmpl-task" style="cursor:pointer;">➕ Add Starter Quest</button>
          </div>
          <div style="max-height:260px; overflow-y:auto; border:1px solid #e5e5e5; background:#fff;">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead>
                <tr style="background:#f3f4f6; text-align:left; border-bottom:1px solid #e5e5e5;">
                  <th style="padding:6px 8px;">Quest Name</th>
                  <th style="padding:6px 8px;">Category</th>
                  <th style="padding:6px 8px;">Difficulty</th>
                  <th style="padding:6px 8px;">XP</th>
                  <th style="padding:6px 8px;">Gold</th>
                  <th style="padding:6px 8px; width:40px;"></th>
                </tr>
              </thead>
              <tbody>
                ${templateTasks.map((t, idx) => `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 8px;"><input type="text" class="tmpl-task-name" data-idx="${idx}" value="${t.name}" style="width:100%; border:none; background:transparent;" /></td>
                    <td style="padding:6px 8px;">
                      <select class="tmpl-task-cat" data-idx="${idx}" style="border:1px solid #ddd; padding:2px;">
                        ${['discipline', 'vitality', 'social', 'intellect', 'creativity', 'finance'].map(c => `
                          <option value="${c}" ${t.category === c ? 'selected' : ''}>${c}</option>
                        `).join('')}
                      </select>
                    </td>
                    <td style="padding:6px 8px;">
                      <select class="tmpl-task-diff" data-idx="${idx}" style="border:1px solid #ddd; padding:2px;">
                        ${['easy', 'medium', 'hard', 'epic'].map(d => `
                          <option value="${d}" ${t.difficulty === d ? 'selected' : ''}>${d}</option>
                        `).join('')}
                      </select>
                    </td>
                    <td style="padding:6px 8px;"><input type="number" class="tmpl-task-xp" data-idx="${idx}" value="${t.xp_reward ?? 25}" style="width:50px; border:1px solid #ddd; padding:2px;" /></td>
                    <td style="padding:6px 8px;"><input type="number" class="tmpl-task-gold" data-idx="${idx}" value="${t.gold_reward ?? 10}" style="width:50px; border:1px solid #ddd; padding:2px;" /></td>
                    <td style="padding:6px 8px; text-align:center;">
                      <button type="button" class="btn-del-tmpl-task" data-idx="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;" title="Delete">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Starter Habits -->
        <div style="background:#fafafa; border:1px solid #eee; padding:16px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="margin:0; font-size:14px;">3. Starter Habits (${templateHabits.length})</h3>
            <button class="btn btn--sm btn--ghost" id="btn-add-tmpl-habit" style="cursor:pointer;">➕ Add Starter Habit</button>
          </div>
          <div style="max-height:220px; overflow-y:auto; border:1px solid #e5e5e5; background:#fff;">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead>
                <tr style="background:#f3f4f6; text-align:left; border-bottom:1px solid #e5e5e5;">
                  <th style="padding:6px 8px; width:40px;">Icon</th>
                  <th style="padding:6px 8px;">Habit Name</th>
                  <th style="padding:6px 8px;">Type</th>
                  <th style="padding:6px 8px;">Category</th>
                  <th style="padding:6px 8px;">XP</th>
                  <th style="padding:6px 8px; width:40px;"></th>
                </tr>
              </thead>
              <tbody>
                ${templateHabits.map((h, idx) => `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 8px;"><input type="text" class="tmpl-habit-icon" data-idx="${idx}" value="${h.icon || '⭐'}" style="width:30px; border:1px solid #ddd; text-align:center; padding:2px;" /></td>
                    <td style="padding:6px 8px;"><input type="text" class="tmpl-habit-name" data-idx="${idx}" value="${h.name}" style="width:100%; border:none; background:transparent;" /></td>
                    <td style="padding:6px 8px;">
                      <select class="tmpl-habit-type" data-idx="${idx}" style="border:1px solid #ddd; padding:2px;">
                        <option value="positive" ${h.type === 'positive' ? 'selected' : ''}>positive</option>
                        <option value="negative" ${h.type === 'negative' ? 'selected' : ''}>negative</option>
                      </select>
                    </td>
                    <td style="padding:6px 8px;">
                      <select class="tmpl-habit-cat" data-idx="${idx}" style="border:1px solid #ddd; padding:2px;">
                        ${['discipline', 'vitality', 'social', 'intellect', 'creativity', 'finance'].map(c => `
                          <option value="${c}" ${h.category === c ? 'selected' : ''}>${c}</option>
                        `).join('')}
                      </select>
                    </td>
                    <td style="padding:6px 8px;"><input type="number" class="tmpl-habit-xp" data-idx="${idx}" value="${h.xp_reward ?? 15}" style="width:50px; border:1px solid #ddd; padding:2px;" /></td>
                    <td style="padding:6px 8px; text-align:center;">
                      <button type="button" class="btn-del-tmpl-habit" data-idx="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;" title="Delete">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. Save Changes to Template -->
        <div style="background:#f5f3ff; border:1px solid #ddd6fe; padding:16px; margin-bottom:24px; display:flex; flex-direction:column; gap:10px;">
          <h3 style="margin:0; font-size:14px; color:#5b21b6;">4. Commit Template Changes</h3>
          <p style="margin:0; font-size:12px; color:#6b21a8;">
            Every save is recorded into the persistent JSON template changelog and dispatched to the JeffersonWM Central Auth history stream.
          </p>
          <div style="display:flex; gap:8px;">
            <input type="text" id="tmpl-change-summary" placeholder="Change summary (e.g. Adjusted vitality starting XP and added water habit)" class="form-input" style="flex:1;" />
            <button class="btn btn--primary" id="btn-save-template" style="background:#7c3aed; border-color:#7c3aed; cursor:pointer;">
              💾 Save & Log Changes
            </button>
          </div>
        </div>

        <!-- 5. Template JSON Changelog -->
        <div style="background:#fafafa; border:1px solid #eee; padding:16px;">
          <h3 style="margin-top:0; font-size:14px;">📜 Template JSON Changelog (${changelog.length} entries)</h3>
          <div style="max-height:280px; overflow-y:auto;">
            ${changelog.length === 0 ? '<p style="font-size:12px; opacity:0.6;">No changes logged yet.</p>' : `
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#f3f4f6; text-align:left; border-bottom:1px solid #e5e5e5;">
                    <th style="padding:6px 8px; width:60px;">Version</th>
                    <th style="padding:6px 8px; width:90px;">Author</th>
                    <th style="padding:6px 8px;">Summary</th>
                    <th style="padding:6px 8px; width:130px;">Date</th>
                    <th style="padding:6px 8px; width:60px;">Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${changelog.map(c => `
                    <tr style="border-bottom:1px solid #eee;">
                      <td style="padding:6px 8px; font-weight:600; color:#7c3aed;">v${c.version}</td>
                      <td style="padding:6px 8px;">${c.changed_by}</td>
                      <td style="padding:6px 8px;">${c.change_summary}</td>
                      <td style="padding:6px 8px; font-size:11px; opacity:0.7;">${new Date(c.created_at).toLocaleString()}</td>
                      <td style="padding:6px 8px;">
                        <details style="cursor:pointer;">
                          <summary style="font-size:11px; color:#2563eb;">JSON</summary>
                          <pre style="background:#1e1e1e; color:#a5f3fc; padding:8px; border-radius:4px; font-size:10px; max-width:300px; overflow-x:auto;">${JSON.stringify(typeof c.details === 'string' ? JSON.parse(c.details) : c.details, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `;

      // Export JSON handler
      document.getElementById('btn-export-template-json')?.addEventListener('click', async () => {
        try {
          showToast('Downloading Master Template JSON...', 'info');
          await templateApi.export();
          showToast('Template JSON exported!', 'success');
        } catch (err) {
          showToast('Export failed: ' + err.message, 'error');
        }
      });

      // Add task handler
      document.getElementById('btn-add-tmpl-task')?.addEventListener('click', () => {
        templateTasks.push({
          name: 'New Starter Quest',
          description: '',
          category: 'discipline',
          difficulty: 'medium',
          recurrence: 'daily',
          xp_reward: 25,
          gold_reward: 10,
          hp_penalty: 5,
          stat_reward: 2,
          is_active: 1
        });
        renderContent();
      });

      // Delete task handler
      container.querySelectorAll('.btn-del-tmpl-task').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          templateTasks.splice(idx, 1);
          renderContent();
        });
      });

      // Add habit handler
      document.getElementById('btn-add-tmpl-habit')?.addEventListener('click', () => {
        templateHabits.push({
          name: 'New Starter Habit',
          type: 'positive',
          category: 'vitality',
          icon: '⭐',
          xp_reward: 15,
          gold_reward: 5,
          stat_reward: 1,
          is_active: 1
        });
        renderContent();
      });

      // Delete habit handler
      container.querySelectorAll('.btn-del-tmpl-habit').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          templateHabits.splice(idx, 1);
          renderContent();
        });
      });

      // Save Template Handler
      document.getElementById('btn-save-template')?.addEventListener('click', async () => {
        const summary = document.getElementById('tmpl-change-summary')?.value.trim();
        if (!summary) {
          showToast('Please enter a change summary describing your edits', 'warning');
          return;
        }

        // Sync inputs to memory
        const stats = {
          gold: parseInt(document.getElementById('tmpl-gold')?.value, 10) || 50,
          max_hp: parseInt(document.getElementById('tmpl-max-hp')?.value, 10) || 100,
          hp: parseInt(document.getElementById('tmpl-max-hp')?.value, 10) || 100,
          stat_energy: parseInt(document.getElementById('tmpl-energy')?.value, 10) || 50,
          stat_stress: parseInt(document.getElementById('tmpl-stress')?.value, 10) || 30,
          stat_health: parseInt(document.getElementById('tmpl-health')?.value, 10) || 50,
          stat_hygiene: parseInt(document.getElementById('tmpl-hygiene')?.value, 10) || 50,
          stat_social: parseInt(document.getElementById('tmpl-social')?.value, 10) || 20,
          stat_fun: parseInt(document.getElementById('tmpl-fun')?.value, 10) || 20,
          stat_discipline: parseInt(document.getElementById('tmpl-discipline')?.value, 10) || 20
        };

        container.querySelectorAll('.tmpl-task-name').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateTasks[idx]) templateTasks[idx].name = el.value;
        });
        container.querySelectorAll('.tmpl-task-cat').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateTasks[idx]) templateTasks[idx].category = el.value;
        });
        container.querySelectorAll('.tmpl-task-diff').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateTasks[idx]) templateTasks[idx].difficulty = el.value;
        });
        container.querySelectorAll('.tmpl-task-xp').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateTasks[idx]) templateTasks[idx].xp_reward = parseInt(el.value, 10) || 25;
        });
        container.querySelectorAll('.tmpl-task-gold').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateTasks[idx]) templateTasks[idx].gold_reward = parseInt(el.value, 10) || 10;
        });

        container.querySelectorAll('.tmpl-habit-icon').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateHabits[idx]) templateHabits[idx].icon = el.value;
        });
        container.querySelectorAll('.tmpl-habit-name').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateHabits[idx]) templateHabits[idx].name = el.value;
        });
        container.querySelectorAll('.tmpl-habit-type').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateHabits[idx]) templateHabits[idx].type = el.value;
        });
        container.querySelectorAll('.tmpl-habit-cat').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateHabits[idx]) templateHabits[idx].category = el.value;
        });
        container.querySelectorAll('.tmpl-habit-xp').forEach(el => {
          const idx = parseInt(el.dataset.idx, 10);
          if (templateHabits[idx]) templateHabits[idx].xp_reward = parseInt(el.value, 10) || 15;
        });

        showLoading();
        try {
          const result = await templateApi.update({
            stats,
            tasks: templateTasks,
            habits: templateHabits,
            change_summary: summary
          });
          hideLoading();
          showToast(`Master Startup Template updated to v${result.version}!`, 'success');
          // Re-render template manager to reflect new changelog
          await renderTemplateManager(container);
        } catch (err) {
          hideLoading();
          showToast('Failed to update template: ' + err.message, 'error');
        }
      });
    }

    renderContent();

  } catch (err) {
    container.innerHTML = `<div style="padding:20px; color:#ef4444;">Failed to load template data: ${err.message}</div>`;
  }
}
