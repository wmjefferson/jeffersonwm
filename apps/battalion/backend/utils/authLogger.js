const { db } = require('../db/db');

const AUTH_BASE_URL = (process.env.AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '');
const AUTH_INTERNAL_LOG_TOKEN = (process.env.BATTALION_AUTH_INTERNAL_LOG_TOKEN || process.env.AUTH_INTERNAL_LOG_TOKEN || '0fd4b372cabf46e4afdae1be1a1d4fa5a49b076fa53c62b8619f2faeab1b12ee').trim();

async function logAuthHistory(action, target, username = 'battalion', userId = null) {
  if (!AUTH_BASE_URL || !AUTH_INTERNAL_LOG_TOKEN) return;
  const targetStr = typeof target === 'string' ? target : JSON.stringify(target);
  try {
    await fetch(`${AUTH_BASE_URL}/api/history/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-internal-token': AUTH_INTERNAL_LOG_TOKEN,
      },
      body: JSON.stringify({
        action,
        site: 'battalion',
        target: targetStr,
        userId: userId || null,
        username: username || 'battalion',
        internalToken: AUTH_INTERNAL_LOG_TOKEN,
      }),
    });
  } catch (error) {
    console.warn('Battalion could not log to Auth history:', error);
  }
}

async function resolveAuthUser(req) {
  // 1. Check Central Auth via cookie
  if (req && req.headers && req.headers.cookie) {
    try {
      const resp = await fetch(`${AUTH_BASE_URL}/api/auth/status`, {
        headers: {
          cookie: req.headers.cookie,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.user) {
          return {
            username: data.user.username || data.user.name || 'Commander',
            userId: data.user.id || null,
            isOwner: Boolean(data.user.isOwner),
            role: data.user.role || (data.user.isOwner ? 'owner' : 'admin'),
            source: 'central_auth',
          };
        }
      }
    } catch (err) {
      // Central Auth unreachable or network issue; fall back to local player
    }
  }

  // 2. Check local session / player table
  try {
    const playerId = req?.session?.playerId || 1;
    const [[player]] = await db.execute('SELECT id, username FROM player WHERE id = ?', [playerId]);
    if (player) {
      return {
        username: player.username || 'Commander',
        userId: player.id,
        isOwner: true,
        role: 'admin',
        source: 'local_player',
      };
    }
  } catch (err) {
    console.warn('Could not query local player for auth user:', err);
  }

  // 3. Fallback
  return {
    username: 'Commander',
    userId: 1,
    isOwner: true,
    role: 'admin',
    source: 'default',
  };
}

module.exports = { logAuthHistory, resolveAuthUser };
