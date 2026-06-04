// ─── Batallion Admin Page — Main Gameplay Hub ───────────────────────

import { auth, player as playerApi, tasks as tasksApi, habits as habitsApi, mood as moodApi, minigames as minigamesApi, actions as actionsApi, emotions as emotionsApi } from '../utils/api.js';
import { navigate, showToast, registerInterval, showLoading, hideLoading } from '../main.js';

// ─── State ──────────────────────────────────────────────────────────

let playerData = {};
let tasksList = [];
let habitsList = [];
let activeFilter = 'all';
let currentMood = 'okay';
let actionsList = [];
let actionsFilter = 'all';
let actionLogList = [];
let categoriesList = [];
let emotionCategories = [];
let emotionsList = [];
let currentEmotion = null;
let selectedEmoCat = null;
let emotionSearchQuery = '';
let actionSearchQuery = '';
let actionsSort = 'category';  // 'category' | 'az' | 'za' | 'recent' | 'oldest' | 'pos-neg' | 'neg-pos'
let emotionsSort = 'category';

const CATEGORY_ICONS = {
  basic_needs: '🏠', food_cooking: '🍳', home_care: '🧹', work_study: '💼',
  money_admin: '💵', health_fitness: '💪', social_relationships: '🤝',
  leisure_growth: '🎮', errands_mobility: '🚗', caregiving_parenting: '👶',
  maintenance_repair: '🔧'
};

// ─── Helpers ────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
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

function getMoodModifier(m) {
  return {
    terrible: '-40%',
    miserable: '-30%',
    bad: '-20%',
    unpleasant: '-10%',
    okay: '+0%',
    fine: '+5%',
    good: '+10%',
    great: '+20%',
    excellent: '+30%',
    fantastic: '+40%'
  }[m] || '+0%';
}

const STAT_META = {
  discipline: { icon: '🎯', name: 'Discipline' },
  vitality:   { icon: '❤️', name: 'Vitality' },
  social:     { icon: '🤝', name: 'Social' },
  intellect:  { icon: '🧠', name: 'Intellect' },
  creativity: { icon: '🎨', name: 'Creativity' },
  finance:    { icon: '💰', name: 'Finance' }
};

const CATEGORIES = ['discipline', 'vitality', 'social', 'intellect', 'creativity', 'finance'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'epic'];

const HABIT_EMOJIS = ['💪', '📖', '🏃', '🧘', '💧', '🥗', '😴', '🎯', '✍️', '🎵', '🎮', '📱', '🍺', '🚬', '🍫', '☕', '⏰', '🧹', '💊', '🌿'];

// Compute a background tint color for an action/emotion based on net stat impact.
// Positive impact → blue tint, negative → red tint, neutral → gray.
// Uses a squared curve so most items stay pastel; only extreme scores get vivid.
function getImpactTint(deltas) {
  const score = (deltas.energy || 0) + (deltas.health || 0) + (deltas.social || 0)
    + (deltas.hygiene || 0) + (deltas.fun || 0) + (deltas.discipline || 0)
    + (deltas.money || 0) - (deltas.stress || 0);
  if (score === 0) return { bg: '#f5f5f5', border: '#ddd', score };
  const raw = Math.min(Math.abs(score), 50) / 50; // 0..1 linear
  const t = raw * raw; // squared: keeps most values very low (pastel)
  if (score > 0) {
    const sat = Math.round(15 + t * 55);   // 15‑70%
    const light = Math.round(97 - t * 12);  // 97‑85%
    return { bg: `hsl(215, ${sat}%, ${light}%)`, border: `hsl(215, ${sat}%, ${light - 8}%)`, score };
  } else {
    const sat = Math.round(15 + t * 60);   // 15‑75%
    const light = Math.round(97 - t * 12);  // 97‑85%
    return { bg: `hsl(0, ${sat}%, ${light}%)`, border: `hsl(0, ${sat}%, ${light - 8}%)`, score };
  }
}

// ─── Render ─────────────────────────────────────────────────────────

export async function renderAdmin(container) {
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
          <button class="btn btn--ghost btn--sm" id="btn-refresh" title="Refresh">🔄</button>
          <select id="select-reset" title="Reset options" style="font-size:12px; padding:2px 4px; cursor:pointer; border:1px solid #ddd;">
            <option value="" disabled selected>🔁 Reset...</option>
            <option value="daily">Reset Daily</option>
            <option value="1hour">Revert Last 1 Hour</option>
            <option value="6hours">Revert Last 6 Hours</option>
            <option value="3days">Clear Last 3 Days</option>
            <option value="all">Clear All</option>
          </select>
          <label style="font-size:11px; cursor:pointer; display:flex; align-items:center; gap:3px;" title="Also undo XP, gold, and stat changes from that period">
            <input type="checkbox" id="chk-revert-stats" /> revert stats
          </label>
          <button class="btn btn--ghost btn--sm" id="btn-public" title="Public View">🌍 Public</button>
          <button class="btn btn--ghost btn--sm" id="btn-settings" title="Settings">⚙️ Settings</button>
          <button class="btn btn--ghost btn--sm" id="btn-logout" title="Logout">🚪</button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="admin-content">

      <!-- Mood Section -->
      <div class="section mood-section" id="mood-section">
        <div class="section__header" style="justify-content:center">
          <h2 class="section__title">🎭 How are you feeling?</h2>
        </div>

        <div class="mood-buttons" id="mood-buttons">
          <button class="mood-btn" data-mood="terrible" data-tooltip="Terrible: Total rock bottom.">
            <span class="mood-btn__emoji">😫</span>
            <span class="mood-btn__label">Terrible</span>
          </button>
          <button class="mood-btn" data-mood="miserable" data-tooltip="Miserable: Highly uncomfortable and suffering.">
            <span class="mood-btn__emoji">😢</span>
            <span class="mood-btn__label">Miserable</span>
          </button>
          <button class="mood-btn" data-mood="bad" data-tooltip="Bad: Plainly negative and down.">
            <span class="mood-btn__emoji">🙁</span>
            <span class="mood-btn__label">Bad</span>
          </button>
          <button class="mood-btn" data-mood="unpleasant" data-tooltip="Unpleasant: Slightly off and unhappy.">
            <span class="mood-btn__emoji">😒</span>
            <span class="mood-btn__label">Unpleasant</span>
          </button>
          <button class="mood-btn" data-mood="okay" data-tooltip="Okay: The flat, neutral middle.">
            <span class="mood-btn__emoji">😐</span>
            <span class="mood-btn__label">Okay</span>
          </button>
          <button class="mood-btn" data-mood="fine" data-tooltip="Fine: A little bit good.">
            <span class="mood-btn__emoji">🙂</span>
            <span class="mood-btn__label">Fine</span>
          </button>
          <button class="mood-btn" data-mood="good" data-tooltip="Good: Pleasing and positive overall.">
            <span class="mood-btn__emoji">😊</span>
            <span class="mood-btn__label">Good</span>
          </button>
          <button class="mood-btn" data-mood="great" data-tooltip="Great: High energy and smiling.">
            <span class="mood-btn__emoji">😁</span>
            <span class="mood-btn__label">Great</span>
          </button>
          <button class="mood-btn" data-mood="excellent" data-tooltip="Excellent: Wonderfully happy and bright.">
            <span class="mood-btn__emoji">🤩</span>
            <span class="mood-btn__label">Excellent</span>
          </button>
          <button class="mood-btn" data-mood="fantastic" data-tooltip="Fantastic: Absolute peak top form.">
            <span class="mood-btn__emoji">🥳</span>
            <span class="mood-btn__label">Fantastic</span>
          </button>
        </div>

        <div class="mood-note">
          <input class="form-input" type="text" id="mood-note-input" placeholder="How are you feeling? (optional note)" />
        </div>

        <p class="mood-modifier" id="mood-modifier">XP Modifier: +0%</p>
      </div>

      <!-- Emotion Picker Section -->
      <div class="section section--wide accordion section--collapsed" id="emotion-section">
        <div class="section__header accordion__header">
          <div class="accordion__meta">
            <span id="emotion-count" class="accordion__count">0</span>
          </div>
          <div class="accordion__title-group">
            <h2 class="section__title">💭 How I Feel <span class="accordion__icon">▼</span></h2>
            <span id="current-emotion-badge" class="accordion__badge">None set</span>
          </div>
          <div class="accordion__controls">
            <input class="form-input accordion__search" type="text" id="emotion-search" placeholder="🔍 Search emotions..." />
          </div>
        </div>

        <div class="accordion__content">
          <div class="accordion__toolbar">
            <div class="sort-controls" id="emotions-sort-controls">
              <label style="font-size:11px; opacity:0.6;">Sort:</label>
              <select id="emotions-sort" class="sort-select" title="Sort emotions">
                <option value="category">Category</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
                <option value="pos-neg">Best → Worst</option>
                <option value="neg-pos">Worst → Best</option>
              </select>
            </div>
          </div>
          <div id="emotions-grid" class="accordion__grid">
            <span style="opacity:0.5">Loading emotions...</span>
          </div>
        </div>
      </div>

      <!-- Actions Section (RPG System) -->
      <div class="section section--wide accordion section--collapsed" id="actions-section">
        <div class="section__header accordion__header">
          <div class="accordion__title-group">
            <h2 class="section__title">▸ Actions <span class="accordion__icon">▼</span></h2>
            <span id="actions-count" class="accordion__count"></span>
          </div>
          <div class="accordion__controls">
            <input class="form-input accordion__search" type="text" id="action-search" placeholder="🔍 Search actions..." />
          </div>
        </div>

        <div class="accordion__content">
          <div class="accordion__toolbar">
            <div class="filter-tabs" id="actions-filter-tabs" style="margin-bottom:0;">
              <button class="filter-tab filter-tab--active" data-actions-filter="all">All</button>
            </div>
            <div class="sort-controls" id="actions-sort-controls">
              <label style="font-size:11px; opacity:0.6;">Sort:</label>
              <select id="actions-sort" class="sort-select" title="Sort actions">
                <option value="category">Category</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
                <option value="recent">Recent First</option>
                <option value="oldest">Oldest First</option>
                <option value="pos-neg">Best → Worst</option>
                <option value="neg-pos">Worst → Best</option>
              </select>
            </div>
          </div>

          <div id="actions-grid" class="accordion__grid">
            <span style="opacity:0.5">Loading actions...</span>
          </div>
        </div>
      </div>

      <!-- Tasks Section -->
      <div class="section" id="tasks-section">
        <div class="section__header">
          <h2 class="section__title">⚔️ Daily Quests</h2>
          <button class="btn btn--primary btn--sm" id="btn-add-task">+ New Quest</button>
        </div>

        <div class="filter-tabs" id="filter-tabs">
          <button class="filter-tab filter-tab--active" data-filter="all">All</button>
          ${CATEGORIES.map(c => `<button class="filter-tab" data-filter="${c}">${STAT_META[c].icon} ${STAT_META[c].name}</button>`).join('')}
        </div>

        <div class="tasks-grid" id="tasks-grid">
          <div class="empty-state" style="grid-column:1/-1">
            <span class="empty-state__icon">⚔️</span>
            <p class="empty-state__text">Loading quests...</p>
          </div>
        </div>
      </div>

      <!-- Habits Section -->
      <div class="section" id="habits-section">
        <div class="section__header">
          <h2 class="section__title">🌿 Habits</h2>
          <button class="btn btn--primary btn--sm" id="btn-add-habit">+ New Habit</button>
        </div>

        <div class="habits-grid" id="habits-grid">
          <div>
            <div class="habits-column__title">🟢 Good Habits</div>
            <div class="habits-list" id="habits-positive"></div>
          </div>
          <div>
            <div class="habits-column__title">🔴 Bad Habits</div>
            <div class="habits-list" id="habits-negative"></div>
          </div>
        </div>
      </div>

      <!-- Mini-Games Section -->
      <div class="section" id="games-section">
        <div class="section__header">
          <h2 class="section__title">🎮 Mini-Games</h2>
        </div>

        <div class="games-grid" id="games-grid">
          <div class="game-card" id="game-memory">
            <span class="game-card__icon">🧠</span>
            <h3 class="game-card__title">Memory Match</h3>
            <p class="game-card__desc">Test your memory! Match pairs of cards.</p>
            <button class="btn btn--blue btn--sm" data-game="memory">▶ Play</button>
          </div>
          <div class="game-card" id="game-speedtype">
            <span class="game-card__icon">⌨️</span>
            <h3 class="game-card__title">Speed Type</h3>
            <p class="game-card__desc">How fast can you type?</p>
            <button class="btn btn--blue btn--sm" data-game="speedtype">▶ Play</button>
          </div>
          <div class="game-card" id="game-trivia">
            <span class="game-card__icon">❓</span>
            <h3 class="game-card__title">Daily Trivia</h3>
            <p class="game-card__desc">Test your knowledge!</p>
            <button class="btn btn--blue btn--sm" data-game="trivia">▶ Play</button>
          </div>
        </div>
      </div>

      <!-- Activity Log (Admin) -->
      <div class="section" id="admin-log-section">
        <div class="section__header">
          <h2 class="section__title">📋 Activity Log</h2>
          <span id="log-count" style="font-size:12px; opacity:0.6"></span>
        </div>
        <div id="admin-log-list" style="max-height:400px; overflow-y:auto;">
          <span style="opacity:0.5">Loading log...</span>
        </div>
      </div>

    </div>

    <!-- Modal Container -->
    <div id="modal-container"></div>
  `;

  setupAccordionShell();
  attachEventListeners();
  await loadAllData();

  const refreshId = setInterval(loadAllData, 30000);
  registerInterval(refreshId);
}

function setupAccordionShell() {
  configureAccordionSection('emotion-section', {
    titleText: '💭 How I Feel',
    countId: 'emotion-count',
    searchResultsId: 'emotion-search-results',
    ariaLabel: 'Toggle How I Feel'
  });

  configureAccordionSection('actions-section', {
    titleText: 'Actions',
    countId: 'actions-count',
    searchResultsId: 'action-search-results',
    ariaLabel: 'Toggle Actions'
  });
}

function configureAccordionSection(sectionId, { titleText, countId, searchResultsId, ariaLabel }) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const header = section.querySelector('.accordion__header');
  const title = header?.querySelector('.section__title');
  const titleGroup = header?.querySelector('.accordion__title-group');
  const controls = header?.querySelector('.accordion__controls');
  const searchInput = controls?.querySelector('.accordion__search');
  if (!header || !title || !titleGroup || !controls) return;

  title.textContent = titleText;

  let meta = header.querySelector('.accordion__meta');
  if (!meta) {
    meta = document.createElement('div');
    meta.className = 'accordion__meta';
    header.insertBefore(meta, titleGroup);
  }

  let countEl = section.querySelector(`#${countId}`);
  if (!countEl) {
    countEl = document.createElement('span');
    countEl.id = countId;
    countEl.className = 'accordion__count';
    countEl.textContent = '0';
  }
  meta.replaceChildren(countEl);

  let toggle = header.querySelector('.accordion__toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'accordion__toggle';
    toggle.setAttribute('aria-label', ariaLabel);
    header.appendChild(toggle);
  }

  let icon = toggle.querySelector('.accordion__icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'accordion__icon';
    icon.textContent = '▼';
    toggle.appendChild(icon);
  }

  let searchResults = section.querySelector(`#${searchResultsId}`);
  if (!searchResults) {
    searchResults = document.createElement('div');
    searchResults.id = searchResultsId;
    searchResults.className = 'accordion__search-results';
    header.insertAdjacentElement('afterend', searchResults);
  }

  if (searchInput && !controls.querySelector('.accordion__search-wrap')) {
    const wrap = document.createElement('div');
    wrap.className = 'accordion__search-wrap';
    searchInput.parentNode.insertBefore(wrap, searchInput);
    wrap.appendChild(searchInput);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'accordion__clear';
    clearButton.setAttribute('aria-label', `Clear ${titleText} search`);
    clearButton.textContent = '×';
    clearButton.hidden = !searchInput.value;
    wrap.appendChild(clearButton);

    searchInput.addEventListener('input', () => {
      clearButton.hidden = !searchInput.value;
    });

    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      clearButton.hidden = true;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.focus();
    });
  }
}

function renderGroupedAccordionMarkup(entries, getCategoryLabel, getCategoryMeta = () => ({})) {
  if (entries.length === 0) {
    return '<span style="opacity:0.5">No matching results found.</span>';
  }

  const grouped = {};
  entries.forEach(entry => {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  });

  return Object.entries(grouped).map(([category, items]) => {
    const meta = getCategoryMeta(category) || {};
    return `
    <div style="width:100%; margin-bottom:8px;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.6; margin-bottom:4px; ${meta.style || ''}" ${meta.title ? `title="${meta.title}"` : ''}>
        ${getCategoryLabel(category)}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:3px;">
        ${items.map(item => item.markup).join('')}
      </div>
    </div>
  `;
  }).join('');
}

// ─── Data Loading ───────────────────────────────────────────────────

async function loadAllData() {
  try {
    const [p, t, h, acts, logs, emoCats, emoCurrent, allEmos] = await Promise.all([
      playerApi.get(),
      tasksApi.getAll(),
      habitsApi.getAll(),
      actionsApi.getAll(),
      actionsApi.getLog(100),
      emotionsApi.getCategories().catch(() => []),
      emotionsApi.getCurrent().catch(() => ({ emotion: null })),
      emotionsApi.getAll().catch(() => [])
    ]);

    playerData = p || {};
    tasksList = t || [];
    habitsList = h || [];
    actionsList = acts || [];
    actionLogList = logs || [];
    currentMood = playerData.currentMood || 'okay';
    emotionCategories = emoCats || [];
    emotionsList = allEmos || [];
    currentEmotion = emoCurrent?.emotion ? emoCurrent : null;

    // Build categories from actions
    const catSet = new Set(actionsList.map(a => a.category));
    categoriesList = [...catSet].sort();

    updateStatusBar();
    renderTasks();
    renderHabits();
    renderActions();
    renderAdminLog();
    updateMoodUI();
    renderEmotionPicker();
  } catch (err) {
    console.error('Data load error:', err);
    showToast('Failed to load data: ' + err.message, 'error');
  }
}

// ─── Status Bar Update ─────────────────────────────────────────────

function updateStatusBar() {
  const p = playerData;

  const nameEl = document.getElementById('sb-name');
  const levelEl = document.getElementById('sb-level');
  const goldEl = document.getElementById('sb-gold');
  const moodEl = document.getElementById('sb-mood');

  if (nameEl) nameEl.textContent = p.name || 'Hero';
  if (levelEl) {
    levelEl.textContent = `Lv ${p.level || 1}`;
    levelEl.classList.add('anim-pulse');
    setTimeout(() => levelEl.classList.remove('anim-pulse'), 400);
  }
  if (goldEl) goldEl.textContent = `💰 ${p.gold || 0}`;
  if (moodEl) moodEl.textContent = getMoodEmoji(p.currentMood);

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

// ─── Tasks Rendering ───────────────────────────────────────────────

function renderTasks() {
  const grid = document.getElementById('tasks-grid');
  if (!grid) return;

  let filtered = tasksList;
  if (activeFilter !== 'all') {
    filtered = tasksList.filter(t => t.category === activeFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state__icon">📋</span>
        <p class="empty-state__text">${activeFilter === 'all' ? 'No quests yet. Add your first quest!' : `No ${activeFilter} quests`}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(task => {
    const done = task.completedToday;
    const status = task.todayStatus;
    const catClass = task.category ? `task-card--${task.category}` : '';
    let statusClass = '';
    if (status === 'completed') statusClass = 'task-card--completed';
    else if (status === 'failed') statusClass = 'task-card--completed task-card--failed';
    else if (status === 'skipped') statusClass = 'task-card--completed task-card--skipped';

    return `
      <div class="task-card ${catClass} ${statusClass}" data-task-id="${task._id || task.id}">
        <div class="task-card__header">
          <span class="task-card__name">${task.name}</span>
          <span class="badge badge--${task.difficulty || 'medium'}">${task.difficulty || 'medium'}</span>
        </div>
        ${task.description ? `<p class="task-card__desc">${task.description}</p>` : ''}
        <div class="task-card__rewards">
          <span class="task-card__reward task-card__reward--xp">⚡ ${task.xpReward || 0} XP</span>
          <span class="task-card__reward task-card__reward--gold">💰 ${task.goldReward || 0} Gold</span>
        </div>
        ${done ? `
          <span class="task-card__status-badge task-card__status-badge--${status}">${status}</span>
        ` : `
          <div class="task-card__actions">
            <button class="btn btn--success btn--sm" data-action="complete" data-id="${task._id || task.id}">✅ Complete</button>
            <button class="btn btn--danger btn--sm" data-action="fail" data-id="${task._id || task.id}">❌ Fail</button>
            <button class="btn btn--ghost btn--sm" data-action="skip" data-id="${task._id || task.id}">⏭️ Skip</button>
          </div>
        `}
        ${task.completionCount ? `<p class="task-card__count">Done ${task.completionCount} times</p>` : ''}
      </div>
    `;
  }).join('');
}

// ─── Habits Rendering ──────────────────────────────────────────────

function renderHabits() {
  const posEl = document.getElementById('habits-positive');
  const negEl = document.getElementById('habits-negative');
  if (!posEl || !negEl) return;

  const positive = habitsList.filter(h => h.type === 'positive');
  const negative = habitsList.filter(h => h.type === 'negative');

  posEl.innerHTML = positive.length === 0
    ? '<p class="text-muted" style="padding:8px;font-size:0.85rem">No good habits yet</p>'
    : positive.map(renderHabitCard).join('');

  negEl.innerHTML = negative.length === 0
    ? '<p class="text-muted" style="padding:8px;font-size:0.85rem">No bad habits tracked</p>'
    : negative.map(renderHabitCard).join('');
}

function renderHabitCard(h) {
  const isPositive = h.type === 'positive';
  return `
    <div class="habit-card habit-card--${h.type}" data-habit-id="${h._id || h.id}">
      <span class="habit-card__icon">${h.icon || '⭐'}</span>
      <div class="habit-card__info">
        <div class="habit-card__name">${h.name}</div>
        <div class="habit-card__streak">
          <span class="habit-card__streak-fire">🔥</span> ${h.streak || 0} day streak
        </div>
      </div>
      <button class="btn ${isPositive ? 'btn--success' : 'btn--danger'} btn--sm habit-log-btn" data-habit-id="${h._id || h.id}">
        ${isPositive ? 'Did it! ✓' : 'Slipped 😔'}
      </button>
    </div>
  `;
}

// ─── Actions Rendering ─────────────────────────────────────────────

function renderActions() {
  const grid = document.getElementById('actions-grid');
  const countEl = document.getElementById('actions-count');
  const tabsEl = document.getElementById('actions-filter-tabs');
  if (!grid) return;

  const searchResultsEl = document.getElementById('action-search-results');

  if (tabsEl && categoriesList.length > 0) {
    tabsEl.innerHTML = `
      <button class="filter-tab ${actionsFilter === 'all' ? 'filter-tab--active' : ''}" data-actions-filter="all">All</button>
      ${categoriesList.map(c => `<button class="filter-tab ${actionsFilter === c ? 'filter-tab--active' : ''}" data-actions-filter="${c}">${CATEGORY_ICONS[c] || '▸'} ${c.replace(/_/g, ' ')}</button>`).join('')}
    `;
  }

  let filteredActions = actionsFilter === 'all' ? [...actionsList] : actionsList.filter(a => a.category === actionsFilter);

  if (actionSearchQuery) {
    const q = actionSearchQuery.toLowerCase();
    filteredActions = filteredActions.filter(a => a.label.toLowerCase().includes(q));
  }

  // Apply sorting
  if (actionsSort !== 'category') {
    filteredActions = [...filteredActions];
    if (actionsSort === 'az') filteredActions.sort((a, b) => a.label.localeCompare(b.label));
    else if (actionsSort === 'za') filteredActions.sort((a, b) => b.label.localeCompare(a.label));
    else if (actionsSort === 'recent') filteredActions.sort((a, b) => {
      const da = a.last_performed ? new Date(a.last_performed).getTime() : 0;
      const db = b.last_performed ? new Date(b.last_performed).getTime() : 0;
      return db - da;
    });
    else if (actionsSort === 'oldest') filteredActions.sort((a, b) => {
      const da = a.last_performed ? new Date(a.last_performed).getTime() : 0;
      const db = b.last_performed ? new Date(b.last_performed).getTime() : 0;
      return da - db;
    });
    else if (actionsSort === 'pos-neg' || actionsSort === 'neg-pos') {
      const getScore = a => (a.energy_delta||0) + (a.health_delta||0) + (a.social_delta||0) + (a.hygiene_delta||0) + (a.fun_delta||0) + (a.discipline_delta||0) + (a.money_delta||0) - (a.stress_delta||0);
      filteredActions.sort((a, b) => actionsSort === 'pos-neg' ? getScore(b) - getScore(a) : getScore(a) - getScore(b));
    }
  }

  if (countEl) countEl.textContent = `${actionsList.length}`;

  const actionEntries = filteredActions.map(a => {
    const deltas = [];
    if (a.energy_delta) deltas.push(`⚡${a.energy_delta > 0 ? '+' : ''}${a.energy_delta}`);
    if (a.health_delta) deltas.push(`❤${a.health_delta > 0 ? '+' : ''}${a.health_delta}`);
    if (a.stress_delta) deltas.push(`😰${a.stress_delta > 0 ? '+' : ''}${a.stress_delta}`);
    if (a.discipline_delta) deltas.push(`🎯${a.discipline_delta > 0 ? '+' : ''}${a.discipline_delta}`);
    if (a.fun_delta) deltas.push(`🎮${a.fun_delta > 0 ? '+' : ''}${a.fun_delta}`);
    if (a.money_delta) deltas.push(`$${a.money_delta > 0 ? '+' : ''}${a.money_delta}`);
    const tip = deltas.join(' ') || 'no stat change';

    const tint = getImpactTint({
      energy: a.energy_delta, health: a.health_delta, stress: a.stress_delta,
      social: a.social_delta, hygiene: a.hygiene_delta, fun: a.fun_delta,
      discipline: a.discipline_delta, money: a.money_delta
    });

    return {
      category: a.category,
      markup: `<button class="action-btn" data-action-id="${a.action_id}" title="${tip}" style="
        padding:3px 8px; font-size:12px; cursor:pointer; border:1px solid ${tint.border};
        background:${tint.bg}; border-radius:2px; white-space:nowrap;
      ">${a.label}</button>`
    };
  });

  const isSorted = actionsSort !== 'category';
  const actionMarkup = isSorted
    ? `<div style="display:flex; flex-wrap:wrap; gap:3px;">${actionEntries.map(e => e.markup).join('')}</div>`
    : renderGroupedAccordionMarkup(
        actionEntries,
        (cat) => `${CATEGORY_ICONS[cat] || '▸'} ${cat.replace(/_/g, ' ')}`
      );

  grid.innerHTML = actionEntries.length ? actionMarkup : '<span style="opacity:0.5">No actions found.</span>';

  if (searchResultsEl) {
    const showSearchResults = Boolean(actionSearchQuery);
    searchResultsEl.classList.toggle('accordion__search-results--visible', showSearchResults);
    searchResultsEl.innerHTML = showSearchResults
      ? (actionEntries.length ? actionMarkup : '<span style="opacity:0.5">No matching actions found.</span>')
      : '';
  }

  return;

  // Build category tabs (only once, or when categories change)
  if (tabsEl && categoriesList.length > 0) {
    tabsEl.innerHTML = `
      <button class="filter-tab ${actionsFilter === 'all' ? 'filter-tab--active' : ''}" data-actions-filter="all">All</button>
      ${categoriesList.map(c => `<button class="filter-tab ${actionsFilter === c ? 'filter-tab--active' : ''}" data-actions-filter="${c}">${CATEGORY_ICONS[c] || '▸'} ${c.replace(/_/g, ' ')}</button>`).join('')}
    `;
  }

  // Filter
  let filtered = actionsFilter === 'all' ? actionsList : actionsList.filter(a => a.category === actionsFilter);

  if (actionSearchQuery) {
    const q = actionSearchQuery.toLowerCase();
    filtered = filtered.filter(a => a.label.toLowerCase().includes(q));
  }

  if (countEl) countEl.textContent = `${filtered.length} / ${actionsList.length}`;

  if (filtered.length === 0) {
    grid.innerHTML = '<span style="opacity:0.5">No actions found.</span>';
    return;
  }

  // Group by category
  const grouped = {};
  filtered.forEach(a => {
    if (!grouped[a.category]) grouped[a.category] = [];
    grouped[a.category].push(a);
  });

  grid.innerHTML = Object.entries(grouped).map(([cat, acts]) => `
    <div style="width:100%; margin-bottom:8px;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.5; margin-bottom:4px;">${CATEGORY_ICONS[cat] || '▸'} ${cat.replace(/_/g, ' ')}</div>
      <div style="display:flex; flex-wrap:wrap; gap:3px;">
        ${acts.map(a => {
          const deltas = [];
          if (a.energy_delta) deltas.push(`⚡${a.energy_delta > 0 ? '+' : ''}${a.energy_delta}`);
          if (a.health_delta) deltas.push(`❤${a.health_delta > 0 ? '+' : ''}${a.health_delta}`);
          if (a.stress_delta) deltas.push(`😰${a.stress_delta > 0 ? '+' : ''}${a.stress_delta}`);
          if (a.discipline_delta) deltas.push(`🎯${a.discipline_delta > 0 ? '+' : ''}${a.discipline_delta}`);
          if (a.fun_delta) deltas.push(`🎮${a.fun_delta > 0 ? '+' : ''}${a.fun_delta}`);
          if (a.money_delta) deltas.push(`$${a.money_delta > 0 ? '+' : ''}${a.money_delta}`);
          const tip = deltas.join(' ') || 'no stat change';
          return `<button class="action-btn" data-action-id="${a.action_id}" title="${tip}" style="
            padding:3px 8px; font-size:12px; cursor:pointer; border:1px solid #ddd;
            background:#fff; border-radius:2px; white-space:nowrap;
          ">${a.label}</button>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ─── Admin Activity Log ────────────────────────────────────────────

function renderAdminLog() {
  const listEl = document.getElementById('admin-log-list');
  const countEl = document.getElementById('log-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `${actionLogList.length} entries`;

  if (actionLogList.length === 0) {
    listEl.innerHTML = '<div style="opacity:0.5; padding:8px 0;">No actions logged yet.</div>';
    return;
  }

  listEl.innerHTML = actionLogList.map(log => {
    const deltas = [];
    if (log.energy_delta) deltas.push(`⚡${log.energy_delta > 0 ? '+' : ''}${log.energy_delta}`);
    if (log.health_delta) deltas.push(`❤${log.health_delta > 0 ? '+' : ''}${log.health_delta}`);
    if (log.stress_delta) deltas.push(`😰${log.stress_delta > 0 ? '+' : ''}${log.stress_delta}`);
    if (log.hygiene_delta) deltas.push(`🧼${log.hygiene_delta > 0 ? '+' : ''}${log.hygiene_delta}`);
    if (log.discipline_delta) deltas.push(`🎯${log.discipline_delta > 0 ? '+' : ''}${log.discipline_delta}`);
    if (log.fun_delta) deltas.push(`🎮${log.fun_delta > 0 ? '+' : ''}${log.fun_delta}`);
    if (log.social_delta) deltas.push(`🤝${log.social_delta > 0 ? '+' : ''}${log.social_delta}`);
    if (log.money_delta) deltas.push(`💵${log.money_delta > 0 ? '+' : ''}${log.money_delta}`);
    const deltaStr = deltas.join('  ') || '';

    const time = timeAgo(log.performed_at);
    const catIcon = CATEGORY_ICONS[log.category] || '▸';

    return `<div style="display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px solid #eee; font-size:12px;" data-log-id="${log.id}">
      <span style="opacity:0.4; min-width:60px;">${time}</span>
      <span>${catIcon}</span>
      <span style="font-weight:500; min-width:120px;">${log.action_label}</span>
      <span style="opacity:0.6; flex:1;">${deltaStr}</span>
      <button class="undo-log-btn" data-log-id="${log.id}" style="
        font-size:11px; padding:1px 6px; cursor:pointer; border:1px solid #ddd;
        background:#fff; color:#c00; border-radius:2px;
      " title="Undo this action and revert its stat impact">⟲ Undo</button>
    </div>`;
  }).join('');
}

// ─── Mood UI ───────────────────────────────────────────────────────

function updateMoodUI() {
  const buttons = document.querySelectorAll('.mood-btn');
  buttons.forEach(btn => {
    if (btn.dataset.mood === currentMood) {
      btn.classList.add('mood-btn--active');
    } else {
      btn.classList.remove('mood-btn--active');
    }
  });

  const modEl = document.getElementById('mood-modifier');
  if (modEl) modEl.textContent = `XP Modifier: ${getMoodModifier(currentMood)}`;
}

// ─── Emotion Picker ────────────────────────────────────────────────

const EMO_CAT_COLORS = {
  accepting_open: '#10b981', connected_loving: '#ec4899', curious: '#f59e0b',
  tender: '#f9a8d4', aliveness_joy: '#facc15', courageous_powerful: '#ef4444',
  grateful: '#a78bfa', hopeful: '#34d399',
  angry_annoyed: '#dc2626', guilt: '#9ca3af', despair_sad: '#3b82f6',
  fragile: '#c084fc', disconnected_numb: '#6b7280', embarrassed_shame: '#f97316',
  powerless: '#64748b', fear: '#1e293b', stressed_tense: '#fb923c',
  unsettled_doubt: '#78716c'
};

function renderEmotionPicker() {
  const grid = document.getElementById('emotions-grid');
  const badgeEl = document.getElementById('current-emotion-badge');
  if (!grid) return;

  const countEl = document.getElementById('emotion-count');
  const searchResultsEl = document.getElementById('emotion-search-results');

  if (countEl) countEl.textContent = `${emotionsList.length}`;

  // Update current emotion badge
  if (badgeEl) {
    if (currentEmotion?.emotion) {
      badgeEl.textContent = `${currentEmotion.emotion} (${currentEmotion.category_label || currentEmotion.category_id})`;
      badgeEl.style.background = '#f3f0ff';
      badgeEl.style.color = '#7c3aed';
    } else {
      badgeEl.textContent = 'None set';
      badgeEl.style.background = '#f1f5f9';
      badgeEl.style.color = '#94a3b8';
    }
  }

  if (emotionCategories.length === 0 || emotionsList.length === 0) {
    grid.innerHTML = '<span style="opacity:0.5">No emotions loaded.</span>';
    if (searchResultsEl) {
      searchResultsEl.classList.toggle('accordion__search-results--visible', Boolean(emotionSearchQuery));
      searchResultsEl.innerHTML = emotionSearchQuery ? '<span style="opacity:0.5">No matching emotions found.</span>' : '';
    }
    return;
  }

  let filteredEntries = [...emotionsList];
  if (emotionSearchQuery) {
    const q = emotionSearchQuery.toLowerCase();
    filteredEntries = filteredEntries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.brief_description && e.brief_description.toLowerCase().includes(q))
    );
  }

  const emotionCategoryMap = new Map(emotionCategories.map(cat => [cat.category_id, cat]));

  // Apply sorting
  if (emotionsSort !== 'category') {
    if (emotionsSort === 'az') filteredEntries.sort((a, b) => a.name.localeCompare(b.name));
    else if (emotionsSort === 'za') filteredEntries.sort((a, b) => b.name.localeCompare(a.name));
    else if (emotionsSort === 'pos-neg' || emotionsSort === 'neg-pos') {
      const getScore = e => {
        const cat = emotionCategoryMap.get(e.category_id);
        return (cat?.energy_flat||0) + (cat?.health_flat||0) + (cat?.social_flat||0) + (cat?.fun_flat||0) + (cat?.discipline_flat||0) - (cat?.stress_flat||0);
      };
      filteredEntries.sort((a, b) => emotionsSort === 'pos-neg' ? getScore(b) - getScore(a) : getScore(a) - getScore(b));
    }
  }

  const entries = filteredEntries.map(e => {
    const cat = emotionCategoryMap.get(e.category_id);
    const color = EMO_CAT_COLORS[e.category_id] || '#888';
    const modifiers = [];
    if (cat?.energy_flat) modifiers.push(`⚡${cat.energy_flat > 0 ? '+' : ''}${cat.energy_flat}`);
    if (cat?.health_flat) modifiers.push(`❤${cat.health_flat > 0 ? '+' : ''}${cat.health_flat}`);
    if (cat?.stress_flat) modifiers.push(`😰${cat.stress_flat > 0 ? '+' : ''}${cat.stress_flat}`);
    if (cat?.discipline_flat) modifiers.push(`🎯${cat.discipline_flat > 0 ? '+' : ''}${cat.discipline_flat}`);
    if (cat?.fun_flat) modifiers.push(`🎮${cat.fun_flat > 0 ? '+' : ''}${cat.fun_flat}`);
    if (cat?.social_flat) modifiers.push(`🤝${cat.social_flat > 0 ? '+' : ''}${cat.social_flat}`);
    const catTip = modifiers.join(' ') || 'No stat effects';
    const isActive = currentEmotion?.emotion === e.name && currentEmotion?.category_id === e.category_id;

    const tint = getImpactTint({
      energy: cat?.energy_flat, health: cat?.health_flat, stress: cat?.stress_flat,
      social: cat?.social_flat, fun: cat?.fun_flat, discipline: cat?.discipline_flat,
      money: 0, hygiene: 0
    });

    return {
      category: e.category_id,
      markup: `<button class="emo-btn" data-emo-name="${e.name}" data-emo-cat="${e.category_id}" title="${e.brief_description || ''} \n\nGrants: ${catTip}" style="
        padding:3px 8px; font-size:12px; cursor:pointer; border-radius:12px; white-space:nowrap;
        border:1px solid ${isActive ? color : tint.border};
        background:${isActive ? color : tint.bg};
        color:${isActive ? '#fff' : '#444'};
        font-weight:${isActive ? '600' : '400'};
        transition:all 0.15s;
      ">${e.name}</button>`
    };
  });

  const isEmoSorted = emotionsSort !== 'category';
  const markup = isEmoSorted
    ? `<div style="display:flex; flex-wrap:wrap; gap:3px;">${entries.map(e => e.markup).join('')}</div>`
    : renderGroupedAccordionMarkup(
        entries,
        (catId) => emotionCategoryMap.get(catId)?.label || catId,
        (catId) => {
          const color = EMO_CAT_COLORS[catId] || '#888';
          const cat = emotionCategoryMap.get(catId);
          const modifiers = [];
          if (cat?.energy_flat) modifiers.push(`⚡${cat.energy_flat > 0 ? '+' : ''}${cat.energy_flat}`);
          if (cat?.health_flat) modifiers.push(`❤${cat.health_flat > 0 ? '+' : ''}${cat.health_flat}`);
          if (cat?.stress_flat) modifiers.push(`😰${cat.stress_flat > 0 ? '+' : ''}${cat.stress_flat}`);
          if (cat?.discipline_flat) modifiers.push(`🎯${cat.discipline_flat > 0 ? '+' : ''}${cat.discipline_flat}`);
          if (cat?.fun_flat) modifiers.push(`🎮${cat.fun_flat > 0 ? '+' : ''}${cat.fun_flat}`);
          if (cat?.social_flat) modifiers.push(`🤝${cat.social_flat > 0 ? '+' : ''}${cat.social_flat}`);
          const catTip = modifiers.join(' ') || 'No stat effects';
          return {
            style: `color:${color}; font-weight:700;`,
            title: `Base stats: ${catTip}`
          };
        }
      );

  grid.innerHTML = entries.length ? markup : '<span style="opacity:0.5">No matching emotions found.</span>';

  if (searchResultsEl) {
    const showSearchResults = Boolean(emotionSearchQuery);
    searchResultsEl.classList.toggle('accordion__search-results--visible', showSearchResults);
    searchResultsEl.innerHTML = showSearchResults
      ? (entries.length ? markup : '<span style="opacity:0.5">No matching emotions found.</span>')
      : '';
  }

  return;

  if (emotionCategories.length === 0 || emotionsList.length === 0) {
    grid.innerHTML = '<span style="opacity:0.5">No emotions loaded.</span>';
    return;
  }

  let filtered = emotionsList;
  if (emotionSearchQuery) {
    const q = emotionSearchQuery.toLowerCase();
    filtered = emotionsList.filter(e => 
      e.name.toLowerCase().includes(q) || 
      (e.brief_description && e.brief_description.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<span style="opacity:0.5">No matching emotions found.</span>';
    return;
  }

  // Group emotions by category
  const grouped = {};
  filtered.forEach(e => {
    if (!grouped[e.category_id]) grouped[e.category_id] = [];
    grouped[e.category_id].push(e);
  });

  // Render categories (maintaining alphabetical or predefined order from DB)
  grid.innerHTML = emotionCategories.map(cat => {
    const acts = grouped[cat.category_id] || [];
    if (acts.length === 0) return '';
    
    const color = EMO_CAT_COLORS[cat.category_id] || '#888';
    
    // Build stat tooltip for category
    const modifiers = [];
    if (cat.energy_flat) modifiers.push(`⚡${cat.energy_flat > 0 ? '+' : ''}${cat.energy_flat}`);
    if (cat.health_flat) modifiers.push(`❤${cat.health_flat > 0 ? '+' : ''}${cat.health_flat}`);
    if (cat.stress_flat) modifiers.push(`😰${cat.stress_flat > 0 ? '+' : ''}${cat.stress_flat}`);
    if (cat.discipline_flat) modifiers.push(`🎯${cat.discipline_flat > 0 ? '+' : ''}${cat.discipline_flat}`);
    if (cat.fun_flat) modifiers.push(`🎮${cat.fun_flat > 0 ? '+' : ''}${cat.fun_flat}`);
    if (cat.social_flat) modifiers.push(`🤝${cat.social_flat > 0 ? '+' : ''}${cat.social_flat}`);
    const catTip = modifiers.join(' ') || 'No stat effects';

    return `
      <div style="width:100%; margin-bottom:8px;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.6; margin-bottom:4px; color:${color}; font-weight:700;" title="Base stats: ${catTip}">
          ${cat.label}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:3px;">
          ${acts.map(e => {
            const isActive = currentEmotion?.emotion === e.name && currentEmotion?.category_id === cat.category_id;
            return `<button class="emo-btn" data-emo-name="${e.name}" data-emo-cat="${cat.category_id}" title="${e.brief_description || ''} \n\nGrants: ${catTip}" style="
              padding:3px 8px; font-size:12px; cursor:pointer; border-radius:12px; white-space:nowrap;
              border:1px solid ${isActive ? color : '#ddd'};
              background:${isActive ? color : '#fff'};
              color:${isActive ? '#fff' : '#444'};
              font-weight:${isActive ? '600' : '400'};
              transition:all 0.15s;
            ">${e.name}</button>`;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ─── Event Listeners ───────────────────────────────────────────────

async function handleEmotionSelection(e) {
  const btn = e.target.closest('.emo-btn');
  if (!btn) return;

  const emotionName = btn.dataset.emoName;
  const catId = btn.dataset.emoCat;
  if (!emotionName || !catId) return;

  btn.disabled = true;
  btn.style.opacity = '0.5';

  try {
    const result = await emotionsApi.log(emotionName, catId, 3, '');
    currentEmotion = {
      emotion: result.emotion,
      category_id: result.category_id,
      category_label: result.category_label,
      tier: result.tier
    };

    if (result.player) {
      playerData = result.player;
    }
    currentMood = result.mood;
    updateMoodUI();
    updateStatusBar();

    const xp = result.xpEarned || 0;
    const gold = result.goldEarned || 0;
    let msg = `💭 ${emotionName}`;
    if (xp > 0) msg += ` ⚡+${xp} XP`;
    if (gold > 0) msg += ` 💰+${gold} G`;

    showToast(msg, 'success');

    if (result.leveledUp) {
      showToast('🎉 LEVEL UP! Level ' + (result.newLevel || '??'), 'levelup');
    }

    renderEmotionPicker();
  } catch (err) {
    showToast('Failed to log emotion: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.style.opacity = '1';
}

async function handleActionSelection(e) {
  const btn = e.target.closest('.action-btn');
  if (!btn) return;

  const actionId = btn.dataset.actionId;
  if (!actionId) return;
  btn.disabled = true;
  btn.style.opacity = '0.4';

  try {
    const result = await actionsApi.perform(actionId);
    const xp = result?.xpEarned || 0;
    const gold = result?.goldEarned || 0;
    let msg = `${result?.action || 'Action'} done!`;
    if (xp) msg += ` ⚡+${xp} XP`;
    if (gold) msg += ` 💰+${gold} G`;
    showToast(msg, 'success');

    if (result?.leveledUp) {
      showToast('🎉 LEVEL UP! Level ' + (result.newLevel || '??'), 'levelup');
    }

    if (result?.player) {
      playerData = result.player;
      updateStatusBar();
    }

    setTimeout(() => { btn.disabled = false; btn.style.opacity = '1'; }, 500);
    loadAllData().catch(() => {});
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

function attachEventListeners() {
  const container = document.querySelector('.admin-content');
  if (!container) return;

  document.getElementById('emotion-search-results')?.addEventListener('click', handleEmotionSelection);
  document.getElementById('action-search-results')?.addEventListener('click', handleActionSelection);

  // ─── Logout ─────────────────────────────────────────────────
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      await auth.logout();
    } catch (_) {}
    navigate('#login');
  });

  // ─── Navigation ───────────────────────────────────────────────
  document.getElementById('btn-public')?.addEventListener('click', () => navigate('#dashboard'));
  document.getElementById('btn-settings')?.addEventListener('click', () => navigate('#settings'));

  // ─── Refresh ────────────────────────────────────────────────
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadAllData();
    showToast('Data refreshed', 'info');
  });

  // ─── Reset Dropdown ──────────────────────────────────────────
  document.getElementById('select-reset')?.addEventListener('change', async (e) => {
    const mode = e.target.value;
    if (!mode) return;

    const revertStats = document.getElementById('chk-revert-stats')?.checked || false;
    const labels = { 
      daily: 'daily tasks', 
      '1hour': 'last 1 hour', 
      '6hours': 'last 6 hours', 
      '3days': 'last 3 days', 
      all: 'everything' 
    };
    
    if (mode === 'all' && !confirm('Clear ALL data? This cannot be undone.')) {
      e.target.value = '';
      return;
    }

    try {
      if (mode === 'daily') {
        await tasksApi.resetDaily();
      } else if (mode === '1hour' || mode === '6hours' || mode === '3days' || mode === 'all') {
        const _isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const _apiBase = _isDev ? '' : 'https://api-battalion.jeffersonwm.com';
        // 1hour and 6hours imply reverting stats automatically
        const forceRevert = (mode === '1hour' || mode === '6hours') ? 'true' : revertStats;
        const res = await fetch(`${_apiBase}/api/tasks/clear?mode=${mode}&revert_stats=${forceRevert}`, { method: 'POST', credentials: 'include' });
        if (!res.ok) throw new Error('Clear failed');
      }
      const extra = (revertStats || mode === '1hour' || mode === '6hours') ? ' (stats reverted)' : '';
      showToast(`Reset ${labels[mode]}${extra}!`, 'info');
      await loadAllData();
    } catch (err) {
      showToast('Reset failed: ' + err.message, 'error');
    }

    e.target.value = '';
    if (document.getElementById('chk-revert-stats')) document.getElementById('chk-revert-stats').checked = false;
  });

  // ─── Undo Single Action Log ─────────────────────────────────
  document.getElementById('admin-log-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.undo-log-btn');
    if (!btn) return;

    const logId = btn.dataset.logId;
    if (!logId) return;
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const _isDev2 = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const _apiBase2 = _isDev2 ? '' : 'https://api-battalion.jeffersonwm.com';
      const res = await fetch(`${_apiBase2}/api/actions/log/${logId}/undo`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Undo failed'); }
      const result = await res.json();
      showToast(`Undone: ${result.action_label || 'action'}`, 'info');

      // Remove from local list and re-render
      actionLogList = actionLogList.filter(l => l.id != logId);
      renderAdminLog();

      // Update player
      if (result.player) {
        playerData = result.player;
        updateStatusBar();
      }

      loadAllData().catch(() => {});
    } catch (err) {
      showToast('Undo failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '⟲ Undo';
    }
  });

  // ─── Emotion Selection (event delegation) ─────────────────────
  document.getElementById('emotions-grid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.emo-btn');
    if (!btn) return;

    const emotionName = btn.dataset.emoName;
    const catId = btn.dataset.emoCat;
    if (!emotionName || !catId) return;

    btn.disabled = true;
    btn.style.opacity = '0.5';

    try {
      const result = await emotionsApi.log(emotionName, catId, 3, '');
      currentEmotion = {
        emotion: result.emotion,
        category_id: result.category_id,
        category_label: result.category_label,
        tier: result.tier
      };

      // Update locally
      if (result.player) {
        playerData = result.player;
      }
      currentMood = result.mood;
      updateMoodUI();
      updateStatusBar();

      const xp = result.xpEarned || 0;
      const gold = result.goldEarned || 0;
      let msg = `💭 ${emotionName}`;
      if (xp > 0) msg += ` ⚡+${xp} XP`;
      if (gold > 0) msg += ` 💰+${gold} G`;
      
      showToast(msg, 'success');

      if (result.leveledUp) {
        showToast('🎉 LEVEL UP! Level ' + (result.newLevel || '??'), 'levelup');
      }

      renderEmotionPicker();
    } catch (err) {
      showToast('Failed to log emotion: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.style.opacity = '1';
  });

  // ─── Filter Tabs (Tasks) ─────────────────────────────────────
  document.getElementById('filter-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;

    document.querySelectorAll('#filter-tabs .filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
    tab.classList.add('filter-tab--active');
    activeFilter = tab.dataset.filter;
    renderTasks();
  });

  // ─── Actions Filter Tabs ────────────────────────────────────
  document.getElementById('actions-filter-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-actions-filter]');
    if (!tab) return;
    actionsFilter = tab.dataset.actionsFilter;
    renderActions();
  });

  // ─── Action Perform (event delegation) ──────────────────────
  document.getElementById('actions-grid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;

    const actionId = btn.dataset.actionId;
    if (!actionId) return;
    btn.disabled = true;
    btn.style.opacity = '0.4';

    try {
      const result = await actionsApi.perform(actionId);
      const xp = result?.xpEarned || 0;
      const gold = result?.goldEarned || 0;
      let msg = `${result?.action || 'Action'} done!`;
      if (xp) msg += ` ⚡+${xp} XP`;
      if (gold) msg += ` 💰+${gold} G`;
      showToast(msg, 'success');

      if (result?.leveledUp) {
        showToast('🎉 LEVEL UP! Level ' + (result.newLevel || '??'), 'levelup');
      }

      // Update player locally
      if (result?.player) {
        playerData = result.player;
        updateStatusBar();
      }

      // Re-enable after brief cooldown
      setTimeout(() => { btn.disabled = false; btn.style.opacity = '1'; }, 500);

      // Background sync
      loadAllData().catch(() => {});
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  });

  // ─── Task Actions (event delegation) ────────────────────────
  document.getElementById('tasks-grid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    btn.disabled = true;

    try {
      const result = await tasksApi.complete(id, action === 'complete' ? 'completed' : action === 'fail' ? 'failed' : 'skipped');

      if (action === 'complete') {
        const xp = result?.xpEarned || result?.xp || 0;
        const gold = result?.goldEarned || result?.gold || 0;
        let msg = `Quest completed!`;
        if (xp) msg += ` ⚡ +${xp} XP`;
        if (gold) msg += ` 💰 +${gold} Gold`;
        showToast(msg, 'success');

        if (result?.leveledUp) {
          showToast('🎉 LEVEL UP! You reached level ' + (result.newLevel || '??'), 'levelup');
          const bar = document.querySelector('.status-bar');
          if (bar) { bar.classList.add('anim-level-up'); setTimeout(() => bar.classList.remove('anim-level-up'), 800); }
        }
      } else if (action === 'fail') {
        showToast('Quest failed. Don\'t give up!', 'warning');
      } else {
        showToast('Quest skipped.', 'info');
      }

      // Update locally from response instead of full reload
      if (result?.player) {
        playerData = result.player;
        updateStatusBar();
      }
      // Mark task done in local list
      const taskIdx = tasksList.findIndex(t => t.id == id);
      if (taskIdx >= 0) tasksList[taskIdx].is_completed_today = 1;
      renderTasks();
      // Background sync (non-blocking)
      loadAllData().catch(() => {});
    } catch (err) {
      showToast('Action failed: ' + err.message, 'error');
      btn.disabled = false;
    }
  });

  // ─── Add Task Button ────────────────────────────────────────
  document.getElementById('btn-add-task')?.addEventListener('click', () => showTaskModal());

  // ─── Habit Log (event delegation) ───────────────────────────
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.habit-log-btn');
    if (!btn) return;

    const id = btn.dataset.habitId;
    if (!id) return;
    btn.disabled = true;

    try {
      const result = await habitsApi.log(id);
      const xp = result?.xpEarned || result?.xp || 0;
      const gold = result?.goldEarned || result?.gold || 0;
      let msg = 'Habit logged!';
      if (xp) msg += ` ⚡ +${xp} XP`;
      if (gold) msg += ` 💰 +${gold} Gold`;
      showToast(msg, 'success');
      // Update locally from response
      if (result?.player) {
        playerData = result.player;
        updateStatusBar();
      }
      renderHabits();
      // Background sync (non-blocking)
      loadAllData().catch(() => {});
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
      btn.disabled = false;
    }
  });

  // ─── Add Habit Button ───────────────────────────────────────
  document.getElementById('btn-add-habit')?.addEventListener('click', () => showHabitModal());

  // ─── Mood Buttons ───────────────────────────────────────────
  document.getElementById('mood-buttons')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;

    const moodVal = btn.dataset.mood;
    const note = document.getElementById('mood-note-input')?.value || '';

    try {
      await moodApi.log(moodVal, note);
      currentMood = moodVal;
      updateMoodUI();
      const sbMood = document.getElementById('sb-mood');
      if (sbMood) { sbMood.textContent = getMoodEmoji(moodVal); sbMood.classList.add('anim-pulse'); setTimeout(() => sbMood.classList.remove('anim-pulse'), 400); }
      showToast(`Mood set to ${moodVal} ${getMoodEmoji(moodVal)}`, 'info');
    } catch (err) {
      showToast('Failed to set mood: ' + err.message, 'error');
    }
  });

  // ─── Mini-Game Play Buttons ─────────────────────────────────
  document.getElementById('games-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-game]');
    if (!btn) return;
    const game = btn.dataset.game;

    if (game === 'memory') startMemoryGame();
    else if (game === 'speedtype') startSpeedTypeGame();
    else if (game === 'trivia') startTriviaGame();
  });

  // ─── Accordion Toggles ──────────────────────────────────────
  container.addEventListener('click', (e) => {
    const header = e.target.closest('.accordion__header');
    if (!header) return;
    if (e.target.closest('.accordion__controls')) return;
    const section = header.closest('.section');
    if (section) {
      section.classList.toggle('section--collapsed');
    }
  });

  // ─── Live Search Inputs ─────────────────────────────────────
  document.getElementById('emotion-search')?.addEventListener('input', (e) => {
    emotionSearchQuery = e.target.value;
    renderEmotionPicker();
  });

  document.getElementById('action-search')?.addEventListener('input', (e) => {
    actionSearchQuery = e.target.value;
    renderActions();
  });

  // ─── Sort Dropdowns ─────────────────────────────────────────
  document.getElementById('actions-sort')?.addEventListener('change', (e) => {
    actionsSort = e.target.value;
    renderActions();
  });

  document.getElementById('emotions-sort')?.addEventListener('change', (e) => {
    emotionsSort = e.target.value;
    renderEmotionPicker();
  });
}

// ─── Task Modal ─────────────────────────────────────────────────────

function showTaskModal(editTask = null) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!editTask;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">${isEdit ? '✏️ Edit Quest' : '⚔️ New Quest'}</h3>
          <button class="modal__close" id="modal-close">✕</button>
        </div>
        <form class="modal__form" id="task-form">
          <div class="form-group">
            <label class="form-label">Quest Name</label>
            <input class="form-input" type="text" name="name" value="${editTask?.name || ''}" placeholder="e.g., Morning Workout" required />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-input" name="description" placeholder="Optional details...">${editTask?.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" name="category">
              ${CATEGORIES.map(c => `<option value="${c}" ${editTask?.category === c ? 'selected' : ''}>${STAT_META[c].icon} ${STAT_META[c].name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <select class="form-select" name="difficulty">
              ${DIFFICULTIES.map(d => `<option value="${d}" ${editTask?.difficulty === d ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Recurrence</label>
            <select class="form-select" name="recurrence">
              <option value="daily" ${editTask?.recurrence === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekdays" ${editTask?.recurrence === 'weekdays' ? 'selected' : ''}>Weekdays</option>
              <option value="weekends" ${editTask?.recurrence === 'weekends' ? 'selected' : ''}>Weekends</option>
              <option value="weekly" ${editTask?.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="once" ${editTask?.recurrence === 'once' ? 'selected' : ''}>One-time</option>
            </select>
          </div>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn--primary">${isEdit ? 'Save Changes' : 'Create Quest'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  setupModalClose(modalContainer);

  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      if (isEdit) {
        await tasksApi.update(editTask._id || editTask.id, data);
        showToast('Quest updated!', 'success');
      } else {
        await tasksApi.create(data);
        showToast('New quest created! ⚔️', 'success');
      }
      closeModal(modalContainer);
      await loadAllData();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

// ─── Habit Modal ────────────────────────────────────────────────────

function showHabitModal(editHabit = null) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!editHabit;
  const selectedIcon = editHabit?.icon || '💪';

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">${isEdit ? '✏️ Edit Habit' : '🌿 New Habit'}</h3>
          <button class="modal__close" id="modal-close">✕</button>
        </div>
        <form class="modal__form" id="habit-form">
          <div class="form-group">
            <label class="form-label">Habit Name</label>
            <input class="form-input" type="text" name="name" value="${editHabit?.name || ''}" placeholder="e.g., Drink water" required />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" name="type">
              <option value="positive" ${editHabit?.type === 'positive' ? 'selected' : ''}>🟢 Positive (build this habit)</option>
              <option value="negative" ${editHabit?.type === 'negative' ? 'selected' : ''}>🔴 Negative (break this habit)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" name="category">
              ${CATEGORIES.map(c => `<option value="${c}" ${editHabit?.category === c ? 'selected' : ''}>${STAT_META[c].icon} ${STAT_META[c].name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Icon</label>
            <input type="hidden" name="icon" id="habit-icon-value" value="${selectedIcon}" />
            <div class="emoji-picker" id="emoji-picker">
              ${HABIT_EMOJIS.map(e => `<button type="button" class="emoji-picker__btn ${e === selectedIcon ? 'emoji-picker__btn--selected' : ''}" data-emoji="${e}">${e}</button>`).join('')}
            </div>
          </div>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn--primary">${isEdit ? 'Save Changes' : 'Create Habit'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  setupModalClose(modalContainer);

  // Emoji picker
  document.getElementById('emoji-picker')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.emoji-picker__btn');
    if (!btn) return;
    document.querySelectorAll('.emoji-picker__btn').forEach(b => b.classList.remove('emoji-picker__btn--selected'));
    btn.classList.add('emoji-picker__btn--selected');
    document.getElementById('habit-icon-value').value = btn.dataset.emoji;
  });

  document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      if (isEdit) {
        await habitsApi.update(editHabit._id || editHabit.id, data);
        showToast('Habit updated!', 'success');
      } else {
        await habitsApi.create(data);
        showToast('New habit created! 🌿', 'success');
      }
      closeModal(modalContainer);
      await loadAllData();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

// ─── Modal Helpers ──────────────────────────────────────────────────

function setupModalClose(modalContainer) {
  document.getElementById('modal-close')?.addEventListener('click', () => closeModal(modalContainer));
  document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal(modalContainer));
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal(modalContainer);
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal(modalContainer);
      document.removeEventListener('keydown', escHandler);
    }
  });
}

function closeModal(modalContainer) {
  if (modalContainer) modalContainer.innerHTML = '';
}

// ═══════════════════════════════════════════════════════════════════
// MINI-GAMES
// ═══════════════════════════════════════════════════════════════════

// ─── Memory Match ───────────────────────────────────────────────────

function startMemoryGame() {
  const gameCard = document.getElementById('game-memory');
  if (!gameCard) return;

  const emojis = ['🐉', '🗡️', '🛡️', '🏰', '🧙', '💎', '🔮', '🦅'];
  let cards = [...emojis, ...emojis];
  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  let flipped = [];
  let matched = new Set();
  let moves = 0;
  let startTime = null;
  let timerInterval = null;
  let locked = false;

  gameCard.innerHTML = `
    <div class="game-inline">
      <button class="btn btn--ghost btn--sm game-inline__back" id="memory-back">← Back</button>
      <h3 class="game-card__title">🧠 Memory Match</h3>
      <div class="game-stats">
        <span>Moves: <span class="game-stats__value" id="mem-moves">0</span></span>
        <span>Time: <span class="game-stats__value" id="mem-time">0s</span></span>
      </div>
      <div class="memory-grid" id="memory-grid">
        ${cards.map((emoji, i) => `<div class="memory-cell memory-cell--hidden" data-index="${i}" data-emoji="${emoji}"></div>`).join('')}
      </div>
    </div>
  `;

  document.getElementById('memory-back')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    resetGameCard('game-memory', '🧠', 'Memory Match', 'Test your memory! Match pairs of cards.', 'memory');
  });

  document.getElementById('memory-grid')?.addEventListener('click', (e) => {
    const cell = e.target.closest('.memory-cell');
    if (!cell || locked) return;
    const idx = parseInt(cell.dataset.index);
    if (matched.has(idx) || flipped.includes(idx)) return;

    if (!startTime) {
      startTime = Date.now();
      timerInterval = setInterval(() => {
        const el = document.getElementById('mem-time');
        if (el) el.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
      }, 200);
    }

    // Flip
    cell.classList.remove('memory-cell--hidden');
    cell.classList.add('memory-cell--flipped');
    cell.textContent = cell.dataset.emoji;
    flipped.push(idx);

    if (flipped.length === 2) {
      moves++;
      document.getElementById('mem-moves').textContent = moves;
      const [a, b] = flipped;
      const cellA = document.querySelector(`[data-index="${a}"]`);
      const cellB = document.querySelector(`[data-index="${b}"]`);

      if (cards[a] === cards[b]) {
        matched.add(a);
        matched.add(b);
        cellA.classList.add('memory-cell--matched');
        cellB.classList.add('memory-cell--matched');
        flipped = [];

        if (matched.size === cards.length) {
          clearInterval(timerInterval);
          const seconds = Math.floor((Date.now() - startTime) / 1000);
          const score = Math.max(0, 1000 - (moves * 50) - (seconds * 10));
          finishGame('memory', score, gameCard, `Completed in ${moves} moves, ${seconds}s`);
        }
      } else {
        locked = true;
        setTimeout(() => {
          cellA.classList.remove('memory-cell--flipped');
          cellA.classList.add('memory-cell--hidden');
          cellA.textContent = '';
          cellB.classList.remove('memory-cell--flipped');
          cellB.classList.add('memory-cell--hidden');
          cellB.textContent = '';
          flipped = [];
          locked = false;
        }, 800);
      }
    }
  });
}

// ─── Speed Type ─────────────────────────────────────────────────────

const SPEED_TYPE_PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "A hero is someone who understands the responsibility that comes with freedom",
  "Every great adventure starts with a single step",
  "The dragon sleeps beneath the mountain of gold",
  "Fortune favors the bold and the disciplined",
  "In the darkest hour the light shines brightest",
  "The wizard cast a spell of incredible power",
  "Practice makes progress not perfection",
  "A journey of a thousand miles begins with one step",
  "Strength does not come from winning but from struggle",
  "The sword of destiny has two edges",
  "Every quest has a beginning but not every quest has an end",
  "Knowledge is the greatest weapon of all",
  "The bravest warriors are those who fight for others",
  "Time waits for no adventurer on their quest",
  "Gold earned through effort shines the brightest",
  "The ancient scrolls reveal secrets of forgotten realms",
  "Courage is not the absence of fear but action despite it",
  "A wise hero knows when to fight and when to rest",
  "Stars shine brightest in the darkest of skies",
  "The kingdom needs heroes now more than ever",
  "Legends are born from ordinary people doing extraordinary things"
];

function startSpeedTypeGame() {
  const gameCard = document.getElementById('game-speedtype');
  if (!gameCard) return;

  const phrase = SPEED_TYPE_PHRASES[Math.floor(Math.random() * SPEED_TYPE_PHRASES.length)];
  let startTime = null;

  gameCard.innerHTML = `
    <div class="game-inline">
      <button class="btn btn--ghost btn--sm game-inline__back" id="speed-back">← Back</button>
      <div class="speed-type">
        <h3 class="game-card__title">⌨️ Speed Type</h3>
        <div class="speed-type__phrase" id="speed-phrase">${phrase}</div>
        <input class="form-input" type="text" id="speed-input" placeholder="Start typing here..." autocomplete="off" autofocus />
        <div class="speed-type__stats">
          <span>Time: <span class="speed-type__stat-value" id="speed-time">0.0s</span></span>
          <span>WPM: <span class="speed-type__stat-value" id="speed-wpm">—</span></span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('speed-back')?.addEventListener('click', () => {
    resetGameCard('game-speedtype', '⌨️', 'Speed Type', 'How fast can you type?', 'speedtype');
  });

  const input = document.getElementById('speed-input');
  let timerInterval = null;

  input?.addEventListener('input', () => {
    if (!startTime) {
      startTime = Date.now();
      timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const el = document.getElementById('speed-time');
        if (el) el.textContent = elapsed + 's';
      }, 100);
    }

    const typed = input.value;

    // Highlight matching characters
    const phraseEl = document.getElementById('speed-phrase');
    if (phraseEl) {
      let html = '';
      for (let i = 0; i < phrase.length; i++) {
        if (i < typed.length) {
          if (typed[i] === phrase[i]) {
            html += `<span style="color:var(--positive-green)">${phrase[i]}</span>`;
          } else {
            html += `<span style="color:var(--hp-red);text-decoration:underline">${phrase[i]}</span>`;
          }
        } else {
          html += phrase[i];
        }
      }
      phraseEl.innerHTML = html;
    }

    // Check completion
    if (typed === phrase) {
      clearInterval(timerInterval);
      const seconds = (Date.now() - startTime) / 1000;
      const words = phrase.split(' ').length;
      const wpm = Math.round(words / (seconds / 60));
      const score = Math.floor(phrase.length / seconds * 100);

      const wpmEl = document.getElementById('speed-wpm');
      if (wpmEl) wpmEl.textContent = wpm;

      input.disabled = true;
      finishGame('speedtype', score, gameCard, `${wpm} WPM in ${seconds.toFixed(1)}s`);
    }
  });

  // Focus the input
  setTimeout(() => input?.focus(), 100);
}

// ─── Daily Trivia ───────────────────────────────────────────────────

const TRIVIA_POOL = [
  { question: "What is the largest planet in our solar system?", options: ["Mars", "Jupiter", "Saturn", "Neptune"], correct: 1 },
  { question: "Which element has the chemical symbol 'Au'?", options: ["Silver", "Aluminum", "Gold", "Argon"], correct: 2 },
  { question: "In which year did World War II end?", options: ["1943", "1944", "1945", "1946"], correct: 2 },
  { question: "What is the capital of Japan?", options: ["Osaka", "Kyoto", "Yokohama", "Tokyo"], correct: 3 },
  { question: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], correct: 1 },
  { question: "What is the hardest natural substance on Earth?", options: ["Iron", "Diamond", "Titanium", "Quartz"], correct: 1 },
  { question: "How many continents are there?", options: ["5", "6", "7", "8"], correct: 2 },
  { question: "What is the speed of light approximately?", options: ["150,000 km/s", "300,000 km/s", "450,000 km/s", "600,000 km/s"], correct: 1 },
  { question: "Which organ pumps blood through the body?", options: ["Brain", "Liver", "Heart", "Lungs"], correct: 2 },
  { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correct: 2 },
  { question: "Who painted the Mona Lisa?", options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], correct: 1 },
  { question: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correct: 2 },
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Mercury", "Jupiter"], correct: 1 },
  { question: "What is the boiling point of water in Celsius?", options: ["90°C", "95°C", "100°C", "105°C"], correct: 2 },
  { question: "Which country is known as the Land of the Rising Sun?", options: ["China", "Thailand", "Japan", "South Korea"], correct: 2 },
  { question: "How many bones are in the adult human body?", options: ["186", "196", "206", "216"], correct: 2 },
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3 },
  { question: "Who developed the theory of relativity?", options: ["Newton", "Einstein", "Hawking", "Bohr"], correct: 1 },
  { question: "What is the chemical formula for water?", options: ["HO", "H2O", "H2O2", "OH2"], correct: 1 },
  { question: "Which animal is the largest mammal?", options: ["Elephant", "Giraffe", "Blue Whale", "Hippo"], correct: 2 },
  { question: "In which continent is the Sahara Desert?", options: ["Asia", "Africa", "Australia", "South America"], correct: 1 },
  { question: "What is the currency of the United Kingdom?", options: ["Euro", "Dollar", "Pound Sterling", "Franc"], correct: 2 },
  { question: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], correct: 1 },
  { question: "What year was the first iPhone released?", options: ["2005", "2006", "2007", "2008"], correct: 2 },
  { question: "What is the tallest mountain in the world?", options: ["K2", "Kangchenjunga", "Mount Everest", "Lhotse"], correct: 2 },
  { question: "Which language has the most native speakers?", options: ["English", "Spanish", "Mandarin Chinese", "Hindi"], correct: 2 },
  { question: "What is the main ingredient in guacamole?", options: ["Tomato", "Avocado", "Lime", "Onion"], correct: 1 },
  { question: "Who was the first person to walk on the Moon?", options: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin", "John Glenn"], correct: 1 },
  { question: "What is the square root of 144?", options: ["10", "11", "12", "13"], correct: 2 },
  { question: "Which instrument has 88 keys?", options: ["Guitar", "Violin", "Piano", "Harp"], correct: 2 }
];

function startTriviaGame() {
  const gameCard = document.getElementById('game-trivia');
  if (!gameCard) return;

  // Pick 5 random questions
  const shuffled = [...TRIVIA_POOL].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, 5);
  let currentQ = 0;
  let correctCount = 0;

  function renderQuestion() {
    const q = questions[currentQ];
    gameCard.innerHTML = `
      <div class="game-inline">
        <button class="btn btn--ghost btn--sm game-inline__back" id="trivia-back">← Back</button>
        <div class="trivia">
          <div class="trivia__progress">Question ${currentQ + 1} of ${questions.length}</div>
          <div class="progress-bar progress-bar--sm" style="margin-bottom:16px">
            <div class="progress-bar__fill progress-bar__fill--xp" style="width:${((currentQ) / questions.length) * 100}%"></div>
          </div>
          <div class="trivia__question">${q.question}</div>
          <div class="trivia__options" id="trivia-options">
            ${q.options.map((opt, i) => `<button class="trivia__option" data-option="${i}">${opt}</button>`).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('trivia-back')?.addEventListener('click', () => {
      resetGameCard('game-trivia', '❓', 'Daily Trivia', 'Test your knowledge!', 'trivia');
    });

    document.getElementById('trivia-options')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.trivia__option');
      if (!btn) return;

      const chosen = parseInt(btn.dataset.option);
      const isCorrect = chosen === q.correct;

      // Disable all options
      document.querySelectorAll('.trivia__option').forEach(o => o.classList.add('trivia__option--disabled'));

      // Highlight correct/wrong
      if (isCorrect) {
        btn.classList.add('trivia__option--correct');
        correctCount++;
      } else {
        btn.classList.add('trivia__option--wrong');
        document.querySelector(`[data-option="${q.correct}"]`)?.classList.add('trivia__option--correct');
      }

      // Next question or finish
      setTimeout(() => {
        currentQ++;
        if (currentQ < questions.length) {
          renderQuestion();
        } else {
          const score = correctCount * 200;
          finishGame('trivia', score, gameCard, `${correctCount}/${questions.length} correct`);
        }
      }, 1200);
    });
  }

  renderQuestion();
}

// ─── Game Helpers ───────────────────────────────────────────────────

async function finishGame(gameName, score, gameCard, detail) {
  try {
    const result = await minigamesApi.submitScore(gameName, score);
    const xp = result?.xpEarned || result?.xp || 0;
    const gold = result?.goldEarned || result?.gold || 0;

    gameCard.innerHTML = `
      <div class="game-complete">
        <div class="game-complete__score">${score}</div>
        <div class="game-complete__label">Score — ${detail}</div>
        ${xp || gold ? `
          <p style="margin-bottom:16px;color:var(--text-secondary)">
            ${xp ? `⚡ +${xp} XP ` : ''}${gold ? `💰 +${gold} Gold` : ''}
          </p>
        ` : ''}
        <button class="btn btn--primary btn--sm" id="game-done-${gameName}">Done</button>
      </div>
    `;

    showToast(`Game complete! Score: ${score}`, 'success');
    if (xp) showToast(`⚡ +${xp} XP earned from mini-game!`, 'info');

    document.getElementById(`game-done-${gameName}`)?.addEventListener('click', () => {
      const map = { memory: ['🧠', 'Memory Match', 'Test your memory! Match pairs of cards.'], speedtype: ['⌨️', 'Speed Type', 'How fast can you type?'], trivia: ['❓', 'Daily Trivia', 'Test your knowledge!'] };
      const [icon, title, desc] = map[gameName];
      resetGameCard(`game-${gameName}`, icon, title, desc, gameName);
    });

    // Reload player data to update XP/gold in status bar
    try {
      playerData = await playerApi.get();
      updateStatusBar();
    } catch (_) {}

  } catch (err) {
    showToast('Failed to submit score: ' + err.message, 'error');
  }
}

function resetGameCard(elementId, icon, title, desc, gameKey) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `
    <span class="game-card__icon">${icon}</span>
    <h3 class="game-card__title">${title}</h3>
    <p class="game-card__desc">${desc}</p>
    <button class="btn btn--blue btn--sm" data-game="${gameKey}">▶ Play</button>
  `;
}
