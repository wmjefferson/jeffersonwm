// ─── Batallion API Client ───────────────────────────────────────────

// Auto-detect: in dev (Vite proxy), use relative paths. In production, use the API domain.
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_DOMAIN = isDev ? '' : 'https://api-battalion.jeffersonwm.com';
const BASE = `${API_DOMAIN}/api`;

async function api(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
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

  logout() {
    return api('/auth/logout', { method: 'POST' });
  },

  check() {
    return api('/auth/check');
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

  getLog(limit = 50) {
    return api(`/actions/log?limit=${limit}`);
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

  log(emotion_name, category_id, tier = 3, note = '') {
    return api('/emotions/log', {
      method: 'POST',
      body: JSON.stringify({ emotion_name, category_id, tier, note })
    });
  },

  history(limit = 50) {
    return api(`/emotions/history?limit=${limit}`);
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
  get() {
    return api('/public/dashboard');
  }
};
