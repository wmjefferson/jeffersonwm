const { db } = require('../db/db');
const { provisionUserFromMaster } = require('../utils/accountProvisioner');

const AUTH_BASE_URL = (process.env.AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '');

/**
 * Resolve player from Central Auth cookie or local express-session
 */
async function resolveSessionPlayer(req) {
  let authUser = null;

  // 1. Check Central Auth via cookie
  if (req && req.headers && req.headers.cookie) {
    try {
      const resp = await fetch(`${AUTH_BASE_URL}/api/auth/status`, {
        headers: { cookie: req.headers.cookie }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.user) {
          authUser = data.user;
        }
      }
    } catch (err) {
      // Central Auth unreachable or offline; fallback to local session
    }
  }

  let player = null;

  if (authUser) {
    const hasAccess = Boolean(
      authUser.isOwner ||
      (
        authUser.accountState === 'approved' &&
        Array.isArray(authUser.memberships) &&
        authUser.memberships.includes('battalion')
      )
    );

    if (!hasAccess) {
      return {
        player: null,
        accessDenied: true,
        authUser,
        message: 'Access to Battalion has not been granted for your Central Auth account. Please ask an admin to enable Battalion permissions.'
      };
    }

    // Attempt lookup by auth_user_id
    if (authUser.id) {
      const [[byAuthId]] = await db.execute(
        'SELECT * FROM player WHERE auth_user_id = ? LIMIT 1',
        [authUser.id]
      );
      if (byAuthId) player = byAuthId;
    }

    // Fallback lookup by username
    if (!player && authUser.username) {
      const [[byName]] = await db.execute(
        'SELECT * FROM player WHERE username = ? LIMIT 1',
        [authUser.username]
      );
      if (byName) {
        player = byName;
        // Associate auth_user_id if not set
        if (!player.auth_user_id && authUser.id) {
          await db.execute(
            'UPDATE player SET auth_user_id = ? WHERE id = ?',
            [authUser.id, player.id]
          );
          player.auth_user_id = authUser.id;
        }
      }
    }

    // If still not found, auto-provision user cloned from Master Startup Template
    if (!player && authUser.username) {
      const assignedRole = authUser.isOwner ? 'owner' : (authUser.isAdmin ? 'admin' : 'user');
      player = await provisionUserFromMaster({
        authUserId: authUser.id || null,
        username: authUser.username,
        role: assignedRole
      });
    }

    // Keep role in sync with Central Auth
    if (player) {
      if (authUser.isOwner && player.role !== 'owner') {
        player.role = 'owner';
        await db.execute("UPDATE player SET role = 'owner' WHERE id = ?", [player.id]);
      } else if (authUser.isAdmin && player.role === 'user') {
        player.role = 'admin';
        await db.execute("UPDATE player SET role = 'admin' WHERE id = ?", [player.id]);
      }
    }
  }

  // 2. If no Central Auth user, check local session playerId
  if (!player && req.session && req.session.playerId) {
    const [[localPlayer]] = await db.execute(
      'SELECT * FROM player WHERE id = ? LIMIT 1',
      [req.session.playerId]
    );
    if (localPlayer) {
      player = localPlayer;
    }
  }

  if (!player) {
    return null;
  }

  // Ensure session has current playerId
  if (req.session) {
    req.session.playerId = player.id;
  }

  // 3. User Switcher handling for Owner
  let actingPlayer = player;
  let actingUserId = player.id;

  if (player.role === 'owner') {
    const requestedSwitchId = req.session?.actingUserId || req.headers['x-acting-user-id'];
    if (requestedSwitchId && Number(requestedSwitchId) !== player.id) {
      const [[targetPlayer]] = await db.execute(
        'SELECT * FROM player WHERE id = ? LIMIT 1',
        [Number(requestedSwitchId)]
      );
      if (targetPlayer) {
        actingPlayer = targetPlayer;
        actingUserId = targetPlayer.id;
      } else if (req.session) {
        delete req.session.actingUserId;
      }
    }
  }

  return {
    player,
    actingPlayer,
    userId: actingUserId,
    isOwner: player.role === 'owner',
    authUser
  };
}

/**
 * Express middleware requiring an authenticated user
 */
async function requireAuth(req, res, next) {
  try {
    const resolved = await resolveSessionPlayer(req);
    if (!resolved || !resolved.player) {
      if (resolved && resolved.accessDenied) {
        return res.status(403).json({ error: resolved.message || 'Access denied: Battalion permission not enabled in Central Auth' });
      }
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.player = resolved.player;
    req.actingPlayer = resolved.actingPlayer;
    req.userId = resolved.userId;
    req.isOwner = resolved.isOwner;
    req.authUser = resolved.authUser;

    next();
  } catch (err) {
    console.error('requireAuth middleware error:', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
}

/**
 * Express middleware requiring Owner
 */
function requireOwner(req, res, next) {
  if (!req.player || req.player.role !== 'owner') {
    return res.status(403).json({ error: 'You do not have permission.' });
  }
  next();
}

/**
 * Express middleware requiring Admin (owner or admin)
 */
function requireAdmin(req, res, next) {
  if (!req.player || !['owner', 'admin'].includes(req.player.role)) {
    return res.status(403).json({ error: 'You do not have permission.' });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireOwner = requireOwner;
module.exports.requireAdmin = requireAdmin;
module.exports.resolveSessionPlayer = resolveSessionPlayer;
