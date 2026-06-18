import { auth } from '../utils/api.js';
import { navigate, showToast } from '../main.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">Batallion</h1>
        <p class="login-subtitle">Sign in to your quest</p>
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
          <button class="btn btn--primary" type="submit" style="width:100%">Sign In</button>
        </form>
        <a href="#dashboard" class="login-link">View Public Dashboard →</a>
        <div style="margin-top: 12px;">
          <a href="https://jeffersonwm.com" class="login-link" style="font-size: 0.85em; opacity: 0.7;">← jeffersonwm.com</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
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
