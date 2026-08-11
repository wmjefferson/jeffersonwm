import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFile = process.env.JEFFERSONWM_ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development');

dotenv.config({ path: path.join(__dirname, envFile) });
dotenv.config();

const app = express();
const port = Number(process.env.JEFFERSONWM_PORT || process.env.PORT || 3000);
const allowedOrigin = process.env.JEFFERSONWM_ALLOWED_ORIGIN || 'http://localhost:5173';
const adminToken = process.env.JEFFERSONWM_WIDGET_ADMIN_TOKEN || '';

type WidgetFont = {
  id?: number;
  name: string;
  weight?: number;
  probability?: number;
};

type WidgetEvent = {
  id?: number;
  name: string;
  description?: string | null;
  date: string;
  end_date?: string | null;
  is_public?: number | boolean;
};

const fallbackFonts: WidgetFont[] = [
  { name: 'IBM Plex Sans Condensed', weight: 2, probability: 3 },
  { name: 'Newsreader', weight: 2, probability: 2 },
  { name: 'Gelasio', weight: 2, probability: 1 },
];

const fallbackWords = {
  dictionary: 'serendipity',
  merriam: 'resilience',
  oxford: 'constellation',
  wiktionary: 'half-baked',
};

const dbConfig = {
  host: process.env.JEFFERSONWM_WIDGET_DB_HOST || process.env.MYSQL_HOST,
  user: process.env.JEFFERSONWM_WIDGET_DB_USER || process.env.MYSQL_USER,
  password: process.env.JEFFERSONWM_WIDGET_DB_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.JEFFERSONWM_WIDGET_DB_NAME || process.env.MYSQL_DATABASE,
  port: Number(process.env.JEFFERSONWM_WIDGET_DB_PORT || process.env.MYSQL_PORT || 3306),
};

const isDbConfigured = Boolean(dbConfig.host && dbConfig.user && dbConfig.password && dbConfig.database);

const pool = isDbConfigured
  ? mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  : null;

function hasAdminAccess(req: express.Request) {
  if (!adminToken) {
    return false;
  }

  return req.get('x-widget-admin-token') === adminToken;
}

function requireWidgetAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (hasAdminAccess(req)) {
    next();
    return;
  }

  res.status(403).json({
    ok: false,
    error: 'Widget admin access is not enabled for this request.',
  });
}

function requireDb(res: express.Response) {
  if (!pool) {
    res.status(503).json({
      ok: false,
      error: 'JeffersonWM widget database is not configured yet.',
    });
    return null;
  }

  return pool;
}

function normalizeDateValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value || '').slice(0, 10);
}

function sortEventsByNextOccurrence(events: WidgetEvent[]) {
  const today = new Date();
  const current = (today.getMonth() + 1) * 100 + today.getDate();

  return [...events].sort((a, b) => {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);
    const aValue = (aDate.getUTCMonth() + 1) * 100 + aDate.getUTCDate();
    const bValue = (bDate.getUTCMonth() + 1) * 100 + bDate.getUTCDate();
    const aDistance = aValue >= current ? aValue - current : aValue + 1231 - current;
    const bDistance = bValue >= current ? bValue - current : bValue + 1231 - current;
    return aDistance - bDistance;
  });
}

async function getEvents() {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, name, description, date, end_date, is_public
     FROM widget_special_dates
     ORDER BY MONTH(date) ASC, DAY(date) ASC, name ASC`,
  );

  return (rows as WidgetEvent[]).map(event => ({
    ...event,
    date: normalizeDateValue(event.date),
    end_date: event.end_date ? normalizeDateValue(event.end_date) : null,
  }));
}

async function getFonts() {
  if (!pool) {
    return fallbackFonts;
  }

  const [rows] = await pool.query(
    `SELECT id, name, weight, probability
     FROM widget_fonts
     ORDER BY name ASC`,
  );

  return rows as WidgetFont[];
}

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>JeffersonWM API</title></head>
      <body>
        <h1>JeffersonWM API</h1>
        <p>Widget ownership is moving here from Lionship.</p>
        <ul>
          <li><code>/health</code> returns API and database status</li>
          <li><code>/api/widget/resolved</code> returns widget defaults and public data</li>
          <li><code>/api/widget/schema</code> describes the expected widget database tables</li>
        </ul>
      </body>
    </html>
  `);
});

app.get('/health', async (_req, res) => {
  let dbOk = false;
  let dbError = '';

  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown database error';
    }
  }

  res.json({
    ok: true,
    app: 'jeffersonwm',
    widgetOwner: 'jeffersonwm',
    dbConfigured: isDbConfigured,
    dbOk,
    dbError,
    writeAccess: adminToken ? 'token-required' : 'disabled',
  });
});

app.get('/api/widget/schema', (_req, res) => {
  res.json({
    ok: true,
    tables: [
      'widget_defaults',
      'widget_fonts',
      'widget_special_dates',
      'user_widget_preferences',
      'user_widget_special_dates',
    ],
    migrationSources: ['jeffers4_dates.events', 'jeffers4_fonts.fonts'],
    legacyReview: ['jeffers4_jefferson'],
  });
});

app.get('/api/widget/resolved', async (req, res) => {
  try {
    const events = await getEvents();
    const sortedEvents = sortEventsByNextOccurrence(events);

    res.json({
      ok: true,
      auth: {
        canEditDefaults: hasAdminAccess(req),
      },
      resolved: {
        locationLabel: 'San Francisco, California',
        latitude: 37.7811,
        longitude: -122.4883,
        weatherUnit: 'fahrenheit',
        specialDates: events,
        nextSpecialDate: sortedEvents[0] || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget state could not be resolved.',
    });
  }
});

app.get('/api/widget/fonts', async (_req, res) => {
  try {
    res.json(await getFonts());
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Fonts could not be loaded.',
    });
  }
});

app.put('/api/widget/fonts/:name', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const weight = Number(req.body?.weight);
  const probability = Number(req.body?.probability);

  if (!Number.isFinite(weight) || weight < 1 || weight > 5 || !Number.isFinite(probability)) {
    res.status(400).json({ ok: false, error: 'Expected weight 1-5 and numeric probability.' });
    return;
  }

  await db.execute('UPDATE widget_fonts SET weight = ?, probability = ? WHERE name = ?', [
    weight,
    probability,
    req.params.name,
  ]);
  res.json({ ok: true });
});

app.get('/api/widget/all-events', async (_req, res) => {
  try {
    res.json(await getEvents());
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Events could not be loaded.',
    });
  }
});

app.get('/api/widget/next-event', async (_req, res) => {
  try {
    const events = await getEvents();
    res.json(sortEventsByNextOccurrence(events)[0] || null);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Next event could not be loaded.',
    });
  }
});

app.post('/api/widget/events', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const { name, description, date, end_date: endDate } = req.body || {};
  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    'INSERT INTO widget_special_dates (name, description, date, end_date, is_public) VALUES (?, ?, ?, ?, 1)',
    [name, description || null, date, endDate || null],
  );
  res.json({ ok: true });
});

app.put('/api/widget/events/:id', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const { name, description, date, end_date: endDate } = req.body || {};
  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    'UPDATE widget_special_dates SET name = ?, description = ?, date = ?, end_date = ? WHERE id = ?',
    [name, description || null, date, endDate || null, req.params.id],
  );
  res.json({ ok: true });
});

app.delete('/api/widget/events/:id', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  await db.execute('DELETE FROM widget_special_dates WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/widget/wotd', (_req, res) => {
  res.json(fallbackWords);
});

app.listen(port, () => {
  console.log(`JeffersonWM API listening on http://localhost:${port}`);
});
