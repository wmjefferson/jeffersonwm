import { actions as actionsApi, emotions as emotionsApi } from '../utils/api.js';
import { showToast, navigate } from '../main.js';

let actionLog = [];
let emotionLog = [];

// Helper to format date in Pacific Time (24-hour clock)
function formatPacificTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
  } catch (err) {
    return dateStr;
  }
}

let cachedActions = [];
let cachedEmotions = [];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

export async function renderReports(container) {
  container.innerHTML = `
    <div class="header">
      <div class="header__content" style="max-width:900px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h1 class="header__title">📊 Reports & Analytics</h1>
          <div class="header__subtitle">View history and stats</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn--sm" id="btn-create-log" style="background:#10b981; color:#fff; border:none; font-weight:500;" title="Create a new log entry">➕ Create Log</button>
          
          <div style="position:relative; display:inline-block;" id="export-dropdown-wrap">
            <button class="btn btn--sm btn--primary" id="btn-export-log-menu" title="Export Log to JSON">⬇ Export JSON ▾</button>
            <div id="export-menu-dropdown" style="display:none; position:absolute; right:0; top:100%; margin-top:4px; background:#fff; border:1px solid #ddd; border-radius:6px; box-shadow:0 6px 16px rgba(0,0,0,0.15); z-index:1000; min-width:210px; padding:6px 0;">
              <div style="padding:4px 12px; font-size:10px; text-transform:uppercase; color:#888; font-weight:700; letter-spacing:0.5px;">Combined (Emotions + Actions)</div>
              <button class="export-opt-btn" data-type="all" data-tf="all" style="width:100%; text-align:left; background:none; border:none; padding:7px 12px; font-size:12px; cursor:pointer;">📁 All History</button>
              <button class="export-opt-btn" data-type="all" data-tf="30d" style="width:100%; text-align:left; background:none; border:none; padding:7px 12px; font-size:12px; cursor:pointer;">📅 Last 30 Days</button>
              <button class="export-opt-btn" data-type="all" data-tf="7d" style="width:100%; text-align:left; background:none; border:none; padding:7px 12px; font-size:12px; cursor:pointer;">📅 Last 7 Days</button>
              <button class="export-opt-btn" data-type="all" data-tf="today" style="width:100%; text-align:left; background:none; border:none; padding:7px 12px; font-size:12px; cursor:pointer;">☀️ Today Only</button>
              <div style="border-top:1px solid #eee; margin:4px 0;"></div>
              <div style="padding:4px 12px; font-size:10px; text-transform:uppercase; color:#888; font-weight:700; letter-spacing:0.5px;">Single Stream</div>
              <button class="export-opt-btn" data-type="emotions" data-tf="all" style="width:100%; text-align:left; background:none; border:none; padding:7px 12px; font-size:12px; cursor:pointer;">💭 Emotions Log Only</button>
              <button class="export-opt-btn" data-type="actions" data-tf="all" style="width:100%; text-align:left; background:none; border:none; padding:7px 12px; font-size:12px; cursor:pointer;">▶ Actions Log Only</button>
            </div>
          </div>

          <button class="btn btn--ghost btn--sm" id="btn-back" title="Back to Admin">◀ Back</button>
        </div>
      </div>
    </div>
    
    <div class="container" style="max-width:900px;">
      <div style="text-align:center; padding:40px; color:#888;" id="reports-loading">
        Loading data...
      </div>
      <div id="reports-content" style="display:none; gap:20px; flex-direction:column;">
        
        <!-- Action History -->
        <div class="section">
          <div class="section__header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 class="section__title">▶ Action History</h2>
              <div id="action-stats" style="font-size:12px; opacity:0.6;"></div>
            </div>
            <button class="btn btn--ghost btn--sm" id="btn-export-actions-quick" title="Export actions as JSON">⬇ Export Actions</button>
          </div>
          <div style="max-height:400px; overflow-y:auto; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">
            <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
              <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                <tr>
                  <th style="padding:8px 12px; font-weight:600;">Time</th>
                  <th style="padding:8px 12px; font-weight:600;">Action</th>
                  <th style="padding:8px 12px; font-weight:600;">Category</th>
                  <th style="padding:8px 12px; font-weight:600;">Stat Impact</th>
                </tr>
              </thead>
              <tbody id="action-table-body"></tbody>
            </table>
          </div>
        </div>

        <!-- Emotion History -->
        <div class="section" style="border-left:3px solid #7c3aed;">
          <div class="section__header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h2 class="section__title">💭 Emotion History</h2>
              <div id="emotion-stats" style="font-size:12px; opacity:0.6;"></div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; font-size:12px;">
              <button class="btn btn--ghost btn--sm" id="btn-export-emotions-quick" title="Export emotions as JSON">⬇ Export Emotions</button>
              <span class="text-muted" style="margin-left:4px;">Clear:</span>
              <button class="btn btn--sm btn--danger btn-clear-emotions" data-days="1">1 Day</button>
              <button class="btn btn--sm btn--danger btn-clear-emotions" data-days="2">2 Days</button>
              <button class="btn btn--sm btn--danger btn-clear-emotions" data-days="3">3 Days</button>
            </div>
          </div>
          <div style="max-height:400px; overflow-y:auto; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">
            <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
              <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                <tr>
                  <th style="padding:8px 12px; font-weight:600;">Time</th>
                  <th style="padding:8px 12px; font-weight:600;">Emotion</th>
                  <th style="padding:8px 12px; font-weight:600;">Category</th>
                  <th style="padding:8px 12px; font-weight:600;">Stat Impact</th>
                  <th style="padding:8px 12px; font-weight:600; text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="emotion-table-body"></tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>

    <!-- Modal for Creating Log Entry -->
    <div id="create-log-modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center;">
      <div style="background:#fff; border-radius:8px; width:90%; max-width:480px; padding:20px; box-shadow:0 10px 25px rgba(0,0,0,0.2); position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #eee; padding-bottom:8px;">
          <h3 style="font-size:16px; font-weight:700; margin:0;" id="modal-title">➕ Create Log Entry</h3>
          <button id="modal-close-btn" style="background:none; border:none; font-size:18px; cursor:pointer; color:#666;">✕</button>
        </div>

        <!-- Mode Toggle -->
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button type="button" id="toggle-mode-emotion" class="btn btn--sm" style="flex:1; border:1px solid #7c3aed; background:#7c3aed; color:#fff; font-weight:600;">💭 Log Emotion</button>
          <button type="button" id="toggle-mode-action" class="btn btn--sm" style="flex:1; border:1px solid #ddd; background:#f8fafc; color:#444;">▶ Log Action</button>
        </div>

        <form id="create-log-form" style="display:flex; flex-direction:column; gap:12px;">
          <!-- Item Select -->
          <div id="group-select-item" style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:12px; font-weight:600;" id="lbl-item-select">Select Emotion</label>
            <select id="input-item-select" style="padding:7px; border:1px solid #ccc; border-radius:4px; font-size:13px; background:#fff;"></select>
          </div>

          <!-- Date / Time -->
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:12px; font-weight:600;">Timestamp</label>
            <input type="datetime-local" id="input-item-time" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;" />
            <span style="font-size:11px; opacity:0.6;">Leave as default for current time.</span>
          </div>

          <!-- Tier (Emotions Only) -->
          <div id="group-tier" style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:12px; font-weight:600;">Intensity / Tier (1-5)</label>
            <select id="input-item-tier" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; background:#fff;">
              <option value="1">1 - Subtle</option>
              <option value="2">2 - Mild</option>
              <option value="3" selected>3 - Moderate</option>
              <option value="4">4 - Strong</option>
              <option value="5">5 - Intense</option>
            </select>
          </div>

          <!-- Apply Stats Checkbox (Actions Only) -->
          <div id="group-apply-stats" style="display:none; align-items:center; gap:8px;">
            <input type="checkbox" id="input-apply-stats" checked style="width:16px; height:16px; cursor:pointer;" />
            <label for="input-apply-stats" style="font-size:12px; cursor:pointer; user-select:none;">Apply stat changes to player</label>
          </div>

          <!-- Note -->
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:12px; font-weight:600;">Note (optional)</label>
            <input type="text" id="input-item-note" placeholder="Add context or notes..." style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;" />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button type="button" id="modal-cancel-btn" class="btn btn--ghost btn--sm">Cancel</button>
            <button type="submit" id="modal-submit-btn" class="btn btn--sm" style="background:#10b981; color:#fff; border:none; padding:6px 16px; font-weight:600;">Save Entry</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('#admin'));

  // Export dropdown toggling
  const exportBtn = document.getElementById('btn-export-log-menu');
  const exportDropdown = document.getElementById('export-menu-dropdown');
  
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = exportDropdown.style.display === 'block';
    exportDropdown.style.display = isShown ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#export-dropdown-wrap')) {
      if (exportDropdown) exportDropdown.style.display = 'none';
    }
  });

  // Export option handlers
  const handleExport = async (type = 'all', timeframe = 'all') => {
    if (exportDropdown) exportDropdown.style.display = 'none';
    showToast('Preparing JSON export...', 'info');
    try {
      const data = await actionsApi.exportLog({ type, timeframe });
      const filename = `battalion_${type}_log_${timeframe}_${new Date().toISOString().slice(0,10)}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, filename);
      const count = data?.summary?.total_timeline_events ?? (data?.timeline?.length || 0);
      showToast(`Exported ${count} entries as JSON (logged to Auth)`, 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  container.querySelectorAll('.export-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type') || 'all';
      const timeframe = btn.getAttribute('data-tf') || 'all';
      handleExport(type, timeframe);
    });
  });

  document.getElementById('btn-export-actions-quick')?.addEventListener('click', () => handleExport('actions', 'all'));
  document.getElementById('btn-export-emotions-quick')?.addEventListener('click', () => handleExport('emotions', 'all'));

  // ─── Create Log Modal Logic ─────────────────────────────────────
  const modalBackdrop = document.getElementById('create-log-modal-backdrop');
  let createMode = 'emotion'; // 'emotion' | 'action'

  const openCreateModal = async () => {
    modalBackdrop.style.display = 'flex';
    // Default time to local ISO format for datetime-local
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    const timeInput = document.getElementById('input-item-time');
    if (timeInput) timeInput.value = localISOTime;

    // Load available items if not yet loaded
    if (cachedActions.length === 0 || cachedEmotions.length === 0) {
      try {
        const [acts, emos] = await Promise.all([
          actionsApi.getAll(),
          emotionsApi.getAll()
        ]);
        cachedActions = acts || [];
        cachedEmotions = emos || [];
      } catch (_) {}
    }

    updateModalForm();
  };

  const closeCreateModal = () => {
    modalBackdrop.style.display = 'none';
  };

  const updateModalForm = () => {
    const lbl = document.getElementById('lbl-item-select');
    const select = document.getElementById('input-item-select');
    const tierGroup = document.getElementById('group-tier');
    const applyStatsGroup = document.getElementById('group-apply-stats');
    const btnEmo = document.getElementById('toggle-mode-emotion');
    const btnAct = document.getElementById('toggle-mode-action');

    if (createMode === 'emotion') {
      btnEmo.style.background = '#7c3aed';
      btnEmo.style.color = '#fff';
      btnEmo.style.borderColor = '#7c3aed';
      btnAct.style.background = '#f8fafc';
      btnAct.style.color = '#444';
      btnAct.style.borderColor = '#ddd';

      lbl.textContent = 'Select Emotion';
      tierGroup.style.display = 'flex';
      applyStatsGroup.style.display = 'none';

      // Group emotions by category
      select.innerHTML = cachedEmotions.map(e => `
        <option value="${e.name}" data-cat="${e.category_id}">
          ${e.name} (${(e.category_id || '').replace(/_/g, ' ')})
        </option>
      `).join('');
    } else {
      btnAct.style.background = '#2563eb';
      btnAct.style.color = '#fff';
      btnAct.style.borderColor = '#2563eb';
      btnEmo.style.background = '#f8fafc';
      btnEmo.style.color = '#444';
      btnEmo.style.borderColor = '#ddd';

      lbl.textContent = 'Select Action';
      tierGroup.style.display = 'none';
      applyStatsGroup.style.display = 'flex';

      // Group actions by category
      select.innerHTML = cachedActions.map(a => `
        <option value="${a.action_id}" data-label="${a.label}" data-cat="${a.category}">
          ${a.label} (${(a.category || '').replace(/_/g, ' ')})
        </option>
      `).join('');
    }
  };

  document.getElementById('btn-create-log')?.addEventListener('click', openCreateModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeCreateModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeCreateModal);
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeCreateModal();
  });

  document.getElementById('toggle-mode-emotion')?.addEventListener('click', () => {
    createMode = 'emotion';
    updateModalForm();
  });

  document.getElementById('toggle-mode-action')?.addEventListener('click', () => {
    createMode = 'action';
    updateModalForm();
  });

  // Submit manual log entry
  document.getElementById('create-log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = document.getElementById('input-item-select');
    const selectedOption = select?.selectedOptions[0];
    const timeVal = document.getElementById('input-item-time')?.value;
    const noteVal = document.getElementById('input-item-note')?.value.trim();
    const isoTimestamp = timeVal ? new Date(timeVal).toISOString() : new Date().toISOString();

    const submitBtn = document.getElementById('modal-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (createMode === 'emotion') {
        const emotionName = select?.value;
        const categoryId = selectedOption?.getAttribute('data-cat') || 'curious';
        const tier = parseInt(document.getElementById('input-item-tier')?.value) || 3;

        await emotionsApi.log(emotionName, categoryId, tier, noteVal, isoTimestamp);
        showToast(`Logged emotion: ${emotionName}`, 'success');
      } else {
        const actionId = select?.value;
        const actionLabel = selectedOption?.getAttribute('data-label') || actionId;
        const category = selectedOption?.getAttribute('data-cat') || 'personal';
        const applyStats = document.getElementById('input-apply-stats')?.checked || false;

        await actionsApi.createLog({
          action_id: actionId,
          action_label: actionLabel,
          category,
          performed_at: isoTimestamp,
          note: noteVal,
          apply_stats: applyStats
        });
        showToast(`Logged action: ${actionLabel}`, 'success');
      }

      closeCreateModal();
      await loadData();
    } catch (err) {
      showToast('Failed to create log: ' + err.message, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Bind bulk clearance event listeners
  container.querySelectorAll('.btn-clear-emotions').forEach(btn => {
    btn.addEventListener('click', async () => {
      const days = parseInt(btn.getAttribute('data-days'));
      if (confirm(`Are you sure you want to delete all emotion logs from the last ${days} day(s)?`)) {
        try {
          await emotionsApi.clearLogs(days);
          showToast(`Logs from the last ${days} day(s) cleared`, 'success');
          await loadData();
        } catch (err) {
          showToast('Failed to clear logs: ' + err.message, 'error');
        }
      }
    });
  });

  // Bind individual delete event listeners via delegation on tbody
  const emotionTableBody = document.getElementById('emotion-table-body');
  emotionTableBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete-emotion');
    if (!btn) return;
    
    const id = btn.getAttribute('data-id');
    const name = btn.getAttribute('data-name');
    
    if (confirm(`Are you sure you want to delete the emotion "${name}" from your log?`)) {
      try {
        await emotionsApi.deleteLog(id);
        showToast('Emotion log deleted', 'success');
        await loadData();
      } catch (err) {
        showToast('Failed to delete emotion: ' + err.message, 'error');
      }
    }
  });

  await loadData();
}

async function loadData() {
  try {
    const [acts, emos] = await Promise.all([
      actionsApi.getLog(150),
      emotionsApi.history(150)
    ]);
    
    actionLog = acts || [];
    emotionLog = emos || [];

    document.getElementById('reports-loading').style.display = 'none';
    document.getElementById('reports-content').style.display = 'flex';

    renderActionTable();
    renderEmotionTable();
  } catch (err) {
    document.getElementById('reports-loading').textContent = 'Failed to load reports: ' + err.message;
    document.getElementById('reports-loading').style.color = 'red';
  }
}

function renderActionTable() {
  const tbody = document.getElementById('action-table-body');
  const statsEl = document.getElementById('action-stats');
  
  if (actionLog.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center; opacity:0.5;">No actions logged yet.</td></tr>';
    return;
  }

  // Basic stats
  const catCounts = {};
  actionLog.forEach(l => {
    catCounts[l.category] = (catCounts[l.category] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a,b) => b[1] - a[1])[0];
  statsEl.textContent = `${actionLog.length} recent actions · Top category: ${topCat ? topCat[0] : 'None'}`;

  tbody.innerHTML = actionLog.map(log => {
    const time = formatPacificTime(log.performed_at);
    
    const deltaStr = [];
    if (log.energy_delta) deltaStr.push(`⚡${log.energy_delta > 0 ? '+' : ''}${log.energy_delta}`);
    if (log.stress_delta) deltaStr.push(`😰${log.stress_delta > 0 ? '+' : ''}${log.stress_delta}`);
    if (log.health_delta) deltaStr.push(`❤${log.health_delta > 0 ? '+' : ''}${log.health_delta}`);
    if (log.hygiene_delta) deltaStr.push(`✨${log.hygiene_delta > 0 ? '+' : ''}${log.hygiene_delta}`);
    if (log.discipline_delta) deltaStr.push(`🎯${log.discipline_delta > 0 ? '+' : ''}${log.discipline_delta}`);
    if (log.fun_delta) deltaStr.push(`🎮${log.fun_delta > 0 ? '+' : ''}${log.fun_delta}`);
    if (log.social_delta) deltaStr.push(`🤝${log.social_delta > 0 ? '+' : ''}${log.social_delta}`);
    if (log.money_delta) deltaStr.push(`💰${log.money_delta > 0 ? '+' : ''}${log.money_delta}`);

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 12px; opacity:0.6;">${time}</td>
        <td style="padding:8px 12px; font-weight:500;">${log.action_label}</td>
        <td style="padding:8px 12px; text-transform:capitalize;">${(log.category||'').replace('_', ' ')}</td>
        <td style="padding:8px 12px; opacity:0.8; font-size:12px;">${deltaStr.join(' ')}</td>
      </tr>
    `;
  }).join('');
}

function renderEmotionTable() {
  const tbody = document.getElementById('emotion-table-body');
  const statsEl = document.getElementById('emotion-stats');
  
  if (emotionLog.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:12px; text-align:center; opacity:0.5;">No emotions logged yet.</td></tr>';
    return;
  }

  // Basic stats
  let totalXP = 0;
  emotionLog.forEach(l => {
    totalXP += (l.xp_earned || 0);
  });
  statsEl.textContent = `${emotionLog.length} recent emotions · Total XP earned: ${totalXP}`;

  tbody.innerHTML = emotionLog.map(log => {
    const time = formatPacificTime(log.logged_at);
    
    const deltaStr = [];
    if (log.energy_delta) deltaStr.push(`⚡${log.energy_delta > 0 ? '+' : ''}${log.energy_delta}`);
    if (log.stress_delta) deltaStr.push(`😰${log.stress_delta > 0 ? '+' : ''}${log.stress_delta}`);
    if (log.health_delta) deltaStr.push(`❤${log.health_delta > 0 ? '+' : ''}${log.health_delta}`);
    if (log.discipline_delta) deltaStr.push(`🎯${log.discipline_delta > 0 ? '+' : ''}${log.discipline_delta}`);
    if (log.fun_delta) deltaStr.push(`🎮${log.fun_delta > 0 ? '+' : ''}${log.fun_delta}`);
    if (log.social_delta) deltaStr.push(`🤝${log.social_delta > 0 ? '+' : ''}${log.social_delta}`);
    if (log.xp_earned) deltaStr.push(`🌟+${log.xp_earned} XP`);
    if (log.gold_earned) deltaStr.push(`💰+${log.gold_earned} G`);

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 12px; opacity:0.6;">${time}</td>
        <td style="padding:8px 12px; font-weight:500;">${log.emotion_name}</td>
        <td style="padding:8px 12px; text-transform:capitalize;">${(log.category_id||'').replace('_', ' ')}</td>
        <td style="padding:8px 12px; opacity:0.8; font-size:12px; color:#6d28d9;">${deltaStr.join(' ')}</td>
        <td style="padding:8px 12px; text-align:right;">
          <button class="btn btn--danger btn--sm btn-delete-emotion" data-id="${log.id}" data-name="${log.emotion_name}" style="padding: 2px 6px; font-size: 11px;">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}
