import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import cors from 'cors';
import path from 'path';

type AuthStatusUser = {
  id: string;
  username: string;
  displayName?: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  isApproved: boolean;
  isBlocked: boolean;
  isDeleted: boolean;
  memberships?: string[];
};

type LinkRecord = {
  id: string;
  title: string;
  url: string;
  acronym: string;
  category: string;
  tags?: string | null;
  scope?: string | null;
  owner_user_id?: string | null;
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || '8040');
  const HOST = process.env.HOST || '0.0.0.0';
  const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  const AUTH_BASE_URL = (process.env.AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '');
  const AUTH_INTERNAL_LOG_TOKEN = (process.env.AUTH_INTERNAL_LOG_TOKEN || '').trim();
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.use(express.json());
  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    }
  }));

  let pool: mysql.Pool | null = null;
  let authStatusCache: { token: string; user: AuthStatusUser | null; timestamp: number } | null = null;

  const initDb = () => {
    if (pool) return pool;
    if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
      return null;
    }
    
    try {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: String(process.env.MYSQL_PASSWORD || ''),
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      console.log('MySQL pool created.');
      
      // Initialize table
      pool.query(`
        CREATE TABLE IF NOT EXISTS links (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          acronym VARCHAR(50),
          category VARCHAR(100),
          tags TEXT NULL,
          scope VARCHAR(20) NOT NULL DEFAULT 'global',
          owner_user_id VARCHAR(255) NULL
        )
      `).then(async () => {
        console.log('Links table ready.');
        try {
          const columnsToCheck = [
            { column: 'tags', sql: 'ALTER TABLE links ADD COLUMN tags TEXT NULL' },
            { column: 'scope', sql: "ALTER TABLE links ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'global'" },
            { column: 'owner_user_id', sql: 'ALTER TABLE links ADD COLUMN owner_user_id VARCHAR(255) NULL' },
          ] as const;

          for (const entry of columnsToCheck) {
            const [columns] = await pool!.query(
              `SELECT COUNT(*) AS count
               FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = ?
                 AND TABLE_NAME = 'links'
                 AND COLUMN_NAME = ?`,
              [process.env.MYSQL_DATABASE, entry.column]
            );
            const count = Number((columns as Array<{ count?: number }>)[0]?.count || 0);
            if (count === 0) {
              await pool!.execute(entry.sql);
              console.log(`Added ${entry.column} column to links table.`);
            }
          }
        } catch (colErr) {
          console.error('Error checking or adding tags column:', colErr);
        }
      }).catch(err => {
        console.error('Error creating table:', err);
      });
      return pool;
    } catch (error) {
      console.error('Error initializing MySQL pool:', error);
      return null;
    }
  };

  initDb();

  const authCookieFromRequest = (req: express.Request) => req.get('cookie') || '';

  const getAuthUser = async (req: express.Request) => {
    const cookie = authCookieFromRequest(req);
    const cacheKey = cookie || 'anonymous';
    if (authStatusCache && authStatusCache.token === cacheKey && (Date.now() - authStatusCache.timestamp) < 15_000) {
      return authStatusCache.user;
    }

    try {
      const response = await fetch(`${AUTH_BASE_URL}/api/auth/status`, {
        headers: cookie ? { cookie } : {},
      });

      if (!response.ok) {
        authStatusCache = { token: cacheKey, user: null, timestamp: Date.now() };
        return null;
      }

      const payload = await response.json() as { user?: AuthStatusUser | null };
      const user = payload.user ?? null;
      const isAllowed = Boolean(user && user.isApproved && !user.isBlocked && !user.isDeleted);
      const resolvedUser = isAllowed ? user : null;

      authStatusCache = { token: cacheKey, user: resolvedUser, timestamp: Date.now() };
      return resolvedUser;
    } catch (error) {
      console.error('Auth status lookup failed:', error);
      authStatusCache = { token: cacheKey, user: null, timestamp: Date.now() };
      return null;
    }
  };

  const requireAuthenticatedUser = async (req: express.Request, res: express.Response) => {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sign in with an approved Lionship account to access this site.' });
      return null;
    }
    return user;
  };

  const requireAdminUser = async (req: express.Request, res: express.Response) => {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) {
      return null;
    }

    if (!user.isAdmin && !user.isOwner) {
      res.status(403).json({ error: 'Admin or owner access is required to change links.' });
      return null;
    }

    return user;
  };

  const canManageGlobalLinks = (user: AuthStatusUser | null) => Boolean(user?.isOwner);

  const canManagePersonalLinks = (user: AuthStatusUser | null) => Boolean(user);

  const normalizeLinkRecord = (row: Record<string, unknown>): LinkRecord => ({
    id: String(row.id),
    title: String(row.title),
    url: String(row.url),
    acronym: String(row.acronym || ''),
    category: String(row.category || ''),
    tags: row.tags == null ? null : String(row.tags),
    scope: row.scope == null ? 'global' : String(row.scope),
    owner_user_id: row.owner_user_id == null ? null : String(row.owner_user_id),
  });

  const isPersonalLinkOwnedByUser = (link: LinkRecord, user: AuthStatusUser | null) =>
    Boolean(user && link.scope === 'personal' && link.owner_user_id === user.id);

  const canAccessLinkRecord = (link: LinkRecord, user: AuthStatusUser | null) =>
    link.scope !== 'personal' || Boolean(user && (user.isOwner || isPersonalLinkOwnedByUser(link, user)));

  const canEditLinkRecord = (link: LinkRecord, user: AuthStatusUser | null) => {
    if (!user) return false;
    if (user.isOwner) return true;
    return user.isAdmin && isPersonalLinkOwnedByUser(link, user);
  };

  const logAuthHistory = async (payload: {
    action: string;
    target: string;
    site?: string | null;
    userId?: string | null;
    username?: string | null;
  }) => {
    if (!AUTH_INTERNAL_LOG_TOKEN) return;

    try {
      await fetch(`${AUTH_BASE_URL}/api/history/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-internal-token': AUTH_INTERNAL_LOG_TOKEN,
        },
        body: JSON.stringify({
          ...payload,
          internalToken: AUTH_INTERNAL_LOG_TOKEN,
        }),
      });
    } catch (error) {
      console.warn('Failed to notify Auth history stream:', error);
    }
  };

  // Middleware to ensure DB connection
  app.use((req, res, next) => {
    if (req.path === '/api/links' || req.path === '/api/links/batch' || req.path.startsWith('/api/links/')) {
      const db = initDb();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured securely. Please enter MYSQL_ variables in settings.' });
      }
    }
    next();
  });

  app.get('/health', async (_req, res) => {
    const db = initDb();
    let dbConnected = false;

    if (db) {
      try {
        await db.query('SELECT 1');
        dbConnected = true;
      } catch (error) {
        console.error('Health check database query failed:', error);
      }
    }

    res.json({
      ok: true,
      publicBaseUrl: PUBLIC_BASE_URL,
      dbConfigured: Boolean(db),
      dbConnected
    });
  });

  app.get(['/', '/index.html'], async (_req, res) => {
    const db = initDb();
    let dbConnected = false;

    if (db) {
      try {
        await db.query('SELECT 1');
        dbConnected = true;
      } catch (error) {
        console.error('Status page database query failed:', error);
      }
    }

    const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lionship API</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f3f4f6;
        color: #111827;
        font: 16px/1.5 "Segoe UI", Arial, sans-serif;
      }
      main {
        width: min(560px, calc(100vw - 48px));
        padding: 28px 32px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        box-shadow: 0 12px 28px rgba(17, 24, 39, 0.08);
      }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 16px; }
      code {
        display: inline-block;
        padding: 2px 6px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }
      ul { margin: 0 0 16px; padding-left: 18px; }
      .ok { color: #166534; font-weight: 600; }
      .warn { color: #92400e; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>Lionship API</h1>
      <p class="${dbConnected ? 'ok' : 'warn'}">
        ${dbConnected ? 'Connected to shared links database.' : 'Running, but the database is not connected.'}
      </p>
      <ul>
        <li><code>/health</code> returns API and database status</li>
        <li><code>/api/links</code> returns the live link set</li>
      </ul>
      <p>Public base URL: <code>${PUBLIC_BASE_URL}</code></p>
    </main>
  </body>
</html>`;

    res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(body);
  });

  // GET all links
  app.get('/api/links', async (req, res) => {
    try {
      const user = await getAuthUser(req);

      const db = initDb()!;
      const [rows] = await db.query('SELECT * FROM links');
      const visibleLinks = (rows as Array<Record<string, unknown>>)
        .map(normalizeLinkRecord)
        .filter(link => canAccessLinkRecord(link, user));
      res.json(visibleLinks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // SYNC existing initial links (one-off sync helper for the frontend)
  app.post('/api/links/batch', async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return;

      const links = req.body.links;
      const db = initDb()!;
      if (!Array.isArray(links)) return res.status(400).json({ error: 'Expected an array of links' });
      if (!canManageGlobalLinks(user)) {
        return res.status(403).json({ error: 'Only the owner can sync the global master list.' });
      }
      for (const link of links) {
        await db.execute(
          'INSERT IGNORE INTO links (id, title, url, acronym, category, tags, scope, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [link.id, link.title, link.url, link.acronym, link.category, link.tags || '', 'global', null]
        );
      }
      void logAuthHistory({
        action: 'lionship.master_synced',
        target: `Synced ${links.length} global link${links.length === 1 ? '' : 's'}`,
        site: 'lionship',
        userId: user.id,
        username: user.username,
      });
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CREATE a new link
  app.post('/api/links', async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return;

      const { id, title, url, acronym, category, tags } = req.body;
      const requestedScope = String(req.body?.scope || '').toLowerCase();
      const scope = canManageGlobalLinks(user) && requestedScope === 'global' ? 'global' : 'personal';
      const ownerUserId = scope === 'personal' ? user.id : null;
      const db = initDb()!;
      await db.execute(
        'INSERT INTO links (id, title, url, acronym, category, tags, scope, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), url=VALUES(url), acronym=VALUES(acronym), category=VALUES(category), tags=VALUES(tags), scope=VALUES(scope), owner_user_id=VALUES(owner_user_id)',
        [id, title, url, acronym, category, tags || '', scope, ownerUserId]
      );
      void logAuthHistory({
        action: scope === 'global' ? 'lionship.master_created' : 'lionship.personal_created',
        target: `${title} (${id})`,
        site: 'lionship',
        userId: user.id,
        username: user.username,
      });
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // UPDATE a link
  app.put('/api/links/:id', async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { title, url, acronym, category, tags } = req.body;
      const db = initDb()!;
      const [rows] = await db.query('SELECT * FROM links WHERE id = ?', [id]);
      const existing = (rows as Array<Record<string, unknown>>)[0] ? normalizeLinkRecord((rows as Array<Record<string, unknown>>)[0]) : null;
      if (!existing) {
        return res.status(404).json({ error: 'Link not found.' });
      }
      if (!canEditLinkRecord(existing, user)) {
        return res.status(403).json({ error: 'You can only edit your own personal links.' });
      }

      const requestedScope = String(req.body?.scope || existing.scope || 'global').toLowerCase();
      const nextScope = user.isOwner && requestedScope === 'global' ? 'global' : 'personal';
      const nextOwnerUserId = nextScope === 'personal' ? (existing.owner_user_id || user.id) : null;
      await db.execute(
        'UPDATE links SET title = ?, url = ?, acronym = ?, category = ?, tags = ?, scope = ?, owner_user_id = ? WHERE id = ?',
        [title, url, acronym, category, tags || '', nextScope, nextOwnerUserId, id]
      );
      void logAuthHistory({
        action: nextScope === 'global' ? 'lionship.master_updated' : 'lionship.personal_updated',
        target: `${title} (${id})`,
        site: 'lionship',
        userId: user.id,
        username: user.username,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE a link
  app.delete('/api/links/:id', async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const db = initDb()!;
      const [rows] = await db.query('SELECT * FROM links WHERE id = ?', [id]);
      const existing = (rows as Array<Record<string, unknown>>)[0] ? normalizeLinkRecord((rows as Array<Record<string, unknown>>)[0]) : null;
      if (!existing) {
        return res.status(404).json({ error: 'Link not found.' });
      }
      if (!canEditLinkRecord(existing, user)) {
        return res.status(403).json({ error: 'You can only delete your own personal links.' });
      }
      await db.execute('DELETE FROM links WHERE id = ?', [id]);
      void logAuthHistory({
        action: existing.scope === 'global' ? 'lionship.master_deleted' : 'lionship.personal_deleted',
        target: `${existing.title} (${id})`,
        site: 'lionship',
        userId: user.id,
        username: user.username,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PUBLIC_BASE_URL}`);
  });
}

startServer();
