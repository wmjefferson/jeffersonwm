import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import cors from 'cors';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || '8040');
  const HOST = process.env.HOST || '0.0.0.0';
  const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
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
  const FALLBACK_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Playfair Display', 'Outfit'];
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
          category VARCHAR(100)
        )
      `).then(async () => {
        console.log('Links table ready.');
        try {
          const [columns] = await pool!.query(
            `SELECT COUNT(*) AS count
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ?
               AND TABLE_NAME = 'links'
               AND COLUMN_NAME = 'tags'`,
             [process.env.MYSQL_DATABASE]
          );
          const count = Number((columns as Array<{ count?: number }>)[0]?.count || 0);
          if (count === 0) {
            await pool!.execute('ALTER TABLE links ADD COLUMN tags TEXT NULL');
            console.log('Added tags column to links table.');
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
            ? Math.min(3, Math.max(1, Math.round(parsedWeight)))
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
      const db = initDb()!;
      const [rows] = await db.query('SELECT * FROM links');
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/widget/fonts', async (_req, res) => {
    res.json(await getWidgetFonts());
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
      const links = req.body.links;
      const db = initDb()!;
      if (!Array.isArray(links)) return res.status(400).json({ error: 'Expected an array of links' });
      for (const link of links) {
        await db.execute(
          'INSERT IGNORE INTO links (id, title, url, acronym, category, tags) VALUES (?, ?, ?, ?, ?, ?)',
          [link.id, link.title, link.url, link.acronym, link.category, link.tags || '']
        );
      }
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CREATE a new link
  app.post('/api/links', async (req, res) => {
    try {
      const { id, title, url, acronym, category, tags } = req.body;
      const db = initDb()!;
      await db.execute(
        'INSERT INTO links (id, title, url, acronym, category, tags) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), url=VALUES(url), acronym=VALUES(acronym), category=VALUES(category), tags=VALUES(tags)',
        [id, title, url, acronym, category, tags || '']
      );
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // UPDATE a link
  app.put('/api/links/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, url, acronym, category, tags } = req.body;
      const db = initDb()!;
      await db.execute(
        'UPDATE links SET title = ?, url = ?, acronym = ?, category = ?, tags = ? WHERE id = ?',
        [title, url, acronym, category, tags || '', id]
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE a link
  app.delete('/api/links/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const db = initDb()!;
      await db.execute('DELETE FROM links WHERE id = ?', [id]);
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
