import { auth } from '../utils/api.js';
import { navigate, showToast } from '../main.js';

export async function renderLogin(container) {
  // Silent check: if already authenticated (via Central Auth), immediately navigate to #admin
  try {
    const checkRes = await auth.check();
    if (checkRes && checkRes.authenticated) {
      showToast(`Welcome back, ${checkRes.player.username}!`, 'success');
      navigate('#admin');
      return;
    }
  } catch (_) {}

  const redirectTarget = encodeURIComponent(window.location.origin + window.location.pathname + '#admin');
  const centralAuthLoginUrl = `https://auth.jeffersonwm.com/login?redirect=${redirectTarget}`;

  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">Battalion</h1>
        <p class="login-subtitle">Sign in to your quest</p>

        <!-- JeffersonWM Central Auth Direct SSO -->
        <a href="${centralAuthLoginUrl}" class="btn btn--primary" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; text-decoration:none; margin-bottom:16px; background:#4f46e5; border-color:#4338ca; padding:10px 16px; font-weight:600; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05); color:#fff;">
          🔑 Sign In with Central Auth
        </a>

        <div style="display:flex; align-items:center; margin:16px 0; color:#9ca3af; font-size:11px;">
          <div style="flex:1; height:1px; background:#e5e7eb;"></div>
          <span style="padding:0 8px; text-transform:uppercase; letter-spacing:0.5px;">or local recruit login</span>
          <div style="flex:1; height:1px; background:#e5e7eb;"></div>
        </div>

        <form class="login-form" id="login-form">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input class="form-input" type="text" id="login-user" placeholder="Commander" required autofocus />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" id="login-pass" placeholder="••••••••" required />
          </div>
          <div class="login-error" id="login-error"></div>
          <button class="btn btn--ghost" type="submit" style="width:100%; font-weight:500;">Sign In Locally</button>
        </form>
        <a href="#dashboard" class="login-link">View Public Dashboard →</a>
        <div style="margin-top: 12px;">
          <a href="https://jeffersonwm.com" class="login-link" style="font-size: 0.85em; opacity: 0.7;">← jeffersonwm.com</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const errorEl = document.getElementById('login-error');

    try {
      await auth.login(username, password);
      showToast('Welcome back, Commander!', 'success');
      navigate('#admin');
    } catch (err) {
      errorEl.textContent = 'Invalid credentials. Try again.';
      errorEl.style.display = 'block';
    }
  });
}
