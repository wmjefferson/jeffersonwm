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

export async function renderReports(container) {
  container.innerHTML = `
    <div class="header">
      <div class="header__content" style="max-width:900px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h1 class="header__title">📊 Reports & Analytics</h1>
          <div class="header__subtitle">View history and stats</div>
        </div>
        <div style="display:flex; gap:8px;">
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
          <div class="section__header">
            <h2 class="section__title">▶ Action History</h2>
            <div id="action-stats" style="font-size:12px; opacity:0.6;"></div>
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
              <span class="text-muted">Clear last:</span>
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
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('#admin'));

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
