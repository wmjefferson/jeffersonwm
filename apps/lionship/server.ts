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
  let widgetEventsSchemaReady: Promise<void> | null = null;
  let widgetFontsSchemaReady: Promise<void> | null = null;
  let authStatusCache: { token: string; user: AuthStatusUser | null; timestamp: number } | null = null;
  const FALLBACK_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Playfair Display', 'Outfit'];
  const WIDGET_FONT_WEIGHT_MIN = 1;
  const WIDGET_FONT_WEIGHT_MAX = 5;
  const FALLBACK_WOTD = [
    {
      dictionary: 'Meliorism',
      merriam: 'M\u00e9tier',
      oxford: 'Serendipity',
      wiktionary: 'Verisimilitude'
    },
    {
      dictionary: 'Susurrus',
      merriam: 'Luminous',
      oxford: 'Resilience',
      wiktionary: 'Ubuntu'
    },
    {
      dictionary: 'Quixotic',
      merriam: 'Sempiternal',
      oxford: 'Ineffable',
      wiktionary: 'Eunoia'
    }
  ];
  let wotdCache: { data: typeof FALLBACK_WOTD[number]; timestamp: number } | null = null;

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

  const isMissingDescriptionColumnError = (error: unknown) =>
    error instanceof Error && /Unknown column 'description'|description.*doesn't exist/i.test(error.message);

  const ensureWidgetEventsSchema = async () => {
    const db = initDb();
    if (!db) return;
    if (widgetEventsSchemaReady) {
      return widgetEventsSchemaReady;
    }

    widgetEventsSchemaReady = (async () => {
      try {
        const [rows] = await db.query(
          `SELECT COUNT(*) AS count
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = 'jeffers4_dates'
             AND TABLE_NAME = 'events'
             AND COLUMN_NAME = 'description'`
        );
        const count = Number((rows as Array<{ count?: number }>)[0]?.count || 0);
        if (count === 0) {
          await db.execute('ALTER TABLE jeffers4_dates.events ADD COLUMN description TEXT NULL');
          console.log('Widget events schema updated with description column.');
        }
      } catch (error) {
        console.error('Widget event schema check failed:', error);
      }
    })();

    return widgetEventsSchemaReady;
  };

  const ensureWidgetFontsSchema = async () => {
    const db = initDb();
    if (!db) return;
    if (widgetFontsSchemaReady) {
      return widgetFontsSchemaReady;
    }

    widgetFontsSchemaReady = (async () => {
      try {
        const [rows] = await db.query(
          `SELECT COUNT(*) AS count
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = 'jeffers4_fonts'
             AND TABLE_NAME = 'fonts'
             AND COLUMN_NAME = 'weight'`
        );
        const count = Number((rows as Array<{ count?: number }>)[0]?.count || 0);
        if (count === 0) {
          await db.execute(
            'ALTER TABLE jeffers4_fonts.fonts ADD COLUMN weight TINYINT NOT NULL DEFAULT 2'
          );
          console.log('Widget fonts schema updated with weight column.');
        }
      } catch (error) {
        console.error('Widget fonts schema check failed:', error);
      }
    })();

    return widgetFontsSchemaReady;
  };

  const getWidgetFonts = async () => {
    const db = initDb();
    if (!db) return FALLBACK_FONTS;
    await ensureWidgetFontsSchema();

    try {
      const [rows] = await db.query('SELECT name, weight FROM jeffers4_fonts.fonts');
      const fonts = (rows as Array<{ name?: string; weight?: number | string | null }>)
        .map(row => {
          const name = row.name?.trim();
          if (!name) return null;

          const parsedWeight = Number(row.weight);
          const weight = Number.isFinite(parsedWeight)
            ? Math.min(WIDGET_FONT_WEIGHT_MAX, Math.max(WIDGET_FONT_WEIGHT_MIN, Math.round(parsedWeight)))
            : 2;

          return { name, weight };
        })
        .filter((font): font is { name: string; weight: number } => Boolean(font));
      return fonts.length > 0 ? fonts : FALLBACK_FONTS;
    } catch (error) {
      console.error('Widget fonts query failed:', error);
      return FALLBACK_FONTS;
    }
  };

  const getWidgetNextEvent = async () => {
    const db = initDb();
    if (!db) return null;
    await ensureWidgetEventsSchema();

    try {
      const [rows] = await db.query('SELECT id, name, description, date, end_date FROM jeffers4_dates.events');
      const events = rows as Array<{
        id: number;
        name: string;
        description?: string | null;
        date: Date | string;
        end_date?: Date | string | null;
      }>;

      if (events.length === 0) {
        return null;
      }

      const now = new Date();
      const currentVal = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
      const sortedEvents = [...events].sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        const aVal = (aDate.getUTCMonth() + 1) * 100 + aDate.getUTCDate();
        const bVal = (bDate.getUTCMonth() + 1) * 100 + bDate.getUTCDate();
        return aVal - bVal;
      });

      const nextEvent = sortedEvents.find(event => {
        const eventDate = new Date(event.date);
        const eventVal = (eventDate.getUTCMonth() + 1) * 100 + eventDate.getUTCDate();
        return eventVal >= currentVal;
      }) || sortedEvents[0];

      return nextEvent;
    } catch (error) {
      if (isMissingDescriptionColumnError(error)) {
        try {
          const [fallbackRows] = await db.query('SELECT id, name, date, end_date FROM jeffers4_dates.events');
          const fallbackEvents = (fallbackRows as Array<{
            id: number;
            name: string;
            date: Date | string;
            end_date?: Date | string | null;
          }>).map(event => ({ ...event, description: null }));

          if (fallbackEvents.length === 0) {
            return null;
          }

          const now = new Date();
          const currentVal = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
          const sortedEvents = [...fallbackEvents].sort((a, b) => {
            const aDate = new Date(a.date);
            const bDate = new Date(b.date);
            const aVal = (aDate.getUTCMonth() + 1) * 100 + aDate.getUTCDate();
            const bVal = (bDate.getUTCMonth() + 1) * 100 + bDate.getUTCDate();
            return aVal - bVal;
          });

          return sortedEvents.find(event => {
            const eventDate = new Date(event.date);
            const eventVal = (eventDate.getUTCMonth() + 1) * 100 + eventDate.getUTCDate();
            return eventVal >= currentVal;
          }) || sortedEvents[0];
        } catch (fallbackError) {
          console.error('Widget next event fallback query failed:', fallbackError);
        }
      }
      console.error('Widget next event query failed:', error);
      return null;
    }
  };

  const getWidgetAllEvents = async () => {
    const db = initDb();
    if (!db) return [];
    await ensureWidgetEventsSchema();

    try {
      const [rows] = await db.query(
        'SELECT id, name, description, date, end_date FROM jeffers4_dates.events ORDER BY MONTH(date) ASC, DAY(date) ASC'
      );
      return rows as Array<{
        id: number;
        name: string;
        description?: string | null;
        date: Date | string;
        end_date?: Date | string | null;
      }>;
    } catch (error) {
      if (isMissingDescriptionColumnError(error)) {
        try {
          const [fallbackRows] = await db.query(
            'SELECT id, name, date, end_date FROM jeffers4_dates.events ORDER BY MONTH(date) ASC, DAY(date) ASC'
          );
          return (fallbackRows as Array<{
            id: number;
            name: string;
            date: Date | string;
            end_date?: Date | string | null;
          }>).map(event => ({ ...event, description: null }));
        } catch (fallbackError) {
          console.error('Widget all events fallback query failed:', fallbackError);
        }
      }
      console.error('Widget all events query failed:', error);
      return [];
    }
  };

  const getWidgetWotd = async () => {
    if (wotdCache && (Date.now() - wotdCache.timestamp) < 60 * 60 * 1000) {
      return wotdCache.data;
    }

    const fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };

    const dailyFallback = FALLBACK_WOTD[Math.floor(Date.now() / 86400000) % FALLBACK_WOTD.length];
    const result = { ...dailyFallback };

    try {
      const dictRes = await fetch('https://www.dictionary.com/e/word-of-the-day/', fetchOptions);
      const dictHtml = await dictRes.text();
      const dictMatch = dictHtml.match(/<div class=\"otd-item-headword__word\">[\s\S]*?<h1>(.*?)<\/h1>/i)
        || dictHtml.match(/<title>Word of the Day: (.*?) \| Dictionary\.com<\/title>/i);
      if (dictMatch?.[1]) {
        result.dictionary = dictMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    } catch (error) {
      console.error('Dictionary WOTD fetch failed:', error);
    }

    try {
      const mwRes = await fetch('https://www.merriam-webster.com/wotd/feed/rss2', fetchOptions);
      const mwXml = await mwRes.text();
      const mwMatch = mwXml.match(/<item>[\s\S]*?<title>(?:Word of the Day: )?(.*?)<\/title>/i);
      if (mwMatch?.[1]) {
        result.merriam = mwMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      }
    } catch (error) {
      console.error('Merriam WOTD fetch failed:', error);
    }

    try {
      const wikRes = await fetch('https://en.wiktionary.org/w/api.php?action=featuredfeed&feed=wotd&format=xml', fetchOptions);
      const wikXml = await wikRes.text();
      const items = wikXml.split('<item>');
      const lastItem = items[items.length - 1];
      const wikMatch = lastItem.match(/id=&quot;WOTD-rss-title&quot;&gt;(.*?)&lt;\/span&gt;/i)
        || lastItem.match(/id=\"WOTD-rss-title\">(.*?)<\/span>/i)
        || lastItem.match(/<title>(?:Word of the day for .*: )?(.*?)<\/title>/i);
      if (wikMatch?.[1]) {
        result.wiktionary = wikMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    } catch (error) {
      console.error('Wiktionary WOTD fetch failed:', error);
    }

    wotdCache = {
      data: result,
      timestamp: Date.now()
    };

    return result;
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

  app.get('/api/widget/fonts', async (_req, res) => {
    res.json(await getWidgetFonts());
  });

  app.put('/api/widget/fonts/:name', async (req, res) => {
    const db = initDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not configured.' });
    }

    await ensureWidgetFontsSchema();

    const fontName = decodeURIComponent(req.params.name ?? '').trim();
    const requestedWeight = Number(req.body?.weight);
    if (!fontName) {
      return res.status(400).json({ error: 'Font name is required.' });
    }

    if (!Number.isFinite(requestedWeight)) {
      return res.status(400).json({ error: 'Weight is required.' });
    }

    const weight = Math.min(
      WIDGET_FONT_WEIGHT_MAX,
      Math.max(WIDGET_FONT_WEIGHT_MIN, Math.round(requestedWeight))
    );

    try {
      const [result] = await db.execute(
        'UPDATE jeffers4_fonts.fonts SET weight = ? WHERE name = ?',
        [weight, fontName]
      );

      if ((result as mysql.ResultSetHeader).affectedRows === 0) {
        return res.status(404).json({ error: 'Font not found.' });
      }

      res.json({ success: true, name: fontName, weight });
    } catch (error) {
      console.error('Widget font update failed:', error);
      res.status(500).json({ error: 'Failed to update font weight.' });
    }
  });

  app.get('/api/widget/next-event', async (_req, res) => {
    res.json(await getWidgetNextEvent());
  });

  app.get('/api/widget/all-events', async (_req, res) => {
    res.json(await getWidgetAllEvents());
  });

  app.post('/api/widget/events', async (req, res) => {
    const db = initDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not configured.' });
    }

    await ensureWidgetEventsSchema();

    const { name, description, date, end_date } = req.body ?? {};
    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required.' });
    }

    try {
      try {
        const [result] = await db.execute(
          'INSERT INTO jeffers4_dates.events (name, description, date, end_date) VALUES (?, ?, ?, ?)',
          [name, description || null, date, end_date || null]
        );
        res.status(201).json({ success: true, id: (result as mysql.ResultSetHeader).insertId });
        return;
      } catch (error) {
        if (!isMissingDescriptionColumnError(error)) {
          throw error;
        }
      }

      const [result] = await db.execute(
        'INSERT INTO jeffers4_dates.events (name, date, end_date) VALUES (?, ?, ?)',
        [name, date, end_date || null]
      );
      res.status(201).json({ success: true, id: (result as mysql.ResultSetHeader).insertId });
    } catch (error) {
      console.error('Widget add event failed:', error);
      res.status(500).json({ error: 'Failed to add event.' });
    }
  });

  app.put('/api/widget/events/:id', async (req, res) => {
    const db = initDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not configured.' });
    }

    const { id } = req.params;
    await ensureWidgetEventsSchema();

    const { name, description, date, end_date } = req.body ?? {};
    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required.' });
    }

    try {
      try {
        await db.execute(
          'UPDATE jeffers4_dates.events SET name = ?, description = ?, date = ?, end_date = ? WHERE id = ?',
          [name, description || null, date, end_date || null, id]
        );
      } catch (error) {
        if (!isMissingDescriptionColumnError(error)) {
          throw error;
        }

        await db.execute(
          'UPDATE jeffers4_dates.events SET name = ?, date = ?, end_date = ? WHERE id = ?',
          [name, date, end_date || null, id]
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Widget update event failed:', error);
      res.status(500).json({ error: 'Failed to update event.' });
    }
  });

  app.delete('/api/widget/events/:id', async (req, res) => {
    const db = initDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not configured.' });
    }

    try {
      await db.execute('DELETE FROM jeffers4_dates.events WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Widget delete event failed:', error);
      res.status(500).json({ error: 'Failed to delete event.' });
    }
  });

  app.get('/api/widget/wotd', async (_req, res) => {
    res.json(await getWidgetWotd());
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
