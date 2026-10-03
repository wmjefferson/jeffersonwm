// ─── Batallion API Client ───────────────────────────────────────────

// Auto-detect: in dev (Vite proxy), use relative paths. In production, use the API domain.
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_DOMAIN = isDev ? '' : 'https://api-battalion.jeffersonwm.com';
const BASE = `${API_DOMAIN}/api`;

async function api(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const actingUserId = localStorage.getItem('battalion_acting_user_id');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (actingUserId) {
    headers['x-acting-user-id'] = actingUserId;
  }

  const config = {
    credentials: 'include',
    headers,
    ...options
  };

  // Don't set Content-Type for requests with no body
  if (!config.body) {
    delete config.headers['Content-Type'];
  }

  const res = await fetch(url, config);

  if (!res.ok) {
    // Auto-logout on expired/invalid session (skip for auth check itself)
    if (res.status === 401 && !endpoint.includes('/auth/')) {
      window.location.hash = '#login';
      return;
    }
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const errData = await res.json();
      errorMessage = errData.error || errData.message || errorMessage;
    } catch (_) {}
    throw new Error(errorMessage);
  }

  // Handle 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────────

export const auth = {
  login(username, password) {
    return api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    localStorage.removeItem('battalion_acting_user_id');
    sessionStorage.setItem('battalion_logged_out', 'true');
    try {
      await fetch('https://auth.jeffersonwm.com/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteContext: 'https://jeffersonwm.com/battalion/' })
      });
    } catch (_) {}
    return api('/auth/logout', { method: 'POST' });
  },

  async check() {
    const data = await api('/auth/check');
    if (!data || !data.authenticated || !data.isOwner) {
      localStorage.removeItem('battalion_acting_user_id');
    } else if (data.actingPlayer && data.actingPlayer.id !== data.player?.id) {
      localStorage.setItem('battalion_acting_user_id', String(data.actingPlayer.id));
    } else if (!data.isActing) {
      localStorage.removeItem('battalion_acting_user_id');
    }
    return data;
  },

  getUsers() {
    return api('/auth/users');
  },

  async switchUser(userId) {
    if (userId) {
      localStorage.setItem('battalion_acting_user_id', String(userId));
    } else {
      localStorage.removeItem('battalion_acting_user_id');
    }
    return api('/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId: userId ? Number(userId) : null })
    });
  }
};

// ─── Player ─────────────────────────────────────────────────────────

export const player = {
  get() {
    return api('/player');
  },

  update(data) {
    return api('/player', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};

// ─── Tasks ──────────────────────────────────────────────────────────

export const tasks = {
  getAll() {
    return api('/tasks');
  },

  create(data) {
    return api('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  update(id, data) {
    return api(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(id) {
    return api(`/tasks/${id}`, { method: 'DELETE' });
  },

  complete(id, status) {
    return api(`/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  resetDaily() {
    return api('/tasks/reset-daily', { method: 'POST' });
  }
};

// ─── Habits ─────────────────────────────────────────────────────────

export const habits = {
  getAll() {
    return api('/habits');
  },

  create(data) {
    return api('/habits', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  update(id, data) {
    return api(`/habits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(id) {
    return api(`/habits/${id}`, { method: 'DELETE' });
  },

  log(id) {
    return api(`/habits/${id}/log`, { method: 'POST' });
  }
};

// ─── Mood ───────────────────────────────────────────────────────────

export const mood = {
  log(moodValue, note) {
    return api('/mood', {
      method: 'POST',
      body: JSON.stringify({ mood: moodValue, note })
    });
  },

  history() {
    return api('/mood/history');
  }
};

// ─── Mini-Games ─────────────────────────────────────────────────────

export const minigames = {
  submitScore(game, score) {
    return api('/minigames/score', {
      method: 'POST',
      body: JSON.stringify({ game, score })
    });
  },

  getScores() {
    return api('/minigames/scores');
  }
};

// ─── Actions (RPG System) ───────────────────────────────────────────

export const actions = {
  getAll(category, time) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (time) params.set('time', time);
    const qs = params.toString();
    return api(`/actions${qs ? '?' + qs : ''}`);
  },

  perform(actionId) {
    return api(`/actions/${actionId}/perform`, { method: 'POST' });
  },

  getLog(limit = 50, options = {}) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    const qs = params.toString();
    return api(`/actions/log${qs ? '?' + qs : ''}`);
  },

  createLog(data) {
    return api('/actions/log', { method: 'POST', body: JSON.stringify(data) });
  },

  exportLog(options = {}) {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.timeframe) params.set('timeframe', options.timeframe);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    const qs = params.toString();
    return api(`/actions/log/export${qs ? '?' + qs : ''}`);
  },

  getCategories() {
    return api('/actions/categories');
  },

  create(data) {
    return api('/actions', { method: 'POST', body: JSON.stringify(data) });
  },

  update(actionId, data) {
    return api(`/actions/${actionId}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  delete(actionId) {
    return api(`/actions/${actionId}`, { method: 'DELETE' });
  }
};

// ─── Emotions ───────────────────────────────────────────────────────

export const emotions = {
  getCategories() {
    return api('/emotions/categories');
  },

  getAll(category) {
    const qs = category ? `?category=${category}` : '';
    return api(`/emotions${qs}`);
  },

  getCurrent() {
    return api('/emotions/current');
  },

  log(emotion_name, category_id, tier = 3, note = '', logged_at = null) {
    const body = { emotion_name, category_id, tier, note };
    if (logged_at) body.logged_at = logged_at;
    return api('/emotions/log', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  history(limit = 50, options = {}) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    const qs = params.toString();
    return api(`/emotions/history${qs ? '?' + qs : ''}`);
  },

  deleteLog(id) {
    return api(`/emotions/log/${id}`, {
      method: 'DELETE'
    });
  },

  clearLogs(days) {
    return api(`/emotions/log?days=${days}`, {
      method: 'DELETE'
    });
  },

  create(data) {
    return api('/emotions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  update(id, data) {
    return api(`/emotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(id) {
    return api(`/emotions/${id}`, {
      method: 'DELETE'
    });
  }
};

// ─── Public Dashboard ───────────────────────────────────────────────

export const publicDashboard = {
  get(userSlug) {
    const qs = userSlug ? `?user=${encodeURIComponent(userSlug)}` : '';
    return api(`/public/dashboard${qs}`);
  }
};

// ─── Master Startup Template ────────────────────────────────────────

export const template = {
  get() {
    return api('/template');
  },

  update(payload) {
    return api('/template', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  getChangelog() {
    return api('/template/changelog');
  },

  exportUrl() {
    return `${BASE}/template/export`;
  },

  async export() {
    const res = await fetch(`${BASE}/template/export`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battalion_template_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
