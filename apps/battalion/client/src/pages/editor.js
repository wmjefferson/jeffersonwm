// ─── Battalion Data Editor ──────────────────────────────────────────

import { actions as actionsApi, tasks as tasksApi, habits as habitsApi, emotions as emotionsApi } from '../utils/api.js';
import { showToast, navigate } from '../main.js';

let activeTab = 'actions';
let allActions = [];
let allTasks = [];
let allHabits = [];
let allEmotions = [];
let emotionCategories = [];
let filterCat = 'all';
let searchTerm = '';
let editingId = null;
let sortCol = null;
let sortDir = 'asc';

const STAT_COLS = ['energy_delta','stress_delta','money_delta','social_delta','health_delta','hygiene_delta','fun_delta','discipline_delta'];
const STAT_SHORT = ['⚡Eng','😰Str','💵Mon','🤝Soc','❤Hlt','🧼Hyg','🎮Fun','🎯Dis'];

export async function renderEditor(container) {
  container.innerHTML = `
    <div style="max-width:1200px; margin:0 auto; padding:16px; font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h1 style="font-size:18px; font-weight:600;">📝 Data Editor</h1>
        <div>
          <button id="btn-back" style="font-size:12px; padding:3px 8px; cursor:pointer; border:1px solid #ddd; background:#fff; border-radius:2px;">← Back to Admin</button>
        </div>
      </div>

      <div style="display:flex; gap:4px; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
        <button class="ed-tab ${activeTab==='actions'?'ed-tab--active':''}" data-tab="actions">Actions (${allActions.length || '...'})</button>
        <button class="ed-tab ${activeTab==='tasks'?'ed-tab--active':''}" data-tab="tasks">Tasks</button>
        <button class="ed-tab ${activeTab==='habits'?'ed-tab--active':''}" data-tab="habits">Habits</button>
        <button class="ed-tab ${activeTab==='emotions'?'ed-tab--active':''}" data-tab="emotions">Emotions</button>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center; flex-wrap:wrap;">
        <input id="ed-search" type="text" placeholder="Search by name..." value="${searchTerm}" style="font-size:12px; padding:3px 6px; border:1px solid #ddd; flex:1; max-width:200px;" />
        <select id="ed-cat-filter" style="font-size:12px; padding:3px 4px; border:1px solid #ddd;">
          <option value="all">All categories</option>
        </select>
        <button id="btn-add-new" style="font-size:12px; padding:3px 8px; cursor:pointer; border:1px solid #4a4; background:#efe; border-radius:2px; color:#262;">+ Add New</button>
        <span style="opacity:0.2;">|</span>
        <button id="btn-export-json" style="font-size:11px; padding:3px 6px; cursor:pointer; border:1px solid #aac; background:#eef; border-radius:2px; color:#226;">⬇ JSON</button>
        <button id="btn-export-csv" style="font-size:11px; padding:3px 6px; cursor:pointer; border:1px solid #aac; background:#eef; border-radius:2px; color:#226;">⬇ CSV</button>
        <label id="btn-import" style="font-size:11px; padding:3px 6px; cursor:pointer; border:1px solid #ca8; background:#fef8e8; border-radius:2px; color:#642;">
          ⬆ Import <input type="file" id="import-file" accept=".json,.csv" style="display:none;" />
        </label>
        <span id="ed-count" style="font-size:11px; opacity:0.5;"></span>
      </div>

      <div id="ed-form" style="display:none; border:1px solid #ddd; padding:8px; margin-bottom:8px; background:#fafafa;"></div>
      <div id="ed-table" style="overflow-x:auto;"></div>
    </div>

    <style>
      .ed-tab { font-size:12px; padding:4px 12px; cursor:pointer; border:1px solid #ddd; background:#fff; border-radius:2px 2px 0 0; border-bottom:none; }
      .ed-tab--active { background:#333; color:#fff; border-color:#333; }
      .ed-table { width:100%; border-collapse:collapse; font-size:11px; }
      .ed-table th { text-align:left; padding:3px 4px; border-bottom:2px solid #333; font-size:10px; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; cursor:pointer; user-select:none; }
      .ed-table th:hover { background:#f0f0f0; }
      .ed-table th .sort-arrow { font-size:9px; margin-left:2px; opacity:0.3; }
      .ed-table th .sort-arrow.active { opacity:1; }
      .ed-table td { padding:3px 4px; border-bottom:1px solid #eee; white-space:nowrap; }
      .ed-table tr:hover { background:#f8f8f8; }
      .ed-table input, .ed-table select { font-size:11px; padding:1px 3px; border:1px solid #ccc; width:100%; box-sizing:border-box; }
      .ed-table input[type=number] { width:45px; text-align:center; }
      .ed-btn { font-size:10px; padding:1px 5px; cursor:pointer; border:1px solid #ddd; background:#fff; border-radius:2px; }
      .ed-btn--del { color:#c00; }
      .ed-btn--save { color:#070; border-color:#4a4; }
    </style>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('#admin'));

  // Tab switching
  container.querySelectorAll('.ed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      editingId = null;
      filterCat = 'all';
      searchTerm = '';
      sortCol = null;
      sortDir = 'asc';
      renderEditor(container);
    });
  });

  // Column sort (delegated)
  document.getElementById('ed-table')?.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const col = th.dataset.sort;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    renderTable();
  });

  // Search
  document.getElementById('ed-search')?.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderTable();
  });

  // Export JSON
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const data = getCurrentData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `battalion_${activeTab}.json`);
    showToast(`Exported ${data.length} ${activeTab} as JSON`, 'success');
  });

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const data = getCurrentData();
    if (data.length === 0) return showToast('Nothing to export', 'warning');
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `battalion_${activeTab}.csv`);
    showToast(`Exported ${data.length} ${activeTab} as CSV`, 'success');
  });

  // Import
  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const isJson = file.name.endsWith('.json');

    try {
      let rows;
      if (isJson) {
        rows = JSON.parse(text);
        if (!Array.isArray(rows)) rows = [rows];
      } else {
        rows = parseCsv(text);
      }

      if (rows.length === 0) return showToast('No data found in file', 'warning');

      const confirm_msg = `Import ${rows.length} ${activeTab} from ${file.name}?\n\nThis will ADD new entries (duplicates by name will be skipped).`;
      if (!confirm(confirm_msg)) return;

      let added = 0, skipped = 0;
      for (const row of rows) {
        try {
          if (activeTab === 'actions') {
            await actionsApi.create(row);
          } else if (activeTab === 'tasks') {
            await tasksApi.create(row);
          } else if (activeTab === 'habits') {
            await habitsApi.create(row);
          } else if (activeTab === 'emotions') {
            await emotionsApi.create(row);
          }
          added++;
        } catch (err) {
          skipped++;
        }
      }

      showToast(`Imported ${added} ${activeTab}, ${skipped} skipped`, added > 0 ? 'success' : 'warning');
      await loadData();
      populateCatFilter();
      renderTable();
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  // Category filter
  document.getElementById('ed-cat-filter')?.addEventListener('change', (e) => {
    filterCat = e.target.value;
    renderTable();
  });

  // Add new
  document.getElementById('btn-add-new')?.addEventListener('click', () => {
    editingId = null;
    showForm(null);
  });

  // Table click delegation
  document.getElementById('ed-table')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.ed-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit') {
      editingId = id;
      const item = getItemById(id);
      showForm(item);
    } else if (action === 'delete') {
      if (!confirm(`Delete "${btn.dataset.label || id}"?`)) return;
      try {
        if (activeTab === 'actions') await actionsApi.delete(id);
        else if (activeTab === 'tasks') await tasksApi.delete(id);
        else if (activeTab === 'habits') await habitsApi.delete(id);
        else if (activeTab === 'emotions') await emotionsApi.delete(id);
        showToast('Deleted', 'info');
        await loadData();
        renderTable();
      } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
    }
  });

  await loadData();
  populateCatFilter();
  renderTable();
}

function getItemById(id) {
  if (activeTab === 'actions') return allActions.find(a => a.action_id === id);
  if (activeTab === 'tasks') return allTasks.find(t => String(t.id) === String(id));
  if (activeTab === 'habits') return allHabits.find(h => String(h.id) === String(id));
  if (activeTab === 'emotions') return allEmotions.find(e => String(e.id) === String(id));
}

async function loadData() {
  try {
    const [a, t, h, emos, cats] = await Promise.all([
      actionsApi.getAll(),
      tasksApi.getAll(),
      habitsApi.getAll(),
      emotionsApi.getAll().catch(() => []),
      emotionsApi.getCategories().catch(() => [])
    ]);
    allActions = a || [];
    allTasks = t || [];
    allHabits = h || [];
    allEmotions = emos || [];
    emotionCategories = cats || [];
  } catch (err) { showToast('Load failed: ' + err.message, 'error'); }
}

function populateCatFilter() {
  const sel = document.getElementById('ed-cat-filter');
  if (!sel) return;
  let cats = [];
  if (activeTab === 'actions') cats = [...new Set(allActions.map(a => a.category))].sort();
  else if (activeTab === 'tasks') cats = [...new Set(allTasks.map(t => t.category))].sort();
  else if (activeTab === 'habits') cats = [...new Set(allHabits.map(h => h.category))].sort();
  else cats = [...new Set(emotionCategories.map(c => c.category_id))].sort();
  sel.innerHTML = `<option value="all">All categories</option>` + cats.map(c => `<option value="${c}" ${filterCat===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('');
}

function filterItems(items, nameKey) {
  let filtered = items;
  if (filterCat !== 'all') {
    if (activeTab === 'emotions') {
      filtered = filtered.filter(i => i.category_id === filterCat);
    } else {
      filtered = filtered.filter(i => i.category === filterCat);
    }
  }
  if (searchTerm) filtered = filtered.filter(i => (i[nameKey]||'').toLowerCase().includes(searchTerm));
  return filtered;
}

function sortItems(items) {
  if (!sortCol) return items;
  const sorted = [...items].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    // Handle nulls
    if (va == null) va = '';
    if (vb == null) vb = '';
    // Number comparison
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    // Try numeric parse
    const na = Number(va), nb = Number(vb);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    // String comparison
    return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' });
  });
  if (sortDir === 'desc') sorted.reverse();
  return sorted;
}

function sortHeader(label, col) {
  const isActive = sortCol === col;
  const arrow = isActive ? (sortDir === 'asc' ? '▲' : '▼') : '▲';
  return `<th data-sort="${col}">${label} <span class="sort-arrow ${isActive?'active':''}">${arrow}</span></th>`;
}

function renderTable() {
  const el = document.getElementById('ed-table');
  const countEl = document.getElementById('ed-count');
  if (!el) return;

  if (activeTab === 'actions') renderActionsTable(el, countEl);
  else if (activeTab === 'tasks') renderTasksTable(el, countEl);
  else if (activeTab === 'habits') renderHabitsTable(el, countEl);
  else renderEmotionsTable(el, countEl);

  // Update tab counts
  document.querySelectorAll('.ed-tab').forEach(t => {
    if (t.dataset.tab === 'actions') t.textContent = `Actions (${allActions.length})`;
    if (t.dataset.tab === 'tasks') t.textContent = `Tasks (${allTasks.length})`;
    if (t.dataset.tab === 'habits') t.textContent = `Habits (${allHabits.length})`;
    if (t.dataset.tab === 'emotions') t.textContent = `Emotions (${allEmotions.length})`;
  });
}

function renderEmotionsTable(el, countEl) {
  const items = sortItems(filterItems(allEmotions, 'name'));
  if (countEl) countEl.textContent = `${items.length} / ${allEmotions.length}`;
  el.innerHTML = `<table class="ed-table">
    <tr>${sortHeader('Name','name')}${sortHeader('Category','category_id')}${sortHeader('Tier','tier')}${sortHeader('Intensity','intensity_note')}${sortHeader('Description','brief_description')}<th></th></tr>
    ${items.map(e => `<tr>
      <td style="font-weight:500;">${e.name}</td>
      <td>${(e.category_id || '').replace(/_/g,' ')}</td>
      <td style="text-align:center;">${e.tier||3}</td>
      <td>${e.intensity_note||'moderate'}</td>
      <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${e.brief_description || ''}">${e.brief_description || ''}</td>
      <td style="white-space:nowrap;">
        <button class="ed-btn" data-action="edit" data-id="${e.id}">✏️</button>
        <button class="ed-btn ed-btn--del" data-action="delete" data-id="${e.id}" data-label="${e.name}">🗑️</button>
      </td>
    </tr>`).join('')}
  </table>`;
}

function renderActionsTable(el, countEl) {
  const items = sortItems(filterItems(allActions, 'label'));
  if (countEl) countEl.textContent = `${items.length} / ${allActions.length}`;
  
  const getNet = (a) => {
    const net = (a.energy_delta||0) - (a.stress_delta||0) + (a.social_delta||0) + (a.health_delta||0) + (a.hygiene_delta||0) + (a.fun_delta||0) + (a.discipline_delta||0);
    if (net > 0) return { label: 'POS', color: '#070', bg: '#e8f5e8' };
    if (net < 0) return { label: 'NEG', color: '#c00', bg: '#fde8e8' };
    return { label: 'NEU', color: '#888', bg: '#f5f5f5' };
  };
  
  el.innerHTML = `<table class="ed-table">
    <tr>${sortHeader('Label','label')}${sortHeader('Category','category')}<th data-sort="_net">±Net</th>${STAT_COLS.map((c,i)=>sortHeader(STAT_SHORT[i],c)).join('')}${sortHeader('Min','time_minutes')}<th></th></tr>
    ${items.map(a => {
      const net = getNet(a);
      return `<tr>
      <td style="font-weight:500;">${a.label}</td>
      <td>${a.category.replace(/_/g,' ')}</td>
      <td style="text-align:center;font-weight:700;color:${net.color};background:${net.bg};font-size:10px;letter-spacing:0.5px;">${net.label}</td>
      ${STAT_COLS.map(c => `<td style="text-align:center;${a[c]>0?'color:#070':a[c]<0?'color:#c00':'opacity:0.3'}">${a[c]||0}</td>`).join('')}
      <td style="text-align:center;">${a.time_minutes||5}</td>
      <td style="white-space:nowrap;">
        <button class="ed-btn" data-action="edit" data-id="${a.action_id}">✏️</button>
        <button class="ed-btn ed-btn--del" data-action="delete" data-id="${a.action_id}" data-label="${a.label}">🗑️</button>
      </td>
    </tr>`;
    }).join('')}
  </table>`;
}

function renderTasksTable(el, countEl) {
  const items = sortItems(filterItems(allTasks, 'name'));
  if (countEl) countEl.textContent = `${items.length} / ${allTasks.length}`;
  el.innerHTML = `<table class="ed-table">
    <tr>${sortHeader('Name','name')}${sortHeader('Category','category')}${sortHeader('Difficulty','difficulty')}${sortHeader('Recurrence','recurrence')}${sortHeader('XP','xp_reward')}${sortHeader('Gold','gold_reward')}${sortHeader('HP Pen','hp_penalty')}<th></th></tr>
    ${items.map(t => `<tr>
      <td style="font-weight:500;">${t.name}</td>
      <td>${t.category||''}</td>
      <td>${t.difficulty||''}</td>
      <td>${t.recurrence||''}</td>
      <td style="text-align:center;">${t.xp_reward||0}</td>
      <td style="text-align:center;">${t.gold_reward||0}</td>
      <td style="text-align:center;">${t.hp_penalty||0}</td>
      <td style="white-space:nowrap;">
        <button class="ed-btn" data-action="edit" data-id="${t.id}">✏️</button>
        <button class="ed-btn ed-btn--del" data-action="delete" data-id="${t.id}" data-label="${t.name}">🗑️</button>
      </td>
    </tr>`).join('')}
  </table>`;
}

function renderHabitsTable(el, countEl) {
  const items = sortItems(filterItems(allHabits, 'name'));
  if (countEl) countEl.textContent = `${items.length} / ${allHabits.length}`;
  el.innerHTML = `<table class="ed-table">
    <tr>${sortHeader('Name','name')}${sortHeader('Type','type')}${sortHeader('Category','category')}${sortHeader('Icon','icon')}${sortHeader('XP','xp_reward')}${sortHeader('Gold','gold_reward')}<th></th></tr>
    ${items.map(h => `<tr>
      <td style="font-weight:500;">${h.name}</td>
      <td>${h.type||''}</td>
      <td>${h.category||''}</td>
      <td>${h.icon||''}</td>
      <td style="text-align:center;">${h.xp_reward||0}</td>
      <td style="text-align:center;">${h.gold_reward||0}</td>
      <td style="white-space:nowrap;">
        <button class="ed-btn" data-action="edit" data-id="${h.id}">✏️</button>
        <button class="ed-btn ed-btn--del" data-action="delete" data-id="${h.id}" data-label="${h.name}">🗑️</button>
      </td>
    </tr>`).join('')}
  </table>`;
}

function showForm(item) {
  const el = document.getElementById('ed-form');
  if (!el) return;
  el.style.display = 'block';
  const isNew = !item;
  const title = isNew ? `Add New ${activeTab.slice(0,-1)}` : `Edit: ${item.label||item.name}`;

  if (activeTab === 'actions') {
    const cats = [...new Set(allActions.map(a=>a.category))].sort();
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:13px;">${title}</strong>
        <button id="form-close" class="ed-btn">✕ Cancel</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px;">
        <label>Label<br/><input id="f-label" value="${item?.label||''}" style="width:180px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Category<br/>
          <select id="f-category" style="padding:2px 4px;border:1px solid #ccc;">
            ${cats.map(c=>`<option value="${c}" ${item?.category===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('')}
            <option value="__new">+ New category</option>
          </select>
        </label>
        <label>Time (min)<br/><input id="f-time" type="number" value="${item?.time_minutes||5}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; font-size:11px;">
        ${STAT_COLS.map((c,i) => `<label>${STAT_SHORT[i]}<br/><input id="f-${c}" type="number" value="${item?.[c]||0}" style="width:45px;padding:2px;border:1px solid #ccc;text-align:center;" /></label>`).join('')}
      </div>
      <div style="margin-top:8px;">
        <button id="form-save" class="ed-btn ed-btn--save" style="padding:3px 12px;">💾 ${isNew?'Create':'Save'}</button>
      </div>
    `;
  } else if (activeTab === 'tasks') {
    const cats = [...new Set(allTasks.map(t=>t.category))].sort();
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:13px;">${title}</strong>
        <button id="form-close" class="ed-btn">✕ Cancel</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px;">
        <label>Name<br/><input id="f-name" value="${item?.name||''}" style="width:180px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Category<br/>
          <select id="f-category" style="padding:2px 4px;border:1px solid #ccc;">
            ${cats.map(c=>`<option value="${c}" ${item?.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </label>
        <label>Difficulty<br/>
          <select id="f-difficulty" style="padding:2px 4px;border:1px solid #ccc;">
            ${['easy','medium','hard'].map(d=>`<option value="${d}" ${item?.difficulty===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </label>
        <label>Recurrence<br/>
          <select id="f-recurrence" style="padding:2px 4px;border:1px solid #ccc;">
            ${['daily','weekly','one-time'].map(r=>`<option value="${r}" ${item?.recurrence===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </label>
        <label>XP<br/><input id="f-xp" type="number" value="${item?.xp_reward||15}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Gold<br/><input id="f-gold" type="number" value="${item?.gold_reward||5}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>HP Pen<br/><input id="f-hp" type="number" value="${item?.hp_penalty||2}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
      </div>
      <label style="display:block;margin-top:6px;font-size:12px;">Description<br/><input id="f-desc" value="${item?.description||''}" style="width:100%;max-width:400px;padding:2px 4px;border:1px solid #ccc;" /></label>
      <div style="margin-top:8px;">
        <button id="form-save" class="ed-btn ed-btn--save" style="padding:3px 12px;">💾 ${isNew?'Create':'Save'}</button>
      </div>
    `;
  } else if (activeTab === 'habits') {
    const cats = [...new Set(allHabits.map(h=>h.category))].sort();
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:13px;">${title}</strong>
        <button id="form-close" class="ed-btn">✕ Cancel</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px;">
        <label>Name<br/><input id="f-name" value="${item?.name||''}" style="width:180px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Type<br/>
          <select id="f-type" style="padding:2px 4px;border:1px solid #ccc;">
            ${['positive','negative'].map(t=>`<option value="${t}" ${item?.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </label>
        <label>Category<br/>
          <select id="f-category" style="padding:2px 4px;border:1px solid #ccc;">
            ${cats.map(c=>`<option value="${c}" ${item?.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </label>
        <label>Icon<br/><input id="f-icon" value="${item?.icon||'▸'}" style="width:40px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>XP<br/><input id="f-xp" type="number" value="${item?.xp_reward||15}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Gold<br/><input id="f-gold" type="number" value="${item?.gold_reward||5}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
      </div>
      <div style="margin-top:8px;">
        <button id="form-save" class="ed-btn ed-btn--save" style="padding:3px 12px;">💾 ${isNew?'Create':'Save'}</button>
      </div>
    `;
  } else {
    const cats = emotionCategories.map(c => c.category_id).sort();
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:13px;">${title}</strong>
        <button id="form-close" class="ed-btn">✕ Cancel</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px;">
        <label>Name<br/><input id="f-name" value="${item?.name||''}" style="width:180px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Category<br/>
          <select id="f-category" style="padding:2px 4px;border:1px solid #ccc;">
            ${cats.map(c=>`<option value="${c}" ${item?.category_id===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('')}
          </select>
        </label>
        <label>Tier (1-5)<br/><input id="f-tier" type="number" min="1" max="5" value="${item?.tier||3}" style="width:50px;padding:2px 4px;border:1px solid #ccc;" /></label>
        <label>Intensity Note<br/><input id="f-intensity" value="${item?.intensity_note||'moderate'}" style="width:100px;padding:2px 4px;border:1px solid #ccc;" /></label>
      </div>
      <div style="margin-top:6px; font-size:12px; display:flex; flex-direction:column; gap:4px;">
        <label style="display:block;">Brief Description<br/>
          <input id="f-brief-desc" value="${item?.brief_description||''}" style="width:100%;max-width:500px;padding:2px 4px;border:1px solid #ccc;" />
        </label>
        <label style="display:block;">Extended Description<br/>
          <textarea id="f-extended-desc" style="width:100%;max-width:500px;height:40px;padding:2px 4px;border:1px solid #ccc;">${item?.extended_description||''}</textarea>
        </label>
        <label style="display:block;">Related Emotions (comma-separated names)<br/>
          <input id="f-related" value="${Array.isArray(item?.related_emotions) ? item.related_emotions.join(', ') : (typeof item?.related_emotions === 'string' ? JSON.parse(item.related_emotions || '[]').join(', ') : '')}" style="width:100%;max-width:500px;padding:2px 4px;border:1px solid #ccc;" />
        </label>
      </div>
      <div style="margin-top:8px;">
        <button id="form-save" class="ed-btn ed-btn--save" style="padding:3px 12px;">💾 ${isNew?'Create':'Save'}</button>
      </div>
    `;
  }

  document.getElementById('form-close')?.addEventListener('click', () => { el.style.display='none'; editingId=null; });

  document.getElementById('f-category')?.addEventListener('change', (e) => {
    if (e.target.value === '__new') {
      const name = prompt('New category name:');
      if (name) {
        const opt = document.createElement('option');
        opt.value = name.toLowerCase().replace(/\s+/g,'_');
        opt.textContent = name;
        opt.selected = true;
        e.target.insertBefore(opt, e.target.lastElementChild);
      } else { e.target.value = allActions[0]?.category || ''; }
    }
  });

  document.getElementById('form-save')?.addEventListener('click', async () => {
    try {
      if (activeTab === 'actions') {
        const data = {
          label: document.getElementById('f-label').value.trim(),
          category: document.getElementById('f-category').value,
          time_minutes: parseInt(document.getElementById('f-time').value) || 5,
        };
        if (!data.label) return showToast('Label is required', 'error');
        STAT_COLS.forEach(c => { data[c] = parseInt(document.getElementById(`f-${c}`).value) || 0; });
        if (isNew) await actionsApi.create(data);
        else await actionsApi.update(editingId, data);
      } else if (activeTab === 'tasks') {
        const data = {
          name: document.getElementById('f-name').value.trim(),
          description: document.getElementById('f-desc').value.trim(),
          category: document.getElementById('f-category').value,
          difficulty: document.getElementById('f-difficulty').value,
          recurrence: document.getElementById('f-recurrence').value,
          xp_reward: parseInt(document.getElementById('f-xp').value) || 0,
          gold_reward: parseInt(document.getElementById('f-gold').value) || 0,
          hp_penalty: parseInt(document.getElementById('f-hp').value) || 0,
        };
        if (!data.name) return showToast('Name is required', 'error');
        if (isNew) await tasksApi.create(data);
        else await tasksApi.update(editingId, data);
      } else if (activeTab === 'habits') {
        const data = {
          name: document.getElementById('f-name').value.trim(),
          type: document.getElementById('f-type').value,
          category: document.getElementById('f-category').value,
          icon: document.getElementById('f-icon').value,
          xp_reward: parseInt(document.getElementById('f-xp').value) || 0,
          gold_reward: parseInt(document.getElementById('f-gold').value) || 0,
        };
        if (!data.name) return showToast('Name is required', 'error');
        if (isNew) await habitsApi.create(data);
        else await habitsApi.update(editingId, data);
      } else {
        const relatedStr = document.getElementById('f-related').value.trim();
        const relatedArray = relatedStr ? relatedStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const data = {
          name: document.getElementById('f-name').value.trim(),
          category_id: document.getElementById('f-category').value,
          tier: parseInt(document.getElementById('f-tier').value) || 3,
          intensity_note: document.getElementById('f-intensity').value.trim(),
          brief_description: document.getElementById('f-brief-desc').value.trim(),
          extended_description: document.getElementById('f-extended-desc').value.trim(),
          related_emotions: relatedArray
        };
        if (!data.name) return showToast('Name is required', 'error');
        if (isNew) await emotionsApi.create(data);
        else await emotionsApi.update(editingId, data);
      }
      showToast(isNew ? 'Created!' : 'Saved!', 'success');
      el.style.display = 'none';
      editingId = null;
      await loadData();
      populateCatFilter();
      renderTable();
    } catch (err) { showToast('Save failed: ' + err.message, 'error'); }
  });
}

// ─── Export / Import Helpers ──────────────────────────────────────────

function getCurrentData() {
  if (activeTab === 'actions') return allActions;
  if (activeTab === 'tasks') return allTasks;
  return allHabits;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function toCsv(data) {
  if (data.length === 0) return '';
  // Pick columns: skip internal fields
  const skip = ['id', 'rowid', 'is_active', 'times_performed', 'last_performed', 'created_at', 'is_completed_today', 'todayStatus', 'completedToday', 'completionCount'];
  const keys = Object.keys(data[0]).filter(k => !skip.includes(k));

  const escape = (val) => {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = keys.map(k => escape(k)).join(',');
  const rows = data.map(row => keys.map(k => escape(row[k])).join(','));
  return header + '\n' + rows.join('\n');
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let v = vals[idx] || '';
      // Try to convert numbers
      if (v !== '' && !isNaN(Number(v))) v = Number(v);
      obj[h] = v;
    });
    rows.push(obj);
  }
  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
