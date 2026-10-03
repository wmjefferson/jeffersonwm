// ─── Central Auth Popup / Panel Manager ─────────────────────────────
import { auth } from './api.js';

const AUTH_BASE_URL = 'https://auth.jeffersonwm.com';

/**
 * Opens the Central Auth popup panel (440x620) centered on screen.
 * Listens for auth:success postMessage and falls back to polling on popup close.
 * 
 * @param {Function} [onSuccess] Callback invoked when authentication succeeds
 * @param {Function} [onError] Callback invoked when authentication fails or access is denied
 */
export function openCentralAuth(onSuccess, onError) {
  // Clear any explicit logout flag so subsequent checks can proceed
  sessionStorage.removeItem('battalion_logged_out');

  const url = new URL(AUTH_BASE_URL);
  url.searchParams.set('returnTo', window.location.href);
  url.searchParams.set('popup', '1');

  const width = 440;
  const height = 620;
  const left = Math.max(0, Math.round(window.screenX + ((window.outerWidth - width) / 2)));
  const top = Math.max(0, Math.round(window.screenY + ((window.outerHeight - height) / 2)));

  const popup = window.open(
    url.toString(),
    'battalion-auth-popup',
    `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0`
  );

  if (!popup) {
    // Popup was blocked by browser; fall back to standard redirect
    window.location.assign(url.toString());
    return;
  }

  popup.focus();

  let completed = false;
  let pollId = null;

  function cleanup() {
    completed = true;
    window.removeEventListener('message', handleAuthMessage);
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  }

  async function verifyAndFinish() {
    if (completed) return;
    try {
      const checkRes = await auth.check();
      if (checkRes && checkRes.authenticated) {
        completed = true;
        cleanup();
        try {
          if (popup && !popup.closed) popup.close();
        } catch (_) {}
        sessionStorage.removeItem('battalion_logged_out');
        if (typeof onSuccess === 'function') {
          onSuccess(checkRes.player);
        }
      } else if (checkRes && checkRes.accessDenied) {
        completed = true;
        cleanup();
        try {
          if (popup && !popup.closed) popup.close();
        } catch (_) {}
        if (typeof onError === 'function') {
          onError(checkRes.message || 'Access to Battalion has not been granted for your account.');
        }
      }
    } catch (_) {}
  }

  function handleAuthMessage(event) {
    if (!event.origin || new URL(event.origin).origin !== new URL(AUTH_BASE_URL).origin) {
      return;
    }
    if (event.data?.type === 'auth:success') {
      void verifyAndFinish();
    }
  }

  window.addEventListener('message', handleAuthMessage);

  // Polling fallback in case popup was manually closed or redirect happened without postMessage
  pollId = setInterval(async () => {
    if (completed) return;
    if (!popup || popup.closed) {
      cleanup();
      void verifyAndFinish();
    }
  }, 700);
}

