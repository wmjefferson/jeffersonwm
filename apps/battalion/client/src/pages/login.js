import { auth } from '../utils/api.js';
import { navigate, showToast } from '../main.js';
import { openCentralAuth } from '../utils/authPopup.js';

export async function renderLogin(container, customError = null) {
  const isExplicitLogout = sessionStorage.getItem('battalion_logged_out') === 'true';
  let accessDeniedMsg = customError;

  // Silent check: if already authenticated (via Central Auth) and not explicitly logged out, immediately navigate to #admin
  if (!isExplicitLogout && !accessDeniedMsg) {
    try {
      const checkRes = await auth.check();
      if (checkRes && checkRes.authenticated) {
        showToast(`Welcome back, ${checkRes.player.username}!`, 'success');
        navigate('#admin');
        return;
      } else if (checkRes && checkRes.accessDenied) {
        accessDeniedMsg = checkRes.message;
      }
    } catch (_) {}
  }

  container.innerHTML = `
    <div class="login-page">
      <div class="login-card" style="text-align: center;">
        <h1 class="login-title">Battalion</h1>
        <p class="login-subtitle" style="margin-bottom: 24px;">Sign in to your quest</p>

        ${isExplicitLogout ? `
          <div style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:10px 14px; border-radius:6px; font-size:13px; margin-bottom:18px; font-weight:500;">
            ✓ You have signed out successfully.
          </div>
        ` : ''}

        ${accessDeniedMsg ? `
          <div style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:12px 14px; border-radius:6px; font-size:13px; margin-bottom:18px; text-align:left; line-height:1.4;">
            <strong>⚠️ Access Not Granted:</strong> ${accessDeniedMsg}
          </div>
        ` : ''}

        <!-- JeffersonWM Central Auth Popup Trigger -->
        <button type="button" id="btn-central-auth-login" class="btn btn--primary" style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%; cursor:pointer; margin-bottom:16px; background:#4f46e5; border-color:#4338ca; padding:12px 18px; font-weight:600; font-size:15px; border-radius:8px; box-shadow:0 2px 4px rgba(79,70,229,0.25); color:#fff; transition: background 0.15s ease;">
          🔑 Sign In with Central Auth
        </button>

        <p style="font-size:12px; color:#6b7280; margin:0 0 24px; line-height:1.5;">
          Connect using your JeffersonWM account to access your personal dashboard, quests, and habits.
        </p>

        <div style="border-top:1px solid #e5e7eb; padding-top:16px; display:flex; flex-direction:column; gap:10px;">
          <a href="#dashboard" class="login-link">View Public Dashboard →</a>
          <a href="https://jeffersonwm.com" class="login-link" style="font-size: 0.85em; opacity: 0.7;">← jeffersonwm.com</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-central-auth-login')?.addEventListener('click', () => {
    openCentralAuth(
      (player) => {
        showToast(player?.username ? `Welcome back, ${player.username}!` : 'Signed in successfully!', 'success');
        navigate('#admin');
      },
      (errorMsg) => {
        showToast(errorMsg, 'warning');
        renderLogin(container, errorMsg);
      }
    );
  });
}


