import { publicDashboard, auth } from '../utils/api.js';
import { registerInterval } from '../main.js';

let eventSource = null;

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="dashboard">
      <div class="dash-status">
        <span class="dash-status__live"><span class="dash-status__dot"></span> Live</span>
        <span class="dash-status__updated" id="last-updated">Loading...</span>
        <button class="btn btn--ghost btn--sm" id="btn-dash-refresh">↻ Refresh</button>
        <div id="dash-auth-link" style="margin-left:auto;">
          <a href="#login" class="btn btn--ghost btn--sm" style="text-decoration:none;">Sign In →</a>
        </div>
      </div>

      <div class="dash-header" id="dash-header">
        <!-- Player name, level, title -->
      </div>

      <div class="dash-bars" id="dash-bars">
        <!-- HP and XP bars -->
      </div>

      <div class="dash-inline-stats" id="dash-inline">
        <!-- Gold, mood, tasks completed today -->
      </div>

      <div class="dash-stats" id="dash-stats">
        <!-- 6 stat cards -->
      </div>

      <div class="dash-feed-header">
        <h2>Activity Feed</h2>
      </div>
      <div class="dash-feed" id="dash-feed">
        <!-- Activity items -->
      </div>
    </div>
  `;

  // Initial load
  await loadDashboard();

  // SSE connection for real-time updates
  connectSSE();

  // Fallback: poll every 5 minutes
  const pollId = setInterval(loadDashboard, 5 * 60 * 1000);
  registerInterval(pollId);

  // Refresh button
  document.getElementById('btn-dash-refresh')?.addEventListener('click', loadDashboard);
}

function connectSSE() {
  if (eventSource) eventSource.close();
  try {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const sseBase = isDev ? '' : 'https://api-battalion.jeffersonwm.com';
    eventSource = new EventSource(`${sseBase}/api/events/stream`);
    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type !== 'connected') {
          // Reload dashboard data on any action
          loadDashboard();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };
    eventSource.onerror = () => {
      // Reconnect after 10 seconds on error
      eventSource.close();
      setTimeout(connectSSE, 10000);
    };
  } catch (err) {
    console.warn('SSE not available, using polling only');
  }
}

async function loadDashboard() {
  try {
    const data = await publicDashboard.get();
    renderHeader(data.player);
    renderBars(data.player);
    renderInlineStats(data.player, data.stats);
    renderStats(data.player);
    renderFeed(data.recentActivity || []);
    document.getElementById('last-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;

    // Check auth silently
    try {
      const res = await auth.check();
      const authLink = document.getElementById('dash-auth-link');
      if (authLink && res.authenticated) {
        authLink.innerHTML = `<a href="#admin" class="btn btn--ghost btn--sm" style="text-decoration:none;">Admin Hub →</a>`;
      } else if (authLink) {
        authLink.innerHTML = `<a href="#login" class="btn btn--ghost btn--sm" style="text-decoration:none;">Sign In →</a>`;
      }
    } catch (e) {
      // Not logged in
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderHeader(p) {
  const el = document.getElementById('dash-header');
  if (!el) return;
  el.innerHTML = `
    <h1 class="dash-header__name">${p.username || 'Commander'}</h1>
    <div class="dash-header__meta">
      <span class="dash-header__level">Level ${p.level || 1}</span>
      <span class="dash-header__sep">·</span>
      <span class="dash-header__title">${p.title || 'Recruit'}</span>
    </div>
  `;
}

function renderBars(p) {
  const el = document.getElementById('dash-bars');
  if (!el) return;
  const hp = p.hp || 0, maxHp = p.max_hp || 100;
  const xp = p.xp || 0, xpNext = p.xp_to_next || 100;
  const healthLevel = p.health_level || 1;
  const healthXp = p.health_xp || 0;
  const healthXpNext = p.health_xp_to_next || 100;
  
  const hpPct = Math.round((hp / maxHp) * 100);
  const xpPct = Math.round((xp / xpNext) * 100);
  const healthPct = Math.round((healthXp / healthXpNext) * 100);

  el.innerHTML = `
    <div class="dash-bar">
      <div class="dash-bar__label"><span>HP</span><span>${hp} / ${maxHp}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill progress-bar__fill--hp" style="width:${hpPct}%"></div></div>
    </div>
    <div class="dash-bar">
      <div class="dash-bar__label"><span>Health Lv ${healthLevel}</span><span>${healthXp} / ${healthXpNext}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="background:#10b981; width:${healthPct}%"></div></div>
    </div>
    <div class="dash-bar">
      <div class="dash-bar__label"><span>XP</span><span>${xp} / ${xpNext}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill progress-bar__fill--xp" style="width:${xpPct}%"></div></div>
    </div>
  `;
}

function renderInlineStats(p, stats) {
  const el = document.getElementById('dash-inline');
  if (!el) return;
  const moodEmoji = {
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
  };
  const activeMood = p.current_mood || 'okay';
  const moodLabel = activeMood.charAt(0).toUpperCase() + activeMood.slice(1);
  el.innerHTML = `
    <span class="dash-inline__item">💰 ${p.gold || 0} Gold</span>
    <span class="dash-inline__item">${moodEmoji[activeMood] || '😐'} ${moodLabel}</span>
    <span class="dash-inline__item">✅ ${p.total_tasks_completed || 0} tasks done</span>
  `;
}

function renderStats(p) {
  const el = document.getElementById('dash-stats');
  if (!el) return;
  const stats = [
    { key: 'energy', name: 'Energy', icon: '⚡', value: p.stat_energy || 0 },
    { key: 'stress', name: 'Stress', icon: '😰', value: p.stat_stress || 0 },
    { key: 'money', name: 'Money', icon: '💵', value: p.stat_money || 0 },
    { key: 'social', name: 'Social', icon: '🤝', value: p.stat_social || 0 },
    { key: 'health', name: 'Health', icon: '❤️', value: p.stat_health || 0 },
    { key: 'hygiene', name: 'Hygiene', icon: '🧼', value: p.stat_hygiene || 0 },
    { key: 'fun', name: 'Fun', icon: '🎮', value: p.stat_fun || 0 },
    { key: 'discipline', name: 'Discipline', icon: '🎯', value: p.stat_discipline || 0 },
  ];
  el.innerHTML = stats.map(s => `
    <div class="dash-stat dash-stat--${s.key}">
      <span class="dash-stat__icon">${s.icon}</span>
      <span class="dash-stat__name">${s.name}</span>
      <span class="dash-stat__value">${s.value}</span>
    </div>
  `).join('');
}

function renderFeed(activities) {
  const el = document.getElementById('dash-feed');
  if (!el) return;
  if (activities.length === 0) {
    el.innerHTML = '<div class="dash-feed__empty">No activity yet</div>';
    return;
  }
  el.innerHTML = activities.map((a, i) => {
    const time = timeAgo(a.created_at);
    return `
      <div class="dash-feed__item ${i % 2 === 0 ? '' : 'dash-feed__item--alt'}">
        <span class="dash-feed__icon">${a.icon || '📋'}</span>
        <span class="dash-feed__msg">${a.message}</span>
        <span class="dash-feed__time">${time}</span>
        ${a.xp_earned ? `<span class="dash-feed__badge dash-feed__badge--xp">+${a.xp_earned} XP</span>` : ''}
        ${a.gold_earned ? `<span class="dash-feed__badge dash-feed__badge--gold">+${a.gold_earned} G</span>` : ''}
      </div>
    `;
  }).join('');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (secs < 60) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}
